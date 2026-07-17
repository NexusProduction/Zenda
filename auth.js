import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function requireAuth(redirectUrl = 'login.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        if (window.location.pathname.indexOf(redirectUrl) === -1) {
          window.location.href = redirectUrl;
        }
        resolve(null);
      }
    }, reject);
  });
}

// MISSING FUNCTION ADDED: Fast redirect if user is already logged in
export function redirectIfLoggedIn(redirectUrl = 'dashboard.html') {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = redirectUrl;
    }
  });
}

// Get the rich user object (combines Firebase Auth with Firestore data)
export async function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
    resolve({ uid: user.uid, email: user.email, ...docSnap.data() });
} else {
    // SELF-HEALING: Document not found by UID — try finding by email
    // This fixes staff accounts created with wrong document ID (addDoc fallback bug)
    try {
        const { query, collection, where, getDocs, setDoc } = await import(
            "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
        );
        const q = query(collection(db, 'users'), where('email', '==', user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const data = snap.docs[0].data();
            // Fix the path permanently so future logins work correctly
            await setDoc(doc(db, 'users', user.uid), { ...data, uid: user.uid });
            resolve({ uid: user.uid, email: user.email, ...data });
        } else {
            resolve({ uid: user.uid, email: user.email });
        }
    } catch (fallbackErr) {
        console.error("Fallback lookup failed:", fallbackErr);
        resolve({ uid: user.uid, email: user.email });
    }
}
        } catch (error) {
          console.error("Error fetching user data:", error);
          resolve({ uid: user.uid, email: user.email });
        }
      } else {
        resolve(null);
      }
    });
  });
}

// ── PASSWORDLESS HELPERS ─────────────────────────────────────────
// Firebase's client SDK still requires *some* credential under the hood to
// create/sign-in an Auth user. The user never sees this — it's generated
// randomly at signup and stored (same field that already held the real
// password before: `passwordHint`), then used silently after OTP success.
function generateAuthKey(length = 24) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let key = '';
  for (let i = 0; i < length; i++) {
    key += charset[bytes[i] % charset.length];
  }
  return key;
}

// Look up a user document by email — used to confirm an account exists
// before sending a login OTP, and to fetch their name for the email template.
export async function findUserByEmail(email) {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { uid: d.id, ...d.data() };
  } catch (error) {
    console.error('findUserByEmail failed:', error);
    throw error;
  }
}
// Call this ONLY after verifyUserOTP() has returned success.
export async function completeOTPLogin(email) {
  const userRecord = await findUserByEmail(email);
  if (!userRecord) throw new Error('No account found with this email.');

  // Gather possible keys in case data was saved differently
  const possibleKeys = [];
  if (userRecord.passwordHint) possibleKeys.push(userRecord.passwordHint);
  if (userRecord.password) possibleKeys.push(userRecord.password);
  
  if (possibleKeys.length === 0) {
    throw new Error('This account is missing its login credential. Please contact support.');
  }

  let user = null;
  let lastErr = null;

  // Try all possible stored passwords to force a successful sync
  for (const key of possibleKeys) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, key.trim());
      user = userCredential.user;
      break; // Success!
    } catch (err) {
      lastErr = err;
    }
  }

  // If ALL attempts fail, the Firebase Auth data is permanently out of sync with Firestore
  if (!user) {
    console.error("Credential Mismatch:", lastErr);
    throw new Error('Security Error: Your account credentials are out of sync. Please contact support to reset your account.');
  }

  try {
    await addDoc(collection(db, 'users', user.uid, 'notifications'), {
      type: 'security_login',
      message: 'Your account was accessed from a new device.',
      createdAt: Date.now(),
      read: false,
      status: 'unread'
    });
  } catch (err) {
    console.warn("Could not write security alert:", err);
  }

  return user;
}

// Sign up a new owner/user — passwordless. An internal credential is
// generated automatically; the user only ever supplies their email.
export async function ownerSignUp(companyName, name, email) {
  const authKey = generateAuthKey();
  const userCredential = await createUserWithEmailAndPassword(auth, email, authKey);
  const user = userCredential.user;
  await updateProfile(user, { displayName: name });
  
  const companyRef = doc(collection(db, 'companies'));
  await setDoc(companyRef, {
    name: companyName,
    ownerId: user.uid,
    createdAt: Date.now(),
    isPremium: false
  });
  
  const uniqueCode = 'Z' + Math.floor(100000 + Math.random() * 900000).toString() + 'XXXX';
  
  await setDoc(doc(db, 'users', user.uid), {
    name, email,
    role: 'owner',
    companyId: companyRef.id,
    companyName,
    uniqueId: uniqueCode,
    createdAt: Date.now(),
    passwordHint: authKey
});
  
  await setDoc(doc(db, 'installedApps', user.uid), { apps: ['calculator'] });
  
  return { uid: user.uid, uniqueCode, companyId: companyRef.id };
}

// ── EMAIL CHANGE (FIXED) ─────────────────────────────────────────
// Updates the email in BOTH Firebase Auth and Firestore. Firebase Auth is
// the source of truth for login: completeOTPLogin() signs in against the
// *Auth* record, not the Firestore doc. If only Firestore is updated, the
// account becomes unrecoverable on next login ("credentials out of sync").
//
// Call this from your profile/settings page instead of writing `email`
// to Firestore directly, e.g.:
//   import { updateUserEmail } from './auth.js';
//   await updateUserEmail(newEmailInput.value);
export async function updateUserEmail(newEmail) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  newEmail = newEmail.trim().toLowerCase();
  if (!newEmail) throw new Error('Please enter an email.');
  if (newEmail === (user.email || '').toLowerCase()) return false; // nothing changed

  // Make sure no other account is already using this email
  const existing = await findUserByEmail(newEmail);
  if (existing && existing.uid !== user.uid) {
    throw new Error('That email is already in use by another account.');
  }

  // Pull the hidden auth key so we can re-authenticate. Firebase requires a
  // *recent* login before it will let you change an email address, and
  // passwordless sessions can easily be old, so we re-auth silently here
  // rather than forcing the user through a password prompt they don't have.
  const userDocRef = doc(db, 'users', user.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) throw new Error('User profile not found.');
  const userData = userDocSnap.data();
  const authKey = userData.passwordHint || userData.password;
  if (!authKey) throw new Error('Missing login credential — cannot verify identity to change email.');

  const credential = EmailAuthProvider.credential(user.email, authKey);
  await reauthenticateWithCredential(user, credential);

  // 1. Update Firebase Auth FIRST — this is what login actually checks.
  await updateEmail(user, newEmail);

  // 2. Now mirror it into Firestore so they stay in sync.
  await setDoc(userDocRef, { ...userData, email: newEmail }, { merge: true });

  return true;
}

// Standard logout
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
}
