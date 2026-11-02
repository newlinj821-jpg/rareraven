import {getStore} from '@netlify/blobs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'public, max-age=86400, s-maxage=604800',
    'x-content-type-options':'nosniff'
  }
});

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/&/g,' and ').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

const STOP=new Set(['the','and','of','a','an','at','ride','roller','coaster','rollercoaster','theme','park','parks','amusement','adventure','adventures']);
const tokens=v=>norm(v).split(' ').filter(t=>t.length>2&&!STOP.has(t));
const coverage=(need,text)=>{
  const wanted=[...new Set(tokens(need))];
  if(!wanted.length) return 0;
  const hay=new Set(tokens(text));
  return wanted.filter(t=>hay.has(t)).length/wanted.length;
};
const containsPhrase=(needle,haystack)=>{
  const n=norm(needle),h=norm(haystack);
  return Boolean(n&&h.includes(n));
};
const stripHtml=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ');

async function fetchJson(url){
  const res=await fetch(url,{
    headers:{'user-agent':'CoasterVerse/1.0 exact-image-resolver'}
  });
  if(!res.ok) throw new Error(`Image source returned ${res.status}`);
  return res.json();
}

function scoreCandidate({name,park,title,text,description,source}){
  const nameTokens=tokens(name);
  const nameCov=coverage(name,`${title} ${text} ${description}`);
  const titleCov=coverage(name,title);
  const parkCov=coverage(park,`${title} ${text} ${description}`);
  const namePhrase=containsPhrase(name,title)||containsPhrase(name,`${text} ${description}`);
  const parkPhrase=containsPhrase(park,`${title} ${text} ${description}`);
  const roller=/roller coaster|coaster|theme park|amusement park|ride|attraction/i.test(`${title} ${description} ${text}`);

  let score=0;
  if(namePhrase) score+=55;
  score+=Math.round(nameCov*30);
  score+=Math.round(titleCov*25);
  if(parkPhrase) score+=30;
  score+=Math.round(parkCov*20);
  if(roller) score+=8;
  if(source==='commons'&&/\.jpe?g|\.png|\.webp/i.test(title)) score+=4;

  const ambiguous=nameTokens.length<=2;
  const acceptable=nameCov>=0.72 && (!ambiguous || parkCov>=0.30 || parkPhrase);
  return {score,acceptable,nameCov,parkCov};
}

async function wikipediaImage(name,park,width){
  const q=`${name} ${park} roller coaster`;
  const searchUrl=new URL('https://en.wikipedia.org/w/api.php');
  searchUrl.search=new URLSearchParams({
    action:'query',format:'json',origin:'*',list:'search',
    srsearch:q,srnamespace:'0',srlimit:'12',srprop:'snippet|titlesnippet'
  }).toString();
  const search=await fetchJson(searchUrl);
  const rows=search?.query?.search||[];
  if(!rows.length) return null;

  const titles=rows.map(r=>r.title).join('|');
  const detailUrl=new URL('https://en.wikipedia.org/w/api.php');
  detailUrl.search=new URLSearchParams({
    action:'query',format:'json',origin:'*',titles,
    prop:'pageimages|pageterms|info',
    piprop:'thumbnail|original',pithumbsize:String(Math.min(1600,Math.max(500,width))),
    pilimit:'max',inprop:'url',wbptterms:'description'
  }).toString();
  const detail=await fetchJson(detailUrl);
  const pages=Object.values(detail?.query?.pages||{});
  const searchByTitle=new Map(rows.map(r=>[r.title,r]));

  const candidates=pages.map(page=>{
    const sr=searchByTitle.get(page.title)||{};
    const description=(page.terms?.description||[]).join(' ');
    const text=`${stripHtml(sr.snippet)} ${description}`;
    const image=page.thumbnail?.source||page.original?.source;
    if(!image) return null;
    const scored=scoreCandidate({name,park,title:page.title,text,description,source:'wikipedia'});
    return {
      ...scored,
      url:image,
      source:'Wikipedia',
      sourceUrl:page.fullurl||`https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`,
      title:page.title,
      credit:'Wikipedia / Wikimedia Commons'
    };
  }).filter(Boolean).filter(x=>x.acceptable).sort((a,b)=>b.score-a.score);

  return candidates[0]||null;
}

async function commonsImage(name,park,width){
  const searches=[
    `"${name}" "${park}"`,
    `"${name}" ${park} roller coaster`,
    `${name} ${park}`
  ];

  let best=null;
  for(const query of searches){
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    url.search=new URLSearchParams({
      action:'query',format:'json',origin:'*',generator:'search',
      gsrsearch:query,gsrnamespace:'6',gsrlimit:'24',
      prop:'imageinfo',iiprop:'url|extmetadata',
      iiurlwidth:String(Math.min(1600,Math.max(500,width)))
    }).toString();
    const data=await fetchJson(url);
    const pages=Object.values(data?.query?.pages||{});
    for(const page of pages){
      const info=page.imageinfo?.[0];
      if(!info?.thumburl&&!info?.url) continue;
      const meta=info.extmetadata||{};
      const description=[
        meta.ObjectName?.value,meta.ImageDescription?.value,meta.Categories?.value,
        meta.Caption?.value,meta.Credit?.value
      ].map(stripHtml).join(' ');
      const scored=scoreCandidate({name,park,title:page.title,text:description,description,source:'commons'});
      if(!scored.acceptable) continue;
      const candidate={
        ...scored,
        url:info.thumburl||info.url,
        source:'Wikimedia Commons',
        sourceUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`,
        title:page.title,
        credit:stripHtml(meta.Artist?.value||meta.Credit?.value||'Wikimedia Commons')
      };
      if(!best||candidate.score>best.score) best=candidate;
    }
    if(best?.score>=105) break;
  }
  return best;
}

async function commonsCategoryImage(name,park,width){
  const searchUrl=new URL('https://commons.wikimedia.org/w/api.php');
  searchUrl.search=new URLSearchParams({
    action:'query',format:'json',origin:'*',list:'search',
    srsearch:`"${name}" "${park}"`,srnamespace:'14',srlimit:'12',srprop:'snippet|titlesnippet'
  }).toString();
  const search=await fetchJson(searchUrl);
  const categories=(search?.query?.search||[]).map(row=>{
    const title=String(row.title||'').replace(/^Category:/i,'');
    const text=stripHtml(row.snippet||'');
    const scored=scoreCandidate({name,park,title,text,description:text,source:'commons'});
    return {...row,titleClean:title,...scored};
  }).filter(x=>x.acceptable).sort((a,b)=>b.score-a.score);

  for(const category of categories.slice(0,4)){
    const membersUrl=new URL('https://commons.wikimedia.org/w/api.php');
    membersUrl.search=new URLSearchParams({
      action:'query',format:'json',origin:'*',list:'categorymembers',
      cmtitle:category.title,cmnamespace:'6',cmlimit:'50',cmtype:'file'
    }).toString();
    const members=await fetchJson(membersUrl);
    const files=(members?.query?.categorymembers||[]).filter(x=>/\.(jpe?g|png|webp)$/i.test(x.title||''));
    if(!files.length) continue;

    const preferred=[...files].sort((a,b)=>{
      const ta=norm(a.title),tb=norm(b.title);
      const score=t=>(containsPhrase(name,t)?50:0)+Math.round(coverage(name,t)*30)+(/train|track|coaster|ride|roller/i.test(t)?15:0)-(/sign|entrance|queue|logo|map/i.test(t)?8:0);
      return score(tb)-score(ta);
    }).slice(0,12);

    const detailUrl=new URL('https://commons.wikimedia.org/w/api.php');
    detailUrl.search=new URLSearchParams({
      action:'query',format:'json',origin:'*',
      pageids:preferred.map(x=>x.pageid).join('|'),
      prop:'imageinfo',iiprop:'url|extmetadata',
      iiurlwidth:String(Math.min(1600,Math.max(500,width)))
    }).toString();
    const detail=await fetchJson(detailUrl);
    const pages=Object.values(detail?.query?.pages||{});
    for(const page of pages){
      const info=page.imageinfo?.[0];
      if(!info?.thumburl&&!info?.url) continue;
      const meta=info.extmetadata||{};
      return {
        score:category.score,
        acceptable:true,
        nameCov:category.nameCov,
        parkCov:category.parkCov,
        url:info.thumburl||info.url,
        source:'Wikimedia Commons',
        sourceUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`,
        title:page.title,
        credit:stripHtml(meta.Artist?.value||meta.Credit?.value||'Wikimedia Commons'),
        category:category.title
      };
    }
  }
  return null;
}

async function resolveCoaster(name,park,width){
  const candidates=[];
  try{const wiki=await wikipediaImage(name,park,width);if(wiki)candidates.push(wiki)}catch(error){console.warn('Wikipedia image search failed',error)}
  try{const commons=await commonsImage(name,park,width);if(commons)candidates.push(commons)}catch(error){console.warn('Commons image search failed',error)}
  try{const category=await commonsCategoryImage(name,park,width);if(category)candidates.push(category)}catch(error){console.warn('Commons category image search failed',error)}
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(!best) return null;
  return {...best,verified:true,query:{name,park}};
}

async function resolvePark(name,width){
  // Park cards may use a park-specific image; coaster cards never use this as a fallback.
  const query=`${name} amusement park`;
  const url=new URL('https://en.wikipedia.org/w/api.php');
  url.search=new URLSearchParams({
    action:'query',format:'json',origin:'*',generator:'search',
    gsrsearch:query,gsrnamespace:'0',gsrlimit:'8',
    prop:'pageimages|pageterms|info',piprop:'thumbnail|original',
    pithumbsize:String(Math.min(1600,Math.max(500,width))),pilimit:'max',inprop:'url',wbptterms:'description'
  }).toString();
  const data=await fetchJson(url);
  const pages=Object.values(data?.query?.pages||{});
  const target=norm(name);
  const ranked=pages.map(page=>{
    const desc=(page.terms?.description||[]).join(' ');
    const n=norm(page.title);
    const score=(n===target?100:n.includes(target)||target.includes(n)?75:Math.round(coverage(name,page.title)*60))+
      (/amusement park|theme park/i.test(desc)?20:0);
    return {
      score,
      url:page.thumbnail?.source||page.original?.source,
      source:'Wikipedia',
      sourceUrl:page.fullurl,
      title:page.title,
      credit:'Wikipedia / Wikimedia Commons',
      verified:score>=70
    };
  }).filter(x=>x.url&&x.verified).sort((a,b)=>b.score-a.score);
  return ranked[0]||null;
}

export default async req=>{
  if(req.method!=='GET') return json({ok:false,error:'Method not allowed.'},405);
  const url=new URL(req.url);
  const type=clean(url.searchParams.get('type'))||'coaster';
  const id=clean(url.searchParams.get('id'));
  const name=clean(url.searchParams.get('name'));
  const park=clean(url.searchParams.get('park'));
  const width=Math.min(1600,Math.max(500,Number(url.searchParams.get('width'))||900));

  if(!id||!name) return json({ok:false,error:'Image id and name are required.'},400);
  if(type==='coaster'&&!park) return json({ok:false,error:'Park name is required for coaster verification.'},400);

  const store=getStore('coasterverse-images');
  const key=`image/${type}/${id}`;
  const cached=await store.get(key,{type:'json',consistency:'strong'}).catch(()=>null);
  if(cached?.url&&cached?.verified) return json({ok:true,cached:true,image:cached});

  const result=type==='park'?await resolvePark(name,width):await resolveCoaster(name,park,width);
  if(!result) return json({ok:false,error:'Exact image is still resolving. Try again shortly.'},404);

  const image={...result,id,type,resolvedAt:new Date().toISOString()};
  await store.setJSON(key,image);
  return json({ok:true,cached:false,image});
};
