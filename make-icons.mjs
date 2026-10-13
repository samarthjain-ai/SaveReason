/**
 * make-icons.mjs
 * Generates icon16.png, icon48.png, icon128.png for the SaveReason extension.
 * Uses only Node.js built-ins — no npm packages needed.
 *
 * Run once from Backend/:
 *   node make-icons.mjs
 */

// ── Tiny pure-JS PNG encoder (no deps) ────────────────────────────────────────
import { createWriteStream } from 'node:fs';
import { deflateSync }       from 'node:zlib';
import { resolve, dirname }  from 'node:path';
import { fileURLToPath }     from 'node:url';
import * as fs               from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function u32(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const c = Buffer.allocUnsafe(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
  return Buffer.concat([u32(d.length), t, d, c]);
}

/**
 * rgba: Uint8Array of length w*h*4 (R,G,B,A per pixel)
 */
function encodePNG(w, h, rgba) {
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const IHDR = Buffer.concat([
    u32(w), u32(h),
    Buffer.from([8, 6, 0, 0, 0]) // 8-bit, RGBA, deflate, no filter, no interlace
  ]);
  // Raw scanlines: filter byte 0 + row data
  const raw = Buffer.allocUnsafe(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter type None
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = y * (1 + w * 4) + 1 + x * 4;
      raw[di]     = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      raw[di + 3] = rgba[si + 3];
    }
  }
  const IDAT = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', IHDR),
    chunk('IDAT', IDAT),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Draw the SaveReason logo into an RGBA buffer ──────────────────────────────
// Design: dark rounded-rect bg, document shape in white/light-blue, teal brain

function drawLogo(size) {
  const s     = size;
  const rgba  = new Uint8Array(s * s * 4);
  const scale = s / 128;

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= s || y < 0 || y >= s) return;
    const i  = (y * s + x) * 4;
    const fa = a / 255;
    rgba[i]     = Math.round(rgba[i]     * (1 - fa) + r * fa);
    rgba[i + 1] = Math.round(rgba[i + 1] * (1 - fa) + g * fa);
    rgba[i + 2] = Math.round(rgba[i + 2] * (1 - fa) + b * fa);
    rgba[i + 3] = Math.min(255, rgba[i + 3] + a);
  }

  function fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++)
        setPixel(px, py, r, g, b, a);
  }

  function fillRoundRect(x, y, w, h, rad, r, g, b, a = 255) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const dx = Math.max(x + rad - px, px - (x + w - rad - 1), 0);
        const dy = Math.max(y + rad - py, py - (y + h - rad - 1), 0);
        if (dx * dx + dy * dy <= rad * rad) setPixel(px, py, r, g, b, a);
      }
    }
  }

  function fillCircleAA(cx, cy, rad, r, g, b) {
    const r2 = rad * rad;
    for (let py = Math.floor(cy - rad) - 1; py <= Math.ceil(cy + rad) + 1; py++) {
      for (let px = Math.floor(cx - rad) - 1; px <= Math.ceil(cx + rad) + 1; px++) {
        const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (d2 <= r2) setPixel(px, py, r, g, b);
        else if (d2 <= (rad + 1) * (rad + 1)) {
          const cov = Math.max(0, rad + 1 - Math.sqrt(d2));
          setPixel(px, py, r, g, b, Math.round(cov * 255));
        }
      }
    }
  }

  // BG: dark rounded square
  fillRoundRect(0, 0, s, s, Math.round(22 * scale), 10, 12, 18);

  // ── Document body (white card, slightly off-center-left) ──
  const dX = Math.round(14 * scale);
  const dY = Math.round(22 * scale);
  const dW = Math.round(72 * scale);
  const dH = Math.round(80 * scale);
  const dR = Math.round(8 * scale);
  fillRoundRect(dX, dY, dW, dH, dR, 220, 230, 240); // light card

  // ── Dog-ear fold (top-right corner of doc) ──
  const foldSize = Math.round(16 * scale);
  const fX = dX + dW - foldSize;
  for (let py = dY; py < dY + foldSize; py++) {
    for (let px = fX; px < fX + foldSize; px++) {
      const inFold = (px - fX) + (py - dY) < foldSize;
      if (!inFold) setPixel(px, py, 10, 12, 18); // cut corner
    }
  }
  // Fold triangle fill (light blue)
  for (let py = dY; py < dY + foldSize; py++) {
    for (let px = fX; px < fX + foldSize; px++) {
      const inTri = (px - fX) + (py - dY) >= foldSize;
      if (inTri) setPixel(px, py, 100, 190, 220);
    }
  }

  // ── Top blue tab ──
  const tabY = Math.round(14 * scale);
  const tabH = Math.round(14 * scale);
  fillRoundRect(dX, tabY, dW, tabH + dR, dR, 100, 190, 220);
  fillRect(dX, tabY + tabH, dW, dR, 100, 190, 220); // square bottom half

  // ── Text lines on document ──
  const lineX  = dX + Math.round(10 * scale);
  const lineW  = dW - Math.round(28 * scale);
  const lineH  = Math.max(2, Math.round(4 * scale));
  const lineGap = Math.round(10 * scale);
  const line1Y = dY + Math.round(22 * scale);
  for (let i = 0; i < 3; i++) {
    fillRoundRect(lineX, line1Y + i * lineGap, lineW - (i === 2 ? Math.round(12*scale) : 0), lineH, Math.round(2*scale), 100, 190, 220);
  }

  // ── Brain (teal, bottom-right) ──
  const brainCX = Math.round(88 * scale);
  const brainCY = Math.round(90 * scale);
  const brainR  = Math.round(24 * scale);
  // Outer circle approximation
  fillCircleAA(brainCX, brainCY, brainR, 10, 12, 18, 255); // dark bg punch-out first
  // Left lobe
  fillCircleAA(brainCX - Math.round(7 * scale), brainCY - Math.round(3 * scale), Math.round(13 * scale), 80, 195, 160);
  // Right lobe
  fillCircleAA(brainCX + Math.round(7 * scale), brainCY - Math.round(3 * scale), Math.round(13 * scale), 80, 195, 160);
  // Center gap (dark)
  fillRect(brainCX - Math.round(2 * scale), brainCY - Math.round(16 * scale), Math.round(4 * scale), Math.round(26 * scale), 10, 12, 18);
  // Bottom connector
  fillRoundRect(brainCX - Math.round(10 * scale), brainCY + Math.round(5 * scale), Math.round(20 * scale), Math.round(8 * scale), Math.round(4 * scale), 80, 195, 160);

  return encodePNG(s, s, rgba);
}

// ── Write files ───────────────────────────────────────────────────────────────
const EXT_LOGO = resolve(__dirname, 'Extension', 'logo');
const FRONTEND_ASSETS = resolve(__dirname, '..', 'Frontend', 'assets');

fs.mkdirSync(FRONTEND_ASSETS, { recursive: true });

for (const size of [16, 48, 128]) {
  const buf  = drawLogo(size);
  const dest = resolve(EXT_LOGO, `icon${size}.png`);
  fs.writeFileSync(dest, buf);
  console.log(`✓ Written ${dest}`);
}

// Also copy 128 as logo.png for the frontend
const logo128 = drawLogo(128);
fs.writeFileSync(resolve(FRONTEND_ASSETS, 'logo.png'), logo128);
console.log(`✓ Written Frontend/assets/logo.png`);

// And a larger 512 version for frontend nav
const logo512 = drawLogo(512);
fs.writeFileSync(resolve(FRONTEND_ASSETS, 'logo512.png'), logo512);
console.log(`✓ Written Frontend/assets/logo512.png`);

console.log('\n✓ All icons generated. Reload the Chrome extension at chrome://extensions');
