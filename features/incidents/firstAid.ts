// Common childhood / activity-setting injuries and the standard UK first-aid
// response for each. Sources: NHS (nhs.uk/conditions) and St John Ambulance
// (sja.org.uk) paediatric first-aid guidance — see docs/accidents-notify-handoff.md.
// These are SUGGESTIONS for the log — every field can be overridden, and they
// are NOT a substitute for a trained first aider's judgement. Anything giving
// medicine (inhaler, antihistamine, adrenaline auto-injector) is framed as
// "per the child's care plan", never as advice to medicate.

export const INJURY_BANK: string[] = [
  // knocks, cuts & grazes
  "Grazed knee", "Grazed elbow", "Grazed hand", "Small cut", "Deep cut", "Puncture wound",
  "Cut lip", "Cut/grazed chin", "Scratch", "Blister", "Friction / rope burn", "Splinter",
  // bumps & bruises
  "Bruise", "Bump to the head", "Bumped nose", "Black eye / bruised eye", "Bang to the shin",
  "Banged knee", "Stubbed toe", "Trapped finger", "Fingers trapped in a door", "Winded",
  // sprains, strains & bones
  "Sprained ankle", "Sprained wrist", "Twisted ankle", "Suspected broken arm", "Suspected broken leg",
  "Suspected fracture", "Dislocated finger", "Neck / back injury",
  // nose, mouth, teeth, eyes, ears
  "Nosebleed", "Knocked-out tooth", "Chipped tooth", "Bang to the mouth", "Bitten tongue / lip",
  "Grit in the eye", "Chemical / substance in the eye", "Object up the nose", "Object in the ear",
  // burns, bites, stings
  "Minor burn", "Minor scald", "Sunburn", "Bee / wasp sting", "Insect bite", "Nettle sting",
  "Animal bite", "Bitten by another child", "Tick bite",
  // medical / heat
  "Allergic reaction", "Severe allergic reaction (anaphylaxis)", "Asthma attack", "Seizure / fit",
  "Fainted", "Feeling faint / dizzy", "Heat exhaustion", "Dehydration", "Vomiting", "Choking",
];

// The full, overridable list offered as tickable treatments.
export const TREATMENT_BANK: string[] = [
  // cuts, grazes, bleeding
  "Rinsed under running water, dried, and a plaster/dressing applied",
  "Cleaned with water and covered with a plaster",
  "Firm pressure applied with a clean dressing and the wound kept raised",
  "Firm pressure applied to control bleeding and 999 called",
  "Splinter left in place — parent advised to remove at home",
  // bumps, bruises, head
  "Cold compress applied to reduce swelling",
  "Cold compress applied; monitored for signs of concussion (drowsiness, vomiting, headache)",
  "Cold compress applied to the eye",
  "Reassured and monitored — no first aid needed",
  // nose, mouth, teeth
  "Sat forward and the soft part of the nose pinched for 10 minutes",
  "Mouth rinsed with cold water; cold compress applied",
  "Tooth kept moist in milk; parent advised to see a dentist urgently",
  // sprains & bones
  "Supported with a bandage, rested and elevated (Protect, Rest, Ice, Compress, Elevate)",
  "Rested and raised, with a wrapped ice pack applied for up to 20 minutes",
  "Injured limb supported and immobilised, kept still, and 999 called",
  "Kept still with head/neck supported and 999 called",
  // eyes, nose, ears (foreign objects)
  "Eye rinsed with clean water; not rubbed",
  "Eye flushed with clean water for at least 10–20 minutes (chemical)",
  "Object left in place — not poked at — and parent/medical help arranged",
  // burns & sun
  "Cooled under cool running water for 20 minutes and covered loosely",
  "Moved into the shade, cooled, and given sips of water",
  // bites & stings
  "Sting scraped away, cold compress applied, and monitored for a reaction",
  "Bite/sting area cleaned; cold compress applied; monitored for a reaction",
  // medical (care-plan led)
  "Reliever inhaler given as per the child's asthma plan; kept calm and upright",
  "Adrenaline auto-injector given as per the child's allergy plan and 999 called",
  "Care plan followed; kept under close observation for any reaction",
  "Kept safe during the seizure, timed, and placed in the recovery position after; 999 as needed",
  "Laid down with legs raised until they recovered (faint)",
  "Choking first aid given (back blows / thrusts); 999 called as it did not clear",
  "Placed in the recovery position; breathing monitored; 999 called",
  // catch-all
  "Wound cleaned; parent informed",
  "999 called / emergency services contacted",
];

// Keyword → the single most appropriate suggested treatment for the quick-add.
const RULES: [RegExp, string][] = [
  [/anaphylax/i, "Adrenaline auto-injector given as per the child's allergy plan and 999 called"],
  [/allergic|allergy/i, "Care plan followed; kept under close observation for any reaction"],
  [/asthma/i, "Reliever inhaler given as per the child's asthma plan; kept calm and upright"],
  [/seizure|fit\b/i, "Kept safe during the seizure, timed, and placed in the recovery position after; 999 as needed"],
  [/faint|dizzy/i, "Laid down with legs raised until they recovered (faint)"],
  [/chok/i, "Choking first aid given (back blows / thrusts); 999 called as it did not clear"],
  [/broken|fracture|dislocat/i, "Injured limb supported and immobilised, kept still, and 999 called"],
  [/neck|back injury|spine|spinal/i, "Kept still with head/neck supported and 999 called"],
  [/head/i, "Cold compress applied; monitored for signs of concussion (drowsiness, vomiting, headache)"],
  [/nose ?bleed|nosebleed/i, "Sat forward and the soft part of the nose pinched for 10 minutes"],
  [/knocked-?out tooth|tooth.*out|out.*tooth/i, "Tooth kept moist in milk; parent advised to see a dentist urgently"],
  [/tooth|mouth|tongue|lip/i, "Mouth rinsed with cold water; cold compress applied"],
  [/chemical|substance.*eye|eye.*chemical/i, "Eye flushed with clean water for at least 10–20 minutes (chemical)"],
  [/eye|grit/i, "Eye rinsed with clean water; not rubbed"],
  [/ear|up the nose|object.*nose/i, "Object left in place — not poked at — and parent/medical help arranged"],
  [/scald/i, "Cooled under cool running water for 20 minutes and covered loosely"],
  [/burn|sunburn/i, "Cooled under cool running water for 20 minutes and covered loosely"],
  [/heat|dehydrat/i, "Moved into the shade, cooled, and given sips of water"],
  [/sting/i, "Sting scraped away, cold compress applied, and monitored for a reaction"],
  [/bite|nettle|tick/i, "Bite/sting area cleaned; cold compress applied; monitored for a reaction"],
  [/sprain|twist/i, "Supported with a bandage, rested and elevated (Protect, Rest, Ice, Compress, Elevate)"],
  [/black eye/i, "Cold compress applied to the eye"],
  [/deep cut|puncture|bleed/i, "Firm pressure applied with a clean dressing and the wound kept raised"],
  [/splinter/i, "Splinter left in place — parent advised to remove at home"],
  [/bruise|bang|bump|knock|trapped|stub|winded/i, "Cold compress applied to reduce swelling"],
  [/graze|cut|scratch|blister|friction|rope/i, "Rinsed under running water, dried, and a plaster/dressing applied"],
];

/** The suggested first-aid treatment for a typed injury, or null if none maps. */
export function suggestedTreatment(injury?: string): string | null {
  const s = (injury ?? "").trim();
  if (!s) return null;
  for (const [re, t] of RULES) if (re.test(s)) return t;
  return null;
}
