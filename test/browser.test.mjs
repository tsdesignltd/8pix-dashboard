import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importBrowser} from '../scripts/import-browser.mjs';
import {initial} from '../scripts/collect.mjs';
const now=new Date('2026-11-05T03:36:00Z');
const observation={platform:'x',observedAt:now.toISOString(),metrics:{followers:3,totalPosts:6}};
test('browser snapshots retain exact numbers, mark missing fields unknown, and upsert JST history',()=>{
 const previous=initial();previous.channels[0].views=800;
 const first=importBrowser(previous,{observations:[observation]},now);
 assert.equal(first.channels[0].followers,3);assert.equal(first.channels[0].views,null);assert.equal(first.channels[0].status,'partial');
 const second=importBrowser(first,{observations:[{...observation,metrics:{followers:0}}]},now);
 assert.equal(second.history.length,1);assert.equal(second.history[0].followers,0);assert.equal(second.history[0].day,'2026-11-05');
});
test('unreadable channel does not pretend old values were refreshed',()=>{
 const previous=initial();previous.channels[0].fetchedAt='2026-11-01T00:00:00Z';
 const result=importBrowser(previous,{observations:[{...observation,metrics:{}}]},now);
 assert.equal(result.channels[0].fetchedAt,previous.channels[0].fetchedAt);
});
test('reject rounded counts, unknown fields, future timestamps, and unscoped views',()=>{
 for(const o of [{...observation,metrics:{followers:'1.2K'}},{...observation,metrics:{cookie:'secret'}},{...observation,observedAt:'2027-01-01T00:00:00Z'},{...observation,metrics:{views:10}}])assert.throws(()=>importBrowser(initial(),{observations:[o]},now));
});
