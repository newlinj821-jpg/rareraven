const KEY='coasterverse-private-v3';
const LEGACY='coasterverse-v1';
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

async function keyFor(password,salt){
  const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

function blank(){
  const now=new Date().toISOString();
  return {version:5,rides:[],customParks:[],customCoasters:[],ratings:{},trips:[],activeTripId:null,profile:{displayName:'Eros',publishPublic:false},preferences:{creditAnimation:true},createdAt:now,updatedAt:now};
}

export async function loadVault(password){
  const raw=localStorage.getItem(KEY);
  if(!raw) return migrateLegacy(blank());
  try{
    const payload=JSON.parse(raw),salt=unb64(payload.salt),iv=unb64(payload.iv),key=await keyFor(password,salt);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,unb64(payload.data));
    return normalize(JSON.parse(dec.decode(plain)));
  }catch{
    throw new Error('Could not unlock local CoasterVerse data. Check your password or restore a backup.');
  }
}

export async function saveVault(password,data){
  data.version=5;data.updatedAt=new Date().toISOString();
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(password,salt);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(data)));
  localStorage.setItem(KEY,JSON.stringify({salt:b64(salt),iv:b64(iv),data:b64(cipher)}));
}

function normalize(d){
  const out=blank();
  if(!d||typeof d!=='object') return out;
  out.rides=Array.isArray(d.rides)?d.rides:[];
  out.customParks=Array.isArray(d.customParks)?d.customParks:[];
  out.customCoasters=Array.isArray(d.customCoasters)?d.customCoasters:[];
  out.ratings=d.ratings&&typeof d.ratings==='object'?d.ratings:{};
  out.trips=Array.isArray(d.trips)?d.trips:[];
  out.activeTripId=d.activeTripId||null;
  out.profile={...out.profile,...(d.profile||{})};
  out.preferences={...out.preferences,...(d.preferences||{})};
  out.createdAt=d.createdAt||out.createdAt;out.updatedAt=d.updatedAt||out.updatedAt;
  return out;
}

function migrateLegacy(vault){
  try{
    const old=JSON.parse(localStorage.getItem(LEGACY)||'[]');
    if(Array.isArray(old)&&old.length){
      for(const x of old){
        if(!x?.name||!x?.park) continue;
        const parkId='custom-park-'+slug(x.park),coasterId='custom-coaster-'+slug(x.park+'-'+x.name);
        if(!vault.customParks.some(p=>p.id===parkId)) vault.customParks.push({id:parkId,name:x.park,city:'',state:'',country:x.country||''});
        if(!vault.customCoasters.some(c=>c.id===coasterId)) vault.customCoasters.push({id:coasterId,name:x.name,parkId,material:'Steel',classification:'Unclassified'});
        vault.rides.push({id:crypto.randomUUID(),coasterId,date:x.date||today(),loggedAt:new Date().toISOString(),source:'legacy'});
      }
      localStorage.removeItem(LEGACY);
    }
  }catch{}
  return vault;
}

const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||crypto.randomUUID();
const today=()=>new Date().toISOString().slice(0,10);
export function exportVault(data){return new Blob([JSON.stringify(data,null,2)],{type:'application/json'})}
export function importVaultText(text){return normalize(JSON.parse(text))}
