// Tiny API client for the own-art tools: sign in as the staging tutor, read / patch one note's lesson.deckSlides through the real API
// (so its validation, signing and in-memory note cache stay authoritative). Never used against the two real tenants.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STAGING_TENANT = "pnH8zTuvYlb7yJbvcanr";
export const REAL_TENANTS = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../../../..");
export const API = process.env.OAK_API || "http://localhost:4000";
export const LOGIN = process.env.OAK_LOGIN || "oakstaging-tutor-mu8p3mve@example.com";

function apiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = line.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); }
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found");
}
export async function token(): Promise<string> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: LOGIN, password: process.env.OAK_PW || "E2etest!123", returnSecureToken: true }) });
  const j = (await r.json()) as { idToken?: string };
  if (!j.idToken) throw new Error("login failed");
  return j.idToken;
}
export interface NoteDoc { id: string; tenantId?: string; updatedAt?: unknown; lesson?: { deckSlides?: Record<string, unknown>[] } & Record<string, unknown>; [k: string]: unknown }
export async function getNote(tok: string, id: string): Promise<NoteDoc> {
  const r = await fetch(`${API}/api/learning-hub/notes/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET note ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t);
  return (j.note ?? j) as NoteDoc;
}
export async function patchDeck(tok: string, id: string, deckSlides: unknown): Promise<void> {
  const r = await fetch(`${API}/api/learning-hub/notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ lesson: { deckSlides } }) });
  const t = await r.text();
  if (!r.ok) throw new Error(`PATCH ${r.status} ${t.slice(0, 400)}`);
}
/** Strip the `url` fields the API adds when reading (they are re-signed on every read and must not be sent back). */
export function stripUrls(slides: Record<string, unknown>[]): Record<string, unknown>[] {
  return JSON.parse(JSON.stringify(slides), (k, v) => (k === "url" ? undefined : v));
}
