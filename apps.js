import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const getInstalledApps = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data().installedApps) {
        let apps = snap.data().installedApps;
        // Master Override: Force core apps to always exist
        if (!apps.includes('inventory')) apps.push('inventory');
        if (!apps.includes('calendar')) apps.push('calendar');
        return apps;
    }
    return ['calendar', 'inventory'];
};

export const listenInstalledApps = (uid, callback) => {
    return onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists() && snap.data().installedApps) {
            let apps = snap.data().installedApps;
            // Master Override: Force core apps to always exist
            if (!apps.includes('inventory')) apps.push('inventory');
            if (!apps.includes('calendar')) apps.push('calendar');
            callback(apps);
        } else {
            callback(['calendar', 'inventory']);
        }
    });
};

export const installApp = async (uid, appId) => {
    await updateDoc(doc(db, 'users', uid), {
        installedApps: arrayUnion(appId)
    });
};

export const uninstallApp = async (uid, appId) => {
    if (appId === 'calendar' || appId === 'inventory') return; // Database protection
    await updateDoc(doc(db, 'users', uid), {
        installedApps: arrayRemove(appId)
    });
};
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
