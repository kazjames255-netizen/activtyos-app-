# Mass bookings test, 8 Oct 2026 (fork F)

Plain summary. Own test stack only (web 3016, API 4016), throwaway accounts, nothing pushed.

## What was set up
- One test provider (a company) with 9 live listings: one-off session, 5-day camp, 6-week term, pass club (3/5/10-day passes), camp with add-ons (T-shirt once, hot lunch per day), sibling discount (10%), multi-day discount (15% for 3+ days), online tutoring, home visit. One discount code (£5 off) tied to the 5-day camp.
- Two test parents, each with a 6-year-old and a 9-year-old.
- 24 bookings made (bank transfer and cash; one child and two siblings; code used; add-ons; multi-week). Two done through the real checkout screens in the browser. Then: payments recorded (full, part, cash), three cancellations (bank unpaid, cash unpaid, bank paid with refund), code used a second time.
- Card payment was not tested (Stripe card test not part of this run). Tax-Free Childcare and vouchers not tested.

## Numbers that matched (everywhere I looked)
Listing price, basket total on the checkout screen, the amount the server stored, the parent's My bookings card, the provider's Bookings card, Reconciliation, Finance (booked and owed), Dashboard outstanding, the provider bell, the provider email and the register. Example: total booked was £2,110.00 and every screen said £2,110.00 owed; after paying £286 and cancelling £44 of unpaid bookings every screen said £1,780.00. Discounts were right: sibling 10% on two children (£40 to £36), multi-day 15% (£150 to £127.50), code £5 off the whole basket (£300 to £295), add-ons (£172.50 and £93.00). Seats per day matched between bookings, the public listing page and the dashboard for all 9 listings (a cancelled booking freed its places; the register dropped the cancelled child).
The code could not be used a second time by the same family (message: "You've already used this code").

## Numbers that did NOT match
1. **Confirmation email for a bank-transfer booking over several weeks showed only the first week.** A 6-week term costing £84 told the parent "Amount £14.00, Total £14.00, one date". Same for a 4-week club (£70 shown as £17.50) and a 4-session course (£90 shown as £22.50). The parent would have paid a sixth of the price. The checkout "done" screen was right (£84 and all six references); only the email was wrong. **Fixed** (commit 44ed7458): the email now says the total, every date and every reference, the same as the done screen.
2. **A cancelled booking with nothing paid still had an "Approve refund" button** on the provider's Bookings list while the same card said "Cancelled - nothing owed". It also counted in the Refunds tab. **Fixed** for new cancellations (commit 402d5bc2): the cancellation now records "no refund". Bookings cancelled earlier keep the old record.

## Odd wording / small things (not changed, your call)
- Provider bell for any parent cancellation says "Cancel request" even when the booking is already cancelled and there is nothing to approve ("Cancel request · QAF-10367 / Cash · No refund"). The bell wording is written into the Setup knowledge text as intended, so I left it.
- A multi-week booking is stored as one booking per week. Finance "Who owes you" and Reconciliation list a £84 term as six £14 lines; My bookings shows six cards each with its own bank box asking for £14. The done screen and (now) the email say "pay £84 quoting all six references". Three different pictures of the same payment. Worth deciding how a family should really pay a term.
- The provider's new-booking email for a multi-week bank booking says "look for the reference QAF-10361" (first one only) and not all six.
- Checkout done screen label "Starts" is followed by the whole list of dates for a term ("Starts: Wed 4 Nov, Wed 11 Nov ... Wed 9 Dec"). "Dates" would be the right word.
- Booking record shows the sibling discount as "Multi-person discount: Sibling discount" (checkout, email, done screen). Fine, just wordy.
- Several of my listings show the label "HOLIDAY CAMP" (including home visit and online tutoring) because I did not set a category.
- Reconciliation page intro says it is for "vouchers, Tax-Free Childcare, cash and manual card payments" and does not mention bank transfer, though bank transfers are the biggest group on it.
- Booking reference numbers skip (a 2-child booking uses two numbers, e.g. QAF-10335 then QAF-10337). Harmless.
- A new listing with no photo shows a big plain blue block at the top on this branch (the newer main branch already makes it a thin strip).
- Registers screen only shows the next few days, so nothing could be checked there by screen for bookings weeks away; the register data itself (API) was correct.
- Emails show "Name TBC" as the brand everywhere (expected until the rename).

## Visual checks (1440 and 390 wide)
Parent My bookings, provider Bookings, Finance, Reconciliation, Registers, public listing pages, checkout steps and done screens. No overlapping or cut-off text. On the phone width the bottom tab bar covers the bottom of a full-page screenshot (normal). Screenshots are in `docs/qa-overnight/mass-bookings-shots/`.

## What needs Kaz
- Decide how a multi-week bank-transfer booking should be paid (one transfer for the total, or one per week) and make Finance, Reconciliation, My bookings and the emails all say the same thing.
- Decide whether "Cancel request" should be reworded when nothing needs approving.
- Card payments, Tax-Free Childcare and vouchers were not covered.

## Commits (local, not pushed)
- 44ed7458 bank-transfer confirmation email shows full total, dates and references
- 402d5bc2 cancelling an unpaid booking records "no refund"
- Test scripts are in `e2e/review/mb-*.ts` (run against the 4016 stack only).
