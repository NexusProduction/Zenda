import { db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, query,
  where, getDocs, onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateStaffId } from './utils.js';

// Secondary Firebase app — used ONLY to create staff accounts
// This prevents signing out the currently logged-in owner
let _secondaryApp = null;
function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'secondary');
  }
  return getAuth(_secondaryApp);
}

export async function createStaff({ name, email, password, role, companyId, companyName, createdBy }) {
  const uniqueId = generateStaffId(role);
  const staffPassword = uniqueId; // Staff logs in with uniqueId as password

  try {
    // Use secondary app so owner stays logged in
    const secondaryAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, staffPassword);
    const uid = cred.user.uid;

    // Sign out from secondary app immediately
    await secondaryAuth.signOut();

    // Create user doc
    await setDoc(doc(db, 'users', uid), {
      name, email, role, companyId, uniqueId,
      designation: role.charAt(0).toUpperCase() + role.slice(1),
      createdBy,
      createdAt: new Date().toISOString()
    });

    // Increment staff count
    const companyRef = doc(db, 'companies', companyId);
    const compSnap = await getDoc(companyRef);
    if (compSnap.exists()) {
      await updateDoc(companyRef, { staffCount: (compSnap.data().staffCount || 0) + 1 });
    }

    // Default installed apps
    await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });

    return { uid, name, email, role, uniqueId, companyId, companyName };

  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered in Firebase. Use a different email address.');
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
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  return onSnapshot(q, snap => {
    const staff = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    staff.sort((a, b) => ({ owner: 0, manager: 1, staff: 2 }[a.role] - { owner: 0, manager: 1, staff: 2 }[b.role]);
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

export function renderStaffItem(member, currentUserRole) {
  const roleColors = { owner: 'badge-owner', manager: 'badge-manager', staff: 'badge-staff' };
  const initials = member.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  return `
    <div class="staff-list-item" data-uid="${member.uid}">
      <div class="avatar avatar-md" style="background:var(--primary-light);color:var(--primary);font-weight:700;font-size:.85rem">${initials}</div>
      <div class="staff-item-info">
        <div class="staff-item-name">${escapeHtml(member.name)}</div>
        <div class="staff-item-email">${escapeHtml(member.email)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${roleColors[member.role] || 'badge-info'}">${member.designation || member.role}</span>
        <span class="staff-item-id">${member.uniqueId || ''}</span>
      </div>
    </div>`;
}

function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
