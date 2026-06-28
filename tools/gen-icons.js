// Generates elegant PNG app icons with a pure-JS PNG encoder (no deps).
// Anti-aliased via analytic signed-distance fields. Run: node tools/gen-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ---- PNG encoder ---------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing helpers -----------------------------------------------------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function over(dst, i, r, g, b, a) {
  const da = dst[i + 3] / 255;
  const outA = a + da * (1 - a);
  if (outA <= 0) { dst[i] = dst[i + 1] = dst[i + 2] = dst[i + 3] = 0; return; }
  dst[i]     = (r * a + dst[i]     * da * (1 - a)) / outA;
  dst[i + 1] = (g * a + dst[i + 1] * da * (1 - a)) / outA;
  dst[i + 2] = (b * a + dst[i + 2] * da * (1 - a)) / outA;
  dst[i + 3] = outA * 255;
}

function makeIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4); // transparent
  const c1 = hex('#8B5CF6'); // violet
  const c2 = hex('#6366F1'); // indigo
  const c3 = hex('#22D3EE'); // accent cyan glint
  const aa = size / 220; // ~1px feather scaled

  // Background: full-bleed for maskable, rounded card otherwise
  const margin = maskable ? 0 : size * 0.085;
  const bgR = maskable ? 0 : size * 0.22;
  const cx = size / 2, cy = size / 2;
  const hw = size / 2 - margin, hh = size / 2 - margin;

  // mark geometry (a "hub": ring + center dot + orbiting node)
  const ringR = size * (maskable ? 0.215 : 0.235);
  const ringW = size * 0.052;
  const dotR = size * 0.072;
  const nodeR = size * 0.058;
  const nodeAngle = -Math.PI / 4;
  const nodeX = cx + Math.cos(nodeAngle) * ringR;
  const nodeY = cy + Math.sin(nodeAngle) * ringR;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5, py = y + 0.5;

      // background gradient (diagonal)
      const dBg = sdRoundRect(px, py, cx, cy, hw, hh, bgR);
      const covBg = 1 - smooth(0, aa * 1.5, dBg);
      if (covBg > 0) {
        const t = Math.min(1, Math.max(0, (px / size * 0.6 + py / size * 0.4)));
        const r = lerp(c1[0], c2[0], t), g = lerp(c1[1], c2[1], t), b = lerp(c1[2], c2[2], t);
        over(buf, i, r, g, b, covBg);
      }

      // ring (white, slightly translucent)
      const dRing = Math.abs(Math.hypot(px - cx, py - cy) - ringR) - ringW / 2;
      const covRing = 1 - smooth(0, aa * 1.5, dRing);
      if (covRing > 0) over(buf, i, 255, 255, 255, covRing * 0.92);

      // center dot (white)
      const dDot = Math.hypot(px - cx, py - cy) - dotR;
      const covDot = 1 - smooth(0, aa * 1.5, dDot);
      if (covDot > 0) over(buf, i, 255, 255, 255, covDot);

      // orbiting node (cyan glint with white halo)
      const dNode = Math.hypot(px - nodeX, py - nodeY) - nodeR;
      const covNode = 1 - smooth(0, aa * 1.5, dNode);
      if (covNode > 0) over(buf, i, c3[0], c3[1], c3[2], covNode);
    }
  }
  return encodePNG(size, size, buf);
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-192.png', 192, { maskable: true }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
  ['favicon-64.png', 64, {}],
];
for (const [name, sz, opts] of targets) {
  fs.writeFileSync(path.join(OUT, name), makeIcon(sz, opts));
  console.log('wrote', name, sz + 'px');
}
console.log('done');
