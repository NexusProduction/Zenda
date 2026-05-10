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
      review_delete:         { icon: '🗑️', cls: 'notif-icon-declined' },
      review_create:         { icon: '🏭', cls: 'notif-icon-task' },
      warehouse_reviewed:    { icon: '📬', cls: 'notif-icon-done' }
    };
    const { icon, cls } = iconMap[item.type] || { icon: '🔔', cls: 'notif-icon-login' };

    let actionButtons = '';

    // ── Warehouse CREATE request (staff → manager review) ──
    const isCreateRequest = item.type === 'review_create' || item.type === 'warehouse_request';
    const isDeleteRequest = item.type === 'review_delete';
    const isWhRequest     = isCreateRequest || isDeleteRequest;

    if (isWhRequest) {
      const requestId = item.relatedId || item.id;

      if (item.status === 'approved' || item.status === 'rejected' || item.status === 'declined') {
        // Already reviewed — show outcome badge
        const isApproved = item.status === 'approved';
        actionButtons = `
          <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="
              display:inline-flex;align-items:center;gap:5px;
              padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;
              background:${isApproved ? '#ECFDF5' : '#FEF2F2'};
              color:${isApproved ? '#059669' : '#DC2626'};
              border:1.5px solid ${isApproved ? '#A7F3D0' : '#FECACA'};
            ">
              ${isApproved ? '✓ Approved' : '✕ Declined'}
            </span>
            <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Dismiss</button>
          </div>
        `;
      } else {
        // Pending — show Review button with appropriate color
        const isDelete  = isDeleteRequest || (item.message && item.message.toLowerCase().includes('delete'));
        const btnBg     = isDelete ? '#DC2626' : '#059669';
        const btnShadow = isDelete ? 'rgba(220,38,38,0.20)' : 'rgba(5,150,105,0.20)';
        const btnText   = isDelete ? '🗑️ Review Deletion' : '🏭 Review Request';

        actionButtons = `
          <div style="margin-top:12px;display:flex;gap:8px;align-items:center;">
            <button
              onclick="window.openWarehouseReview('${requestId}')"
              style="
                flex:1;padding:9px 14px;
                background:${btnBg};color:#fff;border:none;border-radius:10px;
                font-size:0.83rem;font-weight:700;cursor:pointer;
                box-shadow:0 4px 12px ${btnShadow};
                transition:all 0.2s;font-family:inherit;
                display:flex;align-items:center;justify-content:center;gap:6px;
              "
              onmouseover="this.style.opacity='0.88'"
              onmouseout="this.style.opacity='1'"
            >${btnText}</button>
            <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')" style="white-space:nowrap;">Dismiss</button>
          </div>
        `;
      }
    }
    // ── Result notification (sent back to requester) ──
    else if (item.type === 'warehouse_reviewed') {
      const isApproved = item.message && item.message.includes('approved');
      actionButtons = `
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;">
          <span style="
            padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;
            background:${isApproved ? '#ECFDF5' : '#FEF2F2'};
            color:${isApproved ? '#059669' : '#DC2626'};
            border:1.5px solid ${isApproved ? '#A7F3D0' : '#FECACA'};
          ">${isApproved ? '✓ Approved' : '✕ Declined'}</span>
          <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Got it</button>
        </div>
      `;
    }
    // ── Calendar events ──
    else if (item.type === 'calendar_event_all' || item.type === 'calendar_event_custom') {
      actionButtons = `
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Dismiss</button>
          <button class="btn btn-xs btn-primary" onclick="window.location.href='calendar.html?date=${item.eventDate || ''}'">(Open in app)</button>
        </div>
      `;
    }
    // ── Default — simple dismiss ──
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

// ── Global handler: open warehouse review page ──
// Called by the "Review Request" button in notifications
window.openWarehouseReview = function(requestId) {
  if (!requestId) return;
  window.location.href = `warehouse-review.html?id=${requestId}`;
};

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
