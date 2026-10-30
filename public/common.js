// Shared bits for every RateRaven page.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const money = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

export async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) }, body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Something went wrong (${res.status}).`), { status: res.status });
  return data;
}

let _config;
export const getConfig = () => (_config ||= api("/api/config"));

// The private link is remembered in this browser only, as a convenience.
export const savedToken = {
  get() { try { return localStorage.getItem("rr.k") || ""; } catch { return ""; } },
  set(v) { try { localStorage.setItem("rr.k", v); } catch {} },
  clear() { try { localStorage.removeItem("rr.k"); } catch {} },
};

export const dayName = (iso, opts = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
export function ago(iso) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}
export function checkedLine(iso) {
  if (!iso) return "Waiting for the first morning check";
  const d = new Date(iso);
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const day = d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return day === today ? `Checked today at ${t} Central` : `Last checked ${ago(iso)}`;
}

let toastTimer;
export function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { prompt("Copy this:", text); }
}

export const randomTopic = () => "raven-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

export const RAVEN = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22.5" fill="#ffd23f" stroke="#0d3b45" stroke-width="2"/><path fill="#0d3b45" d="M9 31c5-1 8-3 10-6 1-5 4-10 10-11 3 0 5 1 6 3l5 1-4 3c0 6-3 11-9 13l3 5h-3l-3-4c-2 1-4 1-7 1l-2 3h-3l2-4c-2 0-4-2-5-4Z"/><circle cx="31.5" cy="17.6" r="1.4" fill="#ffd23f"/></svg>`;

export function header(active = "") {
  return `<header class="top"><div class="wrap">
    <a class="brand" href="/">${RAVEN}<span>RateRaven</span></a>
    <nav aria-label="Main">
      <a href="/#calendar"${active === "cal" ? ' aria-current="page"' : ""}>Rate calendar</a>
      <a href="/#watch">Watch a room</a>
      <a href="/my"${active === "my" ? ' aria-current="page"' : ""}>My rooms</a>
    </nav></div></header>`;
}
export const footer = (name = "RateRaven") => `<footer class="foot"><div class="wrap">
  <p>${esc(name)} is independent and not affiliated with Universal, NBCUniversal or Loews Hotels.<br>Prices are what the booking site showed at the latest check. Always confirm before you change a booking.</p>
  <p><a href="/my">My rooms</a> &nbsp; <a href="/admin" style="color:var(--ink-3)">Admin</a></p></div></footer>`;
