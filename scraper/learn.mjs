// Auto-learner: works out how a booking site's search links work, by itself.
// It opens the site's hotel list, tries the usual ways sites put dates, guests and
// discount codes in the address, and keeps whatever makes real Universal hotel prices appear.
// Nothing is guessed silently: every attempt is logged and shown on the Admin page.
import { readPageInBrowser, byHotel, fmtDate } from "./extract.mjs";

const DATE_FORMATS = ["YYYY-MM-DD", "MM/DD/YYYY", "YYYYMMDD", "MM-DD-YYYY"];
const DATE_PAIRS = [
  ["checkIn", "checkOut"], ["checkin", "checkout"], ["checkInDate", "checkOutDate"], ["check_in", "check_out"],
  ["arrival", "departure"], ["arrivalDate", "departureDate"], ["arrive", "depart"], ["arrivalDateString", "departureDateString"],
  ["startDate", "endDate"], ["start", "end"], ["from", "to"], ["fromDate", "toDate"], ["dateFrom", "dateTo"],
  ["dateIn", "dateOut"], ["inDate", "outDate"], ["ci", "co"], ["sd", "ed"],
];
const ADULT_NAMES = ["adults", "numAdults", "adultCount", "numberOfAdults", "adult", "guests", "numberOfGuests"];
const RATES = {
  ap: { words: /passholder|annual pass/i, labels: ["Annual Passholder", "Passholder"], values: ["AP", "UAP", "APH", "PASSHOLDER", "ANNUALPASS", "APR"] },
  florida: { words: /florida resident/i, labels: ["Florida Resident", "Florida"], values: ["FL", "FLR", "FLRES", "FLORIDA", "FLA"] },
  military: { words: /military/i, labels: ["Military"], values: ["MIL", "MILITARY", "GOV", "ARMED"] },
};
const RATE_PARAMS = ["offer", "offerCode", "promo", "promoCode", "rateCode", "rate", "ratePlan", "specialRate", "specialRateCode", "code", "group", "segment", "discount"];

const addDays = (iso, n) => { const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function learnSite(page, site, hotels, log) {
  const report = { site: site.id, startedAt: new Date().toISOString(), tries: [], found: null, rates: {}, notes: [] };
  const note = (m) => { report.notes.push(m); log(m); };

  async function look(url) {
    const t0 = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForFunction(() => /\$\s?\d{2,}/.test(document.body?.innerText || ""), null, { timeout: 20000, polling: 300 }).catch(() => {});
      await sleep(1500);
      const seen = await page.evaluate(readPageInBrowser, null);
      const found = byHotel(seen.rooms, hotels);
      const text = await page.evaluate(() => document.body?.innerText || "");
      const res = { url, finalUrl: page.url(), http: resp?.status() || 0, blocked: seen.blocked, hotels: found, count: Object.keys(found).length, text, ms: Date.now() - t0 };
      report.tries.push({ url, http: res.http, blocked: res.blocked, hotels: res.count });
      return res;
    } catch (e) {
      report.tries.push({ url, error: String(e.message || e).slice(0, 120) });
      return { url, count: 0, hotels: {}, text: "", error: e };
    }
  }

  // 1) Open the start page and see which words the site itself uses. Give its scripts time to finish.
  const start = await look(site.startUrl);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await sleep(3000);
  const startText = (await page.evaluate(() => document.body?.innerText || "").catch(() => "")).trim();
  report.startShot = (await page.screenshot({ type: "jpeg", quality: 50 }).catch(() => null))?.toString("base64");
  note(`Opened ${page.url()} (status ${start.http || "?"}). The page shows ${startText.length} characters of text${startText ? `, starting: "${startText.replace(/\s+/g, " ").slice(0, 140)}"` : ", so it looks blank to an automated browser"}.`);
  if (!startText || /access denied|request unsuccessful|captcha|verify you are human|pardon our interruption/i.test(startText)) {
    report.blocked = true;
    note("This site isn't showing its page to automated browsers. RateRaven doesn't try to get around that.");
    return report;
  }
  if (start.blocked || start.http === 403 || start.http === 429) {
    note("The site blocked the automatic browser on the very first page. It may only allow visits from home internet connections.");
    report.screenshot = (await page.screenshot({ type: "jpeg", quality: 50 }).catch(() => null))?.toString("base64");
    return report;
  }
  const html = await page.content().catch(() => "");
  const uses = (name) => html.includes(`"${name}"`) || html.includes(`${name}=`) || html.includes(`name="${name}"`);
  const pairs = [...DATE_PAIRS].sort((a, b) => uses(b[0]) - uses(a[0]));
  const adultsName = ADULT_NAMES.find(uses) || "adults";
  note(`Start page loaded (${start.count} Universal hotels with prices before any dates). Trying ${pairs.length * DATE_FORMATS.length} date styles…`);

  // 2) Try each way of putting dates in the address until hotel prices show up.
  const A = addDays(today(), 24), B = addDays(A, 2), C = addDays(today(), 52), D = addDays(C, 2);
  const base = new URL(start.finalUrl || site.startUrl);
  const make = (pair, fmt, a, b) => {
    const u = new URL(base);
    u.searchParams.set(pair[0], fmtDate(a, fmt));
    u.searchParams.set(pair[1], fmtDate(b, fmt));
    u.searchParams.set(adultsName, "2");
    return u.toString();
  };
  let winner = null;
  outer: for (const pair of pairs) {
    for (const fmt of DATE_FORMATS) {
      const r = await look(make(pair, fmt, A, B));
      if (r.blocked) { note("The site started blocking during learning. Stopping to be polite."); break outer; }
      if (r.count >= 3) {
        // Make sure the dates really changed the results (not just a default page).
        const r2 = await look(make(pair, fmt, C, D));
        const differs = Object.keys(r.hotels).some((h) => r2.hotels[h] && r2.hotels[h].price !== r.hotels[h].price);
        const showsDate = new RegExp(new Date(A + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).replace(" ", "\\s*"), "i").test(r.text);
        if (differs || showsDate || r.count > start.count) { winner = { pair, fmt, r }; break outer; }
      }
      await sleep(400);
    }
  }
  if (!winner) {
    note("Couldn't find how this site puts dates in its address. A screenshot is saved for a closer look.");
    report.screenshot = (await page.screenshot({ type: "jpeg", quality: 50 }).catch(() => null))?.toString("base64");
    return report;
  }
  const tpl = new URL(base);
  tpl.searchParams.set(winner.pair[0], "{checkIn}");
  tpl.searchParams.set(winner.pair[1], "{checkOut}");
  tpl.searchParams.set(adultsName, "{adults}");
  const urlTemplate = tpl.toString().replace(/%7B(\w+)%7D/gi, "{$1}");
  report.found = { urlTemplate, dateFormat: winner.fmt, hotels: Object.keys(winner.r.hotels) };
  note(`Found it: dates go in "${winner.pair.join('" and "')}" as ${winner.fmt}. ${winner.r.count} Universal hotels with prices.`);

  // 3) Discount rates: try the usual codes in the address, then try clicking the site's own buttons.
  const stdPrices = winner.r.hotels;
  const stdText = winner.r.text;
  const baseUrl = make(winner.pair, winner.fmt, A, B);
  const rateParams = { standard: {} }, rateClickText = {};
  for (const [rate, def] of Object.entries(RATES)) {
    const wordAlreadyThere = def.words.test(stdText);
    const worked = (r) => {
      if (r.count < 2) return false;
      const cheaper = Object.keys(r.hotels).some((h) => stdPrices[h] && r.hotels[h].price < stdPrices[h].price);
      return (!wordAlreadyThere && def.words.test(r.text)) || cheaper;
    };
    let got = null;
    for (const p of RATE_PARAMS) {
      for (const v of def.values) {
        const u = new URL(baseUrl); u.searchParams.set(p, v);
        const r = await look(u.toString());
        if (r.blocked) break;
        if (worked(r)) { got = { [p]: v }; break; }
      }
      if (got) break;
    }
    if (got) { rateParams[rate] = got; report.rates[rate] = `address code ${Object.entries(got)[0].join("=")}`; note(`${def.labels[0]} rate: found code ${Object.entries(got)[0].join("=")}.`); continue; }

    // Try the page's own controls: e.g. "Special Rates" → "Annual Passholder".
    await look(baseUrl);
    for (const opener of ["Special Rates", "Special Rate", "Discounts", "Offers", "Rate Type", "Promo Code", ""]) {
      for (const label of def.labels) {
        try {
          if (opener) await page.getByText(opener, { exact: false }).first().click({ timeout: 2500 });
          await page.getByText(label, { exact: false }).first().click({ timeout: 2500 });
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await sleep(1500);
          const seen = await page.evaluate(readPageInBrowser, null);
          const r = { count: Object.keys(byHotel(seen.rooms, hotels)).length, hotels: byHotel(seen.rooms, hotels), text: await page.evaluate(() => document.body?.innerText || "") };
          if (worked(r)) {
            const after = new URL(page.url()), before = new URL(baseUrl), diff = {};
            for (const [k, v] of after.searchParams) if (before.searchParams.get(k) !== v && !winner.pair.includes(k)) diff[k] = v;
            if (Object.keys(diff).length) { rateParams[rate] = diff; report.rates[rate] = `address code ${Object.entries(diff).map((x) => x.join("=")).join(", ")}`; }
            else { rateClickText[rate] = opener ? `${opener}>${label}` : label; report.rates[rate] = `clicks "${rateClickText[rate]}"`; }
            got = true;
            note(`${def.labels[0]} rate: works by ${report.rates[rate]}.`);
            break;
          }
        } catch {}
        await look(baseUrl);
      }
      if (got) break;
    }
    if (!got) { report.rates[rate] = "not found"; note(`${def.labels[0]} rate: couldn't find it automatically.`); }
  }

  report.config = { enabled: true, urlTemplate, dateFormat: winner.fmt, hotelCodes: {}, rateParams, rateClickText, learnedAt: new Date().toISOString() };
  report.screenshot = (await page.screenshot({ type: "jpeg", quality: 50 }).catch(() => null))?.toString("base64");
  return report;
}
