import { db } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { addNotification } from './notifications.js';
import { formatTime } from './utils.js';
import { addCalendarEvent } from './apps.js';

export async function assignTask({ title, description, assignedTo, assignedToName, assignedBy, assignedByName, companyId, dueDate, dueTime }) {
  const ref = await addDoc(collection(db, 'tasks'), {
    title, description: description || '',
    assignedTo, assignedToName,
    assignedBy, assignedByName,
    companyId,
    status: 'pending',
    dueDate: dueDate || null,
    dueTime: dueTime || null,
    createdAt: new Date().toISOString()
  });

  await addNotification(assignedTo, {
    type: 'task_assigned',
    message: `${assignedByName} assigned you: "${title}"${dueDate ? ` · Due: ${formatDueDate(dueDate, dueTime)}` : ''}`,
    actorId: assignedBy, actorName: assignedByName, relatedId: ref.id
  });

  if (dueDate && assignedTo) {
    try {
      await addCalendarEvent(assignedTo, {
        title: `Task: ${title}`,
        date: dueDate, time: dueTime || '',
        priority: 'high', visibility: 'self',
        type: 'task', taskId: ref.id, companyId
      });
    } catch(e) { console.warn('Calendar sync failed:', e); }
  }
  return ref.id;
}

export async function markTaskDone(taskId) {
  const taskRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const task = snap.data();
  if (task.status !== 'pending') throw new Error('Task is already ' + task.status);
  await updateDoc(taskRef, { status: 'done', completedAt: new Date().toISOString() });
  await addNotification(task.assignedBy, {
    type: 'task_done',
    message: `${task.assignedToName} completed: "${task.title}"`,
    actorId: task.assignedTo, actorName: task.assignedToName, relatedId: taskId
  });
}

export async function markTaskDeclined(taskId, reason = '') {
  const taskRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const task = snap.data();
  if (task.status !== 'pending') throw new Error('Task is already ' + task.status);
  await updateDoc(taskRef, {
    status: 'declined',
    declinedAt: new Date().toISOString(),
    declineReason: reason || ''
  });
  const reasonPart = reason ? ` — "${reason}"` : '';
  await addNotification(task.assignedBy, {
    type: 'task_declined',
    message: `${task.assignedToName} declined: "${task.title}"${reasonPart}`,
    actorId: task.assignedTo, actorName: task.assignedToName, relatedId: taskId
  });
}

export function listenMyTasks(userId, onUpdate) {
  const q = query(collection(db,'tasks'), where('assignedTo','==',userId), orderBy('createdAt','desc'));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({id:d.id,...d.data()}))));
}

export function listenAssignedByMe(userId, onUpdate) {
  const q = query(collection(db,'tasks'), where('assignedBy','==',userId), orderBy('createdAt','desc'));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({id:d.id,...d.data()}))));
}

export function listenCompanyTasks(companyId, onUpdate) {
  const q = query(collection(db,'tasks'), where('companyId','==',companyId), orderBy('createdAt','desc'));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({id:d.id,...d.data()}))));
}

function formatDueDate(date, time) {
  if (!date) return '';
  const d = new Date(date + (time ? 'T'+time : ''));
  let str = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  if (time) str += ' ' + format12hr(time);
  return str;
}

export function format12hr(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}

function esc(s=''){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
