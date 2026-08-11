# Roles & permissions — backend handoff (Phase 2)

**Front-end status (done, on `main`):** company Setup → "Roles & permissions" tab.
An editable None/View/Edit matrix of named roles × 20 areas. The model lives in
tenant settings today (no dedicated table yet):

- `lib/settings.ts` — `StaffRole { id, name, builtin?, owner?, caps: Record<capKey, "none"|"view"|"edit"> }`,
  `ROLE_CAPS` (the 20 area keys, grouped, `sensitive` flag), `DEFAULT_ROLES`
  (Owner=full/locked, Manager, Site-Camp Lead, Coach-Staff), `TenantSettings.roles?`.
- Editor: `features/setup/RolesPermissions.tsx`. Saves via the normal settings PUT.

The editor is **configuration only**. Nothing is enforced yet, and no user has a role.
That's Phase 2 — all backend / security-critical.

## What's owed (Amir)

### 1. Persist roles properly + assign on invite
- Roles can stay on `settings.roles` (simplest) OR move to `roles(id, tenant_id, name, builtin, caps_json)`
  — your call; the front-end just needs them readable/writable where they are now.
- `invites`: add **`role_id`**. The invite form will pass it (front-end change pending your API).
- On activation, stamp the new user with that `role_id`. Existing users default to Owner/Admin.
- `users`: add **`role_id`** (nullable → treat as Owner for pre-existing accounts, so nothing locks out).

### 2. Expose the caller's caps  ← unblocks the front-end
- Add `role` + resolved `caps` (the `Record<capKey,"none"|"view"|"edit">`) to **`/api/me`**.
- With that, the front-end will hide sidebar items where `caps[area]==="none"` and disable edit
  controls where `caps[area]!=="edit"`. (UX only — see #3.)

### 3. Server-side enforcement (the actual security)
- Map each `ROLE_CAPS` key → the API routes it governs (e.g. `finances`→ finance/reconciliation reads,
  `moneyops`→ expenses/purchasing writes, `medical`→ child medical/SEND/contacts, `payroll`→ payroll,
  `bookings`→ booking mutations, `settings`→ settings PUT, etc.).
- Every request checks the caller's role caps for that area: `none`→403, `view`→block writes, `edit`→allow.
- **The client gate is convenience only — do not rely on it.**

### 4. Sensitive-data + messaging (Phase 2b)
- `medical` / `incidents` / `medication` / `payroll` / `finances` are flagged `sensitive` — enforce hard.
- Messaging perms: "Head Office can view staff↔parent threads" (off = HO can't), staff-can-message-HO.
- `audit_log(actor, tenant, action, target, before, after, at)` for role/permission and sensitive-data changes.

### Prototype reference
ActivityOS build manual (`~/Downloads/AAAAAAA.html`, edit663) specs this as
`roles` + `role_permissions(role_id, capability, level)` + `invites` + `audit_log`,
base roles "Company admin (Owner) / Manager / Staff-Coach", "staff are view-only for
their own sessions; medical/SEND/contacts are permissioned".
