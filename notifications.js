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

  // Initialize a global object to hold notification data for the buttons to access
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
    // Store data globally for action buttons
    window.currentNotifs[item.id] = item;

    const iconMap = {
      login:                 { icon: '🔐', cls: 'notif-icon-login' },
      task_assigned:         { icon: '📋', cls: 'notif-icon-task' },
      task_done:             { icon: '✅', cls: 'notif-icon-done' },
      task_declined:         { icon: '❌', cls: 'notif-icon-declined' },
      calendar_event_all:    { icon: '🗓️', cls: 'notif-icon-cal' },
      calendar_event_custom: { icon: '🗓️', cls: 'notif-icon-cal' },
      warehouse_request:     { icon: '🏭', cls: 'notif-icon-task' } // Added Warehouse Icon
    };
    const { icon, cls } = iconMap[item.type] || { icon: '🔔', cls: 'notif-icon-login' };

    // Dynamic Action Buttons
    let actionButtons = '';
    if (item.type === 'calendar_event_all' || item.type === 'calendar_event_custom') {
      actionButtons = `
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button class="btn btn-xs btn-ghost" onclick="window.markNotifRead('${item.id}')">Dismiss</button>
          <button class="btn btn-xs btn-primary" onclick="window.location.href='calendar.html?date=${item.eventDate || ''}'">(Open in app)</button>
        </div>
      `;
    } else if (item.type === 'warehouse_request') {
      actionButtons = `
        <div style="margin-top: 12px;">
            <button onclick="window.viewWarehouseReq('${item.id}')" style="width:100%; padding:8px 16px; background:#10B981; color:#fff; border:none; border-radius:10px; font-size:0.85rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(16,185,129,0.25); transition:all 0.2s;">Review Request →</button>
        </div>
      `;
    } else {
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

// ---- Update notification badge count ----
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

// ---- Escape HTML ----
export function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
// GLOBAL NOTIFICATION ACTIONS
// =============================================

// 1. VIEW BUTTON LOGIC
window.viewWarehouseReq = function(notifId) {
    const notif = window.currentNotifs[notifId];
    if(!notif || !notif.warehouseData) {
        alert("No warehouse details attached to this request.");
        return;
    }
    const data = notif.warehouseData;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:99999;';
    overlay.innerHTML = `
        <div style="background:#fff; padding:24px; border-radius:16px; width:90%; max-width:340px; box-shadow:0 12px 40px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; margin-bottom:16px; font-size:18px; font-family:'Plus Jakarta Sans', sans-serif;">Warehouse Details</h3>
            <div style="font-size:14px; color:#3D3F4A; line-height:1.6; font-family:'DM Sans', sans-serif;">
                <p style="margin:8px 0;"><strong>Name:</strong> ${escapeHtml(data.name)}</p>
                <p style="margin:8px 0;"><strong>Location:</strong> ${escapeHtml(data.location)}</p>
                <p style="margin:8px 0;"><strong>Category:</strong> ${escapeHtml(data.category)}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:20px; padding:10px; background:#4F46E5; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer;">Close</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

// 2. APPROVE BUTTON LOGIC
window.approveWarehouseReq = async function(notifId, staffId) {
    const notif = window.currentNotifs[notifId];
    if(!notif || !notif.warehouseData) return;

    try {
        // A. Create the warehouse in the master database
        await addDoc(collection(db, 'godowns'), notif.warehouseData);

        // B. Delete the notification from the owner's feed
        const uid = getAuth().currentUser.uid;
        await deleteDoc(doc(db, 'notifications', uid, 'items', notifId));

        // C. Notify the staff member that it was approved
        if (staffId) {
            await addDoc(collection(db, 'notifications', staffId, 'items'), {
                type: 'system',
                message: `Your request to add warehouse "${notif.warehouseData.name}" was approved!`,
                read: false,
                createdAt: new Date().toISOString()
            });
        }

        alert("Warehouse approved and created successfully!");
    } catch(e) {
        console.error("Approval failed:", e);
        alert("Failed to approve warehouse.");
    }
};

// 3. DECLINE BUTTON LOGIC
window.declineWarehouseReq = async function(notifId, staffId) {
    const notif = window.currentNotifs[notifId];
    if(!notif) return;

    try {
        // A. Delete the notification from the owner's feed
        const uid = getAuth().currentUser.uid;
        await deleteDoc(doc(db, 'notifications', uid, 'items', notifId));

        // B. Notify the staff member that it was rejected
        if(staffId && notif.warehouseData) {
            await addDoc(collection(db, 'notifications', staffId, 'items'), {
                type: 'system',
                message: `Your request to add warehouse "${notif.warehouseData.name}" was declined.`,
                read: false,
                createdAt: new Date().toISOString()
            });
        }
    } catch(e) {
        console.error("Decline failed:", e);
    }
};
