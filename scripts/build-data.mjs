import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root=process.cwd();
const db=path.join(root,'public','db');
const files=fs.readdirSync(db).filter(n=>/^catalog-\d+\.js$/.test(n)).sort();
if(!files.length) throw new Error('No coaster catalog chunks found');
const b64=files.map(name=>{
  const src=fs.readFileSync(path.join(db,name),'utf8');
  const match=src.match(/`([\s\S]*?)`/);
  if(!match) throw new Error(`Invalid catalog chunk: ${name}`);
  return match[1];
}).join('');
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
if(!Array.isArray(raw.p)||!Array.isArray(raw.c)) throw new Error('Invalid coaster catalog payload');
const out=`const P=${JSON.stringify(raw.p)};\nconst C=${JSON.stringify(raw.c)};\nexport const PARKS=P.map(([id,name,city,state,country])=>({id,name,city,state,country}));\nexport const COASTERS=C.map(([id,name,parkId,material,classification])=>({id,name,parkId,material,classification}));\nexport const parkById=new Map(PARKS.map(p=>[p.id,p]));\nexport const coasterById=new Map(COASTERS.map(c=>[c.id,c]));\nexport const formatLocation=p=>[p.city,p.state,p.country].filter(Boolean).join(', ');\n`;
fs.writeFileSync(path.join(root,'public','data.js'),out);
console.log(`Generated browser-safe coaster catalog: ${raw.p.length} parks, ${raw.c.length} coasters`);
