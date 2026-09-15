# GVC World Greece Pakistan — Verified Technical Specification

**Project**: GVC World Greece (Pakistan) Appointment Assistance Application  
**Domain**: `https://pk-gr-services.gvcworld.eu/`  
**Date**: September 12, 2026  
**Audit Type**: Empirical Evidence Verification Phase  

---

## 1. Confirmed URLs & Status Codes

During empirical testing using Playwright Chromium with browser fingerprint masking, the following HTTP statuses were observed:

| Target URL Path | Observed HTTP Status | Page Title / Response Header | Verification Status |
| :--- | :---: | :--- | :---: |
| `https://www.gvcworld.eu/` | **200 OK** | `"GVCW - Global Visa Center World \| Schengen Visa Services"` | **CONFIRMED** |
| `https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US` | **200 OK** *(with stealth)* / **403 Forbidden** *(raw client)* | Incapsula Challenge / Login Page | **CONFIRMED** |
| `https://pk-gr-services.gvcworld.eu/register/PK/en?lang=en_US` | **200 OK** | `"Visa \| Create an account"` | **CONFIRMED** |
| `https://pk-gr-services.gvcworld.eu/forgot-password` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/dashboard` | **404 Not Found** | `"404 Unknown Reason"` | **INVALID PATH (Does Not Exist)** |
| `https://pk-gr-services.gvcworld.eu/profiles` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/appointment/select-centre` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/appointment/applicant-info` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/appointment/documents` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/appointment/select-slot` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/appointment/review` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |
| `https://pk-gr-services.gvcworld.eu/appointment/confirmation` | **401 Unauthorized** | `"401 Unknown Reason"` | **CONFIRMED (Path Exists)** |

---

## 2. Confirmed Pages & Forms

- **Landing / Entry Form**: `https://www.gvcworld.eu/` contains destination select (`id="edit-gvcw-greece"`, Greece=`2`) and residence select (`id="gvcw_countries"`, Pakistan=`29`).
- **Login Form**: Located at `/login/PK/en?lang=en_US`. Expects Email Address, Password, and Security Challenge.
- **Account Registration Form**: Located at `/register/PK/en?lang=en_US`. Page title confirmed: `"Visa | Create an account"`.

---

## 3. Confirmed Browser & Network Behaviour

- **Perimeter Security**: Imperva Incapsula WAF is directly confirmed. Standard headless requests return `HTTP 403 Forbidden` with iframe resource `/ _Incapsula_Resource?CWUDNSAI=...` and set `incap_ses_7754_3343172`, `visid_incap_3343172`, and `___utmvc` cookies.
- **Stealth Requirement**: The portal allows navigation when browser automation hides `navigator.webdriver` and uses standard Chrome/Edge User-Agent headers.

---

## 4. Confirmed Verification Steps

- **Perimeter Security**: Imperva Incapsula JS challenge must pass before rendering portal assets.
- **Login Verification**: Login form includes bot challenge protection.
- **Registration Verification**: Account creation involves mandatory email activation link / OTP.

---

## 5. Unverified Claims & Unknowns

1. **API Endpoints**: Specific API endpoint paths (`GET /api/appointment/available-slots`, `POST /api/appointment/book`, `GET /api/appointment/centres`) were **NOT** observed in unauthenticated traffic. They remain **UNOBSERVED / UNKNOWN**.
2. **Calendar Data Mechanism**: Whether availability data is fetched via REST API JSON, server-side rendered HTML fragments, or WebSockets is **UNKNOWN**.
3. **Document Upload Limits**: Post-login document upload file size limits (previously assumed as 2MB PDF/JPEG) remain **UNVERIFIED**.
4. **Official Polling Limits**: **NO OFFICIAL POLLING INTERVAL CONFIRMED.** There is no published rate limit from GVC World.

---

## 6. Assumptions vs Facts Table

| Item | Fact (Observed) | Assumption (Unverified) |
| :--- | :--- | :--- |
| **WAF Provider** | Imperva Incapsula protection was observed blocking raw requests with 403. | None. |
| **Registration Path** | `/register/PK/en` returned 200 OK with title `"Visa \| Create an account"`. | Specific HTML field IDs inside the form. |
| **Dashboard Path** | `/dashboard` returned 404 Not Found. | Post-login dashboard URL structure. |
| **Protected Routes** | `/appointment/*` paths return 401 Unauthorized without session. | Exact internal step sequence post-login. |
| **API Endpoints** | No `/api/appointment/*` endpoints observed unauthenticated. | Specific API route naming convention. |
| **Polling Rate** | No official rate limit is published by GVC World. | 5–15 minute safe polling interval assumption. |

---

## 7. Automation Opportunities & Boundaries

### Safe to Automate (GREEN)
- Navigating to global entry and selecting destination/residence options.
- Launching stealth Playwright context to obtain valid Incapsula session cookies.
- Pre-filling applicant profile data (Name, DOB, Passport Number) once target form fields are loaded.
- Multi-channel notification delivery (Email, WhatsApp, Push) when slot availability is detected.

### Requires Careful Handling (YELLOW)
- Session cookie preservation across automated browser runs.
- Rate-limited checking schedules (without claiming an official limit).
- Document pre-upload file handling.

### Must Remain User-Controlled (RED)
- CAPTCHA challenge solving.
- SMS / Email OTP verification code entry (Human-in-the-Loop required).
- Final appointment confirmation submission and fee payment.
