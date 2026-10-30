// Fills a local store with realistic-looking demo prices so the pages can be previewed.
// Demo only — never used on the live site.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.env.LOCAL_STORE_DIR || path.join(root, ".demostore");
await fs.rm(dir, { recursive: true, force: true });
await fs.mkdir(dir, { recursive: true });
const put = (k, v) => fs.writeFile(path.join(dir, encodeURIComponent(k)), JSON.stringify(v));
const catalog = (await import("../shared/catalog.mjs")).default;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const add = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const base = { portofino: 389, hardrock: 409, royalpacific: 349, helios: 459, sapphire: 249, aventura: 199, cabana: 169, stellanova: 189, terraluna: 179, surfside: 119, dockside: 139 };
const rooms = { portofino: "Standard Garden View", hardrock: "Standard Room, 2 Queens", royalpacific: "Standard Room, 2 Queens", helios: "Standard Room, 2 Queens", sapphire: "Standard Room, 2 Queens", aventura: "Standard Room, 2 Queens", cabana: "Standard Room, 2 Queens", stellanova: "Standard Room, 2 Queens", terraluna: "Standard Room, 2 Queens", surfside: "2-Bedroom Suite", dockside: "Standard Room, 2 Queens" };
const disc = { standard: 1, ap: 0.8, florida: 0.85, military: 0.78 };
const offerFor = { standard: ["Best Available Rate"], ap: ["Annual Passholder Rate", "Save up to 20%"], florida: ["Florida Resident Rate"], military: ["Military Rate"] };
const now = new Date().toISOString();
const files = {};
const holidays = ["-11-2", "-12-2", "-12-3", "-03-1", "-03-2", "-07-0"];
for (let i = 0; i < 365; i++) {
  const d = add(today, i);
  const dow = new Date(d + "T12:00:00Z").getUTCDay();
  const season = holidays.some((h) => d.slice(4, 8) === h) ? 1.35 : 1;
  for (const rate of ["standard", "ap", "florida", "military"]) for (const ad of [2, 4]) {
    if (i > 200 && rnd() < 0.7) continue; // far dates fill in over time
    const k = `board/${rate}/${ad}/${d.slice(0, 7)}`;
    const day = ((files[k] ||= {})[d] = {});
    for (const h of catalog.hotels) {
      if (rnd() < 0.015) { day[h.id] = { p: null, s: "soldout", t: now, n: 0 }; continue; }
      const p = Math.round((base[h.id] * season * (dow === 5 || dow === 6 ? 1.18 : 1) * disc[rate] + (ad > 2 ? 25 : 0) + (rnd() - 0.5) * 30));
      const moved = rnd() < 0.12 ? Math.round((rnd() - 0.6) * 60) : 0;
      day[h.id] = { p, r: rooms[h.id], o: offerFor[rate], was: rate !== "standard" ? Math.round(p / disc[rate]) : null, n: 6 + Math.floor(rnd() * 8), s: "ok", t: now,
        prev: moved ? p - moved : null, ch: moved ? now : null, low: Math.min(p, p - Math.max(0, moved)), high: p + 40 };
    }
  }
}
for (const [k, v] of Object.entries(files)) await put(k, v);
await put("runs/last", { date: today, finished: new Date(Date.now() - 2.5 * 3600e3).toISOString(), stats: { ok: 3412, soldout: 31, empty: 9, error: 2, blocked: 0 }, minutes: 41, sent: 214 });

const secret = "demoSecret123456789";
const hist = (start, n, end) => Array.from({ length: n }, (_, i) => ({ d: add(today, i - n + 1), p: Math.round(start + ((end - start) * i) / (n - 1) + (i % 4 === 1 ? 14 : i % 5 === 3 ? -9 : 0)) }));
const w1h = hist(349, 40, 312), w2h = hist(219, 26, 228);
await put("keys/demoKey1", {
  id: "demoKey1", s: secret, tokenHash: crypto.createHash("sha256").update(secret).digest("hex"), created: now,
  channels: { ntfy: "raven-k3m9q2" }, daily: true,
  lastSend: { at: new Date(Date.now() - 2.4 * 3600e3).toISOString(), res: { ntfy: "ok" } },
  watches: [
    { id: "w1", hotel: "portofino", rate: "ap", checkIn: add(today, 44), nights: 3, adults: 2, roomFilter: "", paid: 349, alertBelow: 312, lastPrice: 312, lastRoom: "Standard Garden View", lastOffers: ["Annual Passholder Rate", "Save up to 20%"], lastChecked: today, status: "ok", low: 305, high: 362, history: w1h, drops: 4 },
    { id: "w2", hotel: "cabana", rate: "florida", checkIn: add(today, 4), nights: 2, adults: 4, roomFilter: "suite", paid: 219, alertBelow: 219, lastPrice: 228, lastRoom: "Family Suite", lastOffers: ["Florida Resident Rate"], lastChecked: today, status: "ok", low: 209, high: 241, history: w2h },
    { id: "w3", hotel: "helios", rate: "standard", checkIn: add(today, 120), nights: 2, adults: 2, paid: null, alertBelow: null, status: null, history: [] },
  ],
});
await put(`prices/${encodeURIComponent(`portofino|ap|${add(today, 44)}|3|2`)}`, {
  checked: new Date(Date.now() - 2.5 * 3600e3).toISOString(), status: "ok", url: "https://example.com/search",
  rooms: [
    { name: "Standard Garden View", price: 312, was: 390, offers: ["Annual Passholder Rate", "Save up to 20%"] },
    { name: "Bay View, 2 Queens", price: 347, was: 434, offers: ["Annual Passholder Rate"] },
    { name: "Deluxe Bay View, 1 King", price: 389, offers: ["Annual Passholder Rate"] },
    { name: "Kids Suite", price: 512, offers: ["Annual Passholder Rate", "Stay 3, save more"] },
  ], days: [],
});
await put("settings", { scraper: { urlTemplate: "https://booking.example.com/?hotel={hotel}", hotelCodes: Object.fromEntries(catalog.hotels.map((h) => [h.id, h.id.toUpperCase().slice(0, 3)])) } });
process.env.LOCAL_STORE_DIR = dir;
const core = await import("../netlify/functions/_lib/core.mjs");
const { buildReport } = await import("../netlify/functions/_lib/report.mjs");
const st = await core.store();
await put("report/latest", await buildReport(st, await core.getSettings(), today, now, "afternoon", { at: new Date(Date.now() - 6 * 3600e3).toISOString() }));
console.log("Demo data in", dir, "— private link: /my?k=demoKey1." + secret);
