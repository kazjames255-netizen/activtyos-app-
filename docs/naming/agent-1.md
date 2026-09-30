# Naming agent 1 - INVENTED / COINED brandable words

Run: 30 Sep - 1 Oct 2026, read-only. NOT legal clearance. Nothing was registered, bought or contacted.

## 1. Product understanding

ActivityOS is a multi-tenant UK platform for children's activity and childcare providers: holiday camps, after-school clubs, schools, solo freelancers/tutors, companies and franchise networks. One login per portal: operators (company / franchise / freelancer), staff, parents (booking, payments, Tax-Free Childcare, trips consent, child profiles) and HQ. Modules: blocks/listings/bookings, timetables and registers, ratios, payroll and payslips, accounting links (Xero/QuickBooks/Sage), messaging, invoices, meals, medication, safeguarding incidents, sales CRM, and a children's Learning/Teaching Hub (lessons, worksheets, quizzes, games). The UI is translated into 11 languages (en ar ur pl ro cy bn pa pt es fr). Positioning (docs/website-content-plan-v2.md): no commission, the provider's own brand and bank, a full back office; voice is plain-spoken, warm, UK, trustworthy on money and child safety. That doc itself flags naming as a launch blocker and notes a near-collision with the schools-only activityos.co.uk. Name needs to work for a parent, a 6am camp owner and a child, and stretch to sub-brands (Hub / Pay / Learn / Book). Repo context read: AGENTS.md, lib/nav/config.ts, features/ and docs/ listings, website-content-plan-v2.md (Activly/Actively appear only as the existing HQ site app and safeguarding doc).

## 2. All 30 candidates

Method: Companies House (CH) search fetched directly (curl, 2.2s gap; top 5 hits recorded per name, statuses from result lines). Domains: registry RDAP direct (Verisign .com, Nominet .uk/.co.uk, Google .app, Identity Digital .io); 200 = registered, 404 = appears free (NOT proof). Web: WebSearch on 14 shortlisted names only; the other 16 were screened on CH + domains only.

| # | Name | Companies House | .com / .co.uk / .uk / .app / .io | Other | Verdict |
|---|------|----------------|----------------------------------|-------|---------|
| 1 | Tumbli | no exact; "Tumbling ..." cafes etc | taken / free / free / taken / free | Tumblr (autocorrect), Tumblies kids game; .com on sale | RED |
| 2 | Kindlo | no exact; Kindlora Care Ltd (active 2025, care), Kindlow dissolved | taken (for sale) / free / free / taken / taken | sounds like Kindle (Amazon, classes 9/41) | AMBER |
| 3 | Sparkora | SPARKORA LTD active (inc. Jun 2026), sector not read | taken / taken / free / free / taken | exact active company | RED |
| 4 | Playora | PLAYORA LTD active (Apr 2026); older dissolved | taken / taken / free / taken / taken | exact active co, play field | RED |
| 5 | Clubbi | Clubbie Ltd/Holdings/Marketplace active (near) | all taken except .uk | near "Clubbie" | AMBER |
| 6 | Zestly | ZESTLY LTD dissolved 2020 | all taken | weak domains | AMBER |
| 7 | Junio | Junio Builders etc active; near | all taken | common name | RED |
| 8 | Kiddaro | none | taken / free / free / free / free | "Kidaro" free learning-assessment app for age 7-10: confusingly close | AMBER |
| 9 | Wrenly | WRENLY LTD active (May 2026) | taken / taken / free / taken / taken | exact active | RED |
| 10 | Tidely | TIDELY LTD active (May 2026) | all taken | exact active | RED |
| 11 | Brambli | none exact (Brambling ...) | taken (live site "Brambli") / free / free / free / free | UK TM journal May 2026: "Brambl" Ltd, classes 9 and 42 incl educational software (one letter off) | RED |
| 12 | Pipli | none exact (Piplish dissolved) | taken (expired) / free / free / free / free | existing "Pipli" iOS app (business discovery/video); Indian place name | AMBER |
| 13 | Hoopo | Hoopo Fly, Hoopo snacks dissolved; Hoopoe near | taken / taken / free / free / taken | reads "hoopoe" | AMBER |
| 14 | Skipply | none | taken / taken / free / taken / taken | Skipply sailing app (May 2026), Skiply school-payments app | AMBER |
| 15 | Ludora | none exact (Ludorati near, different) | taken / free / free / taken / taken | no product found | GREEN (provisional) |
| 16 | Lusio | Lusio Ltd x2, Games Ltd dissolved; Lusio Rehabilitation UK active | taken / free / free / taken / taken | Lusio shopping app | AMBER |
| 17 | Gaudio | GAUDIO LIMITED active (2005) | all taken | exact active | RED |
| 18 | Vivra | VIVRA LTD active (May 2026), Vivra Health active | all taken | exact active | RED |
| 19 | Askio | none exact (Askion) | all taken | domains gone | AMBER |
| 20 | Paidea | none exact (Giata Paidea Ltd) | taken / taken / taken / free / free | mis-spelt "Paideia" | AMBER |
| 21 | Kinvia | none | taken / taken / free / taken / taken | no product found; Kinvolved/KINVO near-ish | GREEN (provisional) |
| 22 | Rallio | none exact (Rallion dissolved) | taken / taken / free / taken / taken | | AMBER |
| 23 | Sessly | none | taken / free / free / taken / taken | no product found | GREEN (provisional) |
| 24 | Campli | none exact (Camplife, Camplify) | taken / free / free / taken / free | Campli is an Italian town; Camplify campervans | AMBER |
| 25 | Buddly | Cuddly Buddly Ltd active (near) | taken / taken / taken / taken / free | | AMBER |
| 26 | Yaylo | YAYLO LTD active (2021), sector not read | taken / free / free / free / free | | AMBER |
| 27 | Mentora | MENTORA LIMITED, Mentora Academy, Mentora AI active | all taken | education-field exact | RED |
| 28 | Growlo | none exact (Growlodge, Growloom) | taken (for sale) / free / free / taken / taken | Growl (Mac software, Growl Media kids apps, Growl TM CA) | AMBER |
| 29 | Fizzio | Fizzio Ltd dissolved; Fizzio-Fit active; Fizziox | all taken | physio-ish | AMBER |
| 30 | Larkly | none | taken (live "Larkly Suncare") / taken / free / taken / free | different field | AMBER |

Observation: every one of the 30 .com domains is registered. For coined words that is normal; realistic plan is .co.uk + .uk (+ .app) with .com as a later buy.

## 3. Best 12 - evidence blocks

Shared caveat for all: UK IPO register (trademarks.ipo.gov.uk) returned HTTP 403 to a scripted fetch; TMview not reachable. Trade mark status below = WebSearch only (Justia, IPO journal snippets, CIPO), which is weak evidence. .co.uk registered means .uk is reserved for that registrant, so ".uk free" only counts where .co.uk is also free. Language checks are my own reading, not native-speaker review. Sub-brand ideas are purely illustrative.

### 1. Ludora - 76 - GREEN (provisional)
- Rationale: Latin ludus/ludere (play); sounds like "Pandora/Eudora" warmth; "Ludo" is a beloved board game in South Asia (ur/bn/pa audience); Romanian/Portuguese/Spanish "ludic/lúdico" = playful. 3 syllables, LOO-DOR-a.
- Sub-brands: Ludora Book, Ludora Pay, Ludora Learn, Ludora Hub.
- Companies House: no exact hit; only Ludorati (cafe, tech, UK, foundation) - different word.
- Trade mark: no Ludora mark surfaced in web search (unreadable registers). Not cleared.
- Domains: .com registered (live, no title); .co.uk and .uk appear free; .app, .io registered.
- Web: searches for app/platform/education/company found nothing named Ludora; near: Ludus, Ludenso, Ludos Pro (all different). No social check possible.
- Language: Eudora/Pandora mishear possible; "Ludora" typed as "Ludura" likely. No negative meaning spotted in 11 languages (Romanian "ludic" positive). Autocorrect risk low.
- Score: clearance 20, distinct 16, memorability 12, meaning 11, intl 8, extend 9.

### 2. Sessly - 74 - GREEN (provisional)
- Rationale: session + -ly; the product sells and registers "sessions" (blocks, registers, timetables). Friendly, UK-tech tone.
- Sub-brands: Sessly Pay, Sessly Learn, Sessly Register.
- Companies House: no hit at all.
- Trade mark: none surfaced (search noise only).
- Domains: .com registered (not serving); .co.uk and .uk appear free; .app, .io registered.
- Web: no product named Sessly; nearest Sesami (Shopify booking app), Selly (e-commerce).
- Language: Polish sesja, Romanian sesiune, Spanish sesión all related, good. "Sesly"/"Cessly" spelling ambiguity; might be heard as "Sessile". 
- Score: 21, 14, 11, 12, 8, 8.

### 3. Kinvia - 74 - GREEN (provisional)
- Rationale: kin (family) + via (way): "the way for families". Soft, trustworthy, not childish.
- Sub-brands: Kinvia Book, Kinvia Pay, Kinvia Learn, Kinvia Team.
- Companies House: no hit.
- Trade mark: none surfaced; near: Kinvict LLC (US, unrelated), Kinvolved/KINVO school-attendance app (US, similar sector, different word).
- Domains: .com and .co.uk registered (not serving); .uk appears free but reserved if co.uk owner wants it; .app and .io registered.
- Web: no Kinvia product found; "Sinvia" app in UK App Store appeared (different).
- Language: via = way/through in es/pt/fr/ro; no bad reading found. Pronunciation KIN-vee-a vs "Kenya"-ish risk small.
- Score: 20, 16, 10, 10, 9, 9.

### 4. Larkly - 69 - AMBER
- Rationale: lark = joyful/skylark; warm, playful, UK.
- Sub-brands: Larkly Pay, Larkly Learn, Larkly Book.
- Companies House: no hit.
- Trade mark: none found; "Larky" (US, rabbit design) is the near mark.
- Domains: larkly.com live as "Larkly Suncare" (another business); .co.uk registered; .uk free/reserved; .app registered; .io appears free.
- Web: no software product; Lark (ByteDance suite) is adjacent in SaaS.
- Language: "lark about"/prank in English is fine; nothing bad elsewhere found.
- Score: 17, 14, 12, 11, 8, 7.

### 5. Campli - 67 - AMBER
- Rationale: camp + -li; instantly says holiday camps but under-sells after-school, freelancers, parents' payments.
- Sub-brands: Campli Pay, Campli Learn.
- Companies House: no exact; Camplife, Camplify Co (UK) Ltd (campervans), Camplight.
- Trade mark: nothing exact found; results noise (Campari, Campa).
- Domains: .com registered (not serving); .co.uk, .uk appear free; .app registered; .io appears free.
- Web: nothing named Campli; Camplify, CamplinQ, Campilo near (camping field).
- Language: Campli is an Italian town (Teramo); reads like "Campari" (alcohol) to some. 
- Score: 19, 12, 12, 10, 7, 7.

### 6. Kindlo - 66 - AMBER
- Rationale: kind + kindle (spark a love of doing things). Warm.
- Sub-brands: Kindlo Pay, Kindlo Learn.
- Companies House: no exact; Kindlora Care Ltd (active, care sector - near), Kindlow Ltd dissolved.
- Trade mark: Kindle (Amazon) is famous in classes 9/41/42; "Kindlo" likely to attract an opposition. Not searched on registers (403).
- Domains: .com for sale (Spaceship); .co.uk/.uk appear free; .app, .io registered.
- Web: no Kindlo product found; childcare neighbours Kindoro, Kindynow, KindiCare.
- Language: no issue found; heard as "Kindle-o".
- Score: 12, 13, 12, 13, 8, 8.

### 7. Lusio - 64 - AMBER
- Rationale: Latin lusio/lusus = play. Short, clean.
- Sub-brands: Lusio Learn, Lusio Hub.
- Companies House: Lusio Ltd (2) and Lusio Games dissolved; Lusio Rehabilitation UK Ltd active (health).
- Trade mark: not found; unread registers.
- Domains: .com registered; .co.uk and .uk appear free; .app, .io registered.
- Web: Lusio shopping app (App Store).
- Language: fine; "Lucio/Luzio" spelling variants.
- Score: 16, 14, 9, 10, 8, 7.

### 8. Growlo - 63 - AMBER
- Rationale: grow + -lo; growth for children and for provider businesses.
- Sub-brands: Growlo Pay, Growlo Learn.
- Companies House: no exact; Growlodge, Growloom (marketing).
- Trade mark: GROWL marks (Canada) surfaced; UK unread.
- Domains: .com for sale; .co.uk/.uk appear free; .app, .io registered.
- Web: nothing exact; Growl Media/Appy Kids (kids apps), Growappy (school-family comms).
- Language: "growl" (animal) reading, not warm.
- Score: 17, 12, 11, 9, 7, 7.

### 9. Pipli - 61 - AMBER
- Rationale: pip/pippin, tiny and friendly; short.
- Companies House: no exact.
- Trade mark: none surfaced.
- Domains: .com expired Squarespace site (registered); .co.uk, .uk, .app, .io appear free.
- Web: existing Pipli iOS app (business discovery and video) - in app-store class.
- Language: pipli/peepal (Hindi/Punjabi tree, Indian town) - neutral; Spanish/Romanian "pipi" childish slang.
- Score: 14, 14, 12, 8, 6, 7.

### 10. Skipply - 60 - AMBER
- Rationale: skip + -ly, playground feeling.
- Companies House: none. Trade mark: none surfaced.
- Domains: .com and .co.uk registered; .uk appears free; .app, .io registered (.com/.co.uk serve HTTP 200).
- Web: Skipply sailing learning app (launched May 2026), Skiply school-payments app.
- Language: skip = UK rubbish bin; double-p typo risk.
- Score: 14, 13, 10, 9, 8, 6.

### 11. Brambli - 60 - RED
- Rationale: bramble/berry, hedgerow UK warmth.
- Companies House: no exact; Brambling (several).
- Trade mark: "Brambl" (UK Trade Mark Journal 29 May 2026 / 5 May 2026 per search snippet), classes 9 and 42, including educational software and SaaS - one letter from Brambli. Not verified on the register.
- Domains: .com live ("Brambli"); .co.uk, .uk, .app, .io appear free.
- Language: fine. 
- Score: 11, 13, 11, 9, 8, 8.

### 12. Tumbli - 50 - RED
- Rationale: tumbling play; too narrow (gymnastics) and "Tumblr" autocorrect.
- Companies House: no exact. Trade mark: Tumblr (famous, class 9/42).
- Domains: .com on sale (Afternic); .co.uk/.uk appear free; .app registered; .io appears free.
- Web: Tumblies kids game, Tumbly baby tracker.
- Score: 9, 10, 11, 8, 7, 5.

## 4. What I could not check
- UK IPO trade mark register: HTTP 403 (bot/JS wall). TMview, WIPO Global Brand Database, EUIPO eSearch not readable. Trade mark status is WebSearch snippets only. Nice classes 9, 35, 41, 42, 43, 45 were NOT properly checked.
- Companies House: only the top 5 results per name were recorded, and the SIC code / sector of exact hits (e.g. Sparkora, Yaylo) was not read. Status taken from the search result lines only.
- Domains: RDAP only; .co was skipped (the RDAP endpoint gave false 404s). "Appears free" = registry reported not found; premium/reserved/aftermarket pricing not checked. No whois.
- Web search is a US-only search engine and returned noisy results; 16 of the 30 names (the ones ranked outside the best 12) were screened on CH and domains only with no web search.
- Social handles, app store listings, Google Play searches: only incidental. Not checked directly.
- 11-language meaning checks: my own knowledge, no native speakers; ar/ur/bn/pa transliteration sounds not tested.
- Not legal advice; a solicitor's knock-out and a full UK/EU search are needed before any spend.

## 5. Merge data

```json
[
  {"name":"Ludora","angle":"coined - Latin ludus (play)","score":76,"verdict":"GREEN","domains":{"com":"taken","coUk":"appears free","app":"taken"},"companiesHouse":"no exact match; Ludorati (different word) only","tradeMark":"none surfaced via web search; UK IPO register returned 403, unread","notes":"Ludo game resonance in ur/bn/pa; Eudora/Pandora mishear risk"},
  {"name":"Sessly","angle":"coined - session + ly","score":74,"verdict":"GREEN","domains":{"com":"taken","coUk":"appears free","app":"taken"},"companiesHouse":"no hits","tradeMark":"none surfaced; registers unread","notes":"fits sessions/blocks; spelling ambiguity Sesly/Cessly; .uk appears free"},
  {"name":"Kinvia","angle":"coined - kin + via","score":74,"verdict":"GREEN","domains":{"com":"taken","coUk":"taken","app":"taken"},"companiesHouse":"no hits","tradeMark":"none surfaced; Kinvolved/KINVO near, different word","notes":"via = way; .uk appears free but reserved to co.uk owner's right"},
  {"name":"Larkly","angle":"coined - lark + ly","score":69,"verdict":"AMBER","domains":{"com":"taken (Larkly Suncare)","coUk":"taken","app":"taken"},"companiesHouse":"no hits","tradeMark":"none found; Larky (US) near","notes":"different-field .com owner; Lark (ByteDance) adjacent SaaS"},
  {"name":"Campli","angle":"blend - camp + li","score":67,"verdict":"AMBER","domains":{"com":"taken","coUk":"appears free","app":"taken"},"companiesHouse":"no exact; Camplife, Camplify Co (UK) Ltd near","tradeMark":"nothing exact found; registers unread","notes":"camp-narrow; Italian town; Campari sound-alike"},
  {"name":"Kindlo","angle":"blend - kind + kindle","score":66,"verdict":"AMBER","domains":{"com":"taken (for sale)","coUk":"appears free","app":"taken"},"companiesHouse":"no exact; Kindlora Care Ltd active near","tradeMark":"Kindle (Amazon) proximity; registers unread","notes":"opposition risk from Kindle"},
  {"name":"Lusio","angle":"coined - Latin lusio (play)","score":64,"verdict":"AMBER","domains":{"com":"taken","coUk":"appears free","app":"taken"},"companiesHouse":"dissolved Lusio Ltd x2; Lusio Rehabilitation UK active","tradeMark":"not found; registers unread","notes":"Lusio shopping app exists"},
  {"name":"Growlo","angle":"blend - grow + lo","score":63,"verdict":"AMBER","domains":{"com":"taken (for sale)","coUk":"appears free","app":"taken"},"companiesHouse":"no exact; Growlodge, Growloom","tradeMark":"GROWL marks (CA) seen; UK unread","notes":"growl reading is not warm"},
  {"name":"Pipli","angle":"coined - pip + li","score":61,"verdict":"AMBER","domains":{"com":"taken (expired site)","coUk":"appears free","app":"appears free"},"companiesHouse":"no exact match","tradeMark":"none surfaced; registers unread","notes":"existing Pipli iOS app; pipli/peepal in Hindi/Punjabi"},
  {"name":"Skipply","angle":"coined - skip + ply","score":60,"verdict":"AMBER","domains":{"com":"taken","coUk":"taken","app":"taken"},"companiesHouse":"no hits","tradeMark":"none surfaced; registers unread","notes":"Skipply sailing app (2026), Skiply school payments"},
  {"name":"Brambli","angle":"altered spelling - bramble","score":60,"verdict":"RED","domains":{"com":"taken (live)","coUk":"appears free","app":"appears free"},"companiesHouse":"no exact; Brambling near","tradeMark":"Brambl (UK journal May 2026, classes 9 and 42 incl educational software) one letter off; unverified on register","notes":"probable opposition"},
  {"name":"Tumbli","angle":"altered spelling - tumble","score":50,"verdict":"RED","domains":{"com":"taken (for sale)","coUk":"appears free","app":"taken"},"companiesHouse":"no exact match","tradeMark":"Tumblr proximity","notes":"too narrow; autocorrects to Tumblr"}
]
```
