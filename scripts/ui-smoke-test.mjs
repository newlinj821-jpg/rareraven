import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('public/index.html');
const app=read('public/app.js');
const login=read('public/login.js');
const api=read('public/public-api.js');
const css=read('public/styles.css');
const data=read('public/data.js');

const assert=(condition,message)=>{if(!condition) throw new Error(message)};
for(const file of ['public/app.js','public/login.js','public/meta.js','public/public-api.js','public/storage.js']){
  execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
}

for(const id of ['creditShowcase','creditHeroPhoto','heroCredits','ownerHub','parkGrid','parkHeader','parkCoasters','timelineFull','manufacturerStats','badgeGrid','tripMode','mobileLog','publicLeaderboard','publicModeToggle','shareStudio','adCanvas','generateAdBtn']){
  assert(html.includes(`id="${id}"`),`Missing required UI target #${id}`);
}

for(const view of ['dashboard','parks','credits','timelineView','statsView','leaderboard','tripMode','settings']){
  assert(html.includes(`id="${view}"`),`Missing view #${view}`);
}

assert(css.includes('.mobile-nav'),'Mobile bottom navigation CSS missing');
assert(css.includes('@keyframes velocityPass'),'Replacement coaster velocity animation missing');
assert(css.includes('.credit-photo'),'Photo-first credit hero missing');
assert(css.includes('.owner-btn'),'Owner mobile access styling missing');
assert(app.includes('function generateAd()'),'Share Studio ad generator missing');
assert(app.includes("role:'owner'"),'Private Eros account must boot as owner');
assert(app.includes("$('#ownerHub').onclick"),'Owner Share Studio navigation missing');
assert(app.includes('function parkCompletion()'),'Park completion logic missing');
assert(app.includes('function badges()'),'Achievement logic missing');
assert(app.includes('function yearStats('),'Year-in-coasters logic missing');
assert(app.includes('function completedSessions()'),'Completed park-session source missing');
assert(app.includes('checkedInAt')&&app.includes('checkedOutAt'),'Check-in/check-out timestamps missing');
assert(app.includes("r.tripId&&sessionIds.has(r.tripId)"),'Year stats must only count rides attached to completed park sessions');
assert(!app.includes("days.set(ride.date"),'Year stats must not derive busiest day from raw ride/credit entry dates');
assert(app.includes('function renderTimeline()'),'Timeline logic missing');
assert(app.includes('function startTrip'),'Park check-in logic missing');
assert(login.includes('requestEmailLogin'),'Resend public login UI missing');
assert(api.includes('getCloudVault')&&api.includes('saveCloudVault'),'Netlify Blobs public vault sync client missing');
const meta=read('public/meta.js');
assert(meta.includes('FALLBACK_VISUALS'),'Real-photo fallback pool missing');
assert(meta.includes('exact:Boolean(exact)'),'Coaster visual exact/fallback metadata missing');
assert(!app.includes('coaster-image generated'),'Generated coaster art fallback must not return');
assert(!data.includes('DecompressionStream'),'Compressed runtime catalog loader must not return');
assert(data.includes("./db/parks.js")&&data.includes("./db/coasters-5.js"),'Uncompressed catalog modules missing');
console.log('OK: CoasterVerse v5 UI/public-mode/check-in smoke checks passed.');
