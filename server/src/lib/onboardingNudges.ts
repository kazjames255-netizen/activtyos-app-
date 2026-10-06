import { db } from "../firebase";
import { sign } from "./signing";
import { emailOnboardingNudge } from "./emails";
import { webUrl } from "./stripe";

// The new-provider email series: day 1, day 3 and day 5 after sign-up. THE RULE: every email is decided at send time from the
// provider's live facts (payChosen = bank details saved, the same rule as go-live), and is skipped if the thing it asks for is already done - nobody is reminded about something they have
// already finished. The whole series stops the moment a listing is live, a stage that does not apply is recorded as "skipped" so it
// is never reconsidered, and a provider can opt out for good with the unsubscribe link in every email.

import { decide, STAGE_DAY, STAGES, type Stage, type Facts, type OpenSteps } from "./onboardingRules";
export { decide, STAGE_DAY };
export type { Stage, Facts, OpenSteps };

export const unsubPayload = (tenantId: string) => `onbunsub:${tenantId}`;
export const unsubUrl = (tenantId: string) => `${(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "")}/api/public/onboarding-unsub/${encodeURIComponent(tenantId)}?sig=${sign(unsubPayload(tenantId))}`;

async function factsFor(tenantId: string, sub: { status?: string } | undefined): Promise<Facts> {
  const [any, live, lib] = await Promise.all([
    db.collection("listings").where("tenantId", "==", tenantId).limit(1).get(),
    db.collection("listings").where("tenantId", "==", tenantId).where("status", "==", "live").limit(1).get(),
    db.collection("libraries").doc(tenantId).get(),
  ]);
  const billing = ((lib.data()?.settings ?? {}) as { billing?: { sortCode?: string; accountNumber?: string } }).billing;
  const bank = !!(billing?.sortCode?.trim() && billing?.accountNumber?.trim());
  const status = sub?.status ?? "none";
  return { hasListing: !any.empty, hasLiveListing: !live.empty, planStarted: ["trialing", "active", "past_due", "canceling"].includes(status), payChosen: bank };
}

export async function onboardingNudges(): Promise<void> {
  const since = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const snap = await db.collection("tenants").where("createdAt", ">=", since).get();
  for (const t of snap.docs) {
    try {
      const d = t.data() as { type?: string; createdAt?: string; ownerUid?: string; name?: string; subscription?: { status?: string }; onboardingNudges?: Partial<Record<Stage, string>>; onboardingEmailsOff?: boolean };
      if ((d.type !== "company" && d.type !== "freelancer") || !d.createdAt || d.onboardingEmailsOff) continue;
      const age = (Date.now() - new Date(d.createdAt).getTime()) / 86_400_000;
      const sent = d.onboardingNudges ?? {};
      const due = STAGES.filter((s) => age >= STAGE_DAY[s] && !sent[s]);
      if (!due.length) continue;
      const stage = due[due.length - 1]; // if the server was down, send only the latest stage, never a burst
      const facts = await factsFor(t.id, d.subscription);
      const { send, open } = decide(stage, facts);
      const mark: Partial<Record<Stage, string>> = {};
      for (const s of due) mark[s] = s === stage && send ? new Date().toISOString() : "skipped";
      if (send && d.ownerUid) {
        const owner = (await db.collection("users").doc(d.ownerUid).get()).data() as { email?: string; name?: string } | undefined;
        if (owner?.email) {
          emailOnboardingNudge({ to: owner.email, tenantId: t.id, providerName: d.name ?? "", firstName: owner.name?.split(" ")[0], portal: d.type, stage, open, unsubUrl: unsubUrl(t.id) });
        }
      }
      await t.ref.set({ onboardingNudges: { ...sent, ...mark } }, { merge: true });
    } catch (e) {
      console.error(`[onboarding-nudges] ${t.id}:`, (e as Error).message);
    }
  }
}

export { webUrl };
