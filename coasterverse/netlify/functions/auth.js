import crypto from 'node:crypto';

const COOKIE='cv_session';
const MAX_AGE=60*60*24*30;
const json=(statusCode,body,headers={})=>({statusCode,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
const safeEq=(a,b)=>{const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};
const secret=()=>process.env.COASTERVERSE_SESSION_SECRET||'';
const expectedUser=()=>process.env.COASTERVERSE_USERNAME||'';
const expectedPass=()=>process.env.COASTERVERSE_PASSWORD||'';
function sign(value){return crypto.createHmac('sha256',secret()).update(value).digest('base64url')}
function makeToken(){const payload=Buffer.from(JSON.stringify({sub:expectedUser(),exp:Date.now()+MAX_AGE*1000})).toString('base64url');return `${payload}.${sign(payload)}`}
function validToken(token){if(!token||!secret())return false;const [payload,sig]=token.split('.');if(!payload||!sig||!safeEq(sign(payload),sig))return false;try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return data.sub===expectedUser()&&data.exp>Date.now()}catch{return false}}
function cookieValue(headers={}){const raw=headers.cookie||headers.Cookie||'';return raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)||''}
export async function handler(event){
  if(!secret()||!expectedUser()||!expectedPass())return json(500,{error:'CoasterVerse auth is not configured. Set COASTERVERSE_USERNAME, COASTERVERSE_PASSWORD, and COASTERVERSE_SESSION_SECRET in Netlify.'});
  if(event.httpMethod==='GET')return validToken(cookieValue(event.headers))?json(200,{authenticated:true}):json(401,{authenticated:false});
  if(event.httpMethod==='POST'){
    let body={};try{body=JSON.parse(event.body||'{}')}catch{}
    if(!safeEq(body.username||'',expectedUser())||!safeEq(body.password||'',expectedPass()))return json(401,{error:'Incorrect username or password.'});
    return json(200,{authenticated:true},{'set-cookie':`${COOKIE}=${makeToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`});
  }
  if(event.httpMethod==='DELETE')return json(200,{authenticated:false},{'set-cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
  return json(405,{error:'Method not allowed'});
}
