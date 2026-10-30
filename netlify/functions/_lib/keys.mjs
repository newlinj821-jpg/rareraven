import { store, sha, planOf, salesOn, emailAvailable } from "./core.mjs";

export function publicKey(key, s) {
  const { tokenHash, s: secret, ...rest } = key;
  return { ...rest, plan: planOf(key, s), emailAvailable: emailAvailable(s), sales: salesOn(s) };
}

export function cleanChannels(c = {}, s) {
  const out = {};
  const ntfy = String(c.ntfy || "").trim();
  if (ntfy) {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(ntfy)) throw new Error("Phone alert topic can only use letters, numbers, - and _ (6–64 long).");
    out.ntfy = ntfy;
  }
  const discord = String(c.discord || "").trim();
  if (discord) {
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(discord)) throw new Error("That doesn't look like a Discord webhook link.");
    out.discord = discord;
  }
  const email = String(c.email || "").trim().toLowerCase();
  if (email) {
    if (!emailAvailable(s)) throw new Error("Email alerts aren't switched on for this site.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new Error("Please check the email address.");
    out.email = email;
  }
  return out;
}

export async function setEmailIndex(st, oldEmail, newEmail, id) {
  if (oldEmail && oldEmail !== newEmail) await st.del(`emails/${sha(oldEmail)}`);
  if (newEmail) await st.set(`emails/${sha(newEmail)}`, { id });
}

