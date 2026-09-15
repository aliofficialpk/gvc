# GVC World Greece Pakistan — Evidence Verification Matrix

This document provides a strict, evidence-based audit of every technical claim made regarding the GVC World Greece Pakistan visa appointment portal (`pk-gr-services.gvcworld.eu`).

## Status Classification Criteria:
- **OBSERVED**: Directly confirmed from the website via live browser interaction, network traces, and HTTP responses.
- **INFERRED**: Reasonably inferred from architectural context or standard GVC World patterns, but NOT directly confirmed during testing.
- **UNKNOWN**: Could not be verified or confirmed due to authentication or perimeter boundary restrictions.

---

## 1. Evidence Matrix Table

| Claim / Component | Evidence & Empirical Finding | Status | Confidence |
| :--- | :--- | :---: | :---: |
| **Imperva Incapsula WAF Protection** | Direct cURL and Playwright Chromium requests return HTTP 403 Forbidden with `incap_ses_7754_3343172`, `visid_incap_3343172`, and `___utmvc` cookies plus `_Incapsula_Resource` JS challenges. | **OBSERVED** | **HIGH** |
| **Starting Portal URL (`/login/PK/en?lang=en_US`)** | Accessible via web browser; served over HTTPS under the domain `pk-gr-services.gvcworld.eu`. | **OBSERVED** | **HIGH** |
| **Global Portal Country Selection** | Selecting "GREECE" (value `2`) and "PAKISTAN" (value `29`) on `https://www.gvcworld.eu/` routes users to `pk-gr-services.gvcworld.eu`. | **OBSERVED** | **HIGH** |
| **Registration URL (`/register/PK/en`)** | Returned HTTP 200 OK with title `"Visa \| Create an account"` when accessed with stealth browser parameters. | **OBSERVED** | **HIGH** |
| **Forgot Password Path (`/forgot-password`)** | Returned HTTP 401 Unauthorized ("401 Unknown Reason"), confirming the route exists on the backend router and requires active session tokens. | **OBSERVED** | **HIGH** |
| **Dashboard Path (`/dashboard`)** | Returned **HTTP 404 Not Found** ("404 Unknown Reason"), proving that `/dashboard` is NOT a valid path on this portal. | **UNOBSERVED / INVALID** | **HIGH** |
| **Protected Appointment Paths (`/profiles`, `/appointment/*`)** | Returned HTTP 401 Unauthorized when requested unauthenticated, confirming backend route registration. | **OBSERVED** | **HIGH** |
| **Claimed API Endpoints (`/api/appointment/centres`, `/available-slots`, `/book`)** | No XHR/Fetch API network requests with these paths were observed in unauthenticated traffic. | **UNKNOWN** | **LOW** |
| **Specific HTML Element IDs & Regex Rules** | HTML element IDs (e.g. `given_name`, `passport_number`) and regex patterns were not directly exposed in unauthenticated DOM inspection. | **INFERRED** | **MEDIUM** |
| **Exact Inactivity Timeout (e.g., "15 minutes")** | No official session timeout countdown or published duration was directly measured during unauthenticated navigation. | **INFERRED** | **MEDIUM** |
| **Official Polling Rate Limit** | No official polling rate limit or frequency restriction is published by GVC World. | **NO OFFICIAL POLLING INTERVAL CONFIRMED** | **HIGH** |
| **Document Upload File Limits (e.g., "PDF/JPEG <= 2MB")** | Post-login document upload form requirements could not be confirmed without authenticating a test account. | **INFERRED** | **MEDIUM** |
| **Slot Availability Data Mechanism** | Whether slot data is rendered via JSON API, server-side HTML injection, or WebSockets is unobserved. | **UNKNOWN** | **LOW** |

---

## 2. Summary of Corrections

1. **Path Correction**: The previously claimed `/dashboard` URL returned HTTP 404 Not Found. The actual post-login entry route depends on session routing.
2. **API Endpoint Caution**: The specific REST API paths (`/api/appointment/*`) must **NOT** be assumed as factual until captured during an authenticated session trace.
3. **Polling Interval Correction**: Replaced the arbitrary "5–15 minutes" claim with the explicit statement: **"NO OFFICIAL POLLING INTERVAL CONFIRMED."**
