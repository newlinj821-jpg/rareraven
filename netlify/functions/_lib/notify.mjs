// Sends alerts. Phone push (ntfy) and Discord always work.
// Email only works when RESEND_API_KEY + EMAIL_FROM are set AND email is switched on in Admin.
import { emailAvailable } from "./core.mjs";

const NTFY = process.env.NTFY_SERVER || "https://ntfy.sh";

export function channelsOf(key, settings) {
  const c = key.channels || {};
  const out = [];
  if (c.ntfy) out.push("ntfy");
  if (c.discord) out.push("discord");
  if (c.email && emailAvailable(settings)) out.push("email");
  return out;
}

export async function sendAll(key, settings, msg) {
  // msg: { title, text, url, html? }
  const results = {};
  const c = key.channels || {};
  const jobs = [];
  if (c.ntfy) jobs.push(sendNtfy(c.ntfy, msg).then(() => (results.ntfy = "ok"), (e) => (results.ntfy = String(e.message || e))));
  if (c.discord) jobs.push(sendDiscord(c.discord, msg).then(() => (results.discord = "ok"), (e) => (results.discord = String(e.message || e))));
  if (c.email && emailAvailable(settings)) jobs.push(sendEmail(c.email, msg, settings).then(() => (results.email = "ok"), (e) => (results.email = String(e.message || e))));
  await Promise.all(jobs);
  return results;
}

async function check(res) {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
}

export async function sendNtfy(topic, msg) {
  const res = await fetch(`${NTFY}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: { Title: asciiHeader(msg.title), Tags: "bird", ...(msg.url ? { Click: msg.url } : {}) },
    body: msg.text,
  });
  await check(res);
}

export async function sendDiscord(webhook, msg) {
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhook)) throw new Error("Not a Discord webhook link");
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "RateRaven", content: `**${msg.title}**\n${msg.text}${msg.url ? `\n<${msg.url}>` : ""}`.slice(0, 1990) }),
  });
  await check(res);
}

export async function sendEmail(to, msg, settings) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: msg.title,
      text: msg.text + (msg.url ? `\n\n${msg.url}` : ""),
      html: msg.html || emailHtml(msg, settings),
    }),
  });
  await check(res);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function emailHtml(msg, settings) {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f1220;color:#e9ecf5;border-radius:14px">
  <div style="font-weight:800;font-size:18px;letter-spacing:.3px;color:#ffd166">${esc(settings.siteName)}</div>
  <h2 style="margin:12px 0 8px;font-size:20px">${esc(msg.title)}</h2>
  <pre style="white-space:pre-wrap;font:15px/1.5 system-ui,sans-serif;margin:0">${esc(msg.text)}</pre>
  ${msg.url ? `<p style="margin-top:18px"><a href="${esc(msg.url)}" style="background:#ffd166;color:#111;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Open my rooms</a></p>` : ""}
  <p style="color:#8a90a8;font-size:12px;margin-top:22px">Not affiliated with Universal or Loews. Always confirm the price on the official site before changing a booking.</p></div>`;
}

// Headers must be plain ASCII; ntfy understands this encoding for emoji and "·".
const asciiHeader = (s) => {
  const t = String(s).slice(0, 200);
  return /^[\x20-\x7E]*$/.test(t) ? t : `=?UTF-8?B?${Buffer.from(t).toString("base64")}?=`;
};
