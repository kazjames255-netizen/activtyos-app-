<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ActivityOS — how to build a UI for a backend feature

ActivityOS is a multi-tenant platform for children's activity providers.
Two halves, two owners: the **backend** (Express + Firebase in `server/`) is
built by the backend developer; the **UI** (Next.js React views) is built on
top of it. If you're asked to "build the UI for feature X", follow this
playbook — everything you need is in the repo.

## Source of truth

1. **`server/openapi.yaml`** — THE API contract. Every feature is a tag in
   there (bookings, listings, blocks, my, invites, tenants…). Read the
   top-of-file description first: auth, tenancy/role rules, breaking-change
   notes. Live interactive version: `localhost:4000/docs`.
2. When the spec seems ambiguous, the truth is `server/src/routes/*.ts`.
3. Never bypass the API: the browser must not touch Firestore directly.
   All authorization is server-side; the UI just renders what the API
   returns and surfaces its errors.

## The standard view pattern (copy, don't invent)

Pick the closest existing reference and imitate it structurally:

| You're building | Copy the pattern of |
| --- | --- |
| Tenant-scoped CRUD (list + create/edit/delete) | `features/listings/ListingsApp.tsx` |
| Modal form with photo/choice fields | `features/parent/ChildrenApp.tsx` |
| Complex stateful flow with a zustand store | `features/bookings/` (store.ts + components) |
| Simple list + action buttons | `features/team/TeamApp.tsx` |
| Read-only dashboard/stats | `features/platform/OverviewApp.tsx` |

Non-negotiables shared by all views:
- HTTP via `lib/api.ts` (`get`/`post`/`api`) — it attaches the Firebase
  token and throws typed errors. Show `err.message` to the user.
- Live updates via `useRealtime([collections], refresh)` from
  `lib/realtime.ts` — every view refetches when its data changes server-side.
- UI primitives from `components/ui` (Button/Card/Input/Select/Badge/
  FieldLabel/SectionHead); status/pay badge colors from
  `features/bookings/helpers.ts` (`statusTone`, `payTone`, `money`).
- Dark theme via CSS variables (`var(--ink)`, `var(--surface)`,
  `var(--line)`, `var(--brand)`…) — never hardcode colors.
- Business logic lives server-side (prices, sessions, capacity, age
  derivation). If you're computing domain rules in the browser, stop.

## Wiring a view into the app

- Register the component in `lib/view-registry.tsx` under the portal(s) and
  view slug. Slugs come from `lib/nav/config.ts` (`NAV_GROUPS`) — the
  sidebar item usually already exists; registering replaces the legacy
  prototype iframe for that slug.
- Portals: `company`, `franchise`, `freelancer` (operators), `staff`,
  `custdash` (parents), `platform` (super-admin). One account = one portal
  (enforced by PortalGuard); roles and data scope are enforced by the API.

## Verifying your work

- `npm run dev:all` (web :3000, API :4000; web may fall back to :3001).
- `npm run e2e` — the Playwright UI suite (e2e/): auth + signup, a smoke test
  of EVERY nav view in all six portals, the full booking journey (blocks →
  wizard publish → parent books → live operator update), invites, messages,
  invoices. It provisions throwaway `@activityos-test.com` accounts on the
  live dev stack (reused across runs); `npm run e2e:cleanup` deletes them and
  everything they own. New views/flows should get a spec here.
- Create throwaway accounts at `/signup` (Freelancer/Company provision a
  tenant; Parent for the customer side; franchise/staff join via invite
  links from Team & invites).
- Test cross-account flows in two browser windows (e.g. parent books →
  operator sees it live).
- Playwright note: pages hold an open SSE connection — `networkidle` never
  fires; wait for `load` or specific elements instead.
- `npx tsc --noEmit` and `npm run build` must stay clean.
