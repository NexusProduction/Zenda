// =============================================
//  ZENDA — Notifications System (FIXED)
// =============================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, doc, updateDoc, writeBatch,
  where, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { formatTime } from './utils.js';

// ---- Add a notification to a user ----
export async function addNotification(userId, { type, message, actorId = '', actorName = '', relatedId = '' }) {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      type, message, actorId, actorName, relatedId,
      read: false, status: 'unread',
      createdAt: Date.now()
    });
  } catch(e) { console.warn('addNotification failed:', e); }
}

// ---- Listen to notifications for a user (real-time) ----
export function listenNotifications(userId, onUpdate) {
  if (!userId) return () => {};
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unread = items.filter(i => !i.read).length;
    onUpdate(items, unread);
  });
}

// ---- Mark single notification as read ----
export async function markNotificationRead(userId, notifId) {
  await updateDoc(doc(db, 'users', userId, 'notifications', notifId), { read: true, status: 'read' });
}

// ---- Mark all notifications as read ----
export async function markAllRead(userId) {
  const q = query(collection(db, 'users', userId, 'notifications'), where('read', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true, status: 'read' }));
  await batch.commit();
}

// ---- Render notification items into a container ----
export function renderNotifications(items, container) {
  if (!container) return;
  window.currentNotifs = window.currentNotifs || {};

  if (!items.length) {
    container.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><p>No notifications yet</p></div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    window.currentNotifs[item.id] = item;

    const iconMap = {
      login:                 { icon: '🔐', cls: 'notif-icon-login' },
      task_assigned:         { icon: '📋', cls: 'notif-icon-task' },
      task_done:             { icon: '✅', cls: 'notif-icon-done' },
      task_declined:         { icon: '❌', cls: 'notif-icon-declined' },
      calendar_event_all:    { icon: '🗓️', cls: 'notif-icon-cal' },
      calendar_event_custom: { icon: '🗓️', cls: 'notif-icon-cal' },
    };
    const { icon, cls } = iconMap[item.type] || { icon: '🔔', cls: 'notif-icon-login' };

    let actionButtons = '';

    if (item.type === 'task_received') {
      actionButtons = `
        <button class="btn btn-primary" style="padding:8px 16px;font-size:0.85rem;" onclick="window.acceptTaskNotif(this)">Accept</button>
        <button class="btn btn-secondary" style="padding:8px 16px;font-size:0.85rem;" onclick="window.showDenyInput(this)">Deny</button>
      `;
    } else if (item.type === 'calendar_event_all' || item.type === 'calendar_event_custom') {
      actionButtons = `
        <button class="btn btn-primary" style="padding:8px 16px;font-size:0.85rem;" onclick="window.openCalendarApp(this,'${item.id}','${item.eventDate || ''}')">Open in app</button>
        <button class="btn btn-secondary" style="padding:8px 16px;font-size:0.85rem;" onclick="window.dismissAlert(this)">Dismiss</button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-secondary" style="padding:8px 16px;font-size:0.85rem;" onclick="window.dismissAlert(this)">Dismiss</button>
      `;
    }

    return `
      <div class="notif-item ${item.read ? '' : 'unread'}" data-id="${item.id}">
        <div class="notif-item-icon ${cls}">${icon}</div>
        <div class="notif-item-content">
          <div class="notif-item-msg">${escapeHtml(item.message)}</div>
          <div class="notif-item-time">${formatTime(item.createdAt)}</div>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">${actionButtons}</div>
        </div>
      </div>
    `;
  }).join('');
}

export function updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }
}

export function escapeHtml(str = '') {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
