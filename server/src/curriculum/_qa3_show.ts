import { readdirSync } from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const root = "/Users/kazjames/Downloads/activtyos-app-/server/src/curriculum";
const want = new Set(process.argv.slice(3)); const pack = process.argv[2];
for (const f of readdirSync(path.join(root,pack)).filter(f=>f.endsWith(".ts")&&!f.startsWith("_"))) {
  const t=(await import(pathToFileURL(path.join(root,pack,f)).href)).TOPIC;
  for (const y of Object.values(t.years) as any[]) for (const q of y.quiz.questions) if (want.has(q.key)) {
    console.log(`\n[${q.key}] ${q.prompt}`); (q.options??[]).forEach((o:string)=>console.log(`  ${(Array.isArray(q.answer)?q.answer.includes(o):q.answer===o)?"*":" "} ${o}`)); console.log("  => "+q.explanation);
  }
}
