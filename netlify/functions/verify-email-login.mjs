import {json,verifyToken,signToken} from '../lib/auth.mjs';
import {getPublicSettings,publicStore} from '../lib/public-store.mjs';

export default async req=>{
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed.'},405);
  const settings=await getPublicSettings();
  if(!settings.publicMode) return json({ok:false,error:'Public mode is currently off.'},403);
  try{
    const body=await req.json();
    const magic=verifyToken(body?.token,'magic');
    if(!magic) return json({ok:false,error:'That sign-in link is invalid or expired.'},401);
    const store=publicStore();
    const key=`profile/${magic.sub}`;
    const existing=await store.get(key,{type:'json',consistency:'strong'}).catch(()=>null);
    const displayName=String(existing?.displayName||magic.displayName||magic.email.split('@')[0]).slice(0,40);
    const profile={
      ...(existing||{}),
      id:magic.sub,
      displayName,
      emailHash:magic.sub,
      published:existing?.published??true,
      createdAt:existing?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    await store.setJSON(key,profile);
    const session=signToken({kind:'session',sub:magic.sub,email:magic.email,displayName},30*24*60*60);
    return json({ok:true,session,profile:{id:magic.sub,displayName,published:profile.published}});
  }catch(error){
    console.error(error);
    return json({ok:false,error:'Could not verify that sign-in link.'},500);
  }
};
