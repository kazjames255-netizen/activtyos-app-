"use client";

import { Fragment, type ReactNode } from "react";
import { Card, Panel } from "@/components/ui";
import { SectionHead } from "@/components/ui";

// INTERNATIONAL EXPANSION & £10M TARGET (platform-only) — a read-only
// rendering of the consolidated report on international expansion versus the
// £10M-in-2-years target. It argues the UK funnel (50,489 leads, 0% ever
// contacted/won/lost) should be fixed and monetized before any international
// spend, stress-tests the unit economics and profit target against real
// category comps, and preserves the underlying nine-market research
// (Ireland, Belgium, Netherlands, France, Germany, Spain, New Zealand,
// Denmark, USA/Florida) for when international entry is actually warranted.
// It lives here as static content (no API — there is no backend for this
// yet, it's a reference document for the platform team), rendered from the
// raw markdown below via a small self-contained renderer (headers, tables,
// lists, bold/italic, hr) rather than a full markdown library, since this is
// the only place in the app that needs one.
const REPORT_MARKDOWN = String.raw`
# International Expansion & the £10M-in-2-Years Target — Consolidated Report

**Recommendation: Don't spend on international expansion yet. Fix the UK funnel first (0% of 50,489 leads have ever been contacted, won, or lost), monetize it as a success-fee lead-engine, and treat international entry — starting with Ireland — as a 2026-H2 move once UK unit economics are proven, not assumed.**

**The £10M-profit-in-2-years target is unrealistic as currently framed — off by roughly 1–2 orders of magnitude given real comps and real unit economics.** A credible reframe: **£1–3M profit in 2 years is achievable; £10M is a 4–6 year outcome**, and only if churn and monetization are fixed. Details below — read the numbers before the narrative.

---

## The stat line a founder needs in 5 seconds

| | | |
|---|---|---|
| **0%** | of 50,489 leads ever marked contacted/won/lost | The funnel that's supposed to fund everything below doesn't exist yet |
| **0.64:1** | base-case LTV:CAC (healthy SaaS = 3:1) | On median assumptions, new customers may not be profitable yet |
| **£40–100M** | ARR needed to hit £10M profit at a realistic 10–25% net margin | vs. a 50,489-lead pipeline that would need >100% conversion just to get there |
| **10 years** | for the closest UK comp (ClassForKids) to reach <£5M revenue, then exit | The best available evidence for how fast this category actually moves |
| **3,102** | registered providers on Ireland's Tusla register | Best-evidenced next market — but see the sequencing problem below |

---

## Start Monday: the next 7 days

This isn't hypothetical prep work — as of tonight, the first move is already half-done and sitting in Firestore waiting on a human. Here's the actual current state of the \`leads\` collection, queried live, not estimated:

| | | |
|---|---|---|
| **19,284** | leads with a drafted, personalized outreach email already written and saved (\`outreachStatus: "drafted-pending-review"\`) | Written tonight by \`scripts/leads/overnight_draft_outreach.mjs\`. Nothing has been sent — the script explicitly only drafts, it does not send. |
| **6,640** | leads still tagged \`reviewTier: "uncertain"\` | Not yet confirmed as real activity-provider businesses; a verification pass exists (\`uncertain_verify.mjs\`) but hasn't cleared the backlog |
| **3,469** | leads tagged \`reviewTier: "likely_fit"\` | The highest-confidence slice of the pipeline — best candidates for the first send |
| **35,329** | leads with an email or phone on file (of 49,314 non-duplicate, non-excluded leads) | The addressable portion of the pipeline right now |

Concrete actions, in order, this week — not "review the strategy," actual tasks with owners:

1. **Spot-check 50–100 of the 19,284 drafted emails for quality and compliance** before anything goes out. A 60-email sample is already saved at \`scripts/leads/out/overnight_draft_samples.json\` — read it Monday morning. Check: correct business name, no fabricated claims, working demo link, no register/council/charity email addresses slipping through (the script filters these, but verify).
2. **Confirm UK cold-email compliance (PECR/UK GDPR) before the first send.** These are B2B leads but many are sole traders/childminders, who can be treated as "individual subscribers" under PECR — get a clear answer (a lawyer or a compliance checklist) on consent/opt-out requirements before send #1, not after.
3. **Build the actual send mechanism.** Nothing currently sends these drafts — there is no send script yet. This is a 1–2 day build: wire up an ESP (or the existing mailbox) with per-domain rate limits, a suppression/unsubscribe list, and reply tracking. Do not skip the unsubscribe link.
4. **Send the first 500 of the 19,284**, weighted toward the 3,469 \`likely_fit\` leads, as a single controlled batch. Track opens, replies, and demo bookings for 5–7 days before sending the next batch.
5. **Spend the remaining Brave-search budget (\`uncertain_verify.mjs\` notes ~£36/$45 approved and unspent) clearing the 6,640 \`uncertain\`-tier backlog** — every lead it reclassifies to \`likely_fit\` is a new qualified prospect at near-zero marginal cost.
6. **Stand up funnel-status tracking.** Every one of the 49,314 visible leads currently sits in \`status: "new"\` — the funnel cannot report a real conversion rate until leads start moving through contacted → demo → won/lost. A spreadsheet or a dashboard view, but something, by Friday.
7. **Draft a one-page term sheet for the success-fee lead engine** (§5): the fee structure (flat fee per enrolled child, or a % of first-term value), who it applies to, and how it's billed. Have it ready before the first replies come in, not written reactively.
8. **Set the first weekly KPI review for this Friday** — see the tracking list near the end of this report. Do this before batch #2 goes out, so batch #2 is informed by batch #1's real numbers, not guessed at.
9. **No international spend this week.** Nothing above competes with the capped international test described in §4 if the founder wants to run one in parallel — but this week's owner-hours go to the funnel, not a new market.

---

## 1. The number that should gate everything else

Before market selection, pricing, or targets: **50,489 leads sit in the pipeline. 40,378 have never been contacted. Zero have ever been marked contacted, won, or lost.**

This isn't a detail buried in an appendix — it's the fact that should reframe the whole conversation. You cannot model CAC, LTV, or a 2-year profit target off a funnel that has never once closed the loop on a single lead, in your own market, in your own language, with every structural advantage you'll ever have. Every dollar figure below inherits this uncertainty. Where we give "realistic" numbers, treat them as *the best available estimate given comparable companies*, not as validated data — because ActivityOS-specific data doesn't exist yet.

**The fast, nearly-free fix:** work is already paid for (leads are already acquired). A back-of-envelope: even a modest 5% conversion on the 40,378 never-contacted leads, at ~£60/mo blended ARPU, is roughly **2,000 new customers, ~£120k MRR (~£1.4M ARR)** — at close to zero incremental CAC. No international market gets close to that return per pound spent in year one. This is the highest-leverage move available *right now*, and it's domestic.

---

## 2. What real competitors actually did (and how long it took)

Comparisons to real companies in this exact category, not category-agnostic SaaS benchmarks:

| Company | Market | Funding | Time to scale | Outcome |
|---|---|---|---|---|
| **ClassForKids** — closest true comp: same UK market, same buyer, same product tier | UK | ~£2.4M ($3.05M) | ~10 years | ~£4M ($4.9M) revenue, then **acquired** by The Access Group (2023) |
| **Jackrabbit Technologies** | US | Essentially bootstrapped | 20 years | ~£10.8M ($13.5M) revenue, 6,000+ orgs |
| **CampMinder** | US | No VC | 24 years | £7.4M ($9.2M) revenue (2025), then **sold majority stake** to a PE firm |
| **iClassPro** | US | ~£280k ($350K) | 16 years | £4.6M ($5.7M) revenue |
| **Amilia** — the one aggressive outlier | Canada, multi-vertical | £52M ($65M) raised, incl. £28M ($35M) in 2025 | 16 years | Revenue undisclosed but implied low-to-mid tens of £M; ~£800M ($1B) gross payment *volume* (not revenue) |
| **Bookwhen** | UK | Unfunded | Indefinite | Small, profitable, no disclosed scale — evidence this category tolerates permanently modest operators |

**The pattern: every real comp took 10–24 years to reach £5–13M in *revenue* — not profit — and the two most successful bootstrapped ones (ClassForKids, CampMinder) ended in acquisition/PE recap, not independent scale-up.** Even the one VC-fueled outlier (Amilia, £52M raised) took 16 years. Nobody in this category has done £10M in *profit* in 2 years. Nobody has come remotely close.

**Pricing isn't the naive part.** ActivityOS's £29–99/mo tiers sit comfortably inside what this market has proven it will pay. **The timeline is the naive part.**

**What ActivityOS does differently on monetization:** most UK rivals layer a commission on top of a subscription — LoveAdmin (£35/mo + 3% of transactions), Pebble (free + 10% commission, or £15/mo + 1%), Book That In (pure 1.5% take-rate, no subscription), ClassForKids (£35+/mo + an undisclosed volume-based fee). ActivityOS's flat-subscription, zero-take-rate model is a genuine differentiator on paper economics — a provider running £5k/month in bookings keeps all of it, instead of giving up £50–500/month elsewhere. But it's also the easiest thing for a well-funded entrant to match or beat (it's a pricing choice, not a structural moat) — and, as the unit-economics section below shows, it also removes a retention lever every one of those competitors has and ActivityOS doesn't.

---

## 3. Unit economics, stress-tested honestly

### Assumptions, built from the actual sales motion (outbound + demo calls, not self-serve)

| Input | Base case | Range |
|---|---|---|
| Blended ARPU | £50–55/mo | Skews low-end because most leads are solo/small operators |
| CAC | ~£1,200/customer | £800 (efficient) – £2,000 (pessimistic) — driven by SDR labor cost (~£3,700/mo/rep ÷ ~4.5 customers/rep/mo), not ad spend |
| Monthly churn | 5%/mo (~46% annualized) | 4–7%/mo — SMBs are less sticky than enterprise: seasonal cash flow, sole-trader closures, low switching cost |
| Gross margin | 70% | 65–75% — high-touch SMB support drags this below typical 80%+ self-serve SaaS |
| Avg. customer lifetime | 20 months (1 ÷ 5%) | |

**The structural problem compounding churn:** competitors with a take-rate create a real switching cost — moving providers means re-plumbing payment flows. ActivityOS's zero-take-rate model has no such lock-in beyond ordinary product stickiness, which should push churn toward the *higher* end of the range, not the lower one.

### The headline number

| Scenario | LTV (gross profit) | CAC | LTV:CAC | Payback |
|---|---|---|---|---|
| Optimistic | £1,608 | £800 | 2.0:1 | 16 months |
| **Base case** | **£770** | **£1,200** | **0.64:1** | **31 months** |
| Pessimistic | £386 | £2,000 | 0.19:1 | 74 months |

Healthy SaaS is **3:1 LTV:CAC with <12-month payback.** The base case here is **under 1:1, with a 31-month payback against a 20-month average customer lifetime** — meaning, on median assumptions, **ActivityOS may not recover its CAC before the average customer has already churned.** This is the single most important finding in this report: before "how big can this get" is even the right question, "is new-customer acquisition profitable at all" needs an answer — and today it's unmeasured, not just unscaled.

### Working backward from £10M profit

- At a *generous* 25% net margin (mature-SaaS territory a 2-year-old company won't have reached): £10M profit needs **£40M ARR → ~60,600 customers** — more than the *entire current lead pipeline* converted at 100%, with zero churn.
- At a more realistic 10% net margin for a still-scaling company: **£100M ARR → ~150,000 customers.** Not plausible from a 50k-lead database in 24 months.
- Working forward instead, generously: **15,000 paying customers by month 24** (already ~30% of today's *entire* lead database, a huge win against a 0%-contacted starting point) gives **£9.9M ARR, £6.9M gross profit**. Subtract realistic opex at that scale — support (~1 CS rep per 300–400 accounts → 38–50 FTE, £1.6–2.2M/yr), sales (15–20 FTE, £0.7–1.0M/yr), engineering/G&A (15–20 FTE, £0.9–1.2M/yr), plus ongoing CAC cash cost — and **net profit lands around £1–3M, plausibly breakeven. Not £10M.**

### The honest reframe

- **£10M profit in 2 years: not credible on any comp or any unit-economics path found.**
- **£1–3M profit in 2 years, at 5,000–8,000 UK customers with sane unit economics: credible**, and matches what happens when the fastest-scaling real comps in this category eventually got somewhere.
- **£10M profit is a realistic 4–6 year outcome**, and only if two structural fixes happen: (1) cut churn — annual contracts, better onboarding, or a modest take-rate line that also creates switching cost; (2) monetize the lead engine (see below) rather than relying on subscription revenue alone.

### Quarter-by-quarter: how the £1–3M path actually happens

An illustrative pacing plan, back-solved from the credible 5,000–8,000-customer / £1–3M range above at £50–55/mo blended ARPU and the 5%/mo base-case churn — not a new forecast, and not the 15,000-customer generous case. The only numbers in this report that are *measured, not modeled* are in "Start Monday" above; everything below is a planning target to execute against and revise quarterly as real cohort data comes in.

| Quarter | Net active customers (cum.) | Gross ARR (illustrative) | What has to be true |
|---|---|---|---|
| Q1 (mo 1–3) | ~600 | ~£0.4M | First cohort of the 19,284 drafted leads actually sent and worked to a real outcome |
| Q2 (mo 4–6) | ~1,400 | ~£0.9M | Funnel is instrumented; first real conversion-rate and CAC numbers exist |
| Q3 (mo 7–9) | ~2,300 | ~£1.5M | Best-performing segments identified and doubled down on; worst killed |
| Q4 (mo 10–12) | ~3,300 | ~£2.2M | Year-1 close: actual LTV:CAC compared to the 0.64:1 base case, board readout |
| Q5 (mo 13–15) | ~4,300 | ~£2.8M | Churn-reduction lever (annual contracts / take-rate pilot) live and measured |
| Q6 (mo 16–18) | ~5,200 | ~£3.4M | Support/CS function scaled ahead of the ~1:300–400 ratio in §3, so churn doesn't spike |
| Q7 (mo 19–21) | ~6,000 | ~£4.0M | Success-fee engine contributing a measurable revenue line, not just subscriptions |
| Q8 (mo 22–24) | ~6,750 | ~£4.5M | Full 2-year opex readout against §3's cost structure; net profit lands in the £1–3M band or the report is updated with why not |

What specifically happens each quarter — concrete moves, not strategy-speak:

**Q1 — fix and prove the funnel.** Send the first 500 of the 19,284 queued drafts, then scale to the full backlog in weekly batches once reply/demo rates hold up. Run \`uncertain_verify.mjs\` to resolution on the 6,640 uncertain-tier leads. Put one named person in charge of replying to leads and booking demos same-day. Stand up status tracking (new → contacted → demo → won/lost) so Q2 has real data to work from. Draft and price the success-fee term sheet.

**Q2 — systematize what worked.** Pull the Q1 cohort numbers: real reply rate, real demo-to-close rate, real CAC by lead source and activity category. Cut the worst-performing segments from future sends; put the saved effort into the best ones. Hire the first dedicated SDR only if the emerging CAC number makes the §3 payback math plausible — not before. Pitch the success-fee lead engine to 10–20 real providers and get the first paid pilots.

**Q3 — scale UK, gate international.** Keep scaling the UK send/demo motion. Check the §4 gate criteria against real data: has UK conversion held at 8–12%+ for two consecutive months? If yes, greenlight the capped £15–25k Ireland test (landing page + ad spend only, per §4) — it should not pull a single hour from the people running the UK funnel. If no, don't start it yet; say so publicly and keep working UK.

**Q4 — prove or kill, then tell the board.** Close out Year 1 with the actual LTV:CAC, actual churn, and actual CAC — not the base-case assumptions in §3. If the Ireland test ran, apply its pre-registered kill/scale gate. Present the real Year-1 numbers against this report's £1–3M/£10M framing at the board level, including where reality diverged from the plan and why.

**Q5–Q6 — compound what's working.** Put budget behind whichever channel (UK subscription, UK success-fee engine, or Ireland) shows the best LTV:CAC, not the one that feels most exciting. Build out CS/support ahead of the customer count so churn doesn't creep past the 5%/mo base case as the book gets bigger. Re-underwrite every assumption in §3 against a full year of real cohort data and update the numbers in this report accordingly.

**Q7–Q8 — land the number, don't just hope for it.** Push toward the 5,000–8,000 UK customer range (plus Ireland if it scaled). Run the full opex readout — support, sales, eng/G&A — against §3's cost structure so the net profit number is a measured result, not an aspiration. Deliver the final 2-year board readout: did it land at £1–3M as this report predicted, and if not, exactly why not.

---

## 4. The case against spending on international expansion right now

This needs to be argued, not asserted, because the counter-case is real too.

**Why not now:**
1. **You cannot model unit economics you have never measured.** Every CAC/LTV number above is inferred from comparable companies, not from ActivityOS's own funnel — because that funnel has never run to completion once, anywhere, including the market where you have every structural advantage (language, currency, regulation, brand). There is no basis for projecting performance somewhere you have *none* of those advantages.
2. **If a new market underperforms, you can't diagnose why.** Market fit, pricing, localization, or the same broken follow-up process burying 40,378 UK leads — with no functioning UK funnel as a baseline, failure in a new country is unreadable.
3. **Founder/team bandwidth is the tightest constraint, and it's already misallocated.** New legal entities, payment rails, country marketing, support coverage across time zones, and — specific to this vertical — child-safeguarding and data-protection regimes that vary materially by country, all compete for attention against the one proven, already-paid-for asset sitting idle.
4. **Compliance cost in this vertical isn't "translate the website."** Child-safety and data-protection compliance per country plausibly runs £50–150k and multiple months of legal/ops work *before the first paying customer* — spend that produces zero PMF learning.
5. **The opportunity cost is immediate, not hypothetical.** The ~£1.4M ARR available from working the existing dormant pipeline (§1) beats any plausible international return in year one, at near-zero incremental CAC.
6. **It signals the wrong thing to a board.** Approving six-figure international commitments while the single most important funnel metric — lead-to-customer conversion — is literally unmeasured reads as narrative-driven decision-making, not metrics-driven.

**Where the counter-case has real teeth (steelman):**
- If the UK fix is genuinely cheap and fast (a CRM workflow, one SDR hire), "either/or" is a false framing — you can fix the UK funnel *and* run a cheap international test in parallel, as long as the test doesn't compete for the same people.
- If UK TAM alone can't mathematically reach £10M, *some* international motion has to start soon for any aggressive timeline to be reachable at all — which argues for a **cheap, capped market test now**, not full market entry.
- Category-creation first-mover advantage is real; waiting 18 months to "prove it out" domestically risks ceding ground to a well-funded entrant.

**The resolution:** a small, ring-fenced experiment budget (capped £15–25k, landing-page/ad-spend only, no entity, no local hire, no compliance spend, in a zero-localization market) can run in parallel without competing for the resources fixing the UK funnel needs. Real market entry — the kind this report's market-comparables section is about — should wait for:

- Full instrumentation of the existing pipeline (immediate, low-cost)
- A real worked cohort: 5,000–10,000 cold leads systematically contacted within 60–90 days, taken to a true outcome
- A demonstrated UK conversion rate of ~8–12%+ on properly worked leads, sustained across two consecutive months
- Actual CAC, actual churn over a full cohort quarter, and LTV:CAC comfortably above 3:1 — not the 0.64:1 base case above
- A pre-registered kill/scale gate on the capped international test

---

## 5. Is the lead database a moat? No — and that's the actual strategic insight

A moat is something a well-funded competitor *can't* replicate quickly. Today, the 50,489-lead database is not one:

- **It decays.** A parent's spring-club query is worthless by autumn; contact details go stale; consent windows lapse. Every week uncontacted, it loses value.
- **The raw list is replicable — the conversion data isn't.** Any funded competitor can buy an equivalent volume of leads via Meta/Google ads or council directories. What can't be bought is the data you accumulate by actually running leads through contact → book → repeat-book: which lead profiles convert with which provider types, at what price, in what season, with what follow-up cadence. That data only exists once the funnel has run at volume — and nobody has run it yet, including ActivityOS.

### The single highest-leverage move

**Monetize the lead engine as a success-fee layer bolted onto the existing subscription — charge providers only when ActivityOS's own nurture funnel delivers a paying booking — and use that operating loop to build the moat the subscription business doesn't have.**

Concretely: build the machinery to actually work the 40,378 dormant leads (automated + human-assisted contact, qualification, routing to the right local provider), and charge a success fee (e.g. a flat fee per enrolled child, or a modest % of first-term value) *only* on bookings this engine originates. Leave core subscription pricing untouched.

**Why this beats the alternatives:**
- *Vs. adding a blanket take-rate to all bookings (LoveAdmin/Pebble-style):* sacrifices the one clear differentiator, spooks existing subscribers, adds billing complexity — and does nothing about the dead-weight lead database.
- *Vs. a new product feature:* features are copyable in months and generate no proprietary data.
- *Vs. a distribution partnership:* useful, but doesn't fix the inert-asset problem or create switching cost.
- *Vs. leaving it as-is:* it's actively losing value every week.

**Why this is highest-leverage, specifically:**
1. **Fastest path to profit** — activates revenue from an asset already paid for, no new CAC, no new geography.
2. **It builds the real moat** — running the funnel at volume is the only way to generate matching/conversion data a rival would need years, not dollars, to replicate.
3. **It creates genuine lock-in** — providers who depend on ActivityOS as a *customer-acquisition channel*, not just a booking calendar, have a materially higher switching cost than UI preference alone provides. It also directly fixes the LTV:CAC problem in §3 by adding a revenue line that doesn't require new customer acquisition and by giving providers a reason to stay.

This also happens to be the prerequisite for making the churn/monetization fixes in §3 real, and for ever making the international case in §2/§4 numerically honest instead of aspirational.

---

## 6. Where does that leave the nine international markets?

The underlying market research (five independently verified deep-dives, adversarially fact-checked) is genuinely strong and worth preserving for when international entry is actually warranted. Summary, re-ranked with confidence tags:

| Rank | Market | Confidence | One-line why |
|---|---|---|---|
| 1 | **Ireland** | High | Two clean gov't registers (CRO + Tusla, 3,102 providers), low competition, low legal friction. Most rigorously verified market of the nine. |
| 2 | **Denmark** | Medium | Best open-data stack found anywhere (CVR + Dagtilbudsregisteret), national vetting — but must carve out private providers vs. locked-in municipal platforms. |
| 3 | **Netherlands** | Medium | Excellent childcare register (LRK) and a real competitive gap in informal camps — but free business data (KVK) is anonymized, breaking outbound lead-gen without a paid tier. |
| 4 | **Belgium** | Medium | Solid company data, but a "two markets in one" build (language, regulator, competitors per region) plus a government-backed incumbent (Luwio). |
| 5 | **New Zealand** | Medium | Ireland-grade regulatory/data ease — blocked by an entrenched, subsidy-integrated local incumbent (Enrolmy, 2,000+ providers). |
| 6 | **Spain** | Medium | Re-verification found the assumed incumbent (Timeplus) has no supporting evidence of dominance — but real regional registry fragmentation remains. |
| 7 | **France** | Medium | Safeguarding well-centralized, general business data excellent — but the sector-specific ACM registry is fragmented departmental data with no national export. |
| 8 | **Germany** | Low-Medium | No national safeguarding registry or childcare register — but NRW (~18M people) has strong open data, making a state-by-state wedge viable. |
| 9 | **USA (Florida)** | Low | Weak lead-gen data and the most saturated competitive landscape in the world (Jackrabbit 17,000+ locations, CampMinder, Sawyer, Amilia). Avoid. |

**The one caveat that applies to all nine: no market-sizing (TAM) or willingness-to-pay estimate exists for any of them.** Every ranking reflects ease of data access, compliance integration, and competitive risk — not validated commercial opportunity. This is the biggest open question in the market-selection research, independent of the sequencing question in §4.

**This report addresses which country to expand to next, not UK pipeline execution.** Per §1 and §4, resolving the 40,378-uncontacted-leads problem should come before any of this gets funded.

---

## Keeping score: the weekly/monthly KPI list

This report is worthless as a management tool if nobody checks whether it's happening. These are the numbers to watch — not a dashboard wishlist, the minimum set that tells you whether the plan above is on track or needs a hard revision.

### Every week (first review: this Friday)

- **Leads contacted this week** — against the 19,284-drafted / 40,378-never-contacted backlog. Is it moving?
- **Reply rate** on outreach sent (%)
- **Demo bookings this week**
- **Uncertain-tier leads resolved this week** — against the 6,640 backlog
- **Emails sent this week** vs. the running total sent (track progress through the 19,284 queue)

### Every month

- **New paying customers (net adds)** — compare against the quarterly pacing targets above (e.g. ~600 net active by end of Q1)
- **MRR / ARR**
- **Monthly churn rate (%)** — compare against the 5%/mo base case in §3; if it's running hotter, the whole 2-year path in this report needs re-modeling, not just noting
- **Blended CAC (actual)** — compare against the £1,200 base case
- **LTV:CAC (actual)** — compare against the 0.64:1 base case; this is the single number that tells you whether new customers are worth acquiring at all
- **Gross margin (actual)** — compare against the 70% assumption
- **Success-fee engine revenue** (once live) — bookings originated, fee revenue collected, separate from subscription MRR
- **Cash runway / monthly burn**

### Every quarter

- **Cohort payback period (actual)** — compare against the 31-month base case and the 20-month average customer lifetime; if payback is still longer than lifetime, CAC spend should not scale further until that's fixed
- **Progress against the §4 international gate criteria** (8–12%+ UK conversion sustained two consecutive months, LTV:CAC >3:1) — pass/fail, not vibes
- **Re-underwrite §3's assumptions** (ARPU, CAC, churn, gross margin) against the quarter's real numbers and update this report

---

## Bottom line

- **£10M profit in 2 years is not supported by any comp or any unit-economics path in this analysis.** A credible reframe is £1–3M profit in 2 years, with £10M as a 4–6 year outcome contingent on fixing churn and monetizing the lead engine.
- **Base-case unit economics are sub-1:1 LTV:CAC with a payback period longer than the average customer lifetime** — this is more urgent than the international question and than the profit target.
- **The 50,489-lead pipeline, 40,378 never contacted, zero ever marked won/lost, is the single fact that should gate everything else in this report.** It's the cheapest, fastest, highest-leverage lever available — and turning it into a success-fee acquisition engine (not just "fixing follow-up") is the one strategic move that improves the moat, the unit economics, and the profit target simultaneously.
- **International expansion (Ireland first, when it's time) is a good plan for a company that has proven it can convert a lead in its own market.** Right now it hasn't. Spend the next quarter proving that, fund a small capped international experiment in parallel if the timeline truly can't wait, and don't fund a second unproven market on top of a first, unmeasured one.
`;

// --- Tiny, self-contained markdown renderer -----------------------------
// This report is the only place in the app that needs markdown rendering,
// so rather than pull in a library it's parsed here directly: headers (#/##/
// ###), horizontal rules (---), tables (| a | b |), bulleted/numbered lists,
// and inline **bold**/*italic*. Good enough for this one static document —
// not a general-purpose markdown engine.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on **bold** first, then *italic* within the non-bold remainder.
  const nodes: ReactNode[] = [];
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  boldParts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="text-[var(--ink)]">{part.slice(2, -2)}</strong>);
      return;
    }
    const italicParts = part.split(/(\*[^*]+\*)/g);
    italicParts.forEach((ip, j) => {
      if (ip.startsWith("*") && ip.endsWith("*") && ip.length > 1) {
        nodes.push(<em key={`${keyPrefix}-i${i}-${j}`}>{ip.slice(1, -1)}</em>);
      } else if (ip) {
        nodes.push(<Fragment key={`${keyPrefix}-t${i}-${j}`}>{ip}</Fragment>);
      }
    });
  });
  return nodes;
}

function parseTable(lines: string[]): { header: string[]; rows: string[][] } {
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  return { header, rows };
}

function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim() === "---") {
      out.push(<hr key={`hr-${key++}`} className="my-5 border-[var(--line)]" />);
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(
        <h4 key={`h4-${key++}`} className="mb-1.5 mt-4 text-[14px] font-extrabold text-[var(--ink)]">
          {renderInline(line.slice(4), `h4-${key}`)}
        </h4>,
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      out.push(
        <h3 key={`h3-${key++}`} className="mb-2 mt-6 font-[var(--ff-display)] text-[19px] font-extrabold text-[var(--ink)]">
          {renderInline(line.slice(3), `h3-${key}`)}
        </h3>,
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      out.push(
        <h2 key={`h2-${key++}`} className="mb-2 mt-2 font-[var(--ff-display)] text-[22px] font-extrabold text-[var(--ink)]">
          {renderInline(line.slice(2), `h2-${key}`)}
        </h2>,
      );
      i++;
      continue;
    }

    // Table: a line starting with "|" followed by a "|---|---|" separator.
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?[\s:-]+\|[\s:|-]+$/)) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      const { header, rows } = parseTable(tableLines);
      out.push(
        <div key={`tbl-${key++}`} className="my-3 overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--panel)] text-left">
                {header.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 font-semibold text-[var(--ink-2)]">
                    {renderInline(h, `th-${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-[var(--line)] align-top last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-[var(--ink-2)]">
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j;
      continue;
    }

    // Numbered list: "1. text"
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && /^\d+\.\s/.test(lines[j].trim())) {
        items.push(lines[j].trim().replace(/^\d+\.\s/, ""));
        j++;
      }
      out.push(
        <ol key={`ol-${key++}`} className="my-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `oli-${key}-${ii}`)}</li>
          ))}
        </ol>,
      );
      i = j;
      continue;
    }

    // Bulleted list: "- text"
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("- ")) {
        items.push(lines[j].trim().slice(2));
        j++;
      }
      out.push(
        <ul key={`ul-${key++}`} className="my-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `uli-${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      i = j;
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines.
    const paraLines: string[] = [];
    let j = i;
    while (
      j < lines.length &&
      lines[j].trim() !== "" &&
      lines[j].trim() !== "---" &&
      !lines[j].startsWith("#") &&
      !lines[j].trim().startsWith("|") &&
      !lines[j].trim().startsWith("- ") &&
      !/^\d+\.\s/.test(lines[j].trim())
    ) {
      paraLines.push(lines[j]);
      j++;
    }
    out.push(
      <p key={`p-${key++}`} className="my-2 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        {renderInline(paraLines.join(" "), `p-${key}`)}
      </p>,
    );
    i = j;
  }

  return out;
}

export function InternationalExpansionApp() {
  const content = renderMarkdown(REPORT_MARKDOWN.trim());

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <SectionHead>
        International Expansion
        <span className="ml-2 font-normal text-[12px] text-[var(--ink-3)]">
          Fix the UK funnel first — the case against international spend right now, and an honest verdict on the £10M target
        </span>
      </SectionHead>

      <Card className="border-l-4 border-l-[var(--brand)] bg-[var(--surface-2,rgba(127,127,127,0.04))] p-3 text-[13px] text-[var(--ink-2)]">
        Reference document for the platform team — 0% of 50,489 UK leads have ever been contacted, won, or lost. Fix and
        monetize that funnel before funding international expansion; see &quot;Bottom line&quot; at the end for the full
        recommendation.
      </Card>

      <Panel title="International Expansion & the £10M-in-2-Years Target — Consolidated Report">
        <div className="mx-auto max-w-[840px]">{content}</div>
      </Panel>
    </div>
  );
}
