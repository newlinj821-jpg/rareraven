import {json,isOwnerRequest} from '../lib/auth.mjs';
import {getPublicSettings,setPublicSettings} from '../lib/public-store.mjs';

export default async req=>{
  if(!isOwnerRequest(req)) return json({ok:false,error:'Owner authentication required.'},401);
  if(req.method==='GET') return json({ok:true,...await getPublicSettings()});
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed.'},405);
  try{
    const body=await req.json();
    const settings=await setPublicSettings({
      publicMode:Boolean(body?.publicMode),
      signups:Boolean(body?.publicMode&&body?.signups)
    });
    return json({ok:true,...settings});
  }catch{
    return json({ok:false,error:'Invalid public-mode request.'},400);
  }
};
