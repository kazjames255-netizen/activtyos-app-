// Adds store credit to ONE family's wallet with ONE provider (Admin SDK, same ledger code the app uses). e2e arrange step only.
//   npx tsx ../e2e/helpers/walletCredit.ts <tenantId> <email> <amount>      (run from server/)
import { creditWallet, walletBalance } from "../../server/src/lib/wallet";
const [tenantId, email, amount] = process.argv.slice(2);
if (!tenantId || !email || !amount) { console.error("usage: walletCredit <tenantId> <email> <amount>"); process.exit(2); }
if (!/@activityos-test\.com$/i.test(email)) { console.error("refusing: test accounts only"); process.exit(4); }
(async () => {
  await creditWallet(tenantId, email, Number(amount), "e2e wallet credit");
  process.stdout.write(`\n@@BAL@@${await walletBalance(tenantId, email)}@@END@@\n`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
