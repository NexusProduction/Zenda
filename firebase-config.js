import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "YOUR_NEW_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
export { firebaseConfig };

export const EMAILJS_CONFIG = {
  serviceId:  'service_dc7ge9b',
  templateId: 'template_4turj9r',
  publicKey:  'dg8t6B0d-DhPa3Tl6'
};

export const APP_VERSION = "1.0.0";
export const OTP_EXPIRY_MINUTES = 10;
