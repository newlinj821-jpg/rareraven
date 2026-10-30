// After each check, the scraper calls this a few times (25 people per call)
// so everyone gets their message without any function running too long.
import { store, getSettings, json, bad, requireSecret, saveKey, siteUrl } from "./_lib/core.mjs";
import { morningFor } from "./_lib/morning.mjs";
import { sendAll, channelsOf } from "./_lib/notify.mjs";

const PAGE = 25;

export default async (req) => {
  if (!requireSecret(req, "SCRAPER_SECRET")) return bad("Not allowed", 401);
  const st = await store();
  const s = await getSettings();
  const u = new URL(req.url);
  const cursor = Number(u.searchParams.get("cursor") || 0);
  const slot = u.searchParams.get("slot") || "morning"; // summaries + deadline reminders only go out in the morning
  const names = (await st.list("keys/")).sort();
  const base = siteUrl(req);
  let sent = 0, drops = 0, failed = 0;

  for (const name of names.slice(cursor, cursor + PAGE)) {
    const key = await st.get(name);
    if (!key?.watches?.length) continue;
    const { msg, changed, drops: d = 0 } = await morningFor(key, s, base, slot);
    if (msg && channelsOf(key, s).length) {
      const res = await sendAll(key, s, msg);
      key.lastSend = { at: new Date().toISOString(), res };
      if (Object.values(res).some((v) => v === "ok")) sent++; else failed++;
      drops += d;
    }
    if (changed || msg) await saveKey(key);
  }

  const next = cursor + PAGE < names.length ? cursor + PAGE : null;
  const last = (await st.get("runs/last")) || {};
  last.sent = (cursor === 0 ? 0 : last.sent || 0) + sent;
  last.drops = (cursor === 0 ? 0 : last.drops || 0) + drops;
  last.sendFailed = (cursor === 0 ? 0 : last.sendFailed || 0) + failed;
  if (next == null) last.notified = new Date().toISOString();
  await st.set("runs/last", last);
  return json({ next, sent, drops });
};
export const config = { path: "/api/notify" };
