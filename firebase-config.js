// Firebase SDK pieces we need: app init, login/auth, and the database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Project credentials for the Zenda Firebase project
const firebaseConfig = {
  apiKey:            "AIzaSyArQLilynpEoydg-nye9yCQ2cQIVpeuyUI",
  authDomain:        "zenda-app-593a8.firebaseapp.com",
  projectId:         "zenda-app-593a8",
  storageBucket:     "zenda-app-593a8.firebasestorage.app",
  messagingSenderId: "56547460703",
  appId:             "1:56547460703:web:689c2fb2707464ac733dea"
};

// Set up the app once, then get the auth and database handles every page uses
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };

// Exported so staff.js can spin up a second, separate Firebase app instance
// (needed to create a new staff account without logging the current owner out)
export { firebaseConfig };

// EmailJS account details, used to send OTP codes and welcome emails
export const EMAILJS_CONFIG = {
  serviceId: "service_eq2vbrf",
  templateId: "template_tfoskjm",
  publicKey: "e5zf2Kl3AwVaSEO9E"
};

// How long a login OTP code stays valid for
export const OTP_EXPIRY_MINUTES = 10;
