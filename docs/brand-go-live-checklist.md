# ActivityLane brand go-live checklist

Status: **NOT DONE. Nothing below has been changed.** The rebrand in code (branch `rebrand-activitylane-10oct`) is display-only: the name,
the logo and the text `activitylane.com`. Everything that must keep working until the domain is owned and configured still points at today's hosts.

Owner / Amir: do these when `activitylane.com` is bought. Tick each as it is done.

## What the code already does (done in the branch)

- Name: web `BRAND` in `lib/i18n/config.ts`; server `BRAND` in `server/src/lib/brand.ts` (env `BRAND_NAME`, default `ActivityLane`).
- Display domain: web `BRAND_DOMAIN`, server env `BRAND_DOMAIN` (default `activitylane.com`). Display text only, never used to build a link, webhook, redirect or sender.
- Logo: `public/brand/mark.svg`, `logo-light.svg`, `logo-dark.svg`; React `components/ui/Logo.tsx` (`BrandMark`, `BrandWordmark`, `BrandLogo`); icons regenerate with `node scripts/gen-brand-assets.mjs`.
- Icons and tags: `app/favicon.ico`, `app/icon.svg`, `app/apple-icon.png`, `app/manifest.ts` (PWA), `app/opengraph-image.png`, `app/twitter-image.png`; `<link rel=icon>` and OG tags on every `public/*.html` and `public/v2/*.html`.
- Emails: the inline (CID) mark in `server/src/lib/brandLogo.ts` is the new mark.

## Infrastructure to do (all NOT DONE)

### 1. DNS and hosting
- [ ] Buy `activitylane.com` (and consider `.co.uk`, `.uk` redirects).
- [ ] Vercel (project `activtyos-app-`): add `activitylane.com` and `www` as custom domains, make `www` redirect to the apex (or the reverse), keep the `*.vercel.app` address working.
- [ ] Railway API: add a custom domain such as `api.activitylane.com` (optional; the current `activtyos-app-production.up.railway.app` can stay).
- [ ] If the API host changes: update `NEXT_PUBLIC_API_URL` (Vercel) and `API_URL`, `WEB_URL`, `CORS_ORIGIN` (Railway) together, then redeploy both.
- [ ] Set `PUBLIC_WEB_URL`/`WEB_URL` to the new site once it serves, so emailed links use it.

### 2. Email (Resend)
- [ ] Add `activitylane.com` in Resend, publish DKIM, SPF and DMARC DNS records, wait for "verified".
- [ ] Change `MAIL_FROM` on Railway from the current sender to `ActivityLane <no-reply@activitylane.com>` only AFTER verification (the code default still uses the old address on purpose).
- [ ] If inbound email is used: set `INBOUND_EMAIL_DOMAIN` and the MX records for the new domain (`in.activitylane.com`).
- [ ] Per-tenant sending (`<slug>@domain`) follows `MAIL_FROM`'s domain: check one booking email and one invite end to end.

### 3. Stripe
- [ ] Settings > Business > Public details: business name `ActivityLane`, website `https://activitylane.com`.
- [ ] Settings > Branding: upload the mark (`public/brand/icon-512.png`), set brand colour `#14378f`, accent `#ff6f91`.
- [ ] Statement descriptor and shortened descriptor (for example `ACTIVITYLANE`, 5-22 characters, no `<>\'"*`).
- [ ] Connect platform profile: platform name, support email, support URL, icon.
- [ ] Apple Pay: register the new domain (Settings > Payment methods > Payment method domains), host the verification file if asked, keep the Vercel address registered.
- [ ] Webhook endpoint URL: only change if the API host changes; update the signing secret on Railway if the endpoint is re-created.
- [ ] Checkout / PaymentIntent text already says ActivityLane (code); confirm one test payment shows it on the receipt.

### 4. Firebase
- [ ] Authentication > Settings > Authorised domains: add `activitylane.com` and `www.activitylane.com` (keep the existing ones).
- [ ] Email templates in Firebase Auth (verification, reset): change sender name and, if a custom domain is used, the action URL domain.
- [ ] OAuth consent screen (Google sign-in) app name, logo and authorised domain.

### 5. Accounting and other OAuth redirect URIs
- [ ] Xero, QuickBooks, Sage app consoles: add `<API host>/api/accounting/.../callback` for the new API host (only if the API host changes), update the app name and logo.
- [ ] Google Business Profile (`GOOGLE_BP_REDIRECT`) and HMRC Tax-Free Childcare (`HMRC_TFC_REDIRECT_URI`): same, update only if the API host changes. These and the examples in `server/.env.example` still name `api.activityos.uk`; replace when the real host is chosen.
- [ ] Daily.co / video room branding and `DAILY_API_KEY` on Railway (separate open item).

### 6. Search and sharing
- [ ] Google Search Console: add `activitylane.com` as a domain property (DNS TXT), submit a sitemap.
- [ ] Add `metadataBase` (in `app/layout.tsx`) = `https://activitylane.com` and absolute `og:image` URLs once the domain serves (the static pages use a site-relative `/brand/og.png` today, which most crawlers do not resolve; set absolute URLs then).
- [ ] Check the social card with the LinkedIn and Facebook debuggers.
- [ ] Trademark: run a UK IPO and EUIPO search for ActivityLane in classes 9, 35, 41, 42 before spending on print or ads.

### 7. Certificates and verify URLs
- [ ] Staff certificate "Scan to verify" QR: the code no longer hard-codes any domain (the QR prints only when the caller supplies a resolving URL, `features/learning/certificates.ts`; page route `/v/<ref>`). When switching on, pass the real host. NOT DONE.

### 8. Repo / internal names intentionally left as they are
Repo and Vercel/Railway project names, Firestore collection names, package names (`activityos-server`), env var names, the `aos.*` storage and cookie keys, the `window.ActivityOSEmbed` alias in `public/embed.js`, the `activityos:*` postMessage types, CSS `aos-*` classes, test-account domain `@activityos-test.com`, i18n key `messageActivityOS`, `ActivlySiteApp` / `activly-site` view id, and file names `public/activly*.{html,css,js}`.

## Screenshots and media to re-take (they show the old name or the old paper-plane logo)

Not retaken in this pass.
- `public/manual/*` (56 images: `addons/`, `emails/`, `hold/` and the rest): any with the sidebar footer, login or header need re-taking.
- `public/how-it-works/*.webp` and `*.rects.json` (guided-tour frames).
- `public/v2/video/activly-tour.mp4`, `activly-tour-poster.jpg`, `take-a-booking.mp4`, `activly-tour-cues.json`, `tour-cues-i18n.json` (voice-over and captions may say the old name or placeholder). A new ActivityLane promo exists in `~/ActivityOS-QA/runs/video-activitylane`.
- `public/images/logos/*`, `public/mockups*.html`, `public/v2/mockups*.html` (design mock-ups; the legacy `public/*.html` copies redirect to `/v2/`).
- Generated tour data `features/common/tourFixtures.generated.ts` still has fake file URLs on `files.activityos.uk` and `in.activityos.uk` (demo data, never fetched).
- Old marketing documents and slides outside the repo (the onboarding manual artifacts, PDFs).

## Legal wording that needs a solicitor

`public/v2/terms.html`, `privacy.html`, `dpa.html` (and the legacy root copies) now say ActivityLane in place of the old name. Have a solicitor confirm: the contracting entity and its registered name/number (still the old trading name or placeholder), the ICO registration name, and the domain/contact addresses quoted in them. Likewise the DPA sub-processor list and the in-app privacy and terms text.
