// node verify-doc.mjs <file> --headings "A|B|C" [--min-cites N] | --selftest
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, read, fail, pathExists, findSecrets } from "./_lib.mjs";

function check(file, headings, minCites) {
  if (!pathExists(file) && !pathExists(file.replace(ROOT + "/", ""))) return ["file missing: " + file];
  const text = read(file.startsWith("/") ? file : join(ROOT, file));
  const errs = [];
  for (const h of headings) if (!new RegExp("^#{1,4}\\s+.*" + h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "im").test(text)) errs.push("missing heading: " + h);
  const cites = [...text.matchAll(/`([A-Za-z0-9_.\-\/\[\]]+\/[A-Za-z0-9_.\-\[\]]+\.[a-z]{1,5})(?::\d+(?:-\d+)?)?`/g)].map((m) => m[1]);
  const uniq = [...new Set(cites)];
  for (const c of uniq) if (!pathExists(c)) errs.push("cited path does not exist: " + c);
  if (uniq.length < minCites) errs.push(`only ${uniq.length} distinct cited paths, need ${minCites}`);
  const sec = findSecrets(text); if (sec.length) errs.push("secret-like content: " + sec.join(","));
  return errs;
}

const args = process.argv.slice(2);
if (args[0] === "--selftest") {
  const d = mkdtempSync(join(tmpdir(), "vd-"));
  const good = join(d, "good.md"), noHead = join(d, "nohead.md"), badCite = join(d, "badcite.md"), sec = join(d, "sec.md");
  writeFileSync(good, "# Alpha\n## Beta\nSee `server/src/index.ts` and `package.json`.\n`server/src/lib/tfc.ts`\n");
  writeFileSync(noHead, "# Alpha\nSee `server/src/index.ts`\n");
  writeFileSync(badCite, "# Alpha\n## Beta\n`server/src/does/not/exist.ts`\n");
  writeFileSync(sec, "# Alpha\n## Beta\nclient_secret = abcdefghijklmnopqrstuvwxyz\n`server/src/index.ts`\n");
  const ok = check(good, ["Alpha", "Beta"], 2).length === 0;
  const neg = check(noHead, ["Alpha", "Beta"], 1).length > 0 && check(badCite, ["Alpha", "Beta"], 1).length > 0 && check(sec, ["Alpha", "Beta"], 1).length > 0;
  if (!ok || !neg) fail(`selftest ok=${ok} negatives=${neg}`);
  console.log("verify-doc selftest passed");
} else {
  const file = args[0];
  const hi = args.indexOf("--headings"), ci = args.indexOf("--min-cites");
  const headings = hi >= 0 ? args[hi + 1].split("|") : [];
  const errs = check(file, headings, ci >= 0 ? Number(args[ci + 1]) : 0);
  if (errs.length) fail(errs.join("; "));
  console.log("doc verification passed");
}
