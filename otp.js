// Handles OTP generation, Firestore storage/verification, and email delivery via EmailJS
// Falls back to an on-screen popup if EmailJS isn't configured

import { db, OTP_EXPIRY_MINUTES } from './firebase-config.js';
import { doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// EmailJS project keys — used to send the OTP email
const EMAILJS_CONFIG = {
  serviceId: 'service_eq2vbrf',
  templateId: 'template_tfoskjm',
  publicKey: 'e5zf2Kl3AwVaSEO9E'
};

// 6-digit numeric OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Firestore doc IDs can't contain '.' or '@', so sanitize the email into a safe key
function emailToKey(email) {
  return email.replace(/[.@]/g, '_');
}

// Writes the OTP + expiry to Firestore under otps/{safeEmailKey}
async function storeOTP(email, otp) {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const key = emailToKey(email);
  await setDoc(doc(db, 'otps', key), {
    otp, email,
    expiresAt: expiresAt.toISOString(),
    used: false,
    createdAt: new Date().toISOString()
  });
}

// Dev-mode fallback: displays the OTP in a popup instead of emailing it,
// so login/signup still works locally without EmailJS set up
function showOTPOnScreen(otp, email) {
  const existing = document.getElementById('zenda-otp-devbox');
  if (existing) existing.remove();
  const prev = document.getElementById('zenda-otp-overlay');
  if (prev) prev.remove();

  const overlay = document.createElement('div');
  overlay.id = 'zenda-otp-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;backdrop-filter:blur(4px);';

  const box = document.createElement('div');
  box.id = 'zenda-otp-devbox';
  box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border:2px solid #4F46E5;border-radius:16px;padding:32px;z-index:99999;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;min-width:300px;font-family:Outfit,sans-serif;';
  box.innerHTML = `
    <div style="font-size:2rem;margin-bottom:8px">📬</div>
    <div style="font-weight:800;font-size:1.1rem;color:#111827;margin-bottom:4px">Your OTP Code</div>
    <div style="font-size:0.82rem;color:#6B7280;margin-bottom:20px">EmailJS not set up yet.<br>Use this code to continue:</div>
    <div id="otp-copy-box" onclick="navigator.clipboard.writeText('${otp}').then(()=>{this.style.background='#DCFCE7';this.style.color='#059669'})" style="font-family:monospace;font-size:2.4rem;font-weight:900;letter-spacing:0.2em;color:#4F46E5;background:#EEF2FF;border-radius:12px;padding:16px 24px;margin-bottom:20px;cursor:pointer;user-select:all;" title="Click to copy">${otp}</div>
    <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:16px">For: ${email} &nbsp;·&nbsp; Expires in 10 min<br>Click the code above to copy it</div>
    <button onclick="document.getElementById('zenda-otp-devbox').remove();document.getElementById('zenda-otp-overlay').remove();" style="background:#4F46E5;color:white;border:none;padding:10px 28px;border-radius:10px;font-weight:700;font-size:0.9rem;cursor:pointer;">Got it →</button>
  `;

  overlay.onclick = () => { overlay.remove(); box.remove(); };
  document.body.appendChild(overlay);
  document.body.appendChild(box);
}

// True only if EmailJS SDK is loaded and all config keys are present
function isEmailJSConfigured() {
  return (
    typeof emailjs !== 'undefined' &&
    EMAILJS_CONFIG.publicKey &&
    EMAILJS_CONFIG.serviceId &&
    EMAILJS_CONFIG.templateId
  );
}

// Sends the OTP via EmailJS; falls back to the on-screen popup on missing config or send failure
async function sendOTPEmail(email, otp, userName = '', companyName = 'Zenda') {
  if (!isEmailJSConfigured()) {
    console.warn(`[ZENDA DEV] OTP for ${email}: ${otp}`);
    showOTPOnScreen(otp, email);
    return true;
  }

  try {
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      {
        to_email: email,
        otp_code: otp,
        user_name: userName || email.split('@')[0],
        company_name: companyName
      },
      EMAILJS_CONFIG.publicKey
    );
    console.log('[ZENDA] Email sent successfully via EmailJS!');
    return true;
  } catch (err) {
    console.error('[ZENDA] EmailJS failed, showing OTP on screen:', err);
    showOTPOnScreen(otp, email);
    return true;
  }
}

// Validates entered OTP against Firestore: checks existence, used flag, expiry, then match
async function verifyOTP(email, enteredOTP) {
  const key = emailToKey(email);
  const docRef = doc(db, 'otps', key);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return { success: false, message: 'OTP not found. Please request a new one.' };

  const data = snap.data();
  if (data.used) return { success: false, message: 'OTP already used. Please request a new one.' };

  if (new Date() > new Date(data.expiresAt)) {
    await deleteDoc(docRef);
    return { success: false, message: 'OTP expired. Please request a new one.' };
  }

  if (data.otp !== enteredOTP.trim()) return { success: false, message: 'Incorrect OTP. Please try again.' };

  await setDoc(docRef, { ...data, used: true });
  return { success: true };
}

// Public entry point: generate, store, and send an OTP — called from login.html / signup.html
export async function sendOTP(email, userName = '', companyName = 'Zenda') {
  const otp = generateOTP();
  await storeOTP(email, otp);
  await sendOTPEmail(email, otp, userName, companyName);
  return true;
}

// Public entry point: verify an entered OTP — called from login.html / signup.html
export async function verifyUserOTP(email, enteredOTP) {
  return await verifyOTP(email, enteredOTP);
}
