import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root=process.cwd();
const db=path.join(root,'public','db');
const files=fs.readdirSync(db).filter(name=>/^catalog-\d+\.js$/.test(name)).sort();

if(!files.length) throw new Error('No coaster catalog chunks found.');

const b64=files.map(name=>{
  const source=fs.readFileSync(path.join(db,name),'utf8');
  const match=source.match(/\`([\s\S]*?)\`/);
  if(!match) throw new Error(`Invalid catalog chunk: ${name}`);
  return match[1].replace(/\s+/g,'');
}).join('');

const gzip=Buffer.from(b64,'base64');

function gzipDeflateBody(buffer){
  if(buffer.length<18 || buffer[0]!==0x1f || buffer[1]!==0x8b || buffer[2]!==8){
    throw new Error('Catalog payload is not a valid gzip stream.');
  }

  let offset=10;
  const flags=buffer[3];

  if(flags & 0x04){
    const xlen=buffer.readUInt16LE(offset);
    offset+=2+xlen;
  }
  if(flags & 0x08){
    while(offset<buffer.length && buffer[offset++]!==0);
  }
  if(flags & 0x10){
    while(offset<buffer.length && buffer[offset++]!==0);
  }
  if(flags & 0x02) offset+=2;

  const end=buffer.length-8;
  if(offset>=end) throw new Error('Catalog gzip body is empty.');
  return buffer.subarray(offset,end);
}

let jsonText;
try{
  jsonText=zlib.gunzipSync(gzip).toString('utf8');
}catch(error){
  console.warn('Gzip checksum failed; recovering catalog from raw DEFLATE payload:',error.code||error.message);
  jsonText=zlib.inflateRawSync(gzipDeflateBody(gzip)).toString('utf8');
}

const raw=JSON.parse(jsonText);

if(!Array.isArray(raw.p) || !Array.isArray(raw.c)){
  throw new Error('Invalid coaster catalog payload.');
}
if(raw.p.length<60 || raw.c.length<350){
  throw new Error(`Catalog unexpectedly small: ${raw.p.length} parks, ${raw.c.length} coasters.`);
}

const parkIds=new Set(raw.p.map(row=>row[0]));
const coasterIds=new Set();
for(const row of raw.c){
  const [id,name,parkId,material,classification]=row;
  if(!id || !name || !parkId || !material || !classification) throw new Error(`Invalid coaster row: ${JSON.stringify(row)}`);
  if(coasterIds.has(id)) throw new Error(`Duplicate coaster id: ${id}`);
  coasterIds.add(id);
  if(!parkIds.has(parkId)) throw new Error(`Unknown park ${parkId} for ${name}`);
}

const output=`const P=${JSON.stringify(raw.p)};\nconst C=${JSON.stringify(raw.c)};\nexport const PARKS=P.map(([id,name,city,state,country])=>({id,name,city,state,country}));\nexport const COASTERS=C.map(([id,name,parkId,material,classification])=>({id,name,parkId,material,classification}));\nexport const parkById=new Map(PARKS.map(p=>[p.id,p]));\nexport const coasterById=new Map(COASTERS.map(c=>[c.id,c]));\nexport const formatLocation=p=>[p.city,p.state,p.country].filter(Boolean).join(', ');\n`;

fs.writeFileSync(path.join(root,'data.js'),output);
fs.writeFileSync(path.join(root,'public','data.js'),output);

console.log(`Generated browser-safe catalog: ${raw.p.length} parks, ${raw.c.length} coasters.`);
