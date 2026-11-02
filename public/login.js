import {login,loginHealth} from './auth.js';

const cacheResetPromise=(async()=>{
  try{
    if('serviceWorker' in navigator){
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg=>reg.unregister()));
    }
    if('caches' in globalThis){
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith('coasterverse-')).map(key=>caches.delete(key)));
    }
  }catch(err){
    console.warn('Old CoasterVerse cache cleanup failed',err);
  }
})();

const $=s=>document.querySelector(s);
const form=$('#loginForm');
const error=$('#loginError');
const button=form?.querySelector('button[type="submit"]');

window.__cvLoginReady=true;

function showError(message=''){
  if(error) error.textContent=String(message ?? '');
}

if(form){
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    event.stopPropagation();

    const username=$('#username')?.value?.trim()||'';
    const password=$('#password')?.value||'';

    showError('');
    if(button){button.disabled=true;button.textContent='SIGNING IN…';}

    try{
      const authResult=await login(username,password);
      showError('Signed in. Loading CoasterVerse…');
      await cacheResetPromise;
      const app=await import('./app.js?v=11');
      if(typeof app.boot!=='function') throw new Error('CoasterVerse application failed to initialize.');
      await app.boot(authResult);
      showError('');
    }catch(err){
      console.error('CoasterVerse login/bootstrap error',err);
      showError(err?.message||'Login failed.');
    }finally{
      if(button){button.disabled=false;button.textContent='ENTER COASTERVERSE';}
    }
  });
}

loginHealth().then(status=>{
  if(!status.reachable) showError('Login service is unavailable on this deployment.');
  else if(!status.configured) showError('Login is not configured for Netlify Functions. Check CV_PRIVATE_USER and CV_PRIVATE_PASS environment-variable scopes.');
}).catch(()=>{});

window.addEventListener('unhandledrejection',event=>{
  console.error('CoasterVerse unhandled rejection',event.reason);
  if(!document.querySelector('#app:not([hidden])')) showError(event.reason?.message||'CoasterVerse failed to initialize.');
});
