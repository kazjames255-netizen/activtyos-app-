import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { apiFetch as rawFetch, apiPost as rawPost, fbSignIn, fbSignUp, TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "../helpers/accounts";
// Other agents share this stack and the API restarts when files change: retry a refused connection instead of failing a check.
async function retry<T>(f: () => Promise<T>): Promise<T> { for (let i = 0; ; i++) { try { return await f(); } catch (e) { const m = String((e as Error).message); if (i < 12 && /fetch failed|ECONNREFUSED|ECONNRESET/.test(m + String((e as any).cause ?? ""))) { await new Promise((r) => setTimeout(r, 4000)); continue; } throw e; } } }
export const apiFetch: typeof rawFetch = (...a: any[]) => retry(() => (rawFetch as any)(...a));
export const apiPost: typeof rawPost = (...a: any[]) => retry(() => (rawPost as any)(...a));
import { ROOT, WEB_URL } from "../helpers/env";
export { fbSignIn, WEB_URL, TEST_PASSWORD, ROOT };
export const OUT = path.join(ROOT, "e2e/review/shots/t2");
fs.mkdirSync(OUT, { recursive: true });
export const STATE = path.join(OUT, "state.json");
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const stamp = process.env.T2_STAMP || Date.now().toString(36);
export const em = (r: string) => `e2e-t2-${r}-${stamp}@${TEST_EMAIL_DOMAIN}`;
export const loadState = () => JSON.parse(fs.readFileSync(STATE, "utf8"));
export const saveState = (s: unknown) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
export const results: Record<string, { ok: boolean; note: string; shot?: string }> = fs.existsSync(path.join(OUT, "results.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "results.json"), "utf8")) : {};
export const saveResults = () => fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
export async function check(id: string, fn: () => Promise<string>, shotFn?: () => Promise<string | undefined>) {
  try { results[id] = { ok: true, note: await fn() }; } catch (e) { results[id] = { ok: false, note: "FAILED: " + (e as Error).message.split("\n").slice(0, 3).join(" | ") }; }
  if (shotFn) { try { results[id].shot = await shotFn(); } catch { /* */ } }
  saveResults(); console.log(`[${id}] ${results[id].ok ? "PASS" : "FAIL"} ${results[id].note.slice(0, 400)}`);
}
export const unwall = (tenantId: string) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
export { fbSignUp };
