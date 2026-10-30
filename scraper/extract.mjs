// Turns one lookup (hotel + rate + dates + adults) into a page URL,
// then reads every room, price and discount shown on that page.

export function fmtDate(iso, format) {
  const [y, m, d] = iso.split("-");
  switch (format) {
    case "MM/DD/YYYY": return `${m}/${d}/${y}`;
    case "MM-DD-YYYY": return `${m}-${d}-${y}`;
    case "YYYYMMDD": return `${y}${m}${d}`;
    case "MMDDYYYY": return `${m}${d}${y}`;
    case "DD/MM/YYYY": return `${d}/${m}/${y}`;
    default: return iso; // YYYY-MM-DD
  }
}
const addDays = (iso, n) => { const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export const siteOf = (cfg, l) => (cfg.sources && l.src ? cfg.sources[l.src] : cfg) || {};

export function buildUrl(all, l) {
  const cfg = siteOf(all, l);
  if (!cfg.urlTemplate) throw new Error("Scraper not set up yet: paste a booking link on the Admin page.");
  const listing = !cfg.urlTemplate.includes("{hotel}");
  const code = listing ? "" : (cfg.hotelCodes || {})[l.hotel];
  if (!listing && !code) throw new Error(`No hotel code saved for ${l.hotel} (Admin → Scraper setup).`);
  const checkOut = addDays(l.checkIn, l.nights);
  const fill = {
    hotel: code, checkIn: fmtDate(l.checkIn, cfg.dateFormat), checkOut: fmtDate(checkOut, cfg.dateFormat),
    adults: String(l.adults), children: "0", nights: String(l.nights),
  };
  let url = cfg.urlTemplate.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(fill[k] ?? ""));
  const u = new URL(url);
  for (const [k, v] of Object.entries((cfg.rateParams || {})[l.rate] || {})) {
    if (v === null || v === "") u.searchParams.delete(k); else u.searchParams.set(k, v);
  }
  return u.toString();
}

/* Runs inside the browser page. Finds room cards and their prices without
   needing to know the site's exact layout. Optional CSS selectors from the
   Admin page take priority when set. */
export function readPageInBrowser(sel) {
  const PRICE = /\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/;
  const BAD = /(tax|fee|deposit|resort charge|parking|per person|points|gift)/i;
  const TOTAL = /\b(total|for \d+ nights?|stay total)\b/i;
  const NIGHTLY = /(\bnight\b|nightly|\bavg\b|average|\/\s?nt\b|per night)/i;
  const OFFER = /(rate|save|saving|%|off\b|deal|offer|package|discount|passholder|florida|military|resident|member|advance|stay \d|book early|express|breakfast|credit)/i;
  const body = document.body?.innerText || "";
  const lower = body.toLowerCase();

  const blocked = /(access denied|are you a robot|verify you are human|captcha|unusual traffic|request blocked)/i.test(body);
  const soldOut = !PRICE.test(body) && /(no (rooms|availability)|sold out|not available|unavailable for|no rates)/i.test(body);

  const struck = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (/^(S|DEL|STRIKE)$/.test(e.tagName)) return true;
      if (getComputedStyle(e).textDecorationLine.includes("line-through")) return true;
    }
    return false;
  };
  const toNum = (m) => Number(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : ""));
  const clean = (s) => s.replace(/\s+/g, " ").trim();

  const cards = new Map(); // card element -> { name, prices:[], was:[], offers:Set }

  function cardFor(el) {
    if (sel?.card) return el.closest(sel.card);
    for (let e = el.parentElement, depth = 0; e && e !== document.body && depth < 12; e = e.parentElement, depth++) {
      const t = e.innerText || "";
      if (t.length > 2500) return null;
      if (e.querySelector("h1,h2,h3,h4,h5,[class*='title' i],[class*='name' i],[data-testid*='name' i]")) return e;
    }
    return null;
  }
  function nameOf(card) {
    const n = sel?.name ? card.querySelector(sel.name) : card.querySelector("h2,h3,h4,h5,[class*='room-name' i],[class*='roomName' i],[class*='title' i],[class*='name' i]");
    return clean(n?.innerText || "").slice(0, 90);
  }

  const priceEls = sel?.price
    ? [...document.querySelectorAll(sel.price)]
    : [...document.querySelectorAll("body *")].filter((el) => {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ");
        return PRICE.test(own) || (el.children.length === 0 && PRICE.test(el.textContent || ""));
      });

  for (const el of priceEls) {
    const m = (el.textContent || "").match(PRICE);
    if (!m) continue;
    const n = toNum(m);
    if (n < 25 || n > 20000) continue;
    // Read just the words right around this price (not the whole card),
    // e.g. "$289 avg/night" vs "Taxes and fees: $36.12" vs "Total for 2 nights $578".
    let box = el;
    while (box.parentElement && box.parentElement !== document.body && clean(box.parentElement.innerText || "").length < 60) box = box.parentElement;
    const near = [box.previousElementSibling, box.nextElementSibling]
      .filter((s) => s && !PRICE.test(s.innerText || "") && (s.innerText || "").length < 40)
      .map((s) => s.innerText);
    const ctx = clean([box.innerText || el.textContent || "", ...near].join(" ")).slice(0, 160);
    const own = clean(box.innerText || el.textContent || "");
    if (BAD.test(own) && !NIGHTLY.test(own)) continue;
    const card = cardFor(el);
    if (!card) continue;
    const name = nameOf(card);
    if (!name || PRICE.test(name)) continue;
    let c = cards.get(card);
    if (!c) {
      c = { name, nightly: [], totals: [], was: [], offers: new Set() };
      cards.set(card, c);
      for (const line of (card.innerText || "").split("\n").map(clean)) {
        if (line && line.length < 90 && OFFER.test(line) && !PRICE.test(line) && line !== name) c.offers.add(line);
      }
    }
    if (struck(el)) c.was.push(n);
    else if (TOTAL.test(ctx) && !NIGHTLY.test(ctx)) c.totals.push(n);
    else c.nightly.push(n);
  }

  // Merge cards with the same room name (a room can list several rate plans).
  const rooms = new Map();
  for (const c of cards.values()) {
    const price = c.nightly.length ? Math.min(...c.nightly) : null;
    const total = c.totals.length ? Math.min(...c.totals) : null;
    if (price == null && total == null) continue;
    const r = rooms.get(c.name) || { name: c.name, price: null, total: null, was: null, offers: [] };
    if (price != null && (r.price == null || price < r.price)) r.price = price;
    if (total != null && (r.total == null || total < r.total)) r.total = total;
    if (c.was.length) r.was = Math.max(r.was || 0, ...c.was);
    r.offers = [...new Set([...r.offers, ...c.offers])].slice(0, 6);
    rooms.set(c.name, r);
  }
  return {
    blocked, soldOut,
    rooms: [...rooms.values()].slice(0, 40),
    title: document.title,
    hasNightWord: /night/.test(lower),
  };
}

/* Backup reader: looks through the JSON the page downloaded for
   objects that look like { roomName, price }. Used only when the
   page itself showed nothing readable. */
export function readJson(payloads) {
  const NAME = /^(name|roomName|roomTypeName|room_name|title|description|roomType)$/i;
  const NIGHT = /(avg|average|nightly|perNight|night)/i;
  const PRICEK = /(price|rate|amount)/i;
  const SKIP = /(tax|fee|deposit|total|before|after|points|strike|original|was)/i;
  const found = new Map();
  const seen = new Set();
  function walk(o, depth) {
    if (!o || typeof o !== "object" || depth > 14 || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
    let name = null, best = null, bestScore = -1;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && NAME.test(k) && v.length > 2 && v.length < 90) name ??= v;
      const num = typeof v === "number" ? v : typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : typeof v === "object" && v && typeof v.amount === "number" ? v.amount : null;
      if (num != null && PRICEK.test(k) && !SKIP.test(k) && num >= 25 && num <= 20000) {
        const score = NIGHT.test(k) ? 2 : 1;
        if (score > bestScore || (score === bestScore && num < best)) { best = num; bestScore = score; }
      }
    }
    if (name && best != null) {
      const prev = found.get(name);
      if (!prev || best < prev.price) found.set(name, { name, price: best, total: null, was: null, offers: [] });
    }
    for (const v of Object.values(o)) walk(v, depth + 1);
  }
  for (const p of payloads) walk(p, 0);
  return [...found.values()].slice(0, 40);
}

export function summarize(rooms, roomFilter) {
  let list = rooms.filter((r) => r.price != null || r.total != null);
  const nightly = (r, nights) => r.price ?? (r.total != null ? r.total / nights : null);
  return {
    list,
    pick(nights, filter = roomFilter) {
      let pool = list;
      if (filter) {
        const f = filter.toLowerCase();
        pool = list.filter((r) => r.name.toLowerCase().includes(f));
      }
      const priced = pool.map((r) => ({ ...r, nightlyPrice: nightly(r, nights) })).filter((r) => r.nightlyPrice != null);
      priced.sort((a, b) => a.nightlyPrice - b.nightlyPrice);
      return priced[0] || null;
    },
  };
}

/* On a listing page every "room" card is really a hotel. Match card names to our hotels. */
export function byHotel(rooms, hotels) {
  const out = {};
  for (const r of rooms) {
    const h = hotels.find((x) => r.name.toLowerCase().includes(x.match));
    if (!h) continue;
    const price = r.price ?? null;
    if (price == null) continue;
    if (!out[h.id] || price < out[h.id].price) out[h.id] = { name: r.name, price, was: r.was, offers: r.offers };
  }
  return out;
}
