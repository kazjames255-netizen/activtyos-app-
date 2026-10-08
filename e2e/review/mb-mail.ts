import { mails } from "./mb-lib";
const q = process.argv[2], to = process.argv[3] ?? "";
for (const m of mails().filter((m) => (m.subject.replace(/\s/g, "") + m.html).includes(q) && m.to.includes(to))) { console.log("TO", m.to, "SUBJ", m.subject.replace(/\s+/g, " ")); console.log(m.text, "\n"); }
