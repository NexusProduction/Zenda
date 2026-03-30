// =============================================
//  ZENDA — Mini Apps System
// =============================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- App Registry ----
export const APP_REGISTRY = {
  inventory: {
    id: 'inventory',
    name: 'Inventory',
    icon: '📦',
    path: 'inventory.html',
    desc: 'Track stock, warehouses, and product movement.',
    bgColor: '#FFFBEB',
    default: true
  },
  calendar: {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    path: 'calendar.html',
    desc: 'Schedule events, view tasks, and team timelines.',
    bgColor: '#ECFDF5',
    default: false
  },
  calculator: { 
    id: 'calculator', 
    name: 'Calculator', 
    icon: '🧮', 
    path: 'calculator.html', 
    desc: 'Smart calculations with full history.', 
    bgColor: '#eef2ff', 
    default: false 
  },
  // ADD THIS EXPENSES BLOCK:
  expenses: {
    id: 'expenses',
    name: 'Expenses',
    icon: '💳',
    path: 'expenses.html',
    desc: 'Track costs, categorize spending, and sync inventory purchases.',
    bgColor: '#FEF2F2',
    default: false
  }
};

// ---- Get installed apps for a user ----
export async function getInstalledApps(uid) {
  const snap = await getDoc(doc(db, 'installedApps', uid));
  if (snap.exists()) {
    return snap.data().apps || ['calculator'];
  }
  // Initialize with default
  await setDoc(doc(db, 'installedApps', uid), { apps: ['calculator'] });
  return ['calculator'];
}

// ---- Listen to installed apps (real-time) ----
export function listenInstalledApps(uid, onUpdate) {
  return onSnapshot(doc(db, 'installedApps', uid), snap => {
    const apps = snap.exists() ? (snap.data().apps || ['calculator']) : ['calculator'];
    onUpdate(apps);
  });
}

// ---- Install an app ----
export async function installApp(uid, appId) {
  await setDoc(doc(db, 'installedApps', uid), { apps: arrayUnion(appId) }, { merge: true });
}

// ---- Uninstall an app ----
export async function uninstallApp(uid, appId) {
  if (APP_REGISTRY[appId]?.default) return; // Can't uninstall defaults
  await updateDoc(doc(db, 'installedApps', uid), { apps: arrayRemove(appId) });
}

// ---- Render home apps grid ----
export function renderAppsGrid(installedAppIds, container, onAppClick, onLibraryClick) {
  if (!container) return;

  const appsHTML = installedAppIds
    .filter(id => APP_REGISTRY[id])
    .map(id => {
      const app = APP_REGISTRY[id];
      return `
        <div class="app-icon" onclick="openApp('${app.id}')" title="${app.name}">
          <div class="app-icon-img" style="background:${app.bgColor};">
            ${app.icon}
          </div>
          <div class="app-icon-name">${app.name}</div>
        </div>
      `;
    }).join('');

  const libraryBtn = `
    <div class="app-library-btn" onclick="openAppLibrary()" title="App Library">
      <div class="app-library-icon">⊞</div>
      <div class="app-icon-name" style="color:var(--text-muted)">More Apps</div>
    </div>
  `;

  container.innerHTML = appsHTML + libraryBtn;
}

// ---- Render app library ----
export function renderAppLibrary(installedAppIds, container) {
  if (!container) return;

  const allApps = Object.values(APP_REGISTRY);

  container.innerHTML = allApps.map(app => {
    const installed = installedAppIds.includes(app.id);
    return `
      <div class="app-lib-item" data-app-id="${app.id}">
        <div class="app-lib-icon" style="background:${app.bgColor}">${app.icon}</div>
        <div class="app-lib-name">${app.name}</div>
        <div class="app-lib-desc">${app.desc}</div>
        ${installed
          ? `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.5">Installed</button>`
          : `<button class="btn btn-primary btn-sm" onclick="installAppById('${app.id}')">Install</button>`
        }
      </div>
    `;
  }).join('');
}

// =============================================
//  CALCULATOR DATA
// =============================================
export async function saveCalcHistory(uid, history) {
  await setDoc(doc(db, 'appData', uid, 'apps', 'calculator'), {
    history: history.slice(-50), // keep last 50 entries
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadCalcHistory(uid) {
  const snap = await getDoc(doc(db, 'appData', uid, 'apps', 'calculator'));
  return snap.exists() ? (snap.data().history || []) : [];
}

// =============================================
//  CALENDAR DATA
// =============================================
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
