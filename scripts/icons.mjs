#!/usr/bin/env node
/**
 * Every icon the Android app carries, derived from the one the web app
 * already has: public/icon.svg (the four quadrants and a check mark on a
 * rounded dark plate). Nobody draws an Android icon by hand.
 *
 *   node scripts/icons.mjs           # (re)write the derived files
 *   node scripts/icons.mjs --check   # fail if a committed copy has drifted
 *                                    # (part of `npm test`)
 *
 * Dependency-free on purpose — the SVG is a handful of rounded rectangles and
 * one stroked polyline, so this file rasterises exactly that subset (and
 * refuses anything else in the SVG, loudly), and writes the PNGs with
 * node:zlib. The arithmetic is plain JavaScript doubles, so the pixels are the
 * same on every machine; --check compares decoded pixels, not PNG bytes, so a
 * different zlib cannot fail it.
 *
 * What gets made (apps/android/app/src/main/res/):
 *
 *   mipmap-<density>/ic_launcher.png              the whole icon, 48dp, rounded
 *   mipmap-<density>/ic_launcher_foreground.png   adaptive foreground: the
 *       quadrants without the plate, the icon's 100 units in the 72dp a
 *       launcher shows of the 108dp layer — which keeps the quadrants' corners
 *       inside the 66dp safe circle
 *   mipmap-<density>/ic_launcher_monochrome.png   themed-icon layer (Android
 *       13+): the quadrants as one silhouette, the check mark cut out
 *   mipmap-anydpi-v26/ic_launcher.xml         the adaptive icon
 *   values/ic_launcher_background.xml             the plate's colour
 *   drawable-nodpi/todo_logo.png                  the mark on the About screen
 *   drawable-nodpi/dev_badge*.png                 the developer badge, copied
 *       byte for byte from public/
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = resolve(repoRoot, 'apps/android/app/src/main/res');
const SOURCE = resolve(repoRoot, 'public/icon.svg');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
/** Subsamples per pixel side: 4×4 coverage samples per pixel. */
const SS = 4;

// ---------------------------------------------------------------------------
// The SVG subset: <svg viewBox="0 0 W H">, <rect x y width height rx fill>,
// <path d="M… l…" stroke stroke-width stroke-linecap=round stroke-linejoin=round fill=none>.

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function num(v, what) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) throw new Error(`${what}: not a number (${v})`);
  return n;
}

function colour(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) throw new Error(`colour ${hex}: only #rgb and #rrggbb are supported`);
  const digits = m[1].length === 3 ? [...m[1]].map((d) => d + d).join('') : m[1];
  const v = parseInt(digits, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** "M23 31.5l6 6 11-12" → absolute points. Only M/m and L/l. */
function polyline(d) {
  const tokens = d.match(/[MmLl]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  if (tokens.join('').length !== d.replace(/[\s,]/g, '').length) {
    throw new Error(`path "${d}": only M, m, L and l are supported`);
  }
  const pts = [];
  let cmd = null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    if (/[MmLl]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === null) throw new Error(`path "${d}": no command`);
    const a = Number(tokens[i++]);
    const b = Number(tokens[i++]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`path "${d}": odd coordinates`);
    const rel = cmd === 'm' || cmd === 'l';
    if ((cmd === 'M' || cmd === 'm') && pts.length) throw new Error(`path "${d}": one subpath only`);
    x = rel ? x + a : a;
    y = rel ? y + b : b;
    pts.push([x, y]);
    // Coordinates after a moveto are implicit linetos.
    if (cmd === 'M') cmd = 'L';
    if (cmd === 'm') cmd = 'l';
  }
  return pts;
}

export function parseIcon(svg) {
  const view = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!view || view[1] !== view[2]) throw new Error('icon.svg: want a square viewBox="0 0 N N"');
  const size = Number(view[1]);
  const shapes = [];
  const body = svg.replace(/<svg[^>]*>|<\/svg>/g, '').trim();
  for (const m of body.matchAll(/<(\w+)\b([^>]*?)\/>/g)) {
    const a = attrs(m[2]);
    if (m[1] === 'rect') {
      shapes.push({
        kind: 'rect',
        x: num(a.x, 'x'),
        y: num(a.y, 'y'),
        w: num(a.width, 'width'),
        h: num(a.height, 'height'),
        r: num(a.rx, 'rx'),
        fill: colour(a.fill),
      });
    } else if (m[1] === 'path') {
      if (a.fill !== 'none' || a['stroke-linecap'] !== 'round' || a['stroke-linejoin'] !== 'round') {
        throw new Error('icon.svg: a path must be an unfilled stroke with round caps and joins');
      }
      shapes.push({ kind: 'stroke', pts: polyline(a.d), half: num(a['stroke-width'], 'stroke-width') / 2, fill: colour(a.stroke) });
    } else {
      throw new Error(`icon.svg: <${m[1]}> is not supported — extend scripts/icons.mjs`);
    }
  }
  if (body.replace(/<(\w+)\b[^>]*?\/>/g, '').trim()) throw new Error('icon.svg: unexpected content');
  const plate = shapes[0];
  if (!plate || plate.kind !== 'rect' || plate.x !== 0 || plate.y !== 0 || plate.w !== size || plate.h !== size) {
    throw new Error('icon.svg: the first element must be the full-size plate rect');
  }
  return { size, plate, scene: shapes.slice(1) };
}

// ---------------------------------------------------------------------------
// Coverage and compositing.

function insideRect(s, px, py) {
  if (px < s.x || py < s.y || px > s.x + s.w || py > s.y + s.h) return false;
  const r = Math.min(s.r, s.w / 2, s.h / 2);
  const cx = Math.min(Math.max(px, s.x + r), s.x + s.w - r);
  const cy = Math.min(Math.max(py, s.y + r), s.y + s.h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function insideStroke(s, px, py) {
  // Round caps and joins: the union of capsules around each segment.
  for (let i = 0; i + 1 < s.pts.length; i++) {
    const [ax, ay] = s.pts[i];
    const [bx, by] = s.pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    if ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2 <= s.half * s.half) return true;
  }
  return false;
}

function bounds(s) {
  if (s.kind === 'rect') return [s.x, s.y, s.x + s.w, s.y + s.h];
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  return [Math.min(...xs) - s.half, Math.min(...ys) - s.half, Math.max(...xs) + s.half, Math.max(...ys) + s.half];
}

/**
 * Paints [layers] onto a transparent px×px canvas. Each layer is
 * { shape, colour: [r,g,b] | null } — null erases (destination-out). The
 * icon's unit square [0, size] maps to [offset, offset + span] in pixels.
 */
function paint(px, layers, size, span, offset) {
  const rgba = new Float64Array(px * px * 4); // premultiplied, 0..1
  const k = span / size;
  for (const { shape, colour: c } of layers) {
    const inside = shape.kind === 'rect' ? insideRect : insideStroke;
    const [x0, y0, x1, y1] = bounds(shape);
    const pxFrom = Math.max(0, Math.floor(offset + x0 * k));
    const pxTo = Math.min(px - 1, Math.ceil(offset + x1 * k));
    const pyFrom = Math.max(0, Math.floor(offset + y0 * k));
    const pyTo = Math.min(px - 1, Math.ceil(offset + y1 * k));
    for (let j = pyFrom; j <= pyTo; j++) {
      for (let i = pxFrom; i <= pxTo; i++) {
        let hits = 0;
        for (let sj = 0; sj < SS; sj++) {
          for (let si = 0; si < SS; si++) {
            const ux = (i + (si + 0.5) / SS - offset) / k;
            const uy = (j + (sj + 0.5) / SS - offset) / k;
            if (inside(shape, ux, uy)) hits++;
          }
        }
        if (!hits) continue;
        const a = hits / (SS * SS);
        const o = (j * px + i) * 4;
        if (c === null) {
          for (let ch = 0; ch < 4; ch++) rgba[o + ch] *= 1 - a;
        } else {
          for (let ch = 0; ch < 3; ch++) rgba[o + ch] = (c[ch] / 255) * a + rgba[o + ch] * (1 - a);
          rgba[o + 3] = a + rgba[o + 3] * (1 - a);
        }
      }
    }
  }
  // Un-premultiply to 8-bit straight RGBA.
  const out = Buffer.alloc(px * px * 4);
  for (let p = 0; p < px * px; p++) {
    const a = rgba[p * 4 + 3];
    out[p * 4 + 3] = Math.round(a * 255);
    for (let ch = 0; ch < 3; ch++) out[p * 4 + ch] = a === 0 ? 0 : Math.round(Math.min(1, rgba[p * 4 + ch] / a) * 255);
  }
  return out;
}

// ---------------------------------------------------------------------------
// PNG, RGBA 8-bit, filter 0 on every row.

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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(px, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(px * (px * 4 + 1));
  for (let y = 0; y < px; y++) rgba.copy(raw, y * (px * 4 + 1) + 1, y * px * 4, (y + 1) * px * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The pixels of a PNG this script wrote (RGBA, filter 0), or null for anything else. */
function decodeOwnPng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8;
  let w = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      if (data.readUInt32BE(4) !== w || data[8] !== 8 || data[9] !== 6) return null;
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * w * 4);
  for (let y = 0; y < w; y++) {
    if (raw[y * (w * 4 + 1)] !== 0) return null; // not a filter-0 row: not ours
    raw.copy(out, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  }
  return { w, pixels: out };
}

// ---------------------------------------------------------------------------
// What to make.

function hex([r, g, b]) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function outputs() {
  const icon = parseIcon(readFileSync(SOURCE, 'utf8'));
  const { size, plate, scene } = icon;
  const whole = [plate, ...scene].map((shape) => ({ shape, colour: shape.fill }));
  const quadrants = scene.filter((s) => s.kind === 'rect');
  const marks = scene.filter((s) => s.kind !== 'rect');
  const mono = [
    ...quadrants.map((shape) => ({ shape, colour: [255, 255, 255] })),
    ...marks.map((shape) => ({ shape, colour: null })),
  ];
  const files = [];
  const png = (path, px, layers, spanPx, offsetPx) =>
    files.push({ path, png: { px, make: () => paint(px, layers, size, spanPx, offsetPx) } });

  for (const [d, k] of Object.entries(DENSITIES)) {
    const launcher = Math.round(48 * k);
    png(`mipmap-${d}/ic_launcher.png`, launcher, whole, launcher, 0);
    const layer = Math.round(108 * k);
    const span = 72 * k;
    const offset = 18 * k;
    png(`mipmap-${d}/ic_launcher_foreground.png`, layer, scene.map((shape) => ({ shape, colour: shape.fill })), span, offset);
    png(`mipmap-${d}/ic_launcher_monochrome.png`, layer, mono, span, offset);
  }
  // 72dp (its size on the About screen) at xxxhdpi.
  png('drawable-nodpi/todo_logo.png', 288, whole, 288, 0);

  files.push({
    path: 'mipmap-anydpi-v26/ic_launcher.xml',
    text: `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from public/icon.svg by \`npm run icons\`; edit that, not this. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`,
  });
  files.push({
    path: 'values/ic_launcher_background.xml',
    text: `<?xml version="1.0" encoding="utf-8"?>
<!-- The icon's plate colour. Generated from public/icon.svg by \`npm run icons\`. -->
<resources>
    <color name="ic_launcher_background">${hex(plate.fill)}</color>
</resources>
`,
  });
  for (const [from, to] of [
    ['dev-badge.png', 'dev_badge.png'],
    ['dev-badge-full.png', 'dev_badge_full.png'],
  ]) {
    files.push({ path: `drawable-nodpi/${to}`, copy: resolve(repoRoot, 'public', from) });
  }
  return files;
}

function run(check) {
  const drifted = [];
  for (const f of outputs()) {
    const target = resolve(res, f.path);
    const have = existsSync(target) ? readFileSync(target) : null;
    if (check) {
      let same;
      if (f.png) {
        const got = have && decodeOwnPng(have);
        same = Boolean(got) && got.w === f.png.px && got.pixels.equals(f.png.make());
      } else {
        const want = f.copy ? readFileSync(f.copy) : Buffer.from(f.text);
        same = Boolean(have) && have.equals(want);
      }
      if (!same) drifted.push(relative(repoRoot, target));
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    const bytes = f.png ? encodePng(f.png.px, f.png.make()) : f.copy ? readFileSync(f.copy) : Buffer.from(f.text);
    if (!have || !have.equals(bytes)) {
      writeFileSync(target, bytes);
      console.log(`wrote ${relative(repoRoot, target)}`);
    }
  }
  if (drifted.length) {
    console.error(`icons out of date with public/icon.svg — run \`npm run icons\`:\n  ${drifted.join('\n  ')}`);
    process.exit(1);
  }
  if (check) console.log('icons: every derived file matches public/icon.svg');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.includes('--check'));
}
