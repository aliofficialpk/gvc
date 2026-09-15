# GVC World Greece Pakistan — Verified User Workflow

This document contains **only** confirmed, empirically verified workflow steps discovered during live browser observation of the GVC World portal (`pk-gr-services.gvcworld.eu`).

Unconfirmed or post-login steps are explicitly isolated in the **UNVERIFIED / REQUIRES FURTHER TESTING** section.

---

## 1. Confirmed Workflow Steps

```
[Step 1: Global Portal Residence & Destination Selection]
  │  URL: https://www.gvcworld.eu/
  │  Observed Action: Select "GREECE" (value=2) and "PAKISTAN" (value=29)
  │  Result: Redirects browser to Pakistan service portal domain.
  ▼
[Step 2: Perimeter Security & WAF Challenge Execution]
  │  URL: https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US
  │  Observed Action: Imperva Incapsula client challenge executes script `_Incapsula_Resource`
  │  Result: Sets session cookies (`incap_ses_7754_3343172`, `visid_incap_3343172`, `___utmvc`).
  ▼
[Step 3: Portal Entry / Login Page]
  │  URL: https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US
  │  Observed Behavior: Displays login portal interface for Pakistan applicants.
  │  Observed Options: Login form, link to Account Registration, link to Forgot Password.
  ▼
[Step 4: Account Registration Flow (If New User)]
  │  URL: https://pk-gr-services.gvcworld.eu/register/PK/en?lang=en_US
  │  Observed Status: HTTP 200 OK
  │  Observed Page Title: "Visa | Create an account"
  │  Observed Behavior: Renders registration form for genuine new applicants.
```

---

## 2. UNVERIFIED / REQUIRES FURTHER TESTING

The following steps could **not** be directly observed without authenticating a live test user account or completing real MFA verification:

### Unverified Step 5: Post-Login Landing Page
- **Claimed URL**: `/dashboard` (**FAILED**: Returned HTTP 404 Not Found during live testing).
- **Status**: **UNVERIFIED**. The actual post-login landing route must be captured during an authenticated test session.

### Unverified Step 6: Visa Centre & Category Selection
- **Claimed URLs**: `/appointment/select-centre` (Returned HTTP 401 Unauthorized unauthenticated).
- **Status**: **UNVERIFIED**. Centre options (Islamabad vs Lahore) and category enums (Schengen C / National D) are inferred from standard GVCW service structure but require authenticated DOM verification.

### Unverified Step 7: Applicant Details Entry & Document Upload
- **Claimed URLs**: `/appointment/applicant-info`, `/appointment/documents` (Returned HTTP 401 Unauthorized unauthenticated).
- **Status**: **UNVERIFIED**. Field IDs, label names, passport file size limits, and document upload stages require verification inside an active booking session.

### Unverified Step 8: Calendar Slot Selection & Availability Loading
- **Claimed URL**: `/appointment/select-slot` (Returned HTTP 401 Unauthorized unauthenticated).
- **Status**: **UNVERIFIED**. The exact mechanism by which availability is transmitted (JSON API vs server-rendered HTML) remains unobserved.

### Unverified Step 9: Final Booking Review & Confirmation Slip
- **Claimed URLs**: `/appointment/review`, `/appointment/confirmation` (Returned HTTP 401 Unauthorized unauthenticated).
- **Status**: **UNVERIFIED**. Final confirmation verification steps and PDF receipt generation structure require confirmation.
