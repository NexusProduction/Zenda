// =============================================
//  ZENDA — Task System
//  Assign work, mark done/declined, listen for updates
// =============================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, query, where, orderBy,
  onSnapshot, doc, updateDoc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { addNotification } from './notifications.js';
import { formatTime } from './utils.js';

// ---- Assign a task to a user ----
export async function assignTask({ title, description, assignedTo, assignedToName, assignedBy, assignedByName, companyId }) {
  const ref = await addDoc(collection(db, 'tasks'), {
    title,
    description: description || '',
    assignedTo,
    assignedToName,
    assignedBy,
    assignedByName,
    companyId,
    status:    'pending',
    createdAt: new Date().toISOString()
  });

  // Notify the assignee
  await addNotification(assignedTo, {
    type:      'task_assigned',
    message:   `${assignedByName} assigned you a task: "${title}"`,
    actorId:   assignedBy,
    actorName: assignedByName,
    relatedId: ref.id
  });

  return ref.id;
}

// ---- Mark task as done ----
export async function markTaskDone(taskId) {
  const taskRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;

  const task = snap.data();
  await updateDoc(taskRef, { status: 'done', completedAt: new Date().toISOString() });

  // Notify the assigner
  await addNotification(task.assignedBy, {
    type:      'task_done',
    message:   `${task.assignedToName} completed the task: "${task.title}"`,
    actorId:   task.assignedTo,
    actorName: task.assignedToName,
    relatedId: taskId
  });
}

// ---- Mark task as declined ----
export async function markTaskDeclined(taskId) {
  const taskRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;

  const task = snap.data();
  await updateDoc(taskRef, { status: 'declined', declinedAt: new Date().toISOString() });

  // Notify the assigner
  await addNotification(task.assignedBy, {
    type:      'task_declined',
    message:   `${task.assignedToName} declined the task: "${task.title}"`,
    actorId:   task.assignedTo,
    actorName: task.assignedToName,
    relatedId: taskId
  });
}

// ---- Listen to tasks for a user (assigned to them) ----
export function listenMyTasks(userId, onUpdate) {
  const q = query(
    collection(db, 'tasks'),
    where('assignedTo', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(tasks);
  });
}

// ---- Listen to tasks assigned by a user (as manager/owner) ----
export function listenAssignedByMe(userId, onUpdate) {
  const q = query(
    collection(db, 'tasks'),
    where('assignedBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(tasks);
  });
}

// ---- Get all tasks in a company ----
export function listenCompanyTasks(companyId, onUpdate) {
  const q = query(
    collection(db, 'tasks'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(tasks);
  });
}

// ---- Render task item ----
export function renderTaskItem(task, currentUserId, canRespond = false) {
  const statusDot = {
    pending:  'task-dot-pending',
    done:     'task-dot-done',
    declined: 'task-dot-declined'
  }[task.status] || 'task-dot-pending';

  const statusLabels = {
    pending:  '⏳ Pending',
    done:     '✅ Done',
    declined: '❌ Declined'
  };

  const isAssignedToMe = task.assignedTo === currentUserId;
  const isPending = task.status === 'pending';
  const showActions = canRespond && isAssignedToMe && isPending;

  return `
    <div class="task-item" data-task-id="${task.id}">
      <div class="task-item-dot ${statusDot}"></div>
      <div class="task-item-content">
        <div class="task-item-title">${escapeHtml(task.title)}</div>
        <div class="task-item-meta">
          ${isAssignedToMe
            ? `From: ${escapeHtml(task.assignedByName)}`
            : `To: ${escapeHtml(task.assignedToName)}`
          } · ${formatTime(task.createdAt)}
        </div>
      </div>
      ${showActions ? `
        <div class="task-actions">
          <button class="task-tick-btn" title="Mark Done" onclick="handleTaskDone('${task.id}')">✓</button>
          <button class="task-cross-btn" title="Decline" onclick="handleTaskDeclined('${task.id}')">✕</button>
        </div>
      ` : `
        <span class="badge badge-${task.status === 'done' ? 'success' : task.status === 'declined' ? 'danger' : 'warning'}" style="font-size:0.7rem">
          ${statusLabels[task.status] || 'Pending'}
        </span>
      `}
    </div>
  `;
}

function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
