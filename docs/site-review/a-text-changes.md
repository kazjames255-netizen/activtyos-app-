# Agent A text changes (activly.html, pricing.html)

English text edited in the HTML only; `scripts/i18n-v2/convert.mjs` NOT run (lead re-runs it). The `data-i18n` attributes were left untouched, so changed strings will show their old translation until the converter assigns new keys and the dictionaries are refreshed. Snippets include inline markup where the HTML text had it.

| page | old text | new text | why |
| --- | --- | --- | --- |
| activly | <b>Free to start</b> | <b>7-day free trial</b> | Sign-up takes a card and the trial is 7 days (server/src/routes/subscription.ts); "free to start" was vague. |
| activly | with <b>AI that clears the admin for you</b>. | with <b>an AI assistant that drafts and answers for you</b>. | Shipped AI is a live-data assistant and a message writer, not an autonomous admin-clearer. |
| activly | A polished booking page on your own domain, parents who self-serve, registers on your phone &mdash; without hiring an admin team. | A polished booking page in your own logo and colours, parents who self-serve, registers on your phone &mdash; without hiring an admin team. | No custom-domain feature in the product; storefront takes logo + accent colour. |
| activly | Payments land in your own account next day. A flat fee, never a percentage | Payments go straight to your own Stripe account. A flat fee, never a percentage | Payout timing is Stripe's, "next day" is not guaranteed. |
| activly | Your brand — a booking page on your own domain | Your brand — a booking page in your own logo and colours | No custom-domain feature. |
| activly | Sell sessions from a booking page on your own domain — parents book &amp; pay in two minutes. | Sell sessions from your own branded booking page — parents book &amp; pay in minutes. | No custom domain; "two minutes" unverified. |
| activly | <b>🌐 Your own domain</b>A polished booking page on your own domain and colours — parents book without leaving your brand. | <b>🌐 Your own look</b>A polished booking page in your logo and colours — parents book without leaving your brand. | No custom-domain feature. |
| activly | A booking page on your own domain</h3> | A booking page in your own brand</h3> | No custom-domain feature. |
| activly | Storefront on your own domain</li> | Storefront in your logo &amp; colours</li> | No custom-domain feature. |
| activly | Your logo and colours, installed to the home screen — bookings, wallet and updates in one place. | Your colours on the parent portal — bookings, wallet and updates in one place, on any phone. | No installable-app (PWA) support found in the repo; parent portal is themed by ParentBrandTheme. |
| activly | Monthly pay with estimated PAYE, NI and pension, and payslips in your brand. | Pay runs (weekly to monthly) with estimated PAYE, NI and pension, and payslips in your brand. | Payroll supports weekly/fortnightly/four-weekly/monthly (payroll.ts); figures are estimates. |
| activly | Hire safely, rota fairly and pay accurately — HMRC-ready, with training built in. | Hire safely, rota fairly and pay your team with PAYE, NI and pension worked out — with training built in. | payroll.ts: "Figures are estimates — the RTI/HMRC submission is the payroll provider's". "HMRC-ready" overstated. |
| activly | Rota, timesheets and HMRC-ready payroll &mdash; plus | Rota, timesheets and payroll with PAYE, NI and pension worked out &mdash; plus | Same: no RTI submission in product. |
| activly | Head-counts, ratio maths and allergy flags &mdash; with a locked collection so the right adult takes each child home. | Head-counts, ratio maths and allergy flags &mdash; with an optional collection PIN or password so the right adult takes each child home. | Collection check is a setting (settings.registers.requireCollectionPin / collectionCheck). |
| activly | Locked collection &mdash; verified every time | Optional collection PIN or password | Same. |
| activly | <td data-i18n="activly.next-day-your-stripe-13rr" class="us"><span class="yes">✓</span> Next day, your Stripe</td> | <td data-i18n="activly.next-day-your-stripe-13rr" class="us"><span class="yes">✓</span> Straight to your Stripe</td> | Payout timing is Stripe's. |
| activly | <span class="yes">✓</span> 8 assistants</td> | <span class="yes">✓</span> Built in</td> | Only the AI assistant and message writer are shipped (docs/website-content-plan-v2.md line 582); "8 assistants" untrue. |
| activly | An AI team built in | An AI assistant built in | Same. |
| activly | “Parents book and pay in seconds on our own branded page, and the AI Front Desk answers the calls we used to miss.” | “Parents book and pay in seconds on our own branded page.” | AI Front Desk is not shipped (website-content-plan-v2.md). Quote shortened; Kaz to confirm with the customer. |
| activly | Import your activities and take your first booking this week | Add your sessions and take your first booking this week | No activity importer found; family CSV import exists. |
| pricing | Start with a free trial, no card needed. | Start with a 7-day free trial; your card is taken at sign-up and charged on day 7 unless you cancel. | Trial needs a card on file (subscription.ts: SetupIntent, card charged day 7). "No card needed" was false. |
| pricing | Free trial, no card needed &mdash; on your own brand, money straight to your account. | 7-day free trial &mdash; on your own brand, money straight to your account. | Same. |
| pricing | and you start with a free trial. Standard Stripe | and you start with a 7-day free trial. Standard Stripe | Make the trial length explicit. |
| pricing | Free trial to start</span> | 7-day free trial</span> | Same. |
| pricing | Yes &mdash; import your activities and families, and run in parallel with your old tool until you&rsquo;re ready. Most providers are live within days. | Yes &mdash; import your families from a spreadsheet, and run in parallel with your old tool until you&rsquo;re ready. | Activity import not found; "most providers live within days" unverified. |
| activly | class="eyebrow">One platform · every portal</span> | class="eyebrow">Everything included</span> | Same eyebrow appeared twice in a row (orbit + platform sections). |
| activly | Everything you run, one platform.</h2> | See it up close.</h2> | Third "everything ... one platform" heading in a row; this section shows the screens. |
| pricing | A flat monthly fee &mdash; never a cut of your bookings. Every payment lands in your own account, and you start with a 7-day free trial. Standard Stripe card fees apply on your own Stripe; we never take a slice. | A flat monthly fee, never a cut of your bookings. Every payment lands in your own Stripe account, and you start with a 7-day free trial. Stripe&rsquo;s standard card fees apply and go to Stripe, not us. | Said "never a cut" and "we never take a slice" in one breath; tightened. |
| activly | Add your logo, colours and domain. Your booking page goes live in minutes | Add your logo and colours. Your booking page goes live in minutes | No custom-domain feature. |
| activly | >Your own branding &amp; domain</td> | >Your own branding</td> | No custom-domain feature. |
