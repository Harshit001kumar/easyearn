const { createCanvas, registerFont } = require('canvas');
const path = require('path');

/**
 * Generate a modern payment proof image using Canvas
 * Returns a Buffer (PNG) that can be attached to a Discord message
 */
async function generatePaymentProof({ username, amount, method, destination, date, withdrawalId }) {
  const width = 800;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ─── BACKGROUND ───
  // Dark gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0f0f1a');
  bgGrad.addColorStop(0.5, '#1a1a2e');
  bgGrad.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // ─── SUBTLE GRID PATTERN ───
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // ─── MAIN CARD ───
  const cardX = 40;
  const cardY = 30;
  const cardW = width - 80;
  const cardH = height - 60;
  const radius = 20;

  // Card border gradient (purple → cyan)
  const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  borderGrad.addColorStop(0, '#7c3aed');
  borderGrad.addColorStop(0.5, '#06b6d4');
  borderGrad.addColorStop(1, '#7c3aed');

  // Draw border
  roundRect(ctx, cardX - 2, cardY - 2, cardW + 4, cardH + 4, radius + 2);
  ctx.fillStyle = borderGrad;
  ctx.fill();

  // Card fill (glassmorphism dark)
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = 'rgba(15, 15, 30, 0.95)';
  ctx.fill();

  // ─── GLOW EFFECTS ───
  // Top-left purple glow
  const glow1 = ctx.createRadialGradient(100, 80, 0, 100, 80, 200);
  glow1.addColorStop(0, 'rgba(124, 58, 237, 0.15)');
  glow1.addColorStop(1, 'rgba(124, 58, 237, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  // Bottom-right cyan glow
  const glow2 = ctx.createRadialGradient(700, 440, 0, 700, 440, 200);
  glow2.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
  glow2.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // ─── HEADER: CHECKMARK + "PAYMENT VERIFIED" ───
  const headerY = 85;

  // Green checkmark circle
  ctx.beginPath();
  ctx.arc(width / 2 - 120, headerY, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width / 2 - 120, headerY, 22, 0, Math.PI * 2);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Checkmark icon
  ctx.beginPath();
  ctx.moveTo(width / 2 - 130, headerY);
  ctx.lineTo(width / 2 - 122, headerY + 8);
  ctx.lineTo(width / 2 - 110, headerY - 8);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // "PAYMENT VERIFIED" text
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('PAYMENT VERIFIED', width / 2 - 90, headerY + 9);

  // ─── DIVIDER LINE ───
  const divY = 125;
  const divGrad = ctx.createLinearGradient(cardX + 30, 0, cardX + cardW - 30, 0);
  divGrad.addColorStop(0, 'rgba(124, 58, 237, 0)');
  divGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.5)');
  divGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 30, divY);
  ctx.lineTo(cardX + cardW - 30, divY);
  ctx.stroke();

  // ─── AMOUNT (big, glowing cyan) ───
  const ltcAmount = (amount * 0.00001).toFixed(6);
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.textAlign = 'center';

  // Glow effect for amount
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#06b6d4';
  ctx.fillText(`${ltcAmount} LTC`, width / 2, 185);
  ctx.shadowBlur = 0;

  // Dollar equivalent label
  ctx.font = '16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText(`${amount.toLocaleString()} Points`, width / 2, 212);

  // ─── INFO ROWS ───
  ctx.textAlign = 'left';
  const infoX = cardX + 50;
  const valX = cardX + cardW - 50;
  let rowY = 260;
  const rowSpacing = 48;

  const rows = [
    { label: '👤  Recipient', value: maskEmail(username) },
    { label: '🪙  Method', value: `${method === 'LTC' ? 'Litecoin (LTC)' : 'UPI Transfer'}` },
    { label: '📨  Destination', value: maskAddress(destination) },
    { label: '📅  Date', value: date },
    { label: '✅  Status', value: 'COMPLETED', isStatus: true }
  ];

  for (const row of rows) {
    // Label
    ctx.font = '15px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(row.label, infoX, rowY);

    // Value
    ctx.textAlign = 'right';
    if (row.isStatus) {
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillStyle = '#22c55e';
    } else {
      ctx.font = '15px Arial, sans-serif';
      ctx.fillStyle = '#e0e0e0';
    }
    ctx.fillText(row.value, valX, rowY);
    ctx.textAlign = 'left';

    // Row separator
    if (row !== rows[rows.length - 1]) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(infoX, rowY + 16);
      ctx.lineTo(valX, rowY + 16);
      ctx.stroke();
    }

    rowY += rowSpacing;
  }

  // ─── FOOTER ───
  const footerY = height - 45;

  // Lock icon + branding
  ctx.textAlign = 'center';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillText(`🔒 EasyEarn.com  •  Withdrawal #${withdrawalId.toString().slice(-8)}`, width / 2, footerY);

  // Return buffer
  return canvas.toBuffer('image/png');
}

// ─── HELPERS ───

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

function maskEmail(email) {
  if (!email || !email.includes('@')) return '***@***.***';
  const [name, domain] = email.split('@');
  const masked = name.slice(0, 2) + '***' + name.slice(-1);
  return `${masked}@${domain}`;
}

function maskAddress(addr) {
  if (!addr) return '••••••••';
  if (addr.length > 12) {
    return addr.slice(0, 6) + '••••' + addr.slice(-4);
  }
  // UPI — mask middle
  return addr.slice(0, 3) + '***' + addr.slice(-4);
}

module.exports = { generatePaymentProof };
