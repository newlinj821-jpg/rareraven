// Owner controls. Protected by ADMIN_USERNAME + ADMIN_PASSWORD (set on Netlify).
//   GET  /api/admin                 → status, settings, last run, last test
//   POST /api/admin { settings }    → save settings
//   POST /api/admin { action: "run" | "probe", ... }  → start the GitHub check now (needs GITHUB_TOKEN + GITHUB_REPO)
//   POST /api/admin { action: "comp", keyId }        → give someone a free pass
import { store, getSettings, saveSettings, json, bad, body, requireAdmin, stripeAvailable, todayCT, catalog } from "./_lib/core.mjs";

const NUM = ["passPriceCents", "passDays", "freeWatchLimit", "passWatchLimit", "freeWindowDays", "boardDays", "dailyBudget", "extraBudget"];

export default async (req) => {
  const auth = await requireAdmin(req);
  if (!auth.ok) return bad(auth.error, auth.status);
  const st = await store();

  if (req.method === "GET") {
    const s = await getSettings();
    const names = await st.list("keys/");
    let watches = 0, active = 0, passes = 0, drops = 0, withEmail = 0;
    const today = todayCT();
    for (const n of names) {
      const k = await st.get(n);
      if (!k) continue;
      watches += (k.watches || []).length;
      active += (k.watches || []).filter((w) => w.checkIn >= today).length;
      drops += (k.watches || []).reduce((a, w) => a + (w.drops || 0), 0);
      if (k.passUntil && Date.parse(k.passUntil) > Date.now()) passes++;
      if (k.channels?.email) withEmail++;
    }
    const payments = (await st.list("payments/")).length;
    let tips = 0, tipCents = 0;
    for (const n of await st.list("tips/")) { const t = await st.get(n); if (t) { tips++; tipCents += t.amount || 0; } }
    return json({
      settings: s,
      env: {
        email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
        stripe: stripeAvailable(),
        scraperSecret: !!process.env.SCRAPER_SECRET,
        github: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
      },
      stats: { links: names.length, watches, active, passes, payments, drops, withEmail, tips, tipCents },
      lastRun: await st.get("runs/last"),
      current: await st.get("runs/current"),
      history: (await st.get("runs/history")) || [],
      probe: await st.get("runs/probe"),
      learned: { universal: await st.get("learn/report-universal"), loews: await st.get("learn/report-loews") },
      hotels: catalog.hotels,
      rateTypes: catalog.rateTypes,
    });
  }

  if (req.method !== "POST") return bad("Method not allowed", 405);
  const b = await body(req);

  if (b.settings) {
    const patch = { ...b.settings };
    for (const k of NUM) if (k in patch) {
      const v = Number(patch[k]);
      if (!Number.isFinite(v) || v < 0) return bad(`${k} must be a number`);
      patch[k] = Math.round(v);
    }
    if (patch.passPriceCents != null && patch.passPriceCents < 50) return bad("Price must be at least $0.50 (Stripe's minimum).");
    if (patch.tipAmounts) patch.tipAmounts = String(patch.tipAmounts).split(/[ ,]+/).map(Number).filter((n) => n >= 1 && n <= 500).slice(0, 4);
    if (patch.tipUrl && !/^https:\/\//.test(patch.tipUrl)) return bad("Tip link must start with https://");
    if (patch.tipEnabled && !patch.tipUrl && !(await getSettings()).tipUrl && !stripeAvailable()) return bad("Add a tip link, or add your Stripe keys, before switching the tip jar on.");
    if (patch.salesEnabled && !stripeAvailable()) return bad("Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on Netlify first.");
    if (patch.scraper?.urlTemplate && !/^https?:\/\//.test(patch.scraper.urlTemplate)) return bad("Booking link must start with https://");
    return json({ settings: await saveSettings(patch) });
  }

  if (b.action === "comp") {
    const key = await st.get(`keys/${String(b.keyId || "").split(".")[0]}`);
    if (!key) return bad("No link with that id");
    key.comped = !key.comped;
    await st.set(`keys/${key.id}`, key);
    return json({ ok: true, comped: key.comped });
  }

  if (b.action === "run" || b.action === "probe") {
    const repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
    if (!repo || !token) return bad("To start checks from here, add GITHUB_TOKEN and GITHUB_REPO on Netlify. Or use GitHub → Actions → Morning price check → Run workflow.");
    const inputs = b.action === "run" ? { mode: "daily" } : {
      mode: "probe", site: b.site || "universal", hotel: b.hotel || "portofino", date: b.date || "", rate: b.rate || "standard", adults: String(b.adults || 2),
    };
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/morning-check.yml/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "rateraven" },
      body: JSON.stringify({ ref: b.ref || "main", inputs }),
    });
    if (!res.ok) return bad(`GitHub said: ${res.status} ${(await res.text()).slice(0, 160)}`, 502);
    return json({ ok: true, message: b.action === "run" ? "Full check started. Takes 20–60 minutes." : "Test started. Results show here in about 2 minutes." });
  }
  return bad("Unknown request");
};
export const config = { path: "/api/admin" };
