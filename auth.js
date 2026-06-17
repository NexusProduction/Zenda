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
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function requireAuth(redirectUrl = 'login.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        
        // ==========================================
        //  STEP 3: STAFF EXPIRY LOCKOUT SYSTEM
        // ==========================================
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // Check if user is a staff member (not the owner)
            if (userData.role !== 'owner' && userData.companyId) {
              const compDocRef = doc(db, 'companies', userData.companyId);
              const compDocSnap = await getDoc(compDocRef);
              
              if (compDocSnap.exists()) {
                const compData = compDocSnap.data();
                let hasActiveAddon = false;
                
                // Verify Add-on Expiry Timestamp
                if (compData.addOnExpiry && new Date(compData.addOnExpiry) > new Date()) {
                  hasActiveAddon = true;
                }
                
                if (!hasActiveAddon) {
                  // 1. Notify the Owner via notifications.js
                  try {
                    const { addNotification } = await import('./notifications.js');
                    if (compData.ownerId) {
                      await addNotification(compData.ownerId, {
                        type: 'security_login',
                        message: `Staff member ${userData.name || 'Unknown'} tried to log in, but access was denied because your Unlimited Staff Add-on has expired.`,
                        actorName: userData.name || 'System'
                      });
                    }
                  } catch (notifErr) {
                    console.warn("Could not send lockout notification to owner:", notifErr);
                  }

                  // 2. Wipe the screen and render the 10-second lockout overlay
                  document.body.innerHTML = `
                    <div style="position:fixed;inset:0;background:#0F172A;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;font-family:'Plus Jakarta Sans', sans-serif;text-align:center;padding:24px;">
                      <div style="width:80px;height:80px;background:rgba(239, 68, 68, 0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      </div>
                      <h1 style="font-size:28px;font-weight:800;margin-bottom:16px;letter-spacing:-0.03em;">Workspace Locked</h1>
                      <p style="font-size:16px;color:#94A3B8;max-width:420px;line-height:1.6;margin-bottom:32px;">Your company premium plan ended. Tell your owner to upgrade the company account to restore access.</p>
                      <div style="background:rgba(255,255,255,0.05);padding:12px 24px;border-radius:100px;font-size:14px;color:#F8FAFC;font-weight:600;">
                        Closing automatically in <span id="lockout-timer" style="color:#EF4444;font-weight:800;">10</span> seconds...
                      </div>
                    </div>
                  `;

                  // 3. Start Timer and Force Sign Out (Destroys Firebase Session)
                  let timeLeft = 10;
                  const timerInterval = setInterval(() => {
                    timeLeft--;
                    const timerSpan = document.getElementById('lockout-timer');
                    if (timerSpan) timerSpan.textContent = timeLeft;
                    
                    if (timeLeft <= 0) {
                      clearInterval(timerInterval);
                      signOut(auth).then(() => {
                        window.location.href = 'login.html';
                      });
                    }
                  }, 1000);

                  resolve(null);
                  return; // Halt further execution so no dashboard code loads
                }
              }
            }
          }
        } catch (err) {
          console.error("Error during staff lockout check:", err);
        }
        // ==========================================

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
// Silently signs the user in using their internal auth key and writes the
// "new device" security notification (same behaviour the old login() had).
export async function completeOTPLogin(email) {
  const userRecord = await findUserByEmail(email);
  if (!userRecord) throw new Error('No account found with this email.');

  const authKey = userRecord.passwordHint;
  if (!authKey) throw new Error('This account is missing its login credential. Please contact support.');

  const userCredential = await signInWithEmailAndPassword(auth, email, authKey);
  const user = userCredential.user;

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

// Standard logout
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
}
