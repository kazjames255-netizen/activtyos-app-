# Parent/child Learning Hub redesign brief (owner, 27 Sep 2026)

Target: /custdash/learninghub. Rebuild the navigation around ONE question: "What should this child do now?" Keep all existing data, features and APIs. This is an information architecture, navigation and copy change.

## Already done in this session, BUILD ON TOP OF THIS, do not revert it
- `features/learninghub/home/FamilyOverview.tsx` — a Family-home-style overview already exists: one row per child (avatar, name, a one-line verdict, plus a second line with top-subject level % and homework-due count), opening that child on click. This is Level 1 in miniature, on the existing Home TAB (not yet its own route). Extend it into the full Level 1 card spec below (3 action rows, status chip, tutor name) rather than replacing it.
- `features/learninghub/HomePanel.tsx` — wires FamilyOverview into the Home tab; local (non-persisted) state shows the overview by default for a multi-child family, a specific child's Home once picked, with a "← All children" back link. This whole file will likely be superseded by real routing per this brief but keep its logic as the reference for what "open this child" should do.
- `features/learninghub/home/StudentHome.tsx` — Kid Mode's home content was just merged with the parent's per-child home content (no more separate sparse "KidHome-only" page); a `kidExtra` block renders the friendly big-CTA prompt, followed by the same detail cards everyone sees. The owner has since asked for a full proper "child mode" (see §3 below) — treat that as superseding this merge for the dedicated child-mode experience, but the merged content is a fine basis for what child mode's tiles should surface.
- `features/learninghub/family/FamilyContext.tsx` / `family/KidMode.tsx` — the old "Hand over to..." FamilyBar button and the hero child-switcher pills (`HubHero.tsx`) were REMOVED entirely per the owner's explicit request ("remove the handover function completely", "these two pages/pills are confusing"). `KidBar`'s header was unified to a plain "← Go back to parent portal" link, and `KID_TABS`/`KID_STRIP_HIDDEN` were widened so Kid Mode shows every tab. Do not reintroduce the old FamilyBar or hero pills — instead build the proper §3 "child mode" this brief asks for, as a clean new implementation (press-and-hold or parent-PIN exit, child-voiced copy, no parent items), replacing the old Kid Mode mechanism if that's cleaner than extending it.
- `lib/i18n/messages/areas/hubshell-parts/home.ts` — new keys `hm_familyOverviewTitle`, `hm_backToFamily`, `hm_familyLevel`, `hm_familyHwCount_one/_other` (English + 10 other locales, not natively reviewed). Follow the same `ROWS` tuple pattern (`[key, en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy]`, all 11 locale values required or the module throws at load) for every new string this brief needs — do not add English-only strings.

## 1. New structure (3 levels, no dead ends)

### Level 1: Family home (/custdash/learninghub)
- One big card per child (avatar, name, year, tutor name in normal case, not caps).
- Each card shows up to 3 action rows, in priority order, each a direct link that opens the actual item:
  1. Homework due (soonest first): "Homework: Poetry analysis · due Thu" → opens that homework's hand-in page.
  2. Next live lesson: "Maths lesson · Tue 4pm" → countdown, and a Join button when it's open.
  3. Next thing to practise: the starting quiz if not done, else the next quiz set by the tutor, else "Review 10 flashcards".
- Status chip: On track / Needs a nudge / All done this week.
- The whole card opens that child's space. If only one child, skip this level and go straight to their space.

### Level 2: Child space (/custdash/learninghub/[childId])
- A child switcher at the top: avatar chips for each child, the current one highlighted. Switching keeps you on the same section.
- Max 5 sections (bottom nav on mobile, tabs on desktop):
  1. **Today** (default): a "Do this next" hero card with one big button, then Homework due, Next lesson, Recent results, and a streak.
  2. **Homework**: To do / Handed in / Marked, with the tutor's feedback inline.
  3. **Learn**: Lessons (openable), Live lessons, Tools, Flashcards as sub-sections.
  4. **Quizzes**: the starting quiz pinned at the top until done, then "Set by your tutor", then "Practise more", filtered to the child's year and enrolled subjects only.
  5. **Progress**: by subject → topic, with a "Practise this" button on each weak topic.
- Messages leaves the tab bar. There is ONE messages inbox (the header icon / "Ask your tutor"), filtered to this child's tutor. Remove the duplicate Messages tab.
- Subject filter (Maths/English/Science/Languages) is a chip row INSIDE Learn, Quizzes and Progress, not a second tab bar. Only show the child's enrolled subjects (and only their chosen language, not French, Spanish and German together).

### Level 3: The item itself
- Homework, quiz, lesson, flashcard deck: opens full-screen with a clear "← Back to Jordan's Today" and, on finishing, a "What next?" screen (next item, or "All done for today 🎉").

## 2. Deep links everywhere
- Every item has a URL: /custdash/learninghub/[childId]/homework/[id], /quiz/[id], /lesson/[id], /flashcards/[deckId], /live/[id].
- Every card, notification, email ("Emailing me about Jordan's learning") and tutor message that mentions an item links straight to it.
- The browser Back button always works, and refreshing keeps the child and section.
- Remove every card that only says "Browse quizzes" / "See lessons" / "See progress" with no specific item. Replace it with the actual next item, or an empty state that says who acts next ("Nothing set yet. Your tutor, Amir, will add homework here").

## 3. Child mode (hand the device to the child)
- On each child card and in the child space: a "Start learning as Jordan" button.
- Child mode: the child's name and avatar, big friendly tiles (Today's homework, Next lesson, Quizzes, Flashcards, Games), their streak and stars, and NO parent items (emails, settings, other children, billing, the rest of the portal menu).
- Exit child mode = press and hold / parent PIN.
- All copy in child mode speaks to the child ("Your homework"). All copy in parent mode speaks to the parent ("Jordan's homework").

## 4. Copy rules
- Parent mode: third person about the child ("Jordan hasn't started any quizzes yet"). Child mode: second person ("Ready for your first quiz?").
- Never show tutor-facing text to families (remove "To give a tool to your pupils…" from Tools. Families see "Tools your tutor has shared" plus "Try any tool").
- Fix the Homework empty state: "When Jordan Sample sets homework" → "When [Tutor name] sets homework, it will appear here."
- Show the tutor/business name in title case, not capitals.
- Rename "Lessons: What I've covered" → "Lessons" with openable lessons. Put "What Jordan's covered" inside Progress.
- Flashcards: never show totals like "41,955 cards · 10,489 min". Show "Today: 20 cards · about 5 min" (daily cap, configurable by the tutor).
- Level bar: replace "Learning 0% / Developing 50% / Secure 80%" with a plain sentence plus a bar: "Jordan's level appears after the first marked quiz."
- Every empty state answers: what goes here, who adds it, and what you can do now.

## 5. Reduce overwhelm
- Quizzes: show 5 at a time ("Next up"), with "See all (92)" collapsed. Hide quizzes outside the child's year group and subjects unless the tutor assigned them.
- Starting quizzes: one per enrolled subject. Merge "English placement — Year 9" and "English placement check" into one.
- "Hide the numbers" should be a setting (in parent settings), not a top-level button.

## 6. Bugs and hygiene
- Duplicate React keys in the curriculum topic list (French/Spanish/German "– Grammar"): 244 console errors. Use a stable id (subject + topicId).
- Topic rows in Lessons/"What I've covered" do nothing when tapped. Make them open the topic's lessons, or remove the tap affordance.
- Curriculum/subject buttons are rendered in the DOM under every tab. Only render the active section.
- Header icon links (messages, browse, bookings, learning hub) have no accessible names. Add aria-labels and tooltips.
- Child rows on Family home show grey loading bars for several seconds. Use a skeleton with the name, and load the summary in parallel.
- The `?tab=` URL state must include the child (use the new routes in §2).

## 7. How it works (parent)
- Replace the general video with 3 short ones: "Your family home", "Helping your child with homework", "Child mode". Each page's Watch link opens the matching one and autoplays.
- Note: a large "How it works" rebuild already landed this session (10 tutor videos, all 11 locales translated) — this item is PARENT-side only; check `features/learninghub/howitworks/` structure before adding, it may already support adding 3 more topics cleanly.

## 8. Definition of done (test as a parent with 3 children, on a 375px phone and on desktop)
- [ ] From landing on the Hub, a parent can open a specific homework in ≤2 taps, and a child in child mode in ≤1 tap.
- [ ] No section has more than 5 top-level tabs, and no tab bar scrolls sideways on mobile.
- [ ] Every card links to a specific item or says who acts next.
- [ ] Switching child keeps the same section. Back and refresh work.
- [ ] One messages inbox.
- [ ] Parent and child copy voices are consistent. No tutor-facing text.
- [ ] Only the child's own subjects, year and language are shown.
- [ ] Zero console errors on every section.
- [ ] Walk-through: "Jordan has homework due tomorrow". Parent opens the Hub, sees it on Jordan's card, taps it, hands the device to Jordan, Jordan does it and hands it in, then sees "What next?". No confusion at any step.

## Standing rules for this build (from AGENTS.md / this session)
- Never mention "Oak"/Oak National Academy/OGL anywhere.
- HTTP via `lib/api.ts`; live updates via `useRealtime`; UI primitives from `components/ui`; dark theme via CSS variables, never hardcoded colours.
- Business logic (prices, sessions, capacity, age derivation, marking) stays server-side.
- Register any new view in `lib/view-registry.tsx` / `lib/nav/config.ts` if the portal shell needs it; new Next.js routes go under `app/`.
- Translate every new/changed string into all 11 locales (see `docs/i18n-glossary.md`).
- Keep `npx tsc --noEmit` and `npm run build` clean.
- New views/flows should get an e2e spec (`e2e/`), but do NOT use the shared `scripts/e2e-locked.sh` queue for your own verification — it's jammed; use your own headless Playwright runs against the dev server with throwaway `@activityos-test.com` accounts.
- Never commit, never touch real tenants, never kill dev servers (:3000 web / :4000 API already running).
