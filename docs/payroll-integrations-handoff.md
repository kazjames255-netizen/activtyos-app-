# Payroll — backend & accounting-integration handoff (for Amir)

Source of truth for wiring the front-end **Payroll** feature (`features/payroll/PayrollApp.tsx`) to real payroll + accounting. Distilled from a 10-agent review (2026-08). The front end is a **cost-planning estimator** — the statutory machinery below is all backend.

## 0. Ground rules
- **OAuth secrets & tokens are backend-only.** `client_secret` and rotating refresh tokens must never reach the browser/localStorage. The front end calls **our** backend; our backend holds tokens and talks to the provider.
- **Never store payroll in localStorage in prod.** `aos.payroll.*` and the bank sort/account + NI number captured in onboarding (`aos.team.onboardrecords.v1`, flagged `sensitive`) are financial personal data (UK GDPR/DPA 2018). Move server-side with field-level/envelope encryption (KMS) for bank + NI.
- **Don't post estimates as final.** Gate journal posting behind real RTI figures, or mark the journal `PROVISIONAL — ActivityOS estimate` and reverse when actuals land.

## 1. P0 — statutory blockers (non-compliant without these)
- **RTI**: send an **FPS on or before every payday**; **EPS** for statutory-pay recovery, Employment Allowance, and nil payments.
- **YTD/cumulative store** per employee per tax year (gross, taxable, PAYE, NI, pension, net) — prerequisite for cumulative PAYE, P60, P45.
- **Tax code + NI category driving the calc** (front end now applies a simplified version; backend must do it properly incl. Scottish/Welsh, K/BR/D0/NT, week1/month1).
- **Employee data model**: stable id, start/leave dates, pay frequency, student/PG-loan plan, director flag, tax regime (UK/Scot/Welsh + W1/M1), NI number.

## 2. P1 — high frequency in this sector
- **Actual hours from the rota** (`features/schedule/ScheduleApp.tsx`, `aos.rota.v5`, `staffHours()`) with an approve-hours step — not contracted `hpw`. *Highest-leverage change.*
- Statutory pay (SSP, SMP/SPP/SAP/ShPP + AWE, reclaim via EPS); student/PG loans (Plan 1/2/4/5 @9%, PGL @6%); weekly/4-weekly frequencies; starters/leavers + P45 in/out + pro-rata; holiday pay for irregular hours (12.07% / 52-wk avg); proper auto-enrolment (QE band, jobholder assessment, postponement, opt-out/refunds, re-enrolment, RAS vs net-pay).

## 3. Accounting integrations — the wages journal
All three post the **same double-entry** (aggregated period totals, 2dp; **net pay is the balancing line** so sub-penny drift can't reject it):

| Side | Account bucket | Amount |
|---|---|---|
| Dr | Gross wages (expense) | `totalGross` |
| Dr | Employer NI (expense) | `Σ erNiM` |
| Dr | Employer pension (expense) | `Σ erPenM` |
| Cr | HMRC PAYE/NIC liability | `totalPaye + Σ eeNiM + Σ erNiM` |
| Cr | Pension payable | `Σ eePenM + Σ erPenM` |
| Cr | Net wages / bank | `totalNet` (balancing) |

Balances because `gross = net + PAYE + eeNI + eePension`.

**Per-tenant account mapping UI** (these 6 buckets), fetched from the provider — never hardcode account codes. Store the returned journal id + status on each `PayRun`; derive an idempotency key from `runId + tenantId`.

### 3a. QuickBooks Online
| Step | Detail |
|---|---|
| Register | developer.intuit.com; scope `com.intuit.quickbooks.accounting`; exact redirect URI |
| Authorize | `GET https://appcenter.intuit.com/connect/oauth2` (`response_type=code`, `client_id`, `scope`, `redirect_uri`, random `state`) |
| Callback | `?code&state&realmId` — **capture `realmId`** (company id; used in every path) |
| Token | `POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`, `Authorization: Basic base64(id:secret)`, `grant_type=authorization_code`. Access 60 min; refresh ~100 days |
| Refresh | Same endpoint, `grant_type=refresh_token`. **Refresh token ROTATES — persist the new one every time.** |
| **Post** | `POST {base}/v3/company/{realmId}/journalentry?minorversion=75&requestid={runId}`, `Bearer` token. Body = `JournalEntry` with `Line[]` (each `DetailType:"JournalEntryLineDetail"`, `PostingType:"Debit"/"Credit"`, `AccountRef{value}`), `TxnDate=paidOn`, `DocNumber="AOS-PAYROLL-YYYY-MM"` |
| Accounts | `GET {base}/v3/company/{realmId}/query?query=select * from Account` |
| Hosts | sandbox `sandbox-quickbooks.api.intuit.com`, prod `quickbooks.api.intuit.com` (token host same) |
| Disconnect | `POST oauth2/v1/tokens/revoke` |

### 3b. Xero
| Step | Detail |
|---|---|
| Approach | **Accounting-only Manual Journal** (RTI filed elsewhere). The Xero UK Payroll API would replace this whole engine — not recommended here. |
| Scopes | `openid profile email offline_access accounting.transactions accounting.settings` |
| Authorize | `GET https://login.xero.com/identity/connect/authorize` (code flow; PKCE S256 for public clients) |
| Token | `POST https://identity.xero.com/connect/token`. Access **30 min**; refresh rotates every use, 60-day inactivity expiry — persist atomically |
| Tenant | `GET https://api.xero.com/connections` → persist `tenantId`; send header `xero-tenant-id` on every call |
| **Post** | `POST https://api.xero.com/api.xro/2.0/ManualJournals` + `xero-tenant-id`. **LineAmount +ve = Debit, −ve = Credit**, must net to zero. `Narration` (required), `Date=paidOn`, `Status:"DRAFT"` (recommended) or `"POSTED"`, `LineAmountTypes:"NoTax"`, lines `{LineAmount, AccountCode, Description, TaxType:"NONE"}`. Net-wages line must be a current-liability/bank account (not AR/AP). Capture `ManualJournalID` |
| Accounts | `GET .../Accounts?where=Class=="EXPENSE"` (and `LIABILITY`) |
| Idempotency | `Idempotency-Key` header per `(runId, tenantId)` |
| Limits | 60/min, 5,000/day, 5 concurrent; honour `Retry-After` on 429 |

### 3c. Sage (Business Cloud **Accounting** API — *not* Sage Payroll API)
| Step | Detail |
|---|---|
| API choice | Sage **Accounting** `/journals`. Sage Payroll API is read-oriented and can't trigger third-party FPS/RTI — RTI stays with the operator |
| Authorize | `GET https://www.sageone.com/oauth2/auth/central?response_type=code&client_id&redirect_uri&scope=full_access&state&country=gb` |
| Token | `POST https://oauth.accounting.sage.com/token`, `grant_type=authorization_code`. **Access ~5 min**; **refresh rotates, ~31-day expiry** — persist new refresh atomically or the tenant is locked out |
| Business | `GET /v3.1/businesses`; send `X-Business: {GUID}` header on every request (mandatory) |
| Base | `https://api.accounting.sage.com/v3.1/`; headers `Authorization: Bearer`, `X-Business`, JSON |
| **Post** | `POST /v3.1/journals` → `{journal:{date, reference:"PAYROLL-YYYY-MM", details, journal_lines:[{ledger_account_id, details, debit, credit}]}}`. Debits must equal credits to the penny or **422**. `Idempotency-Key` header. Store returned id + status |
| Accounts | `GET /v3.1/ledger_accounts` (ids per-business); `POST` to create missing |
| Notes | No webhooks (poll `updated_or_created_since` + `$next`); ~15 req/s |

Keep the existing **CSV export** as the always-available, no-OAuth fallback for any provider.

## 4. Payslips
Front end now renders an **estimated** payslip with employer/employee details, tax code, tax period, NI category, an **hours line for hourly staff** (ERA 1996 s.8A — mandatory since April 2019), YTD, payment method and pension. Backend must:
- **Persist** each payslip (HMRC retention: **3 years after tax-year end**); staff must be able to re-access history.
- Produce **statutory** payslips from RTI-backed figures (drop the "estimate" framing then); real **PDF** (not `window.print`); **email / bulk-send**; **staff-portal view** scoped so each person sees only their own (front-end `StaffPayslipsApp` reads `aos.payroll.runs.v1` in the demo).

## 5. Security & data-protection must-dos
- **RBAC**: gate the whole feature behind a **payroll-admin** role (default-deny); line managers must not see others' bank details.
- **Encryption at rest** (field-level/KMS) for bank + NI; never return full bank details to the client except to an authorised admin.
- **Tenant isolation** server-side; **immutable audit log** (view/edit/approve/export/print, actor + timestamp); **segregation of duties** (split run-creation from approval — front end currently does both in one click).
- **Retention + erasure** (3 yrs past tax-year end, then purge; leaver redaction; SAR/erasure path). **DPIA + ROPA** entry (bank + salary + NI = high-risk). **MFA/step-up** before viewing bank or running payroll. Signed **processor/DPA** agreements with QuickBooks/Xero/Sage.
