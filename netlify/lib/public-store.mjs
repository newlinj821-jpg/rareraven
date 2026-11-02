import {getStore} from '@netlify/blobs';

export const publicStore=()=>getStore('coasterverse-public');

export async function getPublicSettings(){
  const store=publicStore();
  const saved=await store.get('settings/public',{type:'json',consistency:'strong'}).catch(()=>null);
  return {
    publicMode:saved?.publicMode ?? String(process.env.CV_PUBLIC_MODE||'false').toLowerCase()==='true',
    signups:saved?.signups ?? String(process.env.CV_PUBLIC_SIGNUPS||'false').toLowerCase()==='true',
    updatedAt:saved?.updatedAt||null
  };
}

export async function setPublicSettings(next){
  const settings={
    publicMode:Boolean(next.publicMode),
    signups:Boolean(next.signups),
    updatedAt:new Date().toISOString()
  };
  await publicStore().setJSON('settings/public',settings);
  return settings;
}
