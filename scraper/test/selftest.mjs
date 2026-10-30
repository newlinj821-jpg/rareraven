// Self-test: runs the page reader against fake booking pages built like
// typical hotel sites. Run with: npm test
import http from "node:http";
import { chromium } from "playwright";
import { buildUrl, readPageInBrowser, readJson, summarize } from "../extract.mjs";

const pages = {
  // Layout 1: classic room cards, struck-out "was" price, rate badges
  cards: (q) => `<html><body><h1>Select a room</h1>
    ${[["Standard Room, 2 Queens", 289, 339], ["Bay View Room, 1 King", 319, null], ["Kids Suite", 499, 559]].map(([n, p, w]) => `
    <div class="room-card"><h3 class="room-name">${n}</h3>
      <div class="badge">${q.get("promo") === "AP" ? "Annual Passholder Rate" : "Best Available Rate"}</div>
      <div class="badge">Save 15%</div>
      ${w ? `<s>$${w}</s>` : ""}<span class="price">$${q.get("adults") > 2 ? p + 20 : p}</span> <small>avg/night</small>
      <div>Taxes and fees: $36.12</div>
      <div>Total for 2 nights $${p * 2}.00</div>
    </div>`).join("")}</body></html>`,
  // Layout 2: prices loaded by script after a delay, no headings, name in a div with "title" class
  late: () => `<html><body><div id="app">Loading…</div><script>
    setTimeout(()=>{document.getElementById('app').innerHTML=
      '<ul>'+[['Garden Room',199],['Pool View Room',229]].map(([n,p])=>'<li class="offer"><div class="roomTitle">'+n+'</div><div>Stay More Save More</div><div><b>$'+p+'</b> / night</div></li>').join('')+'</ul>'},1500)
  </script></body></html>`,
  soldout: () => `<html><body><h2>We're sorry</h2><p>No rooms available for your dates.</p></body></html>`,
  blocked: () => `<html><body><h1>Access Denied</h1><p>Please verify you are human.</p></body></html>`,
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/rates") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ rooms: [{ roomTypeName: "Family Suite", averageNightlyRate: 410, taxAmount: 50 }] })); }
  res.setHeader("content-type", "text/html");
  res.end((pages[u.searchParams.get("layout")] || pages.cards)(u.searchParams));
}).listen(0);
const port = server.address().port;

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) failures++; };

const cfg = (layout) => ({
  urlTemplate: `http://localhost:${port}/book?hotel={hotel}&arrive={checkIn}&depart={checkOut}&adults={adults}&layout=${layout}`,
  dateFormat: "MM/DD/YYYY", hotelCodes: { portofino: "PBH" }, rateParams: { ap: { promo: "AP" }, standard: {} },
});
const L = { hotel: "portofino", rate: "ap", checkIn: "2026-12-10", nights: 2, adults: 2 };

console.log("URL building");
const url = buildUrl(cfg("cards"), L);
ok(url.includes("arrive=12%2F10%2F2026") && url.includes("depart=12%2F12%2F2026"), "dates fill in, checkout = check-in + nights");
ok(url.includes("promo=AP"), "AP rate code added");
ok(url.includes("hotel=PBH"), "hotel code filled in");

const browser = await chromium.launch();
const page = await browser.newPage();
async function read(layout, extra = "") {
  await page.goto(buildUrl(cfg(layout), L) + extra);
  await page.waitForFunction(() => /\$\s?\d{2,}/.test(document.body.innerText) || /no rooms|denied/i.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
  return page.evaluate(readPageInBrowser, null);
}

console.log("Room cards page");
let r = await read("cards");
ok(r.rooms.length === 3, `finds 3 rooms (got ${r.rooms.length}: ${r.rooms.map((x) => x.name).join(", ")})`);
const std = r.rooms.find((x) => x.name.startsWith("Standard"));
ok(std?.price === 289, `nightly price 289, not the tax or total (got ${std?.price})`);
ok(std?.was === 339, `remembers the struck-out "was" price (got ${std?.was})`);
ok(std?.total === 578, `keeps the stay total separately (got ${std?.total})`);
ok(std?.offers.includes("Annual Passholder Rate") && std.offers.includes("Save 15%"), `captures discount labels (${std?.offers.join(" | ")})`);
const pick = summarize(r.rooms).pick(2);
ok(pick.name.startsWith("Standard") && pick.nightlyPrice === 289, "lowest room = Standard $289");
ok(summarize(r.rooms).pick(2, "kids").name === "Kids Suite", "room filter 'kids' picks Kids Suite");

console.log("Prices that load late");
r = await read("late");
ok(r.rooms.length === 2 && r.rooms[0].price === 199, `waits and reads them (${r.rooms.map((x) => x.name + " " + x.price).join(", ")})`);
ok(r.rooms[0].offers.includes("Stay More Save More"), "captures promo text");

console.log("Sold out + blocked pages");
r = await read("soldout");
ok(r.soldOut && !r.rooms.length, "sold out detected");
r = await read("blocked");
ok(r.blocked, "bot-block page detected");

console.log("JSON backup reader");
const j = readJson([{ data: { rooms: [{ roomTypeName: "Family Suite", averageNightlyRate: 410, taxAmount: 50, totalAmount: 900 }] } }]);
ok(j.length === 1 && j[0].price === 410, `reads nightly rate from JSON, ignores tax/total (got ${j[0]?.price})`);

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
