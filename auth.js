// =============================================
//  ZENDA — Authentication
//  Handles: signup (owner), login (owner + staff),
//           session check, logout
// =============================================

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, addDoc,
  query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateUniqueCode, generateStaffId } from './utils.js';
import { addNotification } from './notifications.js';

// =============================================
//  OWNER SIGNUP
// =============================================
export async function ownerSignUp(companyName, ownerName, email, password) {
  // 1. Create Firebase Auth account
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // 2. Generate unique company code: first 4 letters of company + 6 random
  const uniqueCode = generateUniqueCode(companyName);

  // 3. Create company doc
  const companyRef = doc(db, 'companies', uid); // use owner uid as company id
  await setDoc(companyRef, {
    name:        companyName,
    email:       email,
    uniqueCode:  uniqueCode,
    ownerId:     uid,
    staffCount:  0,
    createdAt:   new Date().toISOString()
  });

  // 4. Create user (owner) doc
  await setDoc(doc(db, 'users', uid), {
    name:        ownerName,
    email:       email,
    role:        'owner',
    companyId:   uid, // company doc id = owner uid
    uniqueId:    uniqueCode,
    designation: 'Owner',
    createdAt:   new Date().toISOString()
  });

  // 5. Initialize installed apps for this user
  await setDoc(doc(db, 'installedApps', uid), {
    apps: ['calculator']
  });

  return {
    uid,
    companyName,
    ownerName,
    email,
    uniqueCode
  };
}

// =============================================
//  OWNER / STAFF LOGIN
// =============================================
export async function userLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // Get user data
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('User profile not found. Contact your admin.');

  const userData = userSnap.data();

  // Log login notification to owner
  await logLoginNotification(uid, userData);

  return { uid, ...userData };
}

// =============================================
//  STAFF LOGIN (email + uniqueId as password)
// =============================================
export async function staffLogin(email, uniqueId) {
  // For staff, uniqueId IS their password
  const cred = await signInWithEmailAndPassword(auth, email, uniqueId);
  const uid = cred.user.uid;

  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('User not found.');

  const userData = userSnap.data();
  if (userData.role === 'owner') {
    throw new Error('Please use the Owner login tab.');
  }

  await logLoginNotification(uid, userData);
  return { uid, ...userData };
}

// =============================================
//  LOG LOGIN NOTIFICATION
// =============================================
async function logLoginNotification(uid, userData) {
  const companyId = userData.companyId;
  const role = userData.role;
  const name = userData.name;

  // Get device/browser info
  const device = getDeviceInfo();

  // Notify owner of all logins (except owner's own login which goes to owner too)
  if (companyId) {
    // Find owner of this company
    const companySnap = await getDoc(doc(db, 'companies', companyId));
    if (companySnap.exists()) {
      const { ownerId } = companySnap.data();
      if (ownerId) {
        await addNotification(ownerId, {
          type:    'login',
          message: `${name} (${role}) logged in from ${device}`,
          actorId: uid,
          actorName: name
        });
      }
    }
  }
}

// =============================================
//  LOGOUT
// =============================================
export async function logout() {
  await signOut(auth);
  window.location.href = '../login.html';
}

// =============================================
//  GET CURRENT USER DATA
// =============================================
export async function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      if (!firebaseUser) {
        resolve(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          resolve({ uid: firebaseUser.uid, ...snap.data() });
        } else {
          resolve(null);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

// =============================================
//  AUTH GUARD — redirect if not logged in
// =============================================
export function requireAuth(redirectTo = '../login.html') {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// =============================================
//  AUTH GUARD — redirect if already logged in
// =============================================
export function redirectIfLoggedIn(redirectTo = 'dashboard.html') {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    if (user) window.location.href = redirectTo;
  });
}

// =============================================
//  HELPER: Device Info
// =============================================
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let device = 'Desktop';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  if (/Mobi|Android/i.test(ua)) device = 'Mobile';
  else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';

  return `${browser} on ${device}`;
}
