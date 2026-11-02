const CACHE_KEY='coasterverse-exact-images-v1';
let memory=null;

function readCache(){
  if(memory) return memory;
  try{memory=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{memory={}}
  return memory;
}
function writeCache(){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(memory||{}))}catch{}
}
function keyOf(type,id){return `${type}:${id}`}

export function getCachedImage(type,id){
  return readCache()[keyOf(type,id)]||null;
}

export async function resolveExactImage({type='coaster',id,name,park='',width=900,force=false}){
  const key=keyOf(type,id);
  const cache=readCache();
  if(!force&&cache[key]?.url) return cache[key];

  const params=new URLSearchParams({type,id,name,width:String(width)});
  if(park) params.set('park',park);
  const res=await fetch('/.netlify/functions/resolve-image?'+params.toString(),{cache:'no-store'});
  const text=await res.text();
  let body={};
  try{body=text?JSON.parse(text):{}}catch{}
  if(!res.ok||!body.image?.url) throw new Error(body.error||'Exact image lookup failed.');
  cache[key]=body.image;
  writeCache();
  return body.image;
}

export function clearExactImageCache(){
  memory={};
  localStorage.removeItem(CACHE_KEY);
}
