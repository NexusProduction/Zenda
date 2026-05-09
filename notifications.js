// =============================================
//  ZENDA — Notifications System
// =============================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, doc, updateDoc, writeBatch,
  where, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { formatTime } from './utils.js';

// ---- Add a notification to a user ----
export async function addNotification(userId, { type, message, actorId = '', actorName = '', relatedId = '' }) {
  if (!userId) return;

  await addDoc(collection(db, 'notifications', userId, 'items'), {
    type,
    message,
    actorId,
    actorName,
    relatedId,
    read:      false,
    createdAt: new Date().toISOString()
  });
}

// ---- Listen to notifications for a user (real-time) ----
export function listenNotifications(userId, onUpdate) {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'notifications', userId, 'items'),
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
  await updateDoc(doc(db, 'notifications', userId, 'items', notifId), { read: true });
}

// ---- Mark all notifications as read ----
export async function markAllRead(userId) {
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ---- Render notification items into a container ----
export function renderNotifications(items, container) {
  if (!container) return;

  window.currentNotifs = window.currentNotifs || {};

  if (!items.length) {
    container.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">🔔</div>
        <p>No notifications yet</p>
      </div>
    `;
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
      warehouse_request:     { icon: '🏭', cls: 'notif-icon-task' },
      review_delete:         { icon: '🗑️', cls: 'notif-icon-declined' }
    };
    const { icon, cls } = iconMap[item.type] || { icon: '🔔', cls: 'notif-icon-login' };

    let actionButtons = '';
    
    // 🔥 STRICT CHECK FOR ANY WAREHOUSE REQUEST (Create OR Delete)
    const isWhRequest = item.type === 'review_delete' || item.type === 'review_create' || item.type === 'warehouse_request';
    
    if (isWhRequest) {
      if (item.status === 'approved' || item.status === 'rejected') {
          actionButtons = `
            <div style="margin-top: 8px; font-size: 13px; font-weight: 700; color: var(--tx3);">
               Status: ${item.status.toUpperCase()}
            </div>
            <div style="margin-top: 8px;">
                <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Dismiss</button>
            </div>
          `;
      } else {
          // Force the correct URL parameter based on the type
          const isDelete = item.type === 'review_delete' || (item.message && item.message.toLowerCase().includes('delete'));
          const urlParam = isDelete ? 'review_delete' : 'review_create';
          
          actionButtons = `
            <div style="margin-top: 12px;">
                <button onclick="window.location.href='inventory.html?${urlParam}=${item.id}'" style="width:100%; padding:8px 16px; background:#4F46E5; color:#fff; border:none; border-radius:10px; font-size:0.85rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(79,70,229,0.25); transition:all 0.2s;">Review Request →</button>
            </div>
          `;
      }
    } 
    // Handle Calendar Events
    else if (item.type === 'calendar_event_all' || item.type === 'calendar_event_custom') {
      actionButtons = `
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Dismiss</button>
          <button class="btn btn-xs btn-primary" onclick="window.location.href='calendar.html?date=${item.eventDate || ''}'">(Open in app)</button>
        </div>
      `;
    } 
    // Default Dismiss
    else {
      actionButtons = `
        <div style="margin-top: 8px;">
            <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Dismiss</button>
        </div>
      `;
    }

    return `
      <div class="notif-item ${item.read ? '' : 'unread'}" data-id="${item.id}">
        <div class="notif-item-icon ${cls}">${icon}</div>
        <div class="notif-item-content">
          <div class="notif-item-msg">${escapeHtml(item.message)}</div>
          <div class="notif-item-time">${formatTime(item.createdAt)}</div>
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

export function updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

export function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
