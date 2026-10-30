// RateRaven price check (runs 7:10am, 1:10pm and 7:10pm Central).
//   node run.mjs                 → ask the site what to check, check it, send results back
//   node run.mjs --probe hotel=portofino date=2026-12-10 rate=ap adults=2 nights=1
//                                → test one search, save a screenshot + what was found
//
// Needs two settings (GitHub → Settings → Secrets → Actions):
//   SITE_URL        e.g. https://rateraven.netlify.app
//   SCRAPER_SECRET  same value you put on Netlify
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { buildUrl, readPageInBrowser, readJson, summarize, siteOf, byHotel } from "./extract.mjs";
import { learnSite } from "./learn.mjs";

const SITE = (process.env.SITE_URL || "https://rateraven.netlify.app").replace(/\/$/, "");
const SECRET = process.env.SCRAPER_SECRET || "";
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split(/=(.*)/s).slice(0, 2)));
const PROBE = process.argv.includes("--probe");
const LEARN = process.argv.includes("--learn") || process.env.LEARN === "true";
const FORCE = process.argv.includes("--force") || process.env.FORCE_RUN === "true";
const OUT = "probe-output";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, opts = {}) {
  if (!SITE || !SECRET) throw new Error("SITE_URL and SCRAPER_SECRET must be set.");
  const res = await fetch(SITE + path, {
    ...opts,
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

async function newBrowser() {
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  await context.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
  return { browser, context };
}

/* Speed: skip pictures, fonts, video and tracking scripts — we only need prices. */
const SKIP_TYPES = new Set(["image", "media", "font"]);
const SKIP_HOSTS = /(google-analytics|googletagmanager|doubleclick|facebook|fbcdn|hotjar|clarity\.ms|tiktok|pinterest|bing\.com|adsrvr|criteo|quantserve|scorecardresearch|optimizely|newrelic|nr-data|segment\.io|branch\.io|qualtrics|medallia|yahoo|snapchat|twitter|linkedin)/i;

/* One reusable browser tab per worker (much faster than opening a new tab every search). */
async function makeTab(context, { pictures = false } = {}) {
  const page = await context.newPage();
  const tab = { page, payloads: [] };
  await page.route("**/*", (r) => {
    const req = r.request();
    if ((!pictures && SKIP_TYPES.has(req.resourceType())) || SKIP_HOSTS.test(req.url())) return r.abort();
    return r.continue();
  });
  page.on("response", async (res) => {
    try {
      const ct = res.headers()["content-type"] || "";
      if (ct.includes("json") && Number(res.headers()["content-length"] || 0) < 3e6) tab.payloads.push(await res.json());
    } catch {}
  });
  return tab;
}

/* Waits only as long as needed: until prices (or "sold out") show up and stop changing. */
async function waitForPrices(page) {
  await page.waitForFunction(
    () => /\$\s?\d{2,}/.test(document.body?.innerText || "") || /sold out|no availability|no rooms|access denied|verify you are human/i.test(document.body?.innerText || ""),
    null, { timeout: 30000, polling: 250 },
  ).catch(() => {});
  let last = -1;
  for (let n = 0; n < 8; n++) {
    const count = await page.evaluate(() => (document.body?.innerText.match(/\$\s?\d{2,}/g) || []).length).catch(() => 0);
    if (count === last) break;
    last = count;
    await sleep(600);
  }
}

/* Check one search page. */
async function check(tab, cfg, l, { screenshot = false } = {}) {
  const { page } = tab;
  tab.payloads = [];
  const started = Date.now();
  let url = null;
  try {
    url = buildUrl(cfg, l);
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const code = resp?.status() || 0;
    if (code === 429 || code === 403) return { ...l, status: "blocked", httpStatus: code, url, ms: Date.now() - started };
    const site = siteOf(cfg, l);
    const click = (site.rateClickText || {})[l.rate];
    if (click) {
      for (const part of click.split(">").map((x) => x.trim()).filter(Boolean)) {
        await page.getByText(part, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
        await sleep(700);
      }
    }
    await waitForPrices(page);
    const seen = await page.evaluate(readPageInBrowser, site.selectors || null);
    let rooms = seen.rooms;
    let source = "page";
    if (!rooms.length) { rooms = readJson(tab.payloads); source = "json"; }
    const best = summarize(rooms).pick(l.nights, null);
    const hotels = l.hotel === "*" ? byHotel(rooms, cfg.hotels || []) : null;
    const status = seen.blocked ? "blocked" : rooms.length ? "ok" : seen.soldOut ? "soldout" : "empty";
    const shot = screenshot ? (await page.screenshot({ type: "jpeg", quality: 55, fullPage: false })).toString("base64") : null;
    return {
      ...l, status, source, url,
      lowest: best ? Math.round(best.nightlyPrice * 100) / 100 : null,
      lowestRoom: best?.name || null,
      rooms: rooms.map((r) => ({ name: r.name, price: r.price, total: r.total, was: r.was, offers: r.offers })),
      hotels,
      ms: Date.now() - started,
      title: seen.title,
      shot,
      jsonCount: tab.payloads.length,
    };
  } catch (e) {
    return { ...l, status: "error", error: String(e.message || e).slice(0, 200), url, ms: Date.now() - started };
  }
}

/* -------- test one search -------- */
async function probe() {
  let cfg, settingsFromSite = true;
  try { cfg = (await api("/api/jobs?probe=1")).scraper; } catch (e) {
    settingsFromSite = false;
    cfg = JSON.parse(await fs.readFile(args.config || "local-config.json", "utf8"));
    log("Using local config (site not reachable):", e.message);
  }
  const l = {
    k: "probe", src: args.site || Object.keys(cfg.sources || {})[0], hotel: args.hotel || "portofino", rate: args.rate || "standard",
    checkIn: args.date || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    nights: Number(args.nights || 1), adults: Number(args.adults || 2),
  };
  const { browser, context } = await newBrowser();
  const tab = await makeTab(context, { pictures: true });
  const r = await check(tab, cfg, l, { screenshot: true });
  await browser.close();
  await fs.mkdir(OUT, { recursive: true });
  if (r.shot) await fs.writeFile(`${OUT}/screenshot.jpg`, Buffer.from(r.shot, "base64"));
  await fs.writeFile(`${OUT}/result.json`, JSON.stringify({ ...r, shot: undefined }, null, 2));
  log(`Status: ${r.status}. Rooms found: ${r.rooms?.length || 0}. Lowest: ${r.lowest ?? "—"} (${r.lowestRoom || ""})`);
  for (const room of (r.rooms || []).slice(0, 12)) log(`  • ${room.name}: ${room.price ?? "?"}${room.offers?.length ? "  [" + room.offers.join(" | ") + "]" : ""}`);
  if (r.error) log("Error:", r.error);
  if (settingsFromSite) await api("/api/ingest", { method: "POST", body: JSON.stringify({ probe: r }) }).catch((e) => log("Could not send test result:", e.message));
}

/* -------- auto-learn -------- */
async function learn(force = false) {
  const plan = await api(`/api/jobs?learn=1${force ? "&force=1" : ""}`);
  if (!plan.learn?.length) { log("Booking sites already learned."); return false; }
  const { browser, context } = await newBrowser();
  const tab = await makeTab(context, { pictures: true });
  let any = false;
  for (const site of plan.learn) {
    log(`Learning ${site.id} from ${site.startUrl}`);
    const report = await learnSite(tab.page, site, plan.hotels, log).catch((e) => ({ site: site.id, notes: [String(e.message || e)] }));
    await api("/api/ingest", { method: "POST", body: JSON.stringify({ learned: report }) }).catch((e) => log("Could not save what was learned:", e.message));
    if (report.config) any = true;
  }
  await browser.close();
  return any;
}

/* -------- daily run -------- */
async function daily() {
  // Teach itself the booking sites first, if they aren't set up yet (or Admin asked to relearn).
  await learn(LEARN).catch((e) => log("Learning step skipped:", e.message));
  const slotQ = process.env.FORCE_SLOT ? `&slot=${process.env.FORCE_SLOT}` : "";
  const jobs = await api(`/api/jobs${FORCE ? "?force=1" + slotQ : ""}`);
  if (jobs.skip) { log("Skipping:", jobs.skip); return; }
  const cfg = jobs.scraper;
  const list = jobs.lookups;
  log(`${jobs.slot} check ${jobs.runId}: ${list.length} searches (${jobs.watchCount} for watched rooms, rest for the calendar).`);

  const { browser, context } = await newBrowser();
  const concurrency = Math.max(1, Math.min(10, cfg.concurrency || 5));
  const results = [];
  const stats = { ok: 0, soldout: 0, empty: 0, blocked: 0, error: 0 };
  let i = 0, blockedInARow = 0, stop = false;
  const startedAt = Date.now();
  const deadline = startedAt + (Number(process.env.MAX_MINUTES || 300) * 60e3);

  let sending = Promise.resolve();
  const flush = (final = false) => {
    if (!results.length && !final) return sending;
    const batch = results.splice(0, results.length).map(({ shot, ...r }) => r);
    sending = sending.then(() => api("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ runId: jobs.runId, results: batch, final: final ? { stats, minutes: Math.round((Date.now() - startedAt) / 6e4), total: list.length } : null }),
    })).catch((e) => log("Send failed:", e.message));
    return sending;
  };

  // Politeness that adjusts itself: speeds up when the site is happy, slows down when it isn't.
  let pause = 900;
  async function worker(w) {
    let tab = await makeTab(context);
    let used = 0;
    await sleep(w * 700); // stagger the start
    while (!stop && i < list.length && Date.now() < deadline) {
      const l = list[i++];
      if (++used % 60 === 0) { await tab.page.close().catch(() => {}); tab = await makeTab(context); } // fresh tab now and then
      let r = await check(tab, cfg, l);
      if ((r.status === "error" && r.url) || r.status === "empty") { await sleep(3000); r = await check(tab, cfg, l); }
      if (r.status === "blocked") pause = Math.min(pause * 2, 30000);
      else pause = Math.max(600, pause * 0.95);
      stats[r.status] = (stats[r.status] || 0) + 1;
      blockedInARow = r.status === "blocked" ? blockedInARow + 1 : 0;
      if (blockedInARow >= 8) { stop = true; log("The hotel site is blocking us. Stopping early so we don't make it worse."); }
      results.push(r);
      if (results.length >= 150) flush();
      if ((stats.ok + stats.soldout + stats.empty + stats.error + stats.blocked) % 50 === 0) log(`…${i}/${list.length}`, JSON.stringify(stats));
      await sleep(pause + Math.random() * pause);
    }
    await tab.page.close().catch(() => {});
  }
  await Promise.all(Array.from({ length: concurrency }, (_, w) => worker(w)));
  await browser.close();
  stats.blockedStop = stop;
  stats.unfinished = Math.max(0, list.length - i);
  await flush(true);
  await sending;
  log("Prices saved.", JSON.stringify(stats));

  // Now send everyone their morning message, 25 people at a time.
  let cursor = 0, sent = 0, drops = 0;
  while (cursor != null) {
    const r = await api(`/api/notify?cursor=${cursor}&slot=${jobs.slot || "morning"}`, { method: "POST" }).catch((e) => { log("Alert step failed:", e.message); return { next: null }; });
    sent += r.sent || 0; drops += r.drops || 0;
    cursor = r.next;
  }
  log(`Done. Messages sent: ${sent}. Price drops found: ${drops}.`);
}

(PROBE ? probe() : daily()).catch((e) => { console.error(e); process.exit(1); });
