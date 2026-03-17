// =============================================
//  ZENDA — ID Card Generator (HTML5 Canvas)
// =============================================

// ---- Color schemes per role ----
const CARD_THEMES = {
  company: {
    gradStart: '#1E1B4B',
    gradMid:   '#312E81',
    gradEnd:   '#4F46E5',
    accent:    '#7C3AED'
  },
  owner: {
    gradStart: '#78350F',
    gradMid:   '#B45309',
    gradEnd:   '#F59E0B',
    accent:    '#FCD34D'
  },
  manager: {
    gradStart: '#1E3A5F',
    gradMid:   '#1E40AF',
    gradEnd:   '#3B82F6',
    accent:    '#60A5FA'
  },
  staff: {
    gradStart: '#064E3B',
    gradMid:   '#065F46',
    gradEnd:   '#10B981',
    accent:    '#34D399'
  }
};

// ---- Draw Company Card ----
export function drawCompanyCard(canvas, { companyName, ownerName, email, uniqueCode }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const theme = CARD_THEMES.company;

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   theme.gradStart);
  grad.addColorStop(0.5, theme.gradMid);
  grad.addColorStop(1,   theme.gradEnd);
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  // Decorative circles
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(W - 40, -20, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-20, H + 20, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Top row: Brand + type
  ctx.font = 'bold 14px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('⚡ ZENDA', 24, 32);

  ctx.font = 'bold 11px "DM Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText('COMPANY CARD', W - 24, 32);
  ctx.textAlign = 'left';

  // Divider line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 44);
  ctx.lineTo(W - 24, 44);
  ctx.stroke();

  // Company Name
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncate(companyName, 22), 24, 80);

  // Owner Name
  ctx.font = '500 13px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(ownerName, 24, 100);

  // Email
  ctx.font = '400 11px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(email, 24, 120);

  // Bottom: Unique Code
  ctx.font = 'bold 13px "DM Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(formatCode(uniqueCode), 24, H - 24);

  // Bottom right: Zenda logo
  ctx.font = 'bold 11px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'right';
  ctx.fillText('zenda.app', W - 24, H - 24);
  ctx.textAlign = 'left';
}

// ---- Draw Staff Card ----
export function drawStaffCard(canvas, { name, email, role, designation, companyName, uniqueId, companyCode }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const theme = CARD_THEMES[role] || CARD_THEMES.staff;

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   theme.gradStart);
  grad.addColorStop(0.5, theme.gradMid);
  grad.addColorStop(1,   theme.gradEnd);
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  // Decorative circles
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(W - 30, -30, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-10, H + 30, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Top row: Brand + role badge
  ctx.font = 'bold 14px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('⚡ ZENDA', 24, 32);

  // Role badge (rounded rect)
  const roleLabel = (designation || role).toUpperCase();
  ctx.font = 'bold 10px "Outfit", sans-serif';
  const roleWidth = ctx.measureText(roleLabel).width + 20;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, W - 24 - roleWidth, 18, roleWidth, 20, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'right';
  ctx.fillText(roleLabel, W - 24, 32);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 44);
  ctx.lineTo(W - 24, 44);
  ctx.stroke();

  // Avatar circle with initials
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(44, 82, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 14px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'center';
  ctx.fillText(initials, 44, 87);
  ctx.textAlign = 'left';
  ctx.restore();

  // Name
  ctx.font = 'bold 18px "Outfit", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncate(name, 22), 74, 80);

  // Company name
  ctx.font = '500 12px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(companyName, 74, 97);

  // Email
  ctx.font = '400 11px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(email, 24, 126);

  // Bottom row
  ctx.font = 'bold 12px "DM Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(uniqueId, 24, H - 24);

  ctx.font = 'bold 10px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'right';
  ctx.fillText('zenda.app', W - 24, H - 24);
  ctx.textAlign = 'left';
}

// ---- Download card as PNG ----
export function downloadCard(canvas, filename = 'zenda-card.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

// ---- Share on WhatsApp ----
export function shareCardWhatsApp(canvas, fileName = 'Zenda ID Card') {
  // WhatsApp doesn't support direct file share from web
  // We'll open WhatsApp with a message and note to download image
  canvas.toBlob(blob => {
    // Try Web Share API first (mobile)
    if (navigator.share) {
      const file = new File([blob], fileName + '.png', { type: 'image/png' });
      navigator.share({
        title: 'Zenda ID Card',
        text:  'Here is my Zenda ID Card',
        files: [file]
      }).catch(console.error);
    } else {
      // Fallback: download + open WhatsApp
      downloadCard(canvas, fileName + '.png');
      const text = encodeURIComponent('Here is my Zenda ID Card! Download and view. 📇');
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  });
}

// ---- Render card to a DOM element ----
export function renderCardToElement(containerId, type, data) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const canvas = document.createElement('canvas');
  canvas.width  = 480;
  canvas.height = 280;
  canvas.style.width  = '100%';
  canvas.style.maxWidth = '400px';
  canvas.style.borderRadius = '16px';
  canvas.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)';

  container.innerHTML = '';
  container.appendChild(canvas);

  if (type === 'company') {
    drawCompanyCard(canvas, data);
  } else {
    drawStaffCard(canvas, data);
  }

  return canvas;
}

// ---- Helpers ----
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(str = '', max = 20) {
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function formatCode(code = '') {
  // Format: XXXX-XXXXXX
  if (code.length === 10) {
    return code.substring(0, 4) + '-' + code.substring(4);
  }
  return code;
}
