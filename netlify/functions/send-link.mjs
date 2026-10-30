// "I lost my private link" — emails a fresh one (only when email is switched on).
import { store, getSettings, json, bad, body, sha, rid, saveKey, siteUrl, emailAvailable, todayCT } from "./_lib/core.mjs";
import { sendEmail } from "./_lib/notify.mjs";

export default async (req) => {
  if (req.method !== "POST") return bad("Method not allowed", 405);
  const s = await getSettings();
  if (!emailAvailable(s)) return bad("Email isn't switched on for this site.");
  const st = await store();
  const email = String((await body(req)).email || "").trim().toLowerCase();
  const ok = json({ ok: true, message: "If that email is on a RateRaven link, a fresh link is on its way." });
  if (!email) return ok;
  const lk = `limits/${todayCT()}/mail-${sha(email).slice(0, 16)}`;
  const n = ((await st.get(lk)) || 0) + 1;
  await st.set(lk, n);
  if (n > 3) return ok;
  const idx = await st.get(`emails/${sha(email)}`);
  const key = idx && (await st.get(`keys/${idx.id}`));
  if (!key) return ok;
  key.s = rid(18);
  key.tokenHash = sha(key.s);
  await saveKey(key);
  const url = `${siteUrl(req)}/my?k=${key.id}.${key.s}`;
  await sendEmail(email, { title: `Your ${s.siteName} link`, text: "Here's your fresh private link. Your old link no longer works.", url }, s).catch(() => {});
  return ok;
};
export const config = { path: "/api/send-link" };
