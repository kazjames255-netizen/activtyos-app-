/**
 * Public access + privacy (pure: no network, no Firestore).
 * Run: npm run test:public  (= server/node_modules/.bin/tsx --test tests/public-access.test.mts)
 * Oracle: lib/testTracker/catalogue.ts BE-001..BE-019 + the privacy/security rules in server/src/routes/{library,payments,invoices}.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { isBlankOrWebUrl } from "../server/src/lib/safeUrl";
import { PUBLIC_SETTINGS_KEYS, publicLibrarySettings } from "../server/src/lib/publicLibrary";
import { linkExpiresOn, linkExpired } from "../server/src/lib/linkExpiry";
import { isBrowsable, directLinkVisible } from "../server/src/lib/listingVisibility";
import { isPayTokenFormat, payable, balanceOf } from "../server/src/lib/payGate";
import type { Booking } from "../features/bookings/types";

const bk = (o: Record<string, unknown>) => ({ ref: "R1", bid: "b", status: "Confirmed", pay: "Unpaid", amount: 100, ...o }) as unknown as Booking;

// ── BE-003 / BE-013: listing link visibility ───────────────────────────────
test("BE-013: hidden listing is NOT browsable but IS served by direct link", () => {
  const l = { title: "Football", status: "live", visibility: "hidden" };
  assert.equal(isBrowsable(l), false, "hidden = unlisted from the feed/storefront");
  assert.equal(directLinkVisible(l, false), true, "but a signed-out visitor with the link can still book it");
});

test("BE-003: unpublished (draft) listing link is refused for the public, allowed for its owner", () => {
  const draft = { title: "Football", status: "draft", visibility: "public" };
  assert.equal(directLinkVisible(draft, false), false);
  assert.equal(directLinkVisible(draft, true), true, "owner/platform can preview their own draft");
  assert.equal(isBrowsable(draft), false);
  assert.equal(directLinkVisible({ title: "x", status: "paused" }, false), false, "any non-live status is refused");
});

test("archived listing: refused by link for public, never browsable", () => {
  const a = { title: "Old", status: "live", archived: true };
  assert.equal(directLinkVisible(a, false), false);
  assert.equal(directLinkVisible(a, true), true);
  assert.equal(isBrowsable(a), false);
});

test("browse feed: a live public titled listing shows; legacy (no status/visibility) defaults to live+public", () => {
  assert.equal(isBrowsable({ title: "Art club", status: "live", visibility: "public" }), true);
  assert.equal(isBrowsable({ title: "Legacy" }), true);
  assert.equal(isBrowsable({ name: "Legacy name only" }), true);
});

test("browse feed: untitled stubs never leak (blank / whitespace / missing title)", () => {
  assert.equal(isBrowsable({ title: "" }), false);
  assert.equal(isBrowsable({ title: "   " }), false);
  assert.equal(isBrowsable({}), false);
});

test("direct link: a live listing is visible to a signed-out visitor (BE-002)", () => {
  assert.equal(directLinkVisible({ title: "x", status: "live" }, false), true);
  assert.equal(directLinkVisible({ title: "x" }, false), true, "legacy default live");
});

// ── Public library page: no bank details, no parent data ───────────────────
const SECRET_BILLING = { bankName: "Barclays", accountName: "Kids Ltd", sortCode: "20-00-00", accountNumber: "12345678", logoUrl: " https://x.test/logo.png " };

test("public library: bankReady is a boolean and bank details never appear anywhere in the payload", () => {
  const out = publicLibrarySettings({ billing: SECRET_BILLING, brandColor: "#123456" });
  assert.equal(out.bankReady, true);
  assert.equal(typeof out.bankReady, "boolean");
  const json = JSON.stringify(out);
  for (const secret of ["20-00-00", "12345678", "Barclays", "Kids Ltd", "sortCode", "accountNumber", "bankName"]) {
    assert.ok(!json.includes(secret), `public payload leaks ${secret}`);
  }
  assert.equal("billing" in out, false, "billing as a whole never goes out");
});

test("public library: logo URL is lifted (trimmed) out of billing; brand colour passes", () => {
  const out = publicLibrarySettings({ billing: SECRET_BILLING, brandColor: "#123456" });
  assert.equal(out.logoUrl, "https://x.test/logo.png");
  assert.equal(out.brandColor, "#123456");
  assert.equal("logoUrl" in publicLibrarySettings({ billing: { logoUrl: "   " } }), false);
});

test("public library: bankReady false when either sort code or account number is missing/blank/non-string", () => {
  assert.equal(publicLibrarySettings({}).bankReady, false);
  assert.equal(publicLibrarySettings({ billing: { sortCode: "20-00-00" } }).bankReady, false);
  assert.equal(publicLibrarySettings({ billing: { accountNumber: "12345678" } }).bankReady, false);
  assert.equal(publicLibrarySettings({ billing: { sortCode: "  ", accountNumber: "1" } }).bankReady, false);
  assert.equal(publicLibrarySettings({ billing: { sortCode: 200000, accountNumber: 12345678 } }).bankReady, false, "numbers are not accepted");
});

test("public library: only allow-listed keys are copied; private settings are dropped", () => {
  const out = publicLibrarySettings({
    billing: SECRET_BILLING,
    payrollAdmins: ["a@b.c"], stripeSecret: "sk_live_x", hmrcPassword: "pw", staffRates: { a: 12 }, ownerEmail: "o@x.com",
    brandColor: "#fff", features: { shop: true },
  });
  for (const k of ["payrollAdmins", "stripeSecret", "hmrcPassword", "staffRates", "ownerEmail"]) assert.equal(k in out, false, `${k} must not be public`);
  assert.deepEqual(out.features, { shop: true });
});

test("public library: the allow-list itself contains no bank/payroll/secret-looking keys", () => {
  const bad = /bank|sort|account|billing|payroll|secret|password|token|salary|wage|nino|iban|apikey/i;
  const offenders = PUBLIC_SETTINGS_KEYS.filter((k) => bad.test(k));
  assert.deepEqual(offenders, []);
  assert.equal(new Set(PUBLIC_SETTINGS_KEYS).size, PUBLIC_SETTINGS_KEYS.length, "no duplicate keys");
});

test("public library: provider-only cancellation reasons are hidden from parents; only id+label survive", () => {
  const out = publicLibrarySettings({
    cancellationReasons: [
      { id: "1", label: "Illness", who: "parent", internalNote: "x" },
      { id: "2", label: "Staffing", who: "provider" },
      { id: "3", label: "Weather", who: "both" },
      { id: "4", label: "Legacy" },
    ],
  });
  assert.deepEqual(out.cancelReasons, [{ id: "1", label: "Illness" }, { id: "3", label: "Weather" }, { id: "4", label: "Legacy" }]);
  assert.deepEqual(publicLibrarySettings({}).cancelReasons, []);
});

test("public library: no parent/child data keys are exposed (children, bookings, customers, emails)", () => {
  const out = publicLibrarySettings({ children: [{ name: "Tom" }], bookings: [1], customers: [1], parentEmails: ["p@x"], childQuestions: [1] });
  // Only the bank flag, reasons and the refund-term DEFAULTS - no parent/child data.
  assert.deepEqual(Object.keys(out).sort(), ["allowCardRefund", "allowPartialCancel", "askReasonParent", "bankReady", "cancelReasons", "cancellationPolicies", "noRefundCredit", "partialAllowChangeDate", "partialAllowRefund", "partialAllowWallet", "refundLetCustomerChoose"]);
});

// ── Booking pay link ───────────────────────────────────────────────────────
test("pay token: only a UUID-shaped string passes the pre-DB format check", () => {
  assert.equal(isPayTokenFormat("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isPayTokenFormat("123E4567-E89B-12D3-A456-426614174000"), true, "case-insensitive");
  for (const bad of ["", "abc", "../../etc/passwd", "123e4567-e89b-12d3-a456-42661417400", "123e4567-e89b-12d3-a456-4266141740000", "123e4567-e89b-12d3-a456-42661417400g", "123e4567/e89b/12d3/a456/426614174000", "tenant_REF123"]) {
    assert.equal(isPayTokenFormat(bad), false, JSON.stringify(bad));
  }
});

test("pay token: a path-ish or Firestore-path value can never reach the collection lookup", () => {
  // A 36-char string with a slash (sub-collection path) is rejected, so col.doc(token) can't be steered.
  assert.equal(isPayTokenFormat("a".repeat(17) + "/" + "b".repeat(18)), false);
  assert.equal(isPayTokenFormat("a".repeat(36)), true);
});

test("pay link: never payable once Paid / Refunded / Refund pending, whatever the status", () => {
  for (const pay of ["Paid", "Refunded", "Refund pending"]) {
    assert.equal(payable({ status: "Confirmed", pay }), false, pay);
    assert.equal(payable({ status: "Confirmed", pay: pay }), false);
  }
});

test("pay link: payable only for confirmed places or operator invoices", () => {
  assert.equal(payable({ status: "Confirmed", pay: "Unpaid" }), true);
  assert.equal(payable({ status: "Pending", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Waitlist", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Pending", pay: "Invoice sent" }), true);
});

test("pay link: the amount is the booking's balance, never anything a caller supplies", () => {
  assert.equal(balanceOf(bk({ amount: 100 })), 100);
  assert.equal(balanceOf(bk({ amount: 100, pay: "Paid" })), 0, "fully paid owes nothing");
  // balanceOf takes only the booking: there is no second parameter a caller could use to inject an amount.
  assert.equal(balanceOf.length, 1);
});

test("pay link (route guard): payable() alone does NOT block a cancelled invoice-sent booking; the route's own status check must", () => {
  // Documented here so nobody removes the explicit Cancelled/Declined guard in bookingPayPublic: payable() says yes to this.
  assert.equal(payable({ status: "Cancelled", pay: "Invoice sent" }), true);
  const src = readFileSync(new URL("../server/src/routes/payments.ts", import.meta.url), "utf8");
  const checkout = src.slice(src.indexOf('bookingPayPublic.post("/:token/checkout"'));
  assert.ok(checkout.indexOf('b.status === "Cancelled"') > -1 && checkout.indexOf('b.status === "Cancelled"') < checkout.indexOf("createOrReuseIntent"), "cancelled guard precedes intent creation");
  assert.ok(checkout.indexOf('b.pay === "Paid"') < checkout.indexOf("createOrReuseIntent"), "already-paid guard precedes intent creation");
  assert.ok(/amount = balanceOf\(b\)/.test(checkout), "amount comes from the booking balance");
  assert.ok(!/req\.body\.amount/.test(checkout), "checkout never reads an amount from the request");
});

test("pay link (route guard): confirm requires the payment to belong to THIS booking only", () => {
  const src = readFileSync(new URL("../server/src/routes/payments.ts", import.meta.url), "utf8");
  const confirm = src.slice(src.indexOf('bookingPayPublic.post("/:token/confirm/:paymentId"'));
  assert.ok(/rec\.tenantId !== b\.tenantId/.test(confirm) && /includes\(b\.ref\)/.test(confirm) && /length !== 1/.test(confirm));
});

// ── Invoice public pay link expiry ─────────────────────────────────────────
test("invoice link: expires 90 calendar days after the latest of dueDate/date/emailedAt/paidAt/createdAt", () => {
  const inv = { dueDate: "2026-01-10", date: "2026-01-01", emailedAt: "2026-02-01T10:00:00Z", paidAt: "2026-01-20T00:00:00Z", createdAt: "2025-12-01T00:00:00Z" };
  assert.equal(linkExpiresOn(inv, "2026-03-01"), "2026-05-02", "latest = emailedAt 1 Feb; +90 days");
});

test("invoice link: each field can be the latest one", () => {
  assert.equal(linkExpiresOn({ dueDate: "2026-06-01", date: "2026-01-01" }, "2026-01-01"), "2026-08-30");
  assert.equal(linkExpiresOn({ paidAt: "2026-06-01T09:00:00Z", dueDate: "2026-01-01" }, "2026-01-01"), "2026-08-30");
  assert.equal(linkExpiresOn({ createdAt: "2026-06-01T09:00:00Z", date: "2026-01-01" }, "2026-01-01"), "2026-08-30");
});

test("invoice link: re-sending (a later emailedAt) re-opens an expired link", () => {
  const old = { dueDate: "2026-01-10" };
  assert.equal(linkExpired(old, "2026-06-01"), true);
  assert.equal(linkExpired({ ...old, emailedAt: "2026-05-30T08:00:00Z" }, "2026-06-01"), false);
});

test("invoice link: boundary - last valid day is expiresOn itself; the day after is expired", () => {
  const inv = { dueDate: "2026-01-01" };
  const on = linkExpiresOn(inv, "2026-01-01");
  assert.equal(on, "2026-04-01");
  assert.equal(linkExpired(inv, on), false);
  assert.equal(linkExpired(inv, "2026-04-02"), true);
});

test("invoice link: junk date values are ignored; with no dates it counts from today", () => {
  assert.equal(linkExpiresOn({ dueDate: "soon", date: 20260101, emailedAt: null }, "2026-01-01"), "2026-04-01");
  assert.equal(linkExpired({}, "2026-01-01"), false, "an invoice with no dates is not instantly expired");
});

test("invoice link: 90 days is calendar arithmetic across the October clock change (no off-by-one)", () => {
  assert.equal(linkExpiresOn({ dueDate: "2026-07-27" }, "2026-07-27"), "2026-10-25");
  assert.equal(linkExpiresOn({ dueDate: "2026-07-28" }, "2026-07-28"), "2026-10-26");
});

// ── safeUrl ────────────────────────────────────────────────────────────────
test("safeUrl: blank, http(s) and our own /api/images/ uploads are allowed", () => {
  for (const ok of ["", "https://example.com/r.pdf", "http://example.com", "HTTPS://EXAMPLE.COM", "/api/images/abc123"]) assert.equal(isBlankOrWebUrl(ok), true, ok);
});

test("safeUrl: javascript:, data:, vbscript:, file: and other schemes are rejected", () => {
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox", "file:///etc/passwd", "ftp://x.com/a", "blob:https://x.com/1", "mailto:a@b.c", "tel:123"]) {
    assert.equal(isBlankOrWebUrl(bad), false, bad);
  }
});

test("safeUrl: scheme-smuggling and schemeless/relative values are rejected", () => {
  for (const bad of ["//evil.com/x", "evil.com", "www.evil.com", "/other/path", "api/images/x", " javascript:alert(1)", "java\nscript:alert(1)", "https:/", "https://", "   "]) {
    assert.equal(isBlankOrWebUrl(bad), false, JSON.stringify(bad));
  }
});

// ── embed.js (run in a vm with a fake DOM) ─────────────────────────────────
function runEmbed(src: string, attrs: Record<string, string> = {}, mounts: Array<Record<string, string>> = []) {
  const frames: Array<{ src?: string }> = [];
  const mk = (tag: string): any => {
    const el: any = { tag, style: {}, children: [], attrs: {} as Record<string, string>, listeners: {} as Record<string, Function>,
      setAttribute(k: string, v: string) { this.attrs[k] = v; }, getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k: string) { return k in this.attrs; },
      appendChild(c: any) { this.children.push(c); return c; }, addEventListener(t: string, f: Function) { this.listeners[t] = f; }, remove() {}, insertBefore(n: any) { this.children.push(n); },
      nextSibling: null };
    if (tag === "iframe") frames.push(el);
    return el;
  };
  const parent = mk("div");
  const script = mk("script");
  script.src = src;
  script.parentNode = parent;
  Object.assign(script.attrs, attrs);
  const mountEls = mounts.map((m) => { const e = mk("div"); Object.assign(e.attrs, m); return e; });
  const body = mk("body");
  const document: any = {
    currentScript: script, body, createElement: mk, addEventListener() {}, removeEventListener() {},
    querySelectorAll: () => mountEls.filter((e) => !("data-activityos-mounted" in e.attrs)),
    querySelector: () => script,
  };
  const win: any = { addEventListener() {} };
  const ctx = vm.createContext({ document, window: win, URL, MutationObserver: class { observe() {} }, encodeURIComponent });
  vm.runInContext(readFileSync(new URL("../public/embed.js", import.meta.url), "utf8"), ctx);
  const clickAll = () => {
    const buttons: any[] = [];
    const walk = (n: any) => { if (n.tag === "button" && n.listeners.click) buttons.push(n); (n.children ?? []).forEach(walk); };
    walk(parent); mountEls.forEach(walk);
    return buttons;
  };
  return { frames, parent, mountEls, body, clickAll, win };
}

test("BE-005: embed.js with data-listing renders a 'Book now' button; clicking opens /book/<id>?embed=1 on the script's own origin", () => {
  const r = runEmbed("https://app.activityos.test/embed.js", { "data-listing": "L1" });
  const [btn] = r.clickAll();
  assert.equal(btn.textContent, "Book now");
  btn.listeners.click();
  assert.equal(r.frames.length, 1);
  assert.equal(r.frames[0].src, "https://app.activityos.test/book/L1?embed=1");
});

test("BE-007: data-store embed opens /store/<tenant>?embed=1 and defaults the label", () => {
  const r = runEmbed("https://app.activityos.test/embed.js", { "data-store": "T9" });
  const [btn] = r.clickAll();
  assert.equal(btn.textContent, "Book activities");
  btn.listeners.click();
  assert.equal(r.frames[0].src, "https://app.activityos.test/store/T9?embed=1");
});

test("BE-006: mount element <div data-activityos-book> renders a button and is marked mounted (never twice)", () => {
  const r = runEmbed("https://app.activityos.test/embed.js", {}, [{ "data-activityos-book": "L2", "data-label": "Reserve", "data-color": "#ff0000" }]);
  const [btn] = r.clickAll();
  assert.equal(btn.textContent, "Reserve");
  assert.match(btn.style.cssText, /background:#ff0000/);
  assert.equal(r.mountEls[0].attrs["data-activityos-mounted"], "1");
  r.win.ActivityOSEmbed.scan();
  assert.equal(r.mountEls[0].children.length, 1, "a second scan does not mount again");
});

test("BE-008: data-mode=inline embeds the page frame immediately (no button)", () => {
  const r = runEmbed("https://app.activityos.test/embed.js", { "data-listing": "L3", "data-mode": "inline" });
  assert.equal(r.frames.length, 1);
  assert.equal(r.frames[0].src, "https://app.activityos.test/book/L3?embed=1");
  assert.equal(r.clickAll().length, 0);
});

test("embed.js: listing ids are URL-encoded so an id cannot inject path or query", () => {
  const r = runEmbed("https://app.activityos.test/embed.js", { "data-listing": "x/../admin?evil=1#" });
  r.clickAll()[0].listeners.click();
  assert.equal(r.frames[0].src, "https://app.activityos.test/book/x%2F..%2Fadmin%3Fevil%3D1%23?embed=1");
});

test("embed.js: the frame origin comes from the script's src (dev vs prod), never from page data; unknown mode falls back to button", () => {
  const r = runEmbed("http://localhost:3000/embed.js", { "data-listing": "L4", "data-mode": "weird" });
  assert.equal(r.frames.length, 0, "unknown mode = button");
  r.clickAll()[0].listeners.click();
  assert.ok(r.frames[0].src!.startsWith("http://localhost:3000/book/"));
});

test("embed.js: the height message listener only trusts the ActivityOS origin and its own frame", () => {
  const src = readFileSync(new URL("../public/embed.js", import.meta.url), "utf8");
  assert.ok(/e\.origin !== origin/.test(src) && /e\.source === frame\.contentWindow/.test(src));
  assert.ok(!/postMessage\([^)]*"\*"/.test(src), "embed.js never posts with a wildcard target origin");
});
