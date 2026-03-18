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
    message: `${assignedByName} assigned you: "${title}"${dueDate ? ` (Due: ${formatDueDate(dueDate, dueTime)})` : ''}`,
    actorId: assignedBy, actorName: assignedByName, relatedId: ref.id
  });

  // Auto-add to assignee's calendar if due date is set
  if (dueDate && assignedTo) {
    try {
      await addCalendarEvent(assignedTo, {
        title: `📋 ${title}`,
        date: dueDate,
        time: dueTime || '',
        priority: 'high',
        visibility: 'self',
        type: 'task',
        taskId: ref.id,
        companyId
      });
    } catch(e) { console.warn('Calendar sync failed:', e); }
  }

  return ref.id;
}

function formatDueDate(date, time) {
  if (!date) return '';
  const d = new Date(date + (time ? 'T' + time : ''));
  const opts = { month: 'short', day: 'numeric' };
  let str = d.toLocaleDateString('en-US', opts);
  if (time) str += ' ' + format12hr(time);
  return str;
}

function format12hr(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

export async function markTaskDone(taskId) {
  const taskRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const task = snap.data();
  await updateDoc(taskRef, { status: 'done', completedAt: new Date().toISOString() });
  await addNotification(task.assignedBy, {
    type: 'task_done',
    message: `✅ ${task.assignedToName} completed: "${task.title}"`,
    actorId: task.assignedTo, actorName: task.assignedToName, relatedId: taskId
  });
}

export async function markTaskDeclined(taskId) {
  const taskRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const task = snap.data();
  await updateDoc(taskRef, { status: 'declined', declinedAt: new Date().toISOString() });
  await addNotification(task.assignedBy, {
    type: 'task_declined',
    message: `❌ ${task.assignedToName} declined: "${task.title}"`,
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

export function renderTaskItem(task, currentUserId, canRespond=false) {
  const isAssignedToMe = task.assignedTo === currentUserId;
  const isPending = task.status === 'pending';
  const showActions = canRespond && isAssignedToMe && isPending;

  const badgeMap = {
    pending: 'task-badge-pending', done: 'task-badge-done', declined: 'task-badge-declined'
  };
  const labelMap = { pending: '⏳ Pending', done: '✅ Done', declined: '❌ Declined' };
  const dotMap = { pending: 'dot-pending', done: 'dot-done', declined: 'dot-declined' };

  let meta = '';
  if (isAssignedToMe) meta += `From <strong>${escHtml(task.assignedByName)}</strong>`;
  else meta += `To <strong>${escHtml(task.assignedToName)}</strong>`;
  meta += ` <span class="task-meta-sep">·</span> ${formatTime(task.createdAt)}`;
  if (task.dueDate) {
    const d = new Date(task.dueDate + (task.dueTime ? 'T'+task.dueTime : ''));
    const label = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const time = task.dueTime ? ' '+format12hr(task.dueTime) : '';
    meta += ` <span class="task-meta-sep">·</span> 📅 ${label}${time}`;
  }
  if (task.status === 'done' && task.completedAt) {
    meta += ` <span class="task-meta-sep">·</span> Done ${formatTime(task.completedAt)}`;
  }
  if (task.status === 'declined' && task.declinedAt) {
    meta += ` <span class="task-meta-sep">·</span> Declined ${formatTime(task.declinedAt)}`;
  }

  return `<div class="task-item" data-id="${task.id}">
    <div class="task-status-dot ${dotMap[task.status]||'dot-pending'}"></div>
    <div class="task-content">
      <div class="task-title">${escHtml(task.title)}</div>
      <div class="task-meta">${meta}</div>
    </div>
    ${showActions ? `
      <div class="task-actions">
        <button class="task-action-btn btn-tick" title="Mark Done" onclick="handleTaskDone('${task.id}')">✓</button>
        <button class="task-action-btn btn-cross" title="Decline" onclick="handleTaskDeclined('${task.id}')">✕</button>
      </div>
    ` : `<span class="task-badge ${badgeMap[task.status]||'task-badge-pending'}">${labelMap[task.status]||'Pending'}</span>`}
  </div>`;
}

function escHtml(s=''){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
