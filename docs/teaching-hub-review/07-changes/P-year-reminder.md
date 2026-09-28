# P: September year-group reminder

Owner question: do kids move up on 1 Sept? Automatic-year students flip by calculation; year groups typed by hand never move. This adds a reminder for the hand-set ones.

- Logic: `features/learninghub/students/yearReminder.ts` (pure; academicYearKey, 1 Aug to 31 Oct window, next label from the tenant's own yearGroups list, per-tenant/per-academic-year dismissal in localStorage). Selftest: `server/node_modules/.bin/tsx features/learninghub/students/yearReminder.selftest.ts`.
- UI: `YearReminderCard.tsx`. Card at the top of tutor Home and Students ("Review year groups" / "Not now" hides 7 days). Dialog: per row Move up / Keep / Set to automatic (only with a DOB on file), Undo per row, "Move all up a year" with one confirm and a 10 s Undo. Uses existing PUT /students/:childId; errors per row via friendlyError; aria-live announcements. "All done" hides for the academic year. Tutors/staff with edit rights only; nothing is emailed or notified.
- Only additive server change: the roster row now carries `hasDob: boolean` (never the date itself) so the UI knows when "Set to automatic" is possible. No schema change.
- Spec: `e2e/review/year-reminder.spec.ts` (page.clock pins the date). Screenshots: `screenshots/after/year-reminder/`.
- Rows moved or kept are remembered per academic year (localStorage), so a moved student, who is still "by hand", is not re-listed.
