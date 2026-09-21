# Shared brief for every Learning Hub agent (overnight run, 2026-09-20)

Owner (Kaz) is ASLEEP and wants everything working when he wakes. Work autonomously; do not ask questions. Report honestly (what is done AND verified vs not).

## Read first
- `/Users/kazjames/Downloads/activtyos-app-/AGENTS.md` (Next.js here has breaking changes — read `node_modules/next/dist/docs/` before writing Next-specific code; UI patterns; e2e rules).
- `docs/learning-hub.md` (hub contract). Memory-style state: `/Users/kazjames/.claude/projects/-Users-kazjames-Downloads-activtyos-app-/memory/learning_hub_build.md`.

## Product facts
- Learning Hub = tutoring vertical. Student = a parent's child. Tutors = freelancer/staff/company/franchise. Hats: TUTOR (freelancer/staff/company/franchise), PARENT (custdash portal), and the CHILD (no login — sits with tutor or is driven by the parent). Notes are called **Lessons** in the UI ("Live lessons" = video lessons, kept distinct).
- UI: `features/learninghub/*`; server: `server/src/routes/learningHub.ts`, `server/src/routes/hub/*.ts`, `server/src/lib/hub*.ts`. Views mount via `lib/view-registry.tsx`. Portals: `/freelancer/learninghub`, `/company/...`, `/staff/...`, `/custdash/learninghub` (parent).
- Dark/light theme via CSS variables only. Business logic server-side. HTTP via `lib/api.ts`. UI primitives `components/ui`.
- Do NOT touch booking / invoicing / scheduling logic.

## Hard rules
1. **NEVER `git commit` / push / stash / reset.** Working tree only.
2. **Never run `npm run build`, never stop/restart `next dev` or the API** (owner's live site at :3000/:4000; the lead does builds). `npx tsc --noEmit` (root and `cd server && npx tsc --noEmit`) is fine — ignore pre-existing errors under `scratch/` and `server/src/curriculum/**/_check_*`.
3. **e2e specs ONLY through `scripts/e2e-locked.sh`** (they share standing tenants; concurrent runs corrupt each other). Usage: `scripts/e2e-locked.sh e2e/<file>.spec.ts [-g "test name"]`. Keep each run targeted (one spec / one test), they are slow. Playwright `networkidle` never fires (SSE) — wait for elements.
4. E2E assertion rule: anchor every state assertion to THIS run's entity (`cardWith(page, runUniqueName, "State")` from `e2e/helpers/ui.ts`). New flows get a spec.
5. Stay inside your assigned files/area. Other agents are editing other parts concurrently. If you must touch a shared file (e.g. `NotesPanel.tsx`, `LearningHubApp.tsx`, `controller.ts`), make small surgical edits and re-read the file right before editing.
6. Real tenants `7jG2XO3cOD3VtoL8YfFY`, `jYp5XNZGT7bgSUMuEgHN`: do not write to them (unless your brief says so). Oak staging tenant `pnH8zTuvYlb7yJbvcanr` (login in `scratch/oak-staging.json`) is fine to use; e2e standing accounts come from `e2e/helpers/env`.
7. Children's content: a wrong answer key is the worst bug. No invented facts.
8. Finish with a concise report: what changed (files), what you verified (commands + results), what is NOT done/uncertain. Don't paste huge outputs.
