// Local test server: runs the site + functions on your computer with file storage.
//   LOCAL_STORE_DIR=.localstore SCRAPER_SECRET=dev ADMIN_PASSWORD=dev node test/devserver.mjs
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.LOCAL_STORE_DIR ||= path.join(root, ".localstore");
const PORT = Number(process.env.PORT || 8888);
process.env.URL ||= `http://localhost:${PORT}`;

const routes = {};
for (const f of await fs.readdir(path.join(root, "netlify/functions"))) {
  if (!f.endsWith(".mjs")) continue;
  const mod = await import(pathToFileURL(path.join(root, "netlify/functions", f)));
  if (mod.config?.path) routes[mod.config.path] = mod.default;
}
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff": "font/woff", ".woff2": "font/woff2" };

export const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, process.env.URL);
  const fn = routes[u.pathname];
  if (fn) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(u, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    try {
      const r = await fn(request, {});
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { console.error(e); res.writeHead(500); res.end(String(e.stack)); }
    return;
  }
  let p = u.pathname === "/" ? "/index.html" : u.pathname === "/my" ? "/my.html" : u.pathname === "/admin" ? "/admin.html" : u.pathname;
  try {
    const file = await fs.readFile(path.join(root, "public", path.normalize(p)));
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(file);
  } catch { res.writeHead(404); res.end("Not found"); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(PORT, () => console.log(`RateRaven running at ${process.env.URL}`));
