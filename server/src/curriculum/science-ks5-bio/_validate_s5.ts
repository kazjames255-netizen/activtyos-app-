// Validates only this pack (the shared validator imports every pack and stops if another agent's file is half-written).
//   cd server && npx tsx src/curriculum/science-ks5-bio/_validate_s5.ts
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateTopic, setImagePack } from "../validate";
const HERE = path.dirname(fileURLToPath(import.meta.url));
setImagePack("science-ks5-bio");
(async () => {
  const seen = new Set<string>();
  let problems = 0, topics = 0, qs = 0;
  for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
    const t = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
    const errs = validateTopic(t, seen);
    topics++; qs += Object.values(t.years).reduce((n: number, y: any) => n + y.quiz.questions.length, 0);
    for (const e of errs) console.error(e);
    problems += errs.length;
    console.log(`${errs.length ? "✗" : "✓"} ${t.key} years ${Object.keys(t.years).join(",")}`);
  }
  console.log(`${topics} topics · ${qs} questions · ${problems} problem(s)`);
  process.exit(problems ? 1 : 0);
})();
