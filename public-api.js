const DEVICE_KEY='coasterverse-public-device-key';
const SESSION_KEY='coasterverse-public-session';

async function request(path,options={}){
  const res=await fetch('/.netlify/functions/'+path,{cache:'no-store',...options});
  const text=await res.text();
  let body={};
  try{body=text?JSON.parse(text):{}}catch{}
  if(!res.ok||body.ok===false) throw new Error(body.error||`Request failed (${res.status}).`);
  return body;
}

export const getPublicConfig=()=>request('public-config');
export const getPublicLeaderboard=()=>request('public-leaderboard');

export async function requestEmailLogin(email,displayName=''){
  return request('request-email-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,displayName})});
}

export async function verifyEmailLogin(token){
  return request('verify-email-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});
}

export function getDeviceKey(){
  let key=localStorage.getItem(DEVICE_KEY);
  if(!key){
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    key=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(DEVICE_KEY,key);
  }
  return key;
}

export function savePublicSession(session){localStorage.setItem(SESSION_KEY,JSON.stringify(session))}
export function getSavedPublicSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
export function clearPublicSession(){localStorage.removeItem(SESSION_KEY)}

function privateHeaders(session){
  if(session?.mode!=='private') return {};
  return {'x-cv-private-user':session.username||'','x-cv-private-pass':session.password||''};
}

export async function setPublicMode(session,settings){
  return request('admin-public-mode',{method:'POST',headers:{'content-type':'application/json',...privateHeaders(session)},body:JSON.stringify(settings)});
}

export async function getOwnerPublicMode(session){return request('admin-public-mode',{headers:privateHeaders(session)})}

export async function publishProfile(session,snapshot){
  const headers={'content-type':'application/json'};
  if(session?.mode==='public'&&session.publicToken) headers.authorization='Bearer '+session.publicToken;
  Object.assign(headers,privateHeaders(session));
  return request('publish-profile',{method:'POST',headers,body:JSON.stringify(snapshot)});
}

export async function getCloudVault(session){
  if(session?.mode!=='public'||!session.publicToken) return null;
  const result=await request('user-vault',{headers:{authorization:'Bearer '+session.publicToken}});
  return result.vault||null;
}

export async function saveCloudVault(session,vault){
  if(session?.mode!=='public'||!session.publicToken) return null;
  return request('user-vault',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.publicToken},body:JSON.stringify({vault})});
}
