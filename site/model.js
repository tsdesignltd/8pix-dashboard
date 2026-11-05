export const KEYS=['x','pixiv','instagram'];
export const LABELS={x:'X',pixiv:'pixiv',instagram:'Instagram'};
export const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export const count=n=>validNumber(n)?new Intl.NumberFormat('ja-JP').format(n):'—';
export function validData(data){return data?.version===1&&Array.isArray(data.channels)&&data.channels.every(c=>KEYS.includes(c.platform)&&['unconfigured','unsupported','ok','partial','error'].includes(c.status)&&['followers','totalPosts','periodPosts','views'].every(k=>c[k]===null||validNumber(c[k])))&&new Set(data.channels.map(c=>c.platform)).size===data.channels.length;}
export function sumAvailable(channels,key){const rows=channels.filter(c=>validNumber(c[key]));return {value:rows.length?rows.reduce((s,c)=>s+c[key],0):null,count:rows.length};}
export function aggregate(channels){return {followers:sumAvailable(channels,'followers'),posts:sumAvailable(channels,'periodPosts'),connected:channels.filter(c=>c.status==='ok'||c.status==='partial').length};}
export function stale(c,now=Date.now()){return !c.fetchedAt||!Number.isFinite(Date.parse(c.fetchedAt))||now-Date.parse(c.fetchedAt)>36*3600*1000;}
export function historyPoints(data,platform){return (Array.isArray(data)?data:[]).filter(x=>x&&x.platform===platform&&/^\d{4}-\d{2}-\d{2}$/.test(x.day)&&validNumber(x.followers)).sort((a,b)=>a.day.localeCompare(b.day));}
