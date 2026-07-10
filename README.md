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
4. **Create a user**: Authentication → Users → *Add user* (email + password) —
   this is what you'll sign in with.

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
