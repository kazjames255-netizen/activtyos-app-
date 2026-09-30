# Marketing website (public/v2) - language switching

Status log and handbook for the 11-language public website (en, ar, ur, pl, ro, cy, bn, pa, pt, es, fr).
Written overnight 30 Sep - 1 Oct 2026. Nothing here has been pushed.

## What the visitor gets
- A language dropdown (native `<select>`, globe icon, native language names) in the shared header of every page
  (`#aosLang`; on `parents.html` it sits at the end of the right-hand nav).
- Choice order: saved choice (`localStorage` key `aos-lang`, also a `aos-lang` cookie) -> `navigator.languages` if supported -> English.
- The choice persists across pages, reloads and tabs (storage event). Switching is in place (no reload) and is reversible: back to English
  restores the literal English.
- Applied before first paint: an inline script in `<head>` sets `<html lang dir>` and a class that hides `<body>` until the dictionary has been
  applied (fail-safe: shown after 3.5 s even if the dictionary cannot load). English visitors see no delay and no hidden body.
- RTL (ar, ur): `dir="rtl"` on `<html>` (layout, flex and grid mirror by themselves), plus targeted fixes in `i18n.css`
  (inline `margin-left:auto`, carousel arrows, letter-spacing off for Arabic script, prices/numbers isolated as LTR runs).
- Translated pages get `<title>`, alt text, aria-labels and placeholders translated too. Legal pages and pricing show a translated notice at the top
  that the English version is the binding/authoritative one, with a link that switches back to English.
- Currency stays GBP; Western digits are used in every language.

## How it works (files)
| File | Role |
| --- | --- |
| `public/v2/i18n.js` | Loader + runtime (single script, ~8 KB). `BRAND` / `HTML_BRAND` constants live here. |
| `public/v2/i18n.css` | Selector styling, `i18n-wait` hiding, legal notice banner, RTL fixes. |
| `public/v2/i18n/en.json` | English source: `key -> string` (2401 keys), rebuilt from the HTML by the converter. |
| `public/v2/i18n/<lang>.json` | One dictionary per language (ar ur pl ro cy bn pa pt es fr), 2401 keys each. |
| `scripts/i18n-v2/` | Converter and QA tools (NOT served): `convert.mjs`, `inject.mjs`, `check.mjs`, `merge.mjs`, `rebrand.mjs`, `review-keys.mjs`, `dynamic.json` (script messages), `delta/` (keys added after the translation chunks were cut). |
| `e2e/v2-i18n.spec.ts` | Playwright spec (run via `scripts/e2e-locked.sh`). |

English stays literal in the HTML (no-JS visitors and crawlers get English). Elements carry `data-i18n="key"` (element content) and
`data-i18n-attr="alt:key;aria-label:key2"` (attributes, incl. `<meta name=description>`). Strings with inline markup use indexed tags:
`<1>..</1>` = the 1st element of the original (its class/href kept), `<2/>` = an element kept as is (icon/price), `<br>`, and `{brand}` for the product name.
A translation whose tags do not match the English is rejected by `merge.mjs`/`check.mjs` and, at runtime, ignored (English stays).
Keys are content-addressed (`page.first-words-hash`; `g.` = shared by 2+ pages), so they are stable across re-runs.

### Repeatable workflow
```
node scripts/i18n-v2/inject.mjs      # head loader + selector into every page (idempotent)
node scripts/i18n-v2/convert.mjs     # add hooks for any new English text, rebuild en.json (idempotent; edit English in the HTML, re-run)
node scripts/i18n-v2/check.mjs       # HTML keys vs en.json, every language: missing keys, tag mismatches, brand token
```
New English text -> new keys appear in `en.json`; put the translations in `scripts/i18n-v2/delta/<lang>.json` (merged by `merge.mjs`) or re-cut chunks.
Missing keys are not fatal: that string simply stays English in that language (and the e2e leftover detector reports it).

### Renaming the product
`node scripts/i18n-v2/rebrand.mjs NewName` changes the brand constants in `i18n.js`, the literal English in every page, and rebuilds `en.json`;
all 10 dictionaries use `{brand}` so they follow automatically. The two-tone logo wordmark (`Activ<span class="os">ly</span>` and the SVG `<tspan>`)
becomes plain text: restyle by hand if needed. Brand names are never translated. Pages that load after a rename but before the HTML is rewritten are
kept in sync at runtime by `i18n.js` (it rewrites the literal brand while `BRAND != HTML_BRAND`).

## Pages
All 18 live pages are keyed and have dictionaries in all 10 languages: activly (home), parents, companies, franchises, freelancers, schools,
pricing, tour, safeguarding, security, dpa, privacy, terms, platform-bookings, platform-comms, platform-finance, platform-safeguarding, platform-staff.

| Page | text hooks | attribute hooks |
| --- | --- | --- |
| activly | 503 | 22 |
| parents | 271 | 5 |
| companies | 482 | 13 |
| franchises | 210 | 7 |
| freelancers | 315 | 9 |
| schools | 248 | 5 |
| pricing | 189 | 12 |
| tour | 80 | 5 |
| safeguarding | 134 | 5 |
| security | 93 | 6 |
| dpa | 126 | 5 |
| privacy | 158 | 5 |
| terms | 159 | 5 |
| platform-bookings | 131 | 6 |
| platform-comms | 182 | 6 |
| platform-finance | 231 | 5 |
| platform-safeguarding | 175 | 5 |
| platform-staff | 252 | 5 |

Not converted (and why):
- `mockups.html`, `mockups2-7.html`, `mockups-v2.html`, `companies.prehero.html`: design scratch / backup pages, not linked from the live navigation.
- `public/*.html` (older copies at the web root), `public/courses/safeguarding.html` (self-contained e-learning lesson, copy lives in a JS object), `public/embed.js`
  (partner widget), `public/how-it-works/` (images + json only, no text): outside `public/v2/` and not part of the marketing navigation; `/demo`, `/login`, `/signup` are app routes (other agent's scope).
- There are no `courses/` or `how-it-works/` folders inside `public/v2/`.
- JavaScript-generated text: only `pricing.html` (add-on form messages, slot labels) creates user-facing text in script; those 15 messages use `window.aosT(key, english)` and are in the dictionaries (`js.*`); slot dates/times use the page language. The dev-only "Updating..." flag is not translated.

## Numbers
- 2401 keys (2386 page strings + 15 script/notice strings), identical key set in every language file. About 128,000 English characters.
- Translations are identical to the English for 116-162 keys per language (brand/product/person/place names, plan reference codes, acronyms); this is intended.
- The 2,400 strings were machine-drafted by one model pass per language (not by native speakers). See the risks below.

## Verification (what was actually run)
- `node scripts/i18n-v2/check.mjs`: 0 missing keys, 0 tag mismatches, 0 brand-token mismatches in all 10 languages.
- English unchanged (run 1 of `e2e/v2-i18n.spec.ts`, against the pristine copies in `public/v2/_orig/`): visible English text identical on all 18 pages and pixel diff
  0.000% at 1440 and 390 px on 17 of 18 pages; home page 0.08% (1440) / 0.18% (390), which is the animated counters/marquee; the language selector is hidden for this comparison (it is new).
  One deliberate source fix (see below) changes the Urdu/Punjabi names on the parents page.
- Leftover-English detector (hooked elements still showing English where the dictionary has a translation): 0 in Romanian on all 18 pages (browser sweep), missing keys 0.
- Unhooked visible text (would stay English in every language): only the logo wordmark, 2-3 letter avatar initials/abbreviations, language names and "AI"/"HO"-style abbreviations.
- Overflow: no horizontal overflow at 390 px in Urdu on any of the 18 pages (browser sweep, iframe at 390 px); at desktop width none on the pages spot-checked in Arabic.
  Full results of the Playwright matrix (10 languages x 18 pages x 2 widths) are appended at the bottom of this file when the run finished.

## Known issues, limitations, honest risks
1. **Translation quality.** These are model drafts, consistent with the app glossary (`docs/i18n-glossary.md`, `lib/i18n/messages`) where it had a term, but no
   native speaker has read them. Marketing idioms and headlines in particular need a native read (Welsh, Bengali, Punjabi, Urdu highest risk). The translators' own
   uncertainty notes are summarised below.
2. **Legal, safeguarding, pricing and claims: needs native-speaker and legal review before relying on it.** 814 strings are flagged in
   `docs/i18n-website-review-keys.tsv` (legal pages privacy/terms/dpa/security/safeguarding: 371; pricing: 128; platform-safeguarding: 107; plus every
   other string that mentions compliance, security, price, refund, commission, consent etc.). Machine-quality translation of legal wording is a real
   risk; every translated legal page and the pricing page show the "English version is binding" notice, and the English text of the legal pages is itself marked
   "Draft for review ... [TBC]" (placeholders for the operating company details are translated but still TBC).
3. **SEO.** Crawlers and link previews see English only (one URL per page, language chosen client-side). Per-language URLs (`/v2/ar/...` or `?lang=`),
   `hreflang` alternates and server-side rendering are the future option; not added because they would need per-language static files or edge rewrites on Vercel.
   `<html lang>` and `<title>` are updated for users and screen readers after load.
4. **No-JS / blocked script:** English is shown (fully usable); the language selector does nothing.
5. **Mockup text is translated too** (it is live HTML) so translated strings inside small mock screenshots can be longer than the English and look tighter; at 390 px the
   home-page hero dashboard mock is already cramped in English (KPI labels break per character in a 24 px column); this is pre-existing and was not changed.
6. **Source bugs found in the English (not changed, flag to the content owner):**
   - `privacy.html` (2 places, section about End-User data and the "intended for businesses" paragraph) and possibly others: "our Data Processing Agreement" is immediately followed by an
     extra link "Safeguarding" (`...</a><a href="/v2/safeguarding.html">Safeguarding</a>.`). The translations keep the same structure.
   - `parents.html` language strip: Urdu was written in Devanagari ("उर्दू") and Punjabi as a mix of Devanagari and Gurmukhi. Fixed in the HTML to "اردو" and "ਪੰਜਾਬੀ" (these are the only English-source edits made; both unhooked native names).
   - `parents.html` had no `<title>`; added "For parents - Activly" (hooked for translation). No page has a `<meta name=description>`, so none was translated; adding descriptions is a content decision.
7. Dates/times in demo mockups are translated text (e.g. 12-hour am/pm became 24-hour in several languages, weekday/month abbreviations localised). Digits stay Western.
8. Arabic/Urdu: some decorative elements (orbit diagram labels on the home page) are tight with longer Arabic labels; one label partly overlaps a neighbour at 1280 px.
9. `window.aosSetLang(lang)` / `aosT(key, fallback)` / event `aos:lang` are available to other scripts. A dev cache-buster `?v=1` is set in the loader (`VERSION` in `inject.mjs`); bump and re-run `inject.mjs` when dictionaries change and you need clients to refetch.

## Translator uncertainty notes (for the native-speaker review)
- ar: "rota" = جدول المناوبات, "ratio" = نسبة, franchise = الامتياز التجاري (app role label is فرع); "The pitch" (companies) read as a sports pitch = الملعب (could be a sales pitch); DPA abbreviated as اتفاقية معالجة البيانات in short strings; weekday/month names spelled in full.
- ur: terms spot-checked against `lib/i18n/messages/ur.ts` only; "[TBC]" translated as "بعد میں طے ہوگا"; week chips ہ1..ہ6.
- es: "actividad" for listing, "bono" for block, formal "usted" on dpa/privacy/terms, "tú" elsewhere (safeguarding and security pages use "tú": formal would be the alternative); `pricing.99-mo-hq` is longer than English.
- fr: vous; `£`/`%` kept in English typography (not "29 £"/"0 %"); provider = "organisateur"; "The pitch" = "Le terrain".
- pt (European): "montra" for storefront, "prestador", "Ama" (childminder), "ATL"/"Creche" for nursery/day care.
- pl: capitalised Ty/Twój; "wizytówka" for storefront; week chips T1..T6; "Ponagl" as a short button label.
- ro: "tu" forms; provider = furnizor; "serie" for block (c01 used "pachete"); "TBC" = "de confirmat".
- cy: "chi"; "DPAau" for KPIs, "ACLl" for LA; several marketing idioms to be checked.
- bn: safeguarding = শিশু সুরক্ষা (app uses নিরাপত্তা = security); week chips স1..স6 very short; "nan" (grandma) rendered as দিদিমা/ঠাকুমা.
- pa: "TBC" = ਬਾਕੀ (ambiguous); week chips ਹ1..ਹ6; two idioms (not washing their face / archaeology project) worth checking.
- All languages: `g.w1..g.w6` (week chips) and very short UI labels.

## Playwright results (run via scripts/e2e-locked.sh, 1 Oct 2026 early hours)
`e2e/v2-i18n.spec.ts` with `V2_MORE=pl,cy,bn,pa,pt,fr`: 201 tests, all passed (selector/persistence/restore-English, navigator.language default, keyboard/label,
18 pages x 10 languages: lang/dir correct, selector value, 0 leftover English, 0 missing keys, 0 unhooked visible text (allow-list: logo, initials, language names),
legal/pricing notice visible, no horizontal overflow at 1440 and 390 px, plus English text + pixel diff vs the pre-conversion pages for all 18 pages).
`public/v2/_orig/` (pristine copies used for the English diff) was deleted afterwards so it is not deployed; the English-diff tests then skip. To re-run them:
`git show 59be6012:public/v2/<page>.html` into `public/v2/_orig/` (never commit it).
Screenshots of every page in ar and es at 1440/390 were taken and spot-checked by eye (RTL mirroring, footer, pricing, franchises, schools at 390 OK).
