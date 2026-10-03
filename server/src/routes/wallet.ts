// Operator-side view of customer store credit. The parent's own wallet lives
// on /api/my/wallet; this is the provider's liability side of the same ledger.

import { Router } from "express";
import { managerScope } from "../middleware/role";
import { tenantWalletOutstanding } from "../lib/wallet";
import { franchiseFamilyEmails, isFranchise } from "../lib/franchiseScope";

export const wallet = Router();

// GET /api/wallet/summary — unspent credit this provider owes its families.
// Money the business has already taken but still has to deliver activities
// for, so it belongs on the dashboard next to unpaid bookings.
wallet.get("/summary", async (req, res) => {
  // The wallet liability is the business's money position: managers and owners only (staff get 403).
  const scope = managerScope(req, res);
  if (!scope?.tenantId) return;
  // A franchise owes credit only to ITS OWN families - not the whole network's liability.
  const fam = isFranchise(req.auth!) ? await franchiseFamilyEmails(scope.tenantId, req.auth!.franchiseId!) : undefined;
  res.json({ outstanding: await tenantWalletOutstanding(scope.tenantId, fam) });
});
