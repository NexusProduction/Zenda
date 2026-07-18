import { db } from './firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Writes a new notification into a user's notifications list.
// Fails silently (just logs a warning) so a notification error never breaks the main action.
export async function addNotification(userId, { type, message, actorId = '', actorName = '', relatedId = '' }) {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      type, message, actorId, actorName, relatedId,
      read: false, status: 'unread',
      createdAt: Date.now()
    });
  } catch (e) {
    console.warn('addNotification failed:', e);
  }
}
