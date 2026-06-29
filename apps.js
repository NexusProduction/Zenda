import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function saveCalendarEvents(uid, events) {
  await setDoc(doc(db, 'appData', uid, 'apps', 'calendar'), {
    events,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadCalendarEvents(uid) {
  const snap = await getDoc(doc(db, 'appData', uid, 'apps', 'calendar'));
  return snap.exists() ? (snap.data().events || []) : [];
}

export async function addCalendarEvent(uid, event) {
  const events = await loadCalendarEvents(uid);
  events.push({ ...event, id: Date.now().toString() });
  await saveCalendarEvents(uid, events);
  return events;
}

export async function deleteCalendarEvent(uid, eventId) {
  const events = await loadCalendarEvents(uid);
  const filtered = events.filter(e => e.id !== eventId);
  await saveCalendarEvents(uid, filtered);
  return filtered;
}
