// Test data for the toilet-training feature.
//
//   1. Adds the "Is your child toilet trained?" question to each tenant's
//      library (idempotent — skipped if already there).
//   2. Answers it on the regdemo children: the two youngest get "No", the rest
//      "Yes", so the register shows the nappy tag + filter on a realistic mix.
//
// Only ever writes to `regdemo-*` children. Pass `clean` to undo: removes the
// question and clears the answers.
import "dotenv/config";
import { db } from "./firebase";

const TENANTS = ["j2J95nc7F7xcLcrYkX1B", "x4goY84cslX4mBV4LNtG"];
const Q = {
  id: "q-toilet",
  label: "Is your child toilet trained?",
  type: "yesno",
  kind: "toilet",
  scope: "all",
  required: true,
  showOnRegister: true,
  reviewIfNo: true,
  help: "So we can plan changing and staffing. Answering “no” doesn’t stop you booking — we’ll confirm the place ourselves.",
};

const clean = process.argv.includes("clean");

async function run(tid: string) {
  const libRef = db.collection("libraries").doc(tid);
  const lib = await libRef.get();
  const qs = ((lib.data()?.childQuestions ?? []) as { id: string }[]).filter((q) => q.id !== Q.id);
  if (clean) {
    await libRef.set({ childQuestions: qs }, { merge: true });
  } else {
    await libRef.set({ childQuestions: [...qs, Q] }, { merge: true });
  }

  const kids = await db.collection("children").where("tenantId", "==", tid).get();
  const demo = kids.docs.filter((d) => d.id.startsWith("regdemo-"));
  // Youngest first, so "not trained" lands on the youngest children.
  demo.sort((a, b) => String(b.data().dob ?? "").localeCompare(String(a.data().dob ?? "")));

  const batch = db.batch();
  demo.forEach((d, i) => {
    const prev = (d.data().answers ?? {}) as Record<string, string>;
    const next = { ...prev };
    if (clean) delete next[Q.id];
    else next[Q.id] = i < 2 ? "No" : "Yes";
    batch.set(d.ref, { answers: next }, { merge: true });
  });
  await batch.commit();

  const names = demo.slice(0, 2).map((d) => d.data().name);
  console.log(
    clean
      ? `  ${tid}: removed question, cleared answers on ${demo.length} demo children`
      : `  ${tid}: question added · ${demo.length} children answered · NOT trained = ${names.join(", ") || "(none)"}`,
  );
}

(async () => {
  console.log(clean ? "Removing toilet-training test data…" : "Seeding toilet-training test data…");
  for (const t of TENANTS) await run(t);
  console.log("Done. Open the Register — the 🚼 tag and NOT TOILET TRAINED filter should show.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
