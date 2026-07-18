// staff.js — staff member lifecycle: create, delete, list, and update
// team members for a company account.

import { db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
  setPersistence,
  inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, query,
  where, getDocs, onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateStaffId } from './utils.js';

// ── Secondary app — keeps owner signed in when creating/deleting staff ──
// Creating/signing in a Firebase Auth user normally swaps the CURRENT
// session to that user. Running it through a second, isolated Firebase
// app instance means the owner's own login session is untouched.
let _secondaryApp = null;

// Lazily creates (once) and returns the secondary Auth instance.
// Module-level singleton: ES modules only evaluate once per page load,
// so _secondaryApp survives across multiple createStaff/deleteStaffMember calls.
async function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'zenda-secondary');
  }
  const secAuth = getAuth(_secondaryApp);

  // In-memory only — nothing persisted to browser storage for this
  // throwaway session, and it clears itself when the tab closes.
  await setPersistence(secAuth, inMemoryPersistence);

  return secAuth;
}
export async function createStaff({ name, email, password, role, companyId, companyName, createdBy, designation }) {
  if (!name?.trim())        throw new Error('FIELD:cs-name:Full name is required.');
  if (!email?.trim())       throw new Error('FIELD:cs-email:Email address is required.');
  if (!password?.trim())    throw new Error('FIELD:cs-password:Password is required.');
  if (password.length < 6)  throw new Error('FIELD:cs-password:Password must be at least 6 characters.');
  if (!designation?.trim()) throw new Error('FIELD:cs-designation:Designation is required.');

  // Check premium status BEFORE touching Firebase Auth — avoids creating
  // an orphaned Auth account if this check fails.
  const compRef = doc(db, 'companies', companyId);
  const compSnap = await getDoc(compRef);
  if (compSnap.exists()) {
    const compData = compSnap.data();

    let isUpgraded = compData.isPremium === true;
    if (isUpgraded && compData.subscriptionExpiry && new Date(compData.subscriptionExpiry) <= new Date()) {
      isUpgraded = false;
    }

    if (!isUpgraded) {
      throw new Error("Your account is not upgraded. Please upgrade from the Subscription page to add staff.");
    }
  }

  const uniqueId = generateStaffId(role);
  let uid;

  try {
    const secAuth = await getSecondaryAuth();

    try {
      const cred = await createUserWithEmailAndPassword(secAuth, email.trim(), password.trim());
      uid = cred.user.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const cred = await signInWithEmailAndPassword(secAuth, email.trim(), password.trim());
          uid = cred.user.uid;
        } catch (recycleErr) {
          await secAuth.signOut();
          throw new Error("This email is already registered and the password does not match. Please use a different email.");
        }
      } else {
        await secAuth.signOut();
        if (err.code === 'auth/weak-password') throw new Error('FIELD:cs-password:Password must be at least 6 characters.');
        if (err.code === 'auth/invalid-email') throw new Error('FIELD:cs-email:Invalid email address.');
        throw err;
      }
    }

    // Create the Firestore user doc using the new (or recycled) UID.
    // passwordHint stores the real password so the OTP-based login flow
    // (auth.js: completeOTPLogin) can silently sign this account in later.
    await setDoc(doc(db, 'users', uid), {
      name: name.trim(), email: email.trim(), role, companyId, uniqueId,
      designation: designation.trim(), createdBy,
      passwordHint: password.trim(),
      createdAt: new Date().toISOString()
    });

    // Default installed-app set for a new staff member
    await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });
    await secAuth.signOut();

    return { uid, name: name.trim(), email: email.trim(), role, uniqueId, companyId, companyName, designation: designation.trim() };

  } catch (err) {
    // Field-level and "not upgraded" errors are already well-formed —
    // pass them straight through. Anything else falls through as-is too.
    if (err.message && err.message.startsWith('FIELD:')) throw err;
    if (err.message === "You need an active Unlimited Staff Add-on to create staff. Please purchase it from the Subscription page.") throw err;
    throw err;
  }
}

// ── Delete staff — removes Firestore data AND Firebase Auth account ──
export async function deleteStaffMember(uid, staffEmail, staffPassword) {
  // Firestore cleanup first. If the main user doc can't be deleted,
  // treat it as a hard permission failure and stop.
  try { await deleteDoc(doc(db, 'users', uid)); } catch(e) { throw new Error('Permission denied.'); }
  // Best-effort cleanup of related docs — failures here are ignored,
  // since the user record is already gone either way.
  try { await deleteDoc(doc(db, 'installedApps', uid)); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calculator')); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calendar')); } catch(e) {}

  // Only attempt to remove the Firebase Auth account if we were given
  // credentials to sign in as that staff member (deleteUser requires a
  // recent sign-in as the target user, not just knowing their uid).
  if (staffEmail && staffPassword) {
    try {
      const secAuth = await getSecondaryAuth();
      const cred = await signInWithEmailAndPassword(secAuth, staffEmail, staffPassword);
      await deleteUser(cred.user);
      await secAuth.signOut();
    } catch(e) {
      // If the password no longer matches (e.g. changed since), the Auth
      // account is silently left behind — it becomes an orphan that the
      // "recycle" logic in createStaff can pick up later.
      console.warn('Auth account deletion skipped:', e.code);
    }
  }
}

// Realtime listener for a company's full team list, sorted owner → manager → staff
export function listenCompanyStaff(companyId, onUpdate) {
  const order = { owner: 0, manager: 1, staff: 2 };
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  return onSnapshot(q, snap => {
    const staff = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    staff.sort((a, b) => (order[a.role] || 3) - (order[b.role] || 3));
    onUpdate(staff);
  });
}
