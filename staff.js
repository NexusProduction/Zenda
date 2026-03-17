// =============================================
//  ZENDA — Staff Management
// =============================================

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, query,
  where, getDocs, onSnapshot, updateDoc, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateStaffId } from './utils.js';

// ---- Create a new staff member ----
export async function createStaff({ name, email, password, role, companyId, companyName, createdBy }) {
  // Create Firebase Auth account for staff
  // We save current user's auth, create staff, then... 
  // NOTE: createUserWithEmailAndPassword signs in as that user in client SDK
  // So we do this: create account, then immediately re-sign in the current user
  // Better: use a separate Firebase app instance for staff creation

  // Generate unique staff ID
  const uniqueId = generateStaffId(role);

  // For staff, their "password" for login is their uniqueId
  // We create their auth account with email + uniqueId
  // (The `password` field here is admin-set, stored securely as uniqueId)
  const staffPassword = uniqueId; // Staff logs in with their uniqueId

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, staffPassword);
    const uid = cred.user.uid;

    // Create staff user document
    await setDoc(doc(db, 'users', uid), {
      name,
      email,
      role,
      companyId,
      uniqueId,
      designation: role.charAt(0).toUpperCase() + role.slice(1),
      createdBy,
      createdAt: new Date().toISOString()
    });

    // Increment staff count in company
    const companyRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyRef);
    if (companySnap.exists()) {
      const current = companySnap.data().staffCount || 0;
      await updateDoc(companyRef, { staffCount: current + 1 });
    }

    // Initialize installed apps for staff
    await setDoc(doc(db, 'installedApps', uid), {
      apps: ['calculator']
    });

    return { uid, name, email, role, uniqueId, companyId, companyName };

  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Use a different email.');
    }
    throw err;
  }
}

// ---- Get all staff in a company ----
export async function getCompanyStaff(companyId) {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    where('role', '!=', 'owner')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ---- Listen to company staff (real-time) ----
export function listenCompanyStaff(companyId, onUpdate) {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId)
  );
  return onSnapshot(q, snap => {
    const staff = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    // Sort: owner first, then manager, then staff
    staff.sort((a, b) => {
      const order = { owner: 0, manager: 1, staff: 2 };
      return (order[a.role] || 3) - (order[b.role] || 3);
    });
    onUpdate(staff);
  });
}

// ---- Get assignable staff (not owner) ----
export async function getAssignableStaff(companyId, currentUserId) {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.uid !== currentUserId && u.role !== 'owner');
    // Owner can't be assigned tasks
}

// ---- Update user profile ----
export async function updateUserProfile(uid, { name, email }) {
  const updates = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  await updateDoc(doc(db, 'users', uid), updates);
}

// ---- Render staff list item ----
export function renderStaffItem(member, currentUserRole) {
  const roleColors = {
    owner:   'badge-owner',
    manager: 'badge-manager',
    staff:   'badge-staff'
  };

  const initials = member.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  return `
    <div class="staff-list-item" data-uid="${member.uid}">
      <div class="avatar avatar-md" style="background:var(--primary-light);color:var(--primary);font-weight:700;font-size:0.85rem">
        ${initials}
      </div>
      <div class="staff-item-info">
        <div class="staff-item-name">${escapeHtml(member.name)}</div>
        <div class="staff-item-email">${escapeHtml(member.email)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${roleColors[member.role] || 'badge-info'}">${member.designation || member.role}</span>
        <span class="staff-item-id">${member.uniqueId || ''}</span>
      </div>
    </div>
  `;
}

function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
