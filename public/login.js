import {login,loginHealth} from './auth.js';
import {getPublicConfig,requestEmailLogin,verifyEmailLogin,getDeviceKey,savePublicSession,getSavedPublicSession} from './public-api.js';

const $=s=>document.querySelector(s);
const privateForm=$('#loginForm');
const privateError=$('#loginError');
const privateButton=privateForm?.querySelector('button[type="submit"]');
const publicAccess=$('#publicAccess');
const publicEmailForm=$('#publicEmailForm');
const publicStatus=$('#publicEmailStatus');
const savedButton=$('#continueSavedPublic');

function setPrivateMessage(message=''){if(privateError) privateError.textContent=String(message??'')}
function setPublicMessage(message=''){if(publicStatus) publicStatus.textContent=String(message??'')}

async function launch(session){
  setPrivateMessage('');setPublicMessage('Loading CoasterVerse…');
  const app=await import('./app.js?v=22');
  if(typeof app.boot!=='function') throw new Error('CoasterVerse application failed to initialize.');
  await app.boot(session);
}

async function configurePublicAccess(){
  try{
    const config=await getPublicConfig();
    if(!config.publicMode) return;
    publicAccess.hidden=false;
    $('#publicModeText').textContent=config.signups?'CoasterVerse is open. Use this device or sign in by email to join the public leaderboard.':'CoasterVerse is open for public browsing and local tracking. Email signups are currently closed.';
    publicEmailForm.hidden=!(config.signups&&config.emailEnabled);
    const saved=getSavedPublicSession();
    if(saved?.publicToken){
      savedButton.hidden=false;
      savedButton.textContent=`Continue as ${saved.displayName||'public rider'}`;
      savedButton.onclick=()=>launch({...saved,mode:'public',password:getDeviceKey()}).catch(err=>setPublicMessage(err.message));
    }
  }catch(error){console.warn('Public config unavailable',error)}
}

async function consumeMagicLink(){
  const url=new URL(location.href);
  const token=url.searchParams.get('cv_token');
  if(!token) return false;
  try{
    setPrivateMessage('Verifying email sign-in…');
    const result=await verifyEmailLogin(token);
    const session={mode:'public',publicToken:result.session,displayName:result.profile?.displayName||'Coaster rider',username:result.profile?.displayName||'Coaster rider',password:getDeviceKey()};
    savePublicSession(session);
    url.searchParams.delete('cv_token');
    history.replaceState({},'',url.pathname+url.search+url.hash);
    await launch(session);
    return true;
  }catch(error){
    setPrivateMessage(error.message);
    return false;
  }
}

if(privateForm){
  privateForm.addEventListener('submit',async event=>{
    event.preventDefault();event.stopPropagation();
    const username=$('#username')?.value?.trim()||'';
    const password=$('#password')?.value||'';
    setPrivateMessage('');
    if(privateButton){privateButton.disabled=true;privateButton.textContent='SIGNING IN…'}
    try{
      const authResult=await login(username,password);
      await launch({mode:'private',...authResult});
    }catch(error){
      console.error('CoasterVerse private login error',error);
      setPrivateMessage(error?.message||'Login failed.');
    }finally{
      if(privateButton){privateButton.disabled=false;privateButton.textContent='ENTER COASTERVERSE'}
    }
  });
}

$('#continueGuest')?.addEventListener('click',()=>{
  const name=$('#publicDisplayName')?.value?.trim()||'Guest rider';
  launch({mode:'guest',username:name,displayName:name,password:getDeviceKey()}).catch(error=>setPublicMessage(error.message));
});

publicEmailForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  const email=$('#publicEmail')?.value?.trim()||'';
  const displayName=$('#publicDisplayName')?.value?.trim()||'';
  const button=$('#emailLoginButton');
  if(button){button.disabled=true;button.textContent='SENDING…'}
  setPublicMessage('');
  try{
    await requestEmailLogin(email,displayName);
    setPublicMessage('Check your email. Your CoasterVerse sign-in link expires in 15 minutes.');
  }catch(error){setPublicMessage(error.message)}
  finally{if(button){button.disabled=false;button.textContent='EMAIL ME A SIGN-IN LINK'}}
});

loginHealth().then(status=>{
  if(!status.reachable) setPrivateMessage('Private login service is unavailable on this deployment.');
  else if(!status.configured) setPrivateMessage('Private owner login is not configured for this Netlify deployment.');
}).catch(()=>{});

window.addEventListener('unhandledrejection',event=>{
  console.error('CoasterVerse unhandled rejection',event.reason);
  if(!document.querySelector('#app:not([hidden])')) setPrivateMessage(event.reason?.message||'CoasterVerse failed to initialize.');
});

await configurePublicAccess();
await consumeMagicLink();
