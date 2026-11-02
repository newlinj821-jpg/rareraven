import {Resend} from 'resend';
import {json,clean,lower,profileId,signToken,escapeHtml} from '../lib/auth.mjs';
import {getPublicSettings} from '../lib/public-store.mjs';

export default async req=>{
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed.'},405);
  const settings=await getPublicSettings();
  if(!settings.publicMode||!settings.signups) return json({ok:false,error:'Public email sign-in is currently closed.'},403);
  if(!process.env.RESEND_API_KEY||!process.env.CV_EMAIL_FROM||!process.env.CV_AUTH_SECRET){
    return json({ok:false,error:'Email sign-in is not configured yet.'},503);
  }
  try{
    const body=await req.json();
    const email=lower(body?.email);
    const displayName=clean(body?.displayName).slice(0,40);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ok:false,error:'Enter a valid email address.'},400);
    const token=signToken({kind:'magic',sub:profileId(email),email,displayName},15*60);
    const base=clean(process.env.CV_SITE_URL)||new URL(req.url).origin;
    const link=new URL('/',base);
    link.searchParams.set('cv_token',token);
    const resend=new Resend(process.env.RESEND_API_KEY);
    const result=await resend.emails.send({
      from:process.env.CV_EMAIL_FROM,
      to:email,
      subject:'Your CoasterVerse sign-in link',
      html:`<div style="font-family:Arial,sans-serif;background:#080b0f;color:#f5f8fb;padding:32px"><h1 style="margin:0 0 12px">COASTER//VERSE</h1><p>Use the button below to sign in. This link expires in 15 minutes.</p><p style="margin:28px 0"><a href="${escapeHtml(link.toString())}" style="display:inline-block;background:#b8ff4a;color:#101606;padding:14px 18px;border-radius:12px;font-weight:800;text-decoration:none">SIGN IN TO COASTERVERSE</a></p><p style="color:#94a0ad;font-size:12px">If you did not request this link, you can ignore this email.</p></div>`
    });
    if(result.error) return json({ok:false,error:'Resend could not send the sign-in email.'},502);
    return json({ok:true,sent:true});
  }catch(error){
    console.error(error);
    return json({ok:false,error:'Could not send the sign-in email.'},500);
  }
};
