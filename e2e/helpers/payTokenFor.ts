// Prints the public pay-link token (/pay/b/{token}) for one booking, minting it if needed (the token normally only travels by email).
//   npx tsx ../e2e/helpers/payTokenFor.ts <tenantId> <ref>      (run from server/)
import { bookingPayToken } from "../../server/src/lib/bookingPayToken";
const [tenantId, ref] = process.argv.slice(2);
bookingPayToken(tenantId, ref).then((t) => { process.stdout.write(`\n@@TOKEN@@${t}@@END@@\n`); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
