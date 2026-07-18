import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, updateEmail, EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, addDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Check if user is logged in. If not, send them to the login page.
export function requireAuth(redirectUrl = 'login.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        if (window.location.pathname.indexOf(redirectUrl) === -1) window.location.href = redirectUrl;
        resolve(null);
      }
    }, reject);
  });
}

// Get the logged-in user's full profile (login info + saved Firestore data combined).
export async function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return resolve(null);
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) return resolve({ uid: user.uid, email: user.email, ...docSnap.data() });
        // No profile found by uid. Try finding it by email instead (fixes old broken accounts).
        const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
        if (snap.empty) return resolve({ uid: user.uid, email: user.email });
        const data = snap.docs[0].data();
        await setDoc(doc(db, 'users', user.uid), { ...data, uid: user.uid }); // save it correctly for next time
        resolve({ uid: user.uid, email: user.email, ...data });
      } catch (error) {
        console.error("Error fetching user data:", error);
        resolve({ uid: user.uid, email: user.email });
      }
    });
  });
}

// Firebase still needs a password behind the scenes even for passwordless login.
// This makes a random one at signup, saved as "passwordHint", used silently after OTP success.
function generateAuthKey(length = 24) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let key = '';
  for (let i = 0; i < length; i++) key += charset[bytes[i] % charset.length];
  return key;
}

// Find a user by email. Used before sending login OTP, and to check an email is free.
export async function findUserByEmail(email) {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { uid: d.id, ...d.data() };
  } catch (error) {
    console.error('findUserByEmail failed:', error);
    throw error;
  }
}

// Call this only after the OTP has been verified. Signs the user in with their saved key.
export async function completeOTPLogin(email) {
  const userRecord = await findUserByEmail(email);
  if (!userRecord) throw new Error('No account found with this email.');

  const possibleKeys = [];
  if (userRecord.passwordHint) possibleKeys.push(userRecord.passwordHint);
  if (userRecord.password) possibleKeys.push(userRecord.password);
  if (possibleKeys.length === 0) throw new Error('This account is missing its login credential. Please contact support.');

  let user = null, lastErr = null;
  for (const key of possibleKeys) {
    try {
      user = (await signInWithEmailAndPassword(auth, email, key.trim())).user;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!user) {
    console.error("Credential mismatch:", lastErr);
    throw new Error('Security Error: Your account credentials are out of sync. Please contact support to reset your account.');
  }

  // Log a "new device" security notice. Don't block login if this fails.
  try {
    await addDoc(collection(db, 'users', user.uid, 'notifications'), {
      type: 'security_login', message: 'Your account was accessed from a new device.',
      createdAt: Date.now(), read: false, status: 'unread'
    });
  } catch (err) {
    console.warn("Could not write security alert:", err);
  }
  return user;
}

// Create a new owner account. Passwordless — user only ever gives email, name, company.
export async function ownerSignUp(companyName, name, email) {
  const authKey = generateAuthKey();
  const user = (await createUserWithEmailAndPassword(auth, email, authKey)).user;
  await updateProfile(user, { displayName: name });

  const companyRef = doc(collection(db, 'companies'));
  await setDoc(companyRef, { name: companyName, ownerId: user.uid, createdAt: Date.now(), isPremium: false });

  const uniqueCode = 'Z' + Math.floor(100000 + Math.random() * 900000).toString() + 'XXXX';
  await setDoc(doc(db, 'users', user.uid), {
    name, email, role: 'owner', companyId: companyRef.id, companyName,
    uniqueId: uniqueCode, createdAt: Date.now(), passwordHint: authKey
  });
  await setDoc(doc(db, 'installedApps', user.uid), { apps: ['calculator'] });
  return { uid: user.uid, uniqueCode, companyId: companyRef.id };
}

// Change email in both Firebase Auth and Firestore so login stays in sync.
// Not called from any page yet — wire this up once a profile/settings page exists.
export async function updateUserEmail(newEmail) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  newEmail = newEmail.trim().toLowerCase();
  if (!newEmail) throw new Error('Please enter an email.');
  if (newEmail === (user.email || '').toLowerCase()) return false;

  const existing = await findUserByEmail(newEmail);
  if (existing && existing.uid !== user.uid) throw new Error('That email is already in use by another account.');

  // Firebase needs a recent login before allowing an email change, so re-auth silently here.
  const userDocRef = doc(db, 'users', user.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) throw new Error('User profile not found.');
  const userData = userDocSnap.data();
  const authKey = userData.passwordHint || userData.password;
  if (!authKey) throw new Error('Missing login credential — cannot verify identity to change email.');

  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, authKey));
  await updateEmail(user, newEmail); // update Auth first — this is what login actually checks
  await setDoc(userDocRef, { ...userData, email: newEmail }, { merge: true }); // keep Firestore in sync
  return true;
}

// Sign the user out.
export async function logout() {
  await signOut(auth);
}
