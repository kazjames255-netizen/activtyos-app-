"use client";

// Milestones store: the head-office master template + each franchise's progress.
// Demo localStorage; backend owed (docs/milestones-handoff.md).
import { type MPhase, type MProgress, type MPhaseWhen, type StepState, isoDate } from "@/lib/milestones";

const TK = "aos.milestones.template.v1", PK = "aos.milestones.progress.v1";
const read = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id" + Math.floor(performance.now() * 1000));

const step = (title: string, detail: string, links: { label: string; href: string }[] = [], actions: string[] = []): MStep => ({ id: uid(), title, detail, links, actions: actions.map((t) => ({ id: uid(), title: t })) });
type MStep = MPhase["steps"][number];

// A sensible default plan HO can then edit. Deep links use /franchise/* routes.
export function seedTemplate(): MPhase[] {
  return [
    { id: uid(), title: "Get set up", subtitle: "One-time launch — do these once to open your doors.", when: "setup", recurring: false, icon: "🚀", steps: [
      step("Register your company & insurance", "Business details, public liability and employer's liability in place.", [{ label: "Setup", href: "/franchise/setup" }]),
      step("Safeguarding & DBS", "DBS checks and safeguarding training for you and every staff member.", [{ label: "Compliance", href: "/franchise/compliance" }]),
      step("Add your branding & provider name", "Logo, colours and the name parents will see.", [{ label: "Setup", href: "/franchise/setup" }]),
      step("Create your first venue & listing", "Add the venue and publish your first camp listing.", [{ label: "Listings", href: "/franchise/listings" }, { label: "Locations", href: "/franchise/locations" }]),
      step("Set pricing & payments", "Prices, deposits and connect your payout account.", [{ label: "Setup", href: "/franchise/setup" }]),
      step("Recruit & invite your first staff", "Send invites and set each person's role.", [{ label: "Team & invites", href: "/franchise/staff" }]),
    ] },
    { id: uid(), title: "Plan the season", subtitle: "The weeks before a holiday camp — get everything ready and packed.", when: "before", recurring: true, icon: "📦", steps: [
      step("Open bookings & publish the timetable", "Build blocks and put the timetable live for parents.", [{ label: "Blocks", href: "/franchise/blocks" }, { label: "Timetable", href: "/franchise/timetable" }]),
      step("Build the staff rota & check ratios", "Roster staff to sessions and confirm you're within ratios.", [{ label: "Schedule", href: "/franchise/schedule" }, { label: "Ratios", href: "/franchise/ratios" }]),
      step("Complete risk assessments", "Venue and activity risk assessments signed off.", [{ label: "Compliance", href: "/franchise/compliance" }]),
      step("Order & pack kit and resources", "Stock-check, order what's short and pack the camp boxes.", [{ label: "Inventory", href: "/franchise/inventory" }], ["Run a stock-check against the kit list", "Order anything short", "Pack a box per group", "Load first-aid kits & spill kit", "Check the equipment is safe & clean"]),
      step("Print registers", "Registers ready for each group and day.", [{ label: "Registers", href: "/franchise/registers" }]),
      step("Send parents pre-camp info", "What to bring, drop-off/pick-up and key info.", [{ label: "Messages", href: "/franchise/messages" }, { label: "Email", href: "/franchise/email" }]),
      step("Confirm meals & allergens", "Menu set and allergens cross-checked against bookings.", [{ label: "Meals", href: "/franchise/meals" }]),
    ] },
    { id: uid(), title: "Camp week — on the ground", subtitle: "During the camp — the daily running rhythm.", when: "during", recurring: true, icon: "⛺", steps: [
      step("Take sign-in on the register", "Mark children in at drop-off and track who's present.", [{ label: "Registers", href: "/franchise/registers" }], ["Greet each family at the door", "Mark the child present", "Confirm collection password", "Note allergies & medication", "Flag any no-shows to the office"]),
      step("Keep ratios right on the day", "Adjust staffing live if numbers change.", [{ label: "Ratios", href: "/franchise/ratios" }]),
      step("Log medication & incidents", "Record any medication given and any accidents/incidents.", [{ label: "Medication", href: "/franchise/medication" }, { label: "Incidents", href: "/franchise/incidents" }]),
      step("Share moments with parents", "Post photos and highlights during the day.", [{ label: "Moments", href: "/franchise/moments" }]),
      step("Close the register each day", "Sign children out and close the day's register.", [{ label: "Registers", href: "/franchise/registers" }]),
    ] },
    { id: uid(), title: "Wrap & review", subtitle: "After the season — close it out and learn from it.", when: "after", recurring: true, icon: "📊", steps: [
      step("Reconcile income & expenses", "Match takings and costs; check the season's numbers.", [{ label: "Reconciliation", href: "/franchise/reconciliation" }, { label: "Finance", href: "/franchise/finance" }]),
      step("Run payroll", "Approve hours and pay your team.", [{ label: "Payroll", href: "/franchise/payroll" }]),
      step("Send a parent feedback survey", "Gather reviews and NPS while it's fresh.", [{ label: "Email", href: "/franchise/email" }]),
      step("Staff debrief & appraisals", "What went well, what to fix; log feedback for reviews.", [{ label: "Team", href: "/franchise/staff" }]),
      step("Restock inventory", "Note what ran out and reorder for next time.", [{ label: "Inventory", href: "/franchise/inventory" }]),
    ] },
    { id: uid(), title: "After-school clubs", subtitle: "Setting up a term-time club — a parallel track to camps.", when: "clubs", recurring: false, icon: "🏫", steps: [
      step("Secure the school & agreement", "Confirm the venue, dates and any hire agreement.", [{ label: "Locations", href: "/franchise/locations" }]),
      step("Build the club timetable", "Weekly sessions and capacity per club.", [{ label: "Blocks", href: "/franchise/blocks" }]),
      step("Enrol children & set fees", "Open enrolment and set termly or weekly fees.", [{ label: "Listings", href: "/franchise/listings" }]),
      step("Weekly run sheet & registers", "A repeatable weekly routine and registers per club.", [{ label: "Registers", href: "/franchise/registers" }]),
    ] },
  ];
}

export const loadTemplate = (): MPhase[] => { const s = read<MPhase[]>(TK); return Array.isArray(s) && s.length ? s : seedTemplate(); };
export const saveTemplate = (p: MPhase[]) => write(TK, p);
export const resetTemplate = () => write(TK, seedTemplate());

// Seed a realistic dated plan: setup in the weeks before, then plan → run → wrap
// around "today", with clubs running across the term. Completion tapers off into
// the future so the roadmap reads as work-in-progress.
const PHASE_WIN: Record<MPhaseWhen, [number, number]> = { setup: [-46, -4], before: [-16, 6], during: [6, 16], after: [16, 26], clubs: [2, 46] };
export function seedProgress(phases: MPhase[]): MProgress {
  const now = new Date(); const day = 86400000; const addD = (n: number) => isoDate(new Date(now.getTime() + n * day));
  const steps: Record<string, StepState> = {};
  const who = ["Alex Rivera", "Sam Carter", "Jamie Cole"];
  phases.forEach((p, pi) => {
    const [a, b] = PHASE_WIN[p.when] || [0, 21]; const span = b - a; const nn = p.steps.length || 1;
    p.steps.forEach((s, i) => {
      const seg = span / nn; const st = a + i * seg; const en = st + seg * 0.82;
      const pct = pi === 0 ? 100 : pi === 1 ? (i < Math.floor(nn / 2) ? 100 : i === Math.floor(nn / 2) ? 55 : 15) : pi === 2 ? (i === 0 ? 20 : 0) : 0;
      const cell: StepState = { start: addD(Math.round(st)), end: addD(Math.round(en)), pct };
      // demo action states: assign each action + tick a share of them done
      if (s.actions?.length) {
        const done = Math.round((pct / 100) * s.actions.length);
        cell.actions = Object.fromEntries(s.actions.map((act, k) => [act.id, { done: k < done, assignee: who[k % who.length], due: addD(Math.round(st + k)) }]));
      }
      steps[s.id] = cell;
    });
  });
  return { season: "This season", steps };
}
export const loadProgress = (phases?: MPhase[]): MProgress => {
  const s = read<MProgress>(PK);
  if (s && s.steps && typeof s.steps === "object") return { season: s.season || "This season", steps: s.steps };
  return phases ? seedProgress(phases) : { season: "This season", steps: {} };
};
export const saveProgress = (p: MProgress) => write(PK, p);

// ── item 20: season history (snapshot on each new season) ────────────────────
const HK = "aos.milestones.history.v1";
export interface MSnapshot { season: string; overall: number; at: string }
export const loadHistory = (): MSnapshot[] => { const s = read<MSnapshot[]>(HK); return Array.isArray(s) ? s : []; };
export const pushHistory = (snap: MSnapshot) => { write(HK, [snap, ...loadHistory()].slice(0, 12)); };

export { uid as newId };
