// Works out the scraper settings from booking links the owner pastes in.
// Paste one search link per hotel (any dates), plus one link per discount rate.

const DATE_FORMATS = [
  ["YYYY-MM-DD", /^(\d{4})-(\d{2})-(\d{2})$/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
  ["MM/DD/YYYY", /^(\d{2})\/(\d{2})\/(\d{4})$/, (m) => `${m[3]}-${m[1]}-${m[2]}`],
  ["MM-DD-YYYY", /^(\d{2})-(\d{2})-(\d{4})$/, (m) => `${m[3]}-${m[1]}-${m[2]}`],
  ["YYYYMMDD", /^(20\d{2})(\d{2})(\d{2})$/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
  ["MMDDYYYY", /^(\d{2})(\d{2})(20\d{2})$/, (m) => `${m[3]}-${m[1]}-${m[2]}`],
];
const isDay = (iso) => { const d = new Date(iso + "T12:00:00Z"); return !isNaN(d) && d.toISOString().slice(0, 10) === iso; };
function asDate(v) {
  for (const [fmt, re, to] of DATE_FORMATS) {
    const m = String(v).match(re);
    if (m && isDay(to(m))) return { fmt, iso: to(m) };
  }
  return null;
}
const ADULTS = /^(adults?|numadults|num_adults|ad|adt|guests?|occupancy|numberofadults|adultcount)$/i;
const KIDS = /^(child(ren)?|kids|numchildren|num_children|ch|chd|childcount|numberofchildren)$/i;
const NIGHTS = /^(nights?|los|length|lengthofstay)$/i;

export function analyze(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error("That isn't a full web link. Copy it from the address bar."); }
  const dates = [], params = {};
  for (const [k, v] of u.searchParams) {
    const d = asDate(v);
    if (d) dates.push({ k, ...d });
    params[k] = v;
  }
  if (dates.length < 1) throw new Error("No dates found in this link. Search for dates on the booking site first, then copy the link.");
  dates.sort((a, b) => a.iso.localeCompare(b.iso));
  const tpl = new URL(u);
  tpl.searchParams.set(dates[0].k, "{checkIn}");
  if (dates[1]) tpl.searchParams.set(dates[dates.length - 1].k, "{checkOut}");
  for (const k of Object.keys(params)) {
    if (ADULTS.test(k) && /^\d$/.test(params[k])) tpl.searchParams.set(k, "{adults}");
    if (KIDS.test(k) && /^\d$/.test(params[k])) tpl.searchParams.set(k, "{children}");
    if (NIGHTS.test(k) && /^\d{1,2}$/.test(params[k])) tpl.searchParams.set(k, "{nights}");
  }
  return { url: u, tpl, dateFormat: dates[0].fmt, dateKeys: dates.map((d) => d.k), params, hasCheckout: !!dates[1] };
}

const unbrace = (s) => s.replace(/%7B(\w+)%7D/gi, "{$1}");

/* hotelLinks: { hotelId: url }, rateLinks: { rateId: url } */
export function buildScraperConfig(hotelLinks, rateLinks) {
  const hotels = Object.entries(hotelLinks).filter(([, v]) => v && v.trim());
  if (!hotels.length) throw new Error("Paste at least one hotel's search link.");
  const parsed = hotels.map(([id, link]) => [id, analyze(link)]);
  const [, first] = parsed[0];
  const notes = [];
  const listing = parsed.length === 1 && parsed[0][0] === "*";
  if (!first.hasCheckout) notes.push("Only one date was found in the link. If the site uses a 'nights' number instead of a check-out date, make sure {nights} appears in the template below.");

  // Find what changes between hotels: a query value, or a part of the web address.
  let hotelParam = null, hotelPathIndex = null;
  const codes = {};
  const others = parsed.slice(1);
  if (others.length) {
    for (const [k, v] of first.tpl.searchParams) {
      if (/\{\w+\}/.test(v)) continue;
      if (others.some(([, p]) => p.tpl.searchParams.get(k) !== v)) { hotelParam = k; break; }
    }
    if (!hotelParam) {
      const segs = first.url.pathname.split("/");
      for (let i = 0; i < segs.length; i++) if (others.some(([, p]) => p.url.pathname.split("/")[i] !== segs[i])) { hotelPathIndex = i; break; }
    }
  }
  if (!listing && !hotelParam && hotelPathIndex == null) {
    hotelParam = [...first.tpl.searchParams.keys()].find((k) => /^(hotel|hotelcode|hotel_code|hotelid|property|propertycode|propertyid|prop|code|resort|hid)$/i.test(k)) || null;
    if (!hotelParam) notes.push("Couldn't tell which part of the link is the hotel. Paste links for two or more hotels so it can compare them.");
  }
  for (const [id, p] of parsed) {
    if (listing) break;
    if (hotelParam) codes[id] = p.url.searchParams.get(hotelParam);
    else if (hotelPathIndex != null) codes[id] = p.url.pathname.split("/")[hotelPathIndex];
  }
  const tpl = new URL(first.tpl);
  if (hotelParam) tpl.searchParams.set(hotelParam, "{hotel}");
  if (hotelPathIndex != null) { const segs = tpl.pathname.split("/"); segs[hotelPathIndex] = "{hotel}"; tpl.pathname = segs.join("/"); }

  // Rate codes: whatever a rate link adds or changes compared to a normal search.
  const rateParams = { standard: {} };
  const baseKeys = new Set([...tpl.searchParams.keys()]);
  for (const [rate, link] of Object.entries(rateLinks)) {
    if (!link || !link.trim() || rate === "standard") continue;
    const r = analyze(link);
    const extra = {};
    for (const [k, v] of r.url.searchParams) {
      if (r.dateKeys.includes(k) || k === hotelParam || ADULTS.test(k) || KIDS.test(k) || NIGHTS.test(k)) continue;
      if (!baseKeys.has(k) || first.params[k] !== v) extra[k] = v;
    }
    for (const k of baseKeys) if (!r.url.searchParams.has(k) && !/\{/.test(tpl.searchParams.get(k))) extra[k] = null;
    if (!Object.keys(extra).length) notes.push(`The ${rate} link looks the same as a normal search. If the site picks this rate with a button instead, type that button's words in "Click text".`);
    rateParams[rate] = extra;
  }
  return { urlTemplate: unbrace(tpl.toString()), dateFormat: first.dateFormat, hotelCodes: codes, rateParams, notes, hotelParam, hotelPathIndex };
}
