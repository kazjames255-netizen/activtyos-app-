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
} from "@/lib/settings";

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

type Tab = "people" | "listings" | "bookings" | "families";

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

function Section({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3.5 p-4">
      <div className="text-[15px] font-extrabold">{title}</div>
      {lede && <p className="mb-2 mt-0.5 text-[12px] leading-[1.5] text-[var(--ink-3)]">{lede}</p>}
      {children}
    </Card>
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
    ["listings", "Listings & sessions"],
    ["bookings", "Bookings & payments"],
    ["families", "Families"],
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
          The four tabs match the four screens they govern. If a setting isn&apos;t here yet, it&apos;s
          because it&apos;s still fixed in the product — tell us and it moves.
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
                  : "Off lets you save a child from a phone enquiry before you have their DOB. Ages, age-range checks and ratio bands all need it, so they stay blank until it's filled in — and any question you give an age range to (a walk-home consent, say) can't be asked at all without it, so setting one will switch this back on."
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

      {tab === "listings" && (
        <>
          <Section
            title="Cancellation policies"
            lede="The wording offered when you build a listing. The first is the default on a new listing — put your usual one at the top."
          >
            <ListEditor
              items={settings.cancellationPolicies}
              onChange={(v) => set("cancellationPolicies", v)}
              placeholder="Add a policy — how it reads to a parent"
              warn="Listings already using this wording keep it. It just stops being offered."
            />
          </Section>

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
            <Row label="Show places left to parents" hint="Off hides remaining-place counts on your booking page entirely.">
              <Toggle on={settings.showSpaces} onChange={(v) => set("showSpaces", v)} />
            </Row>
            <Row note="Saved, not used yet — needs a field on the listing (Amir)" label='Say "only N places left" at' hint="Below this many, parents see a scarcity note. Set to 0 to never show it — five left out of sixty is not the same as five out of eight.">
              <NumberBox value={settings.lowPlacesAt} onChange={(n) => set("lowPlacesAt", n)} min={0} max={50} suffix="places" />
            </Row>
          </Section>
        </>
      )}

      {tab === "bookings" && (
        <>
          <Section
            title="How parents pay"
            lede="The payment methods you record when you take a booking yourself. These are stored on the booking and drive the funding column in your exports. Parents paying online still see Card, Bank transfer and Cash — those are payment rails, not labels, so they aren't renameable here."
          >
            <ListEditor
              items={settings.payMethods}
              onChange={(v) => set("payMethods", v)}
              placeholder="e.g. Standing order"
              warn="Bookings already recorded against it keep the method. It just stops being offered on new ones."
            />
          </Section>

          <Section
            title="Cancellation reasons"
            lede="Offered when you cancel a booking, so you can report on why places are being lost. Leave the list empty to keep typing a reason each time."
          >
            <NotWired>Saved here, but cancelling a booking still writes an automatic reason — wiring pending.</NotWired>
            <ListEditor items={settings.cancellationReasons} onChange={(v) => set("cancellationReasons", v)} placeholder="e.g. Coach unavailable" />
          </Section>
        </>
      )}

      {tab === "families" && (
        <>
          <Section
            title="Your pipeline"
            lede="The four stages on the Families screen. Rename them to your own language and set the colour each one shows in — the stage colour is also the family's tile colour."
          >
            {settings.pipelineStages.map((st, i) => (
              <div key={st.id} className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
                <input
                  type="color"
                  value={st.colour}
                  onChange={(e) => set("pipelineStages", settings.pipelineStages.map((x, j) => (j === i ? { ...x, colour: e.target.value } : x)))}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent p-0.5"
                  aria-label={`${st.label} colour`}
                />
                <Input
                  value={st.label}
                  onChange={(e) => set("pipelineStages", settings.pipelineStages.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className="w-[150px]"
                  maxLength={24}
                />
                <Input
                  value={st.hint}
                  onChange={(e) => set("pipelineStages", settings.pipelineStages.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))}
                  className="min-w-[200px] flex-1"
                  maxLength={60}
                />
              </div>
            ))}
            <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              The four stages themselves are fixed — a family moves between them automatically as
              they&apos;re invited and as they book, so the product needs to know which is which.
              What they&apos;re called and how they look is yours.
            </p>
          </Section>

          <Section title="When a family counts as repeat">
            <Row label="Bookings needed" hint="Two is right for a holiday-camp provider. A weekly club where every family books ten times a term will want it higher, or nobody is ever anything but 'repeat'.">
              <NumberBox value={settings.repeatAt} onChange={(n) => set("repeatAt", n)} min={2} max={20} suffix="bookings" />
            </Row>
          </Section>
        </>
      )}
    </OperatorPage>
  );
}
