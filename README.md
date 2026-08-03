# ActivityOS

Booking / CRM / ops platform for activity providers. Next.js frontend
(App Router, `/[portal]/[view]` routes) + Express API (`server/`) backed by
Firebase (Firestore + Auth).

## Architecture

```
Next.js (:3000)                    Express (server/, :4000)         Firebase
  /freelancer/bookings  ──fetch──▶  /api/bookings?portal=fl ──────▶ Firestore
  Authorization: Bearer <idToken>   verifyIdToken middleware
  /login (Firebase client SDK) ◀──────────────────────────────────▶ Firebase Auth
```

- Views migrated to React are registered in `lib/view-registry.tsx`; everything
  else still renders through the legacy prototype via an iframe bridge
  (`components/shell/LegacyViewFrame.tsx`).
- Booking business rules live in `features/bookings/mutations.ts` and are
  shared by the client store and the API, so they can't drift.

## First-time setup

### 1. Firebase console (one-off)

1. **Service account key** (for the API): Project settings → Service accounts →
   *Generate new private key* → save as `server/serviceAccountKey.json`
   (gitignored).
2. **Web app config** (for sign-in): Project settings → General → Your apps →
   *Add app* → Web. Copy the config values.
3. **Enable Email/Password sign-in**: Authentication → Sign-in method →
   Email/Password → Enable.
4. **Accounts**: everyone self-registers at `/signup`, choosing
   *Parent* or *Activity provider* — no console step needed.

### 2. Local env files

```bash
cp .env.local.example .env.local        # fill in NEXT_PUBLIC_FIREBASE_* values
cp server/.env.example server/.env      # defaults are fine for local dev
```

### 3. Install & seed

```bash
npm install
npm --prefix server install
npm run seed          # seeds Firestore: bookings, listings, customers
```

### 4. Run

```bash
npm run dev:all       # web on :3000 + api on :4000
```

Open [http://localhost:3000](http://localhost:3000), sign in with the user you
created, and go to **Freelancer → Bookings** — that view reads and writes
Firestore through the API. (`npm run seed -- --force` wipes and reseeds.)

## Multi-tenancy (the core security model)

Every provider is a **tenant** with fully isolated data. The API derives the
caller's scope from the signed-in account — clients never send a
tenant/portal parameter:

| Role | How you become it | Bookings scope | Write? |
| --- | --- | --- | --- |
| `platform` | set-role CLI | any tenant | read-only |
| `company` | signup → creates its tenant | whole tenant incl. franchises | yes |
| `freelancer` | signup → creates its tenant | whole tenant | yes |
| `franchise` | **invite link** from a company | own subset only | yes |
| `staff` | **invite link** from an operator | own tenant | read-only |
| `parent` | signup | none — own bookings via `/api/my/*` | own only |

- **Provisioning:** signing up as Freelancer or Company asks for the business
  name and creates the tenant on the spot. The account type locks after
  signup (`set-role` is the admin override:
  `npm --prefix server run set-role -- you@example.com company apf-demo`).
- **Invites:** company/franchise operators open **Team & invites** (the
  "Staff" nav item) to create franchise/staff invite links —
  `/signup?invite=<token>` joins that tenant. Email delivery comes later;
  copy the link manually.
- **Isolation test** (the product spec's required proof that provider A can
  never read provider B's data) — run against the emulators:

```bash
npm --prefix server run test:isolation
```

## The parent flow (Customer portal)

1. A parent creates an account at `/signup` (choosing *Parent*).
2. **Parent dashboard → Browse activities** (`/custdash/browse`) — every
   provider's listings (with provider names and prices); booking creates it
   as *Approval needed / Unpaid* in that provider's tenant (price resolved
   server-side).
3. **Parent dashboard → My bookings** (`/custdash/bookings`) — the family's
   bookings across providers; cancellation requests show *Refund pending*.
4. The provider sees the booking in their **Bookings** view: approves it,
   and approves/declines refund requests — the parent sees every change.

## Developing against the Firebase emulators (optional)

No real Firebase project needed:

```bash
firebase emulators:start --only auth,firestore --project demo-activityos
```

Then set `NEXT_PUBLIC_FIREBASE_EMULATOR=1` in `.env.local`, and in
`server/.env` uncomment the `FIRESTORE_EMULATOR_HOST` /
`FIREBASE_AUTH_EMULATOR_HOST` lines.

## Repo layout

| Path | What |
| --- | --- |
| `app/` | Next.js routes (`[portal]/[view]`, `/login`) |
| `components/` | Shell (sidebar/header/bridge), auth provider, shared UI |
| `features/` | Migrated feature views (bookings, timetable) |
| `lib/` | Nav config, view registry, Firebase client, API wrapper |
| `server/` | Express API (Firebase Admin, Firestore, seed script) |
| `public/legacy/` | The original single-file prototype (iframe bridge target) |

## Bootstrapping the Platform (HQ) super-admin

The platform role can never be chosen through the app (otherwise anyone
could make themselves super-admin). Instead, set the credentials in
`server/.env` (gitignored) and **the API creates the account automatically
on startup**:

```bash
# server/.env
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=temp-password   # temporary — they replace it on first login
```

That's it — start the server and sign in at `/login`. It's idempotent: an
existing admin's password is never overwritten by the env var, so the admin
can safely change it via **Forgot password?** on the login page. (A manual
`npm --prefix server run create-admin` also exists for one-off use.)

## Transactional email

Booking flows email the booker automatically: request received (parent
checkout), payment link (operator-taken bookings + the Resend action),
confirmed, declined, refund approved.

- **Development (default):** no setup — emails go to a throwaway
  [Ethereal](https://ethereal.email) inbox and the API log prints a preview
  URL for every send (`[mail] "…" → someone@… (preview: https://…)`).
- **Real delivery:** set `SMTP_HOST/PORT/USER/PASS` + `MAIL_FROM` in
  `server/.env` (any SMTP provider — Resend, Mailgun, Gmail app password…)
  and restart the API.

### Who mail comes from

`MAIL_FROM` is the one authenticated identity every send leaves under — but
the **display name and Reply-To are the provider's**, resolved per tenant in
`server/src/lib/sender.ts`:

- **From name** — Setup's trading name (`settings.providerName`), falling back
  to the tenant name. Families see "Sunshine Camps", not "ActivityOS".
- **Reply-To** — the tenant's `notifyEmail`, falling back to its account email.
  A reply reaches the provider instead of a no-reply box.

`GET /api/emails/sender` returns the resolved identity, and the Email composer
shows it above the audience picker.

**Per-tenant From addresses** (`sunshine-camps@…` instead of `no-reply@`) are
built but **off** — set `MAIL_PER_TENANT_FROM=1` to enable. Only turn it on
with an ESP that authenticates your domain: Gmail SMTP rewrites `From` to the
authenticated account, so the per-tenant local part would be discarded. See
`docs/email-sending-identity.md`. Two deliberate exceptions: new-message
alerts and team-audience notifications set the name but **no Reply-To** — that
header is reserved for §JJ's reply-by-email thread routing.

Per-provider sending *domains* (DKIM/SPF, `From: @theirdomain`) still come with
the white-label milestone, per the product doc — this is the interim that needs
no DNS setup from providers.
