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
let _secondaryApp = null;

async function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'zenda-secondary');
  }
  const secAuth = getAuth(_secondaryApp);
  
  await setPersistence(secAuth, inMemoryPersistence);
  
  return secAuth;
}

export async function createStaff({ name, email, password, role, companyId, companyName, createdBy, designation }) {
  if (!name?.trim())        throw new Error('FIELD:cs-name:Full name is required.');
  if (!email?.trim())       throw new Error('FIELD:cs-email:Email address is required.');
  if (!password?.trim())    throw new Error('FIELD:cs-password:Password is required.');
  if (password.length < 6)  throw new Error('FIELD:cs-password:Password must be at least 6 characters.');
  if (!designation?.trim()) throw new Error('FIELD:cs-designation:Designation is required.');
  
  const uniqueId = generateStaffId(role);
  let uid;
  
  try {
    const secAuth = await getSecondaryAuth();
    
    // Attempt to create the user
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, email.trim(), password.trim());
      uid = cred.user.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        // RECYCLE LOGIC: Attempt to log into the orphaned account
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

    // Staff creation requires an active company premium subscription.
    // (The old per-seat "Unlimited Staff Add-on" purchase system has
    // been removed — this is now a simple upgraded / not-upgraded gate.)
    const compRef = doc(db, 'companies', companyId);
    const compSnap = await getDoc(compRef);
    if (compSnap.exists()) {
      const compData = compSnap.data();

      let isUpgraded = compData.isPremium === true;
      if (isUpgraded && compData.subscriptionExpiry && new Date(compData.subscriptionExpiry) <= new Date()) {
        isUpgraded = false;
      }

      if (!isUpgraded) {
        await secAuth.signOut();
        throw new Error("Your account is not upgraded. Please upgrade from the Subscription page to add staff.");
      }
    }

    // Create the Firestore Documents using the new or recycled UID
    await setDoc(doc(db, 'users', uid), {
      name: name.trim(), email: email.trim(), role, companyId, uniqueId,
      designation: designation.trim(), createdBy,
      passwordHint: password.trim(),
      createdAt: new Date().toISOString()
    });
    
    await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });
    await secAuth.signOut();
    
    return { uid, name: name.trim(), email: email.trim(), role, uniqueId, companyId, companyName, designation: designation.trim() };
    
  } catch (err) {
    if (err.message && err.message.startsWith('FIELD:')) throw err;
    if (err.message === "You need an active Unlimited Staff Add-on to create staff. Please purchase it from the Subscription page.") throw err;
    throw err;
  }
}
// ── Delete staff — removes Firestore data AND Firebase Auth account ──
export async function deleteStaffMember(uid, staffEmail, staffPassword) {
  try { await deleteDoc(doc(db, 'users', uid)); } catch(e) { throw new Error('Permission denied.'); }
  try { await deleteDoc(doc(db, 'installedApps', uid)); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calculator')); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calendar')); } catch(e) {}

  if (staffEmail && staffPassword) {
    try {
      const secAuth = await getSecondaryAuth();
      const cred = await signInWithEmailAndPassword(secAuth, staffEmail, staffPassword);
      await deleteUser(cred.user);
      await secAuth.signOut();
    } catch(e) {
      console.warn('Auth account deletion skipped:', e.code);
    }
  }
}

export function listenCompanyStaff(companyId, onUpdate) {
  const order = { owner: 0, manager: 1, staff: 2 };
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  return onSnapshot(q, snap => {
    const staff = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    staff.sort((a, b) => (order[a.role] || 3) - (order[b.role] || 3));
    onUpdate(staff);
  });
}

export async function getAssignableStaff(companyId, currentUserId) {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.uid !== currentUserId && u.role !== 'owner');
}

export async function updateUserProfile(uid, updates) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data();
    
    // Editing a staff member's email requires an active company premium
    // subscription. (Add-on/staff-card purchase system removed.)
    if (updates.email && updates.email !== userData.email) {
      const compRef = doc(db, 'companies', userData.companyId);
      const compSnap = await getDoc(compRef);
      
      if (compSnap.exists()) {
        const compData = compSnap.data();
        let isUpgraded = compData.isPremium === true;
        if (isUpgraded && compData.subscriptionExpiry && new Date(compData.subscriptionExpiry) <= new Date()) {
          isUpgraded = false;
        }

        if (!isUpgraded) {
          throw new Error("Your account is not upgraded. Please upgrade to modify staff emails.");
        }
      }
    }
  }
  
  await updateDoc(userRef, updates);
}
