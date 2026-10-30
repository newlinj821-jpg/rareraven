// End-to-end test: fake hotel site + real RateRaven site + real scraper.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(root, ".teststore");
await fs.rm(STORE, { recursive: true, force: true });
Object.assign(process.env, { LOCAL_STORE_DIR: STORE, SCRAPER_SECRET: "test-secret", ADMIN_USERNAME: "test-admin-user", ADMIN_PASSWORD: "test-admin", PORT: "8891", URL: "http://localhost:8891" });

// --- fake hotel booking site ---
let priceShift = 0;
const hotelHits = { n: 0 };
const hotel = http.createServer((req, res) => {
  hotelHits.n++;
  const q = new URL(req.url, "http://x").searchParams;
  const base = { PBH: 340, HRH: 360, RPR: 300, CBB: 150 }[q.get("property")] ?? 200;
  const day = Number(q.get("from").slice(8, 10));
  const disc = q.get("rateCode") === "PASS" ? 0.8 : 1;
  const p = Math.round((base + (day % 7) * 5 + priceShift) * disc + (Number(q.get("ad")) > 2 ? 25 : 0));
  res.setHeader("content-type", "text/html");
  res.end(`<html><body>${[["Standard View, 2 Queens", p], ["Water View, 2 Queens", p + 40]].map(([n, v]) => `
    <article class="room"><h3>${n}</h3><p>${q.get("rateCode") === "PASS" ? "Annual Passholder Rate" : "Best Available Rate"}</p>
    <p><span>$${v}</span> per night</p><p>Total $${v * Number(q.get("n") || 1)} for stay</p></article>`).join("")}</body></html>`);
}).listen(8892);

// --- fake ntfy server to catch phone alerts ---
const pushes = [];
const ntfy = http.createServer(async (req, res) => {
  let b = ""; for await (const c of req) b += c;
  pushes.push({ topic: req.url.slice(1), title: req.headers.title, body: b });
  res.end("{}");
}).listen(8893);
process.env.NTFY_SERVER = "http://localhost:8893";

const { server } = await import("./devserver.mjs");
await new Promise((r) => server.listen(8891, r));

let failures = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) failures++; };
const call = async (p, opts = {}, auth) => {
  const r = await fetch("http://localhost:8891" + p, { ...opts, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const runScraper = () => new Promise((resolve) => {
  const p = spawn("node", ["run.mjs"], { cwd: path.join(root, "scraper"), env: { ...process.env, SITE_URL: "http://localhost:8891", FORCE_RUN: "true", FORCE_SLOT: "morning" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("exit", (code) => resolve({ code, out }));
});

console.log("Admin setup");
ok((await call("/api/admin")).status === 401, "admin locked without password");
const set = await call("/api/admin", { method: "POST", body: JSON.stringify({ settings: {
  boardDays: 6, dailyBudget: 60, boardRates: ["standard", "ap"], boardAdults: [2],
  scraper: { urlTemplate: "http://localhost:8892/search?property={hotel}&from={checkIn}&to={checkOut}&ad={adults}&n={nights}", dateFormat: "YYYY-MM-DD",
    hotelCodes: { portofino: "PBH", hardrock: "HRH", royalpacific: "RPR", cabana: "CBB" }, rateParams: { ap: { rateCode: "PASS" } }, concurrency: 6 },
} }) }, "test-admin-user:test-admin");
ok(set.status === 200, "scraper settings saved");

console.log("A person signs up");
const created = await call("/api/key", { method: "POST", body: JSON.stringify({ channels: { ntfy: "raven-test-topic" }, daily: true }) });
ok(created.status === 200 && created.data.token, "private link created");
const k = created.data.token;
const today = new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let w = await call("/api/watch", { method: "POST", body: JSON.stringify({ k, watch: { hotel: "portofino", rate: "ap", checkIn: inDays(3), nights: 2, adults: 2, paid: 400 } }) });
ok(w.status === 200, "watching Portofino, AP rate, paid $400/night");
// second person watches the exact same room → should be one search, not two
const k2 = (await call("/api/key", { method: "POST", body: JSON.stringify({ channels: { ntfy: "raven-test-2" }, daily: false }) })).data.token;
await call("/api/watch", { method: "POST", body: JSON.stringify({ k: k2, watch: { hotel: "portofino", rate: "ap", checkIn: inDays(3), nights: 2, adults: 1, paid: 250 } }) });
await call("/api/watch", { method: "POST", body: JSON.stringify({ k, watch: { hotel: "hardrock", rate: "standard", checkIn: inDays(5), nights: 3, adults: 4, roomFilter: "water" } }) });
const bad = await call("/api/watch", { method: "POST", body: JSON.stringify({ k, watch: { hotel: "nope", rate: "ap", checkIn: inDays(3), nights: 2 } }) });
ok(bad.status === 400, "rejects a bad hotel");

const jobs = await call("/api/jobs?force=1", {}, "test-secret");
const watched = jobs.data.lookups.filter((l) => l.w);
ok(watched.length === 2, `3 watches → 2 searches (same room shared) — got ${watched.length}`);
ok(jobs.data.lookups.length <= 62, `stays within daily budget (${jobs.data.lookups.length})`);

console.log("Morning run #1");
let r = await runScraper();
ok(r.code === 0, "scraper finished" + (r.code ? "\n" + r.out : ""));
console.log(r.out.split("\n").filter((l) => /Run |Done|saved/.test(l)).map((l) => "     " + l).join("\n"));

let me = (await call(`/api/key?k=${k}`)).data.key;
const pw = me.watches.find((x) => x.hotel === "portofino");
ok(pw.lastPrice > 0 && pw.lastPrice < 400, `Portofino AP price read: $${pw.lastPrice} (lowest room: ${pw.lastRoom})`);
ok(pw.lastOffers?.includes("Annual Passholder Rate"), "discount label kept");
const hr = me.watches.find((x) => x.hotel === "hardrock");
ok(hr.lastRoom?.startsWith("Water View"), `room filter "water" respected (${hr.lastRoom} $${hr.lastPrice})`);
const p1 = pushes.find((p) => p.topic === "raven-test-topic");
const dec = (t) => (t?.startsWith("=?UTF-8?B?") ? Buffer.from(t.slice(10, -2), "base64").toString() : t);
for (const p of pushes) p.title = dec(p.title);
ok(p1 && /price drop/i.test(p1.title), `phone alert sent: "${p1?.title}"`);
ok(p1 && /THIS MORNING/.test(p1.body), "daily summary included");
ok(!pushes.find((p) => p.topic === "raven-test-2"), "person 2 (paid $250) gets nothing: no drop, daily summary off");

const month = inDays(1).slice(0, 7);
const board = (await call(`/api/board?rate=ap&adults=2&month=${month}`)).data;
const someDay = Object.values(board.days)[0];
ok(someDay && someDay.portofino?.p > 0, `calendar filled (Portofino AP ${Object.keys(board.days)[0]}: $${someDay?.portofino?.p})`);

const detail = (await call(`/api/watch?k=${k}&id=${pw.id}`)).data;
ok(detail.rooms.length === 2 && detail.days.length === 1, "room details + price history saved");

console.log("Morning run #2 — prices drop $30");
priceShift = -30; pushes.length = 0;
// pretend the calendar was last checked yesterday
for (const f of await fs.readdir(STORE)) if (decodeURIComponent(f).startsWith("board/")) {
  const d = JSON.parse(await fs.readFile(path.join(STORE, f), "utf8"));
  for (const day of Object.values(d)) for (const c of Object.values(day)) c.t = new Date(Date.now() - 864e5).toISOString();
  await fs.writeFile(path.join(STORE, f), JSON.stringify(d));
}
await runScraper();
me = (await call(`/api/key?k=${k}`)).data.key;
const pw2 = me.watches.find((x) => x.hotel === "portofino");
ok(pw2.lastPrice < pw.lastPrice, `new lower price: $${pw.lastPrice} → $${pw2.lastPrice}`);
for (const p of pushes) p.title = dec(p.title);
ok(pushes.some((p) => p.topic === "raven-test-topic" && /drop/i.test(p.title)), "second drop alert sent");
const b2 = (await call(`/api/board?rate=ap&adults=2&month=${month}`)).data;
const cell = Object.values(b2.days).find((d) => d.portofino?.prev);
ok(cell && cell.portofino.prev > cell.portofino.p, `calendar remembers the old price (was $${cell?.portofino.prev}, now $${cell?.portofino.p})`);

console.log("Morning run #3 — same prices");
pushes.length = 0;
await runScraper();
for (const p of pushes) p.title = dec(p.title);
const p3 = pushes.find((p) => p.topic === "raven-test-topic");
ok(p3 && !/drop/i.test(p3.title), `no repeat drop alert, just the summary ("${p3?.title}")`);

console.log("Sales + limits");
ok((await call("/api/admin", { method: "POST", body: JSON.stringify({ settings: { salesEnabled: true } }) }, "test-admin-user:test-admin")).status === 400, "can't turn on sales until Stripe keys are added");
const cfg = (await call("/api/config")).data;
ok(cfg.sales === null && cfg.email === false, "sales and email stay off by default");
ok((await call("/api/stripe-webhook", { method: "POST", body: "{}" })).status === 400, "fake payment notice rejected");

console.log("Afternoon check + report");
pushes.length = 0; priceShift = -45;
for (const f of await fs.readdir(STORE)) if (decodeURIComponent(f).startsWith("board/")) {
  const d = JSON.parse(await fs.readFile(path.join(STORE, f), "utf8"));
  for (const day of Object.values(d)) for (const c of Object.values(day)) c.t = new Date(Date.now() - 864e5).toISOString();
  await fs.writeFile(path.join(STORE, f), JSON.stringify(d));
}
await new Promise((resolve) => { const p = spawn("node", ["run.mjs"], { cwd: path.join(root, "scraper"), env: { ...process.env, SITE_URL: "http://localhost:8891", FORCE_RUN: "true", FORCE_SLOT: "afternoon" }, stdio: "ignore" }); p.on("exit", resolve); });
for (const p of pushes) p.title = dec(p.title);
const pa = pushes.find((p) => p.topic === "raven-test-topic");
ok(pa && /drop/i.test(pa.title) && !/THIS MORNING/.test(pa.body), `afternoon sends the drop, no morning summary ("${pa?.title}")`);
const rep = (await call("/api/report")).data;
ok(rep && rep.slot === "afternoon" && rep.dropCount > 0 && rep.drops[0].prev > rep.drops[0].p, `report written: ${rep?.dropCount} drops, biggest ${rep?.drops?.[0]?.hotel} $${rep?.drops?.[0]?.prev}→$${rep?.drops?.[0]?.p}`);
ok(rep.express && ["portofino", "hardrock", "royalpacific"].includes(rep.express.hotel), `cheapest Express night found (${rep.express?.hotel} ${rep.express?.date} $${rep.express?.p})`);
ok(rep.discounts.find((d) => d.rate === "ap")?.avgOff === 20, `Passholder averages ${rep.discounts.find((d) => d.rate === "ap")?.avgOff}% off Standard`);
const j2 = await call("/api/jobs", {}, "test-secret");
ok(j2.data.skip || j2.data.lookups, "jobs answers outside a forced run");

server.close(); hotel.close(); ntfy.close();
console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
