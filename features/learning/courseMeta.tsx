"use client";
// Shared course catalogue theming — topical categories (colours), per-course
// meta (category / level / tags) and the coloured cover. Used by the manager
// Learning Centre AND the staff Certificates & courses page so both match.
import type { CourseDoc } from "./courseContent";

export type CatKey = "saf" | "inclusion" | "send" | "medical" | "health" | "digital" | "together";
export type Level = "Intro" | "Core" | "Advanced";

export const CATEGORIES: { key: CatKey; label: string; icon: string; ink: string; soft: string; grad: string }[] = [
  { key: "saf", label: "Safeguarding & child protection", icon: "🛡️", ink: "#1d3a8f", soft: "#eef4fd", grad: "linear-gradient(135deg,#1d3a8f,#3f7ae0)" },
  { key: "inclusion", label: "Inclusion & culture", icon: "🌍", ink: "#c2410c", soft: "#faece7", grad: "linear-gradient(135deg,#c2410c,#f59e0b)" },
  { key: "send", label: "SEND & wellbeing", icon: "🧠", ink: "#6d28d9", soft: "#f3effe", grad: "linear-gradient(135deg,#6d28d9,#a855f7)" },
  { key: "medical", label: "Medical awareness", icon: "💊", ink: "#b91c1c", soft: "#fdecec", grad: "linear-gradient(135deg,#b91c1c,#ef4444)" },
  { key: "health", label: "Health & safety", icon: "⛑️", ink: "#0f7a43", soft: "#eaf8f0", grad: "linear-gradient(135deg,#0f7a43,#37b26a)" },
  { key: "digital", label: "Digital & data", icon: "🌐", ink: "#0f766e", soft: "#e1f5ee", grad: "linear-gradient(135deg,#0f766e,#22b4a6)" },
  { key: "together", label: "Working together", icon: "🤝", ink: "#475569", soft: "#eef1f6", grad: "linear-gradient(135deg,#475569,#94a3b8)" },
];
export const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<CatKey, (typeof CATEGORIES)[number]>;
const LABEL_TO_KEY: Record<string, CatKey> = Object.fromEntries(CATEGORIES.map((c) => [c.label.toLowerCase(), c.key]));
// tolerate a stored key OR a free-text category label (for company-created custom categories)
export const catKeyOf = (v?: string): CatKey => { if (!v) return "together"; if (CAT_BY_KEY[v as CatKey]) return v as CatKey; return LABEL_TO_KEY[v.toLowerCase()] ?? "together"; };

export const COURSE_META: Record<string, { cat: CatKey; level: Level; tags: string[] }> = {
  c11: { cat: "saf", level: "Intro", tags: ["Awareness", "KCSIE 2025"] },
  c1: { cat: "saf", level: "Core", tags: ["KCSIE 2025", "Core"] },
  c40: { cat: "saf", level: "Core", tags: ["KCSIE 2026", "Update"] },
  c41: { cat: "health", level: "Core", tags: ["COSHH", "Chemicals"] },
  c42: { cat: "health", level: "Core", tags: ["DSE", "Workstation"] },
  c43: { cat: "health", level: "Core", tags: ["Slips, trips & falls"] },
  c44: { cat: "health", level: "Core", tags: ["PPE"] },
  c45: { cat: "health", level: "Core", tags: ["Electrical", "PAT"] },
  c46: { cat: "health", level: "Core", tags: ["Legionella", "Water"] },
  c47: { cat: "health", level: "Core", tags: ["Fire warden"] },
  c48: { cat: "medical", level: "Core", tags: ["First aid", "EFAW"] },
  c49: { cat: "medical", level: "Core", tags: ["Appointed person"] },
  c50: { cat: "health", level: "Core", tags: ["RIDDOR", "Reporting"] },
  c51: { cat: "health", level: "Core", tags: ["Work at height", "Ladders"] },
  c52: { cat: "health", level: "Core", tags: ["Asbestos"] },
  c53: { cat: "together", level: "Core", tags: ["Duty of care"] },
  c54: { cat: "together", level: "Core", tags: ["De-escalation"] },
  c55: { cat: "digital", level: "Core", tags: ["Cyber security"] },
  c56: { cat: "health", level: "Core", tags: ["Environment", "Sustainability"] },
  c57: { cat: "health", level: "Core", tags: ["Play equipment"] },
  c58: { cat: "health", level: "Core", tags: ["Transport", "Minibus"] },
  c59: { cat: "together", level: "Core", tags: ["Whistleblowing"] },
  c60: { cat: "health", level: "Core", tags: ["Evacuation", "Lockdown"] },
  c12: { cat: "saf", level: "Advanced", tags: ["DSL", "Statutory"] },
  c4: { cat: "saf", level: "Core", tags: ["Exploitation", "County lines"] },
  c16: { cat: "saf", level: "Core", tags: ["Exploitation"] },
  c17: { cat: "saf", level: "Core", tags: ["Mandatory reporting"] },
  c6: { cat: "saf", level: "Core", tags: ["Prevent", "Channel"] },
  c18: { cat: "saf", level: "Core", tags: ["Domestic abuse"] },
  c5: { cat: "saf", level: "Core", tags: ["Safe staffing", "DBS"] },
  c13: { cat: "send", level: "Core", tags: ["Autism", "SEND"] },
  c14: { cat: "send", level: "Intro", tags: ["ADHD", "Level 1", "Awareness"] },
  c61: { cat: "send", level: "Core", tags: ["ADHD", "Level 2", "Inclusive delivery"] },
  c62: { cat: "together", level: "Intro", tags: ["Coaching", "Level 1"] },
  c63: { cat: "together", level: "Core", tags: ["Coaching", "Level 2", "STEP"] },
  c64: { cat: "together", level: "Advanced", tags: ["Coaching", "Level 3", "Inclusive"] },
  c65: { cat: "health", level: "Intro", tags: ["Food safety", "Level 1"] },
  c66: { cat: "health", level: "Core", tags: ["Food safety", "Level 2", "SFBB"] },
  c15: { cat: "send", level: "Core", tags: ["Wellbeing"] },
  c3: { cat: "send", level: "Core", tags: ["Behaviour", "Trauma-informed"] },
  c8: { cat: "digital", level: "Core", tags: ["Online safety", "4 Cs"] },
  c9: { cat: "digital", level: "Core", tags: ["GDPR", "ICO"] },
  c7: { cat: "health", level: "Core", tags: ["Anaphylaxis", "AAI"] },
  c2: { cat: "health", level: "Core", tags: ["First aid", "CPR"] },
  c19: { cat: "health", level: "Core", tags: ["Food safety", "Allergens"] },
  c10: { cat: "health", level: "Core", tags: ["Fire safety"] },
  c20: { cat: "medical", level: "Core", tags: ["Medication", "MAR sheets"] },
  c21: { cat: "medical", level: "Core", tags: ["Epilepsy", "Seizures"] },
  c22: { cat: "medical", level: "Core", tags: ["Diabetes", "Type 1"] },
  c23: { cat: "medical", level: "Core", tags: ["Asthma", "Inhalers"] },
  c24: { cat: "health", level: "Core", tags: ["Risk assessment", "RIDDOR"] },
  c25: { cat: "health", level: "Core", tags: ["Trips", "EVOLVE"] },
  c26: { cat: "health", level: "Core", tags: ["Water safety"] },
  c27: { cat: "health", level: "Core", tags: ["Sun & heat"] },
  c28: { cat: "health", level: "Core", tags: ["Manual handling"] },
  c29: { cat: "health", level: "Core", tags: ["Lone working"] },
  c30: { cat: "health", level: "Core", tags: ["Infection control"] },
  c31: { cat: "inclusion", level: "Core", tags: ["Equality Act 2010", "EDI"] },
  c32: { cat: "inclusion", level: "Core", tags: ["Anti-bullying"] },
  c33: { cat: "inclusion", level: "Core", tags: ["SEND Code", "Inclusion"] },
  c34: { cat: "send", level: "Core", tags: ["ACEs", "Trauma-informed"] },
  c35: { cat: "send", level: "Core", tags: ["Development", "Attachment"] },
  c36: { cat: "send", level: "Core", tags: ["Bereavement"] },
  c37: { cat: "send", level: "Core", tags: ["Staff wellbeing"] },
  c38: { cat: "saf", level: "Core", tags: ["Modern slavery", "NRM"] },
  c39: { cat: "together", level: "Core", tags: ["Parents", "Complaints"] },
};
export const metaOf = (id: string): { cat: CatKey; level: Level; tags: string[] } => COURSE_META[id] ?? { cat: "saf", level: "Core", tags: [] };
export const catOf = (c: CourseDoc): CatKey => COURSE_META[c.id]?.cat ?? catKeyOf(c.category);
export const isPlatform = (id: string) => id in COURSE_META;

export const COVER_EMOJI: Record<string, string> = { shield: "🛡️", listen: "🧑‍🤝‍🧒", county: "📱", recruit: "🔎", prevent: "🧭", epipen: "💉", online: "🌐", behaviour: "🫧", data: "🔒", firstaid: "⛑️", fire: "🔥", autism: "🧩", adhd: "⚡", mind: "🧠", cse: "🚸", fgm: "🎗️", domestic: "🏠", food: "🍽️", med: "💊", epilepsy: "🧠", diabetes: "🩸", asthma: "🫁", risk: "⚠️", trips: "🚌", water: "🌊", sun: "☀️", lifting: "📦", lone: "🚶", hygiene: "🧼", edi: "🌍", antibully: "🙅", send: "♿", aces: "💔", develop: "🌱", grief: "🕊️", wellbeing: "🌿", slavery: "⛓️", parents: "🤝" };

export function CourseCover({ cover, catKey, size = 60 }: { cover: string; catKey: CatKey; size?: number }) {
  const c = CAT_BY_KEY[catKey] ?? CATEGORIES[0];
  return (
    <div className="relative grid flex-none place-items-center overflow-hidden rounded-2xl text-white shadow-[0_10px_24px_-14px_rgba(16,32,90,.7)]" style={{ background: c.grad, width: size, height: size, fontSize: size * 0.46 }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" viewBox="0 0 80 80" preserveAspectRatio="none" aria-hidden><circle cx="66" cy="12" r="22" fill="#fff" opacity=".18" /><circle cx="70" cy="64" r="14" fill="#fff" opacity=".12" /><path d="M0 62 Q20 48 40 58 T80 54 V80 H0 Z" fill="#fff" opacity=".08" /></svg>
      <span className="relative leading-none">{COVER_EMOJI[cover] ?? "🎓"}</span>
    </div>
  );
}
