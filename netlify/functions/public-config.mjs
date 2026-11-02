import {json} from '../lib/auth.mjs';
import {getPublicSettings} from '../lib/public-store.mjs';

export default async ()=>{
  const settings=await getPublicSettings();
  const emailEnabled=Boolean(process.env.RESEND_API_KEY&&process.env.CV_EMAIL_FROM&&process.env.CV_AUTH_SECRET);
  return json({
    ok:true,
    ...settings,
    emailEnabled,
    leaderboardEnabled:settings.publicMode,
    backend:'netlify-blobs',
    supabaseRequired:false
  });
};
