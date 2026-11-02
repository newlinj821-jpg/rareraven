import crypto from 'node:crypto';

const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json','cache-control':'no-store'}
});

export default async req=>{
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
  const goodUser=process.env.CV_PRIVATE_USER;
  const goodPass=process.env.CV_PRIVATE_PASS;
  if(!goodUser||!goodPass) return json({ok:false,error:'Private login is not configured on this deployment.'},503);
  try{
    const {username='',password=''}=await req.json();
    const safe=(a,b)=>{
      const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
      return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
    };
    if(!safe(username.toLowerCase(),goodUser.toLowerCase())||!safe(password,goodPass)){
      return json({ok:false,error:'Incorrect username or password.'},401);
    }
    return json({ok:true,username:goodUser});
  }catch{
    return json({ok:false,error:'Invalid login request.'},400);
  }
};
