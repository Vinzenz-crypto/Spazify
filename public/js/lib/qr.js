// QR codes (so classmates can scan the class link from the projector).
import qrcode from '../../vendor/qrcode.mjs';
import { raw } from './html.js';

export function qrSvg(text, { size = 220, label = 'QR code' } = {}) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const margin = 2;
  const total = n + margin * 2;
  let dots = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      if (finder) continue;
      dots += `<rect x="${c + margin + 0.08}" y="${r + margin + 0.08}" width="0.84" height="0.84" rx="0.3"/>`;
    }
  }
  const finder = (x, y) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.8"/>`;
  return raw(
    `<svg class="qr" role="img" aria-label="${label}" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" rx="2" fill="#fff"/><g fill="currentColor">${dots}${finder(margin, margin)}${finder(margin + n - 7, margin)}${finder(margin, margin + n - 7)}</g></svg>`,
  );
}
