const endpoint='/.netlify/functions/auth';
export async function getSession(){try{const r=await fetch(endpoint,{credentials:'same-origin'});return r.ok}catch{return false}}
export async function login(username,password){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({username,password})});if(!r.ok){let msg='Login failed';try{msg=(await r.json()).error||msg}catch{}throw new Error(msg)}return true}
export async function logout(){await fetch(endpoint,{method:'DELETE',credentials:'same-origin'}).catch(()=>{})}
