import { db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, query,
  where, getDocs, onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateStaffId } from './utils.js';

let _secondaryApp = null;
function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'zenda-staff-creator');
  }
  return getAuth(_secondaryApp);
}

export async function createStaff({ name, email, password, role, companyId, companyName, createdBy, designation }) {
  // Use provided password or fall back to uniqueId
  const uniqueId = generateStaffId(role);
  const staffPassword = password || uniqueId;

  try {
    const secondaryAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, staffPassword);
    const uid = cred.user.uid;
    await secondaryAuth.signOut();

    await setDoc(doc(db, 'users', uid), {
      name, email, role, companyId, uniqueId,
      designation: designation || role.charAt(0).toUpperCase() + role.slice(1),
      createdBy,
      createdAt: new Date().toISOString()
    });

    const companyRef = doc(db, 'companies', companyId);
    const compSnap = await getDoc(companyRef);
    if (compSnap.exists()) {
      await updateDoc(companyRef, { staffCount: (compSnap.data().staffCount || 0) + 1 });
    }

    await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });

    return { uid, name, email, role, uniqueId, companyId, companyName, designation: designation || role };

  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Use a different email.');
    }
    throw err;
  }
}

export async function deleteStaffMember(uid) {
  // Delete all user data
  await deleteDoc(doc(db, 'users', uid));
  // Clean up related data
  try { await deleteDoc(doc(db, 'installedApps', uid)); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calculator')); } catch(e) {}
  try { await deleteDoc(doc(db, 'appData', uid, 'apps', 'calendar')); } catch(e) {}
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
