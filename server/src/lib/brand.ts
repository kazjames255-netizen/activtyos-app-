// The product name, in ONE place for everything the server says to people (emails, notifications, payment descriptions).
// Override with BRAND_NAME on the API host; the default is the current product name. See docs/brand-go-live-checklist.md.
export const BRAND = (process.env.BRAND_NAME ?? "").trim() || "ActivityLane";

// The product's public web address, for DISPLAY TEXT ONLY (copy such as "visit activitylane.com").
// It is never used to build a link, a webhook, an OAuth redirect or a sender address: those come from
// WEB_URL / API_URL / MAIL_FROM, which must keep pointing at the hosts that work today until the domain is owned and configured.
export const BRAND_DOMAIN = (process.env.BRAND_DOMAIN ?? "").trim() || "activitylane.com";
