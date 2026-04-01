// =============================================
//  ZENDA — ID Card Generator (HTML5 Canvas)
// =============================================

// ---- Color schemes per role ----
const CARD_THEMES = {
  company: { gradStart: '#1E1B4B', gradMid: '#312E81', gradEnd: '#4F46E5' },
  owner:   { gradStart: '#78350F', gradMid: '#B45309', gradEnd: '#F59E0B' },
  manager: { gradStart: '#1E3A5F', gradMid: '#1E40AF', gradEnd: '#3B82F6' },
  staff:   { gradStart: '#064E3B', gradMid: '#065F46', gradEnd: '#10B981' }
};

export function drawCompanyCard(canvas, { companyName, ownerName, email, uniqueCode }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, theme = CARD_THEMES.company;
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.gradStart); grad.addColorStop(0.5, theme.gradMid); grad.addColorStop(1, theme.gradEnd);
  ctx.fillStyle = grad; roundRect(ctx, 0, 0, W, H, 20); ctx.fill();

  ctx.font = 'bold 14px "Outfit", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText('⚡ ZENDA', 24, 32);
  ctx.font = 'bold 11px "DM Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'right'; ctx.fillText('COMPANY CARD', W - 24, 32); ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(24, 44); ctx.lineTo(W - 24, 44); ctx.stroke();
  ctx.font = 'bold 22px "Outfit", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(truncate(companyName, 22), 24, 80);
  ctx.font = '500 13px "DM Sans", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(ownerName, 24, 100);
  ctx.font = '400 11px "DM Sans", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText(email, 24, 120);
  ctx.font = 'bold 13px "DM Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(formatCode(uniqueCode), 24, H - 24);
  ctx.font = 'bold 11px "Outfit", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'right'; ctx.fillText('zenda.app', W - 24, H - 24); ctx.textAlign = 'left';
}

// ---- REDESIGNED STAFF / MANAGER CARD ----
export function drawStaffCard(canvas, { name, email, role, designation, companyName, uniqueId, companyCode, password }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const theme = CARD_THEMES[role] || CARD_THEMES.staff;

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.gradStart);
  grad.addColorStop(1, theme.gradEnd);
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  // Subtle background shapes
  ctx.save();
  ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(W - 30, -30, 110, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Top row: Brand + Big Role Badge
  ctx.font = 'bold 16px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('⚡ ZENDA', 24, 34);

  const roleLabel = (role === 'manager' ? 'MANAGER' : 'STAFF');
  ctx.font = 'bold 13px "Outfit", sans-serif';
  const roleWidth = ctx.measureText(roleLabel).width + 24;
  ctx.fillStyle = role === 'manager' ? 'rgba(96, 165, 250, 0.25)' : 'rgba(52, 211, 153, 0.25)';
  roundRect(ctx, W - 24 - roleWidth, 18, roleWidth, 24, 6);
  ctx.fill();
  ctx.fillStyle = role === 'manager' ? '#93C5FD' : '#6EE7B7'; // Bright blue for manager, green for staff
  ctx.textAlign = 'center';
  ctx.fillText(roleLabel, W - 24 - (roleWidth/2), 34);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, 52); ctx.lineTo(W - 24, 52); ctx.stroke();

  // BIG Name & Company
  ctx.font = 'bold 26px "Outfit", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncate(name, 22), 24, 90);

  ctx.font = '500 13px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${companyName} • ${designation || 'Team Member'}`, 24, 112);

  // Credentials Box (Darker inset background)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, 24, 134, W - 48, 80, 12);
  ctx.fill();

  // Labels
  ctx.font = '500 13px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Email:', 40, 160);
  ctx.fillText('Pass:', 40, 192);

  // Values (BIG)
  ctx.font = 'bold 15px "DM Mono", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(email, 90, 160);
  
  ctx.fillStyle = '#FCD34D'; // Bright yellow for password so it stands out
  ctx.fillText(password || '••••••••', 90, 192);

  // Bottom row UID
  ctx.font = '500 13px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Unique ID:', 24, H - 24);

  ctx.font = 'bold 16px "DM Mono", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(uniqueId, 95, H - 24);
}

export function downloadCard(canvas, filename = 'zenda-card.png') {
  const link = document.createElement('a'); link.download = filename; link.href = canvas.toDataURL('image/png', 1.0); link.click();
}
export function shareCardWhatsApp(canvas, fileName = 'Zenda ID Card') {
  canvas.toBlob(blob => {
    if (navigator.share) {
      const file = new File([blob], fileName + '.png', { type: 'image/png' });
      navigator.share({ title: 'Zenda ID Card', text: 'Here is my Zenda ID Card', files: [file] }).catch(console.error);
    } else {
      downloadCard(canvas, fileName + '.png');
      const text = encodeURIComponent('Here is my Zenda ID Card! Download and view. 📇');
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  });
}
export function renderCardToElement(containerId, type, data) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 280;
  canvas.style.width = '100%'; canvas.style.maxWidth = '400px'; canvas.style.borderRadius = '16px'; canvas.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)';
  container.innerHTML = ''; container.appendChild(canvas);
  if (type === 'company') drawCompanyCard(canvas, data); else drawStaffCard(canvas, data);
  return canvas;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function truncate(str = '', max = 20) { return str.length > max ? str.substring(0, max) + '…' : str; }
function formatCode(code = '') { return code.length === 10 ? code.substring(0, 4) + '-' + code.substring(4) : code; }
