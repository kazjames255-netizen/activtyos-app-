# Incidents and first aid: overnight check, 8 Oct 2026

## What I tested
- Logged first aid (accident) and behaviour records as the owner and as staff, through the real screens, then checked what the parent sees.
- Parent side: list, details, reply, "I acknowledge", mute alerts, bell and email notices, edits that alert or stay quiet.
- Who can do what: owner, staff who logged it, other staff, a different company, the parent.
- Bad input: impossible dates, empty text, odd characters.
- Looks: 1440 and 390 wide, light and dark browser setting. No sideways scrolling, no clipped text, no console errors anywhere.
- Not covered: photo upload (only offered on shared behaviour records, no photo on first aid), body map (lives in the Safeguarding form, not first aid), medication link.

## What was broken
- MEDIUM: on step 3 of the form the Minor / Moderate / Serious buttons showed a raw code (p7inc.sevMinor) instead of a word. Fixed.
- MEDIUM: a parent could reply to, or acknowledge, a record they are not allowed to see (an internal behaviour note), which put a "Parent replied" badge and a bell on it. Fixed, they now get "not found".
- LOW: notices for a safeguarding concern said "An safeguarding concern". Fixed.
- LOW: staff saw an Edit button on records they did not log, filled in the whole form, and only then were told no. The button is now hidden for them.

## What I fixed
- 5c722617 (all four fixes above, one commit, local only, not pushed).

## Everything else was fine
- Other companies cannot see, edit, delete or reply to your records, and cannot log against your children.
- Staff cannot delete. A parent cannot create, edit or delete.
- Parent gets the bell for accidents and for shared behaviour notes, not for internal ones. "Quiet" edits send nothing.
- Bad dates and empty text are refused. Odd characters are shown as plain text, not run.

## Needs a decision from Kaz
- "Parent informed" tile counts only the tick "I also told the parent in person". The automatic email and bell are not counted, so it shows 0 even after the parent was notified. Should the automatic notice count?
- The system accepts a first aid date in the future if someone bypasses the form (the form itself blocks it). Block it on the server too?
- Parent emails and bells for accidents are English only, even if the parent uses another language.
- These pages are always light, even in a dark browser setting. There is no dark version, by design of the app shell.
- "Recorded by" shows the email address when the person has no name set.

## Manual/assistant update needed
- Staff now only see Edit on first aid and behaviour records they logged themselves (owners and the safeguarding lead still see it on all).
- A parent can only reply to or acknowledge records the provider has shown them.
- Notices say "A safeguarding concern was recorded" rather than "An safeguarding concern".
- Severity buttons on step 3 of the first aid form now read Minor, Moderate, Serious in the user's language.
