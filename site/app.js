import {KEYS,LABELS,count,validData,historyPoints,stale} from './model.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const profiles={x:['eightpxdx','https://x.com/eightpxdx'],pixiv:['130668931','https://www.pixiv.net/users/130668931'],instagram:['eightpxdx','https://www.instagram.com/eightpxdx/']};
const labels={ok:'接続済み',partial:'一部取得',error:'取得エラー',unconfigured:'未接続',unsupported:'接続方法を確認中'};
const viewLabels={x:'インプレッション',pixiv:'作品の閲覧数',instagram:'Views（表示回数）'};
function date(value){if(!value||!Number.isFinite(Date.parse(value)))return '未取得';return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
function card(c){
 const article=el('article',undefined,'channel-card'),head=el('div',undefined,'channel-head'),icon=el('span',c.platform==='x'?'X':c.platform==='pixiv'?'p':'◎','channel-icon '+c.platform);icon.setAttribute('aria-hidden','true');
 const names=el('div',undefined,'channel-name');names.append(el('h3',LABELS[c.platform]));const link=el('a',c.platform==='pixiv'?'ID '+profiles[c.platform][0]+' ↗':'@'+profiles[c.platform][0]+' ↗');link.href=profiles[c.platform][1];link.target='_blank';link.rel='noopener noreferrer';names.append(link);
 head.append(icon,names,el('span',labels[c.status],'status '+c.status));
 const primary=el('div',undefined,'channel-primary');primary.append(el('span',viewLabels[c.platform],'metric-label'),el('strong',count(c.views),'primary-number'),el('p',c.viewScope||'取得待ち','metric-scope'));
 const pair=el('div',undefined,'channel-pair');for(const [name,key]of [['フォロワー','followers'],['投稿総数','totalPosts']]){const v=el('div');v.append(el('span',name,'metric-label'),el('strong',count(c[key])));pair.append(v);}
 const foot=el('div',undefined,'channel-foot');foot.append(el('span','期間内投稿 '+count(c.periodPosts)+' 件'),el('span',c.fetchedAt?date(c.fetchedAt)+(stale(c)?' · 過去データ':''):'取得待ち',stale(c)?'stale-label':''));
 article.append(head,primary,pair,el('p',c.message||'','channel-message'),foot);return article;
}
function renderChart(history){
 const box=$('chart');box.replaceChildren();const series=KEYS.map(platform=>({platform,points:historyPoints(history,platform)})).filter(x=>x.points.length);
 if(!series.length){const empty=el('div',undefined,'chart-empty'),text=el('div');text.append(el('strong','最初のデータ取得を待っています'),el('p','接続後、フォロワーの変化がここに蓄積されます。'));empty.append(text);box.append(empty);return;}
 const days=[...new Set(series.flatMap(x=>x.points.map(p=>p.day)))].sort(),max=Math.max(1,...series.flatMap(x=>x.points.map(p=>p.followers)));
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 900 220');svg.setAttribute('role','img');svg.setAttribute('aria-label','フォロワー推移。詳細はチャンネル別の数値を参照。');
 const node=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
 for(let i=0;i<=4;i++){const y=15+i*43;node('line',{x1:50,x2:880,y1:y,y2:y,stroke:'#eef1e9'});node('text',{x:42,y:y+4,'text-anchor':'end',fill:'#a2a899','font-size':10},count(Math.round(max*(1-i/4))));}
 const x=day=>days.length===1?465:60+days.indexOf(day)/(days.length-1)*810,y=value=>187-value/max*172;
 const colors={x:'#202528',pixiv:'#0096fa',instagram:'#a452c5'};
 for(const s of series){
  // Show measured points without bridging days where no measurement exists.
  for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i];if(Date.parse(b.day)-Date.parse(a.day)<=86400000)node('line',{x1:x(a.day),y1:y(a.followers),x2:x(b.day),y2:y(b.followers),stroke:colors[s.platform],'stroke-width':2});}
  for(const p of s.points){const dot=node('circle',{cx:x(p.day),cy:y(p.followers),r:3.5,fill:colors[s.platform]});const title=document.createElementNS(ns,'title');title.textContent=LABELS[s.platform]+' '+p.day+' '+count(p.followers);dot.append(title);}
 }
 for(const day of [days[0],...(days.length>1?[days.at(-1)]:[])])node('text',{x:x(day),y:213,'text-anchor':'middle',fill:'#a2a899','font-size':10},day.slice(5).replace('-','/'));
 box.append(svg);
}
function render(data){
 const channels=KEYS.map(key=>data.channels.find(c=>c.platform===key)).filter(Boolean);
 $('last-check').textContent=data.generatedAt?'最終収集実行 '+date(data.generatedAt):'初回取得待ち';
 $('channel-grid').replaceChildren(...channels.map(card));renderChart(data.history);
 const missing=channels.filter(c=>c.status!=='ok');$('notice').hidden=!missing.length;
 $('notice').textContent=missing.length?'自動取得の接続待ち／確認が必要なサービス：'+missing.map(c=>LABELS[c.platform]).join('・')+'。認証情報がない数値や、取得できなかった数値は表示していません。':'';
 if(channels.some(c=>c.fetchedAt&&stale(c))) {$('notice').hidden=false;$('notice').textContent+=' 36時間以上前のデータがあります。各チャンネルの取得日時を確認してください。';}
}
async function refresh(){const b=$('refresh');b.disabled=true;try{const r=await fetch('./data/metrics.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!validData(data))throw Error('Invalid data');render(data);}catch{ $('notice').hidden=false;$('notice').textContent='公開データを読み込めませんでした。接続を確認して「表示を更新」を押してください。';$('last-check').textContent='データ読み込みエラー';}finally{b.disabled=false;}}
$('refresh').onclick=refresh;$('show-definitions').onclick=()=>{$('definitions').open=true;$('definitions').scrollIntoView({behavior:'smooth',block:'nearest'});};refresh();
