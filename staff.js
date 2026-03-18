import { db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, query,
  where, getDocs, onSnapshot, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateStaffId } from './utils.js';

// Secondary Firebase app — prevents owner being signed out when creating staff
let _secondaryApp = null;
function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'zenda-staff-creator');
  }
  return getAuth(_secondaryApp);
}

export async function createStaff({ name, email, role, companyId, companyName, createdBy }) {
  const uniqueId = generateStaffId(role);
  const staffPassword = uniqueId;

  try {
    const secondaryAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, staffPassword);
    const uid = cred.user.uid;

    // Sign out from secondary immediately
    await secondaryAuth.signOut();

    await setDoc(doc(db, 'users', uid), {
      name, email, role, companyId, uniqueId,
      designation: role.charAt(0).toUpperCase() + role.slice(1),
      createdBy,
      createdAt: new Date().toISOString()
    });

    const companyRef = doc(db, 'companies', companyId);
    const compSnap = await getDoc(companyRef);
    if (compSnap.exists()) {
      await updateDoc(companyRef, { staffCount: (compSnap.data().staffCount || 0) + 1 });
    }

    await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });

    return { uid, name, email, role, uniqueId, companyId, companyName };

  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Use a different email.');
    }
    throw err;
  }
}

export async function getCompanyStaff(companyId) {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
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

export function renderStaffItem(member) {
  const roleColors = { owner: 'badge-owner', manager: 'badge-manager', staff: 'badge-staff' };
  const initials = member.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  return `
    <div class="staff-list-item" data-uid="${member.uid}">
      <div class="avatar avatar-md" style="background:#EEF2FF;color:#4F46E5;font-weight:700;font-size:.85rem">${initials}</div>
      <div>
        <div style="font-size:.88rem;font-weight:600">${esc(member.name)}</div>
        <div style="font-size:.76rem;color:#9CA3AF">${esc(member.email)}</div>
      </div>
      <span class="badge ${roleColors[member.role] || 'badge-info'}">${member.designation || member.role}</span>
    </div>`;
}

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
