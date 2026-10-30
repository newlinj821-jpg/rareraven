// Tells the scraper what to check this time. It runs three times a day:
// morning (7:10am Central), afternoon (1:10pm) and evening (7:10pm).
// Watched rooms always come first. Two people watching the same room = one search.
// Then the calendar: closer dates are refreshed more often than far-away ones.
import { store, getSettings, json, bad, requireSecret, todayCT, addDays, daysBetween, lookupKey, boardAdults, planOf, rid, HOTELS, catalog, activeSources, sourcesFor, isListing } from "./_lib/core.mjs";

// How often each calendar cell should be refreshed, by how far away the date is.
// The next two weeks are refreshed at every check; the rest once a day or less.
const intervalDays = (daysOut) => (daysOut <= 14 ? 0.2 : daysOut <= 30 ? 1 : daysOut <= 90 ? 3 : daysOut <= 180 ? 7 : 14);

export const SLOTS = ["morning", "afternoon", "evening"];
// 7am–12:59 = morning, 1pm–6:59 = afternoon, 7pm–11:59 = evening (Central time)
const slotFor = (h) => (h >= 19 ? "evening" : h >= 13 ? "afternoon" : h >= 7 ? "morning" : null);

export default async (req) => {
  if (!requireSecret(req, "SCRAPER_SECRET")) return bad("Not allowed", 401);
  const u = new URL(req.url);
  const s = await getSettings();
  if (u.searchParams.get("learn")) {
    // Which booking sites still need teaching? (Not set up yet, or Admin asked to learn again.)
    const st0 = await store();
    const force0 = u.searchParams.get("force") === "1";
    const learn = [];
    for (const [id, src] of Object.entries(s.scraper.sources || {})) {
      if (src.enabled === false || !src.startUrl) continue;
      if (src.urlTemplate && !src.relearn && !force0) continue;
      const last = await st0.get(`learn/last-${id}`);
      if (!force0 && !src.relearn && last && Date.now() - Date.parse(last.at) < 20 * 3600e3) continue; // tried recently
      learn.push({ id, startUrl: src.startUrl });
      await st0.set(`learn/last-${id}`, { at: new Date().toISOString() });
    }
    return json({ learn, hotels: catalog.hotels });
  }
  if (u.searchParams.get("probe")) return json({ scraper: { ...s.scraper, sources: Object.fromEntries(activeSources(s)), hotels: catalog.hotels } });

  const st = await store();
  const today = todayCT();
  const force = u.searchParams.get("force") === "1";
  const hourCT = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  // A run started by hand always runs, even overnight (it counts as the morning check).
  const slot = SLOTS.includes(u.searchParams.get("slot")) && force ? u.searchParams.get("slot") : slotFor(hourCT) || (force ? "morning" : null);
  if (!slot) return json({ skip: "Too early — the first check is at 7am Central." });
  if (!s.checks?.[slot]) return json({ skip: `The ${slot} check is switched off (Admin → Calendar).` });
  const done = await st.get(`runs/done/${today}-${slot}`);
  if (!force && done) return json({ skip: `Already did the ${slot} check today.` });
  if (!activeSources(s).length) return json({ skip: "Scraper isn't set up yet (Admin → Scraper setup)." });

  // One search per booking site. Two people watching the same room still share it.
  const lookups = new Map();
  const add = (l, watch) => {
    for (const src of sourcesFor(s, l.hotel, l.rate)) {
      const hotel = isListing(s.scraper.sources[src]) ? "*" : l.hotel; // one search covers every hotel
      const k = `${src}|${lookupKey({ ...l, hotel })}`;
      const have = lookups.get(k);
      if (have) { if (watch) have.w = 1; continue; }
      lookups.set(k, { k, src, hotel, rate: l.rate, checkIn: l.checkIn, nights: l.nights, adults: boardAdults(l.adults), ...(watch ? { w: 1 } : {}) });
    }
  };

  // 1) Watched rooms
  let watchCount = 0;
  for (const keyName of await st.list("keys/")) {
    const key = await st.get(keyName);
    if (!key) continue;
    const plan = planOf(key, s);
    for (const w of key.watches || []) {
      if (w.paused || w.checkIn < today) continue;
      if (plan.windowDays && daysBetween(today, w.checkIn) > plan.windowDays) continue;
      if (!HOTELS[w.hotel] || !sourcesFor(s, w.hotel, w.rate).length) continue;
      watchCount++;
      add(w, true);
    }
  }
  const watchLookups = lookups.size;

  // 2) Calendar cells, most overdue first
  const cells = [];
  const end = addDays(today, s.boardDays - 1);
  const months = [];
  for (let d = today.slice(0, 7); d <= end.slice(0, 7); ) {
    months.push(d);
    const [y, m] = d.split("-").map(Number);
    d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const now = Date.now();
  for (const rate of s.boardRates) {
    for (const adults of s.boardAdults) {
      for (const month of months) {
        const file = (await st.get(`board/${rate}/${adults}/${month}`)) || {};
        const [y, m] = month.split("-").map(Number);
        const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
        for (let day = 1; day <= dim; day++) {
          const date = `${month}-${String(day).padStart(2, "0")}`;
          if (date < today || date > end) continue;
          const out = daysBetween(today, date);
          for (const h of catalog.hotels) {
            if (!sourcesFor(s, h.id, rate).length) continue; // no site can check this hotel at this rate yet
            const cell = file[date]?.[h.id];
            const ageDays = cell?.t ? (now - Date.parse(cell.t)) / 864e5 : Infinity;
            const due = ageDays / intervalDays(out);
            if (due < 0.9) continue;
            // never-checked cells first (closest dates first), then the most overdue
            const priority = Number.isFinite(due) ? due : 1000 - out / 10;
            cells.push({ priority, l: { hotel: h.id, rate, checkIn: date, nights: 1, adults } });
          }
        }
      }
    }
  }
  cells.sort((a, b) => b.priority - a.priority);
  const budget = Math.max(0, (slot === "morning" ? s.dailyBudget : s.extraBudget) - lookups.size);
  for (const c of cells) {
    if (lookups.size >= watchLookups + budget) break;
    add(c.l, false);
  }

  // Mix hotels together so no single hotel page gets hit many times in a row.
  const list = [...lookups.values()];
  const watched = list.filter((l) => l.w);
  const rest = list.filter((l) => !l.w).sort((a, b) => (a.checkIn + a.hotel < b.checkIn + b.hotel ? -1 : 1));

  const runId = `${today}-${slot}-${rid(4)}`;
  await st.set("runs/current", { runId, date: today, slot, startedAt: new Date().toISOString(), total: list.length, watchCount });
  return json({
    runId, slot,
    scraper: { ...s.scraper, sources: Object.fromEntries(activeSources(s)), hotels: catalog.hotels },
    lookups: [...watched, ...rest],
    watchCount,
    calendarDue: cells.length,
  });
};
export const config = { path: "/api/jobs" };
