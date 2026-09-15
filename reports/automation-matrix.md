# GVC World Greece Pakistan — Automation Feasibility Matrix

This document provides a detailed feature-by-feature evaluation of the GVC World Greece Pakistan appointment portal (`https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US`) to classify components into automation readiness levels:

- **GREEN**: Fully suitable for safe, deterministic browser automation.
- **YELLOW**: Suitable for automation but requires careful handling, rate-limiting, error recovery, or dynamic wait strategies.
- **RED**: Must remain strictly user-controlled or manually completed (e.g., security challenges, OTP entry, final payment).

---

## 1. Summary Matrix

| Feature | Automation Status | Explanation |
| :--- | :---: | :--- |
| **Opening Website / Initial Navigation** | **YELLOW** | Must handle Imperva Incapsula WAF JS challenge (`incap_ses` cookies) and load initial session cookies cleanly using a headful or stealth browser context. |
| **Login Navigation & Credential Entry** | **GREEN** | Filling email and password fields is fully deterministic via DOM selectors (`input[type="email"]`, `input[type="password"]`). |
| **Login CAPTCHA / Bot Defense** | **RED** | Must remain user-controlled. Bypassing or defeating CAPTCHAs violates security policies and website terms. User completes CAPTCHA manually. |
| **Email / SMS OTP Verification** | **RED** | Mandatory multi-factor authentication (MFA). OTP must be entered manually by the user or received via secure human-in-the-loop callback interface. |
| **Applicant Dashboard Navigation** | **GREEN** | Navigating to "New Appointment" or "Manage Applicants" is standard DOM click / URL navigation. |
| **Applicant Profile Pre-filling** | **GREEN** | Full Name, DOB, Passport Number, Nationality, Expiry Date, and Contact details can be pre-filled automatically from stored encrypted applicant profile database. |
| **Dropdown Selection (Visa Type / Category)** | **GREEN** | Selecting Schengen Short-Stay (C), National Long-Stay (D), Tourism, Business, or Family Visit is fully automatable via standard select options or custom dropdown elements. |
| **Centre Selection (Islamabad / Lahore)** | **GREEN** | Standard dropdown selection for Visa Application Centres (VACs). |
| **Appointment Availability Checking** | **YELLOW** | Requires careful handling: polling frequency must be strictly controlled (e.g., 5-15 minute intervals) to avoid triggering Incapsula WAF IP bans or session invalidation. |
| **Calendar Reading & Month Navigation** | **GREEN** | Automated DOM inspection of active/disabled date cells (`.available-date`, `.disabled-date`) to identify open slot dates. |
| **Date Selection** | **GREEN** | Clicking an open date cell is fully automatable once availability is detected and confirmed against applicant preferences. |
| **Time Slot Selection** | **GREEN** | Selecting available time radio buttons / options (e.g., 09:00 AM, 11:30 AM) is fully automatable. |
| **Document Preparation** | **GREEN** | Client-side pre-processing (formatting images to PDF/JPEG, validating file size < 2MB, checking resolution/filename rules). |
| **Document Upload** | **YELLOW** | Requires careful handling: handling native browser file inputs (`input[type="file"]`), validating server upload responses, and handling upload timeouts. |
| **Appointment Review & Form Validation** | **GREEN** | Automated pre-submission validation of applicant data, dates, and uploaded documents before reaching confirmation. |
| **Final Confirmation & Slot Booking** | **YELLOW** | High-risk step: requires exact validation of selected slot and applicant details before submitting. Confirmation slip PDF download is automatable. |
| **User Notifications** | **GREEN** | Instant multi-channel notifications (Email, SMS, WhatsApp, Push) triggered automatically upon slot detection or booking completion. |

---

## 2. Detailed Technical Breakdown

### GREEN (Fully Automatable Core Actions)
- **Profile Data Input**: Automation agents can reliably fill repetitive fields (Passport Number, Expiry, Given Name, Surname, Date of Birth, Email, Mobile Number).
- **Category & Centre Filtering**: Automated triggers can immediately select preferred visa categories and centres (e.g., Islamabad / Lahore) faster than human manual interaction.
- **Calendar Parsing**: DOM parsing allows sub-second detection of date cell state changes across multiple calendar months.
- **Notification Triggering**: Background webhooks immediately alert genuine applicants when targeted date windows open.

### YELLOW (Requires Careful Handling & Fail-Safes)
- **Session & WAF Persistence**: Imperva Incapsula rotates `incap_ses_*` and `visid_incap_*` cookies. Automation scripts must maintain session state and handle 403 / challenge redirects gracefully without aggressive retries.
- **Availability Polling**: High-frequency polling (>1 request per minute per IP) triggers WAF blockades. Monitoring strategy must use exponential backoff, jittered schedules, and distributed IP pools if operating at scale.
- **Document Upload Handlers**: File uploads can hang or return unexpected HTTP 500 / 413 errors on large payloads. Strict client-side verification is mandatory before invoking the upload input element.

### RED (Strictly User-Controlled & Non-Automated)
- **Verification & CAPTCHA**: Security verification mechanisms (reCAPTCHA, hCaptcha, Incapsula client puzzles, SMS OTP, Email OTP links) **MUST NOT** be automated or bypassed. The system will alert the user and present a Human-in-the-Loop (HITL) prompt for code entry or manual verification.
- **Payment Gateway Processing**: Credit/Debit card authorization or fee payment portals must be completed directly by the genuine applicant.
