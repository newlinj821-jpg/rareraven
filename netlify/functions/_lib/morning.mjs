// Builds each person's morning message: price drops, daily summary, cancel-deadline warnings.
import { store, todayCT, addDays, daysBetween, lookupKey, HOTELS, RATES, catalog, money, siteUrl, SOURCES } from "./core.mjs";

export function pickPrice(rec, roomFilter) {
  if (!rec?.rooms?.length) return null;
  let pool = rec.rooms;
  if (roomFilter) {
    const f = roomFilter.toLowerCase();
    pool = pool.filter((r) => r.name.toLowerCase().includes(f));
  }
  let best = null;
  for (const r of pool) {
    const p = r.price ?? (r.total != null ? r.total : null);
    if (p != null && (!best || p < best.price)) best = { name: r.name, price: p, offers: r.offers || [], was: r.was || null, site: r.site || null };
  }
  return best;
}

export const fmtDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function cancelDeadline(w) {
  if (w.cancelBy) return w.cancelBy;
  return addDays(w.checkIn, -catalog.cancelPolicy.freeUntilDaysBefore);
}

// Updates one person's watches with this morning's prices and returns the message (or null).
export async function morningFor(key, settings, base, slot = "morning") {
  const morning = slot === "morning";
  const st = await store();
  const today = todayCT();
  const drops = [], lines = [], warnings = [];
  let changed = false;

  for (const w of key.watches || []) {
    if (w.checkIn < today) { if (w.status !== "done") { w.status = "done"; changed = true; } continue; }
    const hotel = HOTELS[w.hotel]?.short || w.hotel;
    const label = `${hotel} · ${fmtDay(w.checkIn)} · ${w.nights}n · ${RATES[w.rate]?.name || w.rate}`;

    const rec = await st.get(`prices/${encodeURIComponent(lookupKey(w))}`);
    const fresh = rec?.checked && rec.checked.slice(0, 10) >= addDays(today, -1);
    const best = fresh ? pickPrice(rec, w.roomFilter) : null;

    if (best) {
      const price = best.price;
      const wasSoldOut = w.status === "soldout";
      if (w.lastPrice !== price || w.lastChecked !== today) changed = true;
      const prev = w.lastPrice;
      w.lastPrice = price;
      w.lastRoom = best.name;
      w.lastSite = best.site;
      w.lastOffers = best.offers;
      w.lastChecked = today;
      w.status = "ok";
      w.low = Math.min(price, w.low ?? Infinity);
      w.high = Math.max(price, w.high ?? -Infinity);
      w.history = [...(w.history || []).filter((h) => h.d !== today), { d: today, p: price }].slice(-400);
      if (w.firstPrice == null) w.firstPrice = price;

      const bar = w.alertBelow ?? w.paid ?? null;
      const minDrop = Number(w.minDrop || 1);
      if (bar == null) w.alertBelow = price; // nothing entered: alert on any drop below the first price we see
      else if (price <= bar - minDrop) {
        const tax = 1 + (catalog.taxRate || 0);
        const vsPaid = w.paid ? ` (you paid ${money(w.paid)}: save about ${money((w.paid - price) * w.nights * tax)} with tax for ${w.nights} night${w.nights > 1 ? "s" : ""})` : "";
        drops.push(`⬇️ ${label}: now ${money(price)}/night${best.site && SOURCES[best.site] ? ` on ${SOURCES[best.site]}` : ""}${vsPaid}${best.offers.length ? ` — ${best.offers[0]}` : ""}`);
        w.alertBelow = price; // only tell them again if it drops further
        w.drops = (w.drops || 0) + 1;
      }
      if (wasSoldOut) drops.push(`🔔 ${label} is bookable again: ${money(price)}/night — ${best.name}`);
      const arrow = prev == null ? "" : price < prev ? " ⬇️" : price > prev ? " ⬆️" : " =";
      lines.push(`• ${label}: ${money(price)}/night${arrow}${w.paid ? ` (paid ${money(w.paid)})` : ""} — ${best.name}`);
    } else if (rec?.status === "soldout" && fresh) {
      w.status = "soldout"; w.lastChecked = today; changed = true;
      lines.push(`• ${label}: sold out right now`);
    } else {
      lines.push(`• ${label}: couldn't check today`);
    }

    // Free-cancellation reminders
    const dl = cancelDeadline(w);
    const left = daysBetween(today, dl);
    if (morning && (left === 2 || left === 0)) {
      warnings.push(left === 0
        ? `⏰ TODAY is the last day to change or cancel ${label} for free (${fmtDay(dl)}).`
        : `⏰ 2 days left to change or cancel ${label} for free (by ${fmtDay(dl)}).`);
    }
  }

  const url = `${base}/my?k=${key.id}.${key.s}`;
  const summary = key.daily && morning;
  if (!drops.length && !warnings.length && !summary) return { msg: null, changed };
  if (!drops.length && !warnings.length && !lines.length) return { msg: null, changed };
  const title = drops.length
    ? `${drops.length === 1 ? "Price drop" : `${drops.length} price drops`}! ${drops[0].replace(/^⬇️ /, "").split(":")[0]}`
    : warnings.length ? "Free-cancel deadline coming up" : "Your rooms this morning";
  const when = { morning: "THIS MORNING", afternoon: "THIS AFTERNOON", evening: "THIS EVENING" }[slot] || "TODAY";
  const text = [
    ...(drops.length ? ["PRICE DROPS", ...drops, ""] : []),
    ...(warnings.length ? [...warnings, ""] : []),
    ...(summary && lines.length ? [when, ...lines, ""] : drops.length && !morning ? [`Checked ${slot === "evening" ? "this evening" : "this afternoon"}.`, ""] : []),
    "Always confirm on the hotel's site before you change your booking.",
  ].join("\n");
  return { msg: { title, text, url }, changed, drops: drops.length };
}
