"use client";
/*
 * CourseFigures — detailed, responsive diagrams rendered inline in lessons via
 * the { k: "figure", fig } block. Built as HTML/CSS (not SVG) so text wraps
 * cleanly and never clips. Themed to the course accent (var(--accent) etc.).
 */
import type { ReactNode } from "react";

const GOOD = "#16a34a", WARN = "#d97706", BAD = "#dc2626", COOL = "#2563eb";
const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", ...extra });
const H = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>{children}</div>;

function StepGrid() {
  const items = [
    { k: "S", t: "Space", e: "📐", ex: "Bigger area, more time", hd: "Smaller area, add pressure" },
    { k: "T", t: "Task", e: "🎯", ex: "Simpler skill, more attempts", hd: "Add rules, combine skills" },
    { k: "E", t: "Equipment", e: "🎒", ex: "Bigger/softer ball, lower net", hd: "Smaller ball, higher target" },
    { k: "P", t: "People", e: "👥", ex: "Work with a partner", hd: "Add defenders, bigger teams" },
  ];
  return <div>
    <H>STEP — adapt any activity to include everyone</H>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {items.map((i) => <div key={i.k} style={card()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 8, background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: 13 }}>{i.k}</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{i.e} {i.t}</span>
        </div>
        <div style={{ fontSize: 12, color: GOOD, fontWeight: 600 }}>↓ Easier: {i.ex}</div>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 600 }}>↑ Harder: {i.hd}</div>
      </div>)}
    </div>
  </div>;
}

function SessionFlow() {
  const phases = [{ t: "Welcome & warm-up", e: "👋", s: "Settle, raise pulse, fun" }, { t: "Skill focus", e: "🎯", s: "Teach & practise" }, { t: "Game / apply", e: "⚽", s: "Use it in a game" }, { t: "Cool-down & review", e: "🧊", s: "Calm, praise, recap" }];
  return <div>
    <H>The shape of a great session</H>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 6 }}>
      {phases.map((p, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 130px" }}>
        <div style={{ ...card({ flex: 1, borderTop: "3px solid var(--accent)" }) }}>
          <div style={{ fontSize: 20 }}>{p.e}</div>
          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{p.t}</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{p.s}</div>
        </div>
        {i < phases.length - 1 && <span style={{ color: "var(--accent)", fontWeight: 800, fontSize: 18 }}>→</span>}
      </div>)}
    </div>
  </div>;
}

function InclusionSpectrum() {
  const rungs = [
    { t: "Open", d: "Everyone does the same activity, no changes needed", c: GOOD },
    { t: "Modified", d: "Same activity, adapted with STEP for some children", c: "#65a30d" },
    { t: "Parallel", d: "Same activity, grouped by ability so all are challenged", c: WARN },
    { t: "Separate", d: "A different activity for an individual or group", c: "#ea580c" },
    { t: "Disability sport", d: "A specific sport (e.g. boccia) everyone can try", c: COOL },
  ];
  return <div>
    <H>The Inclusion Spectrum — choose the least change that includes everyone</H>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rungs.map((r, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, ...card({ padding: "9px 12px", borderLeft: `5px solid ${r.c}` }) }}>
        <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: r.c, color: "#fff", fontWeight: 800, fontSize: 12, flex: "0 0 auto" }}>{i + 1}</span>
        <div><span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14 }}>{r.t}</span> <span style={{ color: "var(--ink-2)", fontSize: 13 }}>— {r.d}</span></div>
      </div>)}
    </div>
  </div>;
}

function CoachingStyles() {
  return <div>
    <H>The coaching styles spectrum</H>
    <div style={{ ...card() }}>
      <div style={{ height: 12, borderRadius: 99, background: "linear-gradient(90deg, var(--accent), #22b4a6)", marginBottom: 6 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>
        <span>◀ Command<br /><span style={{ fontWeight: 500 }}>coach decides — good for safety &amp; new skills</span></span>
        <span style={{ textAlign: "right" }}>Guided discovery ▶<br /><span style={{ fontWeight: 500 }}>child solves it — builds thinking &amp; ownership</span></span>
      </div>
    </div>
  </div>;
}

function FeedbackFlow() {
  const steps = [{ t: "Praise", e: "👍", s: "Name what they did well" }, { t: "Question", e: "❓", s: "\"What could you try next?\"" }, { t: "Prompt", e: "➡️", s: "One clear thing to change" }];
  return <div>
    <H>Feedback that sticks: praise → question → prompt</H>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {steps.map((p, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 150px" }}>
        <div style={{ ...card({ flex: 1 }) }}><div style={{ fontSize: 18 }}>{p.e}</div><div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{p.t}</div><div style={{ fontSize: 12, color: "var(--ink-2)" }}>{p.s}</div></div>
        {i < steps.length - 1 && <span style={{ color: "var(--accent)", fontWeight: 800 }}>→</span>}
      </div>)}
    </div>
  </div>;
}

function FourCs() {
  const cs = [{ t: "Cleaning", e: "🧼", s: "Clean as you go; disinfect surfaces" }, { t: "Cooking", e: "🔥", s: "Core 75°C (or 70°C for 2 min)" }, { t: "Chilling", e: "❄️", s: "Fridge 5°C or below" }, { t: "Cross-contamination", e: "🔀", s: "Separate raw & ready-to-eat" }];
  return <div>
    <H>The 4 Cs of food safety</H>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {cs.map((c) => <div key={c.t} style={{ ...card({ borderTop: "3px solid var(--accent)" }) }}><div style={{ fontSize: 22 }}>{c.e}</div><div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{c.t}</div><div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{c.s}</div></div>)}
    </div>
  </div>;
}

function DangerZone() {
  const bands = [
    { r: "75°C+", d: "Cooking / reheat — core temperature", c: GOOD },
    { r: "63°C+", d: "Hot-holding safe above this", c: "#65a30d" },
    { r: "8–63°C", d: "DANGER ZONE — bacteria multiply fast", c: BAD },
    { r: "0–5°C", d: "Fridge — keep chilled food here", c: COOL },
    { r: "−18°C", d: "Freezer", c: "#1d4ed8" },
  ];
  return <div>
    <H>The temperature danger zone</H>
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {bands.map((b, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: b.c, color: "#fff" }}>
        <span style={{ fontWeight: 800, fontSize: 14, minWidth: 66 }}>{b.r}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{b.d}</span>
      </div>)}
    </div>
  </div>;
}

function Handwash() {
  const steps = ["Wet hands", "Add soap", "Rub palms & backs", "Between fingers & thumbs", "Rinse well", "Dry thoroughly"];
  return <div>
    <H>Handwashing — the six steps</H>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {steps.map((s, i) => <div key={i} style={{ ...card({ flex: "1 1 120px", display: "flex", gap: 8, alignItems: "center" }) }}>
        <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: 12, flex: "0 0 auto" }}>{i + 1}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{s}</span>
      </div>)}
    </div>
  </div>;
}

function Allergens() {
  const a = ["Cereals with gluten", "Crustaceans", "Eggs", "Fish", "Peanuts", "Soybeans", "Milk", "Tree nuts", "Celery", "Mustard", "Sesame", "Sulphites", "Lupin", "Molluscs"];
  return <div>
    <H>The 14 allergens you must declare</H>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {a.map((x, i) => <span key={i} style={{ padding: "5px 10px", borderRadius: 99, background: "var(--accent-soft, #eef4fd)", color: "var(--accent)", fontSize: 12.5, fontWeight: 700, border: "1px solid var(--line)" }}>{x}</span>)}
    </div>
  </div>;
}

const FIGS: Record<string, () => ReactNode> = {
  step: StepGrid, session: SessionFlow, inclusion: InclusionSpectrum, "coaching-styles": CoachingStyles,
  feedback: FeedbackFlow, "4cs": FourCs, "danger-zone": DangerZone, handwash: Handwash, allergens: Allergens,
};
export const FIGURE_KEYS = Object.keys(FIGS);

export function Figure({ fig, caption }: { fig: string; caption?: string }) {
  const F = FIGS[fig];
  if (!F) return null;
  return <figure className="my-4" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 14 }}>
    <F />
    {caption && <figcaption style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>{caption}</figcaption>}
  </figure>;
}
