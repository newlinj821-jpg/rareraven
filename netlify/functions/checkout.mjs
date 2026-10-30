// Starts a Stripe payment for a pass (only when sales are switched on in Admin).
import { getSettings, json, bad, body, loadKeyFromToken, salesOn, siteUrl } from "./_lib/core.mjs";

export default async (req) => {
  if (req.method !== "POST") return bad("Method not allowed", 405);
  const s = await getSettings();
  if (!salesOn(s)) return bad("Passes aren't on sale right now.");
  const b = await body(req);
  const key = await loadKeyFromToken(b.k);
  if (!key) return bad("That private link isn't valid.", 404);
  const base = siteUrl(req);
  const back = `${base}/my?k=${key.id}.${key.s}`;
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(s.passPriceCents),
    "line_items[0][price_data][product_data][name]": `${s.siteName} Pass — ${s.passDays} days, up to ${s.passWatchLimit} rooms`,
    "line_items[0][price_data][product_data][description]": "One payment. Nothing renews.",
    success_url: `${back}&paid=1`,
    cancel_url: back,
    client_reference_id: key.id,
    "metadata[keyId]": key.id,
    "payment_intent_data[metadata][keyId]": key.id,
    allow_promotion_codes: "true",
  });
  if (key.channels?.email) form.set("customer_email", key.channels.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return bad(data.error?.message || "Payment page couldn't start.", 502);
  return json({ url: data.url });
};
export const config = { path: "/api/checkout" };
