// Verifies the test-tracker catalogue (lib/testTracker/catalogue.ts).
//   npx tsx scripts/testTracker/verifyCatalogue.ts --structure | --coverage | --selftest
// Coverage is DERIVED FROM THE CODE: this script reads the repo files, extracts the real option lists, and asserts every option
// is mentioned (case-insensitive substring of title/setup/steps/expected) by at least one check. The ALIASES map only says how an
// option is phrased in plain English; an option with no alias falls back to its raw code value, so a NEW option added to the code
// is reported as uncovered until a check (and, if needed, an alias) is added.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUE } from "../../lib/testTracker/catalogue";
import type { AccountKind, Area, TestCheck } from "../../lib/testTracker/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const AREAS: Area[] = ["listing-types", "passes-pricing", "discounts", "payments", "booking-main", "booking-quick", "booking-embed", "approval-waitlist", "cancellations", "amendments", "children-families", "registers-day", "messages-emails", "finance-dashboard", "add-ons"];
const KINDS: AccountKind[] = ["company", "freelancer", "franchise", "head-office", "staff", "parent", "platform"];
const PREFIX: Record<Area, string> = { "listing-types": "LT", "passes-pricing": "PP", discounts: "DI", payments: "PY", "booking-main": "BM", "booking-quick": "BQ", "booking-embed": "BE", "approval-waitlist": "AW", cancellations: "CN", amendments: "AM", "children-families": "CF", "registers-day": "RD", "messages-emails": "ME", "finance-dashboard": "FD", "add-ons": "AO" };

// ---------------------------------------------------------------- structure
function structure(list: TestCheck[]): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const c of list) {
    if (seen.has(c.id)) bad.push(`duplicate id ${c.id}`);
    seen.add(c.id);
    if (!/^[A-Z]{2}-\d{3}$/.test(c.id)) bad.push(`${c.id}: id format`);
    else if (PREFIX[c.area] !== c.id.slice(0, 2)) bad.push(`${c.id}: prefix does not match area ${c.area}`);
    for (const f of ["title", "setup", "moneyCheck", "claudeCheck"] as const) if (!String(c[f] ?? "").trim()) bad.push(`${c.id}: empty ${f}`);
    if (!c.accounts?.length) bad.push(`${c.id}: no accounts`);
    if (!c.steps?.length || c.steps.some((s) => !s.trim())) bad.push(`${c.id}: empty steps`);
    if (!c.expected?.length || c.expected.some((s) => !s.trim())) bad.push(`${c.id}: empty expected`);
    if (![1, 2, 3].includes(c.priority)) bad.push(`${c.id}: priority`);
  }
  if (list.length < 150) bad.push(`only ${list.length} checks (min 150)`);
  for (const a of AREAS) { const n = list.filter((c) => c.area === a).length; if (n < 8) bad.push(`area ${a} has ${n} checks (min 8)`); }
  for (const k of KINDS) if (k !== "platform") { const n = list.filter((c) => c.accounts.includes(k)).length; if (n < 10) bad.push(`account ${k} appears in only ${n} checks (min 10)`); }
  return bad;
}

// ---------------------------------------------------------------- extraction helpers
interface Opt { group: string; raw: string; source: string; kind?: AccountKind[]; }
const quoted = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const lineOf = (txt: string, idx: number) => txt.slice(0, idx).split("\n").length;
function fromUnion(file: string, re: RegExp, group: string, out: Opt[]) {
  const t = read(file); const m = re.exec(t);
  if (!m) { out.push({ group: "EXTRACTION-FAILED", raw: `${group} in ${file}`, source: file }); return; }
  for (const v of quoted(m[1])) out.push({ group, raw: v, source: `${file}:${lineOf(t, m.index)}` });
}
const zEnum = (file: string, field: string, group: string, out: Opt[]) => fromUnion(file, new RegExp(`${field}:\\s*z\\s*\\.enum\\(\\[([^\\]]*)\\]`), group, out);
function interfaceKeys(file: string, header: string, keep: string[] | null, group: string, out: Opt[], skip: string[] = []) {
  const t = read(file); const i = t.indexOf(header);
  if (i < 0) { out.push({ group: "EXTRACTION-FAILED", raw: `${header} in ${file}`, source: file }); return; }
  const end = t.indexOf("\n}", i); const body = t.slice(i, end);
  for (const m of body.matchAll(/^ {2}([A-Za-z0-9_]+)\??:/gm)) { if (skip.includes(m[1])) continue; if (keep && !keep.includes(m[1])) continue; out.push({ group, raw: m[1], source: `${file}:${lineOf(t, i + (m.index ?? 0))}` }); }
}
const englishI18n = (file: string, key: string): string => { const m = new RegExp(`\\b${key}:\\s*\\[?"([^"]+)"`).exec(read(file)); return m ? m[1].replace(/^[^A-Za-z</]+/, "").replace(/\s*[↗]\s*$/, "").trim() : `MISSING-${key}`; };

function extract(): Opt[] {
  const o: Opt[] = [];
  // payment methods
  fromUnion("lib/settings.ts", /payMethods:\s*\[("[^\]]*)\]/, "pay-method", o);
  { const t = read("features/listings/checkout.tsx"); const f = t.slice(t.indexOf("function parentMethodEntry"), t.indexOf("export function CheckoutPanel"));
    for (const m of f.matchAll(/\/([^/]+)\/i\.test\(m\)\)/g)) o.push({ group: "checkout-method", raw: m[1], source: "features/listings/checkout.tsx parentMethodEntry" }); }
  { const t = read("lib/settings.ts"); const m = /m !== "([^"]+)"/.exec(t); if (m) o.push({ group: "pay-method", raw: m[1], source: `lib/settings.ts:${lineOf(t, m.index)}` }); }
  // listing wizard / listings route
  zEnum("server/src/routes/listings.ts", "bookingType", "booking-type", o);
  zEnum("server/src/routes/listings.ts", "deliveryMode", "delivery-mode", o);
  zEnum("server/src/routes/listings.ts", "mode", "coverage-mode", o);
  zEnum("server/src/routes/listings.ts", "visibility", "visibility", o);
  zEnum("server/src/routes/listings.ts", "capacityScope", "capacity-scope", o);
  zEnum("server/src/routes/listings.ts", "blockMode", "block-mode", o);
  zEnum("server/src/routes/listings.ts", "waitlistMode", "waitlist-mode", o);
  zEnum("server/src/routes/listings.ts", "status", "listing-status", o);
  fromUnion("features/listings/ListingWizard.tsx", /export type BookRule =\s*([^;]+);/, "pass-book-rule", o);
  fromUnion("features/listings/FreelancerListingsApp.tsx", /type:\s*("perday"[^;]+);/, "addon-kind", o);
  { const t = read("features/listings/FreelancerListingsApp.tsx"); const m = /questions\?:\s*\{[^}]*type:\s*("text"[^;}]*)/.exec(read("server/src/routes/my.ts")); if (m) for (const v of quoted(m[1])) o.push({ group: "addon-question-type", raw: v, source: "server/src/routes/my.ts LibAddon" }); void t; }
  interfaceKeys("features/listings/ListingWizard.tsx", "export interface WizardDraft", ["maxAttendees", "showSpaces", "waitlist", "waitlistSize", "bookingCutoffHours", "opensAt", "ageCapsOn", "ageCaps", "minGapMinutes", "seasonId", "mealsEnabled", "payMethods", "cancellationPolicyId", "allowOutOfRange", "ageFrom", "ageTo", "sitePhone", "staffIds", "addonIds"], "listing-setting", o);
  { const wt = read("features/listings/ListingWizard.tsx"); const m = /interface TicketOverride \{([^}]*)\}/.exec(wt); if (m) for (const k of m[1].matchAll(/(\w+)\??:/g)) o.push({ group: "ticket-setting", raw: k[1], source: `features/listings/ListingWizard.tsx:${lineOf(wt, m.index ?? 0)}` }); }
  // discounts
  fromUnion("features/listings/discounts.ts", /export type DiscountKind =\s*([^;]+);/, "auto-discount-kind", o);
  fromUnion("features/listings/discounts.ts", /method:\s*("price"[^;]+);/, "auto-discount-method", o);
  fromUnion("server/src/lib/discountCodes.ts", /type:\s*("percent"[^;]+);/, "code-type", o);
  { const t = read("server/src/routes/discounts.ts"); const i = t.indexOf("const codeBase = z.object({"); const body = t.slice(i, t.indexOf("\n});", i));
    for (const m of body.matchAll(/^ {2}([A-Za-z]+):/gm)) o.push({ group: "code-setting", raw: m[1], source: `server/src/routes/discounts.ts:${lineOf(t, i + (m.index ?? 0))}` }); }
  interfaceKeys("server/src/lib/discountCodes.ts", "export interface DiscountCodeDoc", ["referral", "newCustomerOnly", "maxOff", "membership", "franchiseId", "assignedEmails"], "code-flag", o);
  fromUnion("server/src/routes/memberships.ts", /benefitType:\s*("credit"[^;]+);/, "membership-benefit", o);
  { const t = read("server/src/routes/referral.ts"); const m = /referral\?:\s*\{\s*enabled\?:\s*boolean;\s*type\?:\s*("amount"[^;]+);/.exec(t); if (m) for (const v of quoted(m[1])) o.push({ group: "referral-type", raw: v, source: "server/src/routes/referral.ts" });
    for (const k of ["friendOff", "referrerReward", "capToFriendSpend"]) if (t.includes(k)) o.push({ group: "referral-setting", raw: k, source: "server/src/routes/referral.ts" }); }
  // cancellation / refunds
  { const t = read("lib/cancellation.ts"); const i = t.indexOf("export const DEFAULT_POLICIES"); const body = t.slice(i, t.indexOf("];", i)); for (const m of body.matchAll(/name:\s*"([^"]+)"/g)) o.push({ group: "cancellation-policy", raw: m[1], source: "lib/cancellation.ts DEFAULT_POLICIES" }); }
  { const t = read("features/bookings/types.ts"); fromUnion("features/bookings/types.ts", /export type BookingStatus =\s*([^;]+);/, "booking-status", o); fromUnion("features/bookings/types.ts", /export type PayStatus =\s*([^;]+?)\s*\|\s*string;/, "pay-status", o);
    fromUnion("features/bookings/types.ts", /export type RefundKind =\s*([^;]+);/, "refund-state", o); fromUnion("features/bookings/types.ts", /refundTo\?:\s*("card"[^;]+);/, "refund-destination", o); fromUnion("features/bookings/types.ts", /refundVia\?:\s*("wallet"[^;]+);/, "refund-paid-via", o); void t; }
  { const t = read("server/src/routes/my.ts"); const m = /"(Awaiting voucher payment)"/.exec(t); if (m) o.push({ group: "pay-status", raw: m[1], source: `server/src/routes/my.ts:${lineOf(t, m.index)}` });
    const r = /resolution:\s*z\.enum\(\[([^\]]*)\]/.exec(t); if (r) for (const v of quoted(r[1])) o.push({ group: "released-day-choice", raw: v, source: "server/src/routes/my.ts cancelSchema.resolution" }); }
  { const t = read("lib/settings.ts"); const seen = new Set<string>(); for (const m of t.matchAll(/^ {2}((?:amend|partialAllow)\w+|allowDateChanges|allowCardRefund|refundLetCustomerChoose|noRefundCredit|allowPartialCancel):/gm)) if (!seen.has(m[1])) { seen.add(m[1]); o.push({ group: "amend-refund-setting", raw: m[1], source: `lib/settings.ts:${lineOf(t, m.index ?? 0)}` }); }
    const i = t.indexOf("export const DEFAULT_CANCEL_REASONS"); const body = t.slice(i, t.indexOf("];", i)); for (const m of body.matchAll(/label:\s*"([^"]+)"/g)) o.push({ group: "cancel-reason", raw: m[1], source: "lib/settings.ts DEFAULT_CANCEL_REASONS" });
    // child questions
    fromUnion("lib/settings.ts", /export type QuestionType =\s*([^;]+);/, "child-question-type", o);
    interfaceKeys("lib/settings.ts", "export interface ChildQuestion", ["ask", "required", "showOnRegister", "scope", "minAge", "maxAge", "hidden", "reviewIfNo", "kind", "maxLength", "help", "replaces", "options"], "child-question-setting", o);
    const a = /ask\?:\s*("once"[^;]+);/.exec(t); if (a) for (const v of quoted(a[1])) o.push({ group: "child-question-ask", raw: v, source: "lib/settings.ts ChildQuestion.ask" }); }
  { const t = read("features/setup/SetupApp.tsx"); const m = /set\("(requireDob)"/.exec(t); if (m) o.push({ group: "age-rule", raw: m[1], source: `features/setup/SetupApp.tsx:${lineOf(t, m.index)}` }); }
  { const t = read("lib/tfc.ts"); const i = t.indexOf("export type TfcFailure"); const body = t.slice(i, t.indexOf(";", i)); for (const v of quoted(body)) o.push({ group: "tfc-failure", raw: v, source: "lib/tfc.ts TfcFailure" }); }
  // booking actions / routes
  { const t = read("server/src/routes/bookings.ts"); const i = t.indexOf("const actionSchema"); const body = t.slice(i, t.indexOf("const createSchema"));
    for (const v of new Set([...quoted(body.slice(0, body.indexOf("]"))), ...[...body.matchAll(/z\.literal\("([^"]+)"\)/g)].map((m) => m[1])])) o.push({ group: "booking-action", raw: v, source: "server/src/routes/bookings.ts actionSchema" });
    for (const m of t.matchAll(/^bookings\.(?:post|put)\("\/(:ref\/[a-z-]+|bulk)"/gm)) if (!["actions", ":ref/actions"].includes(m[1])) o.push({ group: "operator-booking-route", raw: m[1], source: `server/src/routes/bookings.ts:${lineOf(t, m.index ?? 0)}` });
    const c = t.indexOf("const createSchema"); if (c > 0) o.push({ group: "booking-source", raw: "POST /api/bookings (createSchema)", source: `server/src/routes/bookings.ts:${lineOf(t, c)}` }); }
  { const t = read("server/src/routes/my.ts"); for (const m of t.matchAll(/^my\.(get|post|put|delete)\("(\/(?:bookings[^"]*|wallet|coupons|children[^"]*|trips[^"]*|providers\/follow|meal-days|attendance))"/gm)) o.push({ group: "parent-route", raw: `${m[1].toUpperCase()} ${m[2]}`, source: `server/src/routes/my.ts:${lineOf(t, m.index ?? 0)}` });
    if (/onBehalfOf:/.test(t)) o.push({ group: "booking-source", raw: "onBehalfOf (provider books for a family)", source: "server/src/routes/my.ts basketSchema" }); }
  { const t = read("lib/i18n/messages/areas/p7bkl.ts"); for (const m of t.matchAll(/\btab_(\w+):/g)) o.push({ group: "bookings-tab", raw: m[1], source: "lib/i18n/messages/areas/p7bkl.ts" }); }
  // entry points
  for (const [f, name] of [["app/book/[id]/page.tsx", "/book/[id] parent booking page"], ["app/store/[tenantId]/page.tsx", "/store/[tenantId] provider storefront"]] as const) if (existsSync(resolve(ROOT, f))) o.push({ group: "booking-source", raw: name, source: f });
  { const t = read("public/embed.js"); const seen = new Set<string>(); for (const m of t.matchAll(/data-([a-z-]+)/g)) if (!seen.has(m[1])) { seen.add(m[1]); o.push({ group: "embed-option", raw: `data-${m[1]}`, source: "public/embed.js" }); }
    if (/"inline"/.test(t)) o.push({ group: "embed-option", raw: "inline mode", source: "public/embed.js" }); }
  o.push({ group: "booking-source", raw: englishI18n("lib/i18n/messages/areas/p8lst-parts/lst.ts", "flBookForCustomer"), source: "lst.flBookForCustomer (listing card)" });
  o.push({ group: "booking-source", raw: englishI18n("lib/i18n/messages/areas/p7bkl.ts", "takeBooking"), source: "p7bkl.takeBooking (Bookings list)" });
  o.push({ group: "booking-source", raw: englishI18n("lib/i18n/messages/areas/parent.ts", "quickBook"), source: "parent.quickBook (Browse activities)" });
  for (const k of ["flQr", "flViewAsParent", "flEmbedBtn", "flLink", "flCopyLink"]) o.push({ group: "share-entry", raw: englishI18n("lib/i18n/messages/areas/p8lst-parts/lst.ts", k), source: `lst.${k}` });
  // accounts
  { const t = read("lib/nav/config.ts"); const m = /export type PortalKey =\s*([^;]+);/.exec(t); if (m) for (const v of quoted(m[1])) o.push({ group: "portal", raw: v, source: "lib/nav/config.ts PortalKey", kind: [v === "custdash" ? "parent" : (v as AccountKind)] }); }
  { const t = read("server/src/middleware/role.ts"); const m = /export type Role =\s*([^;]+);/.exec(t); if (m) for (const v of quoted(m[1])) o.push({ group: "role", raw: v, source: "server/src/middleware/role.ts Role", kind: [v as AccountKind] }); }
  o.push({ group: "account-type", raw: "head-office (company that owns franchises)", source: "server/src/routes/splitfees.ts + franchises routes", kind: ["head-office"] });
  return o;
}

// ---------------------------------------------------------------- phrasing + exclusions
// key = "group:raw"; value = acceptable plain-English phrasings (lower-case substring match). Unlisted options fall back to the raw value.
const ALIASES: Record<string, string[]> = {
  "pay-method:Card": ["pay by card"], "pay-method:Bank transfer": ["bank transfer"], "pay-method:Cash on the day": ["cash on the day"], "pay-method:Tax-Free Childcare": ["tax-free childcare"],
  "pay-method:Childcare vouchers": ["childcare vouchers"], "pay-method:HAF (funded £0)": ["haf (funded £0)"],
  "checkout-method:card": ["pay by card"], "checkout-method:bank|transfer": ["bank transfer"], "checkout-method:cash": ["cash on the day"], "checkout-method:tax.?free|tfc": ["tax-free childcare"],
  "checkout-method:haf|funded": ["haf"], "checkout-method:voucher": ["childcare vouchers"],
  "booking-type:auto": ["automatic approval"], "booking-type:manual": ["manual approval"],
  "delivery-mode:venue": ["at a venue"], "delivery-mode:home-visit": ["home visits"], "delivery-mode:both": ["'both'"],
  "coverage-mode:postcodePrefixes": ["postcode list"], "coverage-mode:radius": ["radius from base"],
  "visibility:public": ["who can see it = public"], "visibility:hidden": ["hidden link"],
  "capacity-scope:day": ["per day"], "capacity-scope:listing": ["whole listing"],
  "block-mode:weekly": ["weekly (mon"], "block-mode:custom": ["custom days"],
  "waitlist-mode:manual": ["'you choose'"], "waitlist-mode:auto": ["first in the queue"],
  "listing-status:draft": ["save draft"], "listing-status:live": ["publish"],
  "pass-book-rule:week": ["any n days in a week"], "pass-book-rule:listing": ["any n days, any week"], "pass-book-rule:blocks": ["whole n-day block"],
  "addon-kind:perday": ["per-day add-on"], "addon-kind:once": ["one-off add-on"],
  "addon-question-type:text": ["type an answer"], "addon-question-type:choice": ["pick one"],
  "listing-setting:maxAttendees": ["maximum attendees"], "listing-setting:showSpaces": ["remaining spaces"], "listing-setting:waitlist": ["waiting list on"], "listing-setting:waitlistSize": ["max people waiting"],
  "listing-setting:bookingCutoffHours": ["stop taking bookings"], "listing-setting:opensAt": ["bookings open at"], "listing-setting:ageCapsOn": ["limit places by age group"], "listing-setting:ageCaps": ["group's daily cap"],
  "listing-setting:minGapMinutes": ["minimum gap between sessions"], "listing-setting:seasonId": ["choose the season"], "listing-setting:mealsEnabled": ["meals available"], "listing-setting:payMethods": ["how can parents pay"],
  "listing-setting:cancellationPolicyId": ["cancellation policy ="], "listing-setting:allowOutOfRange": ["outside this age range"], "listing-setting:ageFrom": ["listing aged 5 to 11"], "listing-setting:ageTo": ["listing aged 5 to 11"],
  "listing-setting:sitePhone": ["on-the-day contact"], "listing-setting:staffIds": ["staff onsite"], "listing-setting:addonIds": ["tick it for the listing"],
  "ticket-setting:ageFrom": ["different ticket age ranges"], "ticket-setting:ageTo": ["different ticket age ranges"], "ticket-setting:capacity": ["capacity / day"], "ticket-setting:hidden": ["click hide"],
  "auto-discount-kind:person": ["multi-person"], "auto-discount-kind:session": ["multi-session"], "auto-discount-kind:early": ["early bird"],
  "auto-discount-method:price": ["a discounted price"], "auto-discount-method:subtract": ["subtract an amount"], "auto-discount-method:percent": ["by a percentage"],
  "code-type:percent": ["percent discount code"], "code-type:amount": ["a discount per booking"], "code-type:perAttendee": ["a discount per attendee"],
  "code-setting:minSpend": ["min spend"], "code-setting:expiry": ["code expiry"], "code-setting:usageLimit": ["usage limit"], "code-setting:listingId": ["code limited to one listing"], "code-setting:perCustomerLimit": ["one use per customer"],
  "code-setting:exclusive": ["can't be used with any other code"], "code-setting:assignedTo": ["reserved for one family"], "code-setting:assignedGroupId": ["reserved for a group"],
  "code-flag:referral": ["refer a friend"], "code-flag:newCustomerOnly": ["new customers only"], "code-flag:maxOff": ["cap to friend spend"], "code-flag:membership": ["membership"], "code-flag:franchiseId": ["franchise code only works"], "code-flag:assignedEmails": ["reserved for a group"],
  "membership-benefit:credit": ["monthly wallet credit"], "membership-benefit:percent": ["monthly percentage perk"],
  "referral-type:amount": ["refer a friend: friend's discount code"], "referral-type:percent": ["referral percent type"],
  "referral-setting:friendOff": ["friend gets"], "referral-setting:referrerReward": ["referrer earns"], "referral-setting:capToFriendSpend": ["cap to friend spend"],
  "cancellation-policy:No refunds": ["no refunds"],
  "booking-status:Approval needed": ["approval needed"],
  "refund-state:full": ["full refund"], "refund-state:partial": ["partial refund"], "refund-state:none": ["no refund"], "refund-state:approved": ["approves a card refund"], "refund-state:declined": ["declines a refund request"], "refund-state:pending": ["pending refund"],
  "refund-destination:card": ["refund to card"], "refund-destination:wallet": ["refund to wallet"],
  "refund-paid-via:wallet": ["refund to wallet"], "refund-paid-via:card": ["refund goes back through stripe"], "refund-paid-via:offline": ["reimburse"],
  "released-day-choice:refund": ["single days for a refund"], "released-day-choice:wallet": ["release days to wallet"],
  "amend-refund-setting:allowDateChanges": ["offer date changes at all"], "amend-refund-setting:amendSelfService": ["move their own dates"], "amend-refund-setting:amendNoticeHours": ["notice 48h"], "amend-refund-setting:amendLimit": ["most moves"],
  "amend-refund-setting:amendFee": ["admin fee"], "amend-refund-setting:amendAllowCheaper": ["cheaper"], "amend-refund-setting:allowCardRefund": ["go back to the card"], "amend-refund-setting:refundLetCustomerChoose": ["card or credit"],
  "amend-refund-setting:noRefundCredit": ["credit note"], "amend-refund-setting:allowPartialCancel": ["cancel single days"], "amend-refund-setting:partialAllowRefund": ["single days for a refund"], "amend-refund-setting:partialAllowWallet": ["release days to wallet"], "amend-refund-setting:partialAllowChangeDate": ["request to move"],
  "child-question-type:text": ["type text"], "child-question-type:choice": ["choice question"], "child-question-type:yesno": ["yes/no question"],
  "child-question-ask:once": ["ask once"], "child-question-ask:every": ["every booking"],
  "child-question-setting:ask": ["ask once"], "child-question-setting:required": ["required"], "child-question-setting:showOnRegister": ["show on register"], "child-question-setting:scope": ["one listing only"],
  "child-question-setting:minAge": ["min age"], "child-question-setting:maxAge": ["max age"], "child-question-setting:hidden": ["click hide"], "child-question-setting:reviewIfNo": ["holds the booking if answered no"], "child-question-setting:kind": ["nappy badge"],
  "age-rule:requireDob": ["date of birth required"],
  "tfc-failure:not-connected": ["isn't connected"], "tfc-failure:insufficient-funds": ["not enough in your hmrc"], "tfc-failure:provider-not-added": ["provider not added"], "tfc-failure:connection-failed": ["hmrc connection failed"], "tfc-failure:connection-expired": ["connection expired"],
  "booking-action:approve": ["click approve"], "booking-action:decline": ["decline booking"], "booking-action:paid": ["mark paid"], "booking-action:recon": ["mark transfer received"], "booking-action:promote": ["promote now"], "booking-action:offer": ["offer place"],
  "booking-action:refund-approve": ["approve refund"], "booking-action:refund-decline": ["decline refund"], "booking-action:resend": ["resend invoice"], "booking-action:move-approve": ["approve & move date"], "booking-action:move-deny": ["deny with a reason"],
  "booking-action:cancel": ["cancel booking"], "booking-action:cancel-child": ["cancel all n days"], "booking-action:cancel-day": ["cancel this day"], "booking-action:change-day": ["move beside a day"], "booking-action:note": ["private note"],
  "operator-booking-route:bulk": ["in bulk"], "operator-booking-route::ref/record-payment": ["record a partial payment"], "operator-booking-route::ref/reconcile": ["reconciliation"], "operator-booking-route::ref/nudge": ["nudge"],
  "operator-booking-route::ref/recon-notes": ["reconciliation note"], "operator-booking-route::ref/voucher-scheme": ["change the voucher scheme"], "operator-booking-route::ref/payment-ref": ["correct one payment reference"],
  "parent-route:GET /bookings": ["my bookings"], "parent-route:POST /bookings": ["confirm & pay"], "parent-route:POST /bookings/:ref/amend": ["change dates"], "parent-route:POST /bookings/:ref/amend/withdraw": ["cancel date change"],
  "parent-route:POST /bookings/:ref/accept-offer": ["accept the place"], "parent-route:POST /bookings/:ref/decline-offer": ["decline the offer"], "parent-route:POST /bookings/:ref/cancel": ["cancel booking…"],
  "parent-route:GET /wallet": ["wallet"], "parent-route:GET /coupons": ["coupons & discount codes"], "parent-route:GET /children": ["child profile"], "parent-route:POST /children": ["add child"], "parent-route:PUT /children/:id": ["edit the child's details"], "parent-route:DELETE /children/:id": ["delete a child"],
  "parent-route:GET /trips": ["trips & consent"], "parent-route:POST /trips/:id/consent": ["consent in one tap"], "parent-route:GET /meal-days": ["meals step"], "parent-route:GET /attendance": ["attendance"],
  "bookings-tab:approval": ["booking approvals"], "bookings-tab:unpaid": ["unpaid / invoiced"], "bookings-tab:unreconciled": ["unreconciled"], "bookings-tab:all": ["bookings > all"],
  "booking-source:/book/[id] parent booking page": ["/book/"], "booking-source:/store/[tenantId] provider storefront": ["/store/"], "booking-source:Book for a customer": ["book for a customer"], "booking-source:Take a booking": ["take a booking"],
  "booking-source:Quick book": ["quick book"], "booking-source:onBehalfOf (provider books for a family)": ["book for a customer"],
  "embed-option:data-listing": ["data-listing"], "embed-option:data-activityos-book": ["data-activityos-book"], "embed-option:data-store": ["data-store"], "embed-option:data-activityos-store": ["data-activityos-store"],
  "embed-option:data-mode": ["data-mode"], "embed-option:data-label": ["data-label"], "embed-option:data-color": ["data-color"], "embed-option:inline mode": ["inline mode"],
  "share-entry:QR": ["qr code"], "share-entry:View as parent": ["view as parent"], "share-entry:</> Embed": ["embed"], "share-entry:Link": ["🔗 link"], "share-entry:Copy link": ["copy the booking link"],
};

// Options that exist in the code but are dead/internal/out of scope. The lead should review this list.
const EXCLUDED: Record<string, string> = {
  "pay-method:Free place": "Removed from every tenant's list by lib/settings.ts (legacy label); not offered to anyone.",
  "addon-kind:bundle": "Retired: priced and behaves exactly like 'once' (comment in FreelancerListingsApp.tsx); the wizard no longer offers it.",
  "booking-source:POST /api/bookings (createSchema)": "Legacy operator-create endpoint; no UI calls it (grep finds no apiPost to /api/bookings). Provider bookings use onBehalfOf on /api/my/bookings (covered by BQ checks).",
  "code-setting:code": "The code text itself, not an option.", "code-setting:type": "Covered by the code-type group.", "code-setting:value": "The amount, not an option.", "code-setting:assignedName": "Display name stored beside assignedTo.",
  "code-setting:active": "Switched by editing/deleting a code; no separate control beyond expiry and usage limit.",
  "child-question-setting:maxLength": "Text length limit; cosmetic input limit.", "child-question-setting:help": "Help text under a field; cosmetic.", "child-question-setting:replaces": "Migration documentation only (comment says NOT a storage key).", "child-question-setting:options": "Covered by the choice question type.",
  "listing-setting:sitePhone": "Display-only contact number shown while a camp runs.", "listing-setting:staffIds": "Display-only: which staff bios parents see.",
  "ticket-setting:capacity": "", // placeholder removed below
  "parent-route:POST /providers/follow": "Following a provider; not a booking scenario.",
  "embed-option:data-activityos-mounted": "Internal marker the script sets on a mount element so it is never mounted twice.",
  "bookings-tab:all": "The unfiltered list; covered implicitly by every booking check.",
  "portal:platform": "", "role:platform": "",
};
delete EXCLUDED["ticket-setting:capacity"]; delete EXCLUDED["portal:platform"]; delete EXCLUDED["role:platform"];

const textOf = (c: TestCheck) => [c.title, c.setup ?? "", ...c.steps, ...c.expected].join(" \n ").toLowerCase();
const keyOf = (o: Opt) => `${o.group}:${o.raw}`;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[‘’]/g, "'");

export function coverage(list: TestCheck[]): { total: number; missing: string[]; used: number; bySource: Map<string, number> } {
  const opts = extract();
  const missing: string[] = []; let total = 0; const bySource = new Map<string, number>();
  const texts = list.map((c) => ({ c, t: norm(textOf(c)) }));
  for (const o of opts) {
    if (o.group === "EXTRACTION-FAILED") { missing.push(`EXTRACTION FAILED: ${o.raw}`); continue; }
    const key = keyOf(o);
    if (key in EXCLUDED) continue;
    total++;
    bySource.set(o.source.split(":")[0], (bySource.get(o.source.split(":")[0]) ?? 0) + 1);
    let ok: boolean;
    if (o.kind) ok = list.some((c) => c.accounts.some((a) => o.kind!.includes(a)));
    else { const phrases = (ALIASES[key] ?? [o.raw]).map(norm); ok = texts.some(({ t }) => phrases.some((p) => t.includes(p))); }
    if (!ok) missing.push(`[${o.group}] ${o.raw}   (from ${o.source}; looked for: ${(ALIASES[key] ?? [o.raw]).join(" | ")})`);
  }
  return { total, missing, used: opts.length, bySource };
}

// ---------------------------------------------------------------- selftest
function selftest(): string[] {
  const opts = extract().filter((o) => o.group === "pay-method" && !(keyOf(o) in EXCLUDED));
  if (!opts.length) return ["selftest: no pay-method options extracted"];
  // Pick the option covered by the FEWEST checks (>=1), remove those checks, and expect coverage to report it.
  let best: { o: Opt; hits: TestCheck[] } | null = null;
  for (const o of opts) {
    const phrases = (ALIASES[keyOf(o)] ?? [o.raw]).map(norm);
    const hits = CATALOGUE.filter((c) => phrases.some((p) => norm(textOf(c)).includes(p)));
    if (hits.length && (!best || hits.length < best.hits.length)) best = { o, hits };
  }
  if (!best) return ["selftest: no covered option to remove"];
  const dropped = new Set(best.hits.map((c) => c.id));
  const res = coverage(CATALOGUE.filter((c) => !dropped.has(c.id)));
  if (!res.missing.some((m) => m.includes(`[${best!.o.group}] ${best!.o.raw}`))) return [`selftest: removing ${[...dropped].join(",")} did not report "${best.o.raw}" as missing`];
  const base = coverage(CATALOGUE);
  if (base.missing.some((m) => m.includes(`[${best!.o.group}] ${best!.o.raw}`))) return [`selftest: "${best.o.raw}" was already missing before removal`];
  return [];
}

// ---------------------------------------------------------------- main
const mode = process.argv[2];
const fail = (problems: string[]) => { console.error(problems.join("\n")); console.error(`\n${problems.length} problem(s)`); process.exit(1); };
if (mode === "--structure") {
  const bad = structure(CATALOGUE); if (bad.length) fail(bad);
  console.log(`catalogue structure ok: ${CATALOGUE.length} checks, ${new Set(CATALOGUE.map((c) => c.area)).size} areas`);
} else if (mode === "--coverage") {
  const r = coverage(CATALOGUE); if (r.missing.length) fail(r.missing);
  console.log(`coverage ok: ${r.total} code options all covered`);
  if (process.argv.includes("--sources")) for (const [s, n] of [...bySourceSorted(r.bySource)]) console.log(`  ${n}  ${s}`);
} else if (mode === "--selftest") {
  const bad = selftest(); if (bad.length) fail(bad);
  console.log("selftest ok: removed check was reported");
} else { console.error("usage: verifyCatalogue.ts --structure | --coverage | --selftest"); process.exit(2); }
function bySourceSorted(m: Map<string, number>) { return [...m].sort((a, b) => b[1] - a[1]); }
