# Safeguarding policy template — drafting notes

**For the product owner. Not for providers.**
Companion to `docs/safeguarding-policy-template.md`. Written 2026-09-08.

This file matters more than the polish of the policy. It says what was assumed, what was deliberately left uncertain, and what a provider legally cannot get from a software template no matter how good it is.

---

## 1. The one-paragraph version

The policy is drafted for **England**, for a **non-Ofsted-registered out-of-school activity provider working with over-fives**, because that is the modal user. Every deviation from that profile — under-fives, Ofsted registration, school contracts, other UK nations, overnight provision, online tuition — is handled by a `[CHECK: …]` or a `[PLACEHOLDER]` rather than by a guess. There are **35 `[CHECK: …]` markers**. All of them must be resolved by the adopting provider. Several of them cannot be resolved by us on their behalf, ever, and §5 below explains why. The tables in §6 below cover the substantive ones grouped by theme; a few are repeated inline where the same uncertainty bites in more than one place.

---

## 2. What I assumed

| Assumption | Why | What breaks if it's wrong |
| --- | --- | --- |
| **England** | The DfE out-of-school settings guidance, KCSIE, LADO, MASH and DBS are all England (or England-and-Wales) constructs | Scotland uses PVG not DBS; Wales has a statutory duty to report that England does not; NI uses AccessNI and Gateway teams. §3.7 carries a comparison table and a hard warning not to adopt without a nation-specific review. **If you seed this as a template for a Scottish provider it will be actively wrong, not merely incomplete.** |
| **Over-fives are the default** | Camps, after-school clubs and sports coaching dominate | EYFS bites for under-fives and brings Ofsted notification duties, prescribed ratios and paediatric first aid. §3.5 covers it but flags the exemption for wraparound/holiday care of reception-age-and-above as the most misunderstood point in the sector |
| **Provider is probably not Ofsted-registered, but might be** | The registration tests are genuinely fiddly (hours, days per year, ages, activity type, premises) | Registration brings a separate notification duty that runs alongside — never instead of — referral to social care. §3.6 refuses to state the tests and tells them to get their status in writing |
| **KCSIE is adopted voluntarily, not as a statutory duty** | KCSIE is statutory for schools and colleges only | The policy says this explicitly and tells providers not to claim "KCSIE compliant" as though it were a certificate. This is a correctness point the repo's own copy gets slightly loose about — `features/incidents/safeguarding.ts` uses `ref: "KCSIE"` as the default protocol reference for an out-of-school provider without qualification |
| **The provider has at least two adults** | Everything from one-to-one rules to missing-child procedure assumes it | Genuine sole traders (the `freelancer` portal is a first-class persona in this product) cannot do §16 as written. Flagged inline at §15.2.5 as needing a lone-working risk assessment, but **this is a real gap for the freelancer segment and product should think about it** |
| **Products' feature names as they exist in this build** | Cited from source, not memory | Several cited areas are client-side demo stores (see §4) |

**Naming.** I used `[PLATFORM]` throughout rather than "ActivityOS" or "Wigglekit". Three reasons: the brand is currently TBC (per the Name-TBC marketing site work); a provider adopting this makes it *their* policy, and a vendor name inside a child protection policy reads oddly to an inspector; and it lets the same seed text survive a rename. Feature names (**Log a concern**, **Registers**, **Documents**) are used concretely because they need to be actionable.

---

## 3. Product decisions embedded in the draft

- **Shaped for seeding into Documents.** Category `Policy`, review interval 12 months, assignment `all: true`. It has a version/review header, an adoption block (Appendix E), a review log (Appendix F) and a staff declaration (Appendix G) so the read-and-confirm flow has something to attach to. If you seed it, seed it with `expiry` set 12 months out so it shows **In date** and then **Review in *n* days**.
- **Deliberately front-loaded for the person on shift.** §11 (disclosure script) and §12 (referral) are the operational core; Appendix B is a wall-poster version. Everything else supports those two.
- **Cross-references are to real UI strings**, verified in source: the concern form's *"What happened (facts only)"*, the DSL action log *"What you did about it"*, the eight `DSL_DECISIONS` labels, the register's *"Collection PIN required"* banner, the medication block *"Consent needed before a dose can be recorded"*, the Moments consent gate, the onboarding **Cleared to start / Start on hold** gate, and the **Single Central Record**.
- **§20 (online sessions) is anchored to a real feature.** `isOnlineVenue()` / `venue.kind === "online"` with a *"How to join"* field is already in the listing wizard, so online delivery is a shipped capability, not hypothetical. That is why §20 is long. See §7 below — it is also the biggest product exposure in the whole document.

---

## 4. Where the policy cites the product and the product isn't there yet

I checked these rather than assuming. A policy that points staff at a record store that isn't durable is worse than one that says "keep a paper file".

| Cited as | Actual state | Consequence |
| --- | --- | --- |
| **Documents** library, versions, read receipts | Client-side `localStorage` (`aos.docs.library.v2`, `aos.docs.read.v1`). Header comment: "Front-end demo store; real file storage + the `/api/documents` wiring is Amir's" | The policy's own home is not yet a durable record. Appendix D carries an explicit caveat. **This is the highest-priority backend gap for this feature to be credible** |
| **Team & invites → Onboarding**, Single Central Record | Client-side (`aos.team.onboardrecords.v1`). Header comment says "the real sensitive-data storage + retention is Amir's" | The single central record is the artefact an inspector or a school partner asks for. It cannot be a browser store |
| **Low-level concerns log** (§13.8) | **Does not exist.** There is no distinct low-level concern record type | Left as a `[PLACEHOLDER]` in Appendix D telling the provider to say where theirs lives. **Genuine product gap** — KCSIE Part 4 Section 2 makes this a named expectation, and it is cheap to build (it is a concern record with a different category and a different retention rule) |
| **Named authorised collectors** (§15.6) | Does not exist. Collection control is `collectionPassword` / PIN + free-text `collectedBy` at sign-out + `emergencyName`/`emergencyPhone` | Policy is written to the controls that actually exist rather than inventing a list. **Product gap worth considering** — most providers do hold a named list, and it is the thing a court order dispute turns on (§15.10) |
| **Verbatim child's words** (§11.3.2) | `childVoice` exists in the server schema, described as "what the child said, verbatim" — but `SgForm` does not render a field for it | The policy tells staff to put verbatim words in *"What happened (facts only)"*, whose placeholder already says "in the child's own words where possible". **Surfacing `childVoice` as its own field would be a small change with real value** — a separate verbatim box is the single most useful thing on a disclosure form |
| **External referral reference** (§12.6) | `externalReferral` ("MASH / social care / police reference") is server-only, not on the form | Referrals are recorded as free-text DSL log notes. A structured reference number field would make chasing an unanswered referral (§12.3, last box) far easier |
| **Concern open/closed status** | No lifecycle field. Derived: `⏳ Awaiting DSL` → `✓ DSL actioned`, plus per-action `Mark completed` + `Review by` | Appendix D flags it and asks the provider to define "closed". A real status would help the §26.2 monitoring report |
| **Register notes / nudge log / nappy log** | `localStorage` demo stores | Not cited as records anywhere in the policy — deliberately |
| **Three separate certificate stores** | `Compliance` (`/api/compliance`, server, expiring window **45 days**), staff credentials (`aos.learn.credrecords.v1`, expiring at **60 days**, DBS `renewMonths: 36`, safeguarding `24`), and onboarding `roleCerts` | The policy avoids naming a threshold. **These should be one store with one threshold.** Two different "expiring soon" windows for the same DBS certificate is a bug waiting to be found by an inspector |
| **KCSIE link** | `KCSIE_URL` in `safeguarding.ts` points at `Keeping_children_safe_in_education_2026_.pdf`; the concern PDF footer reads "KCSIE 2026" | **Check that URL resolves.** The policy deliberately never states a KCSIE year. Hardcoding an edition year in an exported safeguarding PDF is a maintenance trap — it should read from settings, and it should be checked every September |
| **A concern needs a booked child** | `IncidentsApp` restricts accident/behaviour records to children with a booking | Fine for accidents. Worth checking that a safeguarding concern about a sibling, a former attendee, or a child seen at a venue can still be recorded — the free-text "Other / staff member" path exists but is not obvious |

One accuracy note on existing product copy: `SG_CATEGORIES` labels FGM as **"FGM (mandatory report)"**, and `protocolFor()` renders *"This is a mandatory report — the DSL must inform the police without delay."* The **personal statutory duty** to report FGM directly to the police falls on specified regulated professionals — health and social care professionals and **teachers** — not on activity-club staff generally. The operational instruction (act without delay) is right; the word "mandatory", unqualified, overstates the legal position for a sports coach. §10.6 of the policy handles this carefully. **Consider softening the in-product label to "FGM" and putting the nuance in the protocol text.**

---

## 5. What a provider legally cannot delegate to a software template

This is the section to put in front of anyone who wants to market this as "compliance in a box". They cannot.

1. **Being the DSL.** A named, contactable, trained human being who makes referral decisions. The system can route to them, alert them and log what they did. It cannot be them. A tenant with `dslName` blank has no DSL, whatever their settings say.
2. **The referral decision itself.** Whether a concern crosses the significant harm threshold is a judgement, made same-day, on facts we do not hold. `DSL_DECISIONS` is a menu, not a decision engine — and it should never become one.
3. **Verifying a person's identity, right to work and DBS.** Someone must physically look at a document and at the face in front of them. The `Cleared to start` gate records that a human did it; it does not do it. Note the trap: an agency can send a different person from the one whose certificate you were emailed (§6.11).
4. **Knowing their registration status.** Whether they must register with Ofsted, and on which register, is a legal question about their own operation. Getting it wrong is a criminal matter in some configurations. We cannot answer it and should never appear to.
5. **Their local safeguarding partnership's procedures, thresholds and timescales.** These vary by council. The multi-authority `contacts.authorities[]` model is the right shape, but the content is theirs.
6. **Retention periods.** No single statutory period exists for out-of-school safeguarding records. It's a documented decision they must make and justify. §23.5 leaves the whole table as placeholders on purpose.
7. **The lawful basis and DPIA for recording children on video.** §20.9. This is the sharpest legal edge in the product and needs a real data protection review, not a template.
8. **Reading it.** The most common failure mode of a template is adoption unread. §0 says so plainly and tells them to delete §0 on adoption.

**Recommendation:** if this is seeded into Documents, seed it in a state that is obviously unfinished — `[PLACEHOLDER]`s visible, status showing as needing review, and ideally a banner that will not clear until the placeholders are gone. A template that looks finished on day one is the failure mode.

---

## 6. Where I was genuinely unsure — every `[CHECK: …]`

Twenty markers. Grouped by how uncomfortable I am about each.

### 6.1 Deadlines and numbers I refused to state

These are the ones where being confidently wrong does real harm, so I wrote a gap instead.

| § | The gap | Why I didn't state it |
| --- | --- | --- |
| **12.5** | Written confirmation of a telephone referral | "Within 48 hours" is widely used and is what the repo's own `DSL_DECISIONS` says — but it is set by the **local** safeguarding partnership, not nationally. I would not print a national-sounding figure that is actually local |
| **12.5** | Local authority acknowledgement / decision timescale | The "one working day" formulation is long-standing in Working Together, but I could not verify it against the current edition and would not assert it |
| **12.5, 13.11** | DBS barring referral deadline | The **duty** is not in doubt. A deadline in days — I do not know one with confidence, and did not invent one. This is one to look up properly |
| **10.6** | FGM mandatory reporting timeframe | I know the duty exists and who it binds. The reporting window (a "close of the next working day" figure is commonly cited) I would not state without checking the current guidance |
| **10.7** | Prevent / ACT Early advice line number | I am not confident enough in a phone number to print it on a wall poster |
| **14.3, App. A** | NSPCC whistleblowing line, Ofsted whistleblowing line | Same. **Never print a helpline number from memory.** The NSPCC main helpline (0808 800 5000) and Childline (0800 1111) I did state — those are in the repo defaults and are stable and widely published |
| **21.2** | RIDDOR triggers | I know a non-worker taken from the scene to hospital for treatment following a work-related accident is reportable. The full trigger list and timescales I left to HSE |
| **23.5** | Every retention period | The whole table is placeholders. Commonly cited: until the child's 25th birthday (schools records-management practice, not statute); much longer periods recommended by IICSA for child sexual abuse records; DBS guidance that certificates should not be kept beyond about six months. **None safe to state as fact.** The policy explicitly warns not to default to early deletion |

### 6.2 Scope questions I could not answer for them

| § | The gap |
| --- | --- |
| **3.2** | Whether the setting falls within local safeguarding partnership "relevant agency" arrangements. Out-of-school providers generally have no statutory s.11 duty, but partnerships can designate locally and commissioners can impose contractually |
| **3.3** | Current title and publication date of the DfE out-of-school settings guidance — it has been revised since first publication |
| **3.4** | Which KCSIE edition is in force (updated with effect from 1 September annually) |
| **3.5** | The EYFS 14-day notification figure and notifiable-event list against the current framework. **I am confident of 14 days** (corroborated by the repo's own course content) but the framework has been restructured into separate group/school-based and childminder documents |
| **3.5.3** | The scope of the learning-and-development exemption for wraparound and holiday care of reception-age-and-above children. **The most misunderstood point in the sector** |
| **3.6** | Ofsted registration tests. I declined to state the hours/days/ages/activity thresholds — they are fiddly and I am not confident |
| **6.6** | DBS regulated activity frequency tests. **I am reasonably confident** of once-a-week / four-days-in-30 / overnight, but the overnight definition and the supervision guidance matter for volunteers |
| **6.6.7** | Whether the disqualification regulations apply to their provision, and the exact citation. The repo's `DISQUAL_DECLARATION` cites "the Childcare (Disqualification) and Childcare (Early Years Provision Free of Charge) (Extended Entitlement) (Amendment) Regulations 2018" — that reads like a real title and matches my recollection, but it should be verified before it goes into a signed declaration |
| **10.7** | Whether they are a Prevent specified authority. Prevent has been actively revised and the specified-authority list should be checked, not recalled |
| **15.2** | Their ratios. Prescribed under EYFS; for over-fives in England there is generally no single statutory ratio and it is a documented judgement, with insurers and NGBs likely imposing their own |
| **20.9** | UK GDPR lawful basis, special-category condition, DPIA requirement and retention for online session recordings |
| **23.3** | The DPA 2018 substantial-public-interest condition for safeguarding children. **I am fairly confident this exists and is the right one**, but I did not cite the schedule/paragraph because I would not want a wrong pinpoint in a record of processing |

### 6.3 Things I stated with confidence, for the record

So you know where the line was drawn: Children Act 1989 s.17/s.47 thresholds; the four categories of abuse; that s.47 duties sit on the local authority not on the provider; LADO referral **within one working day**; the KCSIE Part 4 allegation outcome terminology (substantiated / malicious / false / unsubstantiated / unfounded — with a light check); "child-on-child" as the current term; that a DBS certificate has no expiry date and there is no statutory renewal period; that it is an offence to knowingly engage a barred person in regulated activity; that the position-of-trust offence was extended to sports coaches and faith leaders (substance certain, citation flagged); NSPCC 0808 800 5000; Childline 0800 1111; that data protection is not a barrier to safeguarding information sharing; EYFS complaints — investigate and notify outcome within 28 days, record kept three years.

---

## 7. Things I'd raise with the product owner regardless

1. **Online sessions are a live liability, not a feature idea.** `venue.kind === "online"` ships today with a free-text "How to join" field. That means a provider can, right now, run one-to-one video tutoring with a child through this product, with a joining link they paste anywhere, and nothing in the product says a word about it. §20 is written properly because of that. **Consider making some of it enforceable rather than advisory**: a warning on an online-venue listing that has a capacity of 1; a consent-type flag for online sessions; a place to record that a responsible adult was present. Right now the policy tells providers to do things the product cannot help them do.

2. **The FGM label.** See §4. Small copy change, real accuracy gain.

3. **Low-level concerns.** Named in KCSIE Part 4, absent from the product, and cheap to add. It is also the single control most likely to have caught the organisational abuse cases that led to KCSIE Part 4 existing.

4. **Three certificate stores with two different "expiring" thresholds** (45 days server-side in Compliance, 60 days client-side in credentials). Consolidate.

5. **`dslName` should be a required field, not an optional one.** A tenant operating with a blank DSL name is a tenant whose staff cannot answer "who do I tell?". The concern form falls back to a generic title. Consider a setup nag or a soft gate.

6. **Seeding this document.** `seedDocs()` already creates a placeholder titled *"Safeguarding & Child Protection Policy"* with generic `POLICY_BODY` text. Replacing that seed body with this template would be a genuine upgrade — but only with the §5 warning attached, and only if the placeholders stay visibly unfinished.

7. **Nothing in this policy has been reviewed by a real DSL or a solicitor.** It should not ship to providers until it has. Specifically, a practising DSL should sign off on: §11 (the disclosure script), §12.3 (the flowchart), §13 (the allegations procedure), and §20 (online sessions). Those four sections are where a mistake causes harm rather than embarrassment.

---

## 8. British English

Checked throughout: organisation, recognise, authorised, behaviour, apologise, licence (noun), practise (verb), programme, whilst avoided, "different from", en-GB dates, mobile not cell, holiday not vacation. No US-flavoured constructs ("mandated reporter", "CPS", "K-12", "principal", "field trip", "background check" as a term of art). "DBS check" not "background check"; "children's social care" not "CPS"; "setting" and "provision" used as the sector uses them.
