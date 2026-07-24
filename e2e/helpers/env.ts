import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "../..");
export const WEB_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// The browser-side Firebase config is public by design; we reuse the web
// app's key for the identitytoolkit REST calls that provision test accounts.
function parseEnvFile(p: string): Record<string, string> {
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  parseEnvFile(path.join(ROOT, ".env.local")).NEXT_PUBLIC_FIREBASE_API_KEY ||
  "";
if (!FIREBASE_API_KEY) {
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found (checked env and .env.local)");
}

// Where the signed-in browser states + the account manifest live between the
// setup project and the tests. Gitignored.
export const AUTH_DIR = path.join(ROOT, "e2e/.auth");
export const ACCOUNTS_PATH = path.join(AUTH_DIR, "accounts.json");

export type Role = "freelancer" | "company" | "franchise" | "staff" | "parent" | "platform";
export const ROLES: Role[] = ["freelancer", "company", "franchise", "staff", "parent", "platform"];

export const statePath = (role: Role) => path.join(AUTH_DIR, `${role}.json`);

export interface TestAccount {
  role: Role;
  email: string;
  uid: string;
  tenantId: string | null;
  tenantName: string | null;
}

export interface AccountManifest {
  runId: string;
  password: string;
  accounts: Record<Role, TestAccount>;
}

export function loadAccounts(): AccountManifest {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    throw new Error("e2e/.auth/accounts.json missing — did the setup project run?");
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"));
}
