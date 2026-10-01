# Text changes (agent C)

Edited in HTML only; data-i18n keys untouched. The lead re-runs scripts/i18n-v2/convert.mjs.

| page | old text | new text | why |
|---|---|---|---|
| freelancers.html | A booking page on your own domain, parents who book &amp; pay themselves | A booking page in your own brand, parents who book &amp; pay themselves | Own-domain hosting is not live in the product (StorePage comment: subdomain "once hosting/domains exist"); booking page is branded and embeddable. |
| freelancers.html | A polished page on your own domain. Parents book | A polished page in your own brand. Parents book | Same: no custom domain yet. |
| freelancers.html | Payments land in your Stripe next day. A flat fee, never a % — a busy month never costs more. | Payments go straight to your own Stripe account. A flat monthly fee, never a percentage — a busy month never costs more. | Payout timing is Stripe's schedule, not a promise we can make; "flat fee" clarified as monthly (subscription.ts). |
| franchises.html | Split-fees and royalties calculated automatically; each franchisee settles to their own account. | Split-fees and royalties calculated automatically from each franchisee's bookings, and visible to both sides. | Franchises share head office's Stripe payout account and cannot connect their own (routes/payments.ts, PaymentsApp.tsx); /api/splitfees/mine gives the franchisee their own royalty view. |
| franchises.html | Set a feature, listing or policy once and roll it out across every franchisee. | Switch a feature on or off for one franchise, or for all of them at once. | Feature control matrix is real (FranchiseFeaturesApp.tsx); pushing listings/policies to franchises is not found in the code. |
| franchises.html | Draw it in seconds, approve each request, and let the system stop two sites ever clashing. | Draw it in seconds, approve each request, and see at once where two sites overlap. | Territory map shows an approximate overlap warning only; it does not block overlaps (FranchiseTerritoriesApp.tsx). |
| franchises.html | Draw a territory in seconds &mdash; postcode-accurate boundaries. | Draw a territory on the map in seconds. | Territories are hand-drawn map polygons, not postcode boundaries (routes/franchises.ts rings). |
| franchises.html | Overlap protection built in &mdash; no two franchisees clash. | Overlap warnings built in &mdash; spot a clash before you approve. | Warning, not prevention. |
| franchises.html | 5 franchises &middot; own brand, own bank | 5 franchises &middot; own brand, own team | Franchisees do not have their own bank/payout account in the product. |
| schools.html | Which clubs are full and which aren&rsquo;t washing their face | Which clubs are full and which aren&rsquo;t covering their costs | Clumsy idiom, clearer plain English. |
| schools.html | Late collections logged for charging | Late collections flagged to you | Late-collection alert exists (lib/sweeps.ts); automatic charging not found. |
| schools.html | Set a policy, a price list or a club template once and roll it out | Invite schools and track their onboarding | No code found for pushing policies/prices/club templates to member schools; invites + milestones exist (FranchiseInvitesApp, milestones). |
| schools.html | Mark places as funded, free or staff-discounted and they come off | Mark places as funded or free and they come off | Staff-discount place type not found in server/src/lib/childcare.ts or bookings. |
| schools.html | Funded, free and staff places | Funded and free places | Same. |
| schools.html | and can push a policy, price or club template out to every school. | and can switch features on or off for every school at once. | Same as above; Feature control is real. |
