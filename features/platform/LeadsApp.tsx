"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { get as apiGet, api } from "@/lib/api";

// HQ Leads — demo/"Book a demo" requests captured from the marketing site's
// public /demo form (POST /api/leads). Work the pipeline: New → Contacted →
// Won / Lost. New leads also ping the HQ bell (platformNotifications "lead").
interface Lead {
  id: string; name: string; email: string; phone?: string; business?: string;
  size?: string; message?: string; source?: string; status: string; createdAt: string;
  // Researched prospects (e.g. from the EEQU directory) also carry:
  website?: string; socialUrl?: string; location?: string; kind?: string; legalForm?: string;
  companyNumber?: string; charityNumber?: string; bookingSystem?: string;
  /** From a Companies House SIC-code sweep: how confident the name-only classifier was. "uncertain" needs a human glance before treating as a real lead. */
  reviewTier?: "likely_fit" | "uncertain"; needsHumanReview?: boolean;
  sourceUrl?: string; confidence?: string; researchSources?: string[]; listingsOnSource?: number;
  /** Which plan they'd buy: one person running it themselves, or an organisation. */
  plan?: "freelancer" | "company" | "franchise"; planReason?: string;
  /** The email is a named person's or a personal mailbox (e.g. a club volunteer's gmail). */
  personalContact?: boolean; sport?: string;
  /** Every directory this provider is listed on (EEQU, Playwaze, Pebble…), with each listing's link. */
  sources?: string[]; sourceRefs?: Record<string, { id?: string; url?: string }>; onSources?: number;
  /** Their website is a "coming soon" / under-construction page — a good sign they have no booking platform yet. */
  comingSoon?: boolean;
  /** Ofsted-registered sites (venues) this provider runs. */
  ofstedSites?: number;
  /** What they run (classified from the Ofsted register): holiday · wraparound · activity · tuition · preschool · nursery · other. */
  providerTypes?: string[]; providerType?: string;
  /** Part of a franchise network (Kumon, Stagecoach…) or a multi-company group (Busy Bees…). */
  network?: string; networkKind?: "franchise" | "group"; networkOperators?: number; ofstedRegions?: string[];
  /** Region + county from their postcode / town (ONS data), and the page each contact detail was read from. */
  region?: string; county?: string; emailFrom?: string; phoneFrom?: string; websiteFoundBy?: string;
  /** Which UK nation's register they came from (England / Wales / Scotland / Northern Ireland). Derived from the region when the import didn't set it. */
  nation?: string;
  /** A site matching their name that research couldn't confirm is theirs — shown as "possible", never used for contacts. */
  websiteCandidate?: string; websiteCandidateWhy?: string;
  /** Activities / HAF read from their own website by research. */
  activityTypes?: string[]; haf?: boolean;
  /** Where the HAF mention was read, the words matched, the council programme that lists them, and whether they also sell paid places. */
  hafFrom?: string; hafText?: string; hafLocalAuthority?: string; hafPaid?: boolean;
  /** Where parents actually book, and which research pass found the booking system. */
  bookingUrl?: string; bookingFrom?: string; bookingChecked?: boolean;
  /** Their website is confirmed dead (couldn't be found live after alternates + a web search). websiteDeadCategory
   *  splits WHY: parked/empty/no-match mean the domain still resolves to something — the business likely still
   *  exists, just with a broken/abandoned web presence, so a rebuild is a sales opportunity. unreachable means
   *  ENOTFOUND/DNS-dead — no signal the business is still there. */
  websiteDead?: boolean; websiteDeadAt?: string; websiteDeadWhy?: string;
  websiteDeadCategory?: "parked" | "empty" | "no-match" | "unreachable";
  /** For a confirmed website with NO detected booking system: did we actually find explicit "call/phone/email
   *  to book" language on the site ("confirmed-manual" — a genuinely great lead, no incumbent to displace), or
   *  did we check and find neither a system nor manual-booking wording ("unconfirmed" — don't claim either way)? */
  bookingMethod?: "confirmed-manual" | "unconfirmed";
  bookingMethodEvidence?: string;
  /** A genuine but INDIRECT contact route for leads with no email/phone/website/social of their own —
   *  e.g. the council HAF programme page that lists them, or an email/phone found by re-reading the
   *  original register/directory page. Never a substitute for a direct channel; see the note for why. */
  secondaryContact?: string; secondaryContactType?: "council-haf-programme" | "venue-school" | "sourceUrl-refetch" | string; secondaryContactNote?: string;
  /** DfE GIAS independent-schools import (England): the register id (URN), the register's own name for the
   *  school (shown alongside a lead whose OWN name is a club/nursery operating at that school, not the school
   *  itself — see giasSchoolName), school-type classification derived from age range / SEN provision, whether
   *  they board, and their statutory age range. */
  giasUrn?: string; giasSchoolName?: string; schoolType?: "send" | "prep" | "senior" | "all_through" | "other"; boarding?: boolean;
  ageLow?: number; ageHigh?: number;
  /** DfE GIAS state-funded-schools import (England): phase of education, and governance — which trust (if
   *  any) runs them. schoolGovernance is unset (not guessed) for the handful GIAS didn't give a clean answer for. */
  schoolPhase?: "primary" | "secondary" | "all_through" | "nursery";
  schoolGovernance?: "mat" | "sat" | "la_maintained" | "free_school"; trustName?: string;
  /** Named role-contacts read off a school's own staff/key-staff page (enrich_schools.mjs) — best-effort, not
   *  every school publishes these, and not every one found is guaranteed correctly attributed. */
  roleContacts?: Partial<Record<"head" | "pupilPremiumLead" | "inclusionLead" | "sendco", { name?: string; email?: string }>>;
}

// ── What we sell vs who they are ─────────────────────────────────────────────
// ActivityOS is built for session-booked children's activities: holiday camps,
// breakfast/after-school clubs and classes (bookings, registers, ratios, meals,
// medication, Tax-Free Childcare). Nurseries mostly run on nursery software.
const TYPE: Record<string, { label: string; emoji: string }> = {
  holiday: { label: "Holiday camps & clubs", emoji: "🏕️" },
  wraparound: { label: "Breakfast & after-school", emoji: "🎒" },
  activity: { label: "Sports & activity classes", emoji: "⚽" },
  tuition: { label: "Tuition & learning", emoji: "📚" },
  preschool: { label: "Pre-school / playgroup", emoji: "🧸" },
  nursery: { label: "Nursery / day care", emoji: "🍼" },
  childminder: { label: "Childminder", emoji: "🏠" },
  other: { label: "Other childcare", emoji: "🏫" },
};
const CORE = ["holiday", "wraparound", "activity"];
// DfE GIAS school-type classification (independent schools import) — badge shown on the card, separate from TYPE
// above (that's what a business RUNS; this is what KIND of school it is).
const SCHOOL_TYPE_BADGE: Record<string, string> = { send: "♿ SEND", prep: "🎒 Prep", senior: "🎓 Senior", all_through: "🏫 All-through", other: "🏫 Independent" };
// DfE GIAS school-phase / school-governance classification (state-funded schools import) — same idea as
// SCHOOL_TYPE_BADGE above, kept separate because these are two independent axes, not one flat enum.
const SCHOOL_PHASE_BADGE: Record<string, string> = { primary: "🎒 Primary", secondary: "🎓 Secondary", all_through: "🏫 All-through", nursery: "🍼 Nursery" };
const SCHOOL_GOV_BADGE: Record<string, string> = { mat: "🏛 MAT", sat: "🏫 SAT", la_maintained: "🏢 LA-maintained", free_school: "🆓 Free school" };
const ROLE_CONTACT_LABEL: Record<string, string> = { head: "🎓 Headteacher", pupilPremiumLead: "💷 Pupil Premium lead", inclusionLead: "🤝 Inclusion lead", sendco: "♿ SENDCo" };
const DIRECTORY = ["eequ", "playwaze", "pebble", "yellowdays"];
const HOLIDAY_WORDS = /\b(holiday|camps?|play ?scheme|half[- ]term)\b/i;
type Fit = "core" | "adjacent" | "nursery";
type Size = "solo" | "single" | "multi" | "large" | "franchise" | "group";
type Booking = "none" | "unknown" | "soon" | "platform";
interface Derived { types: string[]; fit: Fit; size: Size; booking: Booking; srcs: string[]; region: string; nation: string; acts: string[]; hafPaid: boolean | null; system: string; platforms: string[] }
// What kind of activity they offer — read from their name, the directory's
// activity field, the Ofsted site names, and (when research found it) words on
// their own website (`activityTypes`, `haf`).
const ACTIVITY: [string, string, RegExp][] = [
  ["multi", "🤸 Multi-activity", /multi[- ]?(activit|sport|skill)|activity (camp|club|day)|fun (club|days?|camp)|adventure (camp|club|day)|all[- ]?rounder/i],
  ["sport", "⚽ Sports & coaching", /football|soccer|rugby|cricket|tennis|netball|hockey|basketball|badminton|athletic|golf|squash|volleyball|handball|lacrosse|rounders|\bsports?\b|coaching|\bfc\b|\bpe\b/i],
  ["gym", "🤸‍♀️ Gymnastics & trampolining", /gymnast|trampolin|tumbl|cheerleading|\bacro\b|parkour|freerunning/i],
  ["swim", "🏊 Swimming & water", /swim|aqua|water ?polo|\bsurf|\bsailing|kayak|canoe|paddle ?board/i],
  ["martial", "🥋 Martial arts", /karate|judo|taekwondo|tae kwon|kickbox|jiu[- ]?jitsu|ju[- ]?jitsu|kung fu|martial|boxing|fencing|aikido|\bmma\b/i],
  ["dance", "💃 Dance", /danc|ballet|\btap\b|street ?dance|zumba|hip[- ]?hop|twinkle ?toes|tappy toes/i],
  ["drama", "🎭 Drama & performing arts", /drama|theatre|theater|stage ?coach|performing|musical theatre|\bacting\b|stage school/i],
  ["music", "🎵 Music", /music|piano|guitar|drum|choir|\bsing(ing)?\b|rock ?school|orchestra|ukulele|violin/i],
  ["arts", "🎨 Arts & crafts", /(?<!performing )\barts?\b|\bartist|craft|painting|pottery|\bclay\b|messy play|splat/i],
  ["forest", "🌳 Forest school & outdoor", /forest ?(school|club|kids|adventure|explorers|tots|camp|days?)|woodland|outdoor|bushcraft|beach school|nature (club|school|kids|explorers)|wildlife|farm ?(school|camp|club)|camping|survival skills/i],
  ["stem", "🔬 STEM & coding", /coding|code ?(club|ninjas?|camp)|computing|robot|\blego\b|\bstem\b|science|engineer|minecraft|mad science|bricks? ?4|technology/i],
  ["language", "🗣️ Languages", /french|spanish|german|mandarin|chinese|arabic|languages?\b|lingo|polish school|italian|latin\b/i],
  ["tuition", "📚 Tuition & learning", /tutor|tuition|\bmaths?\b|literacy|11 ?plus|11\+|kumon|kip mcgrath|study (centre|club)|learning cent|education cent|homework club/i],
  ["baby", "👶 Baby & toddler classes", /baby (class|sensory|massage|yoga|music|signing)|toddler (class|group|club)|sensory (class|play)|mini ?movers|sing and sign|music bugs|monkey music|little kickers|baby sensory|toddler sense|toddle/i],
  ["cook", "🍳 Cooking", /\bcook(ery|ing|s)?\b|\bbak(e|ing)\b|\bchefs?\b/i],
  ["animals", "🐴 Riding & animals", /\briding\b|equestrian|\bpony\b|horse|animal|\bzoo\b/i],
  ["send", "♿ SEND / inclusive", /\bsend\b|\bsen\b|special needs|inclusive|autis|disabilit|additional needs|mencap/i],
  ["youth", "🏘️ Youth & community", /youth|scouts?\b|\bguides\b|brownies|\bcubs\b|boys'? brigade|girls'? brigade|\bymca\b|family hub|children'?s centre|play ?scheme|adventure playground/i],
  ["haf", "🍎 HAF (holiday activities & food)", /\bhaf\b|holiday activities and food|holiday activity and food|fed and active/i],
];
// UK postcode area → region, for leads that only have a postcode (directory listings).
const REGION_OF: Record<string, string> = {};
for (const [region, areas] of Object.entries({
  London: "E EC N NW SE SW W WC BR CR EN HA IG RM SM TW UB",
  "South East": "BN CT GU HP KT ME MK OX PO RG RH SL SO TN DA",
  "East of England": "AL CB CM CO IP LU NR PE SG SS WD",
  "South West": "BA BH BS DT EX GL PL SN SP TA TQ TR",
  "West Midlands": "B CV DY HR ST TF WR WS WV SY",
  "East Midlands": "DE LE LN NG NN",
  "Yorkshire and The Humber": "BD DN HD HG HU HX LS S WF YO",
  "North West": "BB BL CA CH CW FY L LA M OL PR SK WA WN",
  "North East": "DH DL NE SR TS",
  Wales: "CF LD LL NP SA",
  Scotland: "AB DD DG EH FK G HS IV KA KW KY ML PA PH TD ZE",
  "Northern Ireland": "BT",
})) for (const a of areas.split(" ")) REGION_OF[a] = region;
// Nation from the register / the region. English regions collapse to "England"; the
// Welsh, Scottish and Northern Irish registers are imported with `nation` set explicitly.
const NATIONS = ["England", "Wales", "Scotland", "Northern Ireland"] as const;
const NATION_FLAG: Record<string, string> = { England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Northern Ireland": "🇬🇧", "Isle of Man": "🇮🇲", "Channel Islands": "🇯🇪" };
const nationFrom = (l: Lead, region: string) => {
  if (l.nation) return l.nation;
  if (!region) return "";
  if ((NATIONS as readonly string[]).includes(region) || region === "Isle of Man" || region === "Channel Islands") return region;
  return "England";
};
const regionFrom = (l: Lead) => {
  if (l.region) return l.region;
  if (l.ofstedRegions?.[0]) return l.ofstedRegions[0];
  // A full postcode, or just the district ("Oxford · OX4").
  const m = /(?:·|,)\s*([A-Z]{1,2})\d[A-Z\d]?\s*$/i.exec(l.location ?? "") ??/([A-Z]{1,2})\d[A-Z\d]?\s*\d[A-Z]{2}/i.exec(l.location ?? "");
  return m ? REGION_OF[m[1].toUpperCase()] ?? "" : "";
};
// One name per booking system, whatever the crawl wrote: "Magicbooking" / "Magic Booking (network-wide: YMCA)" → "Magic Booking";
// every own-website variant → "Own website"; a sign-up form (Google/Microsoft Forms, JotForm, Typeform) is NOT a booking system → "".
const SYSTEM_ALIASES: [RegExp, string][] = [
  // The last alternative used to be the unanchored `booking form\)?$`, which
  // matched anything ENDING in "booking form)" — including "own site
  // (booking form)", wrongly nulling out a real self-hosted booking system
  // to "" and making it look unchecked/no-platform. Anchored to the specific
  // sign-up-form services this was meant to catch instead.
  [/^(google|microsoft) forms?\b|^jotform\b|^typeform\b/i, ""],
  [/^own (site|website)\b|^own site shop|^own portal|^own booking|own platform/i, "Own website"],
  [/^magic ?booking/i, "Magic Booking"], [/^class ?4 ?kids|^classforkids/i, "ClassForKids"], [/^famly/i, "Famly"], [/^blossom/i, "Blossom"], [/^tapestry/i, "Tapestry"],
  [/^eequ/i, "eequ"], [/^pebble/i, "Pebble"], [/^playwaze/i, "Playwaze"], [/^kiplearn/i, "KipLearn (Kip McGrath)"], [/^kidsplan/i, "Kidsplan"], [/^parentpay/i, "ParentPay"],
  [/^eventbrite/i, "Eventbrite"], [/^calendly/i, "Calendly"], [/^bookwhen/i, "Bookwhen"], [/^woocommerce/i, "WooCommerce"], [/^paypal/i, "PayPal"], [/^connect childcare/i, "Connect Childcare"],
  [/^amelia/i, "Amelia (WordPress)"], [/^bookly/i, "Bookly (WordPress)"], [/^eylog/i, "eyLog"], [/^parenta/i, "Parenta"], [/^baby'?s days/i, "Baby's Days"], [/^nursery hub/i, "Nursery Hub"],
  [/^legend/i, "Legend (leisure)"], [/^gladstone/i, "Gladstone (leisure)"], [/^better\b|^gll\b/i, "Better / GLL"], [/^holidayactivities/i, "HolidayActivities"], [/^coordinate/i, "Coordinate"],
];
function canonicalSystem(raw?: string): string {
  const first = (raw || "").split(/;| — /)[0].replace(/\s*\((network-wide|HAF)[^)]*\)/gi, "").replace(/\s*\((nursery app|school payments|booking form|booking page|online checkout)\)/gi, "").trim();
  if (!first) return "";
  for (const [re, name] of SYSTEM_ALIASES) if (re.test(first)) return name;
  return first.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
function derive(l: Lead): Derived {
  const srcs = l.sources?.length ? l.sources : [l.source || "demo"];
  const onDir = srcs.some((s) => DIRECTORY.includes(s));
  // Directory providers (EEQU, Pebble…) are activity providers; holiday camps by their words.
  const baseTypes = l.providerTypes?.length ? l.providerTypes : onDir ? [HOLIDAY_WORDS.test(`${l.name} ${l.sport ?? ""} ${l.message ?? ""}`) ? "holiday" : "activity"] : [];
  // Registers (Ofsted / CIW / Care Inspectorate / NI) describe childminders in the record text — surface them as their own setting.
  const types = /childmind/i.test(`${l.providerType ?? ""} ${l.message ?? ""} ${(l.providerTypes ?? []).join(" ")}`) && !baseTypes.includes("childminder") ? [...baseTypes, "childminder"] : baseTypes;
  const fit: Fit = !types.length || types.some((t) => CORE.includes(t)) ? "core" : types.some((t) => t === "tuition" || t === "preschool") ? "adjacent" : "nursery";
  const n = l.ofstedSites ?? 0;
  const size: Size = l.networkKind === "franchise" ? "franchise" : l.networkKind === "group" ? "group" : n >= 10 ? "large" : n >= 2 ? "multi" : l.kind === "person" || l.plan === "freelancer" ? "solo" : "single";
  // "none" is a CLAIM (their site was crawled and only offers enquiry) — a lead with no website, or one the
  // crawler never got proof from, is "unknown", not greenfield.
  const formOnly = !!l.bookingSystem && !canonicalSystem(l.bookingSystem);
  const booking: Booking = onDir || (l.bookingSystem && !formOnly) ? "platform" : l.comingSoon ? "soon" : (l.bookingChecked || formOnly) ? "none" : "unknown";
  // (The Ofsted description starts with our own type labels — "Sports & activity classes…" — so skip that clause.)
  const text = `${l.name} ${l.business ?? ""} ${l.sport ?? ""} ${(l.message ?? "").replace(/^Ofsted-registered — [^.]*\./, "")} ${l.network ?? ""} ${(l.website ?? "").replace(/^https?:\/\/(www\.)?/, "")}`;
  const acts = [...new Set([...ACTIVITY.filter(([, , re]) => re.test(text)).map(([k]) => k), ...(l.activityTypes ?? []), ...(l.haf ? ["haf"] : [])])];
  const region = regionFrom(l);
  // HAF providers: do they also sell paid places? Confirmed by research when known; otherwise
  // a strong signal is being on a booking directory / system, or running a nursery / wraparound / classes.
  const hafPaid = !acts.includes("haf") ? null : typeof l.hafPaid === "boolean" ? l.hafPaid : booking === "platform" || types.some((t) => ["nursery", "preschool", "wraparound", "activity", "tuition"].includes(t)) ? true : null;
  // The one booking system they use (first named), e.g. "Bookwhen", "own portal", "Famly (nursery app)".
  const system = canonicalSystem(l.bookingSystem);
  // One list of the platforms they use, however we learnt it: listed on a directory (source) OR their site sends parents there (bookingSystem).
  const DIR_NAME: Record<string, string> = { eequ: "eequ", pebble: "Pebble", playwaze: "Playwaze", yellowdays: "Yellow Days" };
  const platforms = [...new Set([...srcs.filter((v) => DIRECTORY.includes(v)).map((v) => DIR_NAME[v] ?? v), ...(system && !/^own\b/i.test(system) ? [system] : [])])];
  return { types, fit, size, booking, srcs, region, nation: nationFrom(l, region), acts, hafPaid, system, platforms };
}
const FIT: Record<Fit, { label: string; hint: string }> = {
  core: { label: "🎯 Core fit", hint: "Holiday camps, breakfast & after-school clubs, activity classes — what ActivityOS is built for" },
  adjacent: { label: "🟡 Adjacent", hint: "Tuition centres and pre-schools — term-time sessions, partly a fit" },
  nursery: { label: "⚪ Nursery only", hint: "Full day-care nurseries — usually on nursery software; lowest fit" },
};
const SIZE: Record<Size, string> = { solo: "🧑 Sole trader", single: "🏠 One site / not known", multi: "🏢 2–9 sites", large: "🏬 10+ sites", franchise: "🌐 Franchisee", group: "🏛 Part of a group" };
const BOOKING: Record<Booking, { label: string; hint: string }> = {
  none: { label: "🆕 No booking platform (site checked)", hint: "Their website was read and only sends parents to a form, phone or email — greenfield, confirmed" },
  unknown: { label: "❔ Not checked yet", hint: "No website to read, or their site couldn't be read — no booking system seen, but not proven" },
  soon: { label: "🚧 Website coming soon", hint: "Their site is a holding page — likely no booking platform yet" },
  platform: { label: "🔁 Already on a platform", hint: "Listed on EEQU / Pebble / Playwaze / Yellow Days or books through another system — a switch sale" },
};
const isFreelancer = (l: Lead) => l.plan === "freelancer";
const isCompany = (l: Lead) => l.plan === "company" || l.plan === "franchise";

const STATUSES = ["new", "contacted", "won", "lost"] as const;
const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: "rgba(255,61,127,.14)", fg: "#C81E5E", label: "New" },
  contacted: { bg: "rgba(245,185,74,.16)", fg: "#9a5a00", label: "Contacted" },
  won: { bg: "rgba(52,211,193,.16)", fg: "#0e7a75", label: "Won" },
  lost: { bg: "rgba(139,151,188,.16)", fg: "#5F6A88", label: "Lost" },
};

// Where a lead came from. Today the website demo form is the only source, but
// the field is stored per-lead so more can be added later (referral, event…).
const SOURCE: Record<string, { label: string; emoji: string }> = {
  ciw: { label: "Care Inspectorate Wales register", emoji: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  cis: { label: "Care Inspectorate Scotland register", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  fsni: { label: "Family Support NI register", emoji: "☘️" },
  demo: { label: "Demo request", emoji: "📩" },
  eequ: { label: "EEQU", emoji: "🗂️" },
  playwaze: { label: "Playwaze", emoji: "🏸" },
  pebble: { label: "Pebble", emoji: "🪨" },
  yellowdays: { label: "Yellow Days", emoji: "🌼" },
  ofsted: { label: "Ofsted", emoji: "🏫" },
  haf: { label: "Council HAF list", emoji: "🍎" },
  gias: { label: "DfE GIAS register — independent schools", emoji: "🎓" },
  "gias-state": { label: "DfE GIAS register — state schools", emoji: "🏫" },
};
/** The directories a lead is on — all of them, not only the one it was first found on. */
const srcOf = (l: { sources?: string[]; source?: string }) => (l.sources?.length ? l.sources : [l.source || "demo"]);
const srcMeta = (s?: string) => SOURCE[s || "demo"] || { label: (s || "Website").replace(/^\w/, (c) => c.toUpperCase()), emoji: "🌐" };
/** Loose "same organisation, going by name" check — used to skip showing a linked GIAS school's name when the
 *  lead's own name already IS that school (only clubs/nurseries/committees linked to a DIFFERENT school need it). */
const sameOrg = (a?: string, b?: string) => {
  const norm = (s?: string) => (s || "").toLowerCase().replace(/^z(?=[a-z])/i, "").replace(/[^a-z0-9]/g, "");
  const A = norm(a), B = norm(b);
  return !!A && !!B && (A === B || A.includes(B) || B.includes(A));
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

// ── Filters ──────────────────────────────────────────────────────────────────
// Sales work in two moves: pick a VIEW (a ready-made segment — best prospects,
// holiday camps, head-office deals…), then narrow it with dropdowns. Inside one
// dropdown the ticks are OR (holiday OR after-school); across dropdowns they're
// AND. Every option shows how many leads it would leave, given everything else.
type R = { l: Lead; d: Derived };
type Opt = { value: string; label: string; hint?: string; group?: string; test: (r: R) => boolean };
type Dim = "plan" | "runs" | "activity" | "fit" | "size" | "booking" | "nation" | "region" | "ofsted" | "source" | "contact" | "status" | "schoolType" | "schoolPhase" | "schoolGovernance" | "roleContact";
const okToEmail = (l: Lead) => !!l.email && !l.personalContact && l.kind !== "person";
// A dead website whose domain still resolves to *something* (parked/for-sale, an empty page, or reachable
// content that isn't theirs) means the business likely still exists — just with a broken/abandoned web
// presence. Plain "unreachable" (DNS/ENOTFOUND or nothing found anywhere) has no such signal.
const WEBSITE_OPPORTUNITY = new Set(["parked", "empty", "no-match"]);
const isWebsiteOpportunity = (l: Lead) => !!l.websiteDead && WEBSITE_OPPORTUNITY.has(l.websiteDeadCategory || "");
const DEAD_CATEGORY_LABEL: Record<string, string> = { parked: "Parked / for-sale domain", empty: "Empty page", "no-match": "Reachable but not theirs", unreachable: "Unreachable (DNS dead)" };
// No email/phone/website/social AT ALL — the true dead-end set (secondary_contact.mjs's starting point).
const hasNoContact = (l: Lead) => !l.email && !l.phone && !l.website && !l.socialUrl;
const isHttpUrl = (s?: string) => !!s && /^https?:\/\//i.test(s);
const SECONDARY_TYPE_LABEL: Record<string, string> = { "council-haf-programme": "council HAF programme", "venue-school": "venue / school", "sourceUrl-refetch": "original listing page" };
const STATIC_OPTS: Partial<Record<Dim, Opt[]>> = {
  plan: [
    { value: "company", label: "🏢 Companies", test: ({ l }) => isCompany(l) },
    { value: "freelancer", label: "🧑 Freelancers", test: ({ l }) => isFreelancer(l) },
  ],
  runs: [
    ...Object.entries(TYPE).map(([k, t]) => ({ value: k, label: `${t.emoji} ${t.label}`, group: "Setting", test: ({ d }: R) => d.types.includes(k) })),
    { value: "multi2", label: "🔀 Runs 2+ of these", group: "Setting", hint: "e.g. a nursery that also runs a holiday or after-school club — often the easiest win", test: ({ d }: R) => d.types.length > 1 },
    { value: "haf:any", label: "🍎 HAF provider (any)", group: "HAF (holiday activities & food)", hint: "On a council HAF list or says so on their own website", test: ({ d }: R) => d.acts.includes("haf") },
    { value: "haf:paid", label: "🍎💷 HAF + paid activities", group: "HAF (holiday activities & food)", hint: "Also sells places: confirmed by research, or on a booking platform / runs a nursery, wraparound or classes", test: ({ d }: R) => d.acts.includes("haf") && d.hafPaid === true },
    { value: "haf:only", label: "🍎 HAF only — no paid activities seen", group: "HAF (holiday activities & food)", hint: "Free HAF places and nothing paid found yet (community groups, youth clubs, school-run schemes)", test: ({ d }: R) => d.acts.includes("haf") && d.hafPaid !== true },
    { value: "haf:none", label: "🚫 No HAF found", group: "HAF (holiday activities & food)", hint: "Not on any council HAF list we've read, no HAF wording on the pages of their site we could read, none in web-search results for their name — they may still run HAF we haven't seen", test: ({ d }: R) => !d.acts.includes("haf") },
    ...ACTIVITY.filter(([k]) => k !== "haf").map(([k, label]) => ({ value: `act:${k}`, label, group: "Activities", test: ({ d }: R) => d.acts.includes(k) })),
  ],
  activity: [],
  fit: (Object.keys(FIT) as Fit[]).map((k) => ({ value: k, label: FIT[k].label, hint: FIT[k].hint, test: ({ d }: R) => d.fit === k })),
  size: (Object.keys(SIZE) as Size[]).map((k) => ({ value: k, label: SIZE[k], test: ({ d }: R) => d.size === k })),
  booking: [
    ...(Object.keys(BOOKING) as Booking[]).map((k) => ({ value: k, label: BOOKING[k].label, hint: BOOKING[k].hint, test: ({ d }: R) => d.booking === k })),
    { value: "multi", label: "🔗 On 2+ directories", hint: "The same provider found on more than one directory — one lead", test: ({ d }) => d.srcs.length > 1 },
  ],
  ofsted: [
    { value: "yes", label: "🏫 Yes — on the Ofsted register", hint: "Came from the Ofsted childcare register (England); the badge links to their Ofsted page", test: ({ l, d }) => d.srcs.includes("ofsted") || (l.ofstedSites ?? 0) > 0 },
    { value: "no", label: "🚫 No — not Ofsted-registered", hint: "Directory / HAF / other-nation leads with no Ofsted record. Wales, Scotland and NI have their own registers (see Nation)", test: ({ l, d }) => !d.srcs.includes("ofsted") && !((l.ofstedSites ?? 0) > 0) },
  ],
  schoolType: [
    { value: "send", label: "♿ SEND", hint: "An independent special school (DfE GIAS register), or one with named SEN provision", test: ({ l }) => l.schoolType === "send" },
    { value: "prep", label: "🎒 Prep", hint: "Independent, not SEND, statutory age range topping out around 11–13", test: ({ l }) => l.schoolType === "prep" },
    { value: "senior", label: "🎓 Senior", hint: "Independent, not SEND, statutory age range starting at 11+", test: ({ l }) => l.schoolType === "senior" },
    { value: "all_through", label: "🏫 All-through", hint: "One school spanning both prep and senior ages (roughly 3/4 to 16/18)", test: ({ l }) => l.schoolType === "all_through" },
    { value: "other", label: "❔ Other / not classified", hint: "An independent school GIAS didn't give a clean age range for", test: ({ l }) => !!l.schoolType && l.schoolType === "other" },
    { value: "boarding", label: "🛏️ Boarding", hint: "Takes boarders, per the GIAS register — cross-cut with any of the school types above", test: ({ l }) => l.boarding === true },
  ],
  schoolPhase: [
    { value: "primary", label: "🎒 Primary", hint: "Includes middle schools deemed primary, per the GIAS register", test: ({ l }) => l.schoolPhase === "primary" },
    { value: "secondary", label: "🎓 Secondary", hint: "Includes middle schools deemed secondary, per the GIAS register", test: ({ l }) => l.schoolPhase === "secondary" },
    { value: "all_through", label: "🏫 All-through", hint: "One school spanning both primary and secondary ages", test: ({ l }) => l.schoolPhase === "all_through" },
    { value: "nursery", label: "🍼 Nursery", hint: "A state-funded nursery school on the GIAS register", test: ({ l }) => l.schoolPhase === "nursery" },
  ],
  schoolGovernance: [
    { value: "mat", label: "🏛 Multi-academy trust (MAT)", hint: "An academy linked to a trust that runs more than one school in this dataset", test: ({ l }) => l.schoolGovernance === "mat" },
    { value: "sat", label: "🏫 Standalone academy (SAT)", hint: "An academy linked to a trust that runs only this one school", test: ({ l }) => l.schoolGovernance === "sat" },
    { value: "la_maintained", label: "🏢 LA-maintained", hint: "An ordinary local-authority maintained school, not an academy", test: ({ l }) => l.schoolGovernance === "la_maintained" },
    { value: "free_school", label: "🆓 Free school", hint: "GIAS's own \"Free Schools\" category — kept as its own bucket even though free schools are structurally academies", test: ({ l }) => l.schoolGovernance === "free_school" },
  ],
  roleContact: [
    { value: "head", label: "🎓 Has headteacher contact", hint: "A named headteacher (and/or their email) was found on the school's own staff page", test: ({ l }) => !!l.roleContacts?.head },
    { value: "pupilPremiumLead", label: "💷 Has Pupil Premium lead contact", hint: "A named Pupil Premium lead (and/or their email) was found on the school's own staff page", test: ({ l }) => !!l.roleContacts?.pupilPremiumLead },
    { value: "inclusionLead", label: "🤝 Has Inclusion lead contact", hint: "A named Inclusion lead (and/or their email) was found on the school's own staff page", test: ({ l }) => !!l.roleContacts?.inclusionLead },
    { value: "sendco", label: "♿ Has SENDCo contact", hint: "A named SENDCo — or Designated Safeguarding Lead filling that role — was found on the school's own staff page", test: ({ l }) => !!l.roleContacts?.sendco },
    { value: "any", label: "✅ Has any role-contact", hint: "At least one of the above was found", test: ({ l }) => !!l.roleContacts && Object.keys(l.roleContacts).length > 0 },
  ],
  contact: [
    { value: "chLikelyFit", label: "✅ Likely fit — ready to treat", group: "Review status (Companies House sweep)", hint: "Name-matched by a keyword classifier against a real kids/coaching signal — a reasonable shortlist, still not manually verified", test: ({ l }) => l.reviewTier === "likely_fit" },
    { value: "chUncertain", label: "❔ Needs a glance", group: "Review status (Companies House sweep)", hint: "Matched the SIC code but the name is ambiguous (e.g. \"Academy\" could be kids' coaching or a pro club's academy) — check before treating as a lead", test: ({ l }) => l.needsHumanReview === true },
    { value: "okEmail", label: "✅ OK to email", hint: "A business mailbox — not a sole trader or a named person's address (UK PECR)", test: ({ l }) => okToEmail(l) },
    { value: "email", label: "✉️ Has email", test: ({ l }) => !!l.email },
    { value: "phone", label: "📞 Has phone", hint: "UK PECR: screen numbers against the TPS / CTPS before sales calls", test: ({ l }) => !!l.phone },
    { value: "phoneOnly", label: "📞 Phone only", test: ({ l }) => !!l.phone && !l.email },
    { value: "web", label: "🌐 Has website", test: ({ l }) => !!l.website },
    { value: "webOnly", label: "🌐 Website only", test: ({ l }) => !!l.website && !l.email && !l.phone },
    { value: "maybeWeb", label: "🌐? Possible website", hint: "A site matching their name that research couldn't confirm is theirs — check it before using", test: ({ l }) => !l.website && !!l.websiteCandidate },
    { value: "noWeb", label: "🚫 No website", hint: "No confirmed website on record (includes possible-website leads and social-page-only leads)", test: ({ l }) => !l.website },
    { value: "socialOnly", label: "📘 Social page only", hint: "A Facebook/Instagram page but no website of their own", test: ({ l }) => !l.website && !!l.socialUrl },
    { value: "websiteOpportunity", label: "🌐 Website rebuild opportunity", hint: "Their old website is dead but the domain still resolves to something (parked/for-sale, empty, or reachable but not theirs) — the business likely still exists, just needs a new site. Pitch a rebuild as part of the ActivityOS package", test: ({ l }) => isWebsiteOpportunity(l) },
    { value: "websiteUnreachable", label: "🚫 Website unreachable (DNS dead)", hint: "Confirmed dead with no signal at all — ENOTFOUND or nothing found anywhere. The business may not exist any more", test: ({ l }) => !!l.websiteDead && !isWebsiteOpportunity(l) },
    { value: "soon", label: "🚧 Coming-soon website", hint: "Their site is a holding page — likely no booking platform yet", test: ({ l }) => !!l.comingSoon },
    { value: "noContactAtAll", label: "❌ No contact found", hint: "No email, phone, website or social page on record — the true dead-end set", test: ({ l }) => hasNoContact(l) },
    { value: "hasSecondaryContact", label: "📞 Indirect contact found", hint: "No direct channel, but a secondary route was found — a council HAF programme page, or an email/phone read off the original listing page. See the badge on the row", test: ({ l }) => hasNoContact(l) && !!l.secondaryContact },
    { value: "noContactWhatsoever", label: "⛔ No contact — not even indirect", hint: "No email, phone, website or social, and no secondary route found either — a genuine dead end", test: ({ l }) => hasNoContact(l) && !l.secondaryContact },
  ],
  status: STATUSES.map((s) => ({ value: s, label: TONE[s].label, test: ({ l }: R) => (l.status || "new") === s })),
};
const DIM_LABEL: Record<Dim, string> = { plan: "Plan", runs: "What they do", activity: "Activity", fit: "Fit", size: "Size", booking: "Platform", nation: "Nation", region: "Region", ofsted: "Ofsted registered", source: "Found on", contact: "Contact", status: "Status", schoolType: "School type", schoolPhase: "School phase", schoolGovernance: "School governance", roleContact: "Role contacts" };
type Filters = Record<Dim, string[]>;
const NO_FILTERS: Filters = { plan: [], runs: [], activity: [], fit: [], size: [], booking: [], nation: [], region: [], ofsted: [], source: [], contact: [], status: [], schoolType: [], schoolPhase: [], schoolGovernance: [], roleContact: [] };

// Which list you're working. Only four, and they don't overlap in confusing ways:
// best prospects ⊂ ready to contact; still researching = everyone else; demo
// requests are people who asked. Everything else (holiday camps, head-office
// deals, no platform yet…) is a filter, so the filter bar is the one place to narrow down.
const reachable = (l: Lead) => !!l.email || !!l.phone;
const VIEWS: { key: string; label: string; hint: string; test: (r: R) => boolean }[] = [
  // A genuine "everything, no view-level restriction" tab — every other tab below
  // (including the confusingly-named "all" key, which is actually reachable-only)
  // applies some test; this one doesn't, so counts/exports from here are the true
  // unfiltered total (still subject to whatever dropdown filters are separately picked).
  { key: "everyLead", label: "🗂️ All leads", hint: "Every lead in the database, no view restriction — combine with the filters below to narrow down", test: () => true },
  { key: "best", label: "⭐ Best prospects", hint: "Run holiday camps, after-school clubs or activity classes, can be contacted, and aren't on a booking platform yet", test: ({ l, d }) => reachable(l) && d.fit === "core" && d.booking !== "platform" },
  { key: "all", label: "📇 Ready to contact", hint: "Every lead with an email or a phone number", test: ({ l }) => reachable(l) },
  { key: "demo", label: "📩 Demo requests", hint: "Asked for a demo on the website", test: ({ d }) => d.srcs.includes("demo") },
  { key: "haf", label: "🍎 HAF providers", hint: "Listed on a council Holiday Activities & Food programme, or say on their own website that they run HAF places", test: ({ d }) => d.acts.includes("haf") },
  { key: "research", label: "🔎 Still researching", hint: "No email or phone found yet", test: ({ l }) => !reachable(l) },
];
type SortKey = "best" | "reach" | "big" | "new" | "az";
const SORTS: Record<SortKey, string> = { best: "Best prospects first", reach: "Most reachable first", big: "Biggest first (sites)", new: "Newest first", az: "Name A–Z" };

/** A dropdown of ticks with live counts. Counts are only worked out while it's open. */
function FilterMenu({ dim, opts, value, onChange, countFor }: { dim: Dim; opts: Opt[]; value: string[]; onChange: (v: string[]) => void; countFor: (o: Opt) => number }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Which groups are expanded — keyed by group name ("" = ungrouped options, always shown flat).
  // Lazily initialised (and re-initialised each time the modal opens) so a group that already
  // has a ticked option in it starts open — the user should never have their own active
  // filter hidden behind a collapsed header.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const box = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => { const seen: string[] = []; for (const o of opts) if (o.group && !seen.includes(o.group)) seen.push(o.group); return seen; }, [opts]);
  useEffect(() => {
    if (!open) return;
    // Default: first group open, the rest collapsed — except any group that already has a
    // ticked option in it, which opens too so an active filter is never hidden.
    setOpenGroups(() => {
      const init: Record<string, boolean> = {};
      groups.forEach((g, i) => { init[g] = i === 0 || opts.some((o) => o.group === g && value.includes(o.value)); });
      return init;
    });
    setSearch("");
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    // A full-page modal locks background scroll while it's open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const on = value.length > 0;
  const summary = !on ? "Any" : value.length === 1 ? (opts.find((o) => o.value === value[0])?.label ?? value[0]) : `${value.length} selected`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const term = search.trim().toLowerCase();
  // Search narrows by label/hint/group text — client-side substring match, so typing "email" or
  // "companies house" cuts a 90-option list down to the handful that matter instead of scrolling.
  const visible = useMemo(() => !term ? opts : opts.filter((o) => o.label.toLowerCase().includes(term) || o.hint?.toLowerCase().includes(term) || o.group?.toLowerCase().includes(term)), [opts, term]);
  // While actively searching, force every group open — collapsing defeats the point of search.
  const groupOpen = (g: string) => !!term || openGroups[g];
  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px] font-bold transition-colors"
        style={on ? { background: "#eaf0ff", borderColor: "var(--brand)", color: "var(--brand)" } : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}>
        <span className="text-[var(--ink-3)]" style={on ? { color: "var(--brand)" } : undefined}>{DIM_LABEL[dim]}:</span>
        <span className="max-w-[180px] truncate">{summary}</span>
        <span aria-hidden className="text-[10px]">▾</span>
      </button>
      {open && (
        // Whole-page modal, not an anchored dropdown — plenty of room, no clipping.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 sm:p-8" onClick={() => setOpen(false)}>
          <div
            className="flex w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] shadow-[0_32px_80px_-20px_rgba(15,23,42,.6)]"
            style={{ maxHeight: "88vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[var(--line)] px-5 py-4">
              <h2 className="text-[19px] font-extrabold text-[var(--ink)]">{DIM_LABEL[dim]}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="rounded-full p-2 text-[16px] font-bold text-[var(--ink-3)] hover:bg-[var(--panel)]">✕</button>
            </div>
            {opts.length > 8 && (
              <div className="border-b-2 border-[var(--line)] px-5 py-3">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${DIM_LABEL[dim].toLowerCase()} options…`} autoFocus
                  className="w-full rounded-lg border-2 px-3 py-2 text-[14px] font-semibold outline-none"
                  style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--ink)" }} />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3">
              {visible.length === 0 && <div className="px-3.5 py-6 text-center text-[14px] font-semibold text-[var(--ink-3)]">No options match "{search}"</div>}
              {visible.map((o, i) => {
                const n = countFor(o); const ticked = value.includes(o.value);
                const heading = o.group && o.group !== visible[i - 1]?.group;
                const collapsed = !!o.group && !groupOpen(o.group);
                return (<div key={o.value}>
                  {heading && o.group && (() => { const count = opts.filter((x) => x.group === o.group).length; const g = o.group; return (
                    <button type="button" onClick={() => toggleGroup(g)}
                      className="mt-3 mb-1 flex w-full items-center justify-between border-b-2 border-[var(--brand)]/25 px-3 pb-1.5 pt-2 text-left text-[13px] font-extrabold uppercase tracking-wide text-[var(--brand)] first:mt-0.5">
                      <span>{g} <span className="font-semibold text-[var(--ink-3)] normal-case">({count} option{count === 1 ? "" : "s"})</span></span>
                      {!term && <span aria-hidden className="text-[11px]">{groupOpen(g) ? "▾" : "▸"}</span>}
                    </button>
                  ); })()}
                  {!collapsed && (
                    <label title={o.hint} className="flex cursor-pointer items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px] transition-colors hover:bg-[#eaf0ff]" style={{ opacity: n || ticked ? 1 : 0.45, background: ticked ? "#eaf0ff" : undefined }}>
                      <input type="checkbox" checked={ticked} onChange={() => toggle(o.value)} className="sr-only" />
                      <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-md border-2 transition-colors"
                        style={{ borderColor: ticked ? "var(--brand)" : "var(--line)", background: ticked ? "var(--brand)" : "var(--surface)" }}>
                        {ticked && <span className="text-[14px] font-extrabold leading-none text-white">✓</span>}
                      </span>
                      <span className="min-w-0 flex-1 font-bold text-[var(--ink)]">{o.label}{o.hint && <span className="mt-0.5 block truncate text-[12.5px] font-normal text-[var(--ink-3)]">{o.hint}</span>}</span>
                      <span className="rounded-full px-2.5 py-1 text-[13px] font-extrabold tabular-nums" style={{ background: ticked ? "var(--brand)" : n ? "#eaf0ff" : "var(--panel)", color: ticked ? "#fff" : n ? "var(--brand)" : "var(--ink-3)" }}>{n.toLocaleString()}</span>
                    </label>
                  )}
                </div>); })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t-2 border-[var(--line)] px-5 py-3.5">
              <button type="button" disabled={!on} onClick={() => onChange([])} className="text-[14px] font-extrabold text-[var(--brand)] disabled:opacity-35">Clear {DIM_LABEL[dim].toLowerCase()}</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-[14px] font-extrabold text-white" style={{ background: "var(--brand)" }}>Done{on ? ` (${value.length})` : ""}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Formula-safe (same rule as lib/csv): scraped/imported text starting = + - @ tab CR gets an apostrophe.
const csvCell = (v: unknown) => { let s = String(v ?? ""); if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+(\.\d+)?$/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function LeadsApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  // The last view / filters / sort are remembered on this browser.
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem("aos.leads.view.v3") || "{}") as { view?: string; f?: Partial<Filters>; sort?: SortKey }; } catch { return {}; } }, []);
  const [view, setView] = useState(saved.view && VIEWS.some((v) => v.key === saved.view) ? saved.view : "best");
  const [f, setF] = useState<Filters>({ ...NO_FILTERS, ...saved.f, fit: [] });
  const [sort, setSort] = useState<SortKey>(saved.sort && saved.sort in SORTS ? saved.sort : "best");
  useEffect(() => { try { localStorage.setItem("aos.leads.view.v3", JSON.stringify({ view, f, sort })); } catch { /* private window */ } }, [view, f, sort]);
  const [q, setQ] = useState("");
  // Thousands of leads: draw a page at a time.
  const [limit, setLimit] = useState(60);

  const [loadError, setLoadError] = useState(false);
  // The actual reason, so "couldn't load" is never a mystery (sign-in token, server down…).
  const [loadWhy, setLoadWhy] = useState("");
  // The server answers from its saved copy and reads the latest behind the
  // scenes: "warming" = nothing saved yet, ask again shortly; "refreshing" = a
  // newer copy is on its way, pick it up later.
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = (retry = true, fresh = false, tries = 0): Promise<void> => apiGet<{ leads: Lead[]; warming?: boolean; refreshing?: boolean }>(`/api/leads${fresh ? "?fresh=1" : ""}`)
    .then((r) => {
      if (later.current) clearTimeout(later.current);
      if (r.warming) { later.current = setTimeout(() => void load(), 4000); return; }
      const next = r.leads || [];
      // The background poll re-fetches every 45s even when nothing changed. Bail out of the
      // state update (keep the same array reference) when the payload is byte-for-byte the
      // same as what's already loaded, so `rows` below doesn't re-derive all ~41,500 leads
      // for no reason. A JSON comparison can only ever say "same" when the data really is the
      // same — it never masks a real change, it can only (rarely, on key-order noise) miss a
      // pointless-optimization opportunity, which is a safe failure mode.
      setLeads((prev) => {
        try { if (prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next)) return prev; } catch { /* fall through */ }
        return next;
      });
      setLoadError(false); setLoading(false);
      if (r.refreshing) later.current = setTimeout(() => void load(), 45_000);
    })
    // The API restarts whenever server code changes (and takes a few seconds to come
    // back), so keep trying for ~40s before saying it couldn't load.
    .catch((e: unknown) => {
      setLoadWhy(e instanceof Error ? e.message : String(e));
      return retry && tries < 3 ? new Promise<void>((ok) => setTimeout(ok, 1500 * (tries + 1))).then(() => load(true, fresh, tries + 1)) : (setLoadError(true), setLoading(false));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const [undo, setUndo] = useState<{ id: string; name: string; prev: string; next: string } | null>(null);
  const setStatus = async (id: string, status: string, name?: string, prevStatus?: string) => {
    if (name && prevStatus) {
      setUndo({ id, name, prev: prevStatus, next: status });
      setTimeout(() => setUndo((u) => (u?.id === id && u.next === status ? null : u)), 8000);
    }
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    await api(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
  };

  // Tens of thousands of leads: work out each one's fit / size / booking / region once, and
  // remember it across polls keyed by id + a content signature — `leads` gets a brand-new array
  // (and brand-new lead objects) on every poll that DOES carry a real change, but usually only a
  // handful of the ~41,500 leads actually changed, so re-running derive()'s ~19 regex tests on
  // every lead every time is the freeze. Unchanged leads are served from cache; only new/changed
  // ones pay the cost.
  const deriveCache = useRef(new Map<string, { sig: string; d: Derived }>());
  const rows: R[] = useMemo(() => leads.map((l) => {
    let sig: string;
    try { sig = JSON.stringify(l); } catch { sig = ""; }
    const cached = sig && deriveCache.current.get(l.id);
    if (cached && cached.sig === sig) return { l, d: cached.d };
    const d = derive(l);
    if (sig) deriveCache.current.set(l.id, { sig, d });
    return { l, d };
  }), [leads]);
  const term = useDeferredValue(q.trim().toLowerCase());
  // Options that come from the data: regions and directories, biggest first.
  const opts = useMemo(() => {
    const tally = (pick: (r: R) => string[]) => { const c = new Map<string, number>(); for (const r of rows) for (const v of pick(r)) c.set(v, (c.get(v) ?? 0) + 1); return [...c.keys()].sort((a, b) => c.get(b)! - c.get(a)!); };
    return {
      ...STATIC_OPTS,
      nation: tally((r) => [r.d.nation || "Not known"]).sort((a, b) => Number(a === "Not known") - Number(b === "Not known")).map((v) => ({ value: v, label: v === "Not known" ? "❓ Not known" : `${NATION_FLAG[v] ?? "🇬🇧"} ${v}`, hint: v === "England" ? "Ofsted register + UK directories" : v === "Wales" ? "Care Inspectorate Wales register" : v === "Scotland" ? "Care Inspectorate (Scotland) register" : v === "Northern Ireland" ? "Family Support NI / HSC Trust registers" : undefined, test: ({ d }: R) => (d.nation || "Not known") === v })),
      region: tally((r) => [r.d.region || "Not known"]).sort((a, b) => Number(a === "Not known") - Number(b === "Not known")).map((v) => ({ value: v, label: v === "Not known" ? "📍 Not known" : `📍 ${v}`, test: ({ d }: R) => (d.region || "Not known") === v })),
      // Which import batch/category a lead came from — was a defined dimension with
      // zero options ever populated, so this filter silently did nothing until now.
      source: tally((r) => [r.l.source || "unknown"]).map((v) => {
        const CH_LABEL: Record<string, string> = {
          "companiesHouse-sports": "🏢 Companies House — sports", "companiesHouse-daycare": "🏢 Companies House — day-care",
          "companiesHouse-performingarts": "🏢 Companies House — performing arts", "unknown": "❓ Unknown source",
        };
        return { value: v, label: CH_LABEL[v] || srcMeta(v).label, group: v.startsWith("companiesHouse") ? "Companies House sweeps" : "Other sources", test: ({ l }: R) => (l.source || "unknown") === v };
      }),
      booking: [
        // "none" (confirmed no platform) lives once, under "Booking platforms" below
        // (value: "noPlatform") — it used to also appear here under "Overall" with
        // an identical test, which showed as the same option twice in the list.
        { value: "manualBooking", label: "📞 Books by phone/email only — hot lead", group: "Overall", hint: "Their site was actually checked and explicitly says to call/phone/email to book — genuinely no online booking system to displace. The best kind of lead.", test: ({ l }: R) => l.bookingMethod === "confirmed-manual" },
        { value: "unknown", label: BOOKING.unknown.label, group: "Overall", hint: BOOKING.unknown.hint, test: ({ d }: R) => d.booking === "unknown" },
        { value: "online", label: "✅ Takes bookings online (any way)", group: "Overall", hint: "Listed on a booking platform, uses booking software, or books through its own website", test: ({ d }: R) => d.booking === "platform" },
        { value: "soon", label: BOOKING.soon.label, group: "Overall", hint: BOOKING.soon.hint, test: ({ d }: R) => d.booking === "soon" },
        { value: "anyPlatform", label: "🧾 On any booking platform / software", group: "Booking platforms", hint: "Listed on eequ / Pebble / Playwaze / Yellow Days, or their website sends parents to a booking system — a switch sale", test: ({ d }: R) => d.platforms.length > 0 },
        // Below used to hard-cap at the top 45 platforms by lead count — anything past that cutoff had NO filter
        // option at all (not grouped, silently unfindable). Now: recognizable UK activity-booking platforms stay
        // individually listed regardless of count (ClassForKids etc. are worth targeting even with modest counts
        // in this database), everything else needs 10+ leads to earn its own row, and the remainder — however
        // small — is still reachable as a group via "Other / niche platform" rather than dropped.
        ...(() => {
          const WELL_KNOWN = new Set(["ClassForKids", "Bookwhen", "Famly", "eequ", "Pebble", "Playwaze", "Yellow Days", "Magic Booking", "Blossom", "Tapestry", "ParentPay", "Connect Childcare", "Eventbrite", "Calendly", "Glofox", "Mindbody", "TeamUp", "Acuity", "HolidayActivities", "KipLearn (Kip McGrath)", "Legend (leisure)", "Gladstone (leisure)", "Better / GLL", "Everyone Active", "ActiveMe360", "1Life", "Fusion Lifestyle", "Places Leisure", "Freedom Leisure", "Parkwood Leisure"]);
          const counts = new Map<string, number>();
          for (const r of rows) for (const v of r.d.platforms) counts.set(v, (counts.get(v) ?? 0) + 1);
          const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          const big = sorted.filter(([v, n]) => n >= 10 || WELL_KNOWN.has(v));
          const niche = sorted.filter(([v, n]) => !(n >= 10 || WELL_KNOWN.has(v)));
          const nicheSet = new Set(niche.map(([v]) => v));
          const nicheLeadIds = new Set<string>();
          for (const r of rows) if (r.d.platforms.some((p) => nicheSet.has(p))) nicheLeadIds.add(r.l.id);
          const bigOpts = big.map(([v]) => ({ value: `plat:${v}`, label: `${DIRECTORY.some((k) => srcMeta(k).label.toLowerCase() === v.toLowerCase()) ? "📇" : "🧾"} ${v}`, group: "Booking platforms", test: ({ d }: R) => d.platforms.includes(v) }));
          const nicheOpt = niche.length ? [{ value: "plat:__other", label: `🗂️ Other / niche platform (${niche.length} platform${niche.length === 1 ? "" : "s"}, ${nicheLeadIds.size} lead${nicheLeadIds.size === 1 ? "" : "s"})`, group: "Booking platforms", hint: `Everything not individually listed above: ${niche.map(([v]) => v).slice(0, 25).join(", ")}${niche.length > 25 ? "…" : ""} — still filterable as a group; use search for one specific niche platform by name`, test: ({ d }: R) => d.platforms.some((p) => nicheSet.has(p)) }] : [];
          return [...bigOpts, ...nicheOpt];
        })(),
        { value: "multi", label: "🔗 On 2+ platforms", group: "Booking platforms", hint: "The same provider on more than one platform or system", test: ({ d }: R) => d.platforms.length > 1 },
        { value: "own", label: "🏠 Own website booking", group: "Booking platforms", hint: "Books or takes payment through its own website, portal or shop — hardest to switch", test: ({ d }: R) => /^own\b/i.test(d.system) },
        { value: "noPlatform", label: "🚫 Not on any platform (confirmed)", group: "Booking platforms", hint: "Their site was actually read and no booking system or manual-booking wording was found — this is the checked/confirmed 'none' state, not merely unchecked (see ❔ Not yet checked for those)", test: ({ d }: R) => d.booking === "none" },
        { value: "hafList", label: "🍎 Council HAF list", group: "Also found on", hint: "Named on a council Holiday Activities & Food programme list", test: ({ d, l }: R) => d.srcs.includes("haf") || !!l.hafLocalAuthority },
      ],
    } as Record<Dim, Opt[]>;
  }, [rows]);
  const viewTest = VIEWS.find((v) => v.key === view)?.test ?? (() => true);
  const okTerm = ({ l }: R) => !term || [l.name, l.business, l.location, l.county, l.region, l.nation, l.email, l.phone, l.message, l.bookingSystem, l.website, l.websiteCandidate, l.sport, l.network].some((x) => (x ?? "").toLowerCase().includes(term));
  const DIMS = Object.keys(NO_FILTERS) as Dim[];
  // pass() only ever needs to know, per active dimension, whether the row matches one of the
  // few TICKED option values (f[dim], typically 1-3) — not whether it matches any of the up-to-
  // ~90 options that dimension HAS (the "Platform" dropdown alone). Testing every option per row
  // to find a match in a small selected set was the freeze: up to ~41,500 rows × ~90 `.test()`
  // calls per active filter, synchronously, on every checkbox click. A value→option lookup lets
  // pass() iterate the small selected set instead and test only those directly. `value` is a
  // dimension-scoped key (never reused within one dim — see the "noPlatform"/"none" dedupe above),
  // so building a Map per dimension is safe and can't silently drop a same-value option.
  const optsByValue = useMemo(() => {
    const m = {} as Record<Dim, Map<string, Opt>>;
    for (const dim of DIMS) m[dim] = new Map(opts[dim].map((o) => [o.value, o]));
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);
  /** Passes every filter except `skip` (so a dropdown's counts are "if you ticked this"). */
  const pass = (r: R, skip: Dim | "view" | null = null) => {
    if (skip !== "view" && !viewTest(r)) return false;
    for (const dim of DIMS) {
      if (dim === skip || !f[dim].length) continue;
      if (!f[dim].some((v) => optsByValue[dim].get(v)?.test(r))) return false;
    }
    return okTerm(r);
  };
  const FIT_RANK: Record<Fit, number> = { core: 40, adjacent: 20, nursery: 0 };
  const reachScore = ({ l }: R) => (l.email ? 8 : 0) + (l.phone ? 4 : 0) + (l.website ? 2 : 0);
  // Best prospects: demo requests (someone asked), then fit for what we sell,
  // then reachability, then no platform yet (greenfield), then size.
  const bestScore = (r: R) => (r.d.srcs.includes("demo") ? 100 : 0) + FIT_RANK[r.d.fit] + reachScore(r) + (r.d.booking !== "platform" ? 1 : 0);
  const sites = ({ l }: R) => l.ofstedSites ?? l.listingsOnSource ?? 0;
  const shown = useMemo(() => {
    const out = rows.filter((r) => pass(r));
    const cmp: Record<SortKey, (a: R, b: R) => number> = {
      best: (a, b) => bestScore(b) - bestScore(a) || sites(b) - sites(a),
      reach: (a, b) => reachScore(b) - reachScore(a) || bestScore(b) - bestScore(a),
      big: (a, b) => sites(b) - sites(a) || (b.l.networkOperators ?? 0) - (a.l.networkOperators ?? 0),
      new: (a, b) => String(b.l.createdAt).localeCompare(String(a.l.createdAt)),
      az: (a, b) => a.l.name.localeCompare(b.l.name),
    };
    return out.sort(cmp[sort]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, view, f, term, sort, opts]);
  // One pass over the list for every view's count (not one pass per view).
  const viewCounts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(VIEWS.map((v) => [v.key, 0]));
    for (const r of rows) { if (!pass(r, "view")) continue; for (const v of VIEWS) if (v.test(r)) c[v.key]++; }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, f, term, opts]);
  // The filter dropdowns: one pass over the list PER DIMENSION for all of that
  // dimension's option counts (not one pass per option — a dimension with 20
  // options used to mean 20 full scans of the list on every render).
  const MENU_DIMS: Dim[] = ["runs", "nation", "region", "ofsted", "schoolType", "schoolPhase", "schoolGovernance", "roleContact", "size", "booking", "contact", "status", "source"];
  const dropdownCounts = useMemo(() => {
    const maps = Object.fromEntries(MENU_DIMS.map((dim) => [dim, new Map<string, number>()])) as Record<Dim, Map<string, number>>;
    for (const dim of MENU_DIMS) {
      const map = maps[dim];
      for (const r of rows) {
        if (!pass(r, dim)) continue;
        for (const o of opts[dim]) if (o.test(r)) map.set(o.value, (map.get(o.value) ?? 0) + 1);
      }
    }
    return maps;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, view, f, term, opts]);
  const planTabs: [string, string][] = [["", "All plans"], ["company", "🏢 Companies"], ["freelancer", "🧑 Freelancers"]];
  const setDim = (dim: Dim, v: string[]) => { setF((cur) => ({ ...cur, [dim]: v })); setLimit(60); };
  const active = DIMS.filter((dim) => dim !== "plan").flatMap((dim) => f[dim].map((v) => ({ dim, v, label: opts[dim].find((o) => o.value === v)?.label ?? v })));
  const clearAll = () => { setF(NO_FILTERS); setQ(""); setLimit(60); };

  const [exportOpen, setExportOpen] = useState(false);
  const exportBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => { if (exportBox.current && !exportBox.current.contains(e.target as Node)) setExportOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [exportOpen]);

  const exportCsv = (list: R[], tag: string) => {
    const head = ["Name", "Registered name", "Company number", "Review status", "Email", "OK to email (PECR)", "Phone", "Website", "Possible website (unconfirmed)", "Indirect contact", "Indirect contact type", "Indirect contact note", "Postcode/location", "Region", "Nation", "Runs", "Fit", "Size", "Franchise / group", "Booking", "Directories", "Status", "Listing link"];
    const reviewLabel = (l: Lead) => l.reviewTier === "likely_fit" ? "Likely fit" : l.reviewTier === "uncertain" ? "Needs a glance" : "";
    const lines = list.map(({ l, d }) => [l.name, l.business, l.companyNumber ?? "", reviewLabel(l), l.email, okToEmail(l) ? "yes" : l.email ? "needs consent" : "", l.phone, l.website, l.website ? "" : l.websiteCandidate, l.secondaryContact ?? "", l.secondaryContactType ?? "", l.secondaryContactNote ?? "", l.location, d.region, d.nation, d.types.map((t) => TYPE[t]?.label).join("; "), FIT[d.fit].label.replace(/^\S+ /, ""), SIZE[d.size].replace(/^\S+ /, ""), l.network ?? "", BOOKING[d.booking].label.replace(/^\S+ /, ""), d.srcs.map((s) => srcMeta(s).label).join("; "), TONE[l.status]?.label ?? l.status, l.sourceUrl ?? ""].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `leads-${tag}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportOpen(false);
  };

  const best = rows.filter(VIEWS.find((v) => v.key === "best")!.test);
  const ready = rows.filter((r) => reachable(r.l)).length;

  return (
    <div>
      {undo && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,.5)]">
          <span>Marked <strong>{undo.name}</strong> as {TONE[undo.next]?.label ?? undo.next}</span>
          <button type="button" onClick={() => { setStatus(undo.id, undo.prev); setUndo(null); }}
            className="font-extrabold text-[var(--brand)] underline">Undo</button>
        </div>
      )}
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💬</span>Prospective leads
        </div>
        <p className="mt-1 text-[12.5px] text-white/80">UK children&apos;s activity and childcare providers — from booking directories, Ofsted&apos;s register and website demo requests.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          {([["Providers (whole database)", rows.length], ["📇 Ready to contact", ready], ["⭐ Best prospects", best.length], ["🔎 Still researching", rows.length - ready]] as const).map(([k, n]) => (
            <span key={k} className="rounded-xl bg-white/15 px-3 py-1.5"><b className="text-[15px]">{n.toLocaleString()}</b> <span className="text-white/85">{k}</span></span>
          ))}
          <span className="rounded-xl bg-white/10 px-3 py-1.5 text-white/70">These totals ignore filters — the tabs and list below reflect your current filter</span>
        </div>
      </div>

      {/* 1 · Which list. */}
      <div className="mb-2.5 flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-sm">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" title={v.hint} onClick={() => { setView(v.key); setLimit(60); }} aria-pressed={view === v.key}
            className={`flex-none whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-extrabold transition-colors ${v.key === "research" ? "sm:ml-auto" : ""}`}
            style={view === v.key ? { background: v.key === "research" ? "var(--ink-2)" : "var(--brand)", color: "#fff" } : { color: v.key === "research" ? "var(--ink-3)" : "var(--ink-2)" }}>
            {v.label} <span className="font-bold opacity-75">{(viewCounts[v.key] ?? 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* 2 · Narrow it down — every filter in one bar. */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-sm">
        <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} placeholder="🔍 Search name, town, email…"
          className="w-[220px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--brand)]" />
        <div className="inline-flex rounded-xl border border-[var(--line)] p-0.5" role="group" aria-label="Plan">
          {planTabs.map(([k, label]) => { const on = k ? f.plan.length === 1 && f.plan[0] === k : !f.plan.length; return (
            <button key={k || "all"} type="button" onClick={() => setDim("plan", k ? [k] : [])} aria-pressed={on}
              className="rounded-lg px-2.5 py-1 text-[12.5px] font-bold transition-colors"
              style={on ? { background: "var(--ink)", color: "#fff" } : { color: "var(--ink-2)" }}>{label}</button>
          ); })}
          {/* Independent schools are sourced now (DfE GIAS import) — these two are real filters
              on the schoolType dim. State schools genuinely aren't sourced yet, so that one stays
              a placeholder until a register for them exists. */}
          {([
            ["🎓 Independent schools (non-SEND)", ["prep", "senior", "all_through", "other"]],
            ["🎓 Independent schools (SEND)", ["send"]],
          ] as [string, string[]][]).map(([label, vals]) => {
            const on = f.schoolType.length === vals.length && vals.every((v) => f.schoolType.includes(v));
            return (
              <button key={label} type="button" onClick={() => setDim("schoolType", on ? [] : vals)} aria-pressed={on}
                className="rounded-lg px-2.5 py-1 text-[12.5px] font-bold transition-colors"
                style={on ? { background: "var(--ink)", color: "#fff" } : { color: "var(--ink-2)" }}>{label}</button>
            );
          })}
          {(() => {
            // State schools are sourced now too (DfE GIAS state-funded-schools import), but unlike the
            // Independent quick-tabs above (which filter on schoolType — a field only GIAS-sourced leads
            // carry), schoolPhase alone wouldn't distinguish "state school" from some other future source
            // that also happened to have a phase field. Filter on `source` directly instead — the one field
            // that unambiguously means "this exact import".
            const on = f.source.length === 1 && f.source[0] === "gias-state";
            return (
              <button type="button" onClick={() => setDim("source", on ? [] : ["gias-state"])} aria-pressed={on}
                className="rounded-lg px-2.5 py-1 text-[12.5px] font-bold transition-colors"
                style={on ? { background: "var(--ink)", color: "#fff" } : { color: "var(--ink-2)" }}>
                🏫 State schools
              </button>
            );
          })()}
        </div>
        {(["runs", "nation", "region", "ofsted", "schoolType", "schoolPhase", "schoolGovernance", "roleContact", "size", "booking", "contact", "status", "source"] as Dim[]).map((dim) => (
          <FilterMenu key={dim} dim={dim} opts={opts[dim]} value={f[dim]} onChange={(v) => setDim(dim, v)}
            countFor={(o) => dropdownCounts[dim].get(o.value) ?? 0} />
        ))}
        {(active.length > 0 || q || f.plan.length > 0) && <button type="button" onClick={clearAll} className="ml-auto px-1.5 text-[12px] font-bold text-[var(--brand)] underline">Clear filters</button>}
      </div>

      {/* 3 · Exactly what's on screen, in words. */}
      <div className="mb-3 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-[15px] font-extrabold text-[var(--ink)]">{shown.length.toLocaleString()} lead{shown.length === 1 ? "" : "s"}</span>
        <span className="text-[13px] font-bold text-[var(--ink-2)]">· {VIEWS.find((v) => v.key === view)?.label.replace(/^\S+ /, "")}{f.plan.length === 1 ? ` · ${f.plan[0] === "company" ? "Companies" : "Freelancers"}` : ""}</span>
        {active.map(({ dim, v, label }) => (
          <button key={`${dim}:${v}`} type="button" onClick={() => setDim(dim, f[dim].filter((x) => x !== v))}
            className="flex items-center gap-1 rounded-full bg-[#eaf0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--brand)] hover:bg-[#dde6ff]" title="Remove this filter">
            {label} <span aria-hidden>×</span>
          </button>
        ))}
        {q && <button type="button" onClick={() => setQ("")} className="flex items-center gap-1 rounded-full bg-[#eaf0ff] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--brand)]">“{q}” ×</button>}
        <span className="text-[12px] text-[var(--ink-3)]">— {shown.filter((r) => r.l.email).length.toLocaleString()} with email ({shown.filter((r) => okToEmail(r.l)).length.toLocaleString()} OK to email) · {shown.filter((r) => r.l.phone).length.toLocaleString()} with phone</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink-3)]">Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px] font-bold text-[var(--ink-2)]">
              {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
            </select>
          </label>
          <div ref={exportBox} className="relative">
            <button type="button" onClick={() => setExportOpen((o) => !o)} disabled={!shown.length} aria-expanded={exportOpen}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-50">⬇ Export CSV <span aria-hidden className="text-[10px]">▾</span></button>
            {exportOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[300px] overflow-hidden rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] shadow-[0_20px_50px_-16px_rgba(15,23,42,.5)]">
                <button type="button" onClick={() => exportCsv(shown, view)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-4 py-3 text-left hover:bg-[#eaf0ff]">
                  <span className="text-[13.5px] font-extrabold text-[var(--ink)]">⬇ Export as it is ({shown.length.toLocaleString()})</span>
                  <span className="text-[11.5px] font-medium text-[var(--ink-3)]">The filters you already have set{active.length || q || f.plan.length ? "" : " (none active)"}</span>
                </button>
                <button type="button" onClick={() => exportCsv(rows, "all")}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-[#eaf0ff]">
                  <span className="text-[13.5px] font-extrabold text-[var(--ink)]">⬇ Export everything ({rows.length.toLocaleString()})</span>
                  <span className="text-[11.5px] font-medium text-[var(--ink-3)]">Ignore filters — the whole database</span>
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => { setLoading(true); void load(true, true); }} title="Load the latest research"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-[var(--ink-3)]">Loading leads… <span className="text-[12px]">(the first load after the server restarts can take a minute)</span>{loadWhy && <span className="mt-1 block text-[12px] text-[#9a5a00]">Still trying — last attempt: {loadWhy}</span>}</div>
      ) : loadError ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-[var(--ink-3)]">
          Couldn&apos;t load the leads{loadWhy ? <>: <b className="text-[var(--ink-2)]">{loadWhy}</b></> : " — is the server running?"}{" "}
          <button type="button" onClick={() => { setLoading(true); setLoadError(false); setLoadWhy(""); void load(); }} className="font-bold text-[var(--brand)] underline">Try again</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-[var(--ink-3)]">
          {rows.length ? <>No leads match these filters. <button type="button" onClick={() => { clearAll(); setView("all"); }} className="font-bold text-[var(--brand)] underline">Show all leads</button></> : "No leads yet. Demo requests from the website land here."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.slice(0, limit).map(({ l }) => {
            const tone = TONE[l.status] || TONE.new;
            return (
              <div key={l.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-[15px] text-[var(--ink)]">{l.name}</b>
                      {l.business && <span className="text-[13px] text-[var(--ink-3)]">· {l.business}</span>}
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                      {srcOf(l).map((sname) => { const url = l.sourceRefs?.[sname]?.url || (sname === l.source ? l.sourceUrl : undefined); const cls = "rounded-full px-2.5 py-0.5 text-[11px] font-bold"; const st = { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }; return url
                        ? <a key={sname} href={url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:underline`} style={st} title={`Their listing on ${srcMeta(sname).label}`}>{srcMeta(sname).emoji} {srcMeta(sname).label} ↗</a>
                        : <span key={sname} className={cls} style={st} title="How this lead reached you">{srcMeta(sname).emoji} {srcMeta(sname).label}</span>; })}
                      {srcOf(l).length > 1 && <span className="rounded-full bg-[#e6f6f4] px-2 py-0.5 text-[10.5px] font-extrabold text-[#0e7a75]" title="Found on more than one directory — one provider, one lead">🔗 {srcOf(l).length} directories</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-[var(--ink-2)]">
                      {l.email && <a href={`mailto:${l.email}`} className="font-semibold hover:underline" style={{ color: "var(--brand)" }} title={l.emailFrom ? `Published at ${l.emailFrom}` : undefined}>✉️ {l.email}</a>}
                      {l.phone && <a href={`tel:${l.phone}`} className="hover:underline" title={`${l.phoneFrom ? `Published at ${l.phoneFrom}. ` : ""}Screen against the TPS / CTPS before a sales call (UK PECR).`}>📞 {l.phone}</a>}
                      {!l.email && !l.phone && !l.secondaryContact && <span className="text-[var(--ink-3)]" title="Research is still looking for their email / phone">🔎 contact details being researched</span>}
                      {l.secondaryContact && (isHttpUrl(l.secondaryContact)
                        ? <a href={l.secondaryContact} target="_blank" rel="noopener noreferrer" title={l.secondaryContactNote || undefined} className="rounded-full border border-dashed border-[#9a5a00] bg-[#fff4e5] px-2 py-0.5 text-[11.5px] font-bold text-[#9a5a00] hover:underline">📞 Indirect contact via {SECONDARY_TYPE_LABEL[l.secondaryContactType || ""] || "secondary route"} ↗</a>
                        : <span title={l.secondaryContactNote || undefined} className="rounded-full border border-dashed border-[#9a5a00] bg-[#fff4e5] px-2 py-0.5 text-[11.5px] font-bold text-[#9a5a00]">📞 Indirect contact via {SECONDARY_TYPE_LABEL[l.secondaryContactType || ""] || "secondary route"}: {l.secondaryContact}</span>)}
                      {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>🌐 {l.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗</a>}
                      {l.socialUrl && <a href={l.socialUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1d4ed8] hover:underline" title="Their social page — not counted as a website">{/instagram/i.test(l.socialUrl) ? "📸" : /linktr/i.test(l.socialUrl) ? "🔗" : "📘"} {l.socialUrl.replace(/^https?:\/\/(www\.|m\.|en-gb\.|business\.)?/, "").replace(/\/$/, "").slice(0, 40)} ↗</a>}
                      {!l.website && l.websiteCandidate && <a href={l.websiteCandidate} target="_blank" rel="noopener noreferrer" className="rounded-md border border-dashed border-[#d9a84e] px-1.5 font-semibold text-[#9a5a00] hover:underline" title={`Possible website — not confirmed as theirs: ${l.websiteCandidateWhy ?? ""}`}>🌐? {l.websiteCandidate.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} · possible, not confirmed ↗</a>}
                      {l.location && <span title={[l.county, l.region].filter(Boolean).join(", ") || undefined}>📍 {l.location}{l.region && !l.location.includes(l.region) && (l.ofstedRegions?.length ?? 0) <= 1 ? ` · ${l.region}` : ""}</span>}
                      {l.size && <span>👥 {l.size}</span>}
                      <span className="text-[var(--ink-3)]">{fmt(l.createdAt)}</span>
                    </div>
                    {(l.plan || l.kind || l.legalForm || l.companyNumber || l.charityNumber || l.bookingSystem || l.haf || l.sourceUrl || l.comingSoon || l.providerTypes?.length || l.network || l.websiteDead || l.bookingMethod === "confirmed-manual" || l.schoolType || l.boarding || l.schoolPhase || l.schoolGovernance || l.roleContacts) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {l.plan && <span className="rounded-full px-2 py-0.5 font-extrabold" style={isFreelancer(l) ? { background: "#f3e8ff", color: "#6b21a8" } : { background: "#e0ecff", color: "#1d3a8f" }} title={l.planReason || undefined}>{isFreelancer(l) ? "🧑 Freelancer" : "🏢 Company"}</span>}
                        {l.legalForm && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">{l.legalForm}</span>}
                        {l.companyNumber && <a href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(l.companyNumber)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)] hover:underline">Co. {l.companyNumber} ↗</a>}
                        {l.charityNumber && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">Charity {l.charityNumber}</span>}
                        {l.bookingSystem && (l.bookingUrl
                          ? <a href={l.bookingUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-bold text-[#9a5a00] underline-offset-2 hover:underline" title={`The booking system their website sends parents to${l.bookingFrom ? ` · found by ${l.bookingFrom}` : ""} — opens where parents book`}>🧾 Books via {l.bookingSystem} ↗</a>
                          : <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-bold text-[#9a5a00]" title={`The booking system their website sends parents to${l.bookingFrom ? ` · found by ${l.bookingFrom}` : ""}`}>🧾 Books via {l.bookingSystem}</span>)}
                        {!l.bookingSystem && l.bookingMethod === "confirmed-manual" && <span className="rounded-full bg-[#e8f7ec] px-2 py-0.5 font-extrabold text-[#1c6b3a]" title={`Their site was checked and explicitly says to book by phone/email${l.bookingMethodEvidence ? ` ("${l.bookingMethodEvidence}")` : ""} — no online booking system to displace, a genuinely great lead.`}>📞 Books by phone/email only — hot lead</span>}
                        {l.haf && (l.hafFrom
                          ? <a href={l.hafFrom} target="_blank" rel="noreferrer" className="rounded-full bg-[#e8f7ec] px-2 py-0.5 font-extrabold text-[#1c6b3a] underline-offset-2 hover:underline" title={`Their website mentions the Holiday Activities & Food programme${l.hafText ? ` ("${l.hafText}")` : ""}${l.hafLocalAuthority ? ` · listed by ${l.hafLocalAuthority}` : ""} — opens the page`}>🍎 HAF provider{l.hafLocalAuthority ? ` · ${l.hafLocalAuthority}` : ""}{l.hafPaid === true ? " · also sells paid places" : l.hafPaid === false ? " · free places only" : ""} ↗</a>
                          : <span className="rounded-full bg-[#e8f7ec] px-2 py-0.5 font-extrabold text-[#1c6b3a]" title="Listed as a Holiday Activities & Food programme provider">🍎 HAF provider{l.hafLocalAuthority ? ` · ${l.hafLocalAuthority}` : ""}{l.hafPaid === true ? " · also sells paid places" : l.hafPaid === false ? " · free places only" : ""}</span>)}
                        {l.listingsOnSource ? <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-bold text-[#1d3a8f]">{l.listingsOnSource} listing{l.listingsOnSource === 1 ? "" : "s"} on {srcMeta(l.source).label}</span> : null}
                        {(l.providerTypes ?? []).map((t) => TYPE[t] && <span key={t} className="rounded-full bg-[#eef9f0] px-2 py-0.5 font-bold text-[#0f6b3a]">{TYPE[t].emoji} {TYPE[t].label}</span>)}
                        {/* This lead IS a school on the GIAS register when its own name already says so — no need to also
                            name it. Show the school name only when the lead is something else (a club/nursery/committee)
                            that GIAS's own dedupe linked to a school, so it's clear WHICH school that's about. */}
                        {l.giasSchoolName && !sameOrg(l.giasSchoolName, l.name) && !sameOrg(l.giasSchoolName, l.business) && (
                          <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]" title="The DfE GIAS register links this lead to this school (e.g. an out-of-school club or nursery operating on its site)">🏫 at {l.giasSchoolName}</span>
                        )}
                        {l.schoolType && <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 font-bold text-[#6b21a8]" title={l.ageLow != null && l.ageHigh != null ? `Ages ${l.ageLow}–${l.ageHigh} (DfE GIAS register)` : "DfE GIAS register"}>{SCHOOL_TYPE_BADGE[l.schoolType] || l.schoolType}</span>}
                        {l.boarding && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]" title="Takes boarders (DfE GIAS register)">🛏️ Boarding</span>}
                        {l.schoolPhase && <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 font-bold text-[#6b21a8]" title={l.ageLow != null && l.ageHigh != null ? `Ages ${l.ageLow}–${l.ageHigh} (DfE GIAS register)` : "DfE GIAS register"}>{SCHOOL_PHASE_BADGE[l.schoolPhase] || l.schoolPhase}</span>}
                        {l.schoolGovernance && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]" title={l.trustName ? `${l.trustName} (DfE GIAS register)` : "DfE GIAS register"}>{SCHOOL_GOV_BADGE[l.schoolGovernance] || l.schoolGovernance}{l.trustName ? ` · ${l.trustName}` : ""}</span>}
                        {l.roleContacts && Object.entries(l.roleContacts).map(([role, c]) => c && (
                          <span key={role} className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-bold text-[#1d3a8f]" title={`Read from their staff/key-staff page${c.email ? `: ${c.email}` : ""}`}>
                            {ROLE_CONTACT_LABEL[role] || role}{c.name ? ` · ${c.name}` : ""}
                          </span>
                        ))}
                        {l.network && <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 font-extrabold text-[#6b21a8]" title={l.networkKind === "franchise" ? "A franchisee — the brand's head office is a Franchise-plan lead" : "Part of a group of separately registered companies"}>{l.networkKind === "franchise" ? `🌐 ${l.network} franchisee` : `🏛 ${l.network} group`}{l.networkOperators ? ` · 1 of ${l.networkOperators}` : ""}</span>}
                        {l.ofstedSites ? <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-bold text-[#1d3a8f]" title="Venues registered with Ofsted (Childcare Register)">🏫 {l.ofstedSites} Ofsted-registered site{l.ofstedSites === 1 ? "" : "s"}</span> : null}
                        {srcOf(l).includes("ofsted") && <span className="rounded-full bg-[#e9f7f6] px-2 py-0.5 font-bold text-[#0e7a75]" title="Ofsted-registered childcare can take Tax-Free Childcare payments — ActivityOS handles TFC">💷 Can take Tax-Free Childcare</span>}
                        {l.comingSoon && <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-extrabold text-[#9a5a00]" title="Their website is a 'coming soon' / under-construction page — a good sign they have no booking platform yet">🚧 Website coming soon — likely no booking platform</span>}
                        {isWebsiteOpportunity(l) && <span className="rounded-full bg-[#e8f7ec] px-2 py-0.5 font-extrabold text-[#1c6b3a]" title={`${DEAD_CATEGORY_LABEL[l.websiteDeadCategory || ""] || "Website dead"}: ${l.websiteDeadWhy || ""} — the domain still resolves to something, so the business likely still exists. Sales opportunity: pitch a new website build as part of the ActivityOS package.`}>🌐 Website opportunity — {DEAD_CATEGORY_LABEL[l.websiteDeadCategory || ""] || "dead site"}</span>}
                        {l.websiteDead && !isWebsiteOpportunity(l) && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-3)] ring-1 ring-[var(--line)]" title={`${l.websiteDeadWhy || "Website unreachable"} — no signal the business is still there.`}>🚫 Website unreachable</span>}

                        {l.confidence && l.confidence !== "high" && l.confidence !== "unverified" && <span className="rounded-full bg-[#fdf3d8] px-2 py-0.5 font-bold text-[#9a5a00]" title="How sure the research is that these details are this provider's">⚠ {l.confidence} confidence — check before contacting</span>}
                        {l.personalContact && l.kind !== "person" && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 font-bold text-[#b3123c]" title="UK PECR/GDPR: a named person's or personal mailbox — get their consent before sending marketing email">Personal contact — needs consent before marketing email</span>}
                        {l.kind === "person" && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 font-bold text-[#b3123c]" title="UK PECR: sole traders count as individuals — marketing email needs their consent first">Sole trader — needs consent before marketing email</span>}
                      </div>
                    )}
                    {l.message && (
                      <details className="mt-2 max-w-[80ch] rounded-lg bg-[var(--panel)] p-2.5 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="line-clamp-2 cursor-pointer list-none text-[12.5px] leading-[1.5] text-[var(--ink-2)]" title="Click to show the full text">
                          {l.message} <span className="ml-1 font-bold text-[var(--brand)]">— show more</span>
                        </summary>
                        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{l.message}</p>
                      </details>
                    )}
                  </div>
                  <div className="flex flex-none flex-wrap gap-1.5">
                    {STATUSES.filter((s) => s !== l.status).map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(l.id, s, l.name, l.status)}
                        className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-extrabold transition-colors"
                        style={{ background: "var(--panel)", color: TONE[s].fg, border: "1px solid var(--line)" }}>
                        → {TONE[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length > limit && (
            <button type="button" onClick={() => setLimit((n) => n + 60)} className="mx-auto mt-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">
              Show more · {(shown.length - limit).toLocaleString()} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
