import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Ensure Firebase has loaded the user state before allowing navigation
export function requireAuth(redirectUrl = 'login.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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

// Log a user in and trigger the security notification
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // SECURITY NOTIFICATION ARCHITECTURE: Write the login alert
    try {
        await addDoc(collection(db, 'users', user.uid, 'notifications'), {
            type: 'security_login',
            message: 'Your account was accessed from a new device.',
            createdAt: Date.now(),
            read: false,
            status: 'unread'
        });
    } catch(err) {
        console.warn("Could not write security alert:", err);
    }
    
    return user;
  } catch (error) {
    throw error;
  }
}

// Sign up a new owner/user
export async function ownerSignUp(companyName, name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
    createdAt: Date.now()
  });
  
  await setDoc(doc(db, 'installedApps', user.uid), { apps: ['calculator'] });
  
  return { uid: user.uid, uniqueCode, companyId: companyRef.id };
}

// Standard logout
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
}
