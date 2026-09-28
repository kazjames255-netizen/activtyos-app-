import { Router, type Request, type Response } from "express";

// GET /bootstrap?p=<path>&p=<path>… — ONE round trip for a hub's first paint. The client names the read-only hub GETs it is
// about to make (providers, topics, roster, config, counts, groups and the Home tab's feeds), the server runs every one of
// them IN PARALLEL through the hub router itself (so each answer is byte-for-byte what the normal endpoint returns and every
// existing permission / scoping rule applies unchanged: same req.auth, same tenant / child / franchise scope) and returns
// `{ responses: { "<path>": <body> } }`. A path that fails (403, 404, 500…) is simply left out — the client then makes
// that one call the normal way and reports its real error. Reads only; the whitelist below is the whole surface.
const OK = /^\/(providers|topics|students|config|notes\/counts|groups|lessons|doubts|homework|homework\/inbox|attempts|curriculum|mastery|mastery\/overview|assessments|flashcards\/due|remote-sync\/sessions|remote-sync\/active)$/;
const MAX_PATHS = 24;

interface Captured { status: number; body: unknown }

/** Run one GET through `router` with the caller's identity and capture the JSON it produces. */
function dispatch(router: Router, req: Request, path: string): Promise<Captured | null> {
  return new Promise((resolve) => {
    const [pathname, search = ""] = path.split("?");
    const url = new URL(`http://x${path}`);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });
    const sub = Object.create(req) as Request;
    Object.defineProperties(sub, {
      url: { value: `${pathname}${search ? `?${search}` : ""}`, writable: true },
      originalUrl: { value: `/api/learning-hub${path}`, writable: true },
      method: { value: "GET", writable: true },
      query: { value: query, writable: true },
      params: { value: {}, writable: true },
      body: { value: undefined, writable: true },
      headers: { value: { ...req.headers, "accept-encoding": "identity" }, writable: true },
    });
    let status = 200;
    let done = false;
    const finish = (c: Captured | null) => { if (!done) { done = true; resolve(c); } };
    const res: Record<string, unknown> = {
      headersSent: false,
      locals: {},
      status(n: number) { status = n; return res; },
      set() { return res; }, header() { return res; }, setHeader() { return res; }, vary() { return res; }, type() { return res; }, append() { return res; },
      getHeader() { return undefined; },
      json(b: unknown) { finish({ status, body: b }); return res; },
      send(b: unknown) { finish({ status, body: b }); return res; },
      end() { finish(null); return res; },
    };
    try {
      (router as unknown as { handle: (q: Request, s: Response, n: () => void) => void }).handle(sub, res as unknown as Response, () => finish(null));
    } catch { finish(null); }
    setTimeout(() => finish(null), 30_000).unref?.();
  });
}

export function makeHubBootstrapApi(hubRouter: Router): Router {
  const r = Router();
  r.get("/bootstrap", async (req, res) => {
    const raw = req.query.p;
    const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String).slice(0, MAX_PATHS);
    let paths = [...new Set(list)].filter((p) => p.startsWith("/") && OK.test(p.split("?")[0]));
    const responses: Record<string, unknown> = {};
    // A first-ever visit remembers no provider: the client sends `{T}` (tenantId) / `{C}` (first child) placeholders and the server
    // fills them from the caller's OWN provider list (the same "first provider, first child" the shell picks by default).
    if (paths.some((p) => /\{[TC]\}|%7B[TC]%7D/i.test(p))) {
      const pc = await dispatch(hubRouter, req, "/providers").catch(() => null);
      const first = pc && pc.status === 200 && Array.isArray(pc.body) ? (pc.body[0] as { tenantId?: string; children?: { childId: string }[] } | undefined) : undefined;
      if (pc && pc.status === 200) responses["/providers"] = pc.body;
      const T = first?.tenantId, C = first?.children?.[0]?.childId;
      paths = paths.filter((p) => p !== "/providers");
      paths = paths.flatMap((p) => {
        const needsC = /\{C\}|%7BC%7D/i.test(p);
        if (!T || (needsC && !C)) return [];
        return [p.replace(/\{T\}|%7BT%7D/gi, encodeURIComponent(T)).replace(/\{C\}|%7BC%7D/gi, encodeURIComponent(C ?? ""))];
      });
      res.set("X-Hub-Tenant", T ?? "");
    }
    const done = await Promise.all(paths.map((p) => dispatch(hubRouter, req, p).catch(() => null)));
    paths.forEach((p, i) => { const c = done[i]; if (c && c.status === 200) responses[p] = c.body; });
    res.set("Cache-Control", "private, no-store");
    res.json({ responses });
  });
  return r;
}
