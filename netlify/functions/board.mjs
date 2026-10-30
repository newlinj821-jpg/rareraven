import { store, json, bad, RATES, boardAdults } from "./_lib/core.mjs";

// Calendar data for one month: /api/board?rate=ap&adults=2&month=2026-12
// Returns { days: { "2026-12-01": { portofino: { p, prev, low, t, s }, ... } } }
export default async (req) => {
  const u = new URL(req.url);
  const rate = u.searchParams.get("rate") || "standard";
  const adults = boardAdults(u.searchParams.get("adults") || 2);
  const month = u.searchParams.get("month") || "";
  if (!RATES[rate]) return bad("Unknown rate type");
  if (!/^\d{4}-\d{2}$/.test(month)) return bad("month must look like 2026-12");
  const days = (await (await store()).get(`board/${rate}/${adults}/${month}`)) || {};
  return json({ rate, adults, month, days }, 200, { "cache-control": "public, max-age=300" });
};
export const config = { path: "/api/board" };
