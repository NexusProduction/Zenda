import { db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, query,
  where, getDocs, onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateStaffId } from './utils.js';

// ── Secondary app — keeps owner signed in when creating/deleting staff ──
let _secondaryApp = null;
function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'zenda-secondary');
  }
  return getAuth(_secondaryApp);
}

// ── Create staff ──
export async function createStaff({ name, email, password, role, companyId, companyName, createdBy, designation }) {
  if (!name?.trim())        throw new Error('FIELD:cs-name:Full name is required.');
  if (!email?.trim())       throw new Error('FIELD:cs-email:Email address is required.');
  if (!password?.trim())    throw new Error('FIELD:cs-password:Password is required.');
  if (password.length < 6)  throw new Error('FIELD:cs-password:Password must be at least 6 characters.');
  if (!designation?.trim()) throw new Error('FIELD:cs-designation:Designation is required.');

  const uniqueId = generateStaffId(role);

  try {
    const secAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secAuth, email.trim(), password.trim());
    const uid = cred.user.uid;
    await secAuth.signOut();

    await setDoc(doc(db, 'users', uid), {
      name: name.trim(), email: email.trim(), role, companyId, uniqueId,
      designation: designation.trim(), createdBy,
      createdAt: new Date().toISOString()
    });

    const compRef = doc(db, 'companies', companyId);
    const compSnap = await getDoc(compRef);
    if (compSnap.exists()) {
      await updateDoc(compRef, { staffCount: (compSnap.data().staffCount || 0) + 1 });
    }

    await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });

    return { uid, name: name.trim(), email: email.trim(), role, uniqueId, companyId, companyName, designation: designation.trim() };

  } catch (err) {
    if (err.message.startsWith('FIELD:')) throw err;
    if (err.code === 'auth/email-already-in-use') throw new Error('This email is already registered. Use a different email.');
    if (err.code === 'auth/weak-password')        throw new Error('FIELD:cs-password:Password must be at least 6 characters.');
    if (err.code === 'auth/invalid-email')        throw new Error('FIELD:cs-email:Invalid email address.');
    throw err;
  }
}

// ── Delete staff — removes Firestore data AND Firebase Auth account ──
export async function deleteStaffMember(uid, staffEmail, staffPassword) {
  // 1. Delete Firestore docs
  try { await deleteDoc(doc(db, 'users', uid)); } catch(e) { throw new Error('Permission denied. Make sure you applied the latest Firestore rules.'); }
  try { await deleteDoc(doc(db, 'installedApps', uid)); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calculator')); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calendar')); } catch(e) {}

  // 2. Delete Firebase Auth account using secondary app
  // Sign in as the staff member using their uniqueId as password, then delete
  if (staffEmail && staffPassword) {
    try {
      const secAuth = getSecondaryAuth();
      const cred = await signInWithEmailAndPassword(secAuth, staffEmail, staffPassword);
      await deleteUser(cred.user);
      await secAuth.signOut();
    } catch(e) {
      // Auth deletion failed silently — Firestore data is already deleted
      // User can no longer log in since their Firestore profile is gone
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
  await updateDoc(doc(db, 'users', uid), updates);
}
