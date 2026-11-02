import crypto from 'node:crypto';

export const clean=value=>String(value??'').trim();
export const lower=value=>clean(value).toLowerCase();

export function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store, max-age=0',
      'x-content-type-options':'nosniff'
    }
  });
}

export function safeEqual(a,b){
  const aa=Buffer.from(String(a),'utf8');
  const bb=Buffer.from(String(b),'utf8');
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

export function isOwnerRequest(req){
  const goodUser=lower(process.env.CV_PRIVATE_USER);
  const goodPass=lower(process.env.CV_PRIVATE_PASS);
  if(!goodUser||!goodPass) return false;
  return safeEqual(lower(req.headers.get('x-cv-private-user')),goodUser)
    && safeEqual(lower(req.headers.get('x-cv-private-pass')),goodPass);
}

const b64url=input=>Buffer.from(input).toString('base64url');
const from64=input=>Buffer.from(input,'base64url').toString('utf8');

function secret(){
  return clean(process.env.CV_AUTH_SECRET);
}

export function signToken(payload,ttlSeconds){
  const key=secret();
  if(!key) throw new Error('CV_AUTH_SECRET is not configured.');
  const body={...payload,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+ttlSeconds};
  const encoded=b64url(JSON.stringify(body));
  const sig=crypto.createHmac('sha256',key).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token,kind){
  const key=secret();
  if(!key||!token||!String(token).includes('.')) return null;
  const [encoded,sig]=String(token).split('.');
  const expected=crypto.createHmac('sha256',key).update(encoded).digest('base64url');
  if(!safeEqual(sig,expected)) return null;
  try{
    const payload=JSON.parse(from64(encoded));
    if(payload.exp<Math.floor(Date.now()/1000)) return null;
    if(kind&&payload.kind!==kind) return null;
    return payload;
  }catch{return null}
}

export function bearer(req){
  const header=clean(req.headers.get('authorization'));
  return header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
}

export function profileId(email){
  return crypto.createHash('sha256').update(lower(email)).digest('hex').slice(0,32);
}

export const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));

export function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}
