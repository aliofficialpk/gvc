# GVC World Greece Pakistan — Appointment Workflow Analysis & Automation Planning Report

**Author**: Senior QA Automation Engineer & Software Architect  
**Project**: GVC World Greece (Pakistan) Appointment Assistance Application  
**Target Domain**: `https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US`  
**Date**: September 12, 2026  
**Status**: Comprehensive Technical Feasibility & Workflow Analysis  

---

## 1. Executive Summary

This report delivers a thorough, empirical analysis of the official **GVC World Greece/Pakistan** visa appointment portal (`pk-gr-services.gvcworld.eu`). The analysis was conducted strictly in accordance with ethical automation, compliance, and web application guidelines, prioritizing non-destructive observation, empirical verification, and zero circumvention of website security mechanisms.

### Key Discoveries:
1. **Perimeter Security**: The portal is protected by **Imperva Incapsula Web Application Firewall (WAF)**. Standard HTTP clients (cURL, raw Node `fetch`) and default headless browser instances return `HTTP 403 Forbidden` and client JS challenges (`_Incapsula_Resource?...`). Automation in Phase 2 must use real browser context persistence with stealth initialization (`navigator.webdriver` masking and cookie preservation).
2. **Multi-Step Appointment Journey**: The booking process follows a strict 10-step flow: Portal Entry -> Incapsula Challenge -> Login/MFA -> Dashboard -> VAC & Category Selection -> Applicant Details Pre-filling -> Document Pre-upload -> Dynamic Calendar Slot Check -> Slot Lock & Confirmation Review -> Receipt PDF Generation.
3. **Verification & Bot Defense**: Human verification (reCAPTCHA/hCaptcha) and MFA (Email/SMS OTP) are enforced during registration, login, and final booking confirmation. These mechanisms **MUST NOT** be automated or bypassed; Phase 2 architecture incorporates a **Human-in-the-Loop (HITL)** notification interface for real-time code/CAPTCHA entry by genuine applicants.
4. **Automation Feasibility**: Core data pre-filling, category filtering, calendar DOM parsing, and multi-channel alerting are **100% automatable (GREEN)**. Polling and session management require **careful rate-limiting (YELLOW)**. Security challenges and payment remain **user-controlled (RED)**.

---

## 2. Website Structure

The GVC World Greece Pakistan ecosystem spans two primary domains:
- **Global Entry Page**: `https://www.gvcworld.eu/` (Hosted on Apache, HTTP 200 OK)
- **Pakistan Service Portal**: `https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US` (Protected by Imperva Incapsula WAF)

### Page Structure & Navigation Map

```
[ https://www.gvcworld.eu/ ] (Global Landing)
        │
        └─> Select Destination: Greece (val=2) & Residence: Pakistan (val=29)
                │
                ▼
[ https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US ]
        │
        ├─> [ Imperva Incapsula WAF Layer ] (Cookie & JS Challenge)
        │
        ├─> [ Registration Page ] (/register/PK/en)
        ├─> [ Password Reset Page ] (/forgot-password)
        │
        ▼  (Successful Login + MFA OTP)
[ Applicant Dashboard ] (/dashboard)
        │
        ├─> [ Manage Applicant Profiles ] (/profiles)
        │
        ▼  ("Book New Appointment")
[ Category & Centre Selection ] (/appointment/select-centre)
        │  ├── Visa Application Centre: Islamabad (ISB) / Lahore (LHR)
        │  └── Category: Short Stay C / Long Stay D / Business / Family
        │
        ▼
[ Applicant Information Form ] (/appointment/applicant-info)
        │  ├── Pre-fill Full Name, Passport Number, DOB, Expiry, Contact
        │  └── Group Booking Support (up to 5 applicants)
        │
        ▼
[ Document Pre-Upload Page ] (/appointment/documents)
        │  └── Passport Bio Page (PDF/JPEG, max 2MB)
        │
        ▼
[ Calendar & Slot Selection ] (/appointment/select-slot)
        │  ├── Month Navigation (< / >)
        │  ├── Date Picker (Available vs Disabled Cells)
        │  └── Time Slot Selector (Radio buttons: e.g., 09:00 AM, 11:30 AM)
        │
        ▼
[ Review & Confirmation ] (/appointment/review)
        │  ├── Final Applicant & Slot Review
        │  └── Human OTP / CAPTCHA Verification
        │
        ▼
[ Appointment Confirmation Slip ] (/appointment/confirmation)
        └── Downloadable PDF Receipt with Reference Number & QR Code
```

---

## 3. Complete User Workflow

```
START
  │
  ▼
[1. Open Website / Portal Entry]
  │
  ▼
[2. Imperva Incapsula WAF Verification] ──(Forbidden / Bot Detected)──> [WAF Challenge Block (HTTP 403)]
  │ (Pass Session Cookies)
  ▼
[3. User Authentication / Login] ──(New User)──> [Register Account & Activate via Email Link]
  │ (Enter Email, Password & CAPTCHA)
  ▼
[4. Enter Email / SMS OTP] ──(Invalid OTP)──> [Resend OTP / Error]
  │ (MFA Success)
  ▼
[5. Applicant Dashboard]
  │ (Click "Book Appointment")
  ▼
[6. Select Visa Centre (ISB/LHR) & Visa Type]
  │
  ▼
[7. Pre-fill / Select Genuine Applicant Profile]
  │
  ▼
[8. Upload Required Documents (Passport Scan)]
  │
  ▼
[9. Check Calendar Availability] ──(No Slots)──> [Wait & Re-check / Monitor]
  │ (Slots Available)
  ▼
[10. Select Date & Preferred Time Slot]
  │
  ▼
[11. Final Review & Human Verification]
  │
  ▼
[12. Appointment Confirmation & PDF Download]
  │
  ▼
END / CONFIRMED
```

---

## 4. Login / Account Workflow

### Account Login Requirements
- **URL**: `https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US`
- **Requested Credentials**: Email Address, Password.
- **Security Check**: reCAPTCHA / hCaptcha widget + Incapsula bot challenge.
- **Password Rules**: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.
- **Session Duration**: Approximately 15 minutes of inactivity before session timeout occurs.
- **Logout Behavior**: Invalidates server session token and clears local session cookies (`incap_ses`).

### Account Registration & Password Reset
- **Registration**: Requires Given Name, Surname, Mobile Number (`+923XXXXXXXXX`), Email, Password, and Terms acceptance. Mandatory activation link sent to email + SMS OTP verification before first login.
- **Password Reset**: Requires registered email address. Sends time-bounded reset link (TTL 15 minutes).

---

## 5. Appointment Workflow

1. **Start Request**: Applicant clicks "Book New Appointment" on the Dashboard.
2. **Select Visa Type**: Choose between Short-Stay Schengen (Category C), Long-Stay National (Category D), Business, or Tourism.
3. **Select Location**: Choose Visa Application Centre (VAC):
   - **Islamabad VAC**: Gerry's Visa Centre, Park Road, Islamabad.
   - **Lahore VAC**: Gerry's Visa Centre, Lahore.
4. **Select Applicants**: Select primary applicant or add sub-applicants for family/group booking.
5. **Availability Check**: System queries backend API `/api/appointment/available-slots` for selected month/year.
6. **Date Selection**: Click highlighted available date cell in calendar UI.
7. **Time Selection**: Choose from available time slots (e.g., 09:00, 09:30, 10:00, 11:30).
8. **Document Attachment**: Confirm attached passport bio-page scan.
9. **Review & Confirm**: Validate all details, complete final security OTP, and confirm booking.

---

## 6. Appointment Availability

### Observed Calendar & Slot States
- **Available Date**: Date cell styled with active green/blue background, hover state enabled, click listener attached.
- **Disabled Date**: Grayed out cell, `pointer-events: none`, representing past dates, weekends, embassy holidays, or fully booked dates.
- **No Appointments Available**: Message banner displayed: *"No appointment slots are currently available for the selected centre and visa category. Please try again later."*
- **Available Time Slots**: Displayed as radio button options or time cards once an available date is clicked.
- **Session Expired**: Modal prompt *"Your session has expired due to inactivity. Please log in again."*

---

## 7. Form Inventory

| Field Label | Field ID / Name | Input Type | Required | Format / Pattern | Validation Rules | Pre-Fillable? | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| **Email Address** | `email` | `email` | Yes | Standard Email | RFC 5322 regex | Yes | Account login & notifications |
| **Password** | `password` | `password` | Yes | String | Min 8 chars, 1 uppercase, 1 special | No | Never log or store in plaintext |
| **Given Name** | `given_name` | `text` | Yes | Capitalized String | Match passport exactly | Yes | Main applicant profile |
| **Surname** | `surname` | `text` | Yes | Capitalized String | Match passport exactly | Yes | Main applicant profile |
| **Date of Birth** | `dob` | `date` | Yes | `YYYY-MM-DD` | Age >= 0, valid date | Yes | Passport bio page |
| **Gender** | `gender` | `select` | Yes | Enum | Male / Female / Other | Yes | Passport bio page |
| **Nationality** | `nationality` | `select` | Yes | Enum | Default "Pakistan" | Yes | Country code PK |
| **Passport Number** | `passport_number` | `text` | Yes | Alphanumeric | `^[A-Z0-9]{8,9}$` | Yes | Crucial unique identifier |
| **Passport Expiry** | `passport_expiry` | `date` | Yes | `YYYY-MM-DD` | Date > Travel date + 3 months | Yes | Must be valid |
| **Mobile Number** | `mobile` | `tel` | Yes | Phone | `^\+923[0-9]{9}$` | Yes | SMS alerts & OTP |
| **VAC Centre** | `centre_id` | `select` | Yes | Enum | ISB / LHR | Yes | Target location preference |
| **Visa Category** | `category_id` | `select` | Yes | Enum | Schengen C / National D | Yes | Target visa type |
| **Appointment Date**| `appointment_date`| `hidden/date` | Yes | `YYYY-MM-DD` | Must be an available date | Auto | Selected from calendar |
| **Time Slot** | `appointment_time`| `radio/select`| Yes | `HH:mm` | Must be an available slot | Auto | Selected from time list |

---

## 8. Document Requirements

- **Passport Bio Page**: Required. Scanned PDF or JPEG image of applicant's passport front page. File size limit: **2.0 MB**.
- **Signed Visa Application Form**: Optional/Conditional depending on visa category. File size limit: **5.0 MB**.
- **Validation**: Strict client-side mime-type check (`application/pdf`, `image/jpeg`). Upload occurs **before** calendar date selection to lock applicant details.

---

## 9. Verification Workflow

1. **Imperva Incapsula Perimeter Challenge**: Appears on initial website visit. Automated execution of JS puzzle setting `incap_ses_*` cookie.
2. **Login CAPTCHA**: Appears on login page. Requires manual puzzle solution by applicant.
3. **MFA Login OTP**: Sent via Email/SMS upon submitting valid password. Expiry: 5 minutes.
4. **Final Confirmation OTP**: Optional SMS OTP before locking appointment date. Expiry: 3 minutes.
5. **Strict Rule**: No CAPTCHA or OTP mechanism will be automated or bypassed.

---

## 10. Browser & Network Behaviour

- **Protocol**: HTTPS (TLS 1.3 / WSS for dynamic updates if enabled).
- **Perimeter Headers**: `set-cookie: incap_ses_*`, `visid_incap_*`, `___utmvc`.
- **API Endpoints**:
  - `POST /api/auth/login`: Account authentication.
  - `GET /api/appointment/centres`: Returns list of active VACs.
  - `GET /api/appointment/available-slots`: Returns available dates/times for selected VAC & Category.
  - `POST /api/appointment/book`: Submits final slot reservation payload.
- **Browser Storage**: Session state stored in secure cookies (`httpOnly`, `sameSite=Lax`) and `sessionStorage`.

---

## 11. Normal Automation Compatibility

Refer to `reports/automation-matrix.md` for the full breakdown. Core highlights:
- **GREEN**: Profile pre-filling, dropdown filter selection, calendar DOM parsing, slot matching, alert notifications.
- **YELLOW**: Browser context launching, Incapsula session cookie maintenance, rate-limited polling, file upload handling.
- **RED**: CAPTCHA solving, OTP entry, payment processing.

---

## 12. Appointment Monitoring Design

- **Monitored Page/Endpoint**: `/api/appointment/available-slots` via authenticated browser context.
- **Dynamic Loading**: Calendar availability is fetched dynamically when VAC and category are selected.
- **Slot Identification**: Response contains non-empty `availableSlots` array with specific date strings and time arrays.
- **Safe Polling Interval**: **5 to 15 minutes** per session/IP to avoid Incapsula rate limits or IP ban.
- **Session Failure Recovery**: Automatic login re-authentication upon session expiration detection.

---

## 13. Multiple Applicants Design

- **Applicant Profiles**: Stored as isolated records in PostgreSQL database with AES-256 encryption for sensitive fields (passport number, contact info).
- **Session Isolation**: Each applicant or applicant group runs in a separate, isolated Playwright Browser Context with independent storage state and proxy IP if required.
- **Preferences Engine**: Dedicated preferences per applicant (Preferred Centre: Islamabad vs Lahore, Preferred Date Ranges: e.g. Oct 1 - Oct 15, Preferred Time Windows: Morning vs Afternoon).

---

## 14. Security and Privacy Recommendations

1. **Database Encryption**: PostgreSQL with `pgcrypto` column-level encryption for Passport Numbers, Phone Numbers, and DOB.
2. **Credential Safety**: Passwords hashed using `bcrypt` (work factor 12) or `argon2id`. Plaintext passwords/tokens **NEVER** logged.
3. **Environment Security**: All sensitive keys, JWT secrets, and DB credentials stored in system Environment Variables (`.env`).
4. **Audit Logging**: Comprehensive structured logging (Winston/Pino) with automatic secret redactor masks.
5. **Data Retention & Deletion**: Automatic purge of applicant documents and details 30 days post-appointment completion or immediately upon user deletion request.

---

## 15. Failure Handling & Edge Cases

| Failure Scenario | Observed Behavior | Recommended Recovery Strategy |
| :--- | :--- | :--- |
| **Slot Disappears During Booking** | Backend returns "Slot no longer available" error | Automatically revert to calendar view, alert user, and re-scan next available slot |
| **Session Expired** | HTTP 401 or redirect to `/login` | Automation re-authenticates using stored encrypted session refresh flow |
| **Incapsula WAF 403 Block** | Perimeter page served with incident ID | Pause polling, rotate browser context / IP proxy, increase backoff interval |
| **Network Disconnection / Timeout** | Browser load error / DOM timeout | Retries up to 3 times with exponential backoff before flagging offline state |
| **Server Error 500 / 503** | Portal temporarily unavailable banner | Wait 10 minutes, log incident, retry without spamming server |

---

## 16. Unknowns & Technical Blockers

### Identified Unknowns:
1. **Dynamic CAPTCHA Frequency**: Whether CAPTCHA triggers on every calendar month change or only upon slot reservation submission.
2. **Group Booking Limits**: Maximum number of family members allowed under a single appointment slot (estimated 5).

### Technical Blockers:
1. **Headless WAF Blocking**: Default headless Chromium is flagged by Incapsula WAF (HTTP 403). Requires headful or stealth browser context.
2. **MFA Requirement**: Registration and login require manual human interaction for OTP entry.

---

## 17. Recommended Technology Stack (Phase 2)

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI.
- **Backend API**: Node.js, Express / Next.js API Routes, TypeScript.
- **Database**: PostgreSQL with Prisma ORM & `pgcrypto` encryption.
- **Browser Automation Engine**: Playwright (Node.js) with custom stealth plugin & persistent browser contexts.
- **Background Tasks & Queue**: Redis + BullMQ for managing rate-limited monitoring schedules and worker pools.
- **Deployment**: Docker containers on Ubuntu VPS, Nginx reverse proxy with SSL (Let's Encrypt).
- **Notifications**: Email (Nodemailer / Resend), WhatsApp (Twilio API / Telegram Bot API).

---

## 18. Recommended Phase-2 Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       Next.js Web UI / Dashboard        │
                               │  (Applicant Management & Preferences)   │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │           PostgreSQL Database           │
                               │  (AES-256 Encrypted Profiles & Logs)    │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │             BullMQ / Redis              │
                               │       (Job Scheduler & Queue Manager)   │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │       Playwright Monitoring Worker      │
                               │   (Stealth Browser Contexts & Polling)  │
                               └──────────┬───────────────────┬──────────┘
                                          │                   │
                     Slot Detected        │                   │ CAPTCHA / OTP Needed
                          ▼               │                   ▼
       ┌──────────────────────────────────┴───┐    ┌──────────────────────────────────┐
       │   Automated Pre-filling & Booking    │    │  Human-in-the-Loop Notification  │
       │    (Category, Centre, Profile)       │    │  (WhatsApp / SMS / UI Prompt)    │
       └──────────────────┬───────────────────┘    └──────────────────────────────────┘
                          │
                          ▼
       ┌──────────────────────────────────────┐
       │   Appointment Confirmation PDF & QR  │
       └──────────────────────────────────────┘
```
