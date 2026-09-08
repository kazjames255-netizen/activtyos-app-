# Safeguarding, as operated in Wigglekit

**A policy you can adopt, written around the controls the system actually gives you.**

Version [0.1] · Adopted [DATE] · Next review [DATE] · Owner [NAME]

---

## 0. What this is, and why it's short

Most safeguarding policies describe an intention. This one describes a **system**, because the setting it covers runs on one. Every clause below names the screen the control lives on, the setting that turns it on, and what happens if someone tries to skip it.

Two consequences worth understanding before you adopt it:

- **Where the system enforces something, the policy says "cannot".** Those are not aspirations — the server rejects the action.
- **Where the system only prompts, the policy says "must", and that word is doing all the work.** A person can still ignore a prompt. §11 lists every place that's true, honestly, so you know where your risk actually sits.

This is a template. It is not legal advice, and it does not make you compliant on its own — it makes your written policy and your software agree with each other, which is the bit that usually falls apart.

---

## 1. Who is accountable

| Role | Name | How the system knows |
|---|---|---|
| Designated Safeguarding Lead | [NAME] | **Setup → Safeguarding → DSL name / title** |
| Where concerns are emailed | [EMAIL] | **DSL email** (blank = the account holder) |
| Deputy / cover | [NAME] | [Not a system field — record here] |

**Set the DSL before you take a single booking.** The field is optional in the software, which means a setting can operate with it blank — and a blank DSL means staff have no answer to "who do I tell?" If it is empty, this policy is not in force.

---

## 2. Who can see what

Access is by **role**, set in **Setup → Roles & permissions** as a None / View / Edit matrix per area.

- Safeguarding and medical information is shown to staff **on the register they are working**, not to everyone with a login.
- Staff see operations. Staff do not see money — that separation is deliberate and should stay.
- Each location's staff see their own children. On a franchise or multi-school network, data is scoped so one site cannot see another's families.

**We will not** give a shared login to a team. Every person who sees a child's record has their own account, so every view and every edit has a name against it.

---

## 3. Before anyone works with children

Held in **Team & invites → Onboarding**, which is our Single Central Record.

Per person, before they start: identity, right to work, DBS at the level their role requires, references, relevant qualifications, and induction.

- Nobody works unsupervised until their record shows **Cleared to start**. A record short of that shows **Start on hold**.
- Where **Setup → require compliance** is on, a person whose key certificates (first aid, safeguarding training) have lapsed **cannot be rostered** onto a session.
- Certificate expiry is tracked and warns ahead of the date. Renewal is the individual's responsibility and the manager's to check.

**Recruitment decisions are ours, not the software's.** The system records what we gathered; it does not judge suitability, and a complete checklist is not the same as a safe appointment.

---

## 4. The child's record

Completed by the parent at booking, amendable by a manager on the register, and reused for every subsequent booking so nobody retypes a medical note under time pressure.

| Held on the record | Used for |
|---|---|
| Allergies, medical, dietary | Flagged on the register row and matched against meal choices |
| SEND / support plan | Shown to the staff running the session |
| Care notes | Anything that doesn't fit the fields above |
| Emergency contact name + phone | Available on the child card, offline-legible |
| **Collection password** 🔑 | §5 |
| **Photo consent** | §8 |
| **Walk-home consent** | §5 |
| **First-aid consent** | §7 |
| **Suncream consent** | Application by staff |
| Custom questions | Whatever your setting needs to ask |

A parent updates this from their own account at any time. Staff see the current version, not the version that was true when the booking was made.

---

## 5. Arrival, collection and handover

Taken on the day in **Registers**, on a phone, at the door.

- Every child is marked **Present**, **Absent** or **Collected**. The register is the record of who was in our care and when.
- On collection, the system records **who collected them** by name. "Collected" without a name is not a completed record.
- A child is released **only** to a person on their collection list. Where a **collection password** is set, the person collecting gives it. Staff who cannot verify the person do not release the child — they call the parent and, failing that, the DSL.
- A child leaves alone only where **walk-home consent** is recorded against them.
- A **roll call** can be run at any point in the session, and must be run on arrival at and departure from any off-site location.

Ratios are calculated live in **Ratios & groups** as children are signed in. Being inside ratio is a floor, not a plan — supervision is a judgement about the activity, the site and the children present.

**Missing child / uncollected child.** [Your procedure — the system will tell you a child is unaccounted for; what happens next is people, not software. Record the steps here and put the numbers in Appendix A.]

---

## 6. Concerns about a child

**Log a concern** creates the record. Do it the same day, before you go home.

1. Pick the category. The list is yours to edit — **Setup → Safeguarding → categories**.
2. Record what happened **in the child's own words** where they told you something. Not your interpretation of it.
3. Submitting alerts the **DSL** — every concern, automatically. You are not deciding whether it's serious enough to pass on. That is the DSL's decision, not yours.
4. The form shows your setting's own **"What to do now" protocol** — the steps and the deadline you configured, not generic advice.
5. The DSL records the decision and the action taken in the same record, so the concern and the response live together.
6. The record exports as a PDF carrying your real escalation contacts, with the phone numbers live for click-to-call.

**Escalation contacts** are configured per local authority in **Setup → Safeguarding → contacts** — LADO, children's social care, out-of-hours, plus NSPCC and police. If you work across several councils, each has its own entry and the form picks the right one. Fill these in before you need them; nobody looks up a MASH number calmly.

**Never** promise a child confidentiality, ask leading questions, or investigate. Notice, record, refer.

---

## 7. Medication, first aid and accidents

**Medication** is the strongest control in the system, and it is enforced server-side:

> A dose **cannot** be recorded against a medication that has no parental consent. This is not a warning that can be clicked past.

Each authorised medicine holds the consenting parent, the date, the dose, the route, storage and expiry. Every dose given is recorded on the **MAR**, with who gave it. Consent can be withdrawn by the parent, and the withdrawal is timestamped.

**Accidents and first aid** are logged as a record on the child. Where **notify parent on accident** is on, the parent is emailed and notified in-app. Where **require acknowledgement** is on, they are chased until they confirm they've seen it. Turn both on — a verbal handover at the door is not a record.

First aid is given by a trained first-aider where **first-aid consent** is held, and in an emergency regardless of consent.

---

## 8. Photographs and Moments

Photos are shared with parents through **Moments**, and only with parents of children in that session.

- A child whose record shows **photo consent off** is excluded, and staff see that flag before the shot is taken.
- Staff use provider devices. Images of children are not held on a personal phone, not posted to a personal account, and not kept after they've been uploaded.
- Marketing use is a separate, explicit permission — the booking consent is not it.

---

## 9. Trips and off-site activity

Set in **Trips & visits**.

- With **require consent** on, a trip **cannot be marked ready or completed** until every child on it has consent recorded. That's an enforcement, not a prompt.
- A **ratio target** is set per trip and the trip flags when it is exceeded.
- **Who can plan a trip** is restricted to leads or managers.
- Roll call on departure, on arrival, before returning, and on return.

---

## 10. Online sessions delivered by live video

Read §11 first: the product currently offers less help here than anywhere else in this policy.

- No adult runs a one-to-one video session with a child unobserved. Either a second adult is present in the call, or the session is recorded, or it does not happen.
- Joining details go to the named parent account only. They are never posted where they can be forwarded.
- Parents consent to online delivery, and separately to recording, before the first session.
- A concern arising in a session is logged the same way as any other — **Log a concern**, same day.
- Recordings are held [WHERE] for [HOW LONG] and are viewable by [WHO].

---

## 11. Where the system will not save you

Stated plainly, because a policy that overclaims its own controls is worse than no policy.

| Gap | What that means for you |
|---|---|
| **DSL name is optional** | A setting can run with no named DSL. Nothing stops it. Check yours is filled. |
| **No "low-level concern" record** | Niggles about an adult's conduct — the pattern that safeguarding reviews are usually built from — have nowhere to go. Keep them in **Documents** or a written log until there is a proper record type. |
| **Online sessions have no safeguarding affordances** | An online listing takes a free-text joining link. There is no consent type, no attendance record for who was in the call, no enforcement of §10. It is entirely on your staff. |
| **Documents and the onboarding record are demo storage today** | The Single Central Record and this policy's own home are not yet on durable server storage. Do not treat them as your only copy. |
| **Certificate expiry warns at two different thresholds** | Compliance and the staff credential list disagree about when a DBS is "expiring". Trust the earlier one. |
| **Ratios are arithmetic** | The system counts. It does not know that today's group has three new children and a broken fire door. |

---

## 12. Records, retention and who owns them

- Concerns, accidents, medication records and registers are timestamped and attributed to the person who made them.
- **You are the data controller.** Family and child data belongs to your setting. It is not pooled with other providers, sold, or shared.
- Retention periods: [SET THESE — they are local and sector-specific, not something a template can decide for you.] Safeguarding records are ordinarily kept far longer than routine records.
- Data protection is never a reason not to share information to protect a child.

---

## 13. Review

Reviewed annually, and immediately after any safeguarding incident, any change in registration status, and any change to the controls named above. Published to staff through **Documents**, where each version is tracked and each person's **read receipt** is recorded — so "they were told" is evidenced rather than assumed.

---

## Appendix A — Before you go live

Tick all of these in Setup, or this policy is decorative:

- [ ] DSL name, title and email set
- [ ] Concern categories reviewed and edited to suit your setting
- [ ] "What to do now" protocol written, with your deadline
- [ ] Every local authority you work in added, with LADO, social care and out-of-hours numbers
- [ ] NSPCC and police numbers set
- [ ] Notify parent on accident: **on**
- [ ] Require acknowledgement: **on**
- [ ] Require compliance (certificates in date to be rostered): **on**
- [ ] Trips: require consent **on**, ratio target set, who-can-plan restricted
- [ ] Roles & permissions matrix reviewed — no shared logins
- [ ] This policy published in Documents and assigned to every role, read receipts checked
- [ ] Retention periods in §12 filled in
- [ ] Missing-child and uncollected-child procedures written into §5

## Appendix B — Emergency numbers

| | Number |
|---|---|
| Children's social care / MASH | [ ] |
| Out of hours | [ ] |
| LADO (allegations against staff) | [ ] |
| Police | 999 / 101 |
| NSPCC helpline | 0808 800 5000 |

*Keep these in Setup as well as here — the concern form and the exported PDF pull from Setup, and that's the copy someone will actually be looking at.*

---

**Adopted for [SETTING NAME]**

Signed [ ] · Role [ ] · Date [ ]
