import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot,
         collection, addDoc, query, where, getDocs, orderBy, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const APP_REGISTRY = {
  calculator: { id:'calculator', name:'Calculator', icon:'🧮', color:'#6366F1', bgColor:'#EEF2FF', desc:'Smart calculator with history', path:'calculator.html', default:true },
  calendar:   { id:'calendar',   name:'Calendar',   icon:'📅', color:'#10B981', bgColor:'#ECFDF5', desc:'Manage events & reminders',   path:'calendar.html',   default:false }
};

// ── Installed apps ──
export async function getInstalledApps(uid) {
  try {
    const snap = await getDoc(doc(db,'installedApps',uid));
    if (snap.exists()) return snap.data().apps || ['calculator'];
    await setDoc(doc(db,'installedApps',uid),{apps:['calculator']});
    return ['calculator'];
  } catch { return ['calculator']; }
}

export function listenInstalledApps(uid, onUpdate) {
  return onSnapshot(doc(db,'installedApps',uid), snap => {
    onUpdate(snap.exists() ? (snap.data().apps||['calculator']) : ['calculator']);
  });
}

export async function installApp(uid, appId) {
  await setDoc(doc(db,'installedApps',uid),{apps:arrayUnion(appId)},{merge:true});
}
export async function uninstallApp(uid, appId) {
  if (APP_REGISTRY[appId]?.default) return;
  await updateDoc(doc(db,'installedApps',uid),{apps:arrayRemove(appId)});
}

export function renderAppsGrid(installedAppIds, container) {
  if (!container) return;
  const html = installedAppIds.filter(id=>APP_REGISTRY[id]).map(id=>{
    const app=APP_REGISTRY[id];
    return `<div class="app-icon" onclick="openApp('${app.id}')" title="${app.name}">
      <div class="app-icon-img" style="background:${app.bgColor}">${app.icon}</div>
      <div class="app-icon-name">${app.name}</div>
    </div>`;
  }).join('');
  const libBtn = `<div class="app-lib-btn" onclick="openAppLibrary()">
    <div class="app-lib-icon">⊞</div>
    <div class="app-icon-name" style="color:var(--text-muted)">More</div>
  </div>`;
  container.innerHTML = html + libBtn;
}

export function renderAppLibrary(installedAppIds, container) {
  if (!container) return;
  container.innerHTML = Object.values(APP_REGISTRY).map(app=>{
    const installed = installedAppIds.includes(app.id);
    return `<div class="app-lib-item">
      <div class="app-lib-icon" style="background:${app.bgColor}">${app.icon}</div>
      <div class="app-lib-name">${app.name}</div>
      <div class="app-lib-desc">${app.desc}</div>
      ${installed
        ? `<span style="font-size:.72rem;color:var(--secondary);font-weight:700">✓ Installed</span>`
        : `<button class="btn btn-primary btn-sm" onclick="installAppById('${app.id}')">Install</button>`}
    </div>`;
  }).join('');
}

// ── Calculator ──
export async function saveCalcHistory(uid, history) {
  await setDoc(doc(db,'appData',uid,'apps','calculator'),{
    history: history.slice(-50), updatedAt: new Date().toISOString()
  },{merge:true});
}
export async function loadCalcHistory(uid) {
  const snap = await getDoc(doc(db,'appData',uid,'apps','calculator'));
  return snap.exists() ? (snap.data().history||[]) : [];
}

// ── Calendar — personal events ──
export async function loadCalendarEvents(uid) {
  const snap = await getDoc(doc(db,'appData',uid,'apps','calendar'));
  return snap.exists() ? (snap.data().events||[]) : [];
}
export async function saveCalendarEvents(uid, events) {
  await setDoc(doc(db,'appData',uid,'apps','calendar'),{
    events, updatedAt: new Date().toISOString()
  },{merge:true});
}
export async function addCalendarEvent(uid, event) {
  const events = await loadCalendarEvents(uid);
  const newEvent = { ...event, id: Date.now().toString() + Math.random().toString(36).slice(2) };
  events.push(newEvent);

  // If visibility is not 'self', also store in company events
  if (event.companyId && event.visibility && event.visibility !== 'self') {
    await addDoc(collection(db,'companyEvents'), {
      ...newEvent, createdBy: uid, companyId: event.companyId
    });
  }

  await saveCalendarEvents(uid, events);
  return events;
}
export async function deleteCalendarEvent(uid, eventId) {
  const events = await loadCalendarEvents(uid);
  const filtered = events.filter(e=>e.id!==eventId);
  await saveCalendarEvents(uid, filtered);
  // Try to remove from company events too
  try {
    const q = query(collection(db,'companyEvents'), where('id','==',eventId));
    const snap = await getDocs(q);
    snap.docs.forEach(d=>deleteDoc(d.ref));
  } catch(e){}
  return filtered;
}

// ── Load company-wide events for a user based on their role ──
export async function loadCompanyEvents(companyId, userRole) {
  try {
    const q = query(collection(db,'companyEvents'), where('companyId','==',companyId));
    const snap = await getDocs(q);
    const all = snap.docs.map(d=>({...d.data(), companyEvent:true}));

    // Filter by visibility
    return all.filter(ev => {
      const v = ev.visibility || 'all';
      if (v === 'all') return true;
      if (v === 'owner' && userRole === 'owner') return true;
      if (v === 'manager' && (userRole === 'manager' || userRole === 'owner')) return true;
      if (v === 'staff' && userRole === 'staff') return true;
      if (ev.createdBy) return true; // always show your own
      return false;
    });
  } catch(e) { return []; }
}
