// The Raven's Report: a short briefing written after every check.
// Biggest drops since the last check, how much moved, the cheapest Express night,
// the cheapest night in each hotel tier, and which discount is winning.
import { addDays, catalog, HOTELS } from "./core.mjs";

export async function buildReport(st, s, today, now, slot, prevReport) {
  const adults = s.boardAdults[0] ?? 2;
  const end = addDays(today, 120);
  const months = [];
  for (let d = today.slice(0, 7); d <= end.slice(0, 7); ) {
    months.push(d);
    const [y, m] = d.split("-").map(Number);
    d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const since = prevReport?.at || addDays(today, -1) + "T00:00:00Z";
  const cells = []; // { rate, date, hotel, ...cell }
  for (const rate of s.boardRates) for (const m of months) {
    const file = (await st.get(`board/${rate}/${adults}/${m}`)) || {};
    for (const [date, hotels] of Object.entries(file)) {
      if (date < today || date > end) continue;
      for (const [hotel, c] of Object.entries(hotels)) if (HOTELS[hotel]) cells.push({ rate, date, hotel, ...c });
    }
  }

  const moved = cells.filter((c) => c.ch && c.ch > since && c.prev != null && c.p != null);
  const drops = moved.filter((c) => c.p < c.prev).sort((a, b) => b.prev - b.p - (a.prev - a.p));
  const rises = moved.filter((c) => c.p > c.prev);
  const pick = (c) => c && { hotel: c.hotel, date: c.date, rate: c.rate, p: c.p, prev: c.prev ?? null, room: c.r || null };

  const within = (days) => cells.filter((c) => c.p != null && c.date <= addDays(today, days));
  const cheapest = (list) => list.reduce((a, c) => (!a || c.p < a.p ? c : a), null);

  const express = cheapest(within(60).filter((c) => HOTELS[c.hotel].express));
  const tiers = [...new Set(catalog.hotels.map((h) => h.tier))].map((t) => ({ tier: t, ...pick(cheapest(within(30).filter((c) => HOTELS[c.hotel].tier === t))) })).filter((t) => t.hotel);

  // Which discount beats Standard by the most, on average, for the same hotel and night?
  const byKey = new Map();
  for (const c of within(60)) {
    const k = `${c.hotel}|${c.date}`;
    (byKey.get(k) || byKey.set(k, {}).get(k))[c.rate] = c.p;
  }
  const discountStats = s.boardRates.filter((r) => r !== "standard").map((rate) => {
    let n = 0, pct = 0, wins = 0;
    for (const v of byKey.values()) {
      if (v.standard == null || v[rate] == null) continue;
      n++; pct += 1 - v[rate] / v.standard;
      const others = s.boardRates.filter((r) => r !== rate && r !== "standard" && v[r] != null);
      if (others.every((o) => v[rate] <= v[o])) wins++;
    }
    return { rate, nights: n, avgOff: n ? Math.round((pct / n) * 100) : null, wins };
  }).filter((d) => d.nights);

  return {
    at: now, slot: slot || null, adults,
    checked: cells.filter((c) => c.t && c.t > since).length,
    changed: moved.length, dropCount: drops.length, riseCount: rises.length,
    drops: drops.slice(0, 5).map(pick),
    express: pick(express),
    tiers,
    discounts: discountStats.sort((a, b) => (b.avgOff ?? 0) - (a.avgOff ?? 0)),
  };
}
