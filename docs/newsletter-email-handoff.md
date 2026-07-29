# Email area — status + backend spec (Amir)

> **Kaz's steer (2026-07-29):** the Email area is an extensive area to build out.
> **Finish the front-end first**, then wire the backend as a later build task.
> **Done now:** HTML embed works (`/api/emails/send` accepts an `html` field and
> sends the designed post/newsletter as-is, with the plain-text `body` as
> fallback); subject auto-fills from the title; the recipient list shows family
> names and can be trimmed before sending (`recipients[]`).
> **Future backend task:** real **PDF/file attachments** (the "Attach as a PDF"
> button only downloads for now) — needs a server-side PDF render + nodemailer
> `attachments` (or client-uploads-PDF → server attaches). Plus the wider email
> build-out (templates, scheduling, visual builder).

---

# Newsletter → HTML email — backend spec (Amir)

**Goal:** when an operator picks **"✉ Email to parents"** in the newsletter
builder, families should receive the **designed** newsletter (layout, colours,
images) as an HTML email — not the plain-text fallback we send today.

## Where it is now
- The builder (`features/newsfeed/newsletter.tsx`) renders the design with
  `NewsletterView` (React) and stores it as a post's `newsletter` payload
  (`{layout, palette, company, blocks[]}`). See `docs/newsfeed-handoff.md` for
  the payload shape.
- "Email to parents" currently: files the newsletter as a `draft` post, builds a
  **plain-text** version (`newsletterToText`), stashes it in `localStorage`, and
  opens the operator's Email page pre-filled. The operator sends via
  `POST /api/emails/send`, which **HTML-escapes** the body (`emails.ts` → `esc()`
  + `bodyHtml()`), so any HTML would show as literal text.

## What's needed

### 1. `POST /api/emails/send` accepts HTML
Add an optional `html` field to `sendSchema`. When present, send it **as-is**
(skip `esc()`/`bodyHtml()` wrapping); keep `body` as the plain-text alt part.
Ideally send a multipart alternative (text + html). Everything else
(audience = all families via `familyEmails`, single `to`, dry-run, history,
`MAX_RECIPIENTS`) stays.

### 2. Render the newsletter to email-safe HTML
The on-screen `NewsletterView` uses flexbox/grid + CSS vars — **email clients
don't support those**. Produce a table-based, inline-styled HTML string from the
`newsletter` payload:
- One shared renderer from the payload → HTML. Cleanest is a server-side function
  that mirrors `BlockView` block-by-block (banner / hero / heading / text /
  image / discount / button / columns / quote / divider / eventbar / footer),
  emitting `<table>`-based layout with **all styles inline**, max-width 600px,
  centred. (Or SSR `NewsletterView` then inline the CSS with a juice-style step —
  but a direct payload→table renderer is more predictable across Outlook/Gmail.)
- Palette: resolve `paletteOf(palette)` and inline the hex values (the colour
  picker was removed, so in practice it's always the classic blue `ocean-0`, but
  keep it palette-driven).
- `{company}` tokens: replace with the company name (as `fill()` does).
- Images: `photoUrl` / block `image` must be **absolute** URLs
  (`/api/images/:id` served with an absolute host) so they load in email.
- Keep it accessible: real `alt`, a plain-text alternative part (reuse
  `newsletterToText`).

### 3. Front-end wire-up (small, mine once the endpoint exists)
Instead of stashing only text, the "Email to parents" flow will POST the newsletter
payload to a render step (or pass it through) so `/api/emails/send` gets `html`.
Simplest: a `POST /api/emails/render-newsletter { newsletter }` → `{ html }` the
Email page calls before send; or send `{ newsletterId }` and let the backend load
+ render + send. Either is fine — tell me which you prefer and I'll wire the
operator side.

## Acceptance
- Operator builds a newsletter → "Email to parents" → reviews in the Email area →
  sends → a family's inbox shows the **designed** newsletter (colours, images,
  buttons) in Gmail + Outlook + Apple Mail, with a sensible text fallback.
- All-families audience + send history + dry-run preview still work.
