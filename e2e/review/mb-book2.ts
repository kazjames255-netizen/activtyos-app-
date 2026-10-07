// Post-fix re-check: multi-week bank bookings (parent2's Ben) -> the confirmation email must carry the TOTAL and every ref.
import { call, load, save, tokFor, sleep, mails } from "./mb-lib";
(async () => {
  const S = load();
  const t2 = await tokFor(S.accts.parent2.email);
  const before = mails().length;
  const mk = async (l: string, pass: string, dates: string[]) => {
    const L = S.listings[l]; const block = L.blocks.find((b: any) => b.startDate <= dates[0] && dates[0] <= b.endDate);
    const k = S.kids2.Ben;
    const r = await call(t2, "POST", "/api/my/bookings", { listingId: L.id, blockId: block.id, method: "Bank transfer", items: [{ pass, dates, child: k.name, childId: k.id, age: k.age }], phone: "07700900999" });
    console.log(l, r.status, "total", r.json?.total, "refs", (r.json?.bookings ?? []).map((b: any) => b.ref + "=" + b.amount).join(","), "bank", JSON.stringify(r.json?.bank));
    return r;
  };
  await mk("term", "Full term", ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"]);
  await mk("passes", "10-day pass", ["2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13"]);
  await sleep(3000);
  for (const m of mails().slice(before)) console.log("-", m.to, "|", m.subject.replace(/\s+/g, " "), "\n   ", m.text.replace(/^.*?quoted-printable/, "").slice(0, 700));
  process.exit(0);
})();
