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
  other: { label: "Other childcare", emoji: "🏫" },
};
const CORE = ["holiday", "wraparound", "activity"];
const DIRECTORY = ["eequ", "playwaze", "pebble", "yellowdays"];
const HOLIDAY_WORDS = /\b(holiday|camps?|play ?scheme|half[- ]term)\b/i;
type Fit = "core" | "adjacent" | "nursery";
type Size = "solo" | "single" | "multi" | "large" | "franchise" | "group";
type Booking = "none" | "unknown" | "soon" | "platform";
interface Derived { types: string[]; fit: Fit; size: Size; booking: Booking; srcs: string[]; region: string; nation: string; acts: string[]; hafPaid: boolean | null; system: string }
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
function derive(l: Lead): Derived {
  const srcs = l.sources?.length ? l.sources : [l.source || "demo"];
  const onDir = srcs.some((s) => DIRECTORY.includes(s));
  // Directory providers (EEQU, Pebble…) are activity providers; holiday camps by their words.
  const types = l.providerTypes?.length ? l.providerTypes : onDir ? [HOLIDAY_WORDS.test(`${l.name} ${l.sport ?? ""} ${l.message ?? ""}`) ? "holiday" : "activity"] : [];
  const fit: Fit = !types.length || types.some((t) => CORE.includes(t)) ? "core" : types.some((t) => t === "tuition" || t === "preschool") ? "adjacent" : "nursery";
  const n = l.ofstedSites ?? 0;
  const size: Size = l.networkKind === "franchise" ? "franchise" : l.networkKind === "group" ? "group" : n >= 10 ? "large" : n >= 2 ? "multi" : l.kind === "person" || l.plan === "freelancer" ? "solo" : "single";
  // "none" is a CLAIM (their site was crawled and only offers enquiry) — a lead with no website, or one the
  // crawler never got proof from, is "unknown", not greenfield.
  const booking: Booking = onDir || l.bookingSystem ? "platform" : l.comingSoon ? "soon" : l.bookingChecked ? "none" : "unknown";
  // (The Ofsted description starts with our own type labels — "Sports & activity classes…" — so skip that clause.)
  const text = `${l.name} ${l.business ?? ""} ${l.sport ?? ""} ${(l.message ?? "").replace(/^Ofsted-registered — [^.]*\./, "")} ${l.network ?? ""} ${(l.website ?? "").replace(/^https?:\/\/(www\.)?/, "")}`;
  const acts = [...new Set([...ACTIVITY.filter(([, , re]) => re.test(text)).map(([k]) => k), ...(l.activityTypes ?? []), ...(l.haf ? ["haf"] : [])])];
  const region = regionFrom(l);
  // HAF providers: do they also sell paid places? Confirmed by research when known; otherwise
  // a strong signal is being on a booking directory / system, or running a nursery / wraparound / classes.
  const hafPaid = !acts.includes("haf") ? null : typeof l.hafPaid === "boolean" ? l.hafPaid : booking === "platform" || types.some((t) => ["nursery", "preschool", "wraparound", "activity", "tuition"].includes(t)) ? true : null;
  // The one booking system they use (first named), e.g. "Bookwhen", "own portal", "Famly (nursery app)".
  const system = (l.bookingSystem || "").split(/;|\/| — /)[0].trim();
  return { types, fit, size, booking, srcs, region, nation: nationFrom(l, region), acts, hafPaid, system };
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
};
/** The directories a lead is on — all of them, not only the one it was first found on. */
const srcOf = (l: { sources?: string[]; source?: string }) => (l.sources?.length ? l.sources : [l.source || "demo"]);
const srcMeta = (s?: string) => SOURCE[s || "demo"] || { label: (s || "Website").replace(/^\w/, (c) => c.toUpperCase()), emoji: "🌐" };

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
type Dim = "plan" | "runs" | "activity" | "fit" | "size" | "booking" | "nation" | "region" | "ofsted" | "source" | "contact" | "status";
const okToEmail = (l: Lead) => !!l.email && !l.personalContact && l.kind !== "person";
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
  contact: [
    { value: "okEmail", label: "✅ OK to email", hint: "A business mailbox — not a sole trader or a named person's address (UK PECR)", test: ({ l }) => okToEmail(l) },
    { value: "email", label: "✉️ Has email", test: ({ l }) => !!l.email },
    { value: "phone", label: "📞 Has phone", hint: "UK PECR: screen numbers against the TPS / CTPS before sales calls", test: ({ l }) => !!l.phone },
    { value: "phoneOnly", label: "📞 Phone only", test: ({ l }) => !!l.phone && !l.email },
    { value: "web", label: "🌐 Has website", test: ({ l }) => !!l.website },
    { value: "webOnly", label: "🌐 Website only", test: ({ l }) => !!l.website && !l.email && !l.phone },
    { value: "maybeWeb", label: "🌐? Possible website", hint: "A site matching their name that research couldn't confirm is theirs — check it before using", test: ({ l }) => !l.website && !!l.websiteCandidate },
    { value: "noWeb", label: "🚫 No website", hint: "No confirmed website on record (includes possible-website leads and social-page-only leads)", test: ({ l }) => !l.website },
    { value: "socialOnly", label: "📘 Social page only", hint: "A Facebook/Instagram page but no website of their own", test: ({ l }) => !l.website && !!l.socialUrl },
    { value: "soon", label: "🚧 Coming-soon website", hint: "Their site is a holding page — likely no booking platform yet", test: ({ l }) => !!l.comingSoon },
  ],
  status: STATUSES.map((s) => ({ value: s, label: TONE[s].label, test: ({ l }: R) => (l.status || "new") === s })),
};
const DIM_LABEL: Record<Dim, string> = { plan: "Plan", runs: "What they do", activity: "Activity", fit: "Fit", size: "Size", booking: "Platform", nation: "Nation", region: "Region", ofsted: "Ofsted registered", source: "Found on", contact: "Contact", status: "Status" };
type Filters = Record<Dim, string[]>;
const NO_FILTERS: Filters = { plan: [], runs: [], activity: [], fit: [], size: [], booking: [], nation: [], region: [], ofsted: [], source: [], contact: [], status: [] };

// Which list you're working. Only four, and they don't overlap in confusing ways:
// best prospects ⊂ ready to contact; still researching = everyone else; demo
// requests are people who asked. Everything else (holiday camps, head-office
// deals, no platform yet…) is a filter, so the filter bar is the one place to narrow down.
const reachable = (l: Lead) => !!l.email || !!l.phone;
const VIEWS: { key: string; label: string; hint: string; test: (r: R) => boolean }[] = [
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
  // Anchor the menu to whichever side keeps it on screen (the right-hand filters were clipping their counts).
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const r = box.current?.getBoundingClientRect(); if (r) setAlignRight(r.left + 320 > window.innerWidth - 12);
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const on = value.length > 0;
  const summary = !on ? "Any" : value.length === 1 ? (opts.find((o) => o.value === value[0])?.label ?? value[0]) : `${value.length} selected`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
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
        // Fits the window: at most 60% of its height, scrolling inside; hints are a
        // single line (hover for the whole thing) so every option is visible.
        <div className={`absolute ${alignRight ? "right-0" : "left-0"} top-[calc(100%+6px)] z-30 w-[320px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_40px_-18px_rgba(15,23,42,.45)]`} style={{ maxHeight: "min(60vh, 520px)" }}>
          {opts.map((o, i) => { const n = countFor(o); const ticked = value.includes(o.value); const heading = o.group && o.group !== opts[i - 1]?.group; return (<div key={o.value}>
            {heading && <div className="mt-1.5 px-2.5 pb-0.5 pt-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)] first:mt-0">{o.group}</div>}
            <label title={o.hint} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] hover:bg-[var(--panel)]" style={{ opacity: n || ticked ? 1 : 0.45 }}>
              <input type="checkbox" checked={ticked} onChange={() => toggle(o.value)} className="h-4 w-4 flex-none accent-[var(--brand)]" />
              <span className="min-w-0 flex-1 font-semibold text-[var(--ink)]">{o.label}{o.hint && <span className="block truncate text-[10.5px] font-normal text-[var(--ink-3)]">{o.hint}</span>}</span>
              <span className="text-[11.5px] font-bold tabular-nums text-[var(--ink-3)]">{n.toLocaleString()}</span>
            </label>
          </div>); })}
          {on && <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] font-bold text-[var(--brand)] hover:bg-[var(--panel)]">Clear {DIM_LABEL[dim].toLowerCase()}</button>}
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
      setLeads(r.leads || []); setLoadError(false); setLoading(false);
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

  const setStatus = async (id: string, status: string) => {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    await api(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
  };

  // Tens of thousands of leads: work out each one's fit / size / booking / region once.
  const rows: R[] = useMemo(() => leads.map((l) => ({ l, d: derive(l) })), [leads]);
  const term = useDeferredValue(q.trim().toLowerCase());
  // Options that come from the data: regions and directories, biggest first.
  const opts = useMemo(() => {
    const tally = (pick: (r: R) => string[]) => { const c = new Map<string, number>(); for (const r of rows) for (const v of pick(r)) c.set(v, (c.get(v) ?? 0) + 1); return [...c.keys()].sort((a, b) => c.get(b)! - c.get(a)!); };
    return {
      ...STATIC_OPTS,
      nation: tally((r) => [r.d.nation || "Not known"]).sort((a, b) => Number(a === "Not known") - Number(b === "Not known")).map((v) => ({ value: v, label: v === "Not known" ? "❓ Not known" : `${NATION_FLAG[v] ?? "🇬🇧"} ${v}`, hint: v === "England" ? "Ofsted register + UK directories" : v === "Wales" ? "Care Inspectorate Wales register" : v === "Scotland" ? "Care Inspectorate (Scotland) register" : v === "Northern Ireland" ? "Family Support NI / HSC Trust registers" : undefined, test: ({ d }: R) => (d.nation || "Not known") === v })),
      region: tally((r) => [r.d.region || "Not known"]).sort((a, b) => Number(a === "Not known") - Number(b === "Not known")).map((v) => ({ value: v, label: v === "Not known" ? "📍 Not known" : `📍 ${v}`, test: ({ d }: R) => (d.region || "Not known") === v })),
      source: [],
      booking: [
        { value: "none", label: BOOKING.none.label, group: "Overall", hint: BOOKING.none.hint, test: ({ d }: R) => d.booking === "none" },
        { value: "online", label: "✅ Takes bookings online (any way)", group: "Overall", hint: "On a national directory, or uses booking software, or has its own booking system", test: ({ d }: R) => d.booking === "platform" },
        { value: "soon", label: BOOKING.soon.label, group: "Overall", hint: BOOKING.soon.hint, test: ({ d }: R) => d.booking === "soon" },
        { value: "anyDir", label: "📇 On a national directory (any)", group: "National directories", hint: "Listed on at least one of EEQU, Playwaze, Pebble or Yellow Days — a switch sale", test: ({ d }: R) => d.srcs.some((v) => DIRECTORY.includes(v)) },
        ...tally((r) => r.d.srcs.filter((v) => DIRECTORY.includes(v))).map((v) => ({ value: `dir:${v}`, label: `${srcMeta(v).emoji} ${srcMeta(v).label}`, group: "National directories", test: ({ d }: R) => d.srcs.includes(v) })),
        { value: "multi", label: "🔗 On 2+ directories", group: "National directories", hint: "The same provider found on more than one directory — one lead", test: ({ d }: R) => d.srcs.filter((v) => DIRECTORY.includes(v)).length > 1 },
        { value: "noDir", label: "🚫 Not on any national directory", group: "National directories", hint: "Not on EEQU, Playwaze, Pebble or Yellow Days (may still use booking software or its own system — see below)", test: ({ d }: R) => !d.srcs.some((v) => DIRECTORY.includes(v)) },
        { value: "own", label: "🏠 Own booking system", group: "Booking software", hint: "Books through its own website, portal or app (e.g. family.premier-education.com) — hardest to switch", test: ({ d }: R) => /^own\b|own (site|portal|platform|booking|council)/i.test(d.system) },
        { value: "anySoftware", label: "🧾 Uses booking software (any)", group: "Booking software", hint: "A third-party booking or class-management system spotted on their website", test: ({ d }: R) => !!d.system && !/^own\b|own (site|portal|platform|booking|council)/i.test(d.system) && !/\(booking form\)/.test(d.system) },
        ...tally((r) => r.d.system && !/^own\b|own (site|portal|platform|booking|council)/i.test(r.d.system) ? [r.d.system] : []).slice(0, 40).map((v) => ({ value: `sys:${v}`, label: `🧾 ${v}`, group: "Booking software", test: ({ d }: R) => d.system === v })),
        { value: "hafList", label: "🍎 Council HAF list", group: "Also found on", hint: "Named on a council Holiday Activities & Food programme list", test: ({ d, l }: R) => d.srcs.includes("haf") || !!l.hafLocalAuthority },
      ],
    } as Record<Dim, Opt[]>;
  }, [rows]);
  const viewTest = VIEWS.find((v) => v.key === view)?.test ?? (() => true);
  const okTerm = ({ l }: R) => !term || [l.name, l.business, l.location, l.county, l.region, l.nation, l.email, l.phone, l.message, l.bookingSystem, l.website, l.websiteCandidate, l.sport, l.network].some((x) => (x ?? "").toLowerCase().includes(term));
  const DIMS = Object.keys(NO_FILTERS) as Dim[];
  /** Passes every filter except `skip` (so a dropdown's counts are "if you ticked this"). */
  const pass = (r: R, skip: Dim | "view" | null = null) => {
    if (skip !== "view" && !viewTest(r)) return false;
    for (const dim of DIMS) {
      if (dim === skip || !f[dim].length) continue;
      if (!opts[dim].some((o) => f[dim].includes(o.value) && o.test(r))) return false;
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
  const countWith = (skip: Dim | "view", test: (r: R) => boolean) => { let n = 0; for (const r of rows) if (test(r) && pass(r, skip)) n++; return n; };
  // One pass over the list for every view's count (not one pass per view).
  const viewCounts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(VIEWS.map((v) => [v.key, 0]));
    for (const r of rows) { if (!pass(r, "view")) continue; for (const v of VIEWS) if (v.test(r)) c[v.key]++; }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, f, term, opts]);
  const planTabs: [string, string][] = [["", "All plans"], ["company", "🏢 Companies"], ["freelancer", "🧑 Freelancers"]];
  const setDim = (dim: Dim, v: string[]) => { setF((cur) => ({ ...cur, [dim]: v })); setLimit(60); };
  const active = DIMS.filter((dim) => dim !== "plan").flatMap((dim) => f[dim].map((v) => ({ dim, v, label: opts[dim].find((o) => o.value === v)?.label ?? v })));
  const clearAll = () => { setF(NO_FILTERS); setQ(""); setLimit(60); };

  const exportCsv = () => {
    const head = ["Name", "Registered name", "Email", "OK to email (PECR)", "Phone", "Website", "Possible website (unconfirmed)", "Location", "Region", "Nation", "Runs", "Fit", "Size", "Franchise / group", "Booking", "Directories", "Status", "Listing link"];
    const lines = shown.map(({ l, d }) => [l.name, l.business, l.email, okToEmail(l) ? "yes" : l.email ? "needs consent" : "", l.phone, l.website, l.website ? "" : l.websiteCandidate, l.location, d.region, d.nation, d.types.map((t) => TYPE[t]?.label).join("; "), FIT[d.fit].label.replace(/^\S+ /, ""), SIZE[d.size].replace(/^\S+ /, ""), l.network ?? "", BOOKING[d.booking].label.replace(/^\S+ /, ""), d.srcs.map((s) => srcMeta(s).label).join("; "), TONE[l.status]?.label ?? l.status, l.sourceUrl ?? ""].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `leads-${view}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const best = rows.filter(VIEWS.find((v) => v.key === "best")!.test);
  const ready = rows.filter((r) => reachable(r.l)).length;

  return (
    <div>
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💬</span>Leads
        </div>
        <p className="mt-1 text-[12.5px] text-white/80">UK children&apos;s activity and childcare providers — from booking directories, Ofsted&apos;s register and website demo requests.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          {([["Providers", rows.length], ["📇 Ready to contact", ready], ["⭐ Best prospects", best.length], ["🔎 Still researching", rows.length - ready]] as const).map(([k, n]) => (
            <span key={k} className="rounded-xl bg-white/15 px-3 py-1.5"><b className="text-[15px]">{n.toLocaleString()}</b> <span className="text-white/85">{k}</span></span>
          ))}
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
        </div>
        {(["runs", "nation", "region", "ofsted", "size", "booking", "contact", "status"] as Dim[]).map((dim) => (
          <FilterMenu key={dim} dim={dim} opts={opts[dim]} value={f[dim]} onChange={(v) => setDim(dim, v)}
            countFor={(o) => countWith(dim, o.test)} />
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
          <button type="button" onClick={exportCsv} disabled={!shown.length} title="Download exactly these leads as a spreadsheet (CSV)"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-50">⬇ Export CSV</button>
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
                      {!l.email && !l.phone && <span className="text-[var(--ink-3)]" title="Research is still looking for their email / phone">🔎 contact details being researched</span>}
                      {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>🌐 {l.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗</a>}
                      {l.socialUrl && <a href={l.socialUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1d4ed8] hover:underline" title="Their social page — not counted as a website">{/instagram/i.test(l.socialUrl) ? "📸" : /linktr/i.test(l.socialUrl) ? "🔗" : "📘"} {l.socialUrl.replace(/^https?:\/\/(www\.|m\.|en-gb\.|business\.)?/, "").replace(/\/$/, "").slice(0, 40)} ↗</a>}
                      {!l.website && l.websiteCandidate && <a href={l.websiteCandidate} target="_blank" rel="noopener noreferrer" className="rounded-md border border-dashed border-[#d9a84e] px-1.5 font-semibold text-[#9a5a00] hover:underline" title={`Possible website — not confirmed as theirs: ${l.websiteCandidateWhy ?? ""}`}>🌐? {l.websiteCandidate.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} · possible, not confirmed ↗</a>}
                      {l.location && <span title={[l.county, l.region].filter(Boolean).join(", ") || undefined}>📍 {l.location}{l.region && !l.location.includes(l.region) && (l.ofstedRegions?.length ?? 0) <= 1 ? ` · ${l.region}` : ""}</span>}
                      {l.size && <span>👥 {l.size}</span>}
                      <span className="text-[var(--ink-3)]">{fmt(l.createdAt)}</span>
                    </div>
                    {(l.plan || l.kind || l.legalForm || l.companyNumber || l.charityNumber || l.bookingSystem || l.haf || l.sourceUrl || l.comingSoon || l.providerTypes?.length || l.network) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {l.plan && <span className="rounded-full px-2 py-0.5 font-extrabold" style={isFreelancer(l) ? { background: "#f3e8ff", color: "#6b21a8" } : { background: "#e0ecff", color: "#1d3a8f" }} title={l.planReason || undefined}>{isFreelancer(l) ? "🧑 Freelancer" : "🏢 Company"}</span>}
                        {l.legalForm && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">{l.legalForm}</span>}
                        {l.companyNumber && <a href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(l.companyNumber)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)] hover:underline">Co. {l.companyNumber} ↗</a>}
                        {l.charityNumber && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">Charity {l.charityNumber}</span>}
                        {l.bookingSystem && (l.bookingUrl
                          ? <a href={l.bookingUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-bold text-[#9a5a00] underline-offset-2 hover:underline" title={`The booking system their website sends parents to${l.bookingFrom ? ` · found by ${l.bookingFrom}` : ""} — opens where parents book`}>🧾 Books via {l.bookingSystem} ↗</a>
                          : <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-bold text-[#9a5a00]" title={`The booking system their website sends parents to${l.bookingFrom ? ` · found by ${l.bookingFrom}` : ""}`}>🧾 Books via {l.bookingSystem}</span>)}
                        {l.haf && (l.hafFrom
                          ? <a href={l.hafFrom} target="_blank" rel="noreferrer" className="rounded-full bg-[#e8f7ec] px-2 py-0.5 font-extrabold text-[#1c6b3a] underline-offset-2 hover:underline" title={`Their website mentions the Holiday Activities & Food programme${l.hafText ? ` ("${l.hafText}")` : ""}${l.hafLocalAuthority ? ` · listed by ${l.hafLocalAuthority}` : ""} — opens the page`}>🍎 HAF provider{l.hafLocalAuthority ? ` · ${l.hafLocalAuthority}` : ""}{l.hafPaid === true ? " · also sells paid places" : l.hafPaid === false ? " · free places only" : ""} ↗</a>
                          : <span className="rounded-full bg-[#e8f7ec] px-2 py-0.5 font-extrabold text-[#1c6b3a]" title="Listed as a Holiday Activities & Food programme provider">🍎 HAF provider{l.hafLocalAuthority ? ` · ${l.hafLocalAuthority}` : ""}{l.hafPaid === true ? " · also sells paid places" : l.hafPaid === false ? " · free places only" : ""}</span>)}
                        {l.listingsOnSource ? <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-bold text-[#1d3a8f]">{l.listingsOnSource} listing{l.listingsOnSource === 1 ? "" : "s"} on {srcMeta(l.source).label}</span> : null}
                        {(l.providerTypes ?? []).map((t) => TYPE[t] && <span key={t} className="rounded-full bg-[#eef9f0] px-2 py-0.5 font-bold text-[#0f6b3a]">{TYPE[t].emoji} {TYPE[t].label}</span>)}
                        {l.network && <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 font-extrabold text-[#6b21a8]" title={l.networkKind === "franchise" ? "A franchisee — the brand's head office is a Franchise-plan lead" : "Part of a group of separately registered companies"}>{l.networkKind === "franchise" ? `🌐 ${l.network} franchisee` : `🏛 ${l.network} group`}{l.networkOperators ? ` · 1 of ${l.networkOperators}` : ""}</span>}
                        {l.ofstedSites ? <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-bold text-[#1d3a8f]" title="Venues registered with Ofsted (Childcare Register)">🏫 {l.ofstedSites} Ofsted-registered site{l.ofstedSites === 1 ? "" : "s"}</span> : null}
                        {srcOf(l).includes("ofsted") && <span className="rounded-full bg-[#e9f7f6] px-2 py-0.5 font-bold text-[#0e7a75]" title="Ofsted-registered childcare can take Tax-Free Childcare payments — ActivityOS handles TFC">💷 Can take Tax-Free Childcare</span>}
                        {l.comingSoon && <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-extrabold text-[#9a5a00]" title="Their website is a 'coming soon' / under-construction page — a good sign they have no booking platform yet">🚧 Website coming soon — likely no booking platform</span>}

                        {l.confidence && l.confidence !== "high" && l.confidence !== "unverified" && <span className="rounded-full bg-[#fdf3d8] px-2 py-0.5 font-bold text-[#9a5a00]" title="How sure the research is that these details are this provider's">⚠ {l.confidence} confidence — check before contacting</span>}
                        {l.personalContact && l.kind !== "person" && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 font-bold text-[#b3123c]" title="UK PECR/GDPR: a named person's or personal mailbox — get their consent before sending marketing email">Personal contact — needs consent before marketing email</span>}
                        {l.kind === "person" && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 font-bold text-[#b3123c]" title="UK PECR: sole traders count as individuals — marketing email needs their consent first">Sole trader — needs consent before marketing email</span>}
                      </div>
                    )}
                    {l.message && <div className="mt-2 max-w-[80ch] rounded-lg bg-[var(--panel)] p-2.5" title={l.message}><p className="line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{l.message}</p></div>}
                  </div>
                  <div className="flex flex-none flex-wrap gap-1.5">
                    {STATUSES.filter((s) => s !== l.status).map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(l.id, s)}
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
