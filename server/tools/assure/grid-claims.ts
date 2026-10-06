// Evidence claims for the grid. Every ref is verified by grid.ts (test title / results-JSON key / file text must exist and pass).
// Only cite what was read. A claim = "this evidence exercises these rows under these actions".
import { claim, type Ref } from "./grid-data.ts";

const P = (file: string, test: string): Ref => ({ kind: "pure", file: `tests/${file}.test.mts`, test });
const R = (dir: string, key: string, file = "results.json"): Ref => ({ kind: "report", file: `e2e/review/shots/${dir}/${file}`, key });
const S = (file: string, match: string): Ref => ({ kind: "script", file, match });

const SHAPES = ["shape.single", "shape.multiday", "shape.multiweek"];
const POLS = ["pol.standard", "pol.flexible", "pol.strict", "pol.none", "pol.custom"];

// ---- Book -----------------------------------------------------------------------------------------------------------------
claim({ id: "book-shape", what: "pass shapes: day-count rules, whole-block, multi-week", rows: SHAPES, cols: ["book"],
  refs: [P("amend-passes", "PP-001: 'Any n days in a week' (3 days)"), P("amend-passes", "PP-002: 'Any n days, any week'"), P("pass-booking", "LT-016: a 5-day pass needs exactly 5 days"), R("mny", "A3-term-partial")] });
claim({ id: "book-cap", what: "capacity rules at booking", rows: ["cap.day", "cap.listing", "cap.ticket", "cap.age"], cols: ["book"],
  refs: [R("t2", "CAP-DAY-fill9"), R("t2", "CAP-WHOLE-full"), R("t2", "CAP-TICKET-passcap"), R("t2", "CAP-AGE-3")] });
claim({ id: "book-appr", what: "auto / manual approval / out-of-range request", rows: ["appr.auto", "appr.manual", "appr.oor"], cols: ["book"],
  refs: [S("e2e/booking-lifecycle.spec.ts", "approval-needed bookings"), S("e2e/booking.spec.ts", "browse → book free place"), R("t2", "CAP-OOR-yes-out")] });
claim({ id: "book-wl", what: "booking onto a full day joins the waiting list (manual and auto)", rows: ["wl.manual", "wl.auto"], cols: ["book", "wl.join"],
  refs: [R("wl", "W02-join-waitlist-single-day"), R("t2", "WL-auto-join-queue")] });
claim({ id: "book-price", what: "paid and funded GBP 0", rows: ["price.paid", "price.free"], cols: ["book"],
  refs: [R("mny", "B9-ledger"), P("finance", "PY-017/PY-037/FD-011: Funded £0 place"), P("amend-passes", "PP-017: a £0 master price")] });
claim({ id: "book-disc", what: "discount engine through real bookings", rows: ["disc.none", "disc.person", "disc.session", "disc.early-pct", "disc.early-fixed", "disc.code"], cols: ["book"],
  refs: [R("t2", "DISC-R0_none-B1_one_child_1day"), R("t2", "DISC-R1_person10-B2_two_kids_3day_same_week"), R("t2", "DISC-R3_session10_over3-B2"), R("dsc", "D2-early-fixed"), R("dsc", "D2-early-pct-blank-season"), R("mny", "B2-codes")] });
claim({ id: "book-addon", what: "add-on pricing and validation", rows: ["addon.none", "addon.perday", "addon.oneoff"], cols: ["book"],
  refs: [R("addons", "AO-04 pricing per child/day"), R("addons", "AO-05a"), P("amend-passes", "PP-006: one-off add-on costs £8 once"), P("amend-passes", "PP-007: per-day add-on on 2 of 3 days")] });
claim({ id: "book-loc", what: "coverage and address rules per delivery mode", rows: ["loc.venue", "loc.hv-pc", "loc.hv-radius", "loc.both", "loc.online-link"], cols: ["book"],
  refs: [S("e2e/review/hv-cover.ts", "COV postcode"), S("e2e/review/hv-cover.ts", "COV radius"), S("e2e/review/hv-cover.ts", "'both' listing accepts"), S("e2e/review/hv-cover.ts", "venue-only booking ignores"), S("e2e/review/hv-cover.ts", "online listing books with no address needed")] });
claim({ id: "book-online-room", what: "online room listing booked, parent sees no address", rows: ["loc.online-room"], cols: ["book"],
  refs: [S("e2e/review/online-test.ts", "no address anywhere on the online listing")] });

// ---- Paying ---------------------------------------------------------------------------------------------------------------
claim({ id: "pay-card", what: "card pay-link, declined card", rows: ["price.paid", "shape.single", "wl.off", "wl.manual", "wl.auto", "shape.multiday", "shape.multiweek"], cols: ["pay.card"],
  refs: [S("e2e/payments.spec.ts", "customer pays an invoice by card"), S("e2e/payments.spec.ts", "a declined card leaves the invoice unpaid"), P("payments-edge", "payable(): gating on status / pay"), P("payments-edge", "balanceOf(): amount comes from the booking balance")] });
claim({ id: "pay-offline", what: "bank/cash/TFC/voucher/part-pay money rules", rows: ["price.paid"], cols: ["pay.bank", "pay.cash", "pay.tfc", "pay.voucher", "pay.partial"],
  refs: [P("pay-methods", "PY-009: TFC is stored under one canonical method"), P("pay-methods", "PY-012: splitTfc shares HMRC's amount"), P("pay-methods", "PY-012: a card payment asks only for the remainder"), P("payments-edge", "money helpers: owedOf / receivedOf / paidSoFar / owedNow"), R("mny", "B8-voucher"), R("mny", "B7-tfc-part-pay")] });
claim({ id: "pay-wallet", what: "wallet + code + add-ons split; wallet untouched while waitlisted", rows: ["price.paid", "disc.code", "addon.perday", "addon.oneoff", "wl.manual", "wl.auto"], cols: ["pay.wallet", "wallet.use"],
  refs: [R("mny", "B3-wallet-code-addons-split"), R("wl", "F01-wallet-not-spent-on-waitlist")] });

// ---- Cancelling -----------------------------------------------------------------------------------------------------------
claim({ id: "cancel-pol", what: "every policy at many notice distances (pure bands + live e2e)", rows: POLS, cols: ["cancel.whole", "refund"],
  refs: [P("cancellations", "Standard policy bands"), P("cancellations", "Other policies at 72h notice"), P("cancellations", "refundFor edge cases"), R("pol", "A-d20-standard"), R("pol", "A-d20-flexible"), R("pol", "A-d20-strict"), R("pol", "A-d20-none"), R("pol", "A-d20-custom"), R("pol", "F1-standard", "results3.json")] });
claim({ id: "cancel-afterstart", what: "after the first session started: provider cancel stays 100%, parent gets the band", rows: POLS, cols: ["cancel.afterstart"],
  refs: [P("cancellations", "refundFor edge cases"), R("pol", "H1 provider cancels one DAY", "results4.json")] });
claim({ id: "cancel-shape", what: "whole and partial cancel across pass shapes", rows: SHAPES, cols: ["cancel.whole", "cancel.child", "cancel.provider"],
  refs: [P("cancellations", "Partial per-day cancellations"), P("cancellations", "Whole-booking cancel flow"), R("mny", "B4-refund-multiweek-policy"), R("t2", "CAP-CANCEL-whole"), R("t2", "CAP-CANCEL-child")] });
claim({ id: "cancel-child", what: "one child cancelled frees exactly that child's places", rows: ["cap.day", "cap.listing", "pol.standard"], cols: ["cancel.child", "cancel.whole"],
  refs: [P("child-cancel-capacity", "operator cancels one child: one place freed on every day"), P("child-cancel-capacity", "whole-booking status cancel frees everything held"), P("waitlist-capacity", "cancelling frees exactly that child's days")] });
claim({ id: "cancel-price", what: "paid cancel refunds; free funded cancel", rows: ["price.paid"], cols: ["cancel.whole", "cancel.child", "cancel.afterstart", "cancel.provider"],
  refs: [P("cancellation-refunds", "CN-006/009/011: refund button follows how it was paid"), R("pol", "H2 provider cancels one CHILD", "results4.json"), R("pol", "H1 provider cancels one DAY", "results4.json")] });
claim({ id: "cancel-disc-addon", what: "refund counts discount and add-ons", rows: ["disc.none", "disc.person", "disc.session", "disc.early-pct", "disc.early-fixed", "disc.code", "addon.none", "addon.perday", "addon.oneoff"], cols: ["cancel.whole", "cancel.child", "cancel.provider"],
  refs: [R("addons", "AO-12 whole-booking cancel refunds extras too"), R("addons", "AO-12b partial day cancel"), R("mny", "B4c-whole-cancel-rounding"), P("cancellation-refunds", "CN-036: a one-day partial refund comes off revenue")] });
claim({ id: "cancel-wl-appr-cap", what: "cancel hands the freed place down the queue", rows: ["wl.manual", "wl.auto", "cap.ticket", "cap.age", "appr.auto", "appr.manual", "appr.oor"], cols: ["cancel.whole", "cancel.child", "cancel.provider"],
  refs: [R("wl", "D07-provider-cancels-offered-passes-down"), R("wl", "D08-cancel-one-day-frees-place"), R("wl", "E01-provider-cancel-triggers-auto-offer"), R("wl", "D06-cancel-an-offered-booking-passes-down")] });
claim({ id: "cancel-wl-off", what: "cancel on a listing with waiting list off just frees the place", rows: ["wl.off"], cols: ["cancel.whole", "cancel.child", "cancel.provider", "cancel.afterstart", "refund"],
  refs: [P("waitlist-capacity", "freed seat on a full day lets the next booking in"), P("child-cancel-capacity", "whole-booking status cancel frees everything held")] });
claim({ id: "cancel-wl-after", what: "waitlisted booking cancel = leave list, owes nothing", rows: ["wl.manual", "wl.auto"], cols: ["cancel.whole", "refund"],
  refs: [R("wl", "U05-parent-leaves-list-in-ui"), R("wl", "F06-leave-list-and-requeue-positions"), P("amend-fee-override", "AW-025: a waitlisted booking keeps its price but owes nothing to pay")] });

// ---- Changing a date ------------------------------------------------------------------------------------------------------
claim({ id: "amend", what: "date move: validation, capacity, approve/decline, notice rules, add-on carry-over", rows: [...SHAPES, "cap.day", "cap.listing", "appr.auto", "appr.manual", "addon.none", "addon.perday", "wl.off", "wl.manual", "wl.auto"], cols: ["amend.date"],
  refs: [P("amend-passes", "AM-001: a valid future move to a running, non-full date is accepted"), P("amend-passes", "AM-006: move to a FULL date refused"), P("amend-passes", "AM-003: partial approval applies ONLY the ticked move"), R("addons", "AO-13 date move carries the day's lunch"), R("pol", "G1 notice rule", "results4.json")] });

// ---- Waiting list ---------------------------------------------------------------------------------------------------------
const WLR = ["wl.manual", "wl.auto"];
claim({ id: "wl-join", what: "join: size cap, duplicate join, hidden ticket, per-day queue positions", rows: [...SHAPES, "cap.day", "cap.ticket", "cap.age", "appr.auto", "appr.manual", "disc.none", "disc.early-pct", "addon.none", "addon.perday", "loc.venue"], cols: ["wl.join"],
  refs: [R("wl", "W01-fill-day"), R("wl", "W04-size-limit"), R("wl", "W05-duplicate-join"), R("wl", "E05-multiday-pass-waits-for-all-days"), R("wl", "E06-multiweek-booking-queues-per-week"), R("wl", "F02-discount-frozen-at-join"), R("wl", "F08-addon-price-frozen-and-held"), R("wl", "F05-hidden-ticket-cannot-join"), R("wl", "E10-age-cap-not-bypassed-by-offer")] });
claim({ id: "wl-offer", what: "offer: manual, auto first-in-queue, holds seat, respects pass and age caps", rows: [...WLR, ...SHAPES, "cap.day", "cap.ticket", "cap.age", "appr.auto", "disc.none", "disc.early-pct"], cols: ["wl.offer"],
  refs: [R("wl", "B02-manual-offer-chosen"), R("wl", "D02-auto-offer-first-in-queue-right-date"), R("wl", "B03-offer-holds-seat"), R("wl", "E08-pass-cap-not-bypassed-by-offer"), R("wl", "E10-age-cap-not-bypassed-by-offer"), R("wl", "E05-multiday-pass-waits-for-all-days"), P("waitlist-capacity", "AW-007: offering sets Offered")] });
claim({ id: "wl-accept", what: "accept: confirms, holds price; second accept refused; another parent refused", rows: [...WLR, "price.paid", "cap.day", "appr.auto"], cols: ["wl.accept", "wl.decline"],
  refs: [R("wl", "B07-accept-offer"), R("wl", "B08-accept-again-refused"), R("wl", "B09-other-parent-cannot-answer"), R("wl", "C04-accept-after-expiry-refused"), R("wl", "D04-auto-decline-passes-down")] });
claim({ id: "wl-decl", what: "decline: manual does not auto-offer next, auto passes down", rows: [...WLR, "cap.day", "appr.auto"], cols: ["wl.decline"],
  refs: [R("wl", "C02-decline-manual-no-auto-next"), R("wl", "D04-auto-decline-passes-down"), R("wl", "C01-free-place-then-offer-decline")] });
claim({ id: "wl-expire", what: "expiry requeues behind / passes down", rows: [...WLR, "cap.day", "appr.auto"], cols: ["wl.expire"],
  refs: [R("wl", "C03-offer-expiry-requeues"), R("wl", "D05-auto-expiry-passes-down"), P("waitlist-capacity", "AW-011: lapsed offer returns the seat")] });
claim({ id: "wl-accept-price", what: "accepting a free/funded offer or paid offer", rows: ["price.paid"], cols: ["wl.accept"],
  refs: [R("wl", "B07-accept-offer"), R("mny", "B6-waitlist-offer-accept")] });

// ---- Requests -------------------------------------------------------------------------------------------------------------
claim({ id: "req", what: "approve and decline a request", rows: ["appr.manual", "appr.oor"], cols: ["req.approve", "req.decline"],
  refs: [S("e2e/booking-lifecycle.spec.ts", "operator approves one, declines another"), R("t2", "CAP-OOR-approve"), P("emails", "ME-003 declined: the provider's REASON is in the email")] });
claim({ id: "req-deps", what: "approving a request keeps capacity, discount, add-on and waitlist state", rows: ["cap.day", "cap.listing", "disc.none", "disc.person", "addon.none", "addon.perday", "wl.off", "wl.manual", "wl.auto", "price.paid"], cols: ["req.approve", "req.decline"],
  refs: [S("e2e/booking-lifecycle.spec.ts", "operator approves one, declines another"), R("t2", "CAP-OOR-approve")] });

// ---- Listing edits --------------------------------------------------------------------------------------------------------
claim({ id: "dup", what: "duplicate keeps add-ons, staff, wizard fields", rows: ["addon.none", "addon.perday", "addon.oneoff", "loc.hv-pc", "loc.hv-radius", "loc.online-room", "loc.online-link"], cols: ["listing.duplicate"],
  refs: [R("addons", "AO-16 duplicate listing keeps add-ons"), R("st4", "DUP-01 duplicate keeps the same staff"), S("e2e/review/hv-ui-e.ts", "WIZ Online saved")] });
claim({ id: "edit", what: "edit a listing after bookings exist (publish rules, schema round trip)", rows: SHAPES, cols: ["listing.edit"],
  refs: [P("listings", "unknown fields are stripped, known ones survive a round trip"), P("listings", "ticket override: per-ticket age + capacity + hidden flag, closing a pass"), R("addons", "AO-17 edit and delete add-on after bookings")] });
claim({ id: "visibility", what: "draft / hidden / archived visibility", rows: ["loc.venue"], cols: ["listing.unpublish"],
  refs: [P("listings", "LT-019 draft is neither browsable"), P("listings", "LT-027 archived listing drops out of browse"), P("public-access", "BE-013: hidden listing is NOT browsable")] });

// ---- closed by tests/regression/grid-policy.test.mts -----------------------------------------------------------------------
const GP = (t: string): Ref => ({ kind: "pure", file: "tests/regression/grid-policy.test.mts", test: t });
claim({ id: "grid-policy", what: "provider cancel is 100% under every policy; per-child refund bounded; custom band boundaries", rows: POLS, cols: ["cancel.provider", "cancel.child", "cancel.afterstart"],
  refs: [GP("provider-initiated cancel is 100% under every policy"), GP("custom bands hit their exact boundaries"), GP("a per-child cancel is refunded on that child's price")] });
