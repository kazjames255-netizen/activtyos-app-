// node secret-scan.mjs   -> scans `git diff origin/main` (committed + uncommitted) for credentials. --selftest proves the patterns bite.
import { execFileSync } from "node:child_process";
import { ROOT, findSecrets, fail } from "./_lib.mjs";
if (process.argv[2] === "--selftest") {
  const pos = findSecrets("x client_secret=ABCDEFGHIJKLMNOP1234") .length > 0 && findSecrets("Gunners1").length > 0;
  const neg = findSecrets("const x = process.env.HMRC_TFC_CLIENT_SECRET;").length === 0;
  if (!pos || !neg) fail(`selftest pos=${pos} neg=${neg}`);
  console.log("secret-scan selftest passed");
} else {
  const diff = execFileSync("git", ["diff", "origin/main", "--", ".", ":!docs/**", ":!lib/testing/agent-results/**"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).join("\n");
  const hits = findSecrets(added);
  if (hits.length) fail("credential-like content in diff: " + hits.join(", "));
  console.log("secret scan passed");
}
