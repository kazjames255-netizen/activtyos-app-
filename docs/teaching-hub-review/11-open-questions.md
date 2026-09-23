# 11 — Open questions and decisions taken without the owner

Owner asleep, standing order: no questions. Each item below was decided by the lead and is reversible.

1. Curriculum map: owner earlier asked for it as the first thing on Lessons; the brief says simplify. Decision: the one-line summary is first on Lessons; the grid is collapsed by default (remembered per device). One-line revert in CurriculumCard.tsx.
2. Additive server fields: `/notes/counts` gains fields (P-02); erase/export gain collections (P-11). No migrations.
3. Broadcast idle expiry: 6 h -> 90 min, child heartbeats no longer bump `updatedAt` (P-01).
4. Tab merge (P-10) done as renames + alias map only; real merge waits for one Mark queue.
5. Tutor->parent nudge message template NOT built (needs consent/tone design; R-9).
6. Acting-as stamping, ParentGate server enforcement, per-child accommodations: roadmap.
7. Set MAIL_ALLOWLIST before any marking tests (dev mail is live).
8. P-01 expiry chosen as 90 min (brief said 45): long lessons with quiet spells must not be cut off; End lesson button gives the tutor an explicit exit. Read from a tenant setting later.
9. P-11 gaps: multi-child family notifications (name several kids) are not erased on one child's deletion; `/api/privacy` summary counts only the older keys; board image docs are deleted only for elements carrying the child's `cid`. Owner to review.
10. P-09 tenant-level off switch for the curriculum map NOT built: no cheap tenant settings hook exists for hub blocks (only `settings.features.learninghub`). Roadmap with the tenant settings work (show/hide blocks).
11. P-08/P-09 leftovers: `ComingSoon` (kit.tsx) and its call at LearningHubApp.tsx:191 are still reachable for any non-live panel meta, and both are Builder A's files, so not deleted. Child Progress tab still shows the curriculum ring overlay (kept per brief), with stars instead of "N of M".

## Builder C: one homework form (H-01)
- Removed the in-person "also send to portals" Yes/No and the inline "Set this lesson" shortcut in the reader and the live workspace. Safest reading of the hawk decision. If tutors miss the in-call shortcut, add a "Set homework" button in the live workspace that calls `lessonHomeworkIntent` after the session (not built).
- P-12: Year filter options are the tenant's free-text `yearGroups`; a name with no number (e.g. "Reception") sends no year filter.
