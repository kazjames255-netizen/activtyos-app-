# 09 Challenge: Safeguarding and data (KCSIE, UK GDPR, Children's Code)

Read-only review. Code checked: server/src/lib/hubPrivacy.ts, routes/hub/remoteSyncApi.ts, routes/my.ts (erase call at :2720), features/learninghub/LearningHubApp.tsx (KID_TABS at :18/:85/:177).

## Sign-off table
| P | Verdict | Conditions |
|---|---|---|
| P-01 | SIGN OFF WITH CONDITIONS | See below |
| P-02 | SIGN OFF | Tutor-only counts, nothing widened |
| P-03 | SIGN OFF WITH CONDITIONS | See below |
| P-04 | SIGN OFF | |
| P-05 | SIGN OFF WITH CONDITIONS | "Details" toggle must be tutor-only server-independent (never render raw URLs/stack to parent/child); no error text containing child names |
| P-06 | SIGN OFF WITH CONDITIONS | See below |
| P-07 | SIGN OFF | |
| P-08 | SIGN OFF | |
| P-09 | SIGN OFF | Child sees own progress only |
| P-10 | SIGN OFF WITH CONDITIONS | See below |
| P-11 | SIGN OFF WITH CONDITIONS | Must be widened, see coverage list |
| P-12 | SIGN OFF | |
| P-13 | SIGN OFF | Positive: reduces shame nudges |

## P-01 End broadcast
Who can end: `POST /remote-sync/sessions/:id/end` needs `requireEdit` + `sessionFor(ctx,id,res,true)` (tenant + franchise scope). Family role cannot end. Good; the UI button must be tutor-only (not shown in view-as-parent/kid).
Child sees: join returns 409 `lesson_closed` when status != live; the banner is fed by `/remote-sync/active` (status==live only).
Conditions:
1. Idle expiry 6h to 45min is safe ONLY if `updatedAt` is refreshed by tutor activity and child heartbeats (a quiet own-pace lesson with no writes would eject children mid-lesson). Check every write path bumps updatedAt, or add a tutor heartbeat; use 45 min minimum, never shorter.
2. Ended-session UX for the child: friendly "Your tutor has ended this lesson", no error/red; never leave a child in a room with no adult (ending must also stop live answers being written: `liveAnswer` should 409 when ended).
3. Confirm dialog on End; idempotent (already true).

## P-03 Kid Join / Progress
Join goes through the same checks: `parentChild` (child belongs to the parent), `sessionFor`, `childIds.includes`, status live. Kid mode is client-only, server sees the parent token; so allowing `live` and `dashboard` in the client whitelist exposes nothing beyond what the parent token already permits. Dashboard for a child = own data only.
Conditions:
1. Kid `dashboard` view must be a NEW child-scoped component, not the tutor/parent Dashboard (which may show class comparisons, other children, tutor notes, pass-mark arithmetic). Scoped to `hub.childId` only; no sibling switcher inside kid mode.
2. Kid `live` view: no free-text input to tutor, no chat, no screenshare (Daily is chat off / family screenshare off: keep it). Names shown: first name only.
3. Tabs added to KID_TABS are exactly `live` and `dashboard`; nothing else.

## P-06 Nudge templates
Currently "Nudge" is only a navigation to a homework form; the proposal adds a parent message template. Who is messaged: the PARENT (notifyFamilies sends to the parent account and email), not the child. Good.
Conditions:
1. Template is sent to the parent only, never the child address/thread; no new tutor-to-child channel. Do not route through `hubDoubts` (which is tutor to child thread, S-01).
2. Tutor sees and can edit the message before sending; explicit Send click, no auto-send, no bulk send without per-student review.
3. Tone: no shaming ("overdue", "behind", "failed"); no child name in the email subject; no scores in the email body (email is insecure channel); the link goes into the hub behind login.
4. Frequency cap (e.g. once per child per 3 days) and a parent opt-out; log who sent it (real tutor uid, not impersonated: see acting-as X2-04, R-8).
5. Consent basis: this is the service the parent signed up for; but the Children's Code nudge rule applies to the child, not to parent messages. Do not add push/streak nudges for the child.

## P-10 Tab merge
KID_TABS remains a whitelist: `active = kid && !KID_TABS.includes(wanted) ? "home" : wanted` (LearningHubApp:85) and the tab strip filter (:177). A `?tab=` deep link for a hidden tab therefore falls back to home in kid mode. Conditions:
1. The redirect map (`diagnostic`->`quizzes`+filter, `tools`->`lessons`) must run BEFORE the whitelist check, and must be applied to the kid too, so kid `diagnostic` (Starting quiz) still works if it is in KID_TABS today; keep the whitelist an explicit allow-list of the NEW keys (do not derive it from "all except tutor tabs").
2. Merged Tools-in-Lessons launcher and the Starting quizzes filter must not render tutor-only controls (assign, results of other children) in kid/parent mode. Tutor-only panels remain gated by role, not by URL.
3. Add a test: kid + `?tab=` each removed/tutor-only key => Home.

## P-11 Erase / export: complete child-data inventory
Erase = `eraseChildLearning` (hubPrivacy.ts:73, invoked from my.ts:2720). Export = `exportChildLearning` (privacy.ts:172). Note: X2 said hubToolStates was uncovered; it IS now in erase (line 120), but not export.

| Collection / place | Holds | Erase today | Export today |
|---|---|---|---|
| hubEnrolments | name, year, tutor | Yes | Yes |
| hubSubmissions (+images by submissionId) | text, attachments, mark | Yes (incl. images) | Yes (file names only) |
| hubFlashcardReviews | SRS history | Yes | Yes |
| hubAttempts | answers | Yes | Yes (allow-list) |
| hubMastery | mastery | Yes | Yes |
| hubLessons childIds/attendance | attendance | Yes (arrayRemove + delete field) | Yes (joinedAt only) |
| hubLessons `liveAnswers.<childId>` (remote sync) | in-progress answers, question prompt | NO (only childIds/attendance) | NO |
| hubLessons tutor-side snapshots (childNames/title) | possible names | Unverified | n/a |
| hubGroups.childIds | membership | Yes | NO |
| hubFamilyInvites childIds/childNames | first names | Yes | NO |
| hubBoards elements (cid) | drawings | Yes (elements) | NO |
| images referenced by board elements (imageId) | uploaded photos | NO | NO |
| hubToolStates (ownerKey = childId) | autosaved tool JSON, may hold free text | Yes | NO |
| hubHomework.assignedChildIds | assignment | Yes | NO |
| hubDoubts (childId, childName, message text, tutor replies) | free text, tutor-to-child correspondence | NO | NO |
| notifications (notify.ts) | child name + first 140 chars, parent- and tenant-scoped | NO | NO |
| hubFlashcardAssignments | assigned children? | Not checked/covered | NO |
| hubToolEvents, hubNcTags, hubPings, hubUse | tenant counters/curriculum, no child identity | n/a | n/a |
| children doc | name, dob, medical, EHCP | Archived not deleted (my.ts:2721) | Outside hub |
| bookings, emails sent | parent-scoped | outside hub | outside hub |

### Gaps (must fix, P-11 widened)
1. hubDoubts: add to erase (delete by childId) and export. Consider retention rule: safeguarding evidence may need to be kept, so decide legal basis (KCSIE record retention) and document; at minimum export it.
2. remote-sync `liveAnswers.<childId>`: delete field in the hubLessons update (line 95) and export it (or state it is transient and purge on session end).
3. Board images: delete `images` docs whose id appears in the child's board elements.
4. notifications: delete those with the child's name/ref childId and tenant notifications mentioning them.
5. Export missing for hubToolStates, hubGroups, hubBoards elements, hubFamilyInvites, hubHomework assignment, hubDoubts. Export must use an allow-list and must not leak other children's data (board/lesson docs are shared).
6. hubFlashcardAssignments: verify shape.
7. Add a test that lists every collection with childId/childIds/cid/ownerKey/childNames and fails if it is not in the erase list (prevents recurrence, X2 theme 3).

## No new unsupervised channels
Checked P-01..P-13: none adds a tutor-to-child message path, a child-to-unknown-person path, chat, or a wider read scope. P-06 messages parents only. P-03 adds views, not inputs. Existing S-01/S-02 (tutor to child threads without assignment check, contact details unfiltered) and acting-as stamping remain open and stay on the roadmap (R-8, R-9); nothing here may ship on top of them (e.g. do not reuse hubDoubts for nudges).
