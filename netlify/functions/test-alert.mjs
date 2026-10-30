// Sends a test message to every alert method a person has set up.
import { getSettings, json, bad, body, loadKeyFromToken, saveKey, siteUrl } from "./_lib/core.mjs";
import { sendAll, channelsOf } from "./_lib/notify.mjs";

export default async (req) => {
  if (req.method !== "POST") return bad("Method not allowed", 405);
  const s = await getSettings();
  const b = await body(req);
  const key = await loadKeyFromToken(b.k);
  if (!key) return bad("That private link isn't valid.", 404);
  if (!channelsOf(key, s).length) return bad("Add at least one way to reach you first.");
  const last = key.lastTest ? Date.parse(key.lastTest) : 0;
  if (Date.now() - last < 20000) return bad("Give it a few seconds between tests.", 429);
  key.lastTest = new Date().toISOString();
  await saveKey(key);
  const res = await sendAll(key, s, {
    title: `${s.siteName} test — you're all set!`,
    text: "This is what a price-drop alert will look like.\n⬇️ Portofino · Fri, Dec 11 · 2n · Annual Passholder: now $289/night (example)",
    url: `${siteUrl(req)}/my?k=${key.id}.${key.s}`,
  });
  return json({ results: res });
};
export const config = { path: "/api/test-alert" };
