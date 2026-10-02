# V2 report - product tour video v2
Output: ~/Downloads/ActivityOS tour video/activly-tour.mp4 (v1 kept as activly-tour-v1.mp4); web copy public/v2/video/activly-tour.mp4 (1280x720) + activly-tour-poster.jpg.
Built by e2e/tour-video.spec.ts (run: RECORD_VIDEOS=1 scripts/e2e-locked.sh e2e/tour-video.spec.ts; TOUR_NO_SEED=1 skips the reseed; TOUR_PROBE=1 + TOUR_PROBE_DIR=... saves a screenshot per caption beat).

## What changed
- No voice-over and no `say`. Captions hold about 3 s + 0.3 s per word. Music bed is synthesised in the spec (C-Am-F-G pad, plucked arpeggio, soft pulse, low-passed, loudnorm about -22 LUFS, fade in/out). MUSIC_FILE=/path/to/track overrides it (looped, trimmed, faded).
- Visible animated cursor (SVG arrow + click ripple) injected into every page; each scene performs real safe actions (open a booking, press Link and Embed, switch Email tabs, type a draft subject without sending, open the Log concern form without saving, switch task tabs).
- Cover frames are cut in post: the recorder marks the spans where a screen is on show and ffmpeg trim+concat keeps only those (no blank blue gaps; checked with signalstats, 0 low-range frames).
- Scenes added: Cancellations, Discount codes, Memberships, Email campaigns (campaigns + compose), Newsfeed, Moments, Log concern, First aid, Medication, Task manager. Closing card names meals, trips, ratios, calendar, timetable, referrals, reviews.
- Embed: the button raises a browser alert (not recordable), so the spec captures the alert text (real snippet from the app) and shows it in an on-page panel.

## Seed (e2e company tenant only)
Listing cover photos (public/images, shrunk, uploaded via /api/uploads) + a cancellation policy per listing; 2 membership tiers (percent discount, wallet credit); 2 discount codes; 2 past email sends (history written directly, nothing sent) + 1 draft (browser localStorage, set by the spec); 2 first-aid records, 1 incident, 2 medications + 1 dose logged; 6 tasks with assignees/due dates; 2 newsfeed posts; 4 moments; extra staff credentials so Compliance is not all Missing.

## Truth notes
- Setup > Memberships shows "Price / month" and "every month" wording for billing that is not live; the spec hides the price field and rewrites that wording on screen for the recording only. Captions say wallet credit or standing discount only.
- The Cancellation tab also has a dev note ("Automatic needs building") lower down; the scene never scrolls to it.
- Seeded moments use stock photos tagged as "their work" (no child tagging, as no consent records exist for demo families).

## Known / still looks off
- Compliance grid: a few cells remain Missing (fine, real state). Rota is dense at 1440 wide. Seed takes about 5 minutes (Firestore round trips).
