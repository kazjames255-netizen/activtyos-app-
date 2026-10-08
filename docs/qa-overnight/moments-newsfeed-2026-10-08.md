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
- FOLLOW-UP (Kaz approved): families now get a bell + email when a provider publishes a Newsfeed post. Only families who can see the post are told (audience rules above); scheduled posts notify when they go live; each post notifies once (editing does not re-send). Families the provider has unsubscribed get the bell only; a family can mute the new "newsfeed" category. Tested with MAIL_LIVE=0 (e2e/review/mn-notify.mts, all pass). Bell/email text is English, same as the existing Moments notification.
(Commit hashes are in the version history of branch worktree-agent-ab60bb7e7fa181265.)

## Needs Kaz's decision
- Group photos: still open (who sees a photo with several families' children in it). Unchanged.
- Newsfeed bell/email wording is English only (same as Moments). Translate server notification text into all 11 languages?
- There is no true dark theme in the parent area or provider content, so dark-mode checks were not applicable.

## Manual/assistant update needed
- Newsfeed "Schedule for later": it now actually publishes at the time chosen (UK time).
- "Chosen families" posts reach only families booked on the chosen listings.
- Parents' Moments: other families' replies and children's names are no longer shown.
- Families now receive a bell and email for new Newsfeed posts (can be muted; unsubscribed families get the bell only).
