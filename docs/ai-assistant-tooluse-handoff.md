# AI co-pilot — backend handoff (tool-use, structured answers, streaming, saved threads)

**Front-end status (done, Kaz 2026-08-10).** The AI page is now a full "co-pilot"
(`features/ai/AiApp.tsx` + `features/ai/RobotAvatar.tsx` + `features/ai/voice.ts`):
the ActivityOS robot as a reactive face (idle / thinking / talking / listening),
answers read aloud in the co-pilot voice with the mouth lip-syncing, mic input +
hands-free mode, a daily-briefing button, categorised prompts + follow-ups,
per-browser conversation history, and **jump-to-action deep-links** under answers
(e.g. an answer that mentions money shows "🧮 Reconciliation →"). It still talks to
the existing **`POST /api/ai/chat`** (Groq, read-only, role-scoped to the account).

Everything below is backend. Priority order:

## 1. Action tool-use (function calling) — GREENLIT (Kaz, 2026-08-10), the big one
Let the assistant *do* things, with a human confirm step. Keep it read-only until
the operator confirms; **never** auto-execute money/irreversible actions.

**The front-end is already built to this exact contract** (`features/ai/AiApp.tsx`)
— you only need the two server bits below and it lights up, no further FE work:

- **`POST /api/ai/chat`** response — return **either** a text reply **or** a
  proposed action (or both):
  `{ reply?: string, action?: { id?: string, tool: string, summary: string, args?: object } }`.
  When `action` is present the FE renders a confirm card showing `summary`
  ("Message the 3 families who owe £180") with **Yes, do it / Cancel**. It does
  **not** execute on `/chat`.
- **`POST /api/ai/act`** request `{ id?, tool, args }` → the server **re-checks
  role/tenant**, runs the mapped endpoint, and returns `{ reply: string }` (a
  human receipt like "Done — messaged 3 families."). The FE relays that reply.
  Nothing executes until this call, which only fires on the user's confirm.
- Resolve "which record" **server-side** from the account's live data (the model
  proposes `args` grounded in that data); never trust the model to self-authorize.
- Map tools to **existing authed, tenant-scoped endpoints** — no new powers:
  - `message_families` → `POST /api/messages/broadcast` (emails/listings already there)
  - `create_task` → `POST /api/tasks`
  - `add_calendar_event` → `POST /api/calendar-events`
  - `nudge_payment` → `POST /api/bookings/:ref/nudge` (reconciliation nudge exists)
  - `mark_reconciled` → `POST /api/bookings/:ref/reconcile`
- Every tool call must re-check the caller's role/tenant server-side (the model
  is not trusted). Log actions for audit. Confirmation is mandatory for anything
  that sends mail, moves a booking, or touches money.

## 2. Structured / typed answers
Let the model return a small typed payload the UI renders as rich cards, e.g.
`{ text, cards: [{ type: "family-list", items: [...] }, { type: "stat", label, value }] }`.
The front-end renders markdown now (`RichText`) but typed cards → avatars, money
tiles and fill-bars that match the app. Define the card vocabulary with me.

## 3. Streaming
Stream tokens (SSE) from `/api/ai/chat` so answers type out; the robot's mouth is
already gated on speaking, and a streaming text render is a small FE add.

## 4. Server-side saved threads
History is per-browser (localStorage) today. A `aiThreads` collection + CRUD
(scoped to the account/user) would make conversations follow the user across
devices. Low priority.

Ties to [[amir-outstanding-backend]] #35 and the walkthrough TTS ask (#34) — the
same server-side TTS could give the co-pilot per-word timing for true lip-sync.
