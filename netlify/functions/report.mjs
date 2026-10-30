// The latest Raven's Report for the home page.
import { store, json } from "./_lib/core.mjs";
export default async () => json((await (await store()).get("report/latest")) || null, 200, { "cache-control": "public, max-age=300" });
export const config = { path: "/api/report" };
