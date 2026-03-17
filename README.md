# ⚡ Zenda — Setup Guide

A complete company management web app. Multi-page, Pure HTML/CSS/JS + Firebase.

---

## 📁 Project Structure

```
zenda/
├── index.html              ← Landing page
├── login.html              ← Login (Owner + Staff tabs)
├── signup.html             ← Company signup (multi-step + OTP)
├── firestore.rules         ← Firebase security rules
│
├── css/
│   ├── global.css          ← Design system, buttons, forms, utilities
│   ├── landing.css         ← Landing page styles
│   ├── auth.css            ← Login/signup styles
│   └── dashboard.css       ← Dashboard + all panels/modals
│
├── js/
│   ├── firebase-config.js  ← ⚠️ YOUR CONFIG GOES HERE
│   ├── auth.js             ← Signup, login, session management
│   ├── otp.js              ← OTP send/verify via EmailJS + Firestore
│   ├── notifications.js    ← Real-time notification system
│   ├── tasks.js            ← Task assignment + completion
│   ├── staff.js            ← Create/list staff members
│   ├── card-generator.js   ← Canvas ID card generator
│   ├── apps.js             ← Mini-app system + Firebase sync
│   └── utils.js            ← Helpers, toast, formatters
│
├── dashboard/
│   └── dashboard.html      ← Main app (topbar + sidebar + all views)
│
└── apps/
    ├── calculator.html     ← Calculator with history sync
    └── calendar.html       ← Calendar with events sync
```

---

## 🚀 Step 1: Firebase Setup

### A. Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it: `zenda-app` (or anything)
4. Disable Google Analytics (optional)
5. Click **Create project**

### B. Enable Authentication
1. Left panel → **Authentication** → **Get started**
2. Sign-in method → **Email/Password** → Enable → Save

### C. Create Firestore Database
1. Left panel → **Firestore Database** → **Create database**
2. Choose **"Start in test mode"** (for now)
3. Pick your region → Enable
4. After created, go to **Rules** tab
5. Paste the contents of `firestore.rules` → Publish

### D. Get Your Config
1. Project settings (gear icon) → **Your apps** → **Add app** → Web `</>`
2. Register app, copy the `firebaseConfig` object
3. Open `js/firebase-config.js` and replace the placeholder config

---

## 📧 Step 2: EmailJS Setup (for OTP emails)

1. Sign up FREE at https://www.emailjs.com
2. **Add Email Service** → Gmail (connect your Gmail)
3. **Email Templates** → Create template with these variables:
   ```
   Subject: Your Zenda OTP Code: {{otp_code}}
   
   Body:
   Hello {{user_name}},
   
   Your Zenda verification code is:
   
   {{otp_code}}
   
   This code expires in 10 minutes.
   Do not share this code with anyone.
   
   — Team Zenda
   ```
4. Go to **Account** → copy your **Public Key**
5. Copy your **Service ID** and **Template ID**
6. Open `js/firebase-config.js` and fill in:
   ```js
   export const EMAILJS_CONFIG = {
     publicKey:  "your_public_key",
     serviceId:  "your_service_id",
     templateId: "your_template_id"
   };
   ```

> 💡 **Dev Mode**: While testing, OTPs are shown in the browser console and as a toast notification automatically if EmailJS is not configured.

---

## 🌐 Step 3: Deploy / Run

### Local Testing
You MUST use a local server (not file://) because Firebase SDK uses ES modules.

**Option A — VS Code Live Server:**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

**Option B — Python:**
```bash
cd zenda
python3 -m http.server 3000
# Visit: http://localhost:3000
```

**Option C — Node.js:**
```bash
npx serve zenda
```

### Deploy to Firebase Hosting (FREE)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: . (the zenda folder)
# Single-page app: No
firebase deploy
```

---

## 👥 How Roles Work

| Feature | Owner | Manager | Staff |
|---------|-------|---------|-------|
| Create company | ✅ | ✗ | ✗ |
| Add staff | ✅ | ✗ | ✗ |
| Assign tasks | ✅ | ✅ | ✗ |
| Receive tasks | ✗ | ✅ | ✅ |
| Complete/Decline tasks | ✗ | ✅ | ✅ |
| See all logins | ✅ | ✗ | ✗ |
| View staff list | ✅ | ✗ | ✗ |

---

## 🪪 Staff Login Flow

When you create a staff member, their **Unique ID** (e.g., `STF483920`) becomes their password.

**Staff login:**
- Email: `jane@email.com`
- Unique ID (used as password): `STF483920`
- OTP sent to their email for verification

---

## 🎨 ID Card Colors

| Role | Card Theme |
|------|-----------|
| Company | Indigo/Purple gradient |
| Owner | Gold/Amber gradient |
| Manager | Blue gradient |
| Staff | Green gradient |

---

## 📱 Mini Apps

| App | Pre-installed | Data Synced |
|-----|--------------|-------------|
| Calculator | ✅ Yes | History synced to Firebase |
| Calendar | ❌ (install from library) | Events synced to Firebase |

---

## 🔔 Notification Types

| Event | Who Gets Notified |
|-------|------------------|
| Any staff logs in | Owner |
| Task assigned to you | Assignee |
| Task marked done | Assigner |
| Task declined | Assigner |

---

## ⚠️ Security Checklist (Before going live)

- [ ] Replace test Firebase config with production config
- [ ] Apply Firestore security rules from `firestore.rules`
- [ ] Remove dev-mode OTP console log from `js/otp.js`
- [ ] Delete OTP docs automatically using Firebase Functions (optional)
- [ ] Set up Firebase App Check for abuse prevention

---

Built with ❤️ using Pure HTML/CSS/JS + Firebase Firestore + EmailJS
