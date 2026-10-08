# Messages and Trips QA, 8 Oct 2026

## Tested
- Existing automatic tests for trip consent, broadcast messages, bells and franchise isolation: all 11 passed on my own test copy of the site.
- Provider, staff and parent, side by side: provider messages a parent, the parent replies, the provider sees the reply live and the unread badge clears when the thread is opened.
- Trip: created by the provider, the parent gets a bell and a "Consent needed" card with Give consent / Not going buttons.
- Rules checked: a trip cannot be completed while a child's consent is outstanding; a parent's "not going" cannot be overwritten by the provider; staff cannot delete a trip or turn consent off; another provider (freelancer) cannot see, edit or delete the trip or read the message thread; a parent cannot message a provider they have not booked with; empty and very long (over 4000 characters) messages are refused; made-up dates are refused; odd text such as HTML tags is shown as plain text, not run.
- Screenshots of Messages and Trips for provider, staff and parent at 1440 and 390 wide, light and dark. No sideways scrolling anywhere. The portals only have one real (light) look, so "dark" screenshots match the light ones.

## Broken
- Low: a very long link or word with no spaces in a message poked out of the speech bubble and was cut off (provider Messages, trip message preview). Fixed.
- None found in permissions, consent rules, bells or unread badges.

## Fixed
- Long unbroken text now wraps inside the bubble. Commit: see the git log, subject "messages/trips: long unbroken text wraps inside bubbles".

## Not changed, worth knowing
- The parent's chat bubble is hot pink with white text. Contrast is a bit low (about 4:1). Cosmetic, your call.
- Colours in these screens are written in directly rather than taken from the theme (existing pattern, harmless while there is only one light look).
- A provider can record "granted" for a child on paper before the parent answers. This is on purpose, but the parent can still overrule it.

## Needs Kaz's decision
- Whether to change the pink bubble to a darker pink.

## Manual/assistant update needed
- None. No behaviour changed that a user would notice.
