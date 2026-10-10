// What a PARENT gets of a provider-side record: allow-lists, never the stored document. One definition each, used by BOTH the
// parent's own screens (routes/incidents.ts, medications.ts, moments.ts) and the GDPR download (routes/privacy.ts), so the export can
// never show more than the screen does. Add a field here deliberately; a new field on the stored record stays out by default.

type Rec = Record<string, unknown>;
const pick = (x: Rec, keys: readonly string[]): Rec => {
  const out: Rec = {};
  for (const k of keys) if (x[k] !== undefined) out[k] = x[k];
  return out;
};

/** An accident / incident / safeguarding record (S19). Accidents and shared behaviour notes carry the injury / treatment lines the
 *  family screen shows. A shared safeguarding concern or concern about staff carries only the text the provider chose to share
 *  (description, follow-up) - never who recorded it, the DSL log or outcome, the child's own words, who it was reported to,
 *  external references, the local authority, categories or attachments. */
const PARENT_COMMON = ["id", "kind", "tenantId", "childId", "childName", "date", "time", "description", "followUp", "createdAt", "updatedAt", "acknowledgedAt", "acknowledgedBy"] as const;
const PARENT_CARE = ["location", "injury", "treatment", "firstAider", "severity", "incidentType", "actionTaken", "parentNotified", "parentNotifiedAt", "photoUrl", "attachments"] as const;
export function parentIncidentView(x: Rec): Rec {
  const restricted = x.kind === "safeguarding" || x.subject === "staff";
  const out = pick(x, restricted ? PARENT_COMMON : [...PARENT_COMMON, ...PARENT_CARE]);
  if (Array.isArray(x.notes)) out.notes = x.notes.map((n: Rec) => ({ id: n.id, by: n.by, role: n.role, text: n.text, at: n.at }));
  if (x.requireAck !== undefined) out.requireAck = x.requireAck;
  return out;
}

/** An authorised medication: the medicine, dose, schedule, the consent (who/when) and the family's own note. Not who on the team
 *  recorded it, the consent audit trail (team emails), the franchise, or the provider's free-text notes / instructions (a note or
 *  instruction typed by the PARENT through their own authorise form is theirs and stays). */
const MED_FIELDS = ["id", "tenantId", "childId", "childName", "name", "dose", "route", "condition", "schedule", "asNeeded", "storage", "heldOnSite", "startDate", "endDate", "expiryDate", "consentGranted", "consentBy", "consentDate", "consentWithdrawnAt", "archived", "source", "parentNote", "parentNoteAt", "createdAt"] as const;
export function parentMedicationView(x: Rec): Rec {
  const out = pick(x, MED_FIELDS);
  if (x.source === "parent") Object.assign(out, pick(x, ["notes", "instructions"]));
  return out;
}

/** One dose on the MAR: what, when, how much, the outcome and by whom (a name, never a sign-in email). */
const DOSE_FIELDS = ["id", "tenantId", "medicationId", "medName", "childId", "childName", "date", "time", "doseGiven", "given", "administeredByName", "notes", "createdAt"] as const;
export function parentDoseView(x: Rec): Rec {
  return pick(x, DOSE_FIELDS);
}

/** A moment, as one family sees it: who shared it by NAME (never the staff sign-in email), only THEIR OWN child's name/id (a group
 *  shot tags other families' children), and the team's comments plus their own - never another family's reply. */
export function parentMomentView(m: Rec, myChildIds: readonly string[], myUid: string): Rec {
  const { postedBy: _pb, franchiseId: _fr, ...rest } = m as Rec & { postedBy?: unknown; franchiseId?: unknown };
  const nm = typeof rest.postedByName === "string" ? rest.postedByName : "";
  const tagged = Array.isArray(rest.childIds) ? (rest.childIds as string[]) : [];
  const names = Array.isArray(rest.childNames) ? (rest.childNames as string[]) : [];
  const mineIdx = tagged.map((id, i) => (myChildIds.includes(id) ? i : -1)).filter((i) => i >= 0);
  const comments = (Array.isArray(rest.comments) ? (rest.comments as { role?: string; by?: string }[]) : []).filter((c) => c.role !== "parent" || c.by === myUid);
  return { ...rest, postedByName: nm.includes("@") ? "The team" : nm, childIds: mineIdx.map((i) => tagged[i]), childNames: mineIdx.map((i) => names[i] ?? ""), comments };
}

/** The provider's record of a family (their customer entry), as the family may have it: contact details, their children and the
 *  marketing consent. The provider's own `notes` ("never shown to the family") and anything else the provider keeps stay out. */
const CUSTOMER_FIELDS = ["id", "tenantId", "name", "firstName", "lastName", "email", "phone", "postcode", "locationName", "children", "marketingOptIn", "marketingOptInAt", "marketingSource"] as const;
export function parentCustomerView(x: Rec): Rec {
  const out = pick(x, CUSTOMER_FIELDS);
  // The thin child list the provider keeps: a name, an age / date of birth and the link to the child's record, nothing the provider added.
  if (Array.isArray(x.children)) out.children = x.children.map((k) => pick((k ?? {}) as Rec, ["name", "age", "dob", "childId"]));
  return out;
}

/** A payment row as the family sees it: what, how much, when, how and its state against the booking ref(s). Not the Stripe intent,
 *  the provider's connected account, refund ids, the Stripe error text, the provider's free-text note or who on the team recorded it. */
const PAYMENT_FIELDS = ["id", "tenantId", "refs", "invoiceId", "mealOrderIds", "email", "type", "kind", "amount", "currency", "method", "via", "offline", "status", "createdAt", "paidAt"] as const;
export function parentPaymentView(x: Rec): Rec {
  return pick(x, PAYMENT_FIELDS);
}
