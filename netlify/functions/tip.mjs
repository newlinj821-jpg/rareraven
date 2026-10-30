// Tip jar with Stripe: POST /api/tip { amount }  (dollars, 1–500)
import { getSettings, json, bad, body, stripeAvailable, siteUrl } from "./_lib/core.mjs";

export default async (req) => {
  if (req.method !== "POST") return bad("Method not allowed", 405);
  const s = await getSettings();
  if (!s.tipEnabled || s.tipUrl || !stripeAvailable()) return bad("The tip jar isn't taking card tips right now.");
  const amount = Math.round(Number((await body(req)).amount) * 100);
  if (!(amount >= 100 && amount <= 50000)) return bad("Pick an amount from $1 to $500.");
  const base = siteUrl(req);
  const form = new URLSearchParams({
    mode: "payment", submit_type: "donate",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `Tip for ${s.siteName}`,
    success_url: `${base}/?thanks=1`, cancel_url: `${base}/`,
    "metadata[kind]": "tip",
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return bad(data.error?.message || "The tip page couldn't open.", 502);
  return json({ url: data.url });
};
export const config = { path: "/api/tip" };
