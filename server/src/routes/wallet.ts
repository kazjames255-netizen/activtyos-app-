// Operator-side view of customer store credit. The parent's own wallet lives
// on /api/my/wallet; this is the provider's liability side of the same ledger.

import { Router } from "express";
import { operatorScope } from "../middleware/role";
import { tenantWalletOutstanding } from "../lib/wallet";

export const wallet = Router();

// GET /api/wallet/summary — unspent credit this provider owes its families.
// Money the business has already taken but still has to deliver activities
// for, so it belongs on the dashboard next to unpaid bookings.
wallet.get("/summary", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope?.tenantId) return;
  res.json({ outstanding: await tenantWalletOutstanding(scope.tenantId) });
});
