import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {KEYS,validNumber,validData} from '../site/model.js';

const profiles={x:'https://x.com/eightpxdx',pixiv:'https://www.pixiv.net/users/130668931',instagram:'https://www.instagram.com/eightpxdx/'};
const fields=['followers','totalPosts','periodPosts','views'];

// Accept only numbers verified on visible pages, never cookies or page dumps.
export function importBrowser(previous,input,now=new Date()){
 if(!validData(previous)||!Array.isArray(input.observations))throw Error('Invalid snapshot');
 const next=structuredClone(previous),seen=new Set();
 next.collectionMode='browser';next.generatedAt=now.toISOString();
 for(const observation of input.observations){
  const {platform,observedAt,metrics,viewScope}=observation;
  const time=Date.parse(observedAt);
  if(!KEYS.includes(platform)||seen.has(platform)||!Number.isFinite(time)||time>now.getTime()+60000||!metrics||typeof metrics!=='object')throw Error('Invalid observation');
  seen.add(platform);
  if(Object.keys(metrics).some(k=>!fields.includes(k))||Object.values(metrics).some(v=>!validNumber(v)||!Number.isSafeInteger(v)))throw Error('Use exact, nonnegative counts');
  if(!Object.keys(metrics).length)continue;
  if(metrics.views!==undefined&&(typeof viewScope!=='string'||!viewScope.trim()))throw Error('Views require a verified scope');
  const row=next.channels.find(c=>c.platform===platform);if(!row)throw Error('Missing channel');
  for(const field of fields)row[field]=metrics[field]??null;
  Object.assign(row,{status:fields.every(k=>metrics[k]!==undefined)?'ok':'partial',source:'browser',sourceUrl:profiles[platform],fetchedAt:new Date(time).toISOString(),viewScope:metrics.views===undefined?'表示・閲覧数は未確認':viewScope,message:'ブラウザの表示を確認。未確認の項目は「—」で表示しています。'});
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(time));
  next.history=(next.history||[]).filter(p=>!(p.platform===platform&&p.day===day));
  if(metrics.followers!==undefined)next.history.push({platform,day,followers:metrics.followers});
 }
 next.history=(next.history||[]).filter(p=>Date.parse(p.day)>=now.getTime()-366*86400000).sort((a,b)=>a.day.localeCompare(b.day));
 return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Usage: npm run import:browser -- /absolute/path/observations.json');
 const file=new URL('../site/data/metrics.json',import.meta.url);
 const previous=JSON.parse(await fs.readFile(file,'utf8')),input=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
 await fs.writeFile(file,JSON.stringify(importBrowser(previous,input),null,2)+'\n');
 console.log('Verified browser observations imported.');
}
