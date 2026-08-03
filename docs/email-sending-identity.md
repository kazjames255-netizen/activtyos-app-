# Who provider email comes from — options & staged plan

**From:** Amir · **Date:** 3 August 2026
**Status:** decision needed (ESP choice is a client call — it's a recurring cost)

Answers the open item at `listings-backend-handoff.md` §JJ — *"Per-provider
from-address (white-label) — currently one `MAIL_FROM`"* — and the question
behind it: providers have their own professional email, so why doesn't their
mail come from it?

---

## 1. Where we are today (shipped, `dcd4884`)

Every send already carries the provider's identity as far as a shared address
allows:

```
From:     Sunshine Camps <no-reply@activityos.uk>   ← their NAME, our address
Reply-To: hello@sunshinecamps.co.uk                  ← their real mailbox
```

Resolved per tenant in `server/src/lib/sender.ts`:

- **From name** — `settings.providerName` → tenant name
- **Reply-To** — `notifyEmail` → `settings.billing.email` → `tenants.email` →
  owner's login email

Plus the provider's logo on family mail (`lib/brandLogo.ts`, Kaz).

**A parent replying already reaches the provider's real mailbox.** That is the
outcome people usually mean by "send from our own email" — what remains is
cosmetic by comparison.

### The one real consequence

Replies go to their mailbox and therefore **bypass ActivityOS entirely** — the
provider's in-app Email Inbox never sees them. See §5.

---

## 2. Why we can't just put their address in `From:`

The instinct is to store their address and use it. It breaks, and understanding
why decides the architecture:

- **SPF** authenticates the sending server against the envelope domain — ours,
  so it passes for *our* domain, not theirs.
- **DKIM** signs with our key.
- **DMARC** requires `From:` to align with a passing SPF **or** DKIM domain.

Mail claiming `From: bookings@sunshinecamps.co.uk` sent from our infrastructure
fails alignment. If that domain publishes `p=quarantine` or `p=reject` it goes
to spam or is rejected outright — and since Gmail/Yahoo's 2024 bulk-sender
rules, unaligned mail is treated harshly regardless of policy. We would be
making deliverability **worse** than today, and it would fail unpredictably per
provider.

> **Per-provider sending needs either their DNS or their mailbox. There is no
> third option.**

### Second blocker: our current transport

`server/.env` sends through **Gmail SMTP**. Gmail rewrites `From:` to the
authenticated account, so per-tenant addresses are impossible on it *regardless*
of DNS. Gmail also caps ~500 recipients/day against our `MAX_RECIPIENTS` of
2000 per send, and every provider's mail currently goes out as a personal
address.

---

## 3. The options

| | Setup burden | `From:` shows | Deliverability | Verdict |
|---|---|---|---|---|
| **A. Today** — our address, their name + Reply-To | none | `Sunshine Camps <…@activityos.uk>` | ours, controlled | shipped |
| **B. Single-sender verification** — they click a link | one click | their address | **breaks under DMARC** | avoid |
| **C. Domain authentication** — they add DNS records | ~4 DNS records | `anything@theirdomain` | full alignment | the real white-label |
| **D. Connect their mailbox** — Google/Microsoft OAuth | OAuth consent | their address | perfect | transactional only |

**B** is the tempting trap: no DNS, looks right, silently lands in spam for any
provider with real email hygiene. Fine only for a bare domain with no DMARC
record — i.e. unpredictable. Not a destination.

**C** is what §JJ means. Every serious ESP (Resend, Postmark, SendGrid,
Mailgun, SES) supports many authenticated domains per account.

**D** matches the literal ask ("use my professional email"). Mail lands in their
own Sent folder and alignment is perfect. But: Google treats `gmail.send` as a
restricted scope needing app verification (possibly a third-party security
assessment); per-mailbox caps (~500/day consumer, 2000 Workspace); and bulk
marketing through Gmail is against policy. **Viable for transactional, not for
campaigns.**

---

## 4. Recommendation — a hybrid, because campaigns and transactional mail have opposite needs

**Bulk campaigns stay on the platform domain, permanently.** We control the
reputation, the unsubscribe footer and the PECR consent split already built. It
also protects a provider's own domain from being burned by one bad blast.

**Transactional mail (confirmations, invoices, payment received) uses C** for
providers who opt in, falling back to A for everyone else.

### Staged

- **Step 0 — move off personal Gmail onto an ESP on an ActivityOS domain.**
  Independent of white-label and the actual blocker: it fixes the 500/day cap,
  stops every provider's mail carrying a personal address, and is the
  prerequisite for everything below. **Do this first — costed in §7.**
- **Step 1 — per-tenant local part** (§6). Cheap, no provider setup, and it
  unlocks inbound reply routing.
- **Step 2 — opt-in domain authentication** (option C) for providers who ask.
- **Step 3 — option D** only if providers specifically demand mail appear in
  their own Sent folder.

The hard part of C is not the code — it's support. Children's-activity
providers editing DNS records will generate real support load. That argues for
keeping A as the default and C as opt-in, never mandatory.

---

## 5. Replies: mailbox vs platform inbox

| `Reply-To` | Reply lands in | In-app Inbox sees it |
|---|---|---|
| Their real mailbox (**today**) | their mailbox only | no |
| A platform inbound address | platform → forwarded on | yes |

The second needs an inbound-parse provider wired to the existing
`POST /api/emails/inbound` webhook — `PROD-READINESS.md` records that as not
connected, which is why the Email Inbox stays empty.

### Mailbox redirect — BUILT, waiting on an inbound domain

Kaz's ask ("if they get a new email in Outlook they should see it on the
platform") is answered by **redirect**, not mailbox sync. Each tenant gets
`<slug>@<INBOUND_EMAIL_DOMAIN>`; the provider adds one redirect rule and their
incoming mail appears in the in-app Inbox.

- `GET /api/emails/mailbox` → address, whether anything has arrived, and any
  pending Gmail confirmation. Reports `configured:false` until the platform has
  an inbound domain, and the setup panel renders nothing rather than handing
  out an address that swallows mail.
- The Email Inbox shows the address, a copy button and per-provider steps.
- **Gmail's confirmation code is surfaced.** Google emails it to the
  destination — a mailbox the provider cannot open — so without this every
  Gmail provider dead-ends. The inbound handler detects that mail, extracts the
  code and link, and the panel displays them.

**Two limits to state plainly to providers:**

1. **Sent mail is NOT captured.** Redirect rules act on incoming mail only.
   Mail a provider sends from Outlook never passes an inbound rule. Capturing
   it needs IMAP/Graph sync (§7a) or an admin-level BCC rule on their tenant.
   Replies sent *from ActivityOS* are already recorded, so redirect plus
   in-app replies gives complete threads — the gap is only replies they send
   from their own mailbox.
2. **Provider coverage.** Outlook has true *redirect* (keeps the parent as
   sender); Gmail has forwarding (preserves `From`, needs the code above);
   most hosts have forwarders; **Yahoo historically requires a paid plan**.

**Remaining to go live:** an inbound-parse provider (Postmark/Mailgun/SES
inbound) with MX records on a dedicated subdomain, then set
`INBOUND_EMAIL_DOMAIN`. Same ESP decision as §8.

### §7a — why not IMAP/Graph sync

Full sync was considered and deferred. IMAP no longer avoids OAuth (Microsoft
has disabled basic auth for IMAP on Exchange Online, and Gmail steers to
XOAUTH2), so it costs the same consent work while adding IMAP IDLE's
persistent connection per mailbox, hard incremental-sync state, and full
mailbox credentials instead of scoped tokens. If sync is ever funded, Graph
(push subscriptions + delta queries) beats IMAP for Outlook, with IMAP kept as
the fallback for custom-domain hosts. It also multiplies the data-protection
exposure — a full mirror of a provider's mailbox is parents' and children's
personal data under our control.

It is also what §JJ reserves `reply+<threadId>@inbound.…` for. **New-message
emails deliberately leave `Reply-To` unset** so that header stays free for it.

---

## 6. Step 1 — per-tenant local part (BUILT, off by default)

Since the domain stays ours, DMARC is satisfied either way:

```
From: Sunshine Camps <sunshine-camps@activityos.uk>
```

Reads as the provider rather than a robot, and gives each tenant a distinct
address the inbound router can match on — `routes/emails.ts:429` already
resolves a tenant from the `To:` address.

### How to turn it on

Set `MAIL_PER_TENANT_FROM=1` in `server/.env` and restart the API. **Only do
this on an ESP with domain authentication** — on Gmail SMTP the slug is
silently discarded (§2), which is why it ships off.

### What it does

- `Sender` gained an optional `address`; `mailer.ts` uses `sender.address ??
  fromAddress`. The **domain is always ours** — only the local part varies, so
  DKIM/SPF/DMARC are unaffected.
- `sender.ts` slugifies the provider name and **persists it on the tenant doc
  once** (`sendingSlug`), reusing it forever — a From address that drifts hurts
  recognition and breaks inbound matching.
- Collisions and reserved names (`no-reply`, `support`, `billing`, `abuse`, …)
  get a short `tenantId`-derived suffix, so no tenant can send as a platform
  address whatever they call their business.
- **Inbound matching extends to `sendingSlug`** (`routes/emails.ts`), so a reply
  to the address we sent as routes to the right tenant. Unknown local parts
  still 404 rather than landing in someone else's inbox.
- `GET /api/emails/sender` reports the effective address, so the composer's
  "Sending as …" line updates itself.

Verified end-to-end by flipping the flag against the dev stack: two tenants
resolved to distinct stable slugs, a reply addressed to one routed to that
tenant, an unknown local part 404'd, and turning the flag back off returned
every send to the platform address (the persisted slug is simply ignored).

---

## 7. Step 0 in practice — stop showing a personal Gmail

Today every provider's mail leaves as `amirmoumen@gmail.com`. Two separate
problems get bundled together here, and only the first is cheap:

| | Fixable how | Cost |
|---|---|---|
| **Stop showing a personal Gmail** | our domain + an ESP | ~£10–15/yr + £0–20/mo |
| **Show the provider's own address** | *their* DNS records, per provider | support time, §3 option C |

### It is less exposed than it looks — but still worth fixing

A parent's inbox list shows the **display name** ("Sunshine Camps"); the
address only appears if they expand the message or hit Reply. Most never see
it. But on a booking confirmation for someone's child, a personal Gmail
address reads as suspicious when they do.

### What Step 0 takes

1. **A domain** for the platform (~£10–15/yr). **We don't own one yet** —
   `WEB_URL`/`API_URL` are still `localhost` everywhere.
2. **An ESP** — Resend's free tier covers roughly 3k emails/month; Postmark and
   SES are the other sane picks. *Verify current pricing before quoting.*
3. **DNS once, on OUR domain** — SPF, DKIM, DMARC. Providers do nothing.
4. **`server/.env`** — swap `SMTP_*` and `MAIL_FROM`. That is the entire code
   change; `lib/mailer.ts` is already provider-agnostic SMTP.

Also fixes the ~500 recipients/day Gmail cap against `MAX_RECIPIENTS` of 2000.

### Then turn on §6 and you have ~90% of the perceived outcome

```
From:     Sunshine Camps <sunshine-camps@activityos.uk>
Reply-To: hello@sunshinecamps.co.uk
```

Provider's name as the sender, their name in the address, replies to their real
mailbox, **nothing of ours visible**. A parent would have to look closely to
notice the domain isn't the provider's. The remaining 10% —
`From: hello@sunshinecamps.co.uk` — is option C and needs that provider's DNS.

### The shortcut to refuse

Gmail's "Send mail as" aliases technically allow sending as another address
over SMTP. Avoid: each provider must click a verification link sent to their
own mailbox, it caps around 99 aliases, DMARC still fails for their domain, and
it routes every provider's mail through one personal Google account. It is a
worse version of Step 0 with permanent manual work.

---

## 7b. The domain question is SETTLED

`activityos.uk` is already ours — registered 26 Jun 2026 at **Namecheap**
(expires 26 Jun 2027), apex on Vercel, and referenced in code since 25 Jul as
the public pricing page. Nothing to buy.

Two things that follow from how it's already configured:

- **The root domain already has mailboxes** (Namecheap Private Email,
  `mx1.privateemail.com`). Do NOT repoint the apex MX at an email service —
  that would break whatever mail already runs there. Inbound goes on a
  **subdomain**, `inbound.activityos.uk`, with its own MX. This is exactly why
  `INBOUND_EMAIL_DOMAIN` is a separate setting from the sending domain.
- **SPF must be merged, not added.** Adding a second SPF record to a domain
  that already has one is a misconfiguration that breaks authentication for
  both. One record, listing both senders.

DNS access is on Kaz's Namecheap account. Also worth confirming auto-renew is
on: if it lapses, the site, every booking link and all platform mail stop at
once.

---

## 8. Decisions needed

1. **Buy a platform domain + pick an ESP (§7).** The only urgent one — until
   this lands, every provider's mail shows a personal Gmail address and is
   capped at ~500 recipients/day. Recurring cost, so it's a client call.
2. **Is per-provider from-address in the current milestone, or still deferred?**
   §JJ tags it white-label; this memo assumes deferred until told otherwise.
3. **Which ESP?** Resend / Postmark / SendGrid / SES. All support multi-domain
   auth; Postmark and Resend have the least painful domain-verification UX,
   which matters given §4's support point.
4. **Should replies also land in the platform Inbox (§5)?** Not free: it puts
   our infrastructure in the path of a parent's reply, so a webhook or
   forwarding failure loses a message that today would simply have arrived.
   Today's mailbox-only routing cannot fail that way. Recommend keeping
   mailbox-only as the default and making platform-capture opt-in.
5. **Does the Build Manual (product spec "item 9") pin a model?** That document
   is **not in this repo** — `mailer.ts:3` only references it. It should be read
   before we commit, in case it specifies something narrower.
