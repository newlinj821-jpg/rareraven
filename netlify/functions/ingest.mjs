// Receives prices from the scraper and saves them.
import { store, getSettings, saveSettings, json, bad, body, requireSecret, todayCT, boardAdults, lookupKey } from "./_lib/core.mjs";
import { buildReport } from "./_lib/report.mjs";

export default async (req) => {
  const st = await store();
  const b = await body(req.clone());
  // Error reports are let through even without the secret, so a wrong secret can still be explained on Admin.
  if (b.runError) {
    const last = await st.get("runs/error");
    if (last && Date.now() - Date.parse(last.at) < 60e3) return json({ ok: true });
    const e = b.runError;
    await st.set("runs/error", { message: String(e.message || "").slice(0, 400), hint: String(e.hint || "").slice(0, 200), mode: String(e.mode || "").slice(0, 10), at: new Date().toISOString(), trusted: requireSecret(req, "SCRAPER_SECRET") });
    return json({ ok: true });
  }
  if (!requireSecret(req, "SCRAPER_SECRET")) return bad("Not allowed", 401);

  if (b.learned) {
    const r = b.learned;
    await st.set(`learn/report-${r.site}`, { at: new Date().toISOString(), ...r });
    if (r.config) await saveSettings({ scraper: { sources: { [r.site]: { ...r.config, relearn: false } } } });
    else await saveSettings({ scraper: { sources: { [r.site]: { relearn: false } } } });
    return json({ ok: true, saved: !!r.config });
  }

  if (b.probe) {
    await st.set("runs/probe", { at: new Date().toISOString(), result: b.probe });
    return json({ ok: true });
  }

  const s = await getSettings();
  const today = todayCT();
  const now = new Date().toISOString();
  const boardFiles = new Map();
  const getBoard = async (key) => {
    if (!boardFiles.has(key)) boardFiles.set(key, (await st.get(key)) || {});
    return boardFiles.get(key);
  };

  // A listing-page search ("*") holds every hotel: split it into one result per hotel.
  const expand = (r) => {
    if (r.hotel !== "*") return [r];
    if (r.status !== "ok") return [];
    return Object.entries(r.hotels || {}).map(([hotel, h]) => ({
      ...r, hotel, status: "ok", lowest: h.price, lowestRoom: h.name,
      rooms: [{ name: h.name, price: h.price, was: h.was || null, offers: h.offers || [] }],
    }));
  };
  const FRESH = 36 * 3600e3;
  const fresh = (c) => c?.t && Date.now() - Date.parse(c.t) < FRESH;

  for (const r of (b.results || []).flatMap(expand)) {
    const good = r.status === "ok" || r.status === "soldout";
    const src = r.src || "site";
    const lowestRoom = (r.rooms || []).find((x) => x.name === r.lowestRoom);

    // Calendar cell (1-night searches for the calendar's rate types and adult counts).
    // Each booking site keeps its own price; the cell shows the cheapest fresh one.
    if (r.nights === 1 && s.boardRates.includes(r.rate) && s.boardAdults.includes(boardAdults(r.adults))) {
      const key = `board/${r.rate}/${boardAdults(r.adults)}/${r.checkIn.slice(0, 7)}`;
      const file = await getBoard(key);
      const day = (file[r.checkIn] ||= {});
      const old = day[r.hotel] || {};
      if (good) {
        const by = { ...(old.by || {}) };
        by[src] = {
          p: r.status === "soldout" ? null : r.lowest,
          r: r.lowestRoom || null, o: lowestRoom?.offers?.slice(0, 3) || [], was: lowestRoom?.was || null,
          n: (r.rooms || []).length, s: r.status, t: now,
        };
        const live = Object.entries(by).filter(([, c]) => fresh(c));
        const priced = live.filter(([, c]) => c.p != null).sort((x, y) => x[1].p - y[1].p);
        const [via, c] = priced[0] || live[0];
        const p = priced.length ? c.p : null;
        day[r.hotel] = {
          p,                       // lowest nightly price right now
          r: c.r, o: c.o, was: c.was, n: c.n,
          s: priced.length ? "ok" : "soldout",
          via,                     // which booking site had it
          by,
          t: now,
          prev: old.p !== p ? old.p ?? null : old.prev ?? null,
          ch: old.p != null && p != null && old.p !== p ? now : old.ch || null, // when it last changed
          low: p != null ? Math.min(p, old.low ?? Infinity) : old.low ?? null,
          high: p != null ? Math.max(p, old.high ?? -Infinity) : old.high ?? null,
        };
      } else if (old.t) {
        old.err = r.status; // keep the old price; note the failed check
      }
    }

    // Watched rooms: keep every room's price for each check (for price history), from every site.
    if (r.w && good) {
      const pk = `prices/${encodeURIComponent(lookupKey(r))}`;
      const rec = (await st.get(pk)) || { days: [] };
      rec.bySrc ||= {};
      rec.bySrc[src] = { rooms: (r.rooms || []).map((x) => ({ ...x, site: src })), status: r.status, checked: now, url: r.url };
      const live = Object.values(rec.bySrc).filter((x) => fresh({ t: x.checked }));
      rec.rooms = live.flatMap((x) => x.rooms);
      rec.status = live.some((x) => x.status === "ok") ? "ok" : "soldout";
      rec.checked = now;
      const cheapest = live.map((x) => ({ x, p: Math.min(...x.rooms.map((y) => y.price ?? Infinity)) })).sort((a, b) => a.p - b.p)[0];
      rec.url = cheapest?.x.url || r.url;
      const entry = { d: today, s: rec.status, rooms: Object.fromEntries(rec.rooms.map((x) => [x.name, x.price ?? (x.total != null ? Math.round((x.total / r.nights) * 100) / 100 : null)])) };
      rec.days = [...(rec.days || []).filter((x) => x.d !== today), entry].slice(-400);
      await st.set(pk, rec);
    }
  }

  for (const [key, file] of boardFiles) await st.set(key, file);

  if (b.final) {
    const cur = (await st.get("runs/current")) || {};
    const last = { ...cur, runId: b.runId, finished: now, ...b.final, notified: false };
    await st.set("runs/last", last);
    if (cur.slot) await st.set(`runs/done/${today}-${cur.slot}`, { finished: now });
    await st.set("report/latest", await buildReport(st, s, today, now, cur.slot, (await st.get("report/latest")) || null));
    const hist = ((await st.get("runs/history")) || []).filter((x) => x.runId !== b.runId);
    hist.push({ runId: b.runId, date: last.date, finished: now, ...b.final });
    await st.set("runs/history", hist.slice(-60));
  }
  return json({ ok: true, saved: (b.results || []).length });
};
export const config = { path: "/api/ingest" };
