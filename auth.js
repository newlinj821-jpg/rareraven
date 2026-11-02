export async function login(username,password){
  const res=await fetch('/.netlify/functions/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
  let body={}; try{body=await res.json()}catch{}
  if(!res.ok||!body.ok) throw new Error(body.error||'Login failed');
  return {username:body.username||username,password};
}
