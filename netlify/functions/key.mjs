// A person's private link ("key"): no account, no password.
//   POST   /api/key            create one          { channels?, daily? }
//   GET    /api/key?k=TOKEN    read it (+ plan)
//   PATCH  /api/key            update alerts      { k, channels, daily }
import { store, getSettings, json, bad, body, rid, sha, loadKeyFromToken, saveKey, todayCT } from "./_lib/core.mjs";
import { publicKey, cleanChannels, setEmailIndex } from "./_lib/keys.mjs";

export default async (req) => {
  const s = await getSettings();
  const st = await store();

  if (req.method === "POST") {
    // gentle limit: 15 new links per internet address per day
    const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "local";
    const lk = `limits/${todayCT()}/${sha(ip).slice(0, 16)}`;
    const n = ((await st.get(lk)) || 0) + 1;
    if (n > 15) return bad("Too many new links today from here. Try again tomorrow.", 429);
    await st.set(lk, n);

    const b = await body(req);
    if (b.website) return bad("Nope", 400); // bot trap
    let channels;
    try { channels = cleanChannels(b.channels, s); } catch (e) { return bad(e.message); }
    const secret = rid(18);
    const key = {
      id: rid(8), s: secret, tokenHash: sha(secret), created: new Date().toISOString(),
      channels, daily: b.daily !== false, watches: [],
    };
    await saveKey(key);
    await setEmailIndex(st, null, channels.email, key.id);
    return json({ token: `${key.id}.${secret}`, key: publicKey(key, s) });
  }

  const k = req.method === "GET" ? new URL(req.url).searchParams.get("k") : (await body(req.clone())).k;
  const key = await loadKeyFromToken(k);
  if (!key) return bad("That private link isn't valid. Check you copied all of it.", 404);

  if (req.method === "GET") return json({ key: publicKey(key, s) });

  if (req.method === "PATCH") {
    const b = await body(req);
    if (b.channels) {
      let channels;
      try { channels = cleanChannels(b.channels, s); } catch (e) { return bad(e.message); }
      await setEmailIndex(st, key.channels?.email, channels.email, key.id);
      key.channels = channels;
    }
    if (typeof b.daily === "boolean") key.daily = b.daily;
    await saveKey(key);
    return json({ key: publicKey(key, s) });
  }

  if (req.method === "DELETE") {
    await setEmailIndex(st, key.channels?.email, null, key.id);
    await st.del(`keys/${key.id}`);
    return json({ ok: true });
  }
  return bad("Method not allowed", 405);
};
export const config = { path: "/api/key" };
