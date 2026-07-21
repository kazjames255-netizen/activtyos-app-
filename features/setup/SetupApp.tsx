"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { HowItWorks } from "@/components/HowItWorks";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import {
  useSettings,
  answerKey,
  dobRequired,
  DEFAULT_QUESTION_LENGTH,
  type ChildQuestion,
  type QuestionType,
  type TenantSettings,
  inferWho,
  filledDetails,
  VOUCHER_DETAIL_LABELS,
  DEFAULT_RATIO_GROUPS,
  type CancelReason,
  type VoucherProvider,
  type RatioGroup,
} from "@/lib/settings";
import { policyWording, sortBands, HOURS, type CancellationPolicy, type NamedPolicy, type RefundBand } from "@/lib/cancellation";

// ─────────────────────────────────────────────────────────────────────────
// Setup & features — the real screen, replacing the legacy mock.
//
// Scoped to the four screens it actually governs: Listings, Sessions &
// blocks, Bookings and Families. The mock's other five tabs (Comms, Staff &
// workforce, Learning, Meals, Branding) describe features that don't exist
// yet, so they stay in the legacy prototype rather than shipping as controls
// that do nothing.
//
// Two rules this screen follows:
//
// 1. Nothing here is decorative. Every control is read by code. A settings
//    page whose switches don't do anything is worse than no settings page —
//    an operator turns "Collect SEND information" off, believes it, and is
//    still handed SEND data. Anything not yet wired says so on its face.
//
// 2. No Save button. The mock had one and it did nothing. Every change here
//    writes immediately; the header says when it last saved. A Save button on
//    a page of forty toggles is a page of forty chances to lose work.
// ─────────────────────────────────────────────────────────────────────────

type Tab = "people" | "groups" | "cancel" | "defaults" | "bookings" | "vouchers";

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Small shared pieces ────────────────────────────────────────────────────

/** One setting: what it is, why you'd change it, and the control. */
function Row({
  label,
  hint,
  children,
  note,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-[var(--line)] py-2.5 last:border-b-0">
      <div className="min-w-[220px] flex-1">
        <div className="text-[13px] font-bold">{label}</div>
        {hint && <div className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--ink-3)]">{hint}</div>}
        {note && (
          <div className="mt-1 inline-block rounded-full bg-[#fff3e0] px-2 py-[1px] text-[10.5px] font-extrabold text-[#8a5300]">
            {note}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, labels = ["On", "Off"], disabled }: { on: boolean; onChange: (v: boolean) => void; labels?: [string, string] | string[]; disabled?: boolean }) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[12px] font-bold"
      style={disabled ? { opacity: 0.6 } : undefined}
      title={disabled ? "Locked — see the note beside this setting" : undefined}
    >
      {[true, false].map((v, i) => (
        <button
          key={String(v)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className="px-3 py-1 transition-colors disabled:cursor-not-allowed"
          style={on === v ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { color: "var(--ink-3)" }}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

function NumberBox({ value, onChange, min = 0, max = 999, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-[76px]"
      />
      {suffix && <span className="text-[11.5px] text-[var(--ink-3)]">{suffix}</span>}
    </span>
  );
}

/**
 * A field that can't be switched off. Shown rather than left out, so the
 * section reads as the complete list of what a family is asked — one headed
 * "what you collect" that never mentions the child's name reads as though it
 * doesn't collect one.
 */
function AlwaysOn() {
  return (
    <span
      title="Can't be switched off — a register without it isn't a register."
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)]"
    >
      <span aria-hidden>🔒</span> Always on
    </span>
  );
}

/**
 * How much a family may write in one field. Sits on the field itself rather
 * than in a table of its own: a list of numbers away from the things they
 * measure means checking two places to answer one question.
 */
function Limit({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1" title="Longest answer a family can give, in characters">
      <NumberBox value={value} onChange={onChange} min={20} max={2000} />
      <span className="text-[11px] text-[var(--ink-3)]">chars</span>
    </span>
  );
}

/**
 * An editable list of plain strings — pay methods, cancellation reasons and
 * so on. Renaming is inline rather than behind an edit mode: these are lists
 * of six things, and a modal to fix a typo is absurd.
 */
function ListEditor({
  items,
  onChange,
  placeholder,
  warn,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  /** Shown when removing — the consequence the operator can't see. */
  warn?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-2 flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={it}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1"
            />
            <button
              type="button"
              aria-label={`Remove ${it}`}
              onClick={() => {
                if (warn && !confirm(`Remove “${it}”?\n\n${warn}`)) return;
                onChange(items.filter((_, j) => j !== i));
              }}
              className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-[var(--ink-3)]">Nothing here yet — add the first below.</div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button onClick={add}>＋ Add</Button>
      </div>
    </div>
  );
}

/**
 * A control whose value is stored but not yet read by the screen it governs.
 *
 * This screen's rule is that nothing on it is decorative — a switch that does
 * nothing is worse than no switch, because an operator believes it. Where the
 * consuming screen hasn't been wired up yet the setting says so out loud,
 * rather than quietly lying about what it does.
 */
function NotWired({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-lg border border-[#f0d9a8] bg-[#fff8ec] px-2.5 py-1.5 text-[11px] font-semibold leading-[1.45] text-[#8a5300]">
      ⚠ {children}
    </div>
  );
}

/**
 * Cancellation reasons, each scoped to who's offered it.
 *
 * One flat list can't serve both sides: "Venue unavailable" in a parent's
 * dropdown is nonsense, and "Staffing" tells them something about how you run
 * that isn't theirs to know. The scope sits on the row rather than being two
 * separate lists to keep in step.
 */
function ReasonEditor({ items, onChange }: { items: CancelReason[]; onChange: (v: CancelReason[]) => void }) {
  const [draft, setDraft] = useState("");
  const WHO: [CancelReason["who"], string][] = [["provider", "You"], ["parent", "Parents"], ["both", "Both"]];
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    // Guessed from the wording — "Coach unavailable" is obviously yours.
    onChange([...items, { id: uid(), label, who: inferWho(label) }]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        <span className="flex-1">Reason</span>
        <span className="w-[190px]">Offered to</span>
        <span className="w-[22px]" />
      </div>
      <div className="mb-2 flex flex-col gap-1.5">
        {items.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              value={r.label}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className="flex-1"
              maxLength={60}
            />
            <span className="inline-flex w-[190px] overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
              {WHO.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(items.map((x, j) => (j === i ? { ...x, who: v } : x)))}
                  className="flex-1 px-2 py-1 transition-colors"
                  style={r.who === v ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { color: "var(--ink-3)" }}
                >
                  {l}
                </button>
              ))}
            </span>
            <button
              type="button"
              aria-label={`Remove ${r.label}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
            >
              &#10005;
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-[var(--ink-3)]">
            No reasons — whoever cancels just types one, or leaves it blank.
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. Coach unavailable"
          className="flex-1"
        />
        <Button onClick={add}>&#65291; Add</Button>
      </div>
    </div>
  );
}

/**
 * The voucher schemes a provider is registered with.
 *
 * Labelled details rather than one reference: Sodexo wants a setting name,
 * Computershare an account number, some an Ofsted number. The labels are
 * editable because no fixed set covers them all.
 */
function VoucherEditor({ items, onChange }: { items: VoucherProvider[]; onChange: (v: VoucherProvider[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const live = items.filter((v) => filledDetails(v).length).length;
  const patch = (i: number, fn: (v: VoucherProvider) => VoucherProvider) =>
    onChange(items.map((x, j) => (j === i ? fn(x) : x)));

  return (
    <div>
      {items.map((v, i) => {
        const open = openId === v.id;
        const filled = filledDetails(v);
        return (
          <div key={v.id} className="mb-2 rounded-xl border border-[var(--line)] p-2.5" style={filled.length ? undefined : { opacity: 0.72 }}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={v.name}
                onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))}
                placeholder="Scheme name"
                className="w-[190px]"
                maxLength={50}
              />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-3)]">
                {filled.length
                  ? filled.map((d) => `${d.label}: ${d.value}`).join("  ·  ")
                  : "Not registered — parents won’t be offered this one"}
              </span>
              <Button sm onClick={() => setOpenId(open ? null : v.id)}>{open ? "Done" : "Details"}</Button>
              <button
                type="button"
                aria-label={`Remove ${v.name}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
              >
                &#10005;
              </button>
            </div>

            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                  <span className="w-[190px]">What they call it</span>
                  <span className="flex-1">What to quote</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {v.details.map((d, k) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Input
                        value={d.label}
                        onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, label: e.target.value } : y)) }))}
                        list="voucher-detail-labels"
                        className="w-[190px]"
                        maxLength={40}
                      />
                      <Input
                        value={d.value}
                        onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, value: e.target.value } : y)) }))}
                        placeholder="e.g. 0026978613"
                        className="flex-1"
                        maxLength={60}
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${d.label}`}
                        onClick={() => patch(i, (x) => ({ ...x, details: x.details.filter((_, n) => n !== k) }))}
                        className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
                      >
                        &#10005;
                      </button>
                    </div>
                  ))}
                </div>
                <Button sm className="mt-2" onClick={() => patch(i, (x) => ({ ...x, details: [...x.details, { id: uid(), label: "", value: "" }] }))}>
                  &#65291; Add a detail
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <datalist id="voucher-detail-labels">
        {VOUCHER_DETAIL_LABELS.map((l) => <option key={l} value={l} />)}
      </datalist>

      <div className="mt-1 flex items-center gap-2">
        <Button onClick={() => onChange([...items, { id: uid(), name: "", details: [{ id: uid(), label: "Account number/ID", value: "" }] }])}>
          &#65291; Add a scheme
        </Button>
        <span className="text-[11.5px] text-[var(--ink-3)]">
          {live === 0
            ? "None filled in yet — parents won’t be offered vouchers at all."
            : `${live} scheme${live === 1 ? "" : "s"} offered to parents.`}
        </span>
      </div>
    </div>
  );
}

function Section({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3.5 p-4">
      <div className="text-[15px] font-extrabold">{title}</div>
      {lede && <p className="mb-2 mt-0.5 text-[12px] leading-[1.5] text-[var(--ink-3)]">{lede}</p>}
      {children}
    </Card>
  );
}

// ── Age groups & rooms ──────────────────────────────────────────────────────

/**
 * The single source of truth for the tenant's age groups: name, colour, age
 * band, target ratio and room size. Defined here once, then referenced
 * everywhere — the Ratios & groups board, the cover calculator, and every
 * listing's age caps. A listing can only cap a group *below* its room size,
 * never above, so these numbers can't be contradicted from a listing. This is
 * the same record the Ratios page shows; editing it in either place is the
 * same edit.
 */
function GroupsEditor({ groups, onChange }: { groups: RatioGroup[]; onChange: (g: RatioGroup[]) => void }) {
  const patch = (i: number, fn: (g: RatioGroup) => RatioGroup) => onChange(groups.map((x, j) => (j === i ? fn(x) : x)));
  const num = (v: string, min: number) => Math.max(min, parseInt(v, 10) || min);
  const inp = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
            <th className="px-2 py-1.5 text-left font-extrabold">Colour</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Group</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Age</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Target ratio</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Room size</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.id} className="border-t border-[var(--line)]">
              <td className="px-2 py-1.5">
                <input type="color" value={g.colour} onChange={(e) => patch(i, (x) => ({ ...x, colour: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5" aria-label={`${g.name} colour`} />
              </td>
              <td className="px-2 py-1.5">
                <input value={g.name} onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))} className={`${inp} w-[130px] font-bold`} placeholder="Group name" />
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">
                  <input type="number" min={0} max={21} value={g.ageFrom} onChange={(e) => patch(i, (x) => ({ ...x, ageFrom: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                  <span className="text-[var(--ink-3)]">to</span>
                  <input type="number" min={0} max={21} value={g.ageTo} onChange={(e) => patch(i, (x) => ({ ...x, ageTo: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                  <span className="text-[var(--ink-3)]">yrs</span>
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">1 :<input type="number" min={1} value={g.targetRatio} onChange={(e) => patch(i, (x) => ({ ...x, targetRatio: num(e.target.value, 1) }))} className={`${inp} w-[56px]`} /></span>
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min={0} value={g.maxSize || ""} placeholder="no cap" onChange={(e) => patch(i, (x) => ({ ...x, maxSize: Math.max(0, parseInt(e.target.value, 10) || 0) }))} className={`${inp} w-[72px]`} />
              </td>
              <td className="px-2 py-1.5 text-right">
                <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} aria-label={`Remove ${g.name}`} className="text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChange([...groups, { id: uid(), name: `Group ${groups.length + 1}`, colour: "#2f6bd8", ageFrom: 0, ageTo: 18, targetRatio: 8, maxSize: 24 }])}
          className="rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)]"
        >
          ＋ Add group
        </button>
        {groups.length === 0 && (
          <button type="button" onClick={() => onChange(DEFAULT_RATIO_GROUPS)} className="text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)] underline">
            Start from the standard groups
          </button>
        )}
        <span className="text-[11px] text-[var(--ink-3)]">Leave <b>room size</b> blank for no cap.</span>
      </div>
    </div>
  );
}

// ── Cancellation policy ────────────────────────────────────────────────────

/**
 * Every notice period, grouped, with the usual ones pulled to the top.
 *
 * A short list of six is quicker to use and wrong for anyone who needs 36
 * hours or a month. Showing everything and *saying* which are common gets
 * both: the provider who wants "48 hours" finds it immediately, and the one
 * running residentials can still pick 4 weeks.
 */
const COMMON_NOTICE: [number, string][] = [
  [HOURS.twoWeeks, "2 weeks"],
  [HOURS.week, "1 week"],
  [HOURS.twoDays, "48 hours"],
  [HOURS.day, "24 hours"],
];

const NOTICE_GROUPS: { label: string; items: [number, string][] }[] = [
  { label: "Most used", items: COMMON_NOTICE },
  { label: "Hours", items: Array.from({ length: 23 }, (_, i) => [i + 1, `${i + 1} hour${i === 0 ? "" : "s"}`] as [number, string]) },
  { label: "Days", items: Array.from({ length: 6 }, (_, i) => [(i + 1) * 24, `${i + 1} day${i === 0 ? "" : "s"}`] as [number, string]) },
  { label: "Weeks", items: Array.from({ length: 8 }, (_, i) => [(i + 1) * HOURS.week, `${i + 1} week${i === 0 ? "" : "s"}`] as [number, string]) },
];

const NOTICE_CHOICES: [number, string][] = NOTICE_GROUPS.flatMap((g) => g.items);

/**
 * The refund rules, as rules.
 *
 * The wording underneath is generated live, so the provider can see exactly
 * what a parent will read as they change the numbers. That's the whole point
 * of the rewrite: prose typed separately from the rules drifts away from
 * them, and then the page promises one thing while the system does another.
 */
function PolicyList({ policies, onChange }: { policies: NamedPolicy[]; onChange: (v: NamedPolicy[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(policies[0]?.id ?? null);
  return (
    <div>
      {policies.map((p, i) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className="mb-2.5 rounded-xl border border-[var(--line)] p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {i === 0 && (
                <span
                  title="New listings start on this one."
                  className="rounded-full bg-[var(--brand-soft)] px-2 py-[2px] text-[10px] font-extrabold text-[var(--brand-ink)]"
                >
                  DEFAULT
                </span>
              )}
              <Input
                value={p.name}
                onChange={(e) => onChange(policies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Name this policy"
                className="w-[190px]"
                maxLength={40}
              />
              <span className="min-w-0 flex-1 text-[11.5px] text-[var(--ink-3)]">
                {sortBands(p.bands)
                  .map((b) => (b.hoursBefore > 0 ? `${NOTICE_CHOICES.find(([h]) => h === b.hoursBefore)?.[1] ?? `${b.hoursBefore}h`}: ${b.refundPercent}%` : `later: ${b.refundPercent}%`))
                  .join("  ·  ")}
              </span>
              <Button sm onClick={() => setOpenId(open ? null : p.id)}>{open ? "Done" : "Edit rules"}</Button>
            </div>
            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <PolicyEditor policy={p} onChange={(next) => onChange(policies.map((x, j) => (j === i ? { ...x, ...next } : x)))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PolicyEditor({ policy, onChange }: { policy: CancellationPolicy; onChange: (p: CancellationPolicy) => void }) {
  const bands = sortBands(policy.bands);
  const tiers = bands.filter((b) => b.hoursBefore > 0);
  const floor = bands.find((b) => b.hoursBefore <= 0) ?? { hoursBefore: 0, refundPercent: 0 };

  const write = (nextTiers: RefundBand[], nextFloor: RefundBand) =>
    onChange({ ...policy, bands: [...sortBands(nextTiers), nextFloor] });

  // The floor is "less than your shortest notice period", so it says that
  // rather than "any later than that", which left the reader working out
  // later than *what*.
  const shortest = tiers.length ? tiers[tiers.length - 1].hoursBefore : 0;
  const shortestLabel = NOTICE_CHOICES.find(([h]) => h === shortest)?.[1] ?? `${shortest} hours`;
  const cell = "px-2 py-2";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
              <th className={`${cell} text-left font-extrabold`}>Notice the family gives</th>
              <th className={`${cell} text-left font-extrabold`}>They get back</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {tiers.map((b, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                <td className={cell}>
                  <span className="flex items-center gap-1.5">
                    <Select
                      value={String(b.hoursBefore)}
                      onChange={(e) => write(tiers.map((x, j) => (j === i ? { ...x, hoursBefore: Number(e.target.value) } : x)), floor)}
                    >
                      {NOTICE_GROUPS.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map(([h, l]) => (
                            <option key={`${g.label}-${h}`} value={h}>{l}</option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    <span className="whitespace-nowrap text-[var(--ink-3)]">or more</span>
                  </span>
                </td>
                <td className={cell}>
                  <NumberBox
                    value={b.refundPercent}
                    onChange={(n) => write(tiers.map((x, j) => (j === i ? { ...x, refundPercent: n } : x)), floor)}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </td>
                <td className={`${cell} text-right`}>
                  <button
                    type="button"
                    aria-label="Remove this row"
                    onClick={() => write(tiers.filter((_, j) => j !== i), floor)}
                    className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
                  >
                    &#10005;
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--line)] bg-[var(--panel)]">
              <td className={cell}>
                <span className="font-semibold">{tiers.length ? `Less than ${shortestLabel}` : "Any notice at all"}</span>
                <span className="ml-1.5 text-[11px] text-[var(--ink-3)]">including after it has started</span>
              </td>
              <td className={cell}>
                <NumberBox value={floor.refundPercent} onChange={(n) => write(tiers, { hoursBefore: 0, refundPercent: n })} min={0} max={100} suffix="%" />
              </td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <Button onClick={() => write([...tiers, { hoursBefore: HOURS.day, refundPercent: 25 }], floor)}>
          &#65291; Add a row
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
          What parents will read
        </div>
        <div className="text-[12.5px] leading-[1.55]">{policyWording({ ...policy, wording: undefined })}</div>
        <div className="mt-2 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
          Written from the rows above. When someone cancels, the same rows work out what&apos;s owed
          and show it to you &mdash; you always decide whether to send it. ActivityOS never moves money.
        </div>
      </div>
    </div>
  );
}

// ── Child questions ────────────────────────────────────────────────────────

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Typed answer",
  choice: "Pick one",
  yesno: "Yes / No",
};

/**
 * The questions a parent answers about their child, once, on the child's
 * profile — so they carry to every booking rather than being re-asked.
 *
 * Name, date of birth and the safeguarding fields are built in and not
 * listed here: they aren't optional, and offering to delete them would be
 * offering to break a register.
 */
function QuestionsEditor({
  questions,
  onChange,
  listings,
}: {
  questions: ChildQuestion[];
  onChange: (next: ChildQuestion[]) => void;
  listings: { id: string; title: string }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const patch = (id: string, fn: (q: ChildQuestion) => ChildQuestion) =>
    onChange(questions.map((q) => (q.id === id ? fn(q) : q)));

  const add = () => {
    const q: ChildQuestion = { id: uid(), label: "", type: "text", scope: "all" };
    onChange([...questions, q]);
    setOpenId(q.id);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {questions.map((q, i) => {
        const open = openId === q.id;
        const scoped = q.scope !== "all";
        return (
          <div
            key={q.id}
            className="mb-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5"
            style={q.hidden ? { opacity: 0.62 } : undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-[10px] leading-none text-[var(--ink-3)] disabled:opacity-25" aria-label="Move up">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="text-[10px] leading-none text-[var(--ink-3)] disabled:opacity-25" aria-label="Move down">▼</button>
              </div>

              <div className="min-w-[160px] flex-1">
                <div className="text-[13px] font-bold">{q.label || <span className="text-[var(--ink-3)]">Untitled question</span>}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                  <span>{TYPE_LABEL[q.type]}</span>
                  {q.required && <span className="rounded-full bg-[var(--brand-soft)] px-1.5 font-bold text-[var(--brand-ink)]">Must answer</span>}
                  {q.ask === "every" && <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">Every booking</span>}
                  <span>· {scoped ? `${(q.scope as string[]).length} listing${(q.scope as string[]).length === 1 ? "" : "s"}` : "All listings"}</span>
                  {(q.minAge !== undefined || q.maxAge !== undefined) && (
                    <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">
                      {q.minAge !== undefined && q.maxAge !== undefined
                        ? `Ages ${q.minAge}–${q.maxAge}`
                        : q.minAge !== undefined
                          ? `Ages ${q.minAge}+`
                          : `Under ${(q.maxAge ?? 0) + 1}`}
                    </span>
                  )}
                  {q.hidden && <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">Hidden</span>}
                </div>
              </div>

              <Toggle on={!q.hidden} onChange={(v) => patch(q.id, (x) => ({ ...x, hidden: !v }))} labels={["Asking", "Hidden"]} />
              <Button sm onClick={() => setOpenId(open ? null : q.id)}>{open ? "Done" : "Edit"}</Button>
            </div>

            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <div className="grid gap-2.5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Question</FieldLabel>
                    <Input
                      value={q.label}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, label: e.target.value }))}
                      placeholder="e.g. Can your child swim 25m?"
                      className="w-full"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <FieldLabel>Answer type</FieldLabel>
                    <Select
                      value={q.type}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, type: e.target.value as QuestionType }))}
                      className="w-full"
                    >
                      <option value="text">Typed answer</option>
                      <option value="choice">Pick one</option>
                      <option value="yesno">Yes / No</option>
                    </Select>
                  </div>
                </div>

                <div className="mt-2.5">
                  <FieldLabel>Helper text — optional</FieldLabel>
                  <Input
                    value={q.help ?? ""}
                    onChange={(e) => patch(q.id, (x) => ({ ...x, help: e.target.value || undefined }))}
                    placeholder="Shown under the question — say why you're asking"
                    className="w-full"
                    maxLength={120}
                  />
                </div>

                {q.type === "text" && (
                  <div className="mt-2.5">
                    <FieldLabel>Longest answer</FieldLabel>
                    <NumberBox
                      value={q.maxLength ?? DEFAULT_QUESTION_LENGTH}
                      onChange={(n) => patch(q.id, (x) => ({ ...x, maxLength: n }))}
                      min={20}
                      max={2000}
                      suffix="characters"
                    />
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                      Too short and a parent can&apos;t say what they need to; too long and your
                      registers and exports become unreadable.
                    </div>
                  </div>
                )}

                {q.type === "choice" && (
                  <div className="mt-2.5">
                    <FieldLabel>Options</FieldLabel>
                    <ListEditor
                      items={q.options ?? []}
                      onChange={(options) => patch(q.id, (x) => ({ ...x, options }))}
                      placeholder="Add an option"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <FieldLabel>When it&apos;s asked</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      sm
                      variant={q.ask !== "every" ? "primary" : "default"}
                      onClick={() => patch(q.id, (x) => ({ ...x, ask: "once" }))}
                    >
                      Once, when they sign up
                    </Button>
                    <Button
                      sm
                      variant={q.ask === "every" ? "primary" : "default"}
                      onClick={() => patch(q.id, (x) => ({ ...x, ask: "every" }))}
                    >
                      Every booking
                    </Button>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    {q.ask === "every"
                      ? "Asked again on each new booking, and the answer replaces the old one. For anything that goes stale — a recent injury is true in March and wrong by August."
                      : "Asked while the child is being set up, then carried to every booking after. Right for anything that doesn't change: dietary needs, swimming ability. Families won't be asked twice."}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold">Must be answered</span>
                  <Toggle on={!!q.required} onChange={(v) => patch(q.id, (x) => ({ ...x, required: v }))} labels={["Yes", "No"]} />
                </div>

                <div className="mt-3">
                  <FieldLabel>Only ask about children aged</FieldLabel>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={18}
                      value={q.minAge ?? ""}
                      placeholder="any"
                      onChange={(e) => patch(q.id, (x) => ({ ...x, minAge: e.target.value === "" ? undefined : Math.max(0, Math.min(18, parseInt(e.target.value, 10) || 0)) }))}
                      className="w-[74px]"
                    />
                    <span className="text-[12px] text-[var(--ink-3)]">to</span>
                    <Input
                      type="number"
                      min={0}
                      max={18}
                      value={q.maxAge ?? ""}
                      placeholder="any"
                      onChange={(e) => patch(q.id, (x) => ({ ...x, maxAge: e.target.value === "" ? undefined : Math.max(0, Math.min(18, parseInt(e.target.value, 10) || 0)) }))}
                      className="w-[74px]"
                    />
                    {(q.minAge !== undefined || q.maxAge !== undefined) && (
                      <Button sm onClick={() => patch(q.id, (x) => ({ ...x, minAge: undefined, maxAge: undefined }))}>
                        Ask about any age
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    {q.minAge === undefined && q.maxAge === undefined
                      ? "Asked about every child."
                      : `Asked only about children ${q.minAge !== undefined && q.maxAge !== undefined ? `aged ${q.minAge}–${q.maxAge}` : q.minAge !== undefined ? `aged ${q.minAge} and over` : `aged ${q.maxAge} and under`}. Worked out from their date of birth each time, so a child starts being asked on their birthday — and isn't asked at all until you have one.`}
                  </div>
                </div>

                <div className="mt-3">
                  <FieldLabel>Asked on</FieldLabel>
                  <div className="mb-1.5 flex gap-1.5">
                    <Button sm variant={q.scope === "all" ? "primary" : "default"} onClick={() => patch(q.id, (x) => ({ ...x, scope: "all" }))}>
                      All listings
                    </Button>
                    <Button sm variant={scoped ? "primary" : "default"} onClick={() => patch(q.id, (x) => ({ ...x, scope: scoped ? (x.scope as string[]) : [] }))}>
                      Chosen listings
                    </Button>
                  </div>
                  {scoped && (
                    <div className="flex flex-wrap gap-1.5">
                      {listings.length === 0 && (
                        <span className="text-[12px] text-[var(--ink-3)]">No listings yet — this question won&apos;t be asked anywhere until you pick one.</span>
                      )}
                      {listings.map((l) => {
                        const on = (q.scope as string[]).includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() =>
                              patch(q.id, (x) => {
                                const cur = x.scope as string[];
                                return { ...x, scope: on ? cur.filter((z) => z !== l.id) : [...cur, l.id] };
                              })
                            }
                            className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                            style={on ? { borderColor: "transparent", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}
                          >
                            {l.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-[var(--line)] pt-2.5">
                  <span className="text-[11px] leading-[1.4] text-[var(--ink-3)]">
                    Hiding keeps every answer families have already given. Deleting throws them away.
                  </span>
                  <Button
                    sm
                    variant="danger"
                    onClick={() => {
                      if (!confirm(`Delete “${q.label || "this question"}”?\n\nEvery answer families have given is deleted with it. Hide it instead if you just want to stop asking.`)) return;
                      onChange(questions.filter((x) => x.id !== q.id));
                      setOpenId(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>

                <div className="mt-2 text-[10.5px] text-[var(--ink-3)]">
                  Stored as <code>answers.{answerKey(q)}</code>
                  {q.replaces && <> · replaces the old fixed <code>{q.replaces}</code> field</>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button variant="primary" onClick={add}>＋ Add a question</Button>
    </div>
  );
}

// ── The screen ─────────────────────────────────────────────────────────────

export function SetupApp() {
  const { settings, questions, loading, save, error } = useSettings();
  const [tab, setTab] = useState<Tab>("people");
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // An age-gated question makes a date of birth compulsory whatever the
  // toggle below says — see dobRequired().
  const dobLock = dobRequired(settings, questions);

  // The scope picker needs the operator's own listings — never the public
  // browse feed, which would offer other providers' listings to scope to.
  useEffect(() => {
    apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1")
      .then((rows) => setListings(rows.map((r) => ({ id: r.id, title: r.title || r.name || "Untitled listing" }))))
      .catch(() => setListings([]));
  }, []);

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => {
    void save({ settings: { ...settings, [key]: value } }).then(() =>
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })),
    );
  };
  const setQuestions = (next: ChildQuestion[]) => {
    void save({ questions: next }).then(() =>
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })),
    );
  };

  if (loading)
    return (
      <OperatorPage title="Setup & features">
        <span className="text-[var(--ink-3)]">Loading…</span>
      </OperatorPage>
    );

  const TABS: [Tab, string][] = [
    ["people", "Child questions"],
    ["groups", "Age groups & rooms"],
    ["cancel", "Cancellations & refunds"],
    ["defaults", "New listing defaults"],
    ["bookings", "Payments"],
    ["vouchers", "Childcare vouchers"],
  ];

  return (
    <OperatorPage
      title="Setup & features"
      lede="How your account runs — set once, used everywhere"
      actions={
        <span className="text-[12px] text-[var(--ink-3)]">
          {error ? <span className="font-bold text-[var(--red,#e21d27)]">{error}</span> : savedAt ? `Saved ${savedAt}` : "Changes save as you make them"}
        </span>
      }
    >
      <HowItWorks
        video="Where each setting shows up: a question added here appearing on the parent's checkout, the child's profile and the register."
        minutes="2 min"
      >
        <p className="mb-2">
          Everything on this page is yours to change and applies across your whole account. There is
          no Save button — each change is stored the moment you make it.
        </p>
        <p>
          Each tab is one job. If a setting isn&apos;t here yet, it&apos;s because it&apos;s still
          fixed in the product — tell us and it moves.
        </p>
      </HowItWorks>

      <TabStrip tabs={TABS} value={tab} onChange={setTab} />

      {tab === "people" && (
        <>
          <Section
            title="What you collect about every child"
            lede="The built-in details, whoever fills them in — you or the parent. Switch off anything you have no use for; a field you never read is one a family shouldn't be asked to fill. Where a field is typed into, the character limit sits beside it — too short and a parent can't explain a real medical need, too long and your registers and exports become unreadable."
          >
            <Row label="Child's name" hint="Every register, booking and name badge is drawn from it.">
              <AlwaysOn />
            </Row>
            <Row
              label="Allergies"
              hint="A blank allergy field and a genuinely allergy-free child look identical, so it always gets asked."
            >
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <Limit value={settings.charLimits.allergies} onChange={(n) => set("charLimits", { ...settings.charLimits, allergies: n })} />
              </span>
            </Row>
            <Row label="Medical needs" hint="Staff need it before day one, not on the day.">
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <Limit value={settings.charLimits.medical} onChange={(n) => set("charLimits", { ...settings.charLimits, medical: n })} />
              </span>
            </Row>
            <Row label="Likes & dislikes" hint="What settles them and what doesn't. Two short boxes — the first is likes, the second dislikes.">
              <span className="flex items-center gap-2">
                <Limit value={settings.charLimits.likes} onChange={(n) => set("charLimits", { ...settings.charLimits, likes: n })} />
                <Limit value={settings.charLimits.dislikes} onChange={(n) => set("charLimits", { ...settings.charLimits, dislikes: n })} />
              </span>
            </Row>

            <Row
              label="Date of birth required"
              hint={
                dobLock.forcedBy.length
                  ? `Locked on: ${dobLock.forcedBy.length === 1 ? `“${dobLock.forcedBy[0].label}” is` : `${dobLock.forcedBy.length} questions are`} only asked about certain ages, and there's no age without a date of birth. Remove the age range to unlock this.`
                  : "Required: a child can't be saved without one. Optional: they can — useful when someone rings up and you haven't asked yet. The catch is that a child's age is worked out from their date of birth, so until it's there you won't see their age anywhere, listing age limits won't be checked for them, and they won't count towards a ratio band. Give any question an age range and this switches back on, because there's no age to match against."
              }
            >
              <Toggle
                on={dobLock.required}
                disabled={dobLock.forcedBy.length > 0}
                onChange={(v) => set("requireDob", v)}
                labels={["Required", "Optional"]}
              />
            </Row>
            <Row label="Ask a child's gender" hint="Some providers need it for changing rooms or teams; others have no reason to ask.">
              <Toggle on={settings.collectGender} onChange={(v) => set("collectGender", v)} />
            </Row>
            {settings.collectGender && (
              <Row label="Options offered" hint="What a parent can pick from." note="Not used yet — the child record only accepts Boy or Girl (Amir)">
                <div className="w-[240px]">
                  <ListEditor items={settings.genderOptions} onChange={(v) => set("genderOptions", v)} placeholder="Add an option" />
                </div>
              </Row>
            )}
            <Row label="Child photo upload" hint="Lets a family upload a photo of their child. It shows on the register and the booking, so staff know who they're handing over at the end of the day.">
              <Toggle on={settings.collectPhoto} onChange={(v) => set("collectPhoto", v)} />
            </Row>
            <Row
              label="Ask permission to use photos"
              hint="Whether photos OF the child may be used in newsletters, on your website or social media. A different question from the one above — a family can happily give you a face for the register and still refuse publicity."
            >
              <Toggle on={settings.askPhotoConsent} onChange={(v) => set("askPhotoConsent", v)} />
            </Row>
            <Row label="Ask about SEND & additional needs" hint="A free-text field where a family describes the support their child needs, so staff can plan for it.">
              <span className="flex items-center gap-2">
                {settings.collectSend && (
                  <Limit value={settings.charLimits.send} onChange={(n) => set("charLimits", { ...settings.charLimits, send: n })} />
                )}
                <Toggle on={settings.collectSend} onChange={(v) => set("collectSend", v)} />
              </span>
            </Row>
            {settings.collectSend && (
              <Row
                label="Also ask for the EHCP / SEND plan"
                hint="Offered only once a family has said there are needs. This is a formal document you'd then be holding a copy of — worth deciding on purpose rather than collecting because you can. Your copy for staff; the parent isn't shown it back."
              >
                <Toggle on={settings.collectSendPlan} onChange={(v) => set("collectSendPlan", v)} />
              </Row>
            )}
            <Row label="Collection check" hint="Asked only when someone other than the usual adult collects. Set once per family, not per booking.">
              <Select value={settings.collectionCheck} onChange={(e) => set("collectionCheck", e.target.value as TenantSettings["collectionCheck"])}>
                <option value="off">Not used</option>
                <option value="password">Password word</option>
                <option value="pin">Numeric PIN</option>
              </Select>
            </Row>
            <Row
              label="Emergency contact"
              hint="Someone has to be reachable if you can't reach the parent, so at least one is always asked for. Set how many name-and-number pairs a family must give."
              note="Only the first is built so far"
            >
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <NumberBox value={settings.emergencyContacts} onChange={(n) => set("emergencyContacts", n)} min={1} max={4} />
              </span>
            </Row>
          </Section>

          <Section
            title="Your own questions"
            lede="Anything else you need to know, asked once by the family on the child's profile and carried to every booking after — nobody re-types them. Add your own, hide the ones that don't apply to you, and choose whether a question goes on every listing or only some."
          >
            <QuestionsEditor questions={questions} onChange={setQuestions} listings={listings} />
            <p className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              These are on top of the built-in details above — no need to re-create a field that
              already exists, or you&apos;ll have families answering the same thing twice.
            </p>
          </Section>

        </>
      )}

      {tab === "cancel" && (
        <>
          <Section
            title="Cancellation & refunds"
            lede="The usual policies, ready to use — edit the numbers and rename them to suit you. You pick one for each listing as you build it, and the first is what a new listing starts on. The wording writes itself from the rules, so what a parent is told and what gets worked out when they cancel can never say different things."
          >
            <PolicyList policies={settings.cancellationPolicies} onChange={(v) => set("cancellationPolicies", v)} />

            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5">
              <Row
                label="When a refund is due"
                hint="Right now nothing moves money on its own — every refund waits for you, and you action it in your own payment provider. Automatic would issue it through Stripe the moment the policy works one out."
                note="Automatic needs building (Amir)"
              >
                <Select
                  value={settings.refundApproval}
                  onChange={(e) => set("refundApproval", e.target.value as TenantSettings["refundApproval"])}
                >
                  <option value="review">Flag it for me to approve</option>
                  <option value="auto">Issue it automatically</option>
                </Select>
              </Row>
              {settings.refundApproval === "auto" && (
                <NotWired>
                  A refund can&apos;t be un-sent. Until this is built, refunds still wait for you —
                  which is the safe way round for it to be wrong.
                </NotWired>
              )}
            </div>
          </Section>
          <Section
            title="Cancellation reasons"
            lede="Offered when a booking is cancelled, so you can report on why places are being lost."
          >
            <Row label="Ask you for a reason" hint="Off means you're never made to answer — cancel and move on.">
              <Toggle on={settings.askReasonOperator} onChange={(v) => set("askReasonOperator", v)} />
            </Row>
            <Row
              label="Ask parents for a reason"
              hint="When a parent cancels their own booking. Useful for spotting patterns, but it's one more step between them and a thing they've already decided to do."
              note="Parents can't self-cancel yet (Amir)"
            >
              <Toggle on={settings.askReasonParent} onChange={(v) => set("askReasonParent", v)} />
            </Row>
            <div className="mt-2.5">
            <ReasonEditor items={settings.cancellationReasons} onChange={(v) => set("cancellationReasons", v)} />
            </div>
          </Section>
        </>
      )}

      {tab === "defaults" && (
        <>
          <Section title="Defaults for a new listing" lede="What a new listing starts with. You can still change any of it per listing.">
            <Row label="Capacity" hint="A tutoring provider's default is 8; a holiday camp's is 60.">
              <NumberBox value={settings.defaultCapacity} onChange={(n) => set("defaultCapacity", n)} min={1} max={999} suffix="places" />
            </Row>
            <Row label="Days it runs" hint="Weekend-only providers shouldn't have to untick five boxes on every listing.">
              <div className="flex gap-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                  const on = settings.defaultRunningDays.includes(i + 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        set(
                          "defaultRunningDays",
                          on ? settings.defaultRunningDays.filter((x) => x !== i + 1) : [...settings.defaultRunningDays, i + 1].sort(),
                        )
                      }
                      className="h-7 w-7 rounded-full border text-[11px] font-bold"
                      style={on ? { borderColor: "transparent", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row label="Show places left to parents" hint="Off hides remaining-place counts on your booking page entirely. When it&rsquo;s on, the &ldquo;only N places left&rdquo; note appears on its own at a third of capacity, capped at five — so an 8-place class warns at 3 and a 60-place camp warns at 5. Nothing to set.">
              <Toggle on={settings.showSpaces} onChange={(v) => set("showSpaces", v)} />
            </Row>
          </Section>
        </>
      )}

      {tab === "bookings" && (
        <>
          <Section
            title="How parents pay"
            lede="How you record payment when you take a booking yourself — over the phone, or for a funded or free place. These are stored on the booking and drive the funding column in your exports."
          >
            <ListEditor
              items={settings.payMethods}
              onChange={(v) => set("payMethods", v)}
              placeholder="e.g. Standing order"
              warn="Bookings already recorded against it keep the method. It just stops being offered on new ones."
            />
            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">Parents booking online see a different list</b> —
              Card, Bank transfer and Cash on the day. Those three are payment rails rather than
              labels: &ldquo;Card&rdquo; sends them to Stripe and the others don&rsquo;t, so renaming
              them here would break where the money goes. The list above is for bookings
              <i> you</i> record.
              <br />
              <br />
              A booking that comes to <b>£0</b> &mdash; a funded or free place &mdash; skips payment
              entirely. No invoice, no payment link.
            </div>
          </Section>
        </>
      )}

      {tab === "vouchers" && (
        <>
          <Section
            title="Childcare vouchers"
            lede="Parents paying by employer voucher pay on their scheme’s own website, not here — so they need whatever that scheme asks for. Some want an account number, some your setting name, some an Ofsted number, so the labels are yours to write. Fill in the schemes you’re registered with; anything left blank isn’t offered."
          >
            <VoucherEditor items={settings.voucherProviders} onChange={(v) => set("voucherProviders", v)} />

            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5">
              <Row
                label="Hold the place for"
                hint="After this the booking is flagged for you to look at — nothing is cancelled automatically. That's deliberate: if you're a day late reconciling a payment that did arrive, an automatic cancellation would throw away a family's booking over your admin. The call stays yours."
                note="The flag needs building (Amir)"
              >
                <NumberBox value={settings.voucherHoldDays} onChange={(n) => set("voucherHoldDays", n)} min={1} max={60} suffix="days" />
              </Row>
              <Row
                label="Money must reach you"
                hint="Most providers want it in before the child turns up. Set how far ahead — the parent is told to send it earlier still, since voucher money spends a few days in transit."
              >
                <Select value={String(settings.voucherDueByDays)} onChange={(e) => set("voucherDueByDays", Number(e.target.value))}>
                  <option value="0">By the day it starts</option>
                  <option value="1">The day before it starts</option>
                  <option value="2">2 days before</option>
                  <option value="3">3 days before</option>
                  <option value="7">A week before</option>
                </Select>
              </Row>
              <Row
                label="If it starts too soon"
                hint="A camp starting tomorrow can't be paid for by voucher in time. What happens then is your call — the parent is told what's going on either way."
                note={settings.voucherWhenClose === "approve" ? "Holding for approval needs building (Amir)" : undefined}
              >
                <Select value={settings.voucherWhenClose} onChange={(e) => set("voucherWhenClose", e.target.value as TenantSettings["voucherWhenClose"])}>
                  <option value="hide">Don&rsquo;t offer vouchers</option>
                  <option value="warn">Offer them, but warn</option>
                  <option value="approve">Offer them, but I approve first</option>
                  <option value="normal">Take it as a normal booking</option>
                </Select>
              </Row>
              <Row
                label="Voucher money takes"
                hint="How long it takes to reach you. Vouchers aren't offered on a booking starting sooner than this — a payment that can't arrive in time isn't a payment, it's you chasing someone on the morning of the camp."
              >
                <NumberBox value={settings.voucherClearDays} onChange={(n) => set("voucherClearDays", n)} min={0} max={14} suffix="days" />
              </Row>
            </div>

            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">Tax-Free Childcare isn’t here.</b> It’s HMRC rather
              than an employer scheme, it uses your Ofsted number, and it’s getting its own
              reconciliation — so it stays a payment method in its own right.
            </div>
          </Section>
        </>
      )}

      {tab === "groups" && (
        <>
          <Section
            title="Age groups & rooms"
            lede="Set your age groups once, here. Each has a colour, an age band, a target staffing ratio and a room size — the most children that group can hold. These are used everywhere: the Ratios & groups board, the cover calculator, and the age limits on every listing."
          >
            <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel,#fbf8fc)] px-3.5 py-3 text-[12px] leading-[1.6] text-[var(--ink-2)]">
              <div className="mb-1 font-extrabold text-[var(--ink)]">Why this lives here, not in a listing</div>
              These groups are your <b>one master record</b>. A listing can&rsquo;t change them —
              when you set an age limit on a listing, you&rsquo;re only choosing how many of an
              <em> existing</em> group to take that camp, and you can only go <b>below</b> the room
              size, never above it. So a listing can never quietly contradict what you set here: the
              room size is always the hard ceiling. Change a name, colour, ratio or room size here and
              it updates the Ratios board and every listing at once.
            </div>
            <GroupsEditor groups={settings.ratioGroups} onChange={(v) => set("ratioGroups", v)} />
            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-1">
              <Row
                label="Let a listing adjust a group's age range"
                hint="Off: the age bands above are fixed everywhere and can't be touched from a listing. On: a listing can narrow or shift a band for that camp only — e.g. run Explorers as 8–12 for one holiday club while the group stays 8–10 everywhere else. It only ever changes that listing; the master here, the Ratios board and your other listings are untouched. Names, colours, ratios and room sizes stay fixed here regardless."
              >
                <Toggle on={settings.allowListingAgeRange} onChange={(v) => set("allowListingAgeRange", v)} />
              </Row>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11.5px] leading-[1.6] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">Room size vs listing cap.</b> Room size is the physical
              limit of the space — what the group can ever hold. A <b>listing&rsquo;s</b> age cap is a
              per-camp choice, e.g. &ldquo;only take 10 of the 20 this week&rdquo;. Statutory EYFS ratios for
              the under-5s are applied automatically on the Ratios page and aren&rsquo;t set here.
            </div>
          </Section>
        </>
      )}

    </OperatorPage>
  );
}
