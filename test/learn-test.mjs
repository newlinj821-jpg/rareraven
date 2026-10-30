// Tests the auto-learner against a pretend Universal hotel site whose link format it doesn't know.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(root, ".learnstore");
await fs.rm(STORE, { recursive: true, force: true });
Object.assign(process.env, { LOCAL_STORE_DIR: STORE, SCRAPER_SECRET: "s", ADMIN_USERNAME: "u", ADMIN_PASSWORD: "p", URL: "http://localhost:8895" });

// Pretend site: prices only appear with arrivalDate/departureDate in MM/DD/YYYY + numAdults.
// The Passholder rate is picked with buttons: "Special Rates" then "Annual Passholder" (adds rateCode=APH).
const site = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), q = u.searchParams;
  res.setHeader("content-type", "text/html");
  const nav = `<nav><a href="#">Hotels</a> <a href="#">Tickets</a></nav>`;
  const a = q.get("arrivalDate"), d = q.get("departureDate");
  const ok = a && d && /^\d\d\/\d\d\/\d{4}$/.test(a) && q.get("numAdults");
  const ap = q.get("rateCode") === "APH";
  const day = ok ? Number(a.slice(3, 5)) : 0;
  const hotels = [["Loews Portofino Bay Hotel", 380], ["Hard Rock Hotel", 400], ["Universal Cabana Bay Beach Resort", 160], ["Universal Stella Nova Resort", 180], ["Hilton Orlando (Partner Hotel)", 120]];
  const cards = ok ? hotels.map(([n, p]) => `<div class="card"><h3>${n}</h3>${ap ? "<p>Annual Passholder Rate</p>" : ""}<p>From <b>$${Math.round((p + day) * (ap ? 0.8 : 1))}</b> per night</p></div>`).join("") : `<p>Select your dates to see prices.</p>`;
  const special = `<button onclick="document.getElementById('m').hidden=false">Special Rates</button>
    <div id="m" hidden><button onclick="const u=new URL(location.href);u.searchParams.set('rateCode','APH');location.href=u">Annual Passholder</button></div>`;
  res.end(`<html><body>${nav}<input name="arrivalDate"><input name="numAdults">${special}${cards}</body></html>`);
}).listen(8896);

const { server } = await import("./devserver.mjs");
await new Promise((r) => server.listen(8895, r));
const call = async (p, opts = {}, auth) => (await fetch("http://localhost:8895" + p, { ...opts, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } })).json();
await call("/api/admin", { method: "POST", body: JSON.stringify({ settings: { scraper: { sources: { universal: { startUrl: "http://localhost:8896/hotels/en/us/listing" } } } } }) }, "u:p");

let failures = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) failures++; };
console.log("Auto-learner");
const out = await new Promise((resolve) => {
  const p = spawn("node", ["run.mjs", "--learn"], { cwd: path.join(root, "scraper"), env: { ...process.env, SITE_URL: "http://localhost:8895", SCRAPER_SECRET: "s", FORCE_RUN: "true", MAX_MINUTES: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let o = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d)); p.on("exit", () => resolve(o));
});
console.log(out.split("\n").filter((l) => /Found|rate:|Learning|Couldn/.test(l)).map((l) => "     " + l).join("\n"));
const A = await call("/api/admin", {}, "u:p");
const src = A.settings.scraper.sources.universal;
ok(/arrivalDate=\{checkIn\}/.test(src.urlTemplate) && /departureDate=\{checkOut\}/.test(src.urlTemplate) && /numAdults=\{adults\}/.test(src.urlTemplate), `learned the link: ${src.urlTemplate}`);
ok(src.dateFormat === "MM/DD/YYYY", `learned the date style: ${src.dateFormat}`);
ok(src.rateParams?.ap?.rateCode === "APH" || src.rateClickText?.ap, `learned the Passholder rate: ${JSON.stringify(src.rateParams?.ap || src.rateClickText?.ap)}`);
ok(!src.rateParams?.military || !Object.keys(src.rateParams.military).length, "didn't invent a Military rate the site doesn't have");
ok(A.learned.universal?.notes?.length > 0, "learning report saved for Admin");

console.log("Checks prices with what it learned");
const jobs = await call("/api/jobs?force=1&slot=morning", {}, "s");
ok(jobs.lookups?.length > 0 && jobs.lookups.every((l) => l.hotel === "*"), `${jobs.lookups?.length} searches planned, each covering every hotel`);
ok(jobs.lookups.every((l) => l.rate === "standard" || l.rate === "ap"), "only checks rates the site really has (no fake Florida/Military prices)");

server.close(); site.close();
await fs.rm(STORE, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
