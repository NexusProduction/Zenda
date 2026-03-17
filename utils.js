// =============================================
//  ZENDA — Utilities
// =============================================

// ---- Generate 10-digit company unique code ----
// Format: XXXX-XXXXXX (4 letters of company + 6 random alphanumeric)
export function generateUniqueCode(companyName) {
  const prefix = companyName
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4)
    .padEnd(4, 'X');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${prefix}${suffix}`; // e.g. "ACME7K3P9M"
}

// ---- Generate staff unique ID ----
// Format: role prefix + 6 random digits
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

  return `${prefix}${digits}`; // e.g. "MGR483920"
}

// ---- Format date/time ----
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

// ---- Format full date ----
export function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'long',
    year:  'numeric'
  });
}

// ---- Get initials from name ----
export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ---- Show Toast notification ----
export function showToast(message, type = 'default', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
    default: '●'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.default}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ---- Copy text to clipboard ----
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  } catch {
    showToast('Failed to copy.', 'error');
  }
}

// ---- Validate email ----
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---- Validate password strength ----
export function checkPasswordStrength(password) {
  if (password.length < 6) return { score: 0, label: 'Too short', color: '#EF4444' };
  if (password.length < 8) return { score: 1, label: 'Weak', color: '#F59E0B' };
  const hasUpper = /[A-Z]/.test(password);
  const hasNum   = /\d/.test(password);
  const hasSpec  = /[^A-Za-z0-9]/.test(password);
  const score = 1 + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#F59E0B', '#3B82F6', '#10B981', '#059669'];
  return { score, label: labels[score], color: colors[score] };
}

// ---- Set loading state on button ----
export function setButtonLoading(btn, loading, originalText) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText || btn.dataset.originalText || btn.textContent;
  }
}

// ---- Local session helpers ----
export function saveSession(userData) {
  sessionStorage.setItem('zenda_user', JSON.stringify(userData));
}

export function getSession() {
  const raw = sessionStorage.getItem('zenda_user');
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  sessionStorage.removeItem('zenda_user');
}

// ---- Debounce ----
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---- Format role label ----
export function formatRole(role) {
  const labels = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };
  return labels[role] || role;
}

// ---- Get badge class for role ----
export function roleBadgeClass(role) {
  return { owner: 'badge-owner', manager: 'badge-manager', staff: 'badge-staff' }[role] || 'badge-info';
}

// ---- Avatar color based on name hash ----
export function avatarColor(name = '') {
  const colors = ['#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#059669', '#0891B2'];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ---- Number formatter ----
export function fmtNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
