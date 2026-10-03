// Pure core of server/tools/reconcile.ts: a booking's payment records vs the dashboard's collectedNet.
import { collectedNet } from "../../../features/bookings/helpers";

export interface ReconPay { type?: string; status?: string; amount?: number; refs?: string[] }
export function reconcileBooking(b: Record<string, any>, payments: ReconPay[]) {
  const mine = payments.filter((p) => (p.refs ?? []).includes(b.ref));
  const inn = mine.filter((p) => p.type !== "refund" && (p.status === "succeeded" || p.status === "recorded")).reduce((s, p) => s + (p.amount ?? 0), 0);
  const ref = mine.filter((p) => p.type === "refund" && (p.status === "succeeded" || p.status === "recorded" || p.status === "to-reimburse")).reduce((s, p) => s + (p.amount ?? 0), 0);
  const net = Math.round((inn - ref) * 100) / 100;
  const helper = collectedNet(b as never);
  return { inn, ref, net, helper, ok: Math.abs(net - helper) < 0.005 };
}
