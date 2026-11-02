import crypto from 'node:crypto';

const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, max-age=0',
    'x-content-type-options':'nosniff'
  }
});

const clean=value=>String(value ?? '').trim();
const normalized=value=>clean(value).toLowerCase();

function safeEqual(a,b){
  const aa=Buffer.from(String(a),'utf8');
  const bb=Buffer.from(String(b),'utf8');
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

export default async req=>{
  const goodUser=clean(process.env.CV_PRIVATE_USER);
  const goodPass=clean(process.env.CV_PRIVATE_PASS);
  const configured=Boolean(goodUser&&goodPass);

  if(req.method==='GET'){
    return json({ok:true,service:'coasterverse-login',configured});
  }

  if(req.method!=='POST'){
    return json({ok:false,error:'Method not allowed.'},405);
  }

  if(!configured){
    return json({
      ok:false,
      error:'Private login is not configured for this Netlify deployment. CV_PRIVATE_USER and CV_PRIVATE_PASS must be available to Functions.'
    },503);
  }

  try{
    const body=await req.json();
    const username=normalized(body?.username);
    const password=normalized(body?.password);

    // This is a private single-user convenience gate. Normalize both credentials
    // so mobile autocapitalization and surrounding whitespace do not cause failures.
    const userOk=safeEqual(username,normalized(goodUser));
    const passOk=safeEqual(password,normalized(goodPass));

    if(!userOk||!passOk){
      return json({ok:false,error:'Incorrect username or password.'},401);
    }

    return json({ok:true,username:goodUser});
  }catch{
    return json({ok:false,error:'Invalid login request.'},400);
  }
};
