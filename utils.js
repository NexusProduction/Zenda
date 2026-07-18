// utils.js — small shared helpers actually used across the app

// Random staff ID, prefixed by role (e.g. "MGR483920")
export function generateStaffId(role) {
  const prefix = {
    owner:   'OWN',
    manager: 'MGR',
    staff:   'STF'
  }[role] || 'USR';

  let digits = '';
  for (let i = 0; i < 6; i++) {
    digits += Math.floor(Math.random() * 10);
  }

  return `${prefix}${digits}`;
}

// Relative time string ("5m ago", "2d ago"), falls back to a short date
export function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Basic email format check
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
