import c1 from './db/catalog-01.js';
import c2 from './db/catalog-02.js';
import c3 from './db/catalog-03.js';
import c4 from './db/catalog-04.js';
import c5 from './db/catalog-05.js';
import c6 from './db/catalog-06.js';

const B64=[c1,c2,c3,c4,c5,c6].join('');

function decodeBase64(value){
  const binary=atob(String(value).replace(/\s+/g,''));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}

let decoderPromise;
function loadDecoder(){
  if(globalThis.fflate) return Promise.resolve(globalThis.fflate);
  if(decoderPromise) return decoderPromise;
  decoderPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js';
    script.crossOrigin='anonymous';
    script.referrerPolicy='no-referrer';
    script.onload=()=>{
      if(globalThis.fflate?.gunzipSync) resolve(globalThis.fflate);
      else reject(new Error('Coaster database decoder failed to initialize.'));
    };
    script.onerror=()=>reject(new Error('Could not load the CoasterVerse database decoder.'));
    document.head.appendChild(script);
  });
  return decoderPromise;
}

async function loadCatalog(){
  const decoder=await loadDecoder();
  try{
    const inflated=decoder.gunzipSync(decodeBase64(B64));
    const text=new TextDecoder('utf-8').decode(inflated);
    return JSON.parse(text);
  }catch(err){
    console.error('Coaster catalog decode failed',err);
    throw new Error('Could not load the coaster database. Refresh once and try again.');
  }
}

const raw=await loadCatalog();
export const PARKS=raw.p.map(([id,name,city,state,country])=>({id,name,city,state,country}));
export const COASTERS=raw.c.map(([id,name,parkId,material,classification])=>({id,name,parkId,material,classification}));
export const parkById=new Map(PARKS.map(p=>[p.id,p]));
export const coasterById=new Map(COASTERS.map(c=>[c.id,c]));
export const formatLocation=p=>[p.city,p.state,p.country].filter(Boolean).join(', ');
