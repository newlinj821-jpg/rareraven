// Rooms a person is watching.
//   POST   /api/watch  { k, watch }     add
//   PATCH  /api/watch  { k, id, ... }   edit
//   DELETE /api/watch  { k, id }        remove
//   GET    /api/watch?k=..&id=..        details: every room + daily price history
import { store, getSettings, json, bad, body, rid, loadKeyFromToken, saveKey, planOf, HOTELS, RATES, isISODate, todayCT, daysBetween, lookupKey } from "./_lib/core.mjs";
import { publicKey } from "./_lib/keys.mjs";

function cleanWatch(w, today) {
  const out = {};
  if (!HOTELS[w.hotel]) throw new Error("Pick a hotel.");
  if (!RATES[w.rate]) throw new Error("Pick a rate type.");
  if (!isISODate(w.checkIn) || w.checkIn < today) throw new Error("Check-in must be today or later.");
  if (daysBetween(today, w.checkIn) > 500) throw new Error("Check-in is too far away (max ~16 months).");
  const nights = Number(w.nights);
  if (!Number.isInteger(nights) || nights < 1 || nights > 21) throw new Error("Nights must be 1–21.");
  const adults = Number(w.adults || 2);
  if (!Number.isInteger(adults) || adults < 1 || adults > 6) throw new Error("Adults must be 1–6.");
  Object.assign(out, { hotel: w.hotel, rate: w.rate, checkIn: w.checkIn, nights, adults });
  out.roomFilter = String(w.roomFilter || "").trim().slice(0, 60);
  const paid = w.paid === "" || w.paid == null ? null : Number(w.paid);
  if (paid != null && !(paid > 0 && paid < 20000)) throw new Error("Price paid per night looks off.");
  out.paid = paid;
  const target = w.target === "" || w.target == null ? null : Number(w.target);
  if (target != null && !(target > 0 && target < 20000)) throw new Error("Target price looks off.");
  out.target = target;
  out.minDrop = Math.max(1, Math.min(500, Number(w.minDrop || 1)));
  out.cancelBy = isISODate(w.cancelBy || "") ? w.cancelBy : null;
  out.note = String(w.note || "").slice(0, 80);
  return out;
}

export default async (req) => {
  const s = await getSettings();
  const today = todayCT();
  const isGet = req.method === "GET";
  const b = isGet ? Object.fromEntries(new URL(req.url).searchParams) : await body(req);
  const key = await loadKeyFromToken(b.k);
  if (!key) return bad("That private link isn't valid.", 404);
  key.watches ||= [];

  if (isGet) {
    const w = key.watches.find((x) => x.id === b.id);
    if (!w) return bad("Not found", 404);
    const rec = await (await store()).get(`prices/${encodeURIComponent(lookupKey(w))}`);
    return json({ watch: w, rooms: rec?.rooms || [], days: rec?.days || [], checked: rec?.checked || null, bookingUrl: rec?.url || null });
  }

  if (req.method === "POST") {
    const plan = planOf(key, s);
    const active = key.watches.filter((x) => x.checkIn >= today).length;
    if (active >= plan.watchLimit) {
      return bad(plan.name === "free" && s.salesEnabled
        ? `Free links can watch ${plan.watchLimit} room${plan.watchLimit > 1 ? "s" : ""}. Get a pass to watch up to ${s.passWatchLimit}.`
        : `You're watching the most rooms allowed (${plan.watchLimit}).`, 402);
    }
    let w;
    try { w = cleanWatch(b.watch || {}, today); } catch (e) { return bad(e.message); }
    w.id = rid(6);
    w.created = new Date().toISOString();
    w.alertBelow = w.target ?? w.paid ?? null;
    key.watches.push(w);
    await saveKey(key);
    return json({ key: publicKey(key, s), id: w.id });
  }

  const i = key.watches.findIndex((x) => x.id === b.id);
  if (i < 0) return bad("Not found", 404);

  if (req.method === "PATCH") {
    const old = key.watches[i];
    if (typeof b.paused === "boolean" && Object.keys(b).length <= 3) {
      old.paused = b.paused;
    } else {
      let w;
      try { w = cleanWatch({ ...old, ...b }, today); } catch (e) { return bad(e.message); }
      const sameRoom = lookupKey(w) === lookupKey(old) && w.roomFilter === old.roomFilter;
      const next = { ...old, ...w };
      if (!sameRoom) Object.assign(next, { history: [], lastPrice: null, low: null, high: null, firstPrice: null, status: null });
      // re-arm alerts when they change what they paid or their target
      if (w.paid !== old.paid || w.target !== old.target || !sameRoom) next.alertBelow = w.target ?? w.paid ?? null;
      key.watches[i] = next;
    }
    await saveKey(key);
    return json({ key: publicKey(key, s) });
  }

  if (req.method === "DELETE") {
    key.watches.splice(i, 1);
    await saveKey(key);
    return json({ key: publicKey(key, s) });
  }
  return bad("Method not allowed", 405);
};
export const config = { path: "/api/watch" };
