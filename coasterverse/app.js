import {COASTER_DB} from './coaster-data.js';
import {loadState,saveState,resetState,exportState,importState} from './storage.js';
import {getSession,login,logout} from './auth.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state=loadState(); let undoRideId=null; let toastTimer=null;
const builtins=COASTER_DB.flatMap(p=>p.coasters);
const allCoasters=()=>[...builtins,...state.customCoasters];
const rideCount=id=>state.rides.filter(r=>r.coasterId===id).length;
const coasterById=id=>allCoasters().find(c=>c.id===id);
const uniqueRiddenIds=()=>new Set(state.rides.map(r=>r.coasterId));

function groupParks(){const map=new Map();for(const c of allCoasters()){if(!map.has(c.park))map.set(c.park,{park:c.park,location:c.location,coasters:[]});map.get(c.park).coasters.push(c)}return [...map.values()].sort((a,b)=>a.park.localeCompare(b.park))}

function renderFilters(){const current=$('#parkFilter').value;$('#parkFilter').innerHTML='<option value="all">All parks</option>'+groupParks().map(p=>`<option value="${esc(p.park)}">${esc(p.park)}</option>`).join('');if([...$('#parkFilter').options].some(o=>o.value===current))$('#parkFilter').value=current}
function esc(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}

function renderTracker(){const q=$('#searchInput').value.trim().toLowerCase(), parkF=$('#parkFilter').value, statusF=$('#statusFilter').value;const groups=groupParks().filter(p=>parkF==='all'||p.park===parkF).map(p=>({...p,coasters:p.coasters.filter(c=>{const ridden=rideCount(c.id)>0;const matches=!q||`${c.name} ${c.park} ${c.location} ${c.type}`.toLowerCase().includes(q);const status=statusF==='all'||(statusF==='ridden'&&ridden)||(statusF==='unridden'&&!ridden);return matches&&status})})).filter(p=>p.coasters.length);
  $('#parkSections').innerHTML=groups.length?groups.map(p=>{const earned=p.coasters.filter(c=>rideCount(c.id)>0).length;return `<section class="park-block"><div class="park-head"><div><h3>${esc(p.park)}</h3><p>${esc(p.location)}</p></div><div class="park-progress"><strong>${earned}/${p.coasters.length}</strong><span>VISIBLE CREDITS</span></div></div><div class="coaster-grid">${p.coasters.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>{const count=rideCount(c.id);return `<button class="coaster-card ${count?'ridden':''}" data-ride="${c.id}" title="Tap to log a ride"><span class="ride-pill">${count||'+'}</span><div><div class="coaster-title">${esc(c.name)}</div><div class="coaster-meta"><span class="chip type">${esc(c.type)}</span></div></div><div class="tap-hint">${count?`${count} ride${count===1?'':'s'} · tap +1`:'Not ridden · tap for first credit'}</div></button>`}).join('')}</div></section>`}).join(''):'<div class="empty">No coasters match those filters.</div>';
  $$('[data-ride]').forEach(b=>b.addEventListener('click',()=>logRide(b.dataset.ride)));
}

function logRide(coasterId){const c=coasterById(coasterId);if(!c)return;const first=rideCount(coasterId)===0;const ride={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,coasterId,at:new Date().toISOString()};state.rides.push(ride);undoRideId=ride.id;persistAndRender();showToast(first?'NEW CREDIT + 1 RIDE':'+1 RIDE',`${c.name} · ${c.park}`)}
function deleteRide(id){state.rides=state.rides.filter(r=>r.id!==id);persistAndRender()}
function persistAndRender(){saveState(state);renderAll()}

function renderStats(){const ids=uniqueRiddenIds();$('#creditCount').textContent=ids.size;$('#rideCount').textContent=state.rides.length;const parks=new Set([...ids].map(id=>coasterById(id)?.park).filter(Boolean));$('#parkCount').textContent=parks.size;const types=new Set([...ids].map(id=>coasterById(id)?.type).filter(Boolean));$('#typeCount').textContent=types.size;const ranked=rankCoasters();$('#favoriteRideCount').textContent=ranked[0]?`${ranked[0].count}×`:'0×';$('#favoriteRideName').textContent=ranked[0]?.label||'—'}
function rankCoasters(){const m={};for(const r of state.rides)m[r.coasterId]=(m[r.coasterId]||0)+1;return Object.entries(m).map(([id,count])=>{const c=coasterById(id);return {label:c?.name||'Unknown coaster',sub:c?`${c.park} · ${c.type}`:'',count}}).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))}
function rankBy(field){const m={};for(const r of state.rides){const c=coasterById(r.coasterId);if(!c)continue;const k=c[field];m[k]=(m[k]||0)+1}return Object.entries(m).map(([label,count])=>({label,count,sub:field==='park'?'total rides at park':'total rides'})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))}
function renderRankList(el,rows){el.innerHTML=rows.length?rows.slice(0,20).map((r,i)=>`<div class="rank-row"><div class="rank-num">#${i+1}</div><div class="rank-label"><strong>${esc(r.label)}</strong><span>${esc(r.sub||'')}</span></div><div class="rank-count">${r.count}×</div></div>`).join(''):'<div class="empty">Log some rides first.</div>'}
function renderLeaderboards(){renderRankList($('#coasterLeaderboard'),rankCoasters());renderRankList($('#parkLeaderboard'),rankBy('park'));renderRankList($('#typeLeaderboard'),rankBy('type'))}
function renderHistory(){const rows=[...state.rides].sort((a,b)=>b.at.localeCompare(a.at));$('#historyList').innerHTML=rows.length?rows.map(r=>{const c=coasterById(r.coasterId);const d=new Date(r.at);return `<div class="history-row"><div><strong>${esc(c?.name||'Unknown coaster')}</strong><span>${esc(c?.park||'Unknown park')} · ${esc(c?.type||'')}</span></div><span class="history-date">${d.toLocaleDateString()}<br>${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span><button class="icon-btn" data-delete-ride="${r.id}" aria-label="Delete ride">×</button></div>`}).join(''):'<div class="empty">No rides logged yet.</div>';$$('[data-delete-ride]').forEach(b=>b.addEventListener('click',()=>deleteRide(b.dataset.deleteRide))}
function renderAll(){renderFilters();renderStats();renderTracker();renderLeaderboards();renderHistory()}
function showToast(title,text){$('#toastTitle').textContent=title;$('#toastText').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}

async function boot(){const ok=await getSession();if(ok){$('#loginScreen').classList.add('hidden');$('#app').classList.remove('hidden');renderAll()}else{$('#loginScreen').classList.remove('hidden');$('#app').classList.add('hidden')}}

$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{await login($('#username').value,$('#password').value);$('#password').value='';await boot()}catch(err){$('#loginError').textContent=err.message}});
$('#logoutBtn').addEventListener('click',async()=>{await logout();await boot()});
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.tab-panel').forEach(x=>x.classList.remove('active'));$(`#${b.dataset.tab}Tab`).classList.add('active')}));
['searchInput','parkFilter','statusFilter'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',renderTracker));
$('#undoBtn').addEventListener('click',()=>{if(undoRideId){deleteRide(undoRideId);undoRideId=null;$('#toast').classList.remove('show')}});
$('#addCoasterForm').addEventListener('submit',e=>{e.preventDefault();const c={id:`custom-${crypto.randomUUID?.()||Date.now()}`,name:$('#customName').value.trim(),park:$('#customPark').value.trim(),location:$('#customLocation').value.trim(),type:$('#customType').value.trim(),builtin:false};state.customCoasters.push(c);e.target.reset();persistAndRender();showToast('COASTER ADDED',`${c.name} · ${c.park}`)});
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([exportState(state)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`coasterverse-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
$('#importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{state=importState(await f.text());persistAndRender();showToast('BACKUP IMPORTED',`${state.rides.length} rides loaded`)}catch(err){alert(err.message)}finally{e.target.value=''}});
$('#clearHistoryBtn').addEventListener('click',()=>{if(confirm('Clear every logged ride? Custom coaster entries will remain.')){state.rides=[];persistAndRender()}});
$('#resetBtn').addEventListener('click',()=>{if(confirm('Reset ALL CoasterVerse data on this browser?')){resetState();state=loadState();renderAll()}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
boot();
