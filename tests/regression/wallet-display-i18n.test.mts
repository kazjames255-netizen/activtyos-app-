// The wallet breakdown wording (Price / Paid by wallet / To pay ...) exists in all 11 languages, in the catalogue, and the screens use the server's `money` split.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import p7bdMod from "../../lib/i18n/messages/areas/p7bd";
import coreMod from "../../lib/i18n/messages/areas/p8lst-parts/core";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const p7bd: any = (p7bdMod as any).default ?? p7bdMod;
const core: any = (coreMod as any).default ?? coreMod;

const KEYS: [any, string, string[]][] = [
  ...["wbPrice", "wbPaidWallet", "wbToPay", "wbToPayCash", "wbPaidFull", "wbMethodWallet", "wbMethodWalletCash"].map((k) => [p7bd, k, []] as [any, string, string[]]),
  [p7bd, "wbAfterWallet", ["{amt}"]], [p7bd, "wbMethodWalletPlus", ["{method}"]], [p7bd, "wbPaid", ["{method}"]],
  [core, "bxCol_price", []], [core, "bxCol_walletPaid", []],
];

test("every wallet-breakdown string is in all 11 languages, translated, with its placeholders", () => {
  const bad: string[] = [];
  for (const [area, key, vars] of KEYS) {
    for (const loc of LOCALES) {
      const v = area[loc]?.[key];
      if (!v) { bad.push(`${loc}.${key} missing`); continue; }
      for (const p of vars) if (!v.includes(p)) bad.push(`${loc}.${key} lost ${p}`);
    }
    // Short words may legitimately match English in a language (Total, Prix...), but a long sentence must not.
    for (const loc of LOCALES.filter((l) => l !== "en")) if (area[loc][key] === area.en[key] && area.en[key].length > 14) bad.push(`${loc}.${key} is still English`);
  }
  assert.deepEqual(bad, []);
});

test("the screens read the server's split (no money arithmetic in the browser)", () => {
  const rows = readFileSync("features/bookings/WalletMoneyRows.tsx", "utf8");
  assert.doesNotMatch(rows, /[a-z)\]]\s*[-+*]\s*(m|b)\.(money\.)?(walletApplied|amount|gross|due)/, "WalletMoneyRows adds nothing up");
  for (const f of ["features/bookings/BookingDetail.tsx", "features/bookings/BookingsList.tsx", "features/parent/MyBookingsApp.tsx", "features/parent/PaymentsApp.tsx"]) {
    assert.match(readFileSync(f, "utf8"), /b\.money/, `${f} uses b.money`);
  }
});
