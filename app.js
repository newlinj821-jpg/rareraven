import {PARKS,COASTERS,formatLocation} from './data.js';
import {loadVault,saveVault,exportVault,importVaultText} from './storage.js';
import {manufacturerFor,coasterVisual,parkVisual,shortType} from './meta.js';
import {getPublicConfig,getPublicLeaderboard,setPublicMode,getOwnerPublicMode,publishProfile,clearPublicSession,getCloudVault,saveCloudVault} from './public-api.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const yearNow=()=>new Date().getFullYear();

let vault=null;
let activePassword='';
let activeSession=null;
let activeParkId=null;
let parkFilter='all';
let toastTimer=null;
let publicConfig={publicMode:false,signups:false,emailEnabled:false,leaderboardEnabled:false};
let publicSyncTimer=null;
let generatedAdUrl='';
let cloudSyncTimer=null;

const allParks=()=>[...PARKS,...vault.customParks];
const allCoasters=()=>[...COASTERS,...vault.customCoasters];
const parkMap=()=>new Map(allParks().map(p=>[p.id,p]));
const coasterMap=()=>new Map(allCoasters().map(c=>[c.id,c]));
const ridesFor=id=>vault.rides.filter(r=>r.coasterId===id);
const countFor=id=>ridesFor(id).length;
const creditedIds=()=>new Set(vault.rides.map(r=>r.coasterId));
const ratingFor=id=>vault.ratings?.[id]||{};
const activeTrip=()=>vault.trips.find(t=>t.id===vault.activeTripId&&!t.endedAt)||null;

function showToast(message,undoFn){
  clearTimeout(toastTimer);
  const el=$('#toast');
  el.innerHTML=`<span>${esc(message)}</span>${undoFn?'<button class="toast-undo" type="button">UNDO</button>':''}`;
  el.classList.add('show');
  const undo=el.querySelector('.toast-undo');
  if(undo) undo.onclick=async()=>{undo.disabled=true;await undoFn()};
  toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}

function animateNumber(el,to){
  if(!el) return;
  const from=Number(el.dataset.value||0),target=Number(to||0);
  el.dataset.value=String(target);
  if(from===target){el.textContent=target;return}
  const start=performance.now(),duration=Math.min(900,350+Math.abs(target-from)*20);
  const tick=now=>{
    const p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(target-from)*eased);
    if(p<1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function persist({sync=true}={}){
  await saveVault(activePassword,vault);
  renderAll();
  if(activeSession?.mode==='public'&&activeSession.publicToken) queueCloudSync();
  if(sync&&vault.profile?.publishPublic) queuePublicSync();
}

function queueCloudSync(){
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>saveCloudVault(activeSession,vault).catch(err=>console.warn('Cloud vault sync failed',err)),900);
}

function mergeVaults(local,remote){
  if(!remote) return local;
  const localNewer=String(local.updatedAt||'')>=String(remote.updatedAt||'');
  const newer=localNewer?local:remote,older=localNewer?remote:local;
  const byId=(items=[])=>new Map(items.filter(x=>x?.id).map(x=>[x.id,x]));
  const rides=byId(older.rides);for(const item of newer.rides||[])rides.set(item.id,item);
  const parks=byId(older.customParks);for(const item of newer.customParks||[])parks.set(item.id,item);
  const coasters=byId(older.customCoasters);for(const item of newer.customCoasters||[])coasters.set(item.id,item);
  const trips=byId(older.trips);for(const item of newer.trips||[])trips.set(item.id,item);
  return {
    ...older,...newer,version:5,
    rides:[...rides.values()].sort((a,b)=>String(b.loggedAt||b.date).localeCompare(String(a.loggedAt||a.date))),
    customParks:[...parks.values()],customCoasters:[...coasters.values()],trips:[...trips.values()],
    ratings:{...(older.ratings||{}),...(newer.ratings||{})},
    profile:{...(older.profile||{}),...(newer.profile||{})},preferences:{...(older.preferences||{}),...(newer.preferences||{})},
    createdAt:[local.createdAt,remote.createdAt].filter(Boolean).sort()[0]||new Date().toISOString()
  };
}


function queuePublicSync(){
  clearTimeout(publicSyncTimer);
  publicSyncTimer=setTimeout(()=>syncPublicProfile(true),1000);
}

async function logRide(coasterId,date=today()){
  const c=coasterMap().get(coasterId);
  if(!c) return;
  const first=countFor(coasterId)===0,trip=activeTrip();
  const ride={id:crypto.randomUUID(),coasterId,date,loggedAt:new Date().toISOString(),tripId:trip?.id||null};
  vault.rides.unshift(ride);
  await persist();
  showToast(first?`NEW CREDIT · ${c.name}`:`+1 RIDE · ${c.name} · ${countFor(coasterId)} total`,async()=>{
    vault.rides=vault.rides.filter(r=>r.id!==ride.id);
    await persist();
    showToast('Ride removed');
  });
}

function setRating(id,patch){vault.ratings[id]={...ratingFor(id),...patch}}
function toggleFavorite(id){setRating(id,{favorite:!ratingFor(id).favorite});persist()}

function coasterArt(c,size='card'){
  const visual=coasterVisual(c.id,size==='hero'?1400:500);
  if(visual) return `<div class="coaster-image ${size}"><img src="${esc(visual.url)}" alt="${esc(c.name)}" loading="lazy"><span class="photo-credit">${esc(visual.credit)}</span></div>`;
  return `<div class="coaster-image generated ${size}" aria-hidden="true"><div class="mini-track"><i></i><i></i><i></i></div><span>${esc(shortType(c)).toUpperCase()}</span></div>`;
}

function coasterCard(c){
  const p=parkMap().get(c.parkId),n=countFor(c.id),r=ratingFor(c.id),manufacturer=manufacturerFor(c);
  return `<article class="coaster-card">
    <button class="coaster-card-main" data-info="${esc(c.id)}" type="button">
      ${coasterArt(c)}
      <div class="coaster-card-copy"><div class="coaster-name">${esc(c.name)}</div><div class="meta">${esc(p?.name||'Unknown park')} · ${esc(p?.state||'')}</div>
      <div class="tags"><span class="tag">${esc(c.material)}</span><span class="tag alt">${esc(c.classification)}</span>${manufacturer!=='Unknown'?`<span class="tag maker">${esc(manufacturer)}</span>`:''}</div>
      <div class="card-metrics"><span>${n?`${n} ride${n===1?'':'s'}`:'NEW CREDIT'}</span>${r.score?`<span>★ ${r.score}/10</span>`:''}${r.rank?`<span>#${r.rank} personal</span>`:''}</div></div>
    </button>
    <div class="coaster-card-actions"><button class="favorite ${r.favorite?'on':''}" data-favorite="${esc(c.id)}" type="button" aria-label="Favorite ${esc(c.name)}">♥</button><button class="plus" data-log="${esc(c.id)}" type="button" aria-label="Log one ride on ${esc(c.name)}">+1</button></div>
  </article>`;
}

function bindCoasterCards(root=document){
  root.querySelectorAll('[data-log]').forEach(b=>b.onclick=e=>{e.stopPropagation();logRide(b.dataset.log)});
  root.querySelectorAll('[data-info]').forEach(b=>b.onclick=e=>{e.stopPropagation();openCoaster(b.dataset.info)});
  root.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.favorite)});
}

function basicStats(){
  const ids=creditedIds(),cm=coasterMap(),parkIds=new Set([...ids].map(id=>cm.get(id)?.parkId).filter(Boolean));
  const ranked=[...ids].map(id=>({id,count:countFor(id)})).sort((a,b)=>b.count-a.count);
  return {credits:ids.size,rides:vault.rides.length,parks:parkIds.size,top:ranked[0]?cm.get(ranked[0].id)?.name||'—':'—',topCount:ranked[0]?.count||0};
}

function parkCompletion(){
  const ids=creditedIds();
  return allParks().map(p=>{
    const list=allCoasters().filter(c=>c.parkId===p.id),done=list.filter(c=>ids.has(c.id)).length;
    return {...p,total:list.length,done,pct:list.length?Math.round(done/list.length*100):0,complete:list.length>0&&done===list.length};
  });
}

function firstRideMap(){
  const map=new Map();
  for(const ride of [...vault.rides].sort((a,b)=>String(a.loggedAt||a.date).localeCompare(String(b.loggedAt||b.date)))) if(!map.has(ride.coasterId)) map.set(ride.coasterId,ride);
  return map;
}

function yearStats(year=yearNow()){
  const prefix=String(year),cm=coasterMap(),rides=vault.rides.filter(r=>String(r.date||'').startsWith(prefix)),firsts=firstRideMap();
  const newCredits=[...firsts.values()].filter(r=>String(r.date||'').startsWith(prefix)),parks=new Set(rides.map(r=>cm.get(r.coasterId)?.parkId).filter(Boolean));
  const counts=new Map(),days=new Map(),months=new Map();
  for(const ride of rides){counts.set(ride.coasterId,(counts.get(ride.coasterId)||0)+1);days.set(ride.date,(days.get(ride.date)||0)+1);const month=String(ride.date||'').slice(0,7);months.set(month,(months.get(month)||0)+1)}
  const top=[...counts].sort((a,b)=>b[1]-a[1])[0],busiest=[...days].sort((a,b)=>b[1]-a[1])[0],month=[...months].sort((a,b)=>b[1]-a[1])[0];
  return {year,rides:rides.length,newCredits:newCredits.length,parks:parks.size,top:top?cm.get(top[0])?.name||'—':'—',topCount:top?.[1]||0,busiestDay:busiest?.[0]||'—',busiestCount:busiest?.[1]||0,busiestMonth:month?.[0]||'—',monthCount:month?.[1]||0};
}

function badges(){
  const s=basicStats(),ids=creditedIds(),cm=coasterMap(),completions=parkCompletion(),dayCounts=new Map();
  for(const r of vault.rides) dayCounts.set(r.date,(dayCounts.get(r.date)||0)+1);
  const hasClass=term=>[...ids].some(id=>String(cm.get(id)?.classification||'').toLowerCase().includes(term)),maxDay=Math.max(0,...dayCounts.values()),rated=Object.values(vault.ratings).filter(r=>r.score);
  return [
    ['FIRST DROP','Earn your first coaster credit',s.credits>=1,'01'],['DOUBLE DIGITS','Reach 10 unique credits',s.credits>=10,'10'],['CREDIT HUNTER','Reach 25 unique credits',s.credits>=25,'25'],['HALF CENTURY','Reach 50 unique credits',s.credits>=50,'50'],['CENTURY CLUB','Reach 100 unique credits',s.credits>=100,'100'],['PARK HOPPER','Ride coasters at 5 parks',s.parks>=5,'5P'],['CLEAN SWEEP','Complete every credit at a park',completions.some(p=>p.complete),'✓'],['300 CLUB','Ride a giga coaster',hasClass('giga'),'300'],['HYPER FIX','Ride a hyper coaster',hasClass('hyper'),'200'],['RMC INITIATE','Ride an RMC',hasClass('rmc'),'RMC'],['LAUNCH ADDICT','Ride a launch coaster',hasClass('launch'),'↗'],['WOODIE','Ride a wooden coaster',[...ids].some(id=>cm.get(id)?.material==='Wood'),'WOOD'],['PARK MARATHON','Log 10 rides in one day',maxDay>=10,'10X'],['ONE MORE TIME','Ride one coaster 10 times',s.topCount>=10,'+10'],['COASTER CRITIC','Rate 10 coasters',rated.length>=10,'★']
  ].map(([name,desc,unlocked,mark])=>({name,desc,unlocked,mark}));
}

function renderBadge(b){return `<div class="badge ${b.unlocked?'unlocked':'locked'}"><div class="badge-mark">${esc(b.mark)}</div><div><strong>${esc(b.name)}</strong><span>${esc(b.desc)}</span></div></div>`}

function renderQuick(){
  const q=$('#quickSearch').value.trim().toLowerCase();let list=allCoasters();
  if(q) list=list.filter(c=>{const p=parkMap().get(c.parkId),m=manufacturerFor(c);return `${c.name} ${p?.name} ${p?.city} ${p?.state} ${c.material} ${c.classification} ${m}`.toLowerCase().includes(q)});
  else list=[...list].sort((a,b)=>(ratingFor(b.id).favorite?1:0)-(ratingFor(a.id).favorite?1:0)||countFor(b.id)-countFor(a.id)||a.name.localeCompare(b.name));
  list=list.slice(0,8);$('#quickResults').innerHTML=list.length?list.map(coasterCard).join(''):'<div class="empty">No coaster found. Add it as a custom coaster.</div>';bindCoasterCards($('#quickResults'));
}

function renderDashboard(){
  const s=basicStats();animateNumber($('#heroCredits'),s.credits);$('#statCredits').textContent=s.credits;$('#statRides').textContent=s.rides;$('#statParks').textContent=s.parks;$('#statTop').textContent=s.top==='—'?'—':s.top.length>20?s.top.slice(0,19)+'…':s.top;
  renderQuick();renderActiveTripBanner();
  const parks=parkCompletion().filter(p=>p.done>0&&p.total>0).sort((a,b)=>b.pct-a.pct||b.done-a.done).slice(0,5);
  $('#dashboardParks').innerHTML=parks.length?parks.map(p=>`<button class="mini-park" data-park="${esc(p.id)}"><div><strong>${esc(p.name)}</strong><span>${p.done}/${p.total} credits</span></div><div class="mini-progress"><i style="width:${p.pct}%"></i></div><b>${p.pct}%</b></button>`).join(''):'<div class="empty">Ride your first park credit to start completion tracking.</div>';
  $('#dashboardParks').querySelectorAll('[data-park]').forEach(b=>b.onclick=()=>openPark(b.dataset.park));
  const y=yearStats();$('#yearKicker').textContent=`${y.year} IN COASTERS`;$('#yearTitle').textContent=`${y.year} snapshot`;$('#yearSummary').innerHTML=[['RIDES',y.rides],['NEW CREDITS',y.newCredits],['PARKS',y.parks],['TOP COASTER',y.top]].map(([l,v])=>`<div><strong>${esc(v)}</strong><span>${l}</span></div>`).join('');
  $('#badgePreview').innerHTML=badges().filter(b=>b.unlocked).slice(-6).map(renderBadge).join('')||'<div class="empty">Your first badge unlocks with your first credit.</div>';
  const cm=coasterMap(),pm=parkMap();$('#recentRides').innerHTML=vault.rides.slice(0,8).map(r=>{const c=cm.get(r.coasterId),p=pm.get(c?.parkId);return `<button class="timeline-item ride-link" data-info="${esc(r.coasterId)}"><div><strong>${esc(c?.name||'Unknown coaster')}</strong><br><span>${esc(p?.name||'')}</span></div><span>${esc(r.date||'')}</span></button>`}).join('')||'<div class="empty">Your ride history starts with one tap.</div>';$('#recentRides').querySelectorAll('[data-info]').forEach(b=>b.onclick=()=>openCoaster(b.dataset.info));
}

function renderParks(){
  const q=$('#parkSearch').value.trim().toLowerCase();let parks=parkCompletion().filter(p=>`${p.name} ${formatLocation(p)}`.toLowerCase().includes(q));parks.sort((a,b)=>(b.done>0)-(a.done>0)||b.pct-a.pct||a.name.localeCompare(b.name));
  $('#parkGrid').innerHTML=parks.map(p=>{const coasters=allCoasters().filter(c=>c.parkId===p.id),visual=parkVisual(p.id,coasters,900);return `<button class="park-card" data-park="${esc(p.id)}"><div class="park-card-visual">${visual?`<img src="${esc(visual.url)}" alt="" loading="lazy">`:'<div class="park-track-art"><i></i><i></i></div>'}<div class="park-card-overlay"></div><div class="park-ring" style="--pct:${p.pct}"><span>${p.pct}%</span></div></div><div class="park-card-body"><div class="kicker">${p.done} OF ${p.total} RIDDEN</div><h3>${esc(p.name)}</h3><div class="location">${esc(formatLocation(p))}</div><div class="progress"><i style="width:${p.pct}%"></i></div><div class="tap-hint">TAP TO OPEN PARK →</div></div></button>`}).join('')||'<div class="empty">No park found.</div>';
  $('#parkGrid').querySelectorAll('[data-park]').forEach(b=>b.onclick=()=>openPark(b.dataset.park));
}

function openPark(id){activeParkId=id;parkFilter='all';$$('#parkFilters [data-park-filter]').forEach(b=>b.classList.toggle('active',b.dataset.parkFilter==='all'));renderParkDetail();switchView('parkDetail')}
function renderParkDetail(){const p=parkMap().get(activeParkId);if(!p)return;const list=allCoasters().filter(c=>c.parkId===p.id).sort((a,b)=>a.name.localeCompare(b.name)),done=list.filter(c=>countFor(c.id)>0).length,pct=list.length?Math.round(done/list.length*100):0,visual=parkVisual(p.id,list,1400);$('#parkHeader').innerHTML=`<section class="park-hero"><div class="park-hero-photo">${visual?`<img src="${esc(visual.url)}" alt="" loading="eager">`:'<div class="park-track-art large"><i></i><i></i></div>'}<div class="park-hero-shade"></div></div><div class="park-hero-content"><div><div class="kicker">${list.length} ROLLER COASTERS</div><h2>${esc(p.name)}</h2><p>${esc(formatLocation(p))}</p><button class="primary small" id="tripThisPark">START TRIP HERE</button></div><div class="completion-dial" style="--pct:${pct}"><strong>${pct}%</strong><span>${done}/${list.length} credits</span></div></div></section>`;$('#tripThisPark').onclick=()=>startTripForPark(p.id);renderParkCoasters()}
function renderParkCoasters(){if(!activeParkId)return;let list=allCoasters().filter(c=>c.parkId===activeParkId).sort((a,b)=>a.name.localeCompare(b.name));if(parkFilter==='ridden')list=list.filter(c=>countFor(c.id)>0);if(parkFilter==='unridden')list=list.filter(c=>countFor(c.id)===0);$('#parkCoasters').innerHTML=list.length?list.map(coasterCard).join(''):'<div class="empty">No coasters in this filter.</div>';bindCoasterCards($('#parkCoasters'))}

function renderCredits(){const q=$('#creditSearch').value.trim().toLowerCase(),ids=creditedIds();let list=allCoasters().filter(c=>ids.has(c.id));if(q)list=list.filter(c=>{const p=parkMap().get(c.parkId);return `${c.name} ${p?.name} ${c.classification} ${manufacturerFor(c)}`.toLowerCase().includes(q)});const sort=$('#creditSort').value;list.sort((a,b)=>{const ra=ratingFor(a.id),rb=ratingFor(b.id);if(sort==='rank')return(ra.rank||99999)-(rb.rank||99999)||(rb.score||0)-(ra.score||0)||a.name.localeCompare(b.name);if(sort==='rating')return(rb.score||0)-(ra.score||0)||countFor(b.id)-countFor(a.id);if(sort==='rides')return countFor(b.id)-countFor(a.id)||a.name.localeCompare(b.name);return a.name.localeCompare(b.name)});$('#creditList').innerHTML=list.length?list.map(coasterCard).join(''):'<div class="empty">No credits yet.</div>';bindCoasterCards($('#creditList'))}

function renderTimeline(){const cm=coasterMap(),pm=parkMap(),groups=new Map();for(const ride of [...vault.rides].sort((a,b)=>String(b.loggedAt||b.date).localeCompare(String(a.loggedAt||a.date)))){if(!groups.has(ride.date))groups.set(ride.date,[]);groups.get(ride.date).push(ride)}$('#timelineFull').innerHTML=[...groups].map(([date,rides])=>`<section class="timeline-day"><div class="timeline-date"><strong>${esc(date)}</strong><span>${rides.length} ride${rides.length===1?'':'s'}</span></div><div>${rides.map(r=>{const c=cm.get(r.coasterId),p=pm.get(c?.parkId),trip=vault.trips.find(t=>t.id===r.tripId);return `<button class="timeline-ride" data-info="${esc(r.coasterId)}"><span class="timeline-dot"></span><div><strong>${esc(c?.name||'Unknown coaster')}</strong><span>${esc(p?.name||'')}${trip?` · ${esc(trip.name)}`:''}</span></div><time>${esc(new Date(r.loggedAt||r.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))}</time></button>`}).join('')}</div></section>`).join('')||'<div class="empty">No rides logged yet.</div>';$('#timelineFull').querySelectorAll('[data-info]').forEach(b=>b.onclick=()=>openCoaster(b.dataset.info))}

function barRows(items){const max=Math.max(1,...items.map(x=>x.count));return items.slice(0,12).map(x=>`<div class="bar-row"><div><strong>${esc(x.name)}</strong><span>${x.count}</span></div><div class="bar-track"><i style="width:${Math.round(x.count/max*100)}%"></i></div></div>`).join('')||'<div class="empty">Not enough data yet.</div>'}
function renderStats(){const ids=creditedIds(),cm=coasterMap(),makers=new Map(),types=new Map();for(const id of ids){const c=cm.get(id);if(!c)continue;const maker=manufacturerFor(c);makers.set(maker,(makers.get(maker)||0)+1);const type=shortType(c);types.set(type,(types.get(type)||0)+1)}$('#manufacturerStats').innerHTML=barRows([...makers].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count));$('#typeStats').innerHTML=barRows([...types].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count));const s=basicStats(),ratings=Object.values(vault.ratings).filter(r=>r.score),avg=ratings.length?(ratings.reduce((sum,r)=>sum+Number(r.score),0)/ratings.length).toFixed(1):'—',completions=parkCompletion().filter(p=>p.complete).length;$('#recordStats').innerHTML=[['Most rides on one coaster',s.topCount],['Completed parks',completions],['Rated coasters',ratings.length],['Average rating',avg],['Favorites',Object.values(vault.ratings).filter(r=>r.favorite).length]].map(([n,v])=>`<div class="record-row"><span>${esc(n)}</span><strong>${esc(v)}</strong></div>`).join('');const y=yearStats();$('#yearStatsFull').innerHTML=[['TOTAL RIDES',y.rides],['NEW CREDITS',y.newCredits],['PARKS',y.parks],['MOST RIDDEN',y.top],['BUSIEST DAY',y.busiestDay],['BUSIEST MONTH',y.busiestMonth]].map(([l,v])=>`<article class="feature-stat"><span>${l}</span><strong>${esc(v)}</strong></article>`).join('');$('#badgeGrid').innerHTML=badges().map(renderBadge).join('')}

function rankRows(items,subFn,valueFn=x=>x.count){return items.slice(0,20).map((x,i)=>`<div class="rank-row"><div class="rank">${i+1}</div><div><strong>${esc(x.name)}</strong><small>${esc(subFn?.(x)||'')}</small></div><div class="rank-value">${esc(valueFn(x))}</div></div>`).join('')||'<div class="empty">No rides yet.</div>'}
function renderLeaderboard(){const cm=coasterMap(),pm=parkMap(),coasterRanks=[...creditedIds()].map(id=>{const c=cm.get(id);return c?{...c,count:countFor(id)}:null}).filter(Boolean).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));$('#rideLeaderboard').innerHTML=rankRows(coasterRanks,x=>pm.get(x.parkId)?.name||'');const parkCounts=new Map();for(const r of vault.rides){const c=cm.get(r.coasterId);if(c)parkCounts.set(c.parkId,(parkCounts.get(c.parkId)||0)+1)}$('#parkLeaderboard').innerHTML=rankRows([...parkCounts].map(([id,count])=>({name:pm.get(id)?.name||id,count})).sort((a,b)=>b.count-a.count));const rated=[...creditedIds()].map(id=>{const c=cm.get(id),r=ratingFor(id);return c&&r.score?{...c,score:r.score,rank:r.rank}:null}).filter(Boolean).sort((a,b)=>b.score-a.score||(a.rank||999)-(b.rank||999));$('#ratingLeaderboard').innerHTML=rankRows(rated,x=>pm.get(x.parkId)?.name||'',x=>`★ ${x.score}`)}

async function renderPublicLeaderboard(){const status=$('#publicLeaderboardStatus'),root=$('#publicLeaderboard');status.textContent='Loading public leaderboard…';try{publicConfig=await getPublicConfig();if(!publicConfig.publicMode){status.textContent='Public mode is off. Turn it on in Settings whenever you are ready.';root.innerHTML='';return}const data=await getPublicLeaderboard();status.textContent=data.rows.length?`${data.rows.length} public rider${data.rows.length===1?'':'s'} ranked by unique credits.`:'Public mode is on. No profiles have published stats yet.';root.innerHTML=data.rows.map(row=>`<div class="public-rank"><b>#${row.rank}</b><div><strong>${esc(row.displayName)}</strong><span>${row.parks} parks · ${row.rides} rides · ${row.badgeCount} badges</span></div><div class="public-credit"><strong>${row.credits}</strong><span>CREDITS</span></div></div>`).join('')}catch(error){status.textContent=error.message;root.innerHTML=''}}
function publicSnapshot(){const s=basicStats();return{displayName:vault.profile.displayName||activeSession?.username||'Coaster rider',credits:s.credits,rides:s.rides,parks:s.parks,topCoaster:s.top,badgeCount:badges().filter(b=>b.unlocked).length,published:vault.profile.publishPublic!==false}}
async function syncPublicProfile(silent=false){try{publicConfig=await getPublicConfig();if(!publicConfig.publicMode){if(!silent)showToast('Public mode is currently off');return}if(activeSession?.mode==='guest'){if(!silent)showToast('Email sign in or use the owner account to publish');return}const result=await publishProfile(activeSession,publicSnapshot());if(!silent)showToast(`Published ${result.profile.credits} credits to the public board`);renderPublicLeaderboard()}catch(error){if(!silent)showToast(error.message)}}

function renderActiveTripBanner(){const trip=activeTrip(),el=$('#activeTripBanner');if(!trip){el.hidden=true;return}const p=parkMap().get(trip.parkId),rides=vault.rides.filter(r=>r.tripId===trip.id).length;el.hidden=false;el.innerHTML=`<div><div class="kicker">TRIP MODE ACTIVE</div><strong>${esc(trip.name)}</strong><span>${esc(p?.name||'')} · ${rides} rides today</span></div><button class="secondary" id="openTripBanner">OPEN TRIP</button>`;$('#openTripBanner').onclick=()=>switchView('tripMode')}
function renderTrips(){const parks=[...allParks()].sort((a,b)=>a.name.localeCompare(b.name));$('#tripPark').innerHTML=parks.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');if(!$('#tripDate').value)$('#tripDate').value=today();const trip=activeTrip();$('#activeTripPanel').innerHTML=trip?(()=>{const p=parkMap().get(trip.parkId),rides=vault.rides.filter(r=>r.tripId===trip.id);return `<section class="trip-live"><div><div class="kicker">LIVE PARK DAY</div><h3>${esc(trip.name)}</h3><p>${esc(p?.name||'')} · ${esc(trip.date)}</p></div><div class="trip-live-count"><strong>${rides.length}</strong><span>RIDES</span></div><button id="endTripBtn" class="secondary danger">END TRIP</button></section>`})():'';$('#endTripBtn')?.addEventListener('click',endTrip);$('#tripHistory').innerHTML=[...vault.trips].sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))).map(t=>{const p=parkMap().get(t.parkId),count=vault.rides.filter(r=>r.tripId===t.id).length;return `<div class="trip-history-row"><div><strong>${esc(t.name)}</strong><span>${esc(p?.name||'')} · ${esc(t.date)}</span></div><b>${count} rides</b></div>`}).join('')||'<div class="empty">No trips yet.</div>'}
async function startTripForPark(parkId){const p=parkMap().get(parkId);if(!p)return;if(activeTrip())return showToast('End your current trip first');const trip={id:crypto.randomUUID(),name:`${p.name} · ${today()}`,parkId,date:today(),startedAt:new Date().toISOString(),endedAt:null};vault.trips.push(trip);vault.activeTripId=trip.id;await persist();switchView('tripMode');showToast(`Trip mode started · ${p.name}`)}
async function startTrip(){if(activeTrip())return showToast('End your current trip first');const parkId=$('#tripPark').value,p=parkMap().get(parkId),trip={id:crypto.randomUUID(),name:$('#tripName').value.trim()||`${p?.name||'Park day'} · ${$('#tripDate').value||today()}`,parkId,date:$('#tripDate').value||today(),startedAt:new Date().toISOString(),endedAt:null};vault.trips.push(trip);vault.activeTripId=trip.id;$('#tripName').value='';await persist();showToast('Trip mode started')}
async function endTrip(){const trip=activeTrip();if(!trip)return;trip.endedAt=new Date().toISOString();vault.activeTripId=null;await persist();showToast('Trip ended')}

function renderSettings(){$('#profileName').value=vault.profile.displayName||'';$('#profilePublish').checked=Boolean(vault.profile.publishPublic);fillAdFeatured();const panel=$('#publicSettingsPanel');if(activeSession?.mode!=='private'){panel.innerHTML='<h3>Public mode</h3><p class="muted">Only the private owner account can change site-wide public mode. Your local tracker still works normally.</p>';return}getOwnerPublicMode(activeSession).then(async settings=>{publicConfig=await getPublicConfig().catch(()=>publicConfig);$('#publicModeToggle').checked=Boolean(settings.publicMode);$('#publicSignupToggle').checked=Boolean(settings.signups);$('#publicSignupToggle').disabled=!settings.publicMode;$('#publicSettingsStatus').innerHTML=`Backend: <strong>Netlify Blobs</strong> · Supabase: <strong>not required</strong><br>Email: <strong>${publicConfig.emailEnabled?'Resend ready':'add RESEND_API_KEY + CV_EMAIL_FROM + CV_AUTH_SECRET'}</strong>`}).catch(error=>$('#publicSettingsStatus').textContent=error.message)}

function fillAdFeatured(){const select=$('#adFeatured');if(!select)return;const ids=creditedIds(),list=allCoasters().filter(c=>ids.has(c.id)).sort((a,b)=>a.name.localeCompare(b.name));select.innerHTML='<option value="">No featured coaster</option>'+list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){const words=String(text).split(/\s+/);let line='',lines=0;for(let n=0;n<words.length;n++){const test=line?line+' '+words[n]:words[n];if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);y+=lineHeight;lines++;line=words[n];if(lines>=maxLines-1)break}else line=test}if(line&&lines<maxLines)ctx.fillText(line,x,y);return y}
function generateAd(){const canvas=$('#adCanvas'),ctx=canvas.getContext('2d'),theme=$('#adTheme').value,headline=$('#adHeadline').value.trim()||'Track every coaster. Chase every credit.',cta=$('#adCta').value.trim()||'Join CoasterVerse',featured=coasterMap().get($('#adFeatured').value),s=basicStats();const palettes={acid:['#070b0d','#b8ff4a','#f5f8fb','#163125'],night:['#040714','#67b7ff','#f6f8ff','#171b3f'],steel:['#071017','#9dd7ff','#f5fbff','#18313d']},p=palettes[theme]||palettes.acid;ctx.clearRect(0,0,1080,1350);const g=ctx.createLinearGradient(0,0,1080,1350);g.addColorStop(0,p[0]);g.addColorStop(1,p[3]);ctx.fillStyle=g;ctx.fillRect(0,0,1080,1350);ctx.strokeStyle=p[1];ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(-40,1020);ctx.bezierCurveTo(180,980,185,560,415,560);ctx.bezierCurveTo(650,560,650,1070,860,890);ctx.bezierCurveTo(970,795,1000,700,1140,760);ctx.stroke();ctx.globalAlpha=.17;ctx.lineWidth=60;ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=p[1];ctx.font='900 42px system-ui';ctx.fillText('COASTER//VERSE',70,105);ctx.font='800 22px system-ui';ctx.fillText('ROLLER COASTER CREDIT TRACKER',72,145);ctx.fillStyle=p[2];ctx.font='900 84px system-ui';wrapText(ctx,headline,70,305,930,92,3);ctx.fillStyle=p[1];ctx.font='900 260px system-ui';ctx.fillText(String(s.credits),70,760);ctx.font='900 30px system-ui';ctx.fillText('TOTAL COASTER CREDITS',80,815);ctx.fillStyle=p[2];ctx.font='800 32px system-ui';ctx.fillText(`${s.rides} RIDES  ·  ${s.parks} PARKS`,80,875);if(featured){ctx.fillStyle=p[2];ctx.font='900 34px system-ui';ctx.fillText('FEATURED CREDIT',70,1100);ctx.fillStyle=p[1];ctx.font='900 46px system-ui';wrapText(ctx,featured.name,70,1160,900,54,2)}ctx.fillStyle=p[2];ctx.font='800 28px system-ui';wrapText(ctx,cta,70,1280,900,34,2);canvas.toBlob(blob=>{if(!blob)return;if(generatedAdUrl)URL.revokeObjectURL(generatedAdUrl);generatedAdUrl=URL.createObjectURL(blob);$('#downloadAdBtn').disabled=false},'image/png');showToast('Ad generated')}
function downloadAd(){if(!generatedAdUrl){generateAd();setTimeout(downloadAd,250);return}const a=document.createElement('a');a.href=generatedAdUrl;a.download=`coasterverse-ad-${today()}.png`;a.click()}
async function copyAdCaption(){try{await navigator.clipboard.writeText($('#adCaption').value);showToast('Caption copied')}catch{showToast('Could not copy caption')}}

async function saveProfile(){vault.profile.displayName=$('#profileName').value.trim().slice(0,40)||'Coaster rider';vault.profile.publishPublic=$('#profilePublish').checked;await persist({sync:false});if(vault.profile.publishPublic)await syncPublicProfile(true);showToast('Profile saved')}
async function savePublicSettings(){if(activeSession?.mode!=='private')return;try{const publicMode=$('#publicModeToggle').checked,signups=publicMode&&$('#publicSignupToggle').checked,result=await setPublicMode(activeSession,{publicMode,signups});publicConfig=await getPublicConfig();$('#publicSettingsStatus').innerHTML=`Public mode: <strong>${result.publicMode?'ON':'OFF'}</strong> · Email signups: <strong>${result.signups?'ON':'OFF'}</strong><br>Backend: <strong>Netlify Blobs</strong> · Supabase: <strong>not required</strong>`;$('#publicSignupToggle').disabled=!result.publicMode;showToast(result.publicMode?'CoasterVerse is public':'CoasterVerse returned to private mode')}catch(error){showToast(error.message)}}

function renderAll(){renderDashboard();renderParks();renderCredits();renderTimeline();renderStats();renderLeaderboard();renderTrips();renderSettings();if(activeParkId&&$('#parkDetail').classList.contains('active-view'))renderParkDetail()}
function switchView(id){$$('.view').forEach(v=>v.classList.toggle('active-view',v.id===id));$$('.nav-btn,.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===id));if(id==='leaderboard')renderPublicLeaderboard();if(id==='settings')renderSettings();window.scrollTo({top:0,behavior:'instant'})}

function openCoaster(id){const c=coasterMap().get(id),p=parkMap().get(c?.parkId);if(!c)return;const rides=[...ridesFor(id)].sort((a,b)=>String(b.loggedAt||'').localeCompare(String(a.loggedAt||''))),r=ratingFor(id),manufacturer=manufacturerFor(c);$('#modalBody').innerHTML=`<div class="modal-hero">${coasterArt(c,'hero')}<div class="modal-hero-copy"><div class="kicker">${countFor(id)?'CREDIT EARNED':'UNRIDDEN'}</div><h3>${esc(c.name)}</h3><p>${esc(p?.name||'')} · ${esc(formatLocation(p||{}))}</p></div></div><div class="detail-facts"><div><span>MANUFACTURER</span><strong>${esc(manufacturer)}</strong></div><div><span>TYPE</span><strong>${esc(c.classification)}</strong></div><div><span>MATERIAL</span><strong>${esc(c.material)}</strong></div><div><span>TOTAL RIDES</span><strong>${rides.length}</strong></div></div><div class="rating-block"><div class="section-head"><div><div class="kicker">YOUR RATING</div><h3>${r.score?`${r.score}/10`:'Not rated'}</h3></div><button id="modalFavorite" class="favorite big ${r.favorite?'on':''}">♥ FAVORITE</button></div><div class="rating-buttons">${Array.from({length:10},(_,i)=>i+1).map(n=>`<button data-rate="${n}" class="${r.score===n?'active':''}">${n}</button>`).join('')}</div></div><div class="form-grid detail-form"><label>Personal rank<input id="modalRank" type="number" min="1" inputmode="numeric" value="${r.rank||''}" placeholder="#1"></label><label>Notes<textarea id="modalNotes" rows="3" placeholder="Airtime, row preference, night ride notes…">${esc(r.notes||'')}</textarea></label></div><div class="modal-actions"><button class="primary" id="modalPlus">+1 RIDE</button><button class="secondary" id="saveCoasterMeta">SAVE RATING / RANK</button>${rides.length?'<button class="secondary danger" id="undoRide">UNDO LAST</button>':''}</div>${rides.length?`<div class="modal-history"><div class="kicker">RECENT LOGS</div>${rides.slice(0,10).map(ride=>`<div class="timeline-item"><strong>${esc(ride.date)}</strong><span>${esc(new Date(ride.loggedAt).toLocaleString())}</span></div>`).join('')}</div>`:''}`;$('#modal').hidden=false;$('#modalPlus').onclick=()=>logRide(id).then(()=>openCoaster(id));$('#modalFavorite').onclick=async()=>{setRating(id,{favorite:!ratingFor(id).favorite});await persist();openCoaster(id)};$('#modalBody').querySelectorAll('[data-rate]').forEach(b=>b.onclick=async()=>{setRating(id,{score:Number(b.dataset.rate)});await persist();openCoaster(id)});$('#saveCoasterMeta').onclick=async()=>{const rank=Math.max(0,Number($('#modalRank').value)||0);setRating(id,{rank:rank||null,notes:$('#modalNotes').value.trim()});await persist();openCoaster(id);showToast('Rating and rank saved')};const undo=$('#undoRide');if(undo)undo.onclick=async()=>{const target=rides[0];vault.rides=vault.rides.filter(x=>x.id!==target.id);await persist();openCoaster(id);showToast('Last ride removed')}}

function openQuickLog(){$('#modalBody').innerHTML='<div class="kicker">QUICK LOG</div><h3>What did you ride?</h3><div class="search-wrap"><input id="modalQuickSearch" class="search" placeholder="Search coaster or park…" autofocus></div><div id="modalQuickResults" class="coaster-list compact"></div>';$('#modal').hidden=false;const input=$('#modalQuickSearch'),render=()=>{const q=input.value.trim().toLowerCase();const list=allCoasters().filter(c=>{if(!q)return true;const p=parkMap().get(c.parkId);return `${c.name} ${p?.name} ${p?.state}`.toLowerCase().includes(q)}).sort((a,b)=>countFor(b.id)-countFor(a.id)||a.name.localeCompare(b.name)).slice(0,10);$('#modalQuickResults').innerHTML=list.map(coasterCard).join('');bindCoasterCards($('#modalQuickResults'))};input.oninput=render;render();setTimeout(()=>input.focus(),50)}

function openCustom(){const parks=allParks().sort((a,b)=>a.name.localeCompare(b.name));$('#modalBody').innerHTML=`<div class="kicker">DATABASE MISSING SOMETHING?</div><h3>Add a coaster</h3><div class="form-grid"><label>Coaster name<input id="newName" placeholder="Coaster name"></label><label>Park<select id="newPark"><option value="__new">+ Add new park</option>${parks.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><div id="newParkFields"><label>New park name<input id="newParkName" placeholder="Theme park"></label><label>Location<input id="newLocation" placeholder="City, State"></label></div><label>Material<select id="newMaterial"><option>Steel</option><option>Wood</option><option>Hybrid</option></select></label><label>Type / classification<input id="newClass" placeholder="Giga, Hyper, Launch, Inverted…"></label></div><div class="modal-actions"><button id="saveCustom" class="primary">SAVE + LOG FIRST RIDE</button></div>`;$('#modal').hidden=false;const sel=$('#newPark'),sync=()=>$('#newParkFields').style.display=sel.value==='__new'?'grid':'none';sel.onchange=sync;sync();$('#saveCustom').onclick=async()=>{const name=$('#newName').value.trim(),classification=$('#newClass').value.trim()||'Unclassified';if(!name)return showToast('Enter a coaster name');let parkId=sel.value;if(parkId==='__new'){const pn=$('#newParkName').value.trim();if(!pn)return showToast('Enter the park name');const loc=$('#newLocation').value.split(',').map(x=>x.trim());parkId='custom-park-'+crypto.randomUUID();vault.customParks.push({id:parkId,name:pn,city:loc[0]||'',state:loc[1]||'',country:loc[2]||'USA'})}const id='custom-coaster-'+crypto.randomUUID();vault.customCoasters.push({id,name,parkId,material:$('#newMaterial').value,classification});$('#modal').hidden=true;await logRide(id)}}

export async function boot(session){
  activeSession=session;
  activePassword=String(session?.password??'').trim();
  if(!activePassword) throw new Error('Authenticated session is missing its local vault key.');
  vault=await loadVault(activePassword);
  if(session?.mode==='public'&&session.publicToken){
    try{vault=mergeVaults(vault,await getCloudVault(session))}catch(error){console.warn('Cloud vault load failed',error)}
  }
  if(!vault.profile.displayName||vault.profile.displayName==='Eros') vault.profile.displayName=session?.displayName||session?.username||vault.profile.displayName||'Eros';
  await saveVault(activePassword,vault);
  if(session?.mode==='public'&&session.publicToken) queueCloudSync();
  $('#loginScreen').hidden=true;$('#app').hidden=false;
  publicConfig=await getPublicConfig().catch(()=>publicConfig);
  renderAll();generateAd();
}

$('#logout').onclick=()=>{if(activeSession?.mode==='public')clearPublicSession();location.reload()};
$$('.nav-btn,.mobile-tab,.nav-jump').forEach(b=>b.onclick=()=>b.dataset.view&&switchView(b.dataset.view));
$('#quickSearch').oninput=renderQuick;$('#clearSearch').onclick=()=>{$('#quickSearch').value='';renderQuick();$('#quickSearch').focus()};$('#parkSearch').oninput=renderParks;$('#creditSearch').oninput=renderCredits;$('#creditSort').onchange=renderCredits;$('#backParks').onclick=()=>switchView('parks');$('#addCustomBtn').onclick=openCustom;$('#mobileLog').onclick=openQuickLog;$('#modalClose').onclick=()=>$('#modal').hidden=true;$('#modal').onclick=e=>{if(e.target===$('#modal'))$('#modal').hidden=true};
$('#parkFilters').querySelectorAll('[data-park-filter]').forEach(b=>b.onclick=()=>{parkFilter=b.dataset.parkFilter;$('#parkFilters').querySelectorAll('[data-park-filter]').forEach(x=>x.classList.toggle('active',x===b));renderParkCoasters()});
$('#startTripBtn').onclick=startTrip;$('#refreshPublicLeaderboard').onclick=renderPublicLeaderboard;$('#publishStatsBtn').onclick=()=>syncPublicProfile(false);$('#saveProfileBtn').onclick=saveProfile;$('#savePublicModeBtn').onclick=savePublicSettings;$('#publicModeToggle').onchange=()=>{$('#publicSignupToggle').disabled=!$('#publicModeToggle').checked;if(!$('#publicModeToggle').checked)$('#publicSignupToggle').checked=false};
$('#generateAdBtn').onclick=generateAd;$('#downloadAdBtn').onclick=downloadAd;$('#copyAdCaptionBtn').onclick=copyAdCaption;
$('#exportBtn').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(exportVault(vault));a.href=url;a.download=`coasterverse-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{vault=importVaultText(await f.text());await persist({sync:false});showToast('Backup imported')}catch{showToast('Invalid backup file')}e.target.value=''};
