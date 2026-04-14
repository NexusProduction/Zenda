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
  addDoc,
  serverTimestamp
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
            resolve({ uid: user.uid, email: user.email });
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
        await addDoc(collection(db, 'notifications', user.uid, 'items'), {
            createdAt: new Date().toISOString(),
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
export async function signup(email, password, name, companyName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: name });
    
    // Create the initial company document
    const companyRef = doc(collection(db, 'companies'));
    await setDoc(companyRef, {
      name: companyName,
      ownerId: user.uid,
      createdAt: Date.now(),
      isPremium: false
    });
    
    const uniqueId = 'Z' + Math.floor(100000 + Math.random() * 900000);
    
    // Create the user document linked to the company
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      role: 'owner',
      companyId: companyRef.id,
      companyName: companyName,
      uniqueId: uniqueId,
      createdAt: Date.now()
    });
    
    return user;
  } catch (error) {
    throw error;
  }
}

// Standard logout
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
}
