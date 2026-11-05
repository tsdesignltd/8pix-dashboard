import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validNumber,validData} from '../site/model.js';
const root=new URL('../',import.meta.url);
export const initial=()=>({version:1,generatedAt:null,windowDays:30,channels:[
 {platform:'x',status:'unconfigured',followers:null,totalPosts:null,periodPosts:null,views:null,fetchedAt:null,viewScope:'過去30日に公開した投稿の累計表示数',message:'X APIの接続が必要です。API利用権限・料金をご確認ください。'},
 {platform:'pixiv',status:'unsupported',followers:null,totalPosts:null,periodPosts:null,views:null,fetchedAt:null,viewScope:'作品の閲覧数（インプレッションとは異なります）',message:'公式の自動取得方法を確認中です。現在は未取得です。'},
 {platform:'instagram',status:'unconfigured',followers:null,totalPosts:null,periodPosts:null,views:null,fetchedAt:null,viewScope:'過去30日のアカウントViews',message:'プロアカウントのInstagram API接続が必要です。'}],history:[]});
const n=value=>validNumber(value)?value:null;
export async function json(url,token,fetcher=fetch){
 const response=await fetcher(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000),redirect:'error'});
 if(!response.ok)throw Error('API HTTP '+response.status);
 const value=await response.json();if(value.error||value.errors?.length&&!value.data)throw Error('API response error');return value;
}
export async function collectX(config,env,fetcher=fetch,now=new Date()){
 if(!env.X_BEARER_TOKEN)return null;
 const base='https://api.x.com/2',username=config.accounts.x.handle;
 const user=await json(base+'/users/by/username/'+encodeURIComponent(username)+'?user.fields=public_metrics',env.X_BEARER_TOKEN,fetcher);
 if(!user.data?.id||user.data.username?.toLowerCase()!==username.toLowerCase())throw Error('X account mismatch');
 const row={...initial().channels[0],followers:n(user.data.public_metrics?.followers_count),totalPosts:n(user.data.public_metrics?.tweet_count),status:'ok',fetchedAt:now.toISOString(),message:'X APIから取得。返信を含み、期間内投稿ではリポストを除外。'};
 try{
 const since=new Date(now.getTime()-30*86400000).toISOString();let token,posts=[],complete=false;
 for(let page=0;page<20;page++){
  const url=new URL(base+'/users/'+user.data.id+'/tweets');url.search=new URLSearchParams({max_results:'100',exclude:'retweets',start_time:since,'tweet.fields':'created_at,public_metrics',...(token?{pagination_token:token}:{})});
  const result=await json(url,env.X_BEARER_TOKEN,fetcher);if(result.data!==undefined&&!Array.isArray(result.data))throw Error('Invalid post list');posts.push(...result.data||[]);token=result.meta?.next_token;if(!token){complete=true;break;}
 }
 if(!complete)throw Error('Pagination cap');
 const unique=[...new Map(posts.map(p=>[p.id,p])).values()];row.periodPosts=unique.length;
 row.views=unique.every(p=>validNumber(p.public_metrics?.impression_count))?unique.reduce((s,p)=>s+p.public_metrics.impression_count,0):null;
 if(row.views===null){row.status='partial';row.message='フォロワー・投稿数を取得。インプレッションはAPIで取得できませんでした。';}
 }catch{row.status='partial';row.message='フォロワー・投稿総数のみ取得。期間内投稿と表示数のAPI権限・制限を確認してください。';}
 if(row.followers===null||row.totalPosts===null)row.status='partial';return row;
}
export async function collectInstagram(config,env,fetcher=fetch,now=new Date()){
 if(!env.INSTAGRAM_ACCESS_TOKEN||!env.INSTAGRAM_USER_ID)return null;
 const version=env.INSTAGRAM_API_VERSION||'v24.0';if(!/^v\d+\.\d+$/.test(version)||!/^\d+$/.test(env.INSTAGRAM_USER_ID))throw Error('Invalid Instagram configuration');
 const base='https://graph.instagram.com/'+version+'/'+env.INSTAGRAM_USER_ID;
 const profile=await json(base+'?fields=id,username,followers_count,media_count',env.INSTAGRAM_ACCESS_TOKEN,fetcher);
 if(profile.username?.toLowerCase()!==config.accounts.instagram.handle.toLowerCase())throw Error('Instagram account mismatch');
 const row={...initial().channels[2],status:'ok',followers:n(profile.followers_count),totalPosts:n(profile.media_count),fetchedAt:now.toISOString(),message:'Instagram APIから取得。Viewsはインプレッションと異なる指標です。'};
 const since=Math.floor(now.getTime()/1000)-30*86400,until=Math.floor(now.getTime()/1000);let issues=[];
 try{
  const result=await json(base+'/insights?'+new URLSearchParams({metric:'views',period:'day',metric_type:'total_value',since:String(since),until:String(until)}),env.INSTAGRAM_ACCESS_TOKEN,fetcher);
  const metric=result.data?.find(m=>m.name==='views');
  // Read only an explicit total for the requested interval. Empty data is unknown.
  if(!validNumber(metric?.total_value?.value))throw Error('Missing views');
  row.views=metric.total_value.value;
 }catch{issues.push('Viewsは未取得');}
 try{
  let after,posts=[],complete=false;
  for(let page=0;page<20;page++){
   const result=await json(base+'/media?'+new URLSearchParams({fields:'id,timestamp',limit:'100',...(after?{after}:{})}),env.INSTAGRAM_ACCESS_TOKEN,fetcher);
   if(!Array.isArray(result.data))throw Error('Invalid media list');posts.push(...result.data);
   // Do not follow an API-provided URL with credentials. Only reuse the cursor on the fixed host.
   if(!result.paging?.next){complete=true;break;}after=result.paging?.cursors?.after;if(!after)throw Error('Missing cursor');
  }
  if(!complete||posts.some(p=>!Number.isFinite(Date.parse(p.timestamp))))throw Error('Incomplete media list');
  row.periodPosts=[...new Map(posts.map(p=>[p.id,p])).values()].filter(p=>Date.parse(p.timestamp)>=since*1000&&Date.parse(p.timestamp)<=now.getTime()).length;
 }catch{issues.push('期間内投稿数は未取得');}
 if(issues.length||row.followers===null||row.totalPosts===null){row.status='partial';row.message=issues.join('。')+'。権限・APIの利用条件を確認してください。';}return row;
}
export async function collect({config,previous=initial(),env=process.env,fetcher=fetch,now=new Date()}){
 const current=structuredClone(previous),defaults=initial();if(!validData(current))throw Error('Invalid existing data');current.generatedAt=now.toISOString();
 for(const [platform,collector]of [['x',collectX],['instagram',collectInstagram]]){
  const index=current.channels.findIndex(c=>c.platform===platform),old=current.channels[index]||defaults.channels.find(c=>c.platform===platform);let row;
  try{row=await collector(config,env,fetcher,now);if(!row)row={...old,status:old.fetchedAt?'error':'unconfigured',message:'APIの認証情報が未設定です。過去データがある場合は前回取得値を保持しています。'};}
  catch{row={...old,status:'error',message:'API取得に失敗しました。トークンの期限・権限・利用上限を確認してください。前回の取得値は保持しています。'};}
  if(index<0)current.channels.push(row);else current.channels[index]=row;
 }
 if(!current.channels.some(c=>c.platform==='pixiv'))current.channels.push(defaults.channels[1]);
 const history=Array.isArray(current.history)?current.history:[],map=new Map(history.map(p=>[p.platform+':'+p.day,p]));
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(now);
 for(const row of current.channels)if(['ok','partial'].includes(row.status)&&row.fetchedAt===now.toISOString()&&validNumber(row.followers))map.set(row.platform+':'+day,{platform:row.platform,day,followers:row.followers});
 current.history=[...map.values()].filter(p=>Date.parse(p.day)>=now.getTime()-366*86400000).sort((a,b)=>a.day.localeCompare(b.day));
 return current;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=JSON.parse(await fs.readFile(new URL('site/data/config.json',root),'utf8')),file=new URL('site/data/metrics.json',root);
 let previous;try{previous=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;previous=initial();}
 const data=await collect({config,previous});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');console.log(data.channels.map(c=>c.platform+': '+c.status).join('\n'));
}
