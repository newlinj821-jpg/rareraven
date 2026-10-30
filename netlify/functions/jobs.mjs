// Tells the scraper what to check this time. It runs three times a day:
// morning (7:10am Central), afternoon (1:10pm) and evening (7:10pm).
// Watched rooms always come first. Two people watching the same room = one search.
// Then the calendar: closer dates are refreshed more often than far-away ones.
import { store, getSettings, json, bad, requireSecret, todayCT, addDays, daysBetween, lookupKey, boardAdults, planOf, rid, HOTELS, catalog } from "./_lib/core.mjs";

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
  if (u.searchParams.get("probe")) return json({ scraper: s.scraper });

  const st = await store();
  const today = todayCT();
  const force = u.searchParams.get("force") === "1";
  const hourCT = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const slot = SLOTS.includes(u.searchParams.get("slot")) && force ? u.searchParams.get("slot") : slotFor(hourCT);
  if (!slot) return json({ skip: "Too early — the first check is at 7am Central." });
  if (!s.checks?.[slot]) return json({ skip: `The ${slot} check is switched off (Admin → Calendar).` });
  const done = await st.get(`runs/done/${today}-${slot}`);
  if (!force && done) return json({ skip: `Already did the ${slot} check today.` });
  if (!s.scraper.urlTemplate) return json({ skip: "Scraper isn't set up yet (Admin → Scraper setup)." });

  const lookups = new Map();
  const add = (l, watch) => {
    const k = lookupKey(l);
    const have = lookups.get(k);
    if (have) { if (watch) have.w = 1; return; }
    lookups.set(k, { k, hotel: l.hotel, rate: l.rate, checkIn: l.checkIn, nights: l.nights, adults: boardAdults(l.adults), ...(watch ? { w: 1 } : {}) });
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
      if (!HOTELS[w.hotel] || !s.scraper.hotelCodes?.[w.hotel]) continue;
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
            if (!s.scraper.hotelCodes?.[h.id]) continue; // hotel not set up yet
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
    scraper: s.scraper,
    lookups: [...watched, ...rest],
    watchCount,
    calendarDue: cells.length,
  });
};
export const config = { path: "/api/jobs" };
