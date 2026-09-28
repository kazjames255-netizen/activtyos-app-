// Make the RUNNING API process see notes an Admin-SDK script wrote (worksheetFile / worksheetQuizId): POST /notes/index-refresh as the tenant's tutor.
//   import { refreshNotesIndex } from "./refreshNotesIndex";  await refreshNotesIndex(tenantId, noteIds)   // patch those notes in place
//                                                             await refreshNotesIndex(tenantId)            // drop index + disk snapshot (one rebuild)
//   CLI:  cd server && npx tsx src/oak/refreshNotesIndex.ts --tenants <id[,id…]>       (full drop; the real tenants need --real)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "../firebase";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const API = process.env.OAK_API || "http://localhost:4000";
export const REAL_TUTORS: Record<string, string> = { "7jG2XO3cOD3VtoL8YfFY": "amirfreelancer@gmail.com", "jYp5XNZGT7bgSUMuEgHN": "amirfreelaner2@gmail.com" };
function apiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = line.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); }
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found");
}
async function token(tenant: string): Promise<string> {
  const email = REAL_TUTORS[tenant];
  const staging = JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-staging.json"), "utf8")) as { tenantId: string; tutor: { email: string; password: string } };
  let url: string, body: Record<string, unknown>;
  if (email) { url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey()}`; body = { token: await auth.createCustomToken((await auth.getUserByEmail(email)).uid), returnSecureToken: true }; }
  else if (tenant === staging.tenantId) { url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey()}`; body = { email: staging.tutor.email, password: staging.tutor.password, returnSecureToken: true }; }
  else throw new Error(`no tutor login known for tenant ${tenant}`);
  const j = (await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()) as { idToken?: string };
  if (!j.idToken) throw new Error(`login failed for ${tenant}`);
  return j.idToken;
}
/** Best effort: returns false (and warns) when the API is down — the TTL / next restart still catches up. */
export async function refreshNotesIndex(tenant: string, ids?: string[]): Promise<boolean> {
  try {
    const chunks = ids?.length ? Array.from({ length: Math.ceil(ids.length / 500) }, (_, i) => ids.slice(i * 500, i * 500 + 500)) : [undefined];
    for (const c of chunks) {
      const r = await fetch(`${API}/api/learning-hub/notes/index-refresh?tenantId=${tenant}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(tenant)}` }, body: JSON.stringify(c ? { ids: c } : {}) });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
    }
    return true;
  } catch (e) { console.warn(`[refreshNotesIndex] ${tenant}: ${(e as Error).message}`); return false; }
}
if (process.argv[1]?.endsWith("refreshNotesIndex.ts")) {
  const i = process.argv.indexOf("--tenants"), ts = (process.argv[i + 1] ?? "").split(",").filter(Boolean);
  if (ts.some((t) => REAL_TUTORS[t]) && !process.argv.includes("--real")) { console.error("a real tenant needs --real"); process.exit(1); }
  (async () => { for (const t of ts) console.log(t, (await refreshNotesIndex(t)) ? "index dropped (rebuilds on next read)" : "FAILED"); process.exit(0); })();
}
