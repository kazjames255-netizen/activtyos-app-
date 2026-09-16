import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();

const now = new Date().toISOString();
console.log(`=== AUDIT SWEEP @ ${now} ===`);

const snap = await db.collection("leads").get();
console.log("total docs:", snap.size);

let statusCounts = {};
let reviewTierCounts = {};
let secondaryNoType = 0, secondaryTypeNoValue = 0;
let websiteSearchedNoResult = 0;
let reviewTierMissingFields = { likely_fit: 0, uncertain: 0 };
let unknownStatusValues = new Set();
let duplicateOfExcludedOverlap = 0;
let dupSamples = [];
let secondarySamples = [];
let websiteSearchSamples = [];
let noContactBadStatus = 0;
let websiteDeadNoWhy = 0;
let bookingMethodNoEvidence = 0;

const KNOWN_STATUSES = new Set(["new", "contacted", "won", "lost"]);

for (const d of snap.docs) {
  const x = d.data();
  const st = x.status ?? "(none)";
  statusCounts[st] = (statusCounts[st] || 0) + 1;
  if (x.status && !KNOWN_STATUSES.has(x.status)) unknownStatusValues.add(x.status);

  if (x.reviewTier) {
    reviewTierCounts[x.reviewTier] = (reviewTierCounts[x.reviewTier] || 0) + 1;
    // reviewTier leads should carry postcode/regAddress per the LIST_FIELDS comment
    if (!x.postcode && !x.regAddress && !x.location) {
      reviewTierMissingFields[x.reviewTier] = (reviewTierMissingFields[x.reviewTier] || 0) + 1;
    }
  }

  if (x.secondaryContact && !x.secondaryContactType) {
    secondaryNoType++;
    if (secondarySamples.length < 5) secondarySamples.push({ id: d.id, name: x.name, secondaryContact: x.secondaryContact });
  }
  if (!x.secondaryContact && x.secondaryContactType) secondaryTypeNoValue++;

  // websiteSearchedAt set but no website / websiteDead / websiteCandidate / comingSoon result recorded
  if (x.websiteSearchedAt && !x.website && !x.websiteDead && !x.websiteCandidate && !x.comingSoon && !x.socialUrl) {
    websiteSearchedNoResult++;
    if (websiteSearchSamples.length < 5) websiteSearchSamples.push({ id: d.id, name: x.name, websiteSearchedAt: x.websiteSearchedAt });
  }

  if (x.duplicateOf && x.excluded) duplicateOfExcludedOverlap++;
  if (x.duplicateOf && dupSamples.length < 3) dupSamples.push({ id: d.id, duplicateOf: x.duplicateOf });

  if (x.websiteDead && !x.websiteDeadWhy) websiteDeadNoWhy++;
  if (x.bookingMethod === "confirmed-manual" && !x.bookingMethodEvidence) bookingMethodNoEvidence++;
}

console.log("\n-- status breakdown --", JSON.stringify(statusCounts, null, 2));
console.log("unknown status values (not in new/contacted/won/lost):", [...unknownStatusValues]);
console.log("\n-- reviewTier breakdown --", JSON.stringify(reviewTierCounts, null, 2));
console.log("reviewTier set but no postcode/regAddress/location:", JSON.stringify(reviewTierMissingFields));
console.log("\nsecondaryContact set but no secondaryContactType:", secondaryNoType);
console.log("samples:", JSON.stringify(secondarySamples, null, 2));
console.log("secondaryContactType set but no secondaryContact value:", secondaryTypeNoValue);
console.log("\nwebsiteSearchedAt set but no result field populated:", websiteSearchedNoResult);
console.log("samples:", JSON.stringify(websiteSearchSamples, null, 2));
console.log("\nduplicateOf AND excluded both set (redundant/conflicting):", duplicateOfExcludedOverlap);
console.log("dup samples:", JSON.stringify(dupSamples));
console.log("\nwebsiteDead=true but no websiteDeadWhy:", websiteDeadNoWhy);
console.log("bookingMethod=confirmed-manual but no evidence:", bookingMethodNoEvidence);

process.exit(0);
