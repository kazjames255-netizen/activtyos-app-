"use client";

// HQ > Test tracker. One clear list of every thing to try (the catalogue, in code) with a shared result for each (Firestore, via
// /api/platform/test-tracker). Kaz tries a scenario on each account type and taps Pass / Fail / Blocked; Claude records the bug, the fix
// and marks it "Fixed - retest". Plain words on purpose: no step codes to decode, no browser-only storage.

import { useCallback, useEffect, useMemo, useState } from "react";
import { get, put } from "@/lib/api";
import { CATALOGUE } from "@/lib/testTracker/catalogue";
import { AgentStatusPanel } from "./AgentStatusPanel";
import type { AccountKind, Area, CheckResult, Status, TestCheck } from "@/lib/testTracker/types";
import { uiDateTime } from "@/lib/i18n/format";

const AREAS: { key: Area; label: string; blurb: string }[] = [
  { key: "listing-types", label: "Listing types", blurb: "Every kind of listing, and how it is set up" },
  { key: "passes-pricing", label: "Passes & pricing", blurb: "Passes, timings, add-ons, meals and prices" },
  { key: "discounts", label: "Discounts", blurb: "Siblings, multi-day, codes, early-bird, referrals, wallet, memberships" },
  { key: "payments", label: "Payments", blurb: "Card, vouchers, Tax-Free Childcare, HAF, cash, bank transfer" },
  { key: "booking-main", label: "Main booking page", blurb: "The parent booking journey, start to finish" },
  { key: "booking-quick", label: "Quick book", blurb: "A provider booking on behalf of a customer" },
  { key: "booking-embed", label: "Embed & links", blurb: "The website widget, shared links and QR codes" },
  { key: "approval-waitlist", label: "Approval & waitlist", blurb: "Approval-needed, out of age range, full listings, offers" },
  { key: "cancellations", label: "Cancellations & refunds", blurb: "Parent and provider cancellations, partial, refunds, credit" },
  { key: "amendments", label: "Changing a booking", blurb: "Change dates, add or remove days, swap a child" },
  { key: "children-families", label: "Children & families", blurb: "Profiles, questions, SEND plans, consents" },
  { key: "registers-day", label: "On the day", blurb: "Registers, check-in, collection and ratios" },
  { key: "messages-emails", label: "Messages & emails", blurb: "Notifications around every booking" },
  { key: "finance-dashboard", label: "Money & dashboard", blurb: "Do the figures match the bookings?" },
  { key: "add-ons", label: "Add-ons (extras)", blurb: "T-shirts, lunches and other extras: ordering, changing, cancelling, prep list" },
];

const ACCOUNT_LABEL: Record<AccountKind, string> = {
  company: "Company",
  freelancer: "Freelancer",
  franchise: "Franchise",
  "head-office": "Head office",
  staff: "Staff",
  parent: "Parent",
  platform: "HQ",
};

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  todo: { label: "To do", bg: "var(--panel,#eef1f8)", fg: "var(--ink-2,#4a4763)" },
  pass: { label: "Passed", bg: "#e3f6ea", fg: "#0f6b34" },
  fail: { label: "Failed", bg: "#fde8ea", fg: "#b4161f" },
  blocked: { label: "Blocked", bg: "#fdf0d3", fg: "#8a5300" },
  fixed: { label: "Fixed, please retest", bg: "#e6edff", fg: "#1d3a8f" },
  na: { label: "Not applicable", bg: "var(--panel,#eef1f8)", fg: "var(--ink-3,#8a86a3)" },
};

/** One overall status from the per-account results. */
function derive(byAccount: Partial<Record<AccountKind, Status>> | undefined, accounts: AccountKind[]): Status {
  const s = accounts.map((a) => byAccount?.[a] ?? "todo");
  if (s.includes("fail")) return "fail";
  if (s.includes("blocked")) return "blocked";
  if (s.includes("fixed")) return "fixed";
  if (s.length && s.every((x) => x === "na")) return "na";
  if (s.length && s.every((x) => x === "pass" || x === "na")) return "pass";
  return "todo";
}

/** How many of a check's account types have passed (so a check done on Freelancer only reads "part done"). */
function partOf(r: CheckResult | undefined, accounts: AccountKind[]): { passed: number; total: number } {
  const accts = accounts.filter((a) => a !== "platform");
  const passed = accts.filter((a) => r?.byAccount?.[a] === "pass" || r?.byAccount?.[a] === "na").length;
  return { passed, total: accts.length };
}

const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" });

function Pill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return <span style={chip(m.bg, m.fg)}>{m.label}</span>;
}

export function TestTrackerApp() {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [area, setArea] = useState<Area | "all">("all");
  const [account, setAccount] = useState<AccountKind | "all">("all");
  const [statusF, setStatusF] = useState<Status | "all" | "open" | "part">("all");
  const [q, setQ] = useState("");
  const [mustOnly, setMustOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    get<{ results: CheckResult[] }>("/api/platform/test-tracker")
      .then((r) => { setResults(Object.fromEntries((r?.results ?? []).map((x) => [x.checkId, x]))); setLoadErr(null); })
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : "Couldn't load results"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const statusOf = useCallback((c: TestCheck): Status => {
    const r = results[c.id];
    if (!r) return "todo";
    // per-account results decide when there are any; otherwise the single status that was saved (e.g. "fixed, please retest")
    const has = r.byAccount && Object.keys(r.byAccount).length > 0;
    const d = derive(r.byAccount, c.accounts);
    return r.status === "fixed" && d !== "fail" && d !== "blocked" ? "fixed" : has ? d : r.status;
  }, [results]);

  const counts = useMemo(() => {
    const out: Record<Status, number> = { todo: 0, pass: 0, fail: 0, blocked: 0, fixed: 0, na: 0 };
    for (const c of CATALOGUE) out[statusOf(c)]++;
    return out;
  }, [statusOf]);
  const done = counts.pass + counts.na;
  // Checks still "to do" overall but already passed on at least one account type.
  const isPart = useCallback((c: TestCheck) => { const st = statusOf(c); if (st !== "todo") return false; const p = partOf(results[c.id], c.accounts); return p.passed > 0 && p.passed < p.total; }, [statusOf, results]);
  const partCount = useMemo(() => CATALOGUE.filter(isPart).length, [isPart]);
  // Account-by-account progress: every (check x account type) is one tick.
  const slots = useMemo(() => { let t = 0, d = 0; for (const c of CATALOGUE) { const p = partOf(results[c.id], c.accounts); t += p.total; d += p.passed; } return { t, d }; }, [results]);

  const byArea = useMemo(() => {
    const m = new Map<Area, { total: number; done: number; fail: number; open: number; part: number }>();
    for (const a of AREAS) m.set(a.key, { total: 0, done: 0, fail: 0, open: 0, part: 0 });
    for (const c of CATALOGUE) {
      const x = m.get(c.area)!;
      const s = statusOf(c);
      x.total++;
      if (s === "pass" || s === "na") x.done++;
      if (s === "fail" || s === "blocked" || s === "fixed") x.fail++;
      if (isPart(c)) x.part++;
    }
    return m;
  }, [statusOf, isPart]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOGUE.filter((c) => {
      if (area !== "all" && c.area !== area) return false;
      if (account !== "all" && !c.accounts.includes(account)) return false;
      if (mustOnly && c.priority !== 1) return false;
      const s = statusOf(c);
      if (statusF === "open" && (s === "pass" || s === "na")) return false;
      if (statusF === "part" && !isPart(c)) return false;
      if (statusF !== "all" && statusF !== "open" && statusF !== "part" && s !== statusF) return false;
      if (needle && !(`${c.id} ${c.title} ${c.steps.join(" ")} ${c.expected.join(" ")}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [area, account, statusF, q, mustOnly, statusOf, isPart]);

  async function save(c: TestCheck, patch: { byAccount?: Partial<Record<AccountKind, Status>>; note?: string; bug?: string; fix?: string; status?: Status }) {
    const cur = results[c.id];
    const byAccount = { ...(cur?.byAccount ?? {}), ...(patch.byAccount ?? {}) };
    const status = patch.status ?? derive(byAccount, c.accounts);
    const body = { status, byAccount, note: patch.note ?? cur?.note ?? "", bug: patch.bug ?? cur?.bug ?? "", fix: patch.fix ?? cur?.fix ?? "" };
    setResults((r) => ({ ...r, [c.id]: { ...(r[c.id] ?? { checkId: c.id }), ...body, checkId: c.id, updatedAt: new Date().toISOString(), updatedBy: "you" } }));
    try { await put(`/api/platform/test-tracker/${c.id}`, body); load(); } catch (e) { setLoadErr(e instanceof Error ? e.message : "Couldn't save"); }
  }

  return (
    <div className="mx-auto max-w-[1180px] p-4 md:p-6" style={{ color: "var(--ink,#171534)" }}>
      <h1 className="text-[26px] font-extrabold tracking-[-0.01em]">Test tracker</h1>
      <p className="mt-1 text-[14px] font-bold">One tracker: agent testing first, your hand checks below.</p>
      <AgentStatusPanel />
      <h2 className="mt-8 text-[20px] font-extrabold">Your hand checks</h2>
      <p className="mt-1 max-w-[760px] text-[14px]" style={{ color: "var(--ink-2,#4a4763)" }}>
        Every listing and booking scenario in one list. Open a check, follow the steps on each account type shown, then tap <b>Pass</b>, <b>Fail</b> or <b>Blocked</b>.
        Add a note if something looks wrong. We record the bug and the fix here, and mark it <b>Fixed, please retest</b>.
      </p>
      {loadErr && <div className="mt-3 rounded-lg px-3 py-2 text-[13px] font-semibold" style={{ background: "#fde8ea", color: "#b4161f" }}>{loadErr}</div>}

      {/* overall progress */}
      <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--line,#ece6f1)", background: "var(--surface,#fff)" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[15px] font-extrabold">{done} of {CATALOGUE.length} done</div>
          <div className="text-[13px]" style={{ color: "var(--ink-3,#8a86a3)" }}>{CATALOGUE.length ? Math.round((done / CATALOGUE.length) * 100) : 0}% complete</div>
        </div>
        <div className="mt-1 text-[12.5px] font-semibold" style={{ color: "var(--ink-2,#4a4763)" }}>Account by account: {slots.d} of {slots.t} ticks done ({slots.t ? Math.round((slots.d / slots.t) * 100) : 0}%)</div>
        <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: "var(--panel,#eef1f8)" }}>
          <div style={{ width: `${CATALOGUE.length ? (done / CATALOGUE.length) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg,#16a34a,#4ade80)" }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["todo", "pass", "fail", "blocked", "fixed", "na"] as Status[]).map((s) => (
            <button key={s} type="button" onClick={() => setStatusF(statusF === s ? "all" : s)}
              style={{ ...chip(STATUS_META[s].bg, STATUS_META[s].fg), outline: statusF === s ? "2px solid var(--brand,#1d3a8f)" : "none", cursor: "pointer", border: 0 }}>
              {STATUS_META[s].label} · {counts[s]}
            </button>
          ))}
          <button type="button" onClick={() => setStatusF(statusF === "part" ? "all" : "part")}
            style={{ ...chip("#ddf3e4", "#0f6b34"), outline: statusF === "part" ? "2px solid var(--brand,#1d3a8f)" : "none", cursor: "pointer", border: 0 }}>
            Part done (some account types ticked) · {partCount}
          </button>
          <button type="button" onClick={() => setStatusF(statusF === "open" ? "all" : "open")}
            style={{ ...chip("var(--brand-soft,#eaf0fc)", "var(--brand-ink,#102356)"), outline: statusF === "open" ? "2px solid var(--brand,#1d3a8f)" : "none", cursor: "pointer", border: 0 }}>
            Everything still open
          </button>
        </div>
      </div>

      {/* areas */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((a) => {
          const x = byArea.get(a.key)!;
          const on = area === a.key;
          return (
            <button key={a.key} type="button" onClick={() => setArea(on ? "all" : a.key)} className="rounded-2xl border p-3 text-start transition"
              style={{ borderColor: on ? "var(--brand,#1d3a8f)" : "var(--line,#ece6f1)", background: on ? "var(--brand-soft,#eaf0fc)" : "var(--surface,#fff)", borderWidth: on ? 2 : 1 }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-extrabold">{a.label}</span>
                {x.fail > 0 && <span style={chip("#fde8ea", "#b4161f")}>{x.fail} need attention</span>}
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-3,#8a86a3)" }}>{a.blurb}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--panel,#eef1f8)" }}>
                <div style={{ width: `${x.total ? (x.done / x.total) * 100 : 0}%`, height: "100%", background: "#16a34a" }} />
              </div>
              <div className="mt-1 text-[12px] font-bold">{x.done} of {x.total} done{x.part > 0 && <span style={{ color: "#0f6b34" }}> · {x.part} part done</span>}</div>
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: "var(--ink-3,#8a86a3)" }}>Account</span>
        {(["all", "company", "freelancer", "franchise", "head-office", "staff", "parent"] as const).map((a) => (
          <button key={a} type="button" onClick={() => setAccount(a)} className="rounded-full border px-3 py-1 text-[12.5px] font-bold"
            style={{ borderColor: account === a ? "var(--brand,#1d3a8f)" : "var(--line,#ece6f1)", background: account === a ? "var(--brand,#1d3a8f)" : "var(--surface,#fff)", color: account === a ? "#fff" : "var(--ink-2,#4a4763)" }}>
            {a === "all" ? "All accounts" : ACCOUNT_LABEL[a]}
          </button>
        ))}
        <label className="ms-auto flex items-center gap-1.5 text-[13px] font-semibold">
          <input type="checkbox" checked={mustOnly} onChange={(e) => setMustOnly(e.target.checked)} /> Must-haves only
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search checks…" className="w-[220px] rounded-lg border px-3 py-1.5 text-[13px]" style={{ borderColor: "var(--line,#ece6f1)" }} />
      </div>
      <div className="mt-2 text-[13px]" style={{ color: "var(--ink-3,#8a86a3)" }}>
        Showing {shown.length} of {CATALOGUE.length} checks
        {(area !== "all" || account !== "all" || statusF !== "all" || q || mustOnly) && (
          <button type="button" className="ms-2 font-bold underline" onClick={() => { setArea("all"); setAccount("all"); setStatusF("all"); setQ(""); setMustOnly(false); }}>Clear filters</button>
        )}
      </div>

      {/* checks */}
      <div className="mt-3 grid gap-2">
        {shown.map((c) => (
          <CheckCard key={c.id} c={c} r={results[c.id]} status={statusOf(c)} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} onSave={(p) => save(c, p)} />
        ))}
        {shown.length === 0 && <div className="rounded-2xl border p-8 text-center text-[14px]" style={{ borderColor: "var(--line,#ece6f1)", color: "var(--ink-3,#8a86a3)" }}>Nothing matches those filters.</div>}
      </div>
    </div>
  );
}

function CheckCard({ c, r, status, open, onToggle, onSave }: {
  c: TestCheck; r?: CheckResult; status: Status; open: boolean; onToggle: () => void;
  onSave: (p: { byAccount?: Partial<Record<AccountKind, Status>>; note?: string; bug?: string; fix?: string; status?: Status }) => void;
}) {
  const [note, setNote] = useState(r?.note ?? "");
  const [bug, setBug] = useState(r?.bug ?? "");
  const [fix, setFix] = useState(r?.fix ?? "");
  useEffect(() => { setNote(r?.note ?? ""); setBug(r?.bug ?? ""); setFix(r?.fix ?? ""); }, [r?.note, r?.bug, r?.fix, r?.updatedAt]);
  const area = AREAS.find((a) => a.key === c.area)?.label ?? c.area;
  const accts = c.accounts.filter((a) => a !== "platform");

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: status === "fail" ? "#f3a9b0" : status === "fixed" ? "#b8c9f5" : "var(--line,#ece6f1)", background: "var(--surface,#fff)", borderWidth: status === "fail" || status === "fixed" ? 2 : 1 }}>
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 p-3 text-start">
        <span className="rounded-md px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: "var(--panel,#eef1f8)", color: "var(--ink-2,#4a4763)" }}>{c.id}</span>
        <span className="min-w-[200px] flex-1 text-[14.5px] font-bold">{c.title}{c.priority === 1 && <span title="Must work for launch" className="ms-1.5" style={{ color: "#d97706" }}>★</span>}</span>
        <span className="text-[12px]" style={{ color: "var(--ink-3,#8a86a3)" }}>{area}</span>
        <span className="flex flex-wrap gap-1">
          {accts.map((a) => {
            const s = r?.byAccount?.[a] ?? "todo";
            return <span key={a} title={`${ACCOUNT_LABEL[a]}: ${STATUS_META[s].label}`} style={chip(STATUS_META[s].bg, STATUS_META[s].fg)}>{s === "pass" ? "✓ " : s === "fail" ? "✗ " : ""}{ACCOUNT_LABEL[a]}</span>;
          })}
        </span>
        {(() => {
          const p = partOf(r, c.accounts);
          return status === "todo" && p.passed > 0 && p.passed < p.total
            ? <span style={chip("#ddf3e4", "#0f6b34")}>Part done · {p.passed} of {p.total}</span>
            : <Pill status={status} />;
        })()}
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t p-4" style={{ borderColor: "var(--line,#ece6f1)" }}>
          {c.setup && <p className="mb-3 text-[13px]"><b>Before you start:</b> {c.setup}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: "var(--ink-3,#8a86a3)" }}>What to do</div>
              <ol className="mt-1.5 list-decimal space-y-1 ps-5 text-[13.5px]">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: "var(--ink-3,#8a86a3)" }}>What you should see</div>
              <ul className="mt-1.5 space-y-1 text-[13.5px]">{c.expected.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>
            </div>
          </div>
          {c.moneyCheck && (
            <div className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: "var(--brand-soft,#eaf0fc)", color: "var(--brand-ink,#102356)" }}><b>Money check (Claude does this):</b> {c.moneyCheck}</div>
          )}

          <div className="mt-4 text-[12px] font-extrabold uppercase tracking-wide" style={{ color: "var(--ink-3,#8a86a3)" }}>Your result, per account type</div>
          <div className="mt-1.5 grid gap-2">
            {accts.map((a) => {
              const cur = r?.byAccount?.[a] ?? "todo";
              return (
                <div key={a} className="flex flex-wrap items-center gap-2">
                  <span className="w-[104px] text-[13.5px] font-bold">{ACCOUNT_LABEL[a]}</span>
                  {(["pass", "fail", "blocked", "na"] as Status[]).map((s) => (
                    <button key={s} type="button" onClick={() => onSave({ byAccount: { [a]: cur === s ? "todo" : s } })} className="rounded-full border px-3.5 py-1.5 text-[13px] font-extrabold"
                      style={cur === s ? { background: STATUS_META[s].fg, color: "#fff", borderColor: STATUS_META[s].fg } : { background: "var(--surface,#fff)", color: "var(--ink-2,#4a4763)", borderColor: "var(--line,#ece6f1)" }}>
                      {s === "pass" ? "✓ Pass" : s === "fail" ? "✕ Fail" : s === "blocked" ? "Blocked" : "N/A"}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-[12.5px] font-bold">What happened
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2 text-[13px] font-normal" style={{ borderColor: "var(--line,#ece6f1)" }} placeholder="Anything that looked wrong or surprising" />
            </label>
            <label className="text-[12.5px] font-bold">The bug (what's wrong)
              <textarea value={bug} onChange={(e) => setBug(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2 text-[13px] font-normal" style={{ borderColor: "var(--line,#ece6f1)" }} placeholder="Filled in when something fails" />
            </label>
            <label className="text-[12.5px] font-bold">The fix (what we changed)
              <textarea value={fix} onChange={(e) => setFix(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2 text-[13px] font-normal" style={{ borderColor: "var(--line,#ece6f1)" }} placeholder="Claude fills this in" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onSave({ note, bug, fix })} className="rounded-full px-5 py-2 text-[13.5px] font-extrabold text-white" style={{ background: "var(--brand,#1d3a8f)" }}>Save notes</button>
            <button type="button" onClick={() => onSave({ status: "fixed", note, bug, fix })} className="rounded-full border px-4 py-2 text-[13px] font-bold" style={{ borderColor: "var(--line,#ece6f1)" }}>Mark: fixed, please retest</button>
            {r?.updatedAt && <span className="ms-auto text-[12px]" style={{ color: "var(--ink-3,#8a86a3)" }}>Last updated by {r.updatedBy ?? "someone"} on {uiDateTime(new Date(r.updatedAt))}</span>}
          </div>
          {c.claudeCheck && <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3,#8a86a3)" }}>What Claude checks on its side: {c.claudeCheck}</p>}
          {r?.history && r.history.length > 1 && (
            <details className="mt-2 text-[12px]" style={{ color: "var(--ink-3,#8a86a3)" }}>
              <summary className="cursor-pointer font-bold">History ({r.history.length})</summary>
              <ul className="mt-1 space-y-0.5">{[...r.history].reverse().map((h, i) => <li key={i}>{uiDateTime(new Date(h.at))} · {h.by} · {STATUS_META[h.status].label}{h.note ? ` · ${h.note}` : ""}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
