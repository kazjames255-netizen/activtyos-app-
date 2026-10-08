import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as fmt from "../../lib/i18n/format";
import * as H from "../../features/bookings/helpers";
import { applyPartialCancel } from "../../features/bookings/mutations";
import type { Booking } from "../../features/bookings/types";

// Round 2 of the dates sweep: places where a formatted day is COMPARED with stored English labels ("Sun 18 Oct 2026") must use a fixed English key and
// behave exactly as in English whatever language the viewer picked. Languages that Chrome formats differently from English: cy, pl, ar, ur.
const LANGS = ["cy", "pl", "ar", "ur"] as const;
const root = path.resolve(import.meta.dirname, "../..");
const src = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const withLang = (l: string, fn: () => void) => { fmt.setDateLocale(l as never); try { fn(); } finally { fmt.setDateLocale("en"); } };
const booking = (): Booking => ({ ref: "R", booker: "B", email: "e", phone: "", child: "K", listing: "L", pass: "2", ticket: "", dates: "", status: "Confirmed", pay: "Paid", method: "Card",
  amount: 40, amountPaid: 40, addons: [], days: ["2026-10-18", "2026-10-19"],
  sessions: ["Sun 18 Oct 2026 · 09:00 – 15:00", "Mon 19 Oct 2026 · 09:00 – 15:00"],
  kids: [{ name: "K", dates: ["2026-10-18", "2026-10-19"] }] }) as unknown as Booking;

test("sessionDayKey is the fixed English label; sessionDayLabel is for display and follows the language", () => {
  const key = (H as unknown as { sessionDayKey?: (iso: string) => string }).sessionDayKey;
  assert.equal(typeof key, "function");
  for (const l of ["en", ...LANGS]) withLang(l, () => assert.equal(key!("2026-10-18"), "Sun 18 Oct 2026", l));
  withLang("cy", () => assert.equal(H.sessionDayLabel("2026-10-18"), "Sul 18 Hyd 2026"));
  withLang("en", () => assert.equal(H.sessionDayLabel("2026-10-18"), "Sun 18 Oct 2026"));
});
for (const l of LANGS) {
  test(`${l}: releasing a day removes it from b.sessions exactly as in English`, () => withLang(l, () => {
    const b = booking();
    applyPartialCancel(b, [{ childKey: "K", days: ["2026-10-19"] }]);
    assert.deepEqual(b.sessions, ["Sun 18 Oct 2026 · 09:00 – 15:00"]);
    assert.deepEqual(b.days, ["2026-10-18"]);
  }));
  test(`${l}: 'move to' never offers a day the child already holds (legacy label dates)`, () => withLang(l, () => {
    const kid = { name: "K", dates: ["Sun 18 Oct 2026"], cancelledDays: [] as string[] };
    const block = { capacityScope: "listing" as const, sessions: [{ date: "2026-10-18", spotsLeft: 3 }, { date: "2026-10-19", spotsLeft: 3 }] };
    const alt = H.altDates(kid as never, block as never);
    assert.deepEqual(alt.map((a) => a.iso), ["2026-10-19"]);
    assert.notEqual(alt[0].label, "Mon 19 Oct 2026", "the label shown is in the viewer's language");
  }));
  test(`${l}: the bookings date filter (runsOn) matches stored English session labels`, () => withLang(l, () => {
    assert.equal(H.runsOn(booking(), "2026-10-18"), true);
    assert.equal(H.runsOn(booking(), "2026-10-20"), false);
  }));
}
test("machine HH:MM for stored clock times is 24-hour Latin digits in every language", () => {
  const f = (fmt as unknown as { machineHm?: (d: Date | string) => string }).machineHm;
  assert.equal(typeof f, "function");
  for (const l of ["en", "cy", "ar", "ur", "pl"]) withLang(l, () => assert.equal(f!(new Date("2026-10-08T08:05:00Z")), "09:05", l)); // 09:05 in London (BST)
});
test("range separator: English keeps 'to'; other languages use an en dash", () => {
  const j = (fmt as unknown as { joinRange?: (a: string, b: string, code?: string) => string }).joinRange;
  assert.equal(typeof j, "function");
  assert.equal(j!("12 Oct", "18 Oct", "en"), "12 Oct to 18 Oct");
  for (const l of ["cy", "pl", "ar"]) assert.equal(j!("12 Hyd", "18 Hyd", l), "12 Hyd – 18 Hyd");
});
test("Welsh narrow weekday / month is a single letter", () => {
  const d = ["18", "19", "20", "21", "22", "23", "24"].map((n) => fmt.formatDay(`2026-10-${n}`, { weekday: "narrow" }, "cy"));
  for (const x of d) assert.equal(x.length, 1, x);
  assert.equal(fmt.uiDate(new Date("2026-10-18T12:00:00Z"), { weekday: "narrow", timeZone: "UTC" }, "cy"), "S");
});
test("display twins: no per-day row shows a raw stored label, and the two dates in a range are joined with the helper", () => {
  const bd = src("features/bookings/BookingDetail.tsx");
  assert.doesNotMatch(bd, /sessionDayLabel\(dt\) : dt\}/, "BookingDetail shows a stored label unlocalised");
  assert.doesNotMatch(src("features/bookings/MoneyConfirm.tsx"), /sessionDayLabel\(dt\) : dt\)/);
  for (const f of ["features/parent/ParentHomeApp.tsx", "features/parent/MyBookingsApp.tsx"]) assert.doesNotMatch(src(f), /\\u2013 \$\{fmtDay|\} to \$\{/, f);
});
test("stored clock times are never taken from the display formatter", () => {
  const tc = src("features/timeclock/data.ts");
  assert.doesNotMatch(tc, /const hm = uiTime\(/);
  assert.doesNotMatch(tc, /mins\(hhmm\(/);
});
