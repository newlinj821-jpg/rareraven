// Receives prices from the morning scraper and saves them.
import { store, getSettings, json, bad, body, requireSecret, todayCT, boardAdults } from "./_lib/core.mjs";
import { buildReport } from "./_lib/report.mjs";

export default async (req) => {
  if (!requireSecret(req, "SCRAPER_SECRET")) return bad("Not allowed", 401);
  const st = await store();
  const b = await body(req);

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

  for (const r of b.results || []) {
    const good = r.status === "ok" || r.status === "soldout";
    const lowestRoom = (r.rooms || []).find((x) => x.name === r.lowestRoom);

    // Calendar cell (1-night searches for the calendar's rate types and adult counts)
    if (r.nights === 1 && s.boardRates.includes(r.rate) && s.boardAdults.includes(boardAdults(r.adults))) {
      const key = `board/${r.rate}/${boardAdults(r.adults)}/${r.checkIn.slice(0, 7)}`;
      const file = await getBoard(key);
      const day = (file[r.checkIn] ||= {});
      const old = day[r.hotel] || {};
      if (good) {
        const p = r.status === "soldout" ? null : r.lowest;
        day[r.hotel] = {
          p,                                       // lowest nightly price today
          r: r.lowestRoom || null,                 // which room
          o: lowestRoom?.offers?.slice(0, 3) || [],// discount labels shown
          was: lowestRoom?.was || null,            // struck-out price, if any
          n: (r.rooms || []).length,               // rooms available
          s: r.status,
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

    // Watched rooms: keep every room's price for each day (for price history)
    if (r.w && good) {
      const pk = `prices/${encodeURIComponent(r.k)}`;
      const rec = (await st.get(pk)) || { k: r.k, days: [] };
      rec.rooms = r.rooms || [];
      rec.status = r.status;
      rec.checked = now;
      rec.url = r.url;
      const entry = { d: today, s: r.status, rooms: Object.fromEntries((r.rooms || []).map((x) => [x.name, x.price ?? (x.total != null ? Math.round((x.total / r.nights) * 100) / 100 : null)])) };
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
