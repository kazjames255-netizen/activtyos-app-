# 05 - Live collaboration and layout (Learning Hub whiteboard)

Scope: `features/learninghub/live/board/*` (sync, wire, persist, pads, reducer, controller, shells), the call
room (`live/LessonStage.tsx`, `live/FloatingVideo.tsx`, `live/CallProvider.tsx`, `live/workspace/Workspace.tsx`,
`live/board/callObject.ts`), `server/src/routes/hub/boardsApi.ts`, `server/src/lib/hubVideo.ts`, and the join route
in `server/src/routes/hub/lessonsApi.ts`. Read-only review; nothing was run (no browser, no Daily room), so
layout numbers below are derived from the code and marked "estimate" where they are not measured.

How it works, in one paragraph: the board is NOT synced through the API or SSE. Tutor and students exchange
op messages over Daily `sendAppMessage` (broadcast, plus targeted for private pads). Each side runs the same
permission-checking reducer (`reducer.ts`). The server only holds a durable copy (`hubBoards/{lessonId}`),
which the tutor's client autosaves 5 s after the last change. SSE (`useRealtime`) is used for lesson lists only.

## 1. What works

- Identity of the TUTOR is not spoofable: `senderOf` (`sync.ts:~118`) derives `tutor` from Daily's `participant.owner`
  (a server-side token property), never from a message body. `go` is honoured only from a tutor (`sync.ts:~145`).
- Receiver-side enforcement of write permission is real: `applyOp` (`reducer.ts`) denies `reset/pages/padd/pdel/perm/bg/clear`
  to non-tutors, restricts students to stroke/shape/text/sticky, forces `own/by/cid` to the sender, and only lets a student
  `upd/del` elements whose `own` equals theirs. Students cannot delete or edit tutor elements.
- Per-student write permission: `perm {all, ids}` is tutor-only, broadcast, included in every snapshot, and checked by every peer
  (`mayWrite`, `model.ts:113`). "Everyone / Only X / nobody" UI works (`StudentsPop.tsx`).
- Convergence design is sound for the normal case: versioned elements (`v`), tombstones (`dead`), clear watermarks (`cleared`),
  `pts` gap detection with `need`/resend, 40 ms batching with compaction, snapshot chunking (~3.2 KB/message), late-joiner
  snapshot 700 ms after `participant-joined`, plus a student `req` on mount. Covered by `sync.selftest.ts` and `reducer.selftest.ts`.
- Private "Student work" pads are properly private on the wire: `sendPad` refuses `*`/undefined targets (`sync.ts:162`);
  a student accepts pad traffic only from the tutor and the tutor only from students (`pads.ts` `receive`); pads survive a
  refresh of either side because each end re-sends what only it holds (`onPeerSeen`, `onReq`).
- Board API authorization is tight: tenant check on the lesson (`boardsApi.ts:~76`), foreign/unknown lesson is 404 for all,
  parent must have an ENROLLED child in the lesson (`:82`) and is read-only (`:79`), tutor writes need `requireEdit` +
  `canWriteRow` (franchise scope, `:86`), zod schema on PUT, image ids must be this tenant's private hub uploads (`:~133`),
  student `cid` is stripped if the child is not in the lesson (`:145-150`), 700 KB cap with a friendly 413. Signed image
  URLs are re-issued on every GET. Erasure of a child's drawings is wired (`hubPrivacy.ts:105`). e2e covers the main cases.
- Persistence is robust for one tutor: debounce, save on tab-hidden/pagehide/unmount, stroke simplification when over the limit,
  live-sync-beats-saved-copy on load (`persist.ts`, `controller.loadSaved`).
- Touch/pen: `touch-action: none`, pointer capture, palm rejection while a pen is in use (`controller.ts:323`).
- A board crash cannot take the call down (`BoardBoundary`).

## 2. Bugs (severity: H high, M medium, L low)

### Family / parent join - why a family member may not see the board (root causes, most likely first)

1. **M-H - Late joiners never learn the tutor is presenting.** `present` is a one-shot broadcast (`LessonBoard.tsx` `present_`,
   `sync.ts:155`). It is not part of the snapshot and is not re-sent on `participant-joined` (`sync.ts:~70-77`). The room
   only flips to board-first when the message is heard live (`LessonStage.tsx:211`, `Workspace.tsx:44`,
   `callObject.ts:53`). A family that joins after the tutor pressed Present sees the video and the "Notes" tab (family default tab
   is `notes`, `LessonStage.tsx:177`) and no board. On phones/tablets under 1024 px the default layout is `video` with the workspace
   collapsed (`LessonStage.tsx:131`), and the layout is remembered in `localStorage` (`hub-ws-layout`), so a family that once chose
   "video only" keeps not seeing the workspace. Fix: tutor re-sends `{present}` (and `go`) to each new peer in `joined`.
2. **M - The board tab is lazy-mounted, so nothing announces the family until they open it.** Tabs mount on first open
   (`Workspace.tsx:~50`). `BoardLink.start()` (hello + `req`) only runs when the Board tab mounts. Until then the tutor's
   `peers` has the Daily session but no `cid`: the tutor sees the student as "Not here yet" in `StudentsPop` and "Nobody's here yet"
   in Student work (`present` set is built from `peer.cid`, `LessonBoard.tsx:~130`), and `hub.setQuestion` cannot target them live
   (`peerByCid` misses, `pads.ts:~118`; it heals only when the family later opens the tab and sends `req`).
   The phone nav row (`LessonStage.tsx:~447`) has no "tutor is using the board" dot; only the desktop tab bar does (`Workspace.tsx:91`).
   Fix: mount `LessonBoard` (hidden) as soon as the call is up, or split the link/inbox into a room-level hook.
3. **M - Room cap of 12 vs lessons of up to 30 students.** `hubVideo.ts:104` `max_participants: 12`; lessons allow 30 children
   (`lessonsApi.ts` schema `.max(30)`, WorkView comment "up to 30"). Every device (child + guardian + tutor + observers) counts, so
   family members of a big group are refused by Daily (surfaces as the generic "We couldn't connect you"). Also a second device for the
   same child counts twice.
4. **L-M - Two devices for the same child collide.** `cid` is the child id, so two sessions (child + guardian, or two siblings sharing a
   parent login per child) share `c:<childId>`. `peerByCid` returns whichever came first (`sync.ts:161`): questions/marks go to
   one device only; the other device's pad is merged into the same pad on the tutor side.
5. **Not a cause (checked):** the join and board routes agree on the enrolment rule (`ctx.children` vs `scopedChildren`), a failed board
   GET degrades to a blank live board (`persist.ts` catch), and the live link waits for `persist.loaded`, which is always set in
   `finally`. A second guardian who is not an enrolled parent on the tenant gets 404 on join by design (`lessonsApi.ts:~338`).

### Security

6. **M - Student identity (`cid`) is self-declared, so per-student permission can be bypassed.** `sync.ts:132`
   `cid: d.hello.cid ?? p.cid` takes the child id from the message body. `mayWrite` and the tutor's pad routing key on it. A joined
   participant who knows another child's id can send `hello {cid: X}`, write as X when "Only X" is enabled, and overwrite X's private pad
   on the tutor (`pads.ts` `receive` keys by `from.cid`). The ids are not secret in practice: they are in every element's `own`/`cid`
   in live snapshots and in the parent GET board response (other children's drawings carry `cid`), so any family in a group lesson
   can learn them. The Daily token already carries a signed `userName`; bind identity there too. Fix: `mintToken` adds `user_id: childId`
   (`hubVideo.ts:124`); `refresh()` reads `participant.user_id` and `hello.cid` is ignored. Size S-M.
7. **M - Unvalidated wire input can freeze or wedge the tutor.**
   - `resend` loops from a peer-supplied `need.have` (`sync.ts:151`): `have = -1e12` builds billions of ops and hangs the tutor's tab. Any
     participant can send it (needs a stroke id, which is public on the board). Clamp `have` to `[0, len/PT]`, cap ops per request.
   - `hello.cid` has no length/charset check: a 200-char cid makes elements with `own`/`cid` over the zod limits (`boardsApi.ts` `own` 120,
     `cid` 100), so the tutor's autosave gets 400 forever ("Couldn't save"). Same result from a student text element over 2000 chars
     (`boardsApi.ts:52`; there is no client-side text cap in `controller.ts`, and the wire allows ~3 KB of text). One malformed element
     silently stops persistence for the whole board. Fix: validate/clamp inbound elements in `applyOp` (`add`/`upd`) with the same limits as
     the save schema; make PUT drop/repair invalid elements instead of rejecting the whole board.
   - `present` is accepted from any peer (`callObject.ts:53`, not restricted to the owner): a student client can force everyone's layout.
8. **L-M - Parent GET exposes other children's names and work in group lessons.** Elements carry `by` (first name) and `cid`; `GET
   /lessons/:id/board` returns the whole board to any enrolled family (`boardsApi.ts:~118`). It matches what they saw live, but it feeds
   bug 6 and is retrievable after the lesson. Decide whether families should get only tutor elements plus their own child's.
9. **L - Erasure gap.** PUT strips `cid` from elements of children no longer in `lesson.childIds` (`boardsApi.ts:145-150`) but keeps `own`
   and `by`, so once a child is removed from a lesson their saved drawings and first name can no longer be found by `eraseChildLearning`
   (`hubPrivacy.ts:105` matches on `childIds`/`cid`).
10. **L - No optimistic concurrency on PUT** ("last write wins", `boardsApi.ts` header). A stale second tutor tab or device overwrites the
    newer saved copy. Compare `updatedAt` (send `If-Match`) or merge server-side.

### Sync and reliability

11. **M - No reconnect or resync path.** There is no handling of Daily `network-connection`/`network-quality`, no heartbeat, no periodic
    state hash (`grep` finds none in `features/learninghub/live/board`). `raw()` swallows send failures (`sync.ts:188`, comment says the
    "next sync heals it", but nothing triggers one for students). After a drop, ops missed by a student or the tutor stay missing until
    the tutor re-joins; only `pts` gaps are detected. Fix: on reconnect (`joined-meeting` re-fire / `network-connection: connected`) a
    student re-sends `req`; add a cheap per-page checksum/element-count in the tutor's periodic message so peers request a snapshot.
12. **M - Tutor rejoin broadcasts a `reset` snapshot of the tutor's copy** (`sync.ts:89` then `snapshotOps` starts with `reset`). If the
    tutor reloads with a saved copy that is up to 5 s stale (autosave debounce; `pagehide` uses a normal `fetch` with no `keepalive`,
    `lib/api.ts:153`), everyone else is reset to it and recent student work is lost. The link effect also re-runs when `name` changes
    (`LessonBoard.tsx` deps `[..., name]`), i.e. once when `meta.userName` arrives, re-broadcasting a full reset. In-flight local strokes of
    students are dropped by that reset. Fix: on tutor start, merge (ask a student for their copy, or send add-ops instead of `reset`);
    keep the effect free of `name`.
13. **M - Message size counted in characters, not bytes.** `packOps` (`reducer.ts:181`) measures `JSON.stringify(op).length` against 3000.
    Non-ASCII text (the board has a Chinese `tianzige` background, so CJK/Arabic text is expected) is 3 bytes/char in UTF-8; a single
    text/sticky op over the Daily 4 KB limit, and any single op larger than the limit, is sent alone anyway and the failure is swallowed.
    The element never reaches peers and the tutor's copy diverges from what the student sees. Fix: count bytes (`TextEncoder`), split or
    reject oversize elements, tell the user.
14. **L-M - Version clock is wall-clock time from each device** (`model.ts:127` `nextV`). `clear` records `cleared[page] = v`
    and later `add`s with `el.v < cleared` are dropped (`reducer.ts` `add`). A student device whose clock is behind the tutor's
    by N seconds cannot draw for N seconds after a "Clear page", with no message; a device running fast can leave elements that survive
    a `dead` check. iPads with manual time are the risk. Fix: derive versions from a hybrid logical clock seeded by the highest `v` seen.
15. **L - Revoking permission leaves phantom strokes.** A student who draws before the `perm` op arrives keeps the elements locally; the
    tutor and others drop them (`DENIED`). Never reconciled except by a snapshot. Also the student's `cid`-less session can never
    be granted per-student access (only "everyone").
16. **L - `perm` is not persisted** (`SavedPage` has no perm; `fromSaved` gives `nobody`), so a tutor reload re-locks everyone. Probably
    intended; state it in the UI.
17. **L - Persist size risk.** The 700 KB cap is on JSON characters (`boardsApi.ts:27`); Firestore's 1 MiB limit is on stored bytes and
    stores every number as 8 bytes. A board full of short integers can pass the check and fail with an unhandled 500 (unverified, not
    reproduced). Add a try/catch that maps the Firestore size error to the same 413.
18. **L - `hideNames` does not hide names on the canvas.** Name tags come from `e.by` (`render.ts:551`) and cursors use `peer.name`, so a
    group "Present" that auto-hides names still shows first names on the shared screen.
19. **L - Second observer/tutor.** `tutorPeer()` returns the first owner found (`sync.ts:160`); pad traffic goes to only that one, so a
    co-teacher never sees student pads.

### Layout

20. **H - Floating video tile sits on top of the board and swallows taps.** In "Workspace only"/Present mode the video pane becomes
    an absolutely positioned tile with `z-30` in the room container (`FloatingVideo.tsx:tileClass`, `LessonStage.tsx:357-360,424`), above
    the workspace pane that holds the board (its overlays are `z-10`, popovers `z-30` inside the board's own stacking context). The
    default position is bottom-right (`DEFAULT {fx:1, fy:1}`, `FloatingVideo.tsx:23`), size M = 420 px wide (250 px on phones), and
    a Daily iframe inside it captures every pointer event. Nothing keeps the tile off the tool controls:
    - Phone/portrait: the tile sits over the right side of the bottom tool tray + options row (the tray is in normal flow at the bottom of
      the board, `BoardShell.tsx:~92`), so taps on the last tools/colours hit the video.
    - iPad landscape (1024 px, estimate): the tile spans roughly x = 560..980, y = bottom 306 px; the centred `OptionsBar` (pen size,
      colours) extends under it.
    - The tile snaps to any corner within 80 px, including top-right where undo/redo, "Students can write", Present and the board menu live;
      popovers (StudentsPop, Insert) can open behind it.
    Fix options: (a) dock the tile in a reserved strip (a header slot or a fixed 16:9 corner that the board shell insets around, using a
    `--video-inset` CSS var), (b) let the board report a "no-go" rect and clamp the tile out of it, (c) minimum: default the tile to the
    top-left/below the top bar on phones and add `pointer-events` pass-through when minimised. Size M.
21. **M - Split layout gives the board 35 % of the room by default** (`loadLayout`, `frac: 0.35`, `LessonStage.tsx:131-134`). On a 1280 px
    laptop that is about 430 px, which the board treats as a phone (container < 620 px, `BoardShell.tsx` `@[620px]`) and shows the bottom
    tray. The tutor only gets the full board via Present/"Workspace only" or "Open board" (`wantBoardFirst`, 0.6). Students get 0.35 too.
22. **M - Small screens, estimate only:** the phone top bar (`ViewSwitch` + `PageTabs` + history + students + more, all 44-52 px)
    wraps into 2-3 rows over the canvas; with the room stacked video-on-top (`flex-col` below 1024 px) plus a bottom tray, the drawable area
    in a 0.6 split on a 700 px-tall phone is roughly 150-250 px. Needs a measured pass in Playwright at 390x844 and 820x1180.
23. **L - Focus/keys.** The room's window-level keys (W, P, ?) run when focus is in the board; the board stops propagation for its own keys, so
    they do not clash today, but any new board shortcut that does not go through `ctrl.key` will collide with the room's "P = present".

## 3. Gaps ranked (product level)

1. Late-join / reconnect state: presenting state, current page (`go`), permission, and a resync trigger (bugs 1, 11).
2. Identity binding of students to the Daily token, and inbound message validation (bugs 6, 7).
3. Video-over-board layout: an inset/docked video, and a proper mobile/iPad layout (bugs 20-22).
4. Board persistence across lessons: the board is keyed by `lessonId` only (`hubBoards/{lessonId}`), so a weekly student or group starts blank
   every time; there is no "continue last board", no board list, and families cannot view a lesson's board after the call (the read-only
   GET exists and is only used inside the live tab; `grep` finds no other UI use). Tutors can "Save to lesson notes" and save templates.
5. Student pads are memory-only (`PadHub`). If the tutor and student both leave, the work is gone unless the tutor pressed "Save all to
   notes". No autosave of pads, no history per student across lessons.
6. Conflict handling is versioned last-write-wins per element, which is fine for drawing; no tutor "lock" of a student's element
   while marking, no per-element authorship audit trail server-side.
7. Observability: no metrics for dropped messages, oversize ops, or divergence; failures are silent (`catch {}` in `raw`).
8. Multi-tutor (co-teacher/observer) semantics: everyone with an owner token is "T" and both write `own: "T"`; pads go to one tutor only.
9. Load: N participants with "everyone can write" is N-to-N broadcast; snapshot pacing (14 ms/message) is fixed. 12 participants is the
   Daily cap anyway; no rate limit on inbound ops per peer.

## 4. Prioritised build list

| # | Item | Size | Files |
|---|------|------|-------|
| 1 | Re-send `present`, current page and perm to each new peer; tutor answers `hello` with them | S | `sync.ts`, `callObject.ts` (accept `present` only from owner), `LessonStage.tsx` |
| 2 | Room-level board link: mount the link/inbox as soon as the call is up (or mount the Board tab hidden) so identity/pads work before the tab is opened; add "board live" dot to the phone tab row | M | `workspace/Workspace.tsx`, `LessonStage.tsx`, `LessonBoard.tsx` (extract link hook), `callObject.ts` |
| 3 | Bind student identity to the token: `user_id = childId` in `mintToken`, read `participant.user_id`, drop `hello.cid` | S-M | `server/src/lib/hubVideo.ts`, `server/src/routes/hub/lessonsApi.ts` (join), `sync.ts` |
| 4 | Validate inbound wire data (clamp `need.have`, cap ops per request, element/text/cid limits identical to zod, ignore malformed) and make PUT sanitise instead of 400-ing the whole board | M | `sync.ts`, `reducer.ts`, `wire.ts`, `server/src/routes/hub/boardsApi.ts`, client text cap in `controller.ts` |
| 5 | Video tile that never covers tools: reserved inset/dock, phone default position, clamp out of board controls | M | `FloatingVideo.tsx`, `LessonStage.tsx`, `BoardShell.tsx` (publish inset rect / CSS var) |
| 6 | Reconnect/resync: on network reconnect students `req`; tutor sends a periodic per-page digest; UI banner "Reconnecting" | M | `sync.ts`, `callObject.ts`, `LessonBoard.tsx`, `BoardUi.tsx` |
| 7 | Tutor rejoin without `reset`: merge from a student copy or send adds; drop `name` from the link effect deps; add `keepalive` save on `pagehide` | M | `sync.ts`, `LessonBoard.tsx`, `persist.ts`, `lib/api.ts` |
| 8 | Byte-accurate message packing and oversize handling (split or refuse with a toast) | S | `reducer.ts` (`packOps`), `sync.ts`, `pads.ts` |
| 9 | Raise/derive `max_participants` from the lesson size + guardians; clear error for "room full" | S | `server/src/lib/hubVideo.ts`, `lessonsApi.ts`, `live/lessonTypes.ts` (`classifyJoinError`) |
| 10 | Mobile/iPad layout pass: default `frac`/mode by width, collapse top bar into one row or overflow menu, Playwright at 390x844 and 820x1180 with a tap-target check | M | `LessonStage.tsx`, `BoardShell.tsx`, `BoardUi.tsx`, new `e2e/` spec |
| 11 | Hybrid logical clock for `v` | S-M | `model.ts` (`nextV`), `reducer.ts` |
| 12 | Cross-lesson board: "continue last board" per student/group + family read-only "Board from the lesson" view (GET already exists) + optional pad autosave | L | `boardsApi.ts` (keying/list endpoint), `openapi.yaml`, new family view under `features/learninghub/`, `persist.ts`, `pads.ts` |
| 13 | PUT concurrency (`updatedAt` precondition) and Firestore-size error mapping | S | `boardsApi.ts`, `persist.ts` |
| 14 | Privacy: mask `by` tags/cursors under `hideNames`; keep `cid` (or erase by `own`) when removing a child from a lesson | S | `render.ts`, `controller.ts`, `boardsApi.ts`, `hubPrivacy.ts` |
| 15 | Tests: hello-spoof, negative `need.have`, CJK oversize, reconnect, late join while presenting, tile-over-tool tap test | M | `sync.selftest.ts`, `reducer.selftest.ts`, new e2e spec |

Suggested order: 1, 4, 3 (quick safety and the family-visibility fix), then 5 and 2, then 6-8, then 10, 12.
