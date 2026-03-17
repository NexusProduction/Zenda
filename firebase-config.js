import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDKtQMG-fUr2rvGL1bgnnSbSrfaAVu9Nn4",
  authDomain:        "zenda-app-fe1c2.firebaseapp.com",
  projectId:         "zenda-app-fe1c2",
  storageBucket:     "zenda-app-fe1c2.firebasestorage.app",
  messagingSenderId: "764717910838",
  appId:             "1:764717910838:web:18a9ac7772ba91f4928197",
  measurementId:     "G-4HFMJ8DXPL"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };

export const EMAILJS_CONFIG = {
  publicKey:  "dg8t6B0d-DhPa3Tl6",
  serviceId:  "service_dc7ge9b",
  templateId: "template_4turj9r"
};

export const APP_VERSION = "1.0.0";
export const OTP_EXPIRY_MINUTES = 10;
