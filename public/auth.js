export async function login(username,password){
  let res;
  try{
    res=await fetch('/.netlify/functions/login',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      cache:'no-store',
      body:JSON.stringify({username,password})
    });
  }catch{
    throw new Error('Login service is unavailable. Check the Netlify deployment and try again.');
  }

  const text=await res.text();
  let body={};
  try{ body=text?JSON.parse(text):{}; }catch{}

  if(!res.ok||!body.ok){
    if(res.status===404) throw new Error('Login function was not deployed.');
    if(res.status===503) throw new Error(body.error||'Login is not configured on this deployment.');
    throw new Error(body.error||`Login failed (${res.status}).`);
  }

  return {username:body.username||username,password:String(password).trim()};
}

export async function loginHealth(){
  try{
    const res=await fetch('/.netlify/functions/login',{headers:{accept:'application/json'},cache:'no-store'});
    const body=await res.json();
    return {reachable:res.ok,configured:Boolean(body?.configured),status:res.status};
  }catch{
    return {reachable:false,configured:false,status:0};
  }
}
