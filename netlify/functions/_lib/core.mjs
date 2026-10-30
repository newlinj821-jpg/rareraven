// Shared helpers for every RateRaven function.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import catalog from "../../../shared/catalog.mjs";

export { catalog };
export const HOTELS = Object.fromEntries(catalog.hotels.map((h) => [h.id, h]));
export const RATES = Object.fromEntries(catalog.rateTypes.map((r) => [r.id, r]));

/* ---------------- storage ----------------
   On Netlify: Netlify Blobs (built in, nothing to set up).
   Locally (for testing): set LOCAL_STORE_DIR and it uses plain files. */
let _store;
export async function store() {
  if (_store) return _store;
  const dir = process.env.LOCAL_STORE_DIR;
  if (dir) {
    const file = (k) => path.join(dir, encodeURIComponent(k));
    _store = {
      async get(k) {
        try { return JSON.parse(await fs.readFile(file(k), "utf8")); } catch { return null; }
      },
      async set(k, v) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file(k), JSON.stringify(v)); },
      async del(k) { await fs.rm(file(k), { force: true }); },
      async list(prefix) {
        try {
          return (await fs.readdir(dir)).map(decodeURIComponent).filter((k) => k.startsWith(prefix));
        } catch { return []; }
      },
    };
  } else {
    const { getStore } = await import("@netlify/blobs");
    const s = getStore({ name: "rateraven", consistency: "strong" });
    _store = {
      get: (k) => s.get(k, { type: "json" }),
      set: (k, v) => s.setJSON(k, v),
      del: (k) => s.delete(k),
      async list(prefix) {
        const out = [];
        for await (const page of s.list({ prefix, paginate: true })) out.push(...page.blobs.map((b) => b.key));
        return out;
      },
    };
  }
  return _store;
}

/* ---------------- settings (editable on the Admin page) ---------------- */
function emptySource() {
  return {
    enabled: true, urlTemplate: "", dateFormat: "YYYY-MM-DD", hotelCodes: {},
    rateParams: { standard: {}, ap: {}, florida: {}, military: {} },
    rateClickText: { standard: "", ap: "", florida: "", military: "" },
  };
}
export const SOURCES = { universal: "Universal Orlando’s site", loews: "Loews Hotels’ site" };

export const DEFAULT_SETTINGS = {
  siteName: "RateRaven",
  notice: "",
  // Sales
  salesEnabled: false,
  passPriceCents: 1000,
  passDays: 365,
  freeWatchLimit: 1,        // rooms a free user can watch (when sales are on)
  passWatchLimit: 10,       // rooms a pass holder can watch (everyone gets this when sales are off)
  freeWindowDays: 0,        // 0 = free watches are checked any time. 30 = only in the last 30 days before arrival.
  // Tip jar
  tipEnabled: false,
  tipUrl: "",               // a Ko-fi / Buy Me a Coffee / PayPal / Venmo link. Empty = take tips with Stripe (if Stripe keys are added)
  tipMessage: "RateRaven is free and run by one person. If it saved you money, a tip helps cover the costs.",
  tipAmounts: [3, 5, 10],
  // Email (only works if RESEND_API_KEY is set on Netlify)
  emailEnabled: false,
  // Calendar
  boardDays: 365,
  boardRates: ["standard", "ap", "florida", "military"],
  boardAdults: [2, 4],
  dailyBudget: 7000,        // max hotel page lookups in the morning check (watched rooms always come first)
  extraBudget: 2000,        // max lookups in the afternoon and evening checks
  checks: { morning: true, afternoon: true, evening: true },
  // Scraper setup (filled in on the Admin page)
  // Scraper setup (filled in on the Admin page). Two booking sites can be checked;
  // the calendar shows whichever is cheaper and says where.
  scraper: {
    sources: {
      universal: { ...emptySource(), startUrl: "https://www.universalorlando.com/hotels/en/us/listing" },
      loews: { ...emptySource(), enabled: false, startUrl: "https://reservations.loewshotels.com/" },
    },
    concurrency: 5,
  },

};

export async function getSettings() {
  const s = await (await store()).get("settings");
  const out = deepMerge(structuredClone(DEFAULT_SETTINGS), s || {});
  // Older single-site setups become the Loews site.
  const sc = out.scraper;
  if (sc.urlTemplate && !sc.sources.loews.urlTemplate) {
    Object.assign(sc.sources.loews, { enabled: true, urlTemplate: sc.urlTemplate, dateFormat: sc.dateFormat || "YYYY-MM-DD", hotelCodes: sc.hotelCodes || {}, rateParams: sc.rateParams || {}, rateClickText: sc.rateClickText || {}, selectors: sc.selectors });
  }
  for (const k of ["urlTemplate", "dateFormat", "hotelCodes", "rateParams", "rateClickText", "selectors"]) delete sc[k];
  return out;
}

// The booking sites that are switched on and set up.
export const activeSources = (s) => Object.entries(s.scraper.sources || {}).filter(([, v]) => v.enabled !== false && v.urlTemplate).map(([id, v]) => [id, v]);
// Which of those can search this hotel.
// A site whose link has no {hotel} shows every hotel on one page ("listing" site).
export const isListing = (src) => !!src.urlTemplate && !src.urlTemplate.includes("{hotel}");
// A site only counts for a discount rate if we know how to ask it for that rate.
export const supportsRate = (v, rate) => rate === "standard" || Object.keys(v.rateParams?.[rate] || {}).length > 0 || !!v.rateClickText?.[rate];
export const sourcesFor = (s, hotel, rate = "standard") => activeSources(s).filter(([, v]) => (isListing(v) || v.hotelCodes?.[hotel]) && supportsRate(v, rate)).map(([id]) => id);
export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = deepMerge(cur, patch);
  await (await store()).set("settings", next);
  return next;
}
function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) a[k] = deepMerge(a[k], v);
    else a[k] = v;
  }
  return a;
}

export const emailAvailable = (settings) => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && settings.emailEnabled);
export const stripeAvailable = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
export const salesOn = (settings) => !!(settings.salesEnabled && stripeAvailable());

/* ---------------- http helpers ---------------- */
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
export const bad = (msg, status = 400) => json({ error: msg }, status);
export async function body(req) { try { return await req.json(); } catch { return {}; } }
export const siteUrl = (req) => process.env.URL || new URL(req.url).origin;

// Admin sign-in: "username:password", checked against ADMIN_USERNAME + ADMIN_PASSWORD on Netlify.
// After 10 wrong tries from one internet address in an hour, it locks for the rest of that hour.
export async function requireAdmin(req) {
  const user = process.env.ADMIN_USERNAME || "admin";
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return { ok: false, status: 503, error: "Add ADMIN_USERNAME and ADMIN_PASSWORD on Netlify first." };
  const st = await store();
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "local";
  const lk = `limits/admin-${new Date().toISOString().slice(0, 13)}-${sha(ip).slice(0, 16)}`;
  const fails = (await st.get(lk)) || 0;
  if (fails >= 10) return { ok: false, status: 429, error: "Too many wrong tries. Wait an hour and try again." };
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const want = `${user}:${pass}`;
  const a = Buffer.from(sha(got)), b = Buffer.from(sha(want));
  if (crypto.timingSafeEqual(a, b)) return { ok: true };
  await st.set(lk, fails + 1);
  return { ok: false, status: 401, error: "Wrong username or password." };
}

export function requireSecret(req, envName) {
  const want = process.env[envName];
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/* ---------------- ids, tokens ---------------- */
export const rid = (n = 9) => crypto.randomBytes(n).toString("base64url");
export const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// A "key" is a person's private link. No accounts, no passwords.
// The link looks like  /my?k=<keyId>.<secret>
export async function loadKeyFromToken(token) {
  const [keyId, secret] = String(token || "").split(".");
  if (!keyId || !secret) return null;
  const k = await (await store()).get(`keys/${keyId}`);
  if (!k || k.tokenHash !== sha(secret)) return null;
  return k;
}
export const saveKey = async (k) => (await store()).set(`keys/${k.id}`, k);

export function planOf(key, settings) {
  const now = Date.now();
  const hasPass = key.passUntil && Date.parse(key.passUntil) > now;
  if (!salesOn(settings) || hasPass || key.comped) {
    return { name: hasPass ? "pass" : key.comped ? "comped" : "free-all", watchLimit: settings.passWatchLimit, windowDays: 0, hasPass: !!hasPass };
  }
  return { name: "free", watchLimit: settings.freeWatchLimit, windowDays: settings.freeWindowDays, hasPass: false };
}

/* ---------------- dates ---------------- */
export const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Adults 1 and 2 are priced the same; kids don't change the rate.
export const boardAdults = (a) => (Number(a) <= 2 ? 2 : Number(a));

// One lookup = one hotel search. Two people watching the same room share it.
export const lookupKey = (l) => [l.hotel, l.rate, l.checkIn, l.nights, boardAdults(l.adults)].join("|");

export const money = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
