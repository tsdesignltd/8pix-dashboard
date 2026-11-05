import {test} from 'node:test';import assert from 'node:assert/strict';
import {collect,collectX,collectInstagram,initial} from '../scripts/collect.mjs';
import {aggregate,validData,stale,historyPoints} from '../site/model.js';
const config={accounts:{x:{handle:'eightpxdx'},instagram:{handle:'eightpxdx'}}},now=new Date('2026-11-05T01:00:00Z');
const response=value=>({ok:true,json:async()=>value});
test('missing credentials never create fake zero metrics or contact APIs',async()=>{
 const data=await collect({config,env:{},now,fetcher:()=>{throw Error('must not fetch');}});assert.equal(validData(data),true);assert.equal(data.channels[0].followers,null);assert.equal(aggregate(data.channels).followers.value,null);assert.equal(data.history.length,0);
});
test('X pagination includes all pages and exact views including real zero',async()=>{
 const urls=[],fetcher=async url=>{urls.push(String(url));if(String(url).includes('/by/username/'))return response({data:{id:'123',username:'eightpxdx',public_metrics:{followers_count:7,tweet_count:30}}});return response(urls.length===2?{data:[{id:'a',public_metrics:{impression_count:0}}],meta:{next_token:'cursor'}}:{data:[{id:'b',public_metrics:{impression_count:40}}],meta:{}});};
 const row=await collectX(config,{X_BEARER_TOKEN:'private-token'},fetcher,now);assert.equal(row.views,40);assert.equal(row.periodPosts,2);assert.equal(row.totalPosts,30);assert.ok(urls[2].includes('pagination_token=cursor'));assert.equal(JSON.stringify(row).includes('private-token'),false);
});
test('X unavailable impressions stay unknown while profile metrics survive',async()=>{
 const fetcher=async url=>response(String(url).includes('/by/username/')?{data:{id:'123',username:'eightpxdx',public_metrics:{followers_count:0,tweet_count:1}}}:{data:[{id:'a',public_metrics:{like_count:4}}]});
 const row=await collectX(config,{X_BEARER_TOKEN:'token'},fetcher,now);assert.equal(row.status,'partial');assert.equal(row.followers,0);assert.equal(row.views,null);assert.equal(row.periodPosts,1);
});
test('API failure retains actual previous timestamp and never leaks token errors',async()=>{
 const previous=initial();previous.channels[0]={...previous.channels[0],status:'ok',followers:8,fetchedAt:'2026-11-01T00:00:00Z'};
 const data=await collect({config,previous,env:{X_BEARER_TOKEN:'SECRET'},now,fetcher:()=>{throw Error('SECRET');}});assert.equal(data.channels[0].status,'error');assert.equal(data.channels[0].followers,8);assert.equal(data.channels[0].fetchedAt,'2026-11-01T00:00:00Z');assert.equal(data.history.length,0);assert.equal(JSON.stringify(data).includes('SECRET'),false);assert.equal(stale(data.channels[0],now.getTime()),true);
});
test('Instagram metrics use expected profile, insight values and media pagination',async()=>{
 const calls=[],fetcher=async url=>{url=String(url);calls.push(url);if(url.includes('/insights'))return response({data:[{name:'views',values:Array.from({length:30},()=>({value:3}))}]});if(url.includes('/media'))return response(url.includes('after=next')?{data:[{id:'old',timestamp:'2025-01-01T00:00:00Z'}]}:{data:[{id:'new',timestamp:'2026-11-01T00:00:00Z'}],paging:{next:'https://untrusted.invalid/?token=SECRET',cursors:{after:'next'}}});return response({id:'456',username:'eightpxdx',followers_count:23,media_count:5});};
 const row=await collectInstagram(config,{INSTAGRAM_ACCESS_TOKEN:'SECRET',INSTAGRAM_USER_ID:'456'},fetcher,now);assert.equal(row.views,90);assert.equal(row.periodPosts,1);assert.equal(row.followers,23);assert.ok(calls.every(url=>url.startsWith('https://graph.instagram.com/')));assert.equal(calls.some(url=>url.includes('SECRET')),false);
});
test('wrong account cannot populate the dashboard',async()=>{
 await assert.rejects(collectInstagram(config,{INSTAGRAM_ACCESS_TOKEN:'token',INSTAGRAM_USER_ID:'456'},async()=>response({username:'wrong'}),now));
});
test('partial totals and history show only known observations; invalid payloads fail validation',()=>{
 const data=initial();data.channels[0].followers=10;data.channels[0].periodPosts=0;const a=aggregate(data.channels);assert.equal(a.followers.value,10);assert.equal(a.followers.count,1);assert.equal(a.posts.value,0);assert.equal(historyPoints([{platform:'x',day:'2026-11-05',followers:null}], 'x').length,0);data.channels[0].views=-1;assert.equal(validData(data),false);
});
