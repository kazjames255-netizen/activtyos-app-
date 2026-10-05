import { Router } from "express";
import { db } from "../firebase";
import { verify } from "../lib/signing";
import { unsubPayload } from "../lib/onboardingNudges";
import { BRAND } from "../lib/brand";

// One-click stop for the new-provider set-up emails. Public (an email client carries no login); the HMAC signature on the tenant id is
// what stops anyone switching someone else's emails off. Only ever turns the series OFF.
export const onboardingUnsub = Router();

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:12vh auto;padding:0 18px;color:#171534"><h2>${title}</h2><p>${body}</p></body>`;

onboardingUnsub.get("/:tenantId", async (req, res) => {
  const tenantId = String(req.params.tenantId ?? "");
  if (!tenantId || !verify(unsubPayload(tenantId), typeof req.query.sig === "string" ? req.query.sig : null)) {
    res.status(400).type("html").send(page("Link not valid", "This link could not be read. Reply to the email and we will switch it off for you."));
    return;
  }
  await db.collection("tenants").doc(tenantId).set({ onboardingEmailsOff: true }, { merge: true });
  res.type("html").send(page("You are unsubscribed", `We will not send you any more set-up emails from ${BRAND}. Emails about your bookings, payments and account are not affected.`));
});
