// Common childhood/activity-setting injuries and the standard UK first-aid
// response for each. Sources: NHS (nhs.uk/conditions) and St John Ambulance
// (sja.org.uk) paediatric first-aid guidance — see docs/accidents-notify-handoff.md.
// These are SUGGESTIONS for the log — every field can be overridden, and they
// are not a substitute for a trained first aider's judgement.

export const INJURY_BANK: string[] = [
  "Grazed knee", "Grazed elbow", "Grazed hand", "Small cut", "Cut lip", "Cut/grazed chin",
  "Bruise", "Bump to the head", "Bumped nose", "Nosebleed", "Sprained ankle", "Sprained wrist",
  "Twisted ankle", "Bang to the shin", "Banged knee", "Trapped finger", "Insect bite", "Insect sting",
  "Splinter", "Minor burn", "Minor scald", "Sunburn", "Bitten by another child", "Grit in the eye",
  "Knocked tooth", "Winded", "Scratch", "Blister",
];

// The full, overridable list offered in the treatment field.
export const TREATMENT_BANK: string[] = [
  "Rinsed under running water, dried, and a plaster/dressing applied",
  "Cleaned with water and covered with a plaster",
  "Cold compress applied to reduce swelling",
  "Cold compress applied; monitored for signs of concussion (drowsiness, vomiting, headache)",
  "Sat forward and the soft part of the nose pinched for 10 minutes",
  "Rested and raised, with a wrapped ice pack applied for up to 20 minutes",
  "Supported with a bandage, rested and elevated (Protect, Rest, Ice, Compress, Elevate)",
  "Cooled under cool running water for 20 minutes and covered loosely",
  "Cold compress applied; area kept clean; monitored for a reaction",
  "Splinter left in place — parent advised to remove at home",
  "Eye rinsed with clean water; not rubbed",
  "Cleaned; parent advised to see a dentist",
  "Reassured and monitored — no first aid needed",
  "Wound cleaned; parent informed",
  "999 called / emergency services contacted",
];

// Keyword → the single most appropriate suggested treatment for the quick-fill.
const RULES: [RegExp, string][] = [
  [/head/i, "Cold compress applied; monitored for signs of concussion (drowsiness, vomiting, headache)"],
  [/nose ?bleed|nosebleed/i, "Sat forward and the soft part of the nose pinched for 10 minutes"],
  [/scald/i, "Cooled under cool running water for 20 minutes and covered loosely"],
  [/burn|sunburn/i, "Cooled under cool running water for 20 minutes and covered loosely"],
  [/sprain|twist/i, "Supported with a bandage, rested and elevated (Protect, Rest, Ice, Compress, Elevate)"],
  [/bruise|bang|bump|knock|trapped|winded/i, "Cold compress applied to reduce swelling"],
  [/sting|bite/i, "Cold compress applied; area kept clean; monitored for a reaction"],
  [/splinter/i, "Splinter left in place — parent advised to remove at home"],
  [/eye|grit/i, "Eye rinsed with clean water; not rubbed"],
  [/tooth/i, "Cleaned; parent advised to see a dentist"],
  [/graze|cut|scratch|blister/i, "Rinsed under running water, dried, and a plaster/dressing applied"],
];

/** The suggested first-aid treatment for a typed injury, or null if none maps. */
export function suggestedTreatment(injury?: string): string | null {
  const s = (injury ?? "").trim();
  if (!s) return null;
  for (const [re, t] of RULES) if (re.test(s)) return t;
  return null;
}
