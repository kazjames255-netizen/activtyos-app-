# HQ Support & messages inbox — backend handoff (for Amir)

**From:** Kaz · **Date:** 2026-07-25.

The HQ **Support & messages** inbox is built and shipped in the Platform (HQ)
portal (`features/platform/SupportInboxApp.tsx`, mapped to nav views `support`
**and** `messages`). It currently runs on a **localStorage demo store**
(`aos.support.threads.v1`) — swap it for the API below and it's done. The
**provider directory in the "New message" composer already reads live data** from
your `GET /api/platform/providers` (segmented Freelancer / Company / Franchise),
so only the threads + reported-bug intake are demo. Platform-role only.

## What it does
- One inbox for two audiences: **providers** (talk to them about their account)
  and **a provider's customers** (help a parent who hit a bug on that provider's
  storefront). Every thread carries the tier (Freelancer/Company/Franchise) and,
  for a customer, the linked provider.
- **Reported bugs land here** with the details the reporter pulled over — channel
  (in-app report vs inbound email), page, severity, device, repro steps — shown in
  a "Reported details" card above the conversation.
- Filters: All / Freelancer / Company / Franchise / Customers / 🐞 Bugs / Resolved.
  Reply, mark resolved / reopen, start a new message to any provider (picked by
  tier) or customer.

## Data model
```
supportThreads/{id}
  party: "provider" | "customer"
  name, email                       // the person/business on the other side
  tier: "freelancer"|"company"|"franchise"   // provider's tier, or linked provider's
  providerId?, providerName         // provider themselves, or the customer's provider
  subject
  kind: "message" | "bug"
  report?: { channel, page, severity:"low"|"medium"|"high", device, steps }  // bug only
  status: "open" | "resolved"
  unreadByHq: boolean
  createdAt, updatedAt

supportThreads/{id}/messages/{mid}  (UI treats them embedded)
  from: "hq" | "them"
  body
  at
```

## Endpoints (platform-role only)
- `GET  /api/platform/support` → all threads (with messages).
- `POST /api/platform/support` → create a thread `{party, providerId, name, email, subject, body}` (HQ-initiated). Server resolves tier/providerName from the tenant.
- `POST /api/platform/support/:id/messages` → append `{body}` from HQ; stamp `at`, bump `updatedAt`, set `status:"open"`.
- `PUT  /api/platform/support/:id` → `{status}` (resolve / reopen), clear `unreadByHq` on read.
- (nice) realtime: add `supportThreads` to the platform listener so the inbox is live.

## The intake that feeds it (the "pull over reported bug" bit — needs building)
1. **In-app bug report** — a small "Report a bug" affordance in the operator +
   customer shells that POSTs `{page, steps, device (UA), severity}` and opens a
   `bug`-kind thread. The client already knows the current route/UA — capture them
   automatically so the `report` block is populated without the user typing them.
2. **Inbound email** — pipe your support mailbox in as `channel:"Inbound email"`
   threads (party inferred from the sender's email against tenants/customers).
3. **Customer ↔ provider link** — when a customer opens a bug from a provider's
   storefront, stamp `providerId` so HQ sees "via {provider}".

## Front-end swap
Replace the localStorage store in `SupportInboxApp.tsx` (`loadThreads`/`saveThreads`
/`SEED`) with `useRealtime(["supportThreads"], …)` + the api helpers. The `Thread`
/ `Msg` / `Report` types already match this model 1:1. Keep the composer's
`GET /api/platform/providers` call as-is — that part's already live.
