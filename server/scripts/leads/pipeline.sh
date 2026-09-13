#!/bin/sh
# Website → verify → contacts chain for leads. Run from server/ after find_websites.mjs has produced candidates:
#   sh scripts/leads/pipeline.sh
set -e
node scripts/leads/find_websites.mjs --apply                     # candidates → websiteCandidate (stamps websiteSearchedAt)
node scripts/leads/verify_sites.mjs --kind candidate              # fetch each candidate site, judge name/location/children's wording
node scripts/leads/apply_verify.mjs scripts/leads/out/verify.out.jsonl   # confirm → website, or drop with a reason
node scripts/leads/find_contacts.mjs                              # scrape email/phone from confirmed sites that have neither
node scripts/leads/find_contacts.mjs --apply
