# GVC World Android SMS OTP Auto-Forwarder & Relay App

This is a dedicated **React Native Android Application** built to run on the applicant's mobile phone. It requests Android SMS permissions (`RECEIVE_SMS`, `READ_SMS`), automatically listens for incoming SMS messages containing OTP codes sent by GVC World during visa appointment applications, extracts the OTP code, and forwards it to the GVC Portal Agent for automatic injection into the active booking session.

---

## 📱 Mobile App Directory Structure

```
c:\Users\LENOVO\My Work\gerexeagetnaut\mobile-otp-forwarder\
├── App.js               # React Native Main Application Component & SMS Relay Controller
├── app.json             # Android Package Configuration & SMS Permissions Manifest
├── package.json         # Expo & React Native Dependencies
└── README.md            # Installation & Build Instructions
```

---

## ⚙️ Android Permissions Included (`app.json`)

* `android.permission.RECEIVE_SMS`: Enables real-time SMS broadcast receiver listening when GVC sends SMS OTPs.
* `android.permission.READ_SMS`: Allows reading message contents to extract 4-6 digit numeric OTP verification codes.
* `android.permission.INTERNET`: Allows transmitting extracted OTP codes directly to the GVC backend server.

---

## 🚀 How to Run & Build Android APK

### Option A: Run Locally via Expo
```bash
# 1. Navigate to the mobile app folder
cd mobile-otp-forwarder

# 2. Install dependencies
npm install

# 3. Start Expo Android development server
npm run android
```

### Option B: Build Direct Android Standalone APK (`.apk`)
```bash
# Build standalone Android APK file using Expo EAS
npx eas-cli build --platform android --profile preview
```

---

## 🔗 Backend API Integration

The app transmits OTP codes directly to your server endpoint:
* **Endpoint**: `POST /api/applications/submit-otp`
* **Payload**:
  ```json
  {
    "otpCode": "583920",
    "source": "ANDROID_SMS_AUTO_RELAY",
    "rawMessageSnippet": "Your GVC World Greece appointment verification code is 583920"
  }
  ```
