import {json,isOwnerRequest,bearer,verifyToken,clamp,clean} from '../lib/auth.mjs';
import {getPublicSettings,publicStore} from '../lib/public-store.mjs';

export default async req=>{
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed.'},405);
  const settings=await getPublicSettings();
  if(!settings.publicMode) return json({ok:false,error:'Public mode is currently off.'},403);

  let id=null;
  let defaultName='Eros';
  const token=bearer(req);
  if(token){
    const session=verifyToken(token,'session');
    if(!session) return json({ok:false,error:'Public session expired. Sign in again.'},401);
    id=session.sub;
    defaultName=session.displayName||'Coaster rider';
  }else if(isOwnerRequest(req)){
    id='owner';
    defaultName=clean(process.env.CV_PUBLIC_OWNER_NAME)||clean(process.env.CV_PRIVATE_USER)||'Eros';
  }else{
    return json({ok:false,error:'Authentication required.'},401);
  }

  try{
    const body=await req.json();
    const profile={
      id,
      displayName:clean(body?.displayName||defaultName).slice(0,40),
      credits:clamp(body?.credits,0,100000),
      rides:clamp(body?.rides,0,1000000),
      parks:clamp(body?.parks,0,10000),
      topCoaster:clean(body?.topCoaster||'—').slice(0,100),
      badgeCount:clamp(body?.badgeCount,0,10000),
      published:body?.published!==false,
      updatedAt:new Date().toISOString()
    };
    await publicStore().setJSON(`profile/${id}`,profile);
    return json({ok:true,profile});
  }catch{
    return json({ok:false,error:'Invalid public profile payload.'},400);
  }
};
