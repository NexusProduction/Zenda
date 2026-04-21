import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyArQLilynpEoydg-nye9yCQ2cQIVpeuyUI",
  authDomain:        "zenda-app-593a8.firebaseapp.com",
  projectId:         "zenda-app-593a8",
  storageBucket:     "zenda-app-593a8.firebasestorage.app",
  messagingSenderId: "56547460703",
  appId:             "1:56547460703:web:689c2fb2707464ac733dea"
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
