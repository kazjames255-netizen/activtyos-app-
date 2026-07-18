"use client";

// ─────────────────────────────────────────────────────────────────────────
// The checkout, for both audiences. An operator books on someone's behalf so
// starts by finding the parent; a parent already is the parent, so that step
// doesn't exist for them and they get a payment method instead. Everything
// between — children per pass, extras per child per day, discounts — is the
// same code, because it's the same job.
//
// Two stages for a parent: settle who's on which pass, then choose extras.
// Extras are per child per day, so they can't be picked until the first is
// right.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { get as apiGet, api, del } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { fmtDate, ordinal } from "./format";
import type { useBooking, BasketItem } from "./booking";
import type { AddonTemplate, LocalState } from "./FreelancerListingsApp";
import type { WizardDraft } from "./ListingWizard";

export function useParents(skip = false) {
  const [list, setList] = useState<{ id: string; name: string; email?: string }[]>([]);
  // Derived, not set in the effect: a parent never has an address book to load.
  const [state, setState] = useState<"loading" | "ready" | "error">(skip ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (skip) return; // parents can't read /api/customers, and shouldn't
    let alive = true;
    apiGet<{ id: string; name?: string; email?: string }[]>("/api/customers")
      .then((cs) => {
        if (!alive) return;
        setList(cs.map((c) => ({ id: c.id, name: c.name || c.email || "Unnamed", email: c.email })));
        setState("ready");
      })
      // An empty address book and a failed request look identical otherwise.
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Couldn't load your parents.");
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [skip]);
  return { list, state, error };
}
export type CkTheme = { bg: string; line: string; ink: string; muted: string; accent: string; accentInk: string; round: string; inputBg: string };
export type ChildProfile = {
  id?: string; name: string; dob?: string;
  allergies?: string; medical?: string; likes?: string; dislikes?: string;
  photoConsent?: boolean;
};
export function ageOn(dob: string | undefined, iso: string): number | null {
  if (!dob || !iso) return null;
  const b = new Date(`${dob}T00:00:00Z`), on = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(on.getTime())) return null;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}
export function ageProblem(d: WizardDraft, c: ChildProfile): string | null {
  if (d.allowOutOfRange) return null; // the operator has said they'll take them
  const from = parseInt(d.ageFrom, 10), to = parseInt(d.ageTo, 10);
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
  const age = ageOn(c.dob, d.runFrom);
  if (age === null) return null; // no date of birth yet — nothing to judge
  if (Number.isFinite(from) && age < from) return `${c.name || "This child"} would be ${age} — this listing is for ${d.ageFrom}–${d.ageTo}.`;
  if (Number.isFinite(to) && age > to) return `${c.name || "This child"} would be ${age} — this listing is for ${d.ageFrom}–${d.ageTo}.`;
  return null;
}
export function ChildrenPanel({ d, tk, saved, roster, setRoster, comingCount, onUnassignAll, onAssignAll }: {
  d: WizardDraft; tk: CkTheme;
  saved: ChildProfile[];
  roster: ChildProfile[];
  setRoster: (c: ChildProfile[]) => void;
  /** How many basket lines this child is currently on. */
  comingCount: (name: string) => number;
  onUnassignAll: (name: string) => void;
  onAssignAll: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChildProfile>({ name: "", photoConsent: false });
  const label = { fontSize: 10, letterSpacing: "0.12em" } as const;
  const inp = `w-full border px-2.5 py-2 text-[12.5px] outline-none ${tk.round}`;
  const inpStyle = { background: tk.inputBg, borderColor: tk.line, color: tk.ink };
  const problem = draft.name.trim() ? ageProblem(d, draft) : null;

  const add = () => {
    if (!draft.name.trim() || problem) return;
    if (editing !== null) {
      setRoster(roster.map((c, i) => (i === editing ? draft : c)));
      // Keep their saved profile in step with the edit, when there is one.
      if (draft.id) void api(`/api/my/children/${encodeURIComponent(draft.id)}`, { method: "PUT", body: JSON.stringify(draft) }).catch(() => {});
    } else {
      setRoster([...roster, draft]);
    }
    setDraft({ name: "", photoConsent: false });
    setEditing(null);
    setOpen(false);
  };

  /** Removing is deleting them from the account — worth asking about. */
  const remove = (i: number) => {
    const c = roster[i];
    const savedProfile = !!c.id;
    const msg = savedProfile
      ? `Remove ${c.name} from your account?\n\nThis deletes their details — allergies, medical, likes and dislikes — and you'd have to enter them again next time.\n\nTo keep the profile and just leave them off this booking, use "Not coming" instead.`
      : `Remove ${c.name}?\n\nYou haven't saved their details yet, so they'll be lost.`;
    if (!confirm(msg)) return;
    if (c.id) void del(`/api/my/children/${encodeURIComponent(c.id)}`).catch(() => {});
    setRoster(roster.filter((_, n) => n !== i));
  };

  return (
    <>
      <div className="mt-4 font-bold uppercase" style={{ ...label, color: tk.muted }}>Your children</div>

      {saved.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[11px]" style={{ color: tk.muted }}>Tap to add — we&rsquo;ll remember the details you gave us.</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {saved.filter((sv) => !roster.some((r) => r.id === sv.id || r.name === sv.name)).map((sv) => {
              const bad = ageProblem(d, sv);
              return (
                <button key={sv.id ?? sv.name} type="button" disabled={!!bad} title={bad ?? undefined}
                  onClick={() => setRoster([...roster, sv])}
                  className={`border px-3 py-1.5 text-[12px] font-bold disabled:opacity-45 ${tk.round}`}
                  style={{ borderColor: tk.line, color: tk.ink }}>
                  + {sv.name}{bad ? " · out of age range" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {roster.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {roster.map((c, i) => {
            const on = comingCount(c.name.trim());
            return (
              <div key={`${c.name}-${i}`} className={`border px-3 py-2 ${tk.round}`}
                style={{ borderColor: on ? tk.accent : tk.line, background: on ? `${tk.accent}1a` : "transparent" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 text-[12.5px] font-bold" style={{ color: on ? tk.ink : tk.muted }}>
                    {c.name}
                    {c.dob && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: tk.muted }}>age {ageOn(c.dob, d.runFrom) ?? "—"}</span>}
                    {!on && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: tk.muted }}>· not on this booking</span>}
                  </span>
                  <button type="button" onClick={() => { setDraft(c); setEditing(i); setOpen(true); }}
                    className="text-[11.5px] font-bold" style={{ color: tk.muted }}>Edit details</button>
                  <button type="button" onClick={() => (on ? onUnassignAll(c.name.trim()) : onAssignAll(c.name.trim()))}
                    className="text-[11.5px] font-bold" style={{ color: tk.muted }}>{on ? "Not coming" : "Add to all"}</button>
                  <button type="button" onClick={() => remove(i)}
                    className="text-[11.5px] font-bold" style={{ color: "#dc2626" }}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className={`mt-2 w-full border border-dashed px-3 py-2 text-[12.5px] font-bold ${tk.round}`}
          style={{ borderColor: tk.line, color: tk.ink }}>
          ＋ Add a child
        </button>
      ) : (
        <div className={`mt-2 border p-3 ${tk.round}`} style={{ borderColor: tk.line }}>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[150px] flex-1">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.muted }}>Child&rsquo;s name</div>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} style={inpStyle} />
            </div>
            <div className="w-[150px]">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.muted }}>Date of birth</div>
              <input type="date" value={draft.dob ?? ""} onChange={(e) => setDraft({ ...draft, dob: e.target.value })} className={inp} style={inpStyle} />
            </div>
          </div>

          {problem && (
            <div className="mt-2 text-[11.5px] font-semibold" style={{ color: "#dc2626" }}>{problem}</div>
          )}

          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.muted }}>Allergies <span className="font-normal">— optional</span></div>
            <input value={draft.allergies ?? ""} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
              placeholder="Nuts, dairy…" className={inp} style={inpStyle} />
          </div>
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.muted }}>Medical <span className="font-normal">— optional</span></div>
            <input value={draft.medical ?? ""} onChange={(e) => setDraft({ ...draft, medical: e.target.value })}
              placeholder="Asthma inhaler, epilepsy plan…" className={inp} style={inpStyle} />
          </div>
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.muted }}>Likes &amp; dislikes <span className="font-normal">— optional</span></div>
            <div className="mb-1 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
              What settles them and what doesn&rsquo;t — football and drawing, or loud rooms and being rushed. It helps staff on day one.
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={draft.likes ?? ""} onChange={(e) => setDraft({ ...draft, likes: e.target.value })}
                placeholder="Likes…" className={`${inp} min-w-[130px] flex-1`} style={inpStyle} />
              <input value={draft.dislikes ?? ""} onChange={(e) => setDraft({ ...draft, dislikes: e.target.value })}
                placeholder="Dislikes…" className={`${inp} min-w-[130px] flex-1`} style={inpStyle} />
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex-1 text-[12px]" style={{ color: tk.ink }}>Happy for photos of them to be used?</span>
            {[["Yes", true], ["No", false]].map(([l, v]) => (
              <button key={String(l)} type="button" onClick={() => setDraft({ ...draft, photoConsent: v as boolean })}
                className={`border px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                style={draft.photoConsent === v
                  ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                  : { borderColor: tk.line, color: tk.muted }}>{l as string}</button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={add} disabled={!draft.name.trim() || !!problem}
              className={`flex-1 py-2 text-[12.5px] font-extrabold disabled:opacity-40 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>{editing !== null ? "Save details" : "Add child"}</button>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); setDraft({ name: "", photoConsent: false }); }}
              className="text-[12px] font-bold" style={{ color: tk.muted }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
export function CheckoutPanel({ b, d, addons, tk, mode = "operator", onBook, booking }: {
  b: ReturnType<typeof useBooking>; d: WizardDraft; addons: LocalState["addons"]; tk: CkTheme;
  mode?: "operator" | "parent";
  onBook?: (p: { method: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>> }) => void;
  booking?: { busy: boolean; error: string | null };
}) {
  const parentMode = mode === "parent";
  const { list: parents, state: parentsState, error: parentsError } = useParents(parentMode);
  const [method, setMethod] = useState("card");
  // Two stages. Sorting out who's on which pass and picking everyone's lunches
  // at the same time is two jobs on one screen; the first has to be right
  // before the second even makes sense.
  const [ckStage, setCkStage] = useState<"who" | "extras" | "pay">("who");
  const [extraIdx, setExtraIdx] = useState(0);
  // Per-day extras first, one-offs last: a t-shirt is a yes/no and belongs
  // after the choices that need thought.
  const ordered = [...addons].sort((m, n) => (m.type === "perday" ? 0 : 1) - (n.type === "perday" ? 0 : 1));
  const [saved, setSaved] = useState<ChildProfile[]>([]);
  const { roster, setRoster } = b;
  // Store the EXCEPTIONS, not the assignments: who has been taken off which
  // day. A child is therefore on everything the moment they're added, with no
  // seeding step to go wrong — the previous version tracked "who's new" in a
  // ref mutated inside a setState updater, which React re-runs, so a newly
  // added child could be filtered straight back out.
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState("");
  const matches = q.trim()
    ? parents.filter((p) => `${p.name} ${p.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  useEffect(() => {
    if (!parentMode) return;
    // Signed out this 401s, which is fine — they just type the details in.
    apiGet<ChildProfile[]>("/api/my/children").then(setSaved).catch(() => {});
  }, [parentMode]);
  // Each rule's saving, broken down by the basket line that earned it.
  const savingsOn = (id: string) => {
    const i = b.basket.findIndex((x) => x.id === id);
    if (i < 0) return [] as { name: string; amount: number; terms?: string }[];
    return b.discountLines
      .map((l) => ({ name: l.name, terms: l.terms, amount: l.perItem?.[i] ?? 0 }))
      .filter((l) => l.amount > 0.004);
  };
  const addonById = new Map(addons.map((a) => [a.id, a]));
  const costOf = (a: AddonTemplate, days: string[]) => (a.type === "perday" ? a.price * days.length : a.price);
  // Per child, because that's what an add-on is: a lunch each, a t-shirt each.
  // The server already charges them per child (it prices one line per child),
  // so showing one lunch for two children quoted a price we wouldn't honour.
  // Each child's extras are chosen separately, so the total is simply the sum
  // of what was chosen — no head-count multiplier guessing on their behalf.
  const addonTotal = b.basket.reduce((sum, item) => {
    const kids = parentMode ? b.childrenOn(item.id) : [""];
    return sum + kids.reduce((t, kid) => {
      const sel = b.addonSel[b.addonKey(item.id, kid)] ?? {};
      return t + Object.entries(sel).reduce((n, [aid, days]) => {
        const a = addonById.get(aid);
        return a ? n + costOf(a, days) : n;
      }, 0);
    }, 0);
  }, 0);
  const calculated = b.total + addonTotal;
  const grandTotal = b.totalOverride ?? calculated;
  // What makes a pass valid depends on how it was sold.
  //
  //   fixed block / any-N-days-in-a-week — the days are the pass, so at least
  //     one child has to be on all of them. Otherwise it's a shorter pass
  //     bought at the wrong price.
  //   any-N-days-across-the-run — the days are independent, so each one just
  //     needs somebody on it; it needn't be the same child throughout.
  // A pass is a block: a child is on all of its days or none. So the only
  // thing to check is that somebody is on each line.
  const shortPasses = !parentMode ? [] : b.basket.filter((x) => b.childrenOn(x.id).length === 0);

  // Overlapping passes: a 5 day pass covering the 27th–31st and a 4 day pass
  // covering the 28th–31st are easy to end up with, and nobody can attend the
  // same day twice — they'd be paying for it twice.
  const clashes = !parentMode ? [] : (() => {
    // Two sessions in one day are fine — a morning club and an afternoon one —
    // so this asks whether the times overlap, not just whether the dates match.
    const mins = (t?: string) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      return Number.isFinite(h) ? h * 60 + (m || 0) : null;
    };
    const overlaps = (a: BasketItem, c: BasketItem) => {
      const a1 = mins(a.start), a2 = mins(a.finish), c1 = mins(c.start), c2 = mins(c.finish);
      // Unknown times: treat as a clash rather than wave through a double
      // booking we can't rule out.
      if (a1 === null || a2 === null || c1 === null || c2 === null) return true;
      return a1 < c2 && c1 < a2;
    };
    const byChildDate = new Map<string, BasketItem[]>();
    for (const x of b.basket) {
      for (const name of b.childrenOn(x.id)) {
        for (const iso of x.dates) {
          const key = `${name}|${iso}`;
          byChildDate.set(key, [...(byChildDate.get(key) ?? []), x]);
        }
      }
    }
    const out: { name: string; iso: string; itemIds: string[] }[] = [];
    for (const [key, items] of byChildDate) {
      if (items.length < 2) continue;
      const hit = new Set<string>();
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
          if (overlaps(items[i], items[j])) { hit.add(items[i].id); hit.add(items[j].id); }
      if (!hit.size) continue;
      const [name, iso] = key.split("|");
      out.push({ name, iso, itemIds: [...hit] });
    }
    return out;
  })();
  const clashesOn = (id: string) => clashes.filter((c) => c.itemIds.includes(id));
  const unassigned = parentMode ? shortPasses.length : b.basket.filter((x) => !(b.assign[x.id] ?? "").trim()).length;
  const label = { fontSize: 10, letterSpacing: "0.12em" } as const;

  // Where we are in the sequence: dates, children, one step per extra, pay.
  const steps = parentMode ? ["Dates", "Children", ...ordered.map((_, i) => `Extra ${i + 1}`), "Pay"] : [];
  const stepNow = ckStage === "who" ? 1 : ckStage === "extras" ? 2 + extraIdx : steps.length - 1;

  return (
    <div className="p-5" style={{ background: tk.bg }}>
      {parentMode && steps.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5">
          {steps.map((name, i) => (
            <span key={name} className="flex flex-1 flex-col gap-1" title={name}>
              <span className="h-[3px] rounded-full transition-colors"
                style={{ background: i <= stepNow ? tk.accent : tk.line }} />
            </span>
          ))}
          <span className="ml-1 flex-none text-[10.5px] font-bold" style={{ color: tk.muted }}>
            {steps[stepNow]}
          </span>
        </div>
      )}
      {/* What's being booked. For a parent this is already spelled out on each
          line below — pass, dates, timing, price — so listing it again here was
          the same information twice. */}
      {!parentMode && (
        <div className="flex flex-col gap-2">
        {b.basket.map((x) => (
          <div key={x.id} className="flex items-start justify-between gap-3 text-[12.5px]">
            <span className="min-w-0">
              <b className="block" style={{ color: tk.ink }}>{x.name}</b>
              <span className="block text-[11px] leading-snug" style={{ color: tk.muted }}>
                {b.datesPretty(x.dates)}
              </span>
              {x.timing && <span className="block text-[11px] font-bold" style={{ color: tk.accent }}>🕘 {x.timing}</span>}
            </span>
            {parentMode ? (
              <b className="flex-none text-[12.5px]" style={{ color: tk.ink }}>{money(b.priceOf(x))}</b>
            ) : (
              <span className="flex flex-none items-center gap-1">
                <span className="text-[11px]" style={{ color: tk.muted }}>£</span>
                <input type="number" min={0} step="0.01" value={b.priceOf(x)}
                  onChange={(e) => b.setItemPrice(x.id, e.target.value === "" ? null : parseFloat(e.target.value))}
                  className={`w-[74px] border px-2 py-1 text-right text-[12.5px] font-bold outline-none ${tk.round}`}
                  style={{ background: tk.inputBg, borderColor: b.priceEdit[x.id] !== undefined ? tk.accent : tk.line, color: tk.ink }} />
              </span>
            )}
          </div>
        ))}
        {!parentMode && <div className="text-[10.5px]" style={{ color: tk.muted }}>Prices are editable — discounts recalculate from what you set.</div>}
      </div>
      )}

      {/* 1 · find the parent — operators only; a parent is already themselves */}
      {!parentMode && <div className="mt-4 font-bold uppercase" style={{ ...label, color: tk.muted }}>1 · Find parent</div>}
      {parentMode ? null : b.parent ? (
        <div className={`mt-2 flex items-center gap-2 border px-3 py-2 ${tk.round}`} style={{ borderColor: tk.accent, background: `${tk.accent}1a` }}>
          <span className="flex-1 text-[12.5px] font-bold" style={{ color: tk.ink }}>{b.parent.name}</span>
          <button type="button" onClick={() => b.setParent(null)} className="text-[11.5px] font-bold" style={{ color: tk.muted }}>Change</button>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…"
            className={`mt-2 w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
          <div className="mt-1 text-[10.5px]" style={{ color: parentsState === "error" ? "#dc2626" : tk.muted }}>
            {parentsState === "loading"
              ? "Loading your parents…"
              : parentsState === "error"
                ? `Couldn't load your parents — ${parentsError}`
                : parents.length === 0
                  ? "No parents registered to your account yet — type a name to book for someone new."
                  : `${parents.length} parent${parents.length === 1 ? "" : "s"} registered`}
          </div>
          {q.trim() && (
            <div className="mt-1.5 flex flex-col gap-1">
              {matches.map((p) => (
                <button key={p.id} type="button" onClick={() => { b.setParent(p); setQ(""); }}
                  className={`border px-3 py-2 text-left text-[12.5px] ${tk.round}`} style={{ borderColor: tk.line, color: tk.ink }}>
                  <b>{p.name}</b>{p.email ? <span className="ml-1.5 text-[11px]" style={{ color: tk.muted }}>{p.email}</span> : null}
                </button>
              ))}
              {matches.length === 0 && (
                <button type="button" onClick={() => { b.setParent({ id: "new", name: q.trim() }); setQ(""); }}
                  className={`border border-dashed px-3 py-2 text-left text-[12px] ${tk.round}`} style={{ borderColor: tk.line, color: tk.muted }}>
                  {parents.length === 0 ? `No parents registered yet — book for “${q.trim()}” as a new parent` : `No match — book for “${q.trim()}” as a new parent`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* 2 · a child and their extras, per pass */}
      {(parentMode || b.parent) && (
        <>
          {parentMode && (
            <ChildrenPanel d={d} tk={tk} saved={saved} roster={roster} setRoster={setRoster}
              comingCount={(name) => b.basket.filter((x) => b.childrenOn(x.id).includes(name)).length}
              onUnassignAll={(name) => b.basket.forEach((x) => { if (b.childrenOn(x.id).includes(name)) b.toggleChild(x.id, name); })}
              onAssignAll={(name) => b.basket.forEach((x) => { if (!b.childrenOn(x.id).includes(name)) b.toggleChild(x.id, name); })} />
          )}
          <div className="mt-4 font-bold uppercase" style={{ ...label, color: tk.muted }}>{parentMode ? "2 · Who's on each pass" : "2 · Who's going & extras"}</div>
          {!parentMode && (
            <div className="mt-2 flex gap-1.5">
              <input value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Add the same child to every pass…"
                className={`w-full border px-3 py-2 text-[12.5px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
              <button type="button" disabled={!bulk.trim()} onClick={() => { b.assignAll(bulk.trim()); setBulk(""); }}
                className={`flex-none px-3 text-[12px] font-bold disabled:opacity-40 ${tk.round}`} style={{ background: tk.accent, color: tk.accentInk }}>Add to all</button>
            </div>
          )}
          {parentMode && (
            <div className="mt-1.5 text-[11px]" style={{ color: tk.muted }}>
              {roster.length === 0
                ? "Add a child above and they'll go on everything — then take them off anything they're not coming to."
                : "Everyone's on everything. Tap a name to take them off. Multi-day passes are sold as a set, so a child is on all of it or none — use “Change which days” to move the days themselves."}
            </div>
          )}

          <div className="mt-2 flex flex-col gap-2">
            {b.basket.map((x) => {
              return (
                <div key={x.id} className={`border p-3 ${tk.round}`} style={{ borderColor: tk.line }}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[11.5px]" style={{ color: tk.muted }}>
                      <b style={{ color: tk.ink }}>{x.name}</b> · {b.datesPretty(x.dates)}
                      {x.timing && <span className="block text-[11px] font-bold" style={{ color: tk.accent }}>🕘 {x.timing}</span>}
                    </span>
                    {parentMode && (() => {
                      const heads = b.childrenOn(x.id).length;
                      return (
                        <span className="flex-none text-right text-[12px]">
                          <b style={{ color: tk.ink }}>{money(b.priceOf(x) * heads)}</b>
                          {heads > 1 && <span className="block text-[10.5px]" style={{ color: tk.muted }}>{money(b.priceOf(x))} × {heads}</span>}
                        </span>
                      );
                    })()}
                    {parentMode && (
                      <button type="button" onClick={() => b.removeItem(x.id)}
                        title={x.dates.length === 1 ? "Remove this day" : `Remove this ${x.dates.length}-day pass`}
                        className="flex-none px-1 text-[15px] leading-none"
                        style={{ color: tk.muted }}>×</button>
                    )}
                    {!parentMode && (
                      <input value={b.assign[x.id] ?? ""} onChange={(e) => b.assignTo(x.id, e.target.value)} placeholder="Child's name"
                        className={`w-[130px] flex-none border px-2.5 py-1.5 text-[12px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
                    )}
                  </div>

                  {/* Every day, not just the first few — you can't take a child
                      off a day the list doesn't show. */}
                  {parentMode && (
                    <div className="mt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: tk.muted }}>
                          {x.dates.length === 1 ? "Who's coming" : `Who's on all ${x.dates.length} days`}
                        </span>
                        {roster.length === 0 && <span className="text-[11px]" style={{ color: "#c2410c" }}>add a child above</span>}
                        {roster.map((c) => {
                          const name = c.name.trim();
                          const going = b.childrenOn(x.id).includes(name);
                          return (
                            <button key={name} type="button" onClick={() => b.toggleChild(x.id, name)}
                              title={x.dates.length === 1
                                ? (going ? `Take ${name} off this day` : `Put ${name} on this day`)
                                : (going ? `Take ${name} off this ${x.dates.length}-day pass` : `Put ${name} on this ${x.dates.length}-day pass`)}
                              className={`border px-2.5 py-[3px] text-[11.5px] font-bold ${tk.round}`}
                              style={going
                                ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                                : { borderColor: tk.line, color: tk.muted }}>
                              {going ? "✓ " : "+ "}{name.split(" ")[0]}
                            </button>
                          );
                        })}
                      </div>
                      {clashesOn(x.id).length > 0 && (
                        <div className="mt-1.5 border px-2.5 py-1.5 text-[11px] leading-[1.45]"
                          style={{ borderColor: "#fed7aa", background: "#fff7ed", color: "#9a3412" }}>
                          {[...new Set(clashesOn(x.id).map((c) => c.name))].join(" and ")} {clashesOn(x.id).length === 1 ? "is" : "are"} already
                          booked at this time on {[...new Set(clashesOn(x.id).map((c) => fmtDate(c.iso)))].join(", ")} in another pass.
                          Take them off one of the two, or pick a session at a different time.
                        </div>
                      )}
                      {b.childrenOn(x.id).length === 0 && roster.length > 0 && (
                        <div className="mt-1 text-[11px]" style={{ color: "#c2410c" }}>
                          Nobody&rsquo;s on this {x.dates.length === 1 ? "day" : "pass"} — remove it or put a child on it.
                        </div>
                      )}
                      {/* The saving on the line that earned it — a lump at the
                          bottom doesn't tell you which choice paid off. */}
                      {savingsOn(x.id).length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-0.5 border-t pt-1.5" style={{ borderColor: tk.line }}>
                          {savingsOn(x.id).map((sv) => (
                            <div key={sv.name} className="flex items-baseline justify-between gap-3 text-[11px]">
                              <span className="min-w-0" style={{ color: tk.muted }}>
                                {sv.name}
                                {sv.terms && <span className="ml-1 opacity-70">({sv.terms})</span>}
                              </span>
                              <span className="flex-none font-bold" style={{ color: tk.accent }}>−{money(sv.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => b.editDates(x.id)}
                        className="mt-1.5 text-[11px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
                        {x.dates.length === 1 ? "Change this date" : `Change which ${x.dates.length} days`}
                      </button>
                    </div>
                  )}

                  {/* Extras, per child. A sibling might want lunch on two days
                      and the other on all five, so each gets their own row —
                      and nothing is ticked for them by default. */}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* totals */}
      <div className="mt-4 border-t pt-3" style={{ borderColor: tk.line }}>
        {b.discountLines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-[11.5px]">
            <span className="min-w-0" style={{ color: tk.muted }}>
              {l.name}{l.terms && <span className="ml-1 opacity-70">({l.terms})</span>}
            </span>
            <b className="flex-none" style={{ color: tk.accent }}>−{money(l.amount)}</b>
          </div>
        ))}
        {addonTotal > 0 && (
          <div className="flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
            <span>Add-ons</span><b style={{ color: tk.ink }}>{money(addonTotal)}</b>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between text-[14px]">
          <span style={{ color: tk.muted }}>Total</span>
          <span className="flex items-baseline gap-2">
            {/* What it was BEFORE discounts — showing the discounted total here
                struck through said "£540, was £540". */}
            {(b.saved > 0 || b.totalOverride !== null) && <s className="text-[11px]" style={{ color: tk.muted }}>{money(b.subtotal + addonTotal)}</s>}
            <b style={{ color: tk.ink }}>{money(grandTotal)}</b>
          </span>
        </div>
        {/* Final say on the price — for a one-off arrangement a rule can't express. Operators only. */}
        {!parentMode && <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 text-[11.5px]" style={{ color: tk.muted }}>Override the total</span>
          <span className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: tk.muted }}>£</span>
            <input type="number" min={0} step="0.01" value={b.totalOverride ?? ""} placeholder={calculated.toFixed(2)}
              onChange={(e) => b.setTotalOverride(e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0))}
              className={`w-[86px] border px-2 py-1 text-right text-[12.5px] font-bold outline-none ${tk.round}`}
              style={{ background: tk.inputBg, borderColor: b.totalOverride !== null ? tk.accent : tk.line, color: tk.ink }} />
            {b.totalOverride !== null && (
              <button type="button" onClick={() => b.setTotalOverride(null)} className="text-[11px] font-bold" style={{ color: tk.muted }}>Reset</button>
            )}
          </span>
        </div>}
      </div>

      {parentMode && ckStage === "who" && (() => {
        const ready = roster.length > 0 && unassigned === 0 && shortPasses.length === 0 && clashes.length === 0;
        const next = addons.length > 0 ? "Next — add lunches and extras" : "Next — how you'll pay";
        return (
          <>
            <button type="button" disabled={!ready} onClick={() => { setExtraIdx(0); setCkStage(addons.length ? "extras" : "pay"); }}
              className={`mt-3 w-full py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>
              {roster.length === 0 ? "Add a child first"
                : clashes.length > 0 ? `${clashes[0].name} is booked twice at the same time on ${fmtDate(clashes[0].iso)}`
                : unassigned > 0 || shortPasses.length > 0 ? "Put a child on every pass"
                : next}
            </button>
            <button className="mt-2 w-full text-[12px] font-bold" style={{ color: tk.muted }} onClick={() => b.setStage("pick")}>← Back to dates</button>
          </>
        );
      })()}

      {/* Extras, one per step, in the panel — no popup. Same accent as the rest
          of the flow so moving between steps feels continuous. */}
      {parentMode && ckStage === "extras" && ordered[extraIdx] && (() => {
        const a = ordered[extraIdx];
        const perDay = a.type === "perday";
        const kids = [...new Set(b.basket.flatMap((x) => b.childrenOn(x.id)))];
        const anyPicked = b.basket.some((x) => kids.some((k) => b.addonDays(x.id, k, a.id).length > 0));
        const last = extraIdx === ordered.length - 1;
        const clearAll = () => b.basket.forEach((x) => kids.forEach((k) => b.setAddonDays(x.id, k, a.id, [])));
        const step = (n: number) => {
          if (n < 0) { if (extraIdx === 0) setCkStage("who"); else setExtraIdx(extraIdx - 1); return; }
          if (last) setCkStage("pay"); else setExtraIdx(extraIdx + 1);
        };
        return (
          <div key={a.id} className="aos-step mt-4">
            <div className="flex items-center gap-2.5">
              {a.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image} alt="" className="h-9 w-9 flex-none rounded-lg object-cover" />
              ) : a.emoji ? <span className="text-[22px]">{a.emoji}</span> : null}
              <div className="min-w-0 flex-1">
                <div className="font-bold uppercase" style={{ ...label, color: tk.muted }}>
                  Extra {extraIdx + 1} of {ordered.length}
                </div>
                <div className="text-[15px] font-extrabold" style={{ color: tk.ink }}>{a.name}</div>
              </div>
              <div className="flex-none text-right">
                <div className="text-[13px] font-extrabold" style={{ color: tk.ink }}>{money(a.price)}</div>
                <div className="text-[10.5px]" style={{ color: tk.muted }}>{perDay ? "per day" : "one-off"}</div>
              </div>
            </div>
            {a.description && <p className="mt-1.5 text-[12px] leading-[1.5]" style={{ color: tk.muted }}>{a.description}</p>}

            <div className="mt-3">
              {b.basket.map((x) => {
                const on = b.childrenOn(x.id);
                if (!on.length) return null;
                return (
                  <div key={x.id} className="mb-3 last:mb-0">
                    {b.basket.length > 1 && (
                      <div className="mb-1.5 text-[11px] font-bold" style={{ color: tk.muted }}>
                        {x.name} · {b.datesPretty(x.dates)}
                      </div>
                    )}
                    {on.map((kid) => {
                      const days = b.addonDays(x.id, kid, a.id);
                      const all = days.length === x.dates.length;
                      return (
                        <div key={kid} className="mb-2.5 last:mb-0">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <b className="min-w-0 truncate text-[13px]" style={{ color: tk.ink }}>{kid}</b>
                            {perDay ? (
                              <button type="button"
                                onClick={() => b.setAddonDays(x.id, kid, a.id, all ? [] : [...x.dates])}
                                className={`flex-none border px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                                style={{ borderColor: tk.line, color: tk.muted }}>
                                {all ? "Clear" : "Every day"}
                              </button>
                            ) : (
                              <button type="button"
                                onClick={() => b.setAddonDays(x.id, kid, a.id, days.length ? [] : ["*"])}
                                className={`flex-none border-2 px-4 py-1.5 text-[12.5px] font-extrabold ${tk.round}`}
                                style={days.length
                                  ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                                  : { borderColor: tk.line, color: tk.muted }}>
                                {days.length ? `✓ Yes · ${money(a.price)}` : "Add one"}
                              </button>
                            )}
                          </div>
                          {perDay && (
                            <div className="flex flex-wrap gap-1.5">
                              {x.dates.map((iso) => {
                                const active = days.includes(iso);
                                const dt = new Date(`${iso}T00:00:00Z`);
                                return (
                                  <button key={iso} type="button"
                                    onClick={() => b.setAddonDays(x.id, kid, a.id, active ? days.filter((dd) => dd !== iso) : [...days, iso])}
                                    className={`flex min-w-[58px] flex-col items-center gap-0.5 border-2 px-2 py-1.5 ${tk.round}`}
                                    style={active
                                      ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                                      : { borderColor: tk.line, color: tk.muted }}>
                                    <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] opacity-80">
                                      {dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                                    </span>
                                    <span className="text-[15px] font-extrabold leading-none">{ordinal(dt.getUTCDate())}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => step(-1)} className="text-[12px] font-bold" style={{ color: tk.muted }}>← Back</button>
              <button type="button" onClick={() => { clearAll(); step(1); }}
                className={`ml-auto border px-3 py-2 text-[12px] font-bold ${tk.round}`}
                style={{ borderColor: tk.line, color: tk.muted }}>No thanks</button>
              <button type="button" onClick={() => step(1)}
                className={`px-4 py-2 text-[12.5px] font-extrabold ${tk.round}`}
                style={{ background: tk.accent, color: tk.accentInk }}>
                {last ? (anyPicked ? "Done — how you'll pay" : "Skip — how you'll pay") : "Next"}
              </button>
            </div>
          </div>
        );
      })()}


      {parentMode && ckStage === "pay" && addons.length > 0 && (
        <button type="button" onClick={() => { setExtraIdx(0); setCkStage("extras"); }}
          className="mt-3 text-[11.5px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
          ← Change lunches &amp; extras
        </button>
      )}
      {parentMode && ckStage === "pay" && !addons.length && (
        <button type="button" onClick={() => setCkStage("who")}
          className="mt-3 text-[11.5px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
          ← Back to who&rsquo;s coming
        </button>
      )}
      {parentMode && ckStage === "pay" && (
        <div className="mt-3">
          <div className="font-bold uppercase" style={{ ...label, color: tk.muted }}>How you&rsquo;ll pay</div>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className={`mt-1.5 w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`}
            style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }}>
            <option value="card">Card</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash on the day</option>
          </select>
        </div>
      )}

      {booking?.error && (
        <div className="mt-2 text-[11.5px] font-semibold" style={{ color: "#dc2626" }}>{booking.error}</div>
      )}

      {(!parentMode || ckStage === "pay") && <button className={`mt-3 w-full py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${tk.round}`} style={{ background: tk.accent, color: tk.accentInk }}
        disabled={(!parentMode && !b.parent) || (parentMode && roster.length === 0) || unassigned > 0 || shortPasses.length > 0 || clashes.length > 0 || !!booking?.busy}
        onClick={() => {
          b.setChild(Object.values(b.assign).filter(Boolean).join(", "));
          // A parent's confirm actually books; the operator preview still just
          // shows the done screen until the operator flow is wired.
          if (parentMode && onBook) onBook({
            method, basket: b.basket, addonSel: b.addonSel, children: roster,
            // Resolved here so the caller gets plain "who's on what" rather than exceptions.
            dayAssign: Object.fromEntries(b.basket.map((x) => [x.id, Object.fromEntries(x.dates.map((iso) => [iso, b.childrenOn(x.id)]))])),
          });
          else b.setStage("done");
        }}>
        {booking?.busy ? "Booking…"
          : !parentMode && !b.parent ? "Find the parent first"
          : parentMode && roster.length === 0 ? "Add a child first"
          : unassigned > 0 ? `${unassigned} day${unassigned === 1 ? " has" : "s have"} nobody on ${unassigned === 1 ? "it" : "them"}`
          : clashes.length > 0 ? `${clashes[0].name} is booked twice at the same time on ${fmtDate(clashes[0].iso)}`
          : shortPasses.length > 0 ? `One child needs all ${shortPasses[0].dates.length} days of the ${shortPasses[0].name}`
          : `Confirm & pay ${money(grandTotal)}`}
      </button>}
      {!parentMode && <button className="mt-2 w-full text-[12px] font-bold" style={{ color: tk.muted }} onClick={() => b.setStage("pick")}>← Back to dates</button>}
      <div className="mt-2 text-[11px] leading-[1.5]" style={{ color: tk.muted }}>{d.cancellation}</div>
    </div>
  );
}
