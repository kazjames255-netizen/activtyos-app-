# Moments and Newsfeed QA - 8 Oct 2026

Tested on a private test stack (web 3012 / API 4012) with throwaway @activityos-test.com accounts, no real email.

## What I tested
- Provider, staff and three parents across two providers (cross-provider and cross-role).
- Photo upload (fake image rejected, staff can only upload private photos).
- Photo consent: child photo blocked for a no-consent child; "their work" photo allowed; photo hidden from parents the moment consent is withdrawn (provider sees a flag).
- Tagging: a provider can only tag children booked with them.
- Comments, edit/delete rights, newsfeed audiences, drafts, reactions, RSVP capacity, "Got it" acknowledgements.
- Screenshots at 1440 and 390 wide (parent and provider views): no sideways overflow or clipped text found.
- Script: e2e/review/mn-api.mts (50 checks, all pass after the fixes).

## Broken and fixed
- HIGH: "Schedule for later" newsfeed posts never went live. Fixed: a 1-minute background job now publishes them at the chosen UK time.
- HIGH: A post aimed at "chosen families" (specific listings) was shown to every family of that provider. Fixed: only families booked on those listings see it (and can react/RSVP).
- MEDIUM: A group photo showed other families' children's names to each parent. Fixed: each parent sees only their own child's name.
- MEDIUM: A parent saw other parents' replies on a shared photo, all labelled "You". Fixed: parents see the team's comments and their own only.
- MEDIUM: Parent API responses leaked the staff member's sign-in email and other families' internal ids (comment reply, newsfeed like/RSVP maps). Fixed.
- LOW: Likes / "Got it" / RSVP were remembered only on one device. Fixed: the server now returns each parent's own choices.
- LOW: Parent Moments now shows the child's name on each card, lazy-loads photos, has a close button and Esc for the full-size photo, and the reply box follows the theme.
(Commit hashes are in the git log of branch worktree-agent-ab60bb7e7fa181265.)

## Needs Kaz's decision
- Parents get no bell/email when a provider posts to the Newsfeed (Moments do notify). Add one?
- Group photos: should parents see them at all if another family's child is in the shot? (Names and replies are now private per family; the photo itself is still shared.)
- There is no true dark theme in the parent area or provider content, so dark-mode checks were not applicable.

## Manual/assistant update needed
- Newsfeed "Schedule for later": it now actually publishes at the time chosen (UK time).
- "Chosen families" posts reach only families booked on the chosen listings.
- Parents' Moments: other families' replies and children's names are no longer shown.
