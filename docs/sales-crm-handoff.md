# Sales CRM / pipeline — backend handoff (for Amir)

**From:** Kaz · **Date:** 2026-07-25.

The Sales pipeline UI is built and shipped in the Platform (HQ) portal
(`features/platform/SalesApp.tsx`, nav view `sales`). It currently runs on a
**localStorage demo store** (`aos.sales.leads.v1`) so it works and demos — swap
that for the API below and the UI is done. Platform-role only. No rep logins yet
(owner is a free-text name for now; a `sales` role comes later).

## Data model
```
leads/{id}
  business, contactName, email, phone, location   // strings
  source: "cold_call"|"email"|"social"|"referral"|"event"|"inbound"
  owner: string            // rep name (later: rep uid)
  plan: "freelancer"|"company"|"franchise"
  estMrr: number           // potential £/mo
  stage: "new"|"contacted"|"interested"|"demo"|"trial"|"won"|"lost"
  lostReason?: string
  notes: string
  tenantId?: string        // set when the lead converts to a real signup
  createdAt, updatedAt     // ISO
  createdBy                // platform user

leads/{id}/activities/{aid}   (or embedded array — UI treats them embedded)
  type: "call"|"email"|"social"|"demo"|"note"
  note: string
  outcome?: string
  at: ISO
  by: string               // rep name
```
Stage → close-probability (used for the weighted forecast): new .05, contacted
.15, interested .35, demo .55, trial .80, won 1, lost 0.

## Endpoints (platform-role only)
- `GET  /api/platform/leads` → all leads (with activities).
- `POST /api/platform/leads` → create (validate the enums above).
- `PUT  /api/platform/leads/:id` → update fields / move stage.
- `DELETE /api/platform/leads/:id`.
- `POST /api/platform/leads/:id/activities` → append an activity `{type,note,outcome?}`; server stamps `at` + `by`, bumps lead `updatedAt`.
- (nice) realtime: add `leads` to the platform listener so the board updates live.

## Hooks worth wiring
- **Auto-convert on signup (Kaz wants this):** in `register-role`, after creating
  a tenant, look for an open lead matching the new signup by **email OR phone OR
  business name** (case-insensitive; normalise phone digits). If found, set
  `lead.tenantId`, move it to stage **`won`** ("New customer"), and stamp an
  auto activity ("Signed up 🎉"). So a rep's lead jumps to the last column the
  instant the provider signs up — no manual move. Ties the CRM straight to real MRR.
- **Rep logins (later):** a `sales` role that only sees its own `owner` leads;
  platform sees all. Then `owner`/`by` become uids.

## Front-end swap
Replace the localStorage store in `SalesApp.tsx` (`loadLeads`/`saveLeads`/`SEED`)
with `useRealtime(["leads"], …)` + the api helpers — the component shape (Lead /
Activity types) already matches this model 1:1.
