import { DEFAULT_POLICIES, refundFor, noRefundCreditAmount, accumulatePendingRelease, type RefundBand } from "../../lib/cancellation";
const CUSTOM = { id: "custom", name: "Custom", bands: [{ hoursBefore: 336, refundPercent: 100 }, { hoursBefore: 168, refundPercent: 50 }, { hoursBefore: 48, refundPercent: 25 }, { hoursBefore: 0, refundPercent: 0 }] as RefundBand[] };
const POL = [...DEFAULT_POLICIES, CUSTOM];
const oracle = (bands: RefundBand[], hours: number, paid: number) => {
  const b = [...bands].sort((x, y) => y.hoursBefore - x.hoursBefore).find((x) => hours >= x.hoursBefore);
  const pct = b?.refundPercent ?? 0;
  return { pct, amount: Math.round(Math.round(paid * 100) * pct / 100) / 100 };
};
// Session date D (00:00 UTC); `now` = D - h hours (+30 min so that floor() sees exactly h whole hours).
const HOURS = [700, 337, 336, 335, 200, 169, 168, 167, 100, 72, 49, 48, 47, 26, 25, 24, 23, 12, 1, 0, -1, -30];
const PAIDS = [54, 18, 37.55, 0.01, 1, 99.99];
let bad = 0, n = 0; const rows: string[] = [];
for (const p of POL) for (const h of HOURS) for (const paid of PAIDS) {
  const D = "2026-10-20";
  const now = new Date(Date.parse(`${D}T00:00:00Z`) - h * 3_600_000 - (h >= 0 ? 0 : 0) + (h >= 0 ? 30 * 60_000 * 0 : 0)).toISOString();
  const adv = refundFor(p, D, paid, now, "parent");
  const e = oracle(p.bands, h, paid);
  n++;
  if (!adv || Math.abs(adv.amount - e.amount) > 0.0001 || adv.percent !== e.pct) { bad++; rows.push(`MISMATCH ${p.name} h=${h} paid=${paid}: lib ${adv?.amount} (${adv?.percent}%) vs oracle ${e.amount} (${e.pct}%)`); }
}
// provider-initiated is always full, regardless
const prov = refundFor(DEFAULT_POLICIES[3], "2026-10-20", 54, "2026-10-20T01:00:00.000Z", "provider");
const fmt = (x: number) => x.toFixed(2);
console.log(`UNIT matrix: ${n} cells, ${bad} mismatches`);
rows.slice(0, 20).forEach((r) => console.log(r));
console.log("provider-initiated under 'No refunds', 1h after start:", prov?.amount, prov?.percent + "%");
// boundary table for Standard at £54
const std = DEFAULT_POLICIES[0];
console.log("Standard £54 boundary:", [169, 168, 167, 49, 48, 47, 1, 0].map((h) => `${h}h=£${fmt(refundFor(std, "2026-10-20", 54, new Date(Date.parse("2026-10-20T00:00:00Z") - h * 3_600_000).toISOString(), "parent")!.amount)}`).join(" "));
// sub-hour: 47h59m is 47 whole hours -> 0 under Standard (>=48 needed)
console.log("47h59m before:", refundFor(std, "2026-10-20", 54, new Date(Date.parse("2026-10-20T00:00:00Z") - (48 * 3_600_000 - 60_000)).toISOString(), "parent")?.amount, "(floor to whole hours: 47h -> below 48h band)");
console.log("half-penny rounding: 37.55 @50% =", refundFor(std, "2026-10-20", 37.55, new Date(Date.parse("2026-10-20T00:00:00Z") - 100 * 3_600_000).toISOString(), "parent")?.amount, "(expect 18.78 - rounds up)");
console.log("noRefundCreditAmount:", noRefundCreditAmount({ noRefundCredit: true, walletOn: true, policyAmount: 0, paid: 54 }), noRefundCreditAmount({ noRefundCredit: true, walletOn: false, policyAmount: 0, paid: 54 }), noRefundCreditAmount({ noRefundCredit: true, walletOn: true, policyAmount: 27, paid: 54 }), noRefundCreditAmount({ noRefundCredit: false, walletOn: true, policyAmount: 0, paid: 54 }), noRefundCreditAmount({ noRefundCredit: true, walletOn: true, policyAmount: null, paid: 54 }), "(expect 54 0 0 0 0)");
console.log("accumulatePendingRelease:", accumulatePendingRelease({ refundOnly: true, refund: "pending", amount: 10 }, 15, 20), accumulatePendingRelease(null, 15, 20), accumulatePendingRelease({ refundOnly: true, refund: "pending", amount: 10 }, 5, 20), "(expect 20 15 15)");
process.exit(bad ? 1 : 0);
