import {json} from '../lib/auth.mjs';
import {getPublicSettings,publicStore} from '../lib/public-store.mjs';

export default async req=>{
  if(req.method!=='GET') return json({ok:false,error:'Method not allowed.'},405);
  const settings=await getPublicSettings();
  if(!settings.publicMode) return json({ok:true,enabled:false,rows:[]});
  const store=publicStore();
  const listed=await store.list({prefix:'profile/'});
  const rows=[];
  for(const item of listed.blobs.slice(0,500)){
    const profile=await store.get(item.key,{type:'json'}).catch(()=>null);
    if(profile?.published!==false&&profile?.displayName){
      rows.push(profile);
    }
  }
  rows.sort((a,b)=>(b.credits||0)-(a.credits||0)||(b.rides||0)-(a.rides||0)||String(a.displayName).localeCompare(String(b.displayName)));
  return json({ok:true,enabled:true,rows:rows.slice(0,100).map((row,index)=>({
    rank:index+1,
    displayName:row.displayName,
    credits:row.credits||0,
    rides:row.rides||0,
    parks:row.parks||0,
    topCoaster:row.topCoaster||'—',
    badgeCount:row.badgeCount||0,
    updatedAt:row.updatedAt||null
  }))});
};
