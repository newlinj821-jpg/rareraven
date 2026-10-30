import { catalog, store, getSettings, json, salesOn, emailAvailable, stripeAvailable, todayCT } from "./_lib/core.mjs";

// Public info the pages need: hotels, rate types, whether sales/email are on.
export default async () => {
  const s = await getSettings();
  const sales = salesOn(s);
  return json({
    siteName: s.siteName,
    notice: s.notice,
    hotels: catalog.hotels,
    rateTypes: catalog.rateTypes,
    boardRates: s.boardRates,
    boardAdults: s.boardAdults,
    boardDays: s.boardDays,
    email: emailAvailable(s),
    sales: sales ? {
      price: s.passPriceCents, days: s.passDays,
      freeLimit: s.freeWatchLimit, passLimit: s.passWatchLimit, freeWindowDays: s.freeWindowDays,
    } : null,
    tip: s.tipEnabled && (s.tipUrl || stripeAvailable()) ? { url: s.tipUrl || null, message: s.tipMessage, amounts: s.tipAmounts } : null,
    watchLimit: sales ? s.freeWatchLimit : s.passWatchLimit,
    lastRun: (await (await store()).get("runs/last")) || null,
    today: todayCT(),
  });
};
export const config = { path: "/api/config" };
