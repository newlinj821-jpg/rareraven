import {json,bearer,verifyToken} from '../lib/auth.mjs';
import {getPublicSettings,publicStore} from '../lib/public-store.mjs';

export default async req=>{
  const settings=await getPublicSettings();
  if(!settings.publicMode) return json({ok:false,error:'Public mode is currently off.'},403);
  const session=verifyToken(bearer(req),'session');
  if(!session) return json({ok:false,error:'Public session expired. Sign in again.'},401);
  const key=`vault/${session.sub}`;
  const store=publicStore();

  if(req.method==='GET'){
    const vault=await store.get(key,{type:'json',consistency:'strong'}).catch(()=>null);
    return json({ok:true,vault:vault||null});
  }

  if(req.method!=='POST') return json({ok:false,error:'Method not allowed.'},405);
  try{
    const body=await req.json();
    const vault=body?.vault;
    if(!vault||typeof vault!=='object'||!Array.isArray(vault.rides)||!Array.isArray(vault.customParks)||!Array.isArray(vault.customCoasters)){
      return json({ok:false,error:'Invalid vault payload.'},400);
    }
    const safe={
      version:5,
      rides:vault.rides.slice(0,100000),
      customParks:vault.customParks.slice(0,5000),
      customCoasters:vault.customCoasters.slice(0,10000),
      ratings:vault.ratings&&typeof vault.ratings==='object'?vault.ratings:{},
      trips:Array.isArray(vault.trips)?vault.trips.slice(0,10000):[],
      activeTripId:vault.activeTripId||null,
      profile:vault.profile&&typeof vault.profile==='object'?vault.profile:{},
      preferences:vault.preferences&&typeof vault.preferences==='object'?vault.preferences:{},
      createdAt:vault.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    await store.setJSON(key,safe);
    return json({ok:true,updatedAt:safe.updatedAt});
  }catch(error){
    console.error(error);
    return json({ok:false,error:'Could not save public CoasterVerse data.'},500);
  }
};
