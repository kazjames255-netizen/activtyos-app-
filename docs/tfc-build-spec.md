# Tax-Free Childcare (TFC) — build spec

**Status:** draft for review · written 2026-09-09
**Sources:** two screen recordings of the 10:14–10:36 call with Iryna Bobechko
(`20260909_101408.mp4`, `20260909_102707.mp4`), read frame-by-frame.
Designs live in Figma: `figma.com/design/flkVApjk860zLaSaebcljd/Childcare` (node `96-24170`).

> **Two caveats on this document.**
> 1. **The recordings have no audio available to me.** Ten minutes of that call was
>    two people talking through decisions. Anything agreed verbally is *not* in here.
>    Treat every "open question" below as genuinely open.
> 2. The screens shown are **Eequ's** designs and **Eequ's** live platform (Kaz is a
>    Mentor on it). This spec re-states them as a build for *our* app. Where copy says
>    "Eequ" or "(setting name)", we substitute our provider/listing naming.

Today TFC in our app is a **selectable stub** — a payment method a parent can pick with
nothing behind it. This spec covers the two halves that make it real:

- **Part A — the parent's payment journey** (link HMRC → pay from the TFC balance)
- **Part B — the operator's reconciliation** (did the money actually arrive?)

Part B is the half that is easy to forget and the half that costs staff hours. TFC money
lands in the provider's bank account as a **bank transfer with a reference**, days after
the booking. Something has to tie that transfer back to the booking.

---

## Part A — Parent payment journey

Six steps. Steps 1–2 and 5–6 are our existing checkout; 3 and 4 are new.

### Step 2 · Select a ticket (existing, extended)
Per attendee, the parent picks the ticket. New: a **childcare scheme** selector and a
**scheme reference number** field, so a parent paying by voucher/TFC declares it here.

### Step 3 · Connect with HMRC (new)

Heading: **"Link your HMRC Tax-free Childcare account"**

- One row **per child**, each with a state: `ACCOUNT NOT LINKED` → linked (green tick).
  Observed row content: child name, **Date of birth** (`23/04/2020`), **Reference number**
  (`AAAA00000TFC` — 4 letters + 5 digits + `TFC`).
- Each unlinked row gets its own **`LOGIN WITH HMRC`** button.
- Explainer, collapsible — **"Why do I need to link my account?"**
  > "Connect your HMRC account through GOV.UK so we can match your payment to this
  > booking automatically."
- Reassurance line: **"Secure connection via GOV.UK"**
- Warning: **"Please ensure this provider is added to your account before you pay."**

**The GOV.UK hand-off** (HMRC's screens, not ours):
"Allow your software to connect with HMRC" — grants permission to *access Tax-Free
Childcare account details and process requests for payments to childcare providers*,
then a "What you will need" + sign-in step (surname, National Insurance number).

### Step 4 · Payment options (new)

Per attendee card — observed verbatim:

```
Amanda Bartholomew                        £30.00
(AAAA12345TFC)

HMRC Tax-free childcare amount
£ [30]
Current balance for this HMRC account is £33.00.

Split the payment with
( ) Card payment      ( ) Bank transfer
```

Three things this implies:
- The TFC amount is **editable**, so **partial payment** is a first-class case.
- We must **read and display the live TFC balance** for that child's account.
- The remainder is settled by **card or bank transfer** in the same checkout — so the
  order can have **two payment records against one booking**.

### Step 5 · Checkout questions (existing)
`ATTENDEE 1 OF 2`, name, DOB, **Allergies and health notes**, **Add 2nd emergency phone number**.

### Step 6 · Confirm & pay → **Booking successful** / **Payment successful**

### Returning parent
A separate flow exists for a **returning user adding one new child** — the linked children
stay linked; only the new child needs Step 3.

---

## Part A2 — Failure states

Four are designed, each as a red banner frame. **These are the substance of the design** —
TFC fails often, and the fallback is manual.

| State | Message |
|---|---|
| **Insufficient funds** | "…failed. Please check […] balance." |
| **Provider not added to booker's HMRC account** | "HMRC payment failed. *(setting name)* is not added to your HMRC account." |
| **HMRC connection failed** | "Please select 'Login with HMRC' to try again." |
| **HMRC connection expired** | (re-auth required) |

The shared recovery screen, verbatim:

> ### HMRC TAX-FREE CHILDCARE PAYMENT
> We couldn't process your HMRC payment. Please complete the payment directly in your
> HMRC account:
> 1. **Go to your HMRC account**, ensure you have sufficient balance and *(setting name)*
>    is added to your account as a childcare provider, then make the payment.
> 2. **Come back here** or go to your **Bookings** page to confirm that you have made the payment.

And a promise-to-pay confirmation: **"You are promising to pay £0.00 with your Childcare
Scheme account(s)."**

**The important consequence:** a booking can be **confirmed on a promise**, with the money
arriving later or never. That is precisely what Part B has to track.

---

## Part B — Operator reconciliation

Modelled on EEQu's live implementation (`eequ.org/analytics?section=childcare`).

### B1 · Settings — "Allow childcare payments"
- **Your setting**: setting name (e.g. APF ACTIVITY CAMPS), **registration number**, **postcode**
  — this is the provider identity a parent must add in their HMRC account.
- **Your childcare schemes** — a managed list, each row editable/removable. Observed:
  Compassionate Voucher Services · Care-4 · Fideliti · Kiddivouchers / Enjoy Benefits /
  Busy Bees · Edenred (formerly Accor) · Fusion (formerly Sodexo).
  **So this is not TFC-only** — TFC is one scheme among several voucher providers.

### B2 · Bookings — a new filter tab
Alongside All / Awaiting approval / Unpaid / Refund requested / Upcoming / Failed, add
**Unreconciled childcare**. Rows carry a warning icon where childcare money is outstanding.

### B3 · The reconciliation table — "Confirmed Childcare payments"

Observed columns, in order:

| Booking ID | Booking date | Learner name | Childcare scheme | Childcare reference | Childcare payment | Reconciled against bank statement |
|---|---|---|---|---|---|---|
| 2172915 | 07/07/2026 | Mubi Soni | HMRC Tax-Free Childcare | MSON94070TFC | £36 | ☐ |
| 6175771 | 21/07/2026 | Aysan Yacoob | HMRC Tax-Free Childcare | AYAC14387TFC | £224 | ☑ |
| 0842770 | 03/03/2025 | Layla Herber | HMRC Tax-Free Childcare | LHERB7808TFC | £29.70 | ☑ |
| 7851612 | 28/03/2025 | Caelan Murray | HMRC Tax-Free Childcare | **Caelan** | £3 | ☐ |

The last column is a **manual tick** — the operator matches the line to their bank
statement and ticks it off. That is the whole mechanism, and it is worth copying: it needs
no bank integration to be useful on day one.

> Note row 4: the reference is `Caelan`, not a valid TFC reference. **Parents type these
> by hand and get them wrong.** The design must tolerate a junk reference — never key
> matching solely on it.

### B4 · Childcare analytics
Four figures over a date range, plus a gross-bookings line chart:

- **Gross childcare bookings** — £17,321.74
- **Confirmed payments by Booker** — £40,521.84 / 956 bookers
- **Unconfirmed payments by Booker** — £8,207.10 / 128
- **Reconciled payments by Mentor** — £13,501.43 / 299
- **Unreconciled payments by Mentor** — £35,227.57 / 785

Note the split: *confirmed/unconfirmed* is the **parent's** promise; *reconciled/unreconciled*
is **our** bank match. Two different questions, and the gap between them (£35k unreconciled
on EEQu's own data) is the size of the problem.

---

## Data model (proposed)

- `settings.childcare` — `{ settingName, registrationNumber, postcode, schemes: string[] }`
- On a booking: `childcare: { scheme, reference, amount, promisedAt, confirmedAt, reconciledAt, reconciledBy }`
- Per child: `tfcLink: { linked, hmrcAccountRef, dob, linkedAt, expiresAt }`
- A booking may now hold **more than one payment record** (TFC + card/bank remainder).

## Backend work (Amir)

1. **HMRC OAuth via GOV.UK** — the Developer Hub app, consent scopes, token storage and
   **refresh** (the "connection expired" state is a token lifetime we must handle).
2. **Read TFC balance** per linked child (Step 4 needs it live).
3. **Submit a payment request** to HMRC, and handle each documented failure.
4. **Webhook/poll for settlement**, to move a payment from *promised* → *confirmed*.
5. Reconciliation storage + the tick action.

## Suggested phasing

- **P1 — reconciliation only, no HMRC integration.** Settings, the childcare fields on a
  booking, the Unreconciled tab, the tick-off table, the four analytics figures. This is
  entirely front-end + our own API, needs nothing from HMRC, and solves the expensive half.
- **P2 — the parent journey** with the real HMRC link and balance.
- **P3 — automatic matching** of bank transfers to bookings by reference.

## Open questions (would have been answered by the audio)

1. Are we building this, or was Iryna showing us **EEQu's roadmap** as a customer?
2. Is P1/P2/P3 phasing right, or is the parent journey the priority?
3. Do we support the **voucher schemes** (Edenred, Fideliti…) or TFC only?
4. Does a TFC "promise to pay" **confirm the booking immediately**, or hold the place
   pending payment? (Big operational difference.)
5. Who chases an unreconciled payment — automatic parent reminder, or operator's job?
