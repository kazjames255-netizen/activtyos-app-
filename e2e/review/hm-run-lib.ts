/** Pure + injectable logic for e2e/review/hm-run.mts (HMRC Tax-Free Childcare SANDBOX scenario runner). No process-level side effects here. */
import { linkAccount, accountBalance, submitPayment, failureForCode, type TfcConfig, type TfcTokens, type TfcResult } from "../../server/src/lib/tfc";
import { tfcFailureForCode, type TfcFailure } from "../../lib/tfc";

export const SANDBOX_HOST = "test-api.service.hmrc.gov.uk";
export const START = "<!-- hm-run:results:start -->";
export const END = "<!-- hm-run:results:end -->";

/** Hard check: only the HMRC sandbox host over https. Throws otherwise. */
export function assertSandbox(baseUrl: string): void {
  let u: URL;
  try { u = new URL(baseUrl); } catch { throw new Error("HMRC_TFC_BASE_URL is not a valid URL: refusing to run."); }
  if (u.protocol !== "https:" || u.hostname !== SANDBOX_HOST || (u.port && u.port !== "443")) {
    throw new Error(`Refusing to run: HMRC_TFC_BASE_URL must be https://${SANDBOX_HOST} (the SANDBOX). This runner never talks to anything else.`);
  }
}

/** Mask all but the last 3 characters. */
export const maskRef = (s: string | undefined | null): string => {
  const t = String(s ?? "");
  if (!t) return "";
  return t.length <= 3 ? "*".repeat(t.length) : "*".repeat(t.length - 3) + t.slice(-3);
};

/** Strip secrets and TFC-reference-shaped strings from any text before it is printed or written. */
export function scrub(text: string, secrets: string[] = []): string {
  let out = String(text ?? "");
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join("[redacted]");
  out = out.replace(/\b[A-Za-z]{4}\d{5}TFC\b/g, (m) => maskRef(m));
  out = out.replace(/\b\d{12,}\b/g, (m) => maskRef(m));
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  return out;
}

type Endpoint = "link" | "balance" | "payment";
export interface Scenario {
  id: string;
  name: string;
  ref: string;
  kind: "success" | "error";
  /** error scenarios: HMRC code expected and the parent screen it must map to */
  code?: string;
  screen?: TfcFailure;
  endpoints: Endpoint[];
}

const ALL: Endpoint[] = ["link", "balance", "payment"];
const ok = (id: string, name: string, ref: string): Scenario => ({ id, name, ref, kind: "success", endpoints: ALL });
const bad = (id: string, ref: string, code: string, screen: TfcFailure, endpoints: Endpoint[], what: string): Scenario =>
  ({ id, name: `${code} ${what}`, ref, kind: "error", code, screen, endpoints });

// HMRC's documented sandbox values for outbound_child_payment_ref (see docs/tfc/sandbox-test-evidence.md).
export const SCENARIOS: Scenario[] = [
  ok("S01", "Success: Peter Pan (ACTIVE)", "AAAA00000TFC"),
  ok("S02", "Success: Benjamin Button (INACTIVE)", "AABB00000TFC"),
  ok("S03", "Success: Christopher Columbus (ACTIVE)", "AACC00000TFC"),
  ok("S04", "Success: Donald Duck (ACTIVE)", "AADD00000TFC"),
  bad("S05", "EERR00000TFC", "E0026", "reference-mismatch", ALL, "reference does not match NI number"),
  bad("S06", "EETT00000TFC", "E0030", "not-connected", ALL, "our EPP record inactive"),
  bad("S07", "EEBD00000TFC", "E0043", "no-tfc-account", ALL, "parent has no TFC account"),
  bad("S08", "EEPP00000TFC", "E0024", "not-connected", ["link", "payment"], "EPP identifiers mismatch"),
  bad("S09", "EEQQ00000TFC", "E0025", "reference-mismatch", ["link"], "date of birth / reference mismatch"),
  bad("S10", "EEVV00000TFC", "E0032", "reference-mismatch", ["balance", "payment"], "EPP not associated with reference"),
  bad("S11", "EERS00000TFC", "E0027", "provider-not-added", ["payment"], "provider not linked"),
  bad("S12", "EEUU00000TFC", "E0031", "provider-unavailable", ["payment"], "provider inactive"),
  bad("S13", "EEYY00000TFC", "E0035", "account-blocked", ["payment"], "payments blocked"),
  bad("S14", "EEYZ00000TFC", "E0036", "provider-unavailable", ["payment"], "payee bank details incorrect"),
  bad("S15", "EEBC00000TFC", "E0042", "provider-unavailable", ["payment"], "ccp reference/postcode"),
  bad("S16", "EEWW00000TFC", "E0033", "insufficient-funds", ["payment"], "insufficient funds"),
];

export interface Row {
  id: string; scenario: string; request: Endpoint; maskedRef: string;
  status: number | null; code: string; screen: string; expectedScreen: string; mapped: boolean | null;
  pass: boolean; note: string; at: string;
}

export interface Deps {
  cfg: TfcConfig;
  tokens: TfcTokens;
  /** returns the HTTP status of the most recent HMRC call */
  lastStatus: () => number | null;
  ccp: { ref: string; postcode: string };
  now?: () => Date;
}

const DOB = "2015-01-01";

async function call(d: Deps, ep: Endpoint, ref: string): Promise<TfcResult<unknown>> {
  if (ep === "link") return linkAccount(d.cfg, d.tokens, { outboundChildPaymentRef: ref, childDateOfBirth: DOB });
  if (ep === "balance") return accountBalance(d.cfg, d.tokens, { outboundChildPaymentRef: ref });
  return submitPayment(d.cfg, d.tokens, { outboundChildPaymentRef: ref, amount: 10, ccpRegReference: d.ccp.ref, ccpPostcode: d.ccp.postcode });
}

/** Run every endpoint of one scenario; never throws, a failure of one call is recorded and the next goes on. */
export async function runScenario(d: Deps, sc: Scenario): Promise<Row[]> {
  const rows: Row[] = [];
  for (const ep of sc.endpoints) {
    const at = (d.now ?? (() => new Date()))().toISOString();
    const base = { id: sc.id, scenario: sc.name, request: ep, maskedRef: maskRef(sc.ref), at };
    try {
      const r = await call(d, ep, sc.ref);
      const status = d.lastStatus();
      if (sc.kind === "success") {
        rows.push({ ...base, status, code: r.ok ? "" : r.code ?? "", screen: r.ok ? "(success)" : r.failure, expectedScreen: "(success)", mapped: null,
          pass: r.ok, note: r.ok ? "" : "expected success" });
      } else if (r.ok) {
        rows.push({ ...base, status, code: "", screen: "(success)", expectedScreen: sc.screen!, mapped: false, pass: false, note: "expected an HMRC error, got success" });
      } else {
        const mapped = r.failure === sc.screen && failureForCode(sc.code, 400) === sc.screen && tfcFailureForCode(sc.code, 400) === sc.screen;
        const codeOk = r.code === sc.code;
        rows.push({ ...base, status, code: r.code ?? "", screen: r.failure, expectedScreen: sc.screen!, mapped, pass: codeOk && mapped,
          note: codeOk ? (mapped ? "" : "code arrived but mapped to the wrong parent screen") : `expected ${sc.code}` });
      }
    } catch (e) {
      rows.push({ ...base, status: d.lastStatus(), code: "", screen: "", expectedScreen: sc.screen ?? "(success)", mapped: null, pass: false,
        note: `runner error: ${scrub((e as Error).message, [d.cfg.clientId, d.cfg.clientSecret, d.tokens.accessToken, d.tokens.refreshToken])}` });
    }
  }
  return rows;
}

export function renderResults(rows: Row[], when: string): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    START,
    "## Automated sandbox run results",
    "",
    `Last run: ${when} by \`npx tsx e2e/review/hm-run.mts\` against ${SANDBOX_HOST}. References are masked (last 3 characters shown). Scenario ids S01-S16 follow the tables above in order.`,
    "",
    `Overall: ${rows.filter((r) => r.pass).length} of ${rows.length} requests passed.`,
    "",
    "| Id | Scenario | Request | Ref | HTTP | HMRC code | Parent screen | Expected screen | Mapped | Result | Timestamp (UTC) | Note |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.id} | ${esc(r.scenario)} | ${r.request} | ${r.maskedRef} | ${r.status ?? "-"} | ${r.code || "-"} | ${r.screen || "-"} | ${r.expectedScreen} | ${r.mapped === null ? "n/a" : r.mapped ? "yes" : "NO"} | ${r.pass ? "PASS" : "FAIL"} | ${r.at} | ${esc(r.note)} |`),
    END,
  ];
  return lines.join("\n");
}

/** Replace the marked results block, or insert it before "## Safety properties" (else append). */
export function spliceResults(doc: string, block: string): string {
  const a = doc.indexOf(START), b = doc.indexOf(END);
  if (a >= 0 && b > a) return doc.slice(0, a) + block + doc.slice(b + END.length);
  const i = doc.indexOf("## Safety properties");
  return i >= 0 ? doc.slice(0, i) + block + "\n\n" + doc.slice(i) : doc.trimEnd() + "\n\n" + block + "\n";
}

/** Pull the OAuth ?code out of whatever the owner pastes (full redirect URL or bare code). */
export function extractCode(pasted: string): string {
  const t = pasted.trim();
  const m = t.match(/[?&]code=([^&#\s]+)/);
  return decodeURIComponent(m ? m[1] : t);
}
