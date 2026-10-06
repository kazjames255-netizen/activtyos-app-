// Shared helpers for the overnight-30sep unlazy gates.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const ROOT = resolve(new URL("../..", import.meta.url).pathname);
// Anything that looks like a credential we handled this week, or a generic secret assignment.
export const SECRET_PATTERNS = [
  /578F7A1010554574/, /fmNrQYhPWTMv7/, /ilUm1xiSi/, /a30eb717-39a5/, /ABKFSOjoSsv1/, /Wb1NAEVETGRigA7/, /Gunners\d/i,
  /client[_ ]?secret["']?\s*[:=]\s*["']?[A-Za-z0-9_\-=@]{16,}/i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
export const findSecrets = (text) => SECRET_PATTERNS.filter((p) => p.test(text)).map(String);
export const read = (p) => readFileSync(p, "utf8");
export const fail = (msg) => { console.error("FAIL: " + msg); process.exit(1); };
export const gitGrepHas = (token) => {
  try { execFileSync("git", ["grep", "-q", "-F", token, "--", "server/src", "lib", "app", "features", "package.json", "server/package.json", "firestore.indexes.json"], { cwd: ROOT, stdio: "ignore" }); return true; } catch { return false; }
};
export const pathExists = (rel) => existsSync(resolve(ROOT, rel));
