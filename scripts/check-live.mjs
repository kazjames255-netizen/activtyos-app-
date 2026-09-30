#!/usr/bin/env node
// Polite smoke check for the live stack. No dependencies.
//   node scripts/check-live.mjs [--web URL] [--api URL] [--selftest]
// At most MAX_REQUESTS (8) requests per run, >= 1.5 s apart, normal User-Agent.
// Stops immediately on HTTP 403 (Vercel bot challenge) instead of retrying.
// Run it by hand occasionally; do not loop it or put it in a cron.
import http from "node:http";

const DEFAULT_WEB = "https://activtyos-app-zayoxs-projects.vercel.app";
const DEFAULT_API = "https://activtyos-app-production.up.railway.app";
const MAX_REQUESTS = 8;
const GAP_MS = 1500;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Challenge extends Error {}

export async function runChecks({ web, api, gapMs = GAP_MS }) {
  const results = [];
  let used = 0;
  const pass = (name, ok, detail = "") => results.push({ name, ok, detail });
  const webOrigin = new URL(web).origin;

  async function req(url, opts = {}) {
    if (used >= MAX_REQUESTS) throw new Error("request budget exhausted");
    if (used > 0) await sleep(gapMs);
    used++;
    const res = await fetch(url, { redirect: "manual", ...opts, headers: { "user-agent": UA, accept: "text/html,application/json,*/*", ...(opts.headers || {}) } });
    const body = await res.text();
    if (res.status === 403) throw new Challenge(`HTTP 403 from ${url}`);
    return { status: res.status, headers: res.headers, body };
  }
  const noLocalhost = (r) => {
    const hay = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" + r.body;
    return !/localhost|127\.0\.0\.1/i.test(hay);
  };

  try {
    let r = await req(`${web}/login`);
    pass("web /login is 200", r.status === 200, `got ${r.status}`);
    pass("web /login has no localhost strings", noLocalhost(r), "a localhost URL leaked into the response (NEXT_PUBLIC_API_URL baked wrong?)");

    r = await req(`${web}/definitely-not-a-page-${Date.now()}`);
    pass("web bogus path is 404 with the app's not-found page", r.status === 404 && /find that page/i.test(r.body), `got ${r.status}${r.status === 404 ? " but without the not-found copy" : ""}`);

    // The API answers 401 to EVERY /api path before routing (requireAuth sits
    // above the routers), so this proves the API is up and guarded, NOT that a
    // particular route exists.
    r = await req(`${api}/api/me`);
    let json = true; try { JSON.parse(r.body); } catch { json = false; }
    pass("api /api path is 401 JSON without auth", r.status === 401 && json, `got ${r.status}${json ? "" : " (not JSON)"}`);
    pass("api 401 has no localhost strings", noLocalhost(r), "a localhost URL leaked into the API response");

    r = await req(`${api}/api/me`, { method: "OPTIONS", headers: { origin: webOrigin, "access-control-request-method": "GET", "access-control-request-headers": "authorization" } });
    const allow = r.headers.get("access-control-allow-origin");
    pass("api CORS preflight allows the web origin", r.status < 400 && (allow === webOrigin || allow === "*"), `allow-origin=${allow ?? "(none)"} status=${r.status}; set CORS_ORIGIN=${webOrigin} on Railway`);
  } catch (e) {
    if (e instanceof Challenge) {
      pass("not blocked", false, `${e.message}. Vercel bot challenge, try again later / check in a browser. Stopped without retrying.`);
    } else {
      pass("reachable", false, String(e?.cause?.code || e?.message || e));
    }
  }
  return { results, requests: used };
}

function report({ results, requests }) {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "  -> " + r.detail}`);
  console.log(`(${requests} request${requests === 1 ? "" : "s"} made)`);
  return results.every((r) => r.ok);
}

async function selftest() {
  const origin = "http://fixture.test";
  const fixture = (mode) => http.createServer((req, res) => {
    const url = req.url || "/";
    if (mode === "blocked") { res.writeHead(403, { "content-type": "text/html" }); res.end("challenge"); return; }
    if (url.startsWith("/api/")) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, mode === "good" ? { "access-control-allow-origin": req.headers.origin || "" } : {}); res.end(); return;
      }
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: mode === "leaky" ? "see http://localhost:4000" : "Missing or invalid Authorization header" })); return;
    }
    if (url === "/login") { res.writeHead(200, { "content-type": "text/html" }); res.end("<html>login</html>"); return; }
    if (mode === "good") { res.writeHead(404, { "content-type": "text/html" }); res.end("<h1>We couldn&rsquo;t find that page</h1>"); return; }
    res.writeHead(200, { "content-type": "text/html" }); res.end("soft 404");
  });
  const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${s.address().port}`)));
  const servers = [];
  const go = async (mode) => { const s = fixture(mode); servers.push(s); const u = await listen(s); return runChecks({ web: u, api: u, gapMs: 0 }); };
  try {
    const good = await go("good");
    if (!good.results.length || !good.results.every((r) => r.ok)) throw new Error("good fixture was flagged: " + JSON.stringify(good.results.filter((r) => !r.ok)));
    if (good.requests > MAX_REQUESTS) throw new Error("too many requests");
    const bad = await go("bad");
    if (bad.results.every((r) => r.ok)) throw new Error("bad fixture (soft 404, no CORS) was not flagged");
    const leaky = await go("leaky");
    if (!leaky.results.some((r) => !r.ok && /localhost/.test(r.name))) throw new Error("localhost leak was not flagged");
    const blocked = await go("blocked");
    if (blocked.requests !== 1 || !blocked.results.some((r) => !r.ok && /bot challenge/.test(r.detail))) throw new Error("403 must stop after 1 request with the bot-challenge message");
  } finally { for (const s of servers) s.close(); }
  void origin;
  console.log("check-live selftest passed");
}

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1].replace(/\/+$/, "") : d; };
if (args.includes("--selftest")) {
  selftest().catch((e) => { console.error("check-live selftest FAILED:", e.message); process.exit(1); });
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const web = flag("--web", DEFAULT_WEB), api = flag("--api", DEFAULT_API);
  console.log(`check-live: web=${web} api=${api} (max ${MAX_REQUESTS} requests, ${GAP_MS}ms apart)`);
  runChecks({ web, api }).then((o) => process.exit(report(o) ? 0 : 1));
}
