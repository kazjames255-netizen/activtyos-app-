#!/bin/sh
# Website → verify → contacts chain for leads. Run from server/ after find_websites.mjs has produced candidates:
#   sh scripts/leads/pipeline.sh
set -e
node scripts/leads/find_websites.mjs --apply                     # candidates → websiteCandidate (stamps websiteSearchedAt)
node scripts/leads/verify_sites.mjs --kind candidate              # fetch each candidate site, judge name/location/children's wording
node scripts/leads/apply_verify.mjs scripts/leads/out/verify.out.jsonl   # confirm → website, or drop with a reason
node scripts/leads/find_contacts.mjs                              # scrape email/phone from confirmed sites that have neither
node scripts/leads/find_contacts.mjs --apply

# Schools chain (DfE GIAS registers) — separate from the above, own source data, run independently:
#   node scripts/leads/fetch_gias.mjs                                        # download+extract the GIAS CSV export (independent schools)
#   node scripts/leads/import_gias.mjs [--dry]                               # → leads with schoolType/boarding/ageLow/ageHigh (source:"gias")
#   node scripts/leads/import_gias_state.mjs [--dry]                         # state-funded register → schoolPhase/schoolGovernance/trustName (source:"gias-state")
#   node scripts/leads/enrich_schools.mjs --shard i/N [--apply]              # homepage crawl → email/phone/club-language/booking system
#   node scripts/leads/enrich_school_roles.mjs --shard i/N [--apply]         # staff-page crawl → roleContacts (head/pupilPremiumLead/inclusionLead/sendco)
