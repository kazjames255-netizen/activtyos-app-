# Settings & features — new tabs (front-end done) + backend spec (Amir)

> **STATUS — enforced 30 Jul 2026 (Amir).** `staff.requireDBS` /
> `requireCompliance` now block rostering on POST/PUT `/api/shifts` (409 with
> the reason; only once the certifications register has entries, so a tenant
> not tracking compliance is never locked out). `staff.assignByLeads` stops
> the staff role changing ratio-board group cover; `staff.inviteMessage`
> rides on staff invite emails; `staff.defaultRatioTarget` is returned as
> `target` by `GET /api/ratios` (front-end can seed the board from it).
> `meals.ordering` off → 403 on `POST /api/meal-orders`; `orderCutoffHours`
> is enforced against the day's first session start (409 past cut-off).
> **Deferred:** the Learning observations store (no UI consumes it yet —
> build it when the observations screen lands) and tinting customer pages
> with `brandColor` (front-end follow-up).

Added five tabs to the operator **Settings & features** screen
(`features/setup/SetupApp.tsx`), matching the Build Manual, in the standard
title-tab/colouring style. All persist through the existing settings store
(`/api/library` → `settings.*`), so **no new save endpoint is needed** — but a few
carry policy the backend must ENFORCE.

## Tabs added
- **Company setup** — display name (`providerName` + `providerNameMode`) and business
  details (`billing.businessName/email/phone/address/vatNumber/companyReg`). Same
  keys as the Money tab (single source of truth). No backend needed.
- **Branding** — logo (`billing.logoUrl`) and `brandColor` (accent hex for
  customer-facing pages). Front-end should tint customer pages with `brandColor`
  (follow-up UI task); no backend needed to store it.
- **Staff & workforce** (`settings.staff`) — **needs backend enforcement**:
  - `assignByLeads` — gate the "assign staff to group" action to leads/managers.
  - `requireDBS` — block rostering a staff member without a valid DBS on file.
  - `requireCompliance` — block if key certificates (first aid, safeguarding) are out of date.
  - `defaultRatioTarget` — seed the Ratios board target.
  - `inviteMessage` — include in staff invite emails.
- **Learning** (`settings.learning`) — `trackTraining` (records UI exists/planned),
  `observations` **needs backend** (a learning-observations store per child),
  `framework` (label only).
- **Meals** (`settings.meals`) — `ordering` (show/hide meal ordering for parents),
  `showAllergens`, `orderCutoffHours` (**enforce** the cut-off when accepting orders),
  `menuNote`. The Meals feature should read these.

## Settings shape (already in `lib/settings.ts`, defaulted + merged)
```
brandColor: string
staff: { assignByLeads, requireDBS, requireCompliance, defaultRatioTarget, inviteMessage }
learning: { trackTraining, observations, framework }
meals: { ordering, showAllergens, orderCutoffHours, menuNote }
```

## Gap analysis note
The Settings screen already covered 17 tabs (Features, Child questions, Medication,
Safeguarding, Register, Trips, Calendar, Inventory, Age groups, Cancellations,
Defaults, Payments, Money, Vouchers, Marketplace, Refer, Notifications). These five
are the manual's remaining named areas. Anything still missing vs the manual is a
follow-up once these are reviewed.
