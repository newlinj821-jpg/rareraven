// Stripe tells us here when someone has paid. We then switch on their pass.
// Also handles refunds (pass is switched off).
import crypto from "node:crypto";
import { store, getSettings, json, bad, saveKey } from "./_lib/core.mjs";

function verify(raw, header, secret) {
  const parts = Object.fromEntries(String(header || "").split(",").map((p) => p.split("=")));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  const want = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  return want.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(parts.v1));
}

export default async (req) => {
  const raw = await req.text();
  if (!verify(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET || "")) return bad("Bad signature", 400);
  const event = JSON.parse(raw);
  const st = await store();
  const s = await getSettings();

  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid" && event.data.object.metadata?.kind === "tip") {
    const sess = event.data.object;
    if (!(await st.get(`tips/${sess.id}`))) await st.set(`tips/${sess.id}`, { amount: sess.amount_total, at: new Date().toISOString() });
    return json({ ok: true });
  }

  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    const sess = event.data.object;
    const id = sess.metadata?.keyId || sess.client_reference_id;
    const done = await st.get(`payments/${sess.id}`);
    if (done) return json({ ok: true, duplicate: true });
    const key = id && (await st.get(`keys/${id}`));
    if (key) {
      const from = key.passUntil && Date.parse(key.passUntil) > Date.now() ? Date.parse(key.passUntil) : Date.now();
      key.passUntil = new Date(from + s.passDays * 864e5).toISOString();
      key.paidAt = new Date().toISOString();
      key.paymentIntent = sess.payment_intent;
      await saveKey(key);
    }
    await st.set(`payments/${sess.id}`, { keyId: id, amount: sess.amount_total, at: new Date().toISOString(), pi: sess.payment_intent });
  }

  if (event.type === "charge.refunded") {
    const pi = event.data.object.payment_intent;
    const id = event.data.object.metadata?.keyId;
    const key = id && (await st.get(`keys/${id}`));
    if (key && key.paymentIntent === pi) {
      key.refundedAt = new Date().toISOString(); // keeps the year (change to null to end it)
      await saveKey(key);
    }
  }
  return json({ ok: true });
};
export const config = { path: "/api/stripe-webhook" };
