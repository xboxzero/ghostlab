// GHOST LAB — procedural 64x64 sprites: Ragnarok Online-style chibi bodies (big head, tiny body,
// dark outlines, soft 3-tone shading) fitted with Cyberpunk 2077 chrome and neon. Body form,
// features and props come from each spirit's Wikipedia text via traits.js.
import { rng } from './rng.js';
import { REALMS } from './data.js';

const S = 64;
const NEON = ['#00f0ff', '#ff2a6d', '#fcee0a', '#05ffa1', '#b967ff'];
const OUTLINE = [20, 12, 28];
const HAIR = {
  WRAITH: ['#2a1a30', '#4a0f20', '#181826', '#5a2040'], BANSHEE: ['#d8dcef', '#f0f0fa', '#7080a0', '#e0506a'],
  POLTERGEIST: ['#ff8a3a', '#40b0f0', '#e8e050', '#b060f0'], YOKAI: ['#f0a040', '#f4f4f4', '#60c080', '#f070a0'],
  REVENANT: ['#4a4a52', '#7a5a44', '#2a4034', '#9a8a6a'], SPECTER: ['#80e8ff', '#b8b8ff', '#e8ffff', '#80ffc0'],
  PHANTOM: ['#141420', '#24182a', '#ecebf4', '#46304e'], SHADE: ['#2a0c3a', '#4a0c20', '#101014', '#60286e'],
};
const SKIN = ['#fde8e0', '#f6dccc', '#e8c4a8', '#c8946e', '#9a6a4a', '#e4f0f4', '#d8e4ff'];
const OUTFIT = {
  WRAITH: '#3a2a48', BANSHEE: '#c8ccdc', POLTERGEIST: '#6a3a8a', YOKAI: '#b83a3a',
  REVENANT: '#5e5a4a', SPECTER: '#3a6a96', PHANTOM: '#ecebf4', SHADE: '#1a1020',
};
const EYES = ['#ff3048', '#30e0ff', '#ffd040', '#b060ff', '#40ff90', '#ff70c0'];

const rgbCache = new Map();
function rgb(hex) {
  if (!rgbCache.has(hex)) { const n = parseInt(hex.slice(1), 16); rgbCache.set(hex, [(n >> 16) & 255, (n >> 8) & 255, n & 255]); }
  return rgbCache.get(hex);
}
function mix(hex, f) {
  const [r, g, b] = rgb(hex);
  const c = v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return '#' + [c(r), c(g), c(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// --- a tiny raster with outline + glow passes --------------------------------------
class Raster {
  constructor() { this.d = new Uint8ClampedArray(S * S * 4); this.neon = new Uint8Array(S * S); }
  px(x, y, hex, a = 255, neon = false) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4, [r, g, b] = rgb(hex);
    if (a >= 255) { this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255; }
    else {
      const k = a / 255, ia = this.d[i + 3] / 255;
      this.d[i] = r * k + this.d[i] * (1 - k); this.d[i + 1] = g * k + this.d[i + 1] * (1 - k); this.d[i + 2] = b * k + this.d[i + 2] * (1 - k);
      this.d[i + 3] = Math.min(255, (k + ia * (1 - k)) * 255);
    }
    if (neon) this.neon[y * S + x] = 1;
  }
  rect(x, y, w, h, hex, a, neon) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex, a, neon); }
  // filled ellipse with Ragnarok-style shading (light from top-left)
  blob(cx, cy, rx, ry, hex, shadeIt = true) {
    const lo = mix(hex, 0.72), hi = mix(hex, 1.25);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const l = dx * 0.6 + dy * 0.8;
      this.px(x, y, !shadeIt ? hex : l > 0.42 ? lo : l < -0.62 ? hi : hex);
    }
  }
  // trapezoid (for torsos / dresses / hulls)
  trap(cx, y0, y1, wTop, wBot, hex) {
    const lo = mix(hex, 0.72), hi = mix(hex, 1.2);
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0), w = wTop + (wBot - wTop) * t;
      for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) {
        const rel = (x - (cx - w / 2)) / w;
        this.px(x, y, rel > 0.68 ? lo : rel < 0.18 ? hi : hex);
      }
    }
  }
  line(x0, y0, x1, y1, hex, neon = false) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) this.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), hex, 255, neon);
  }
  alpha(x, y) { return x < 0 || y < 0 || x >= S || y >= S ? 0 : this.d[(y * S + x) * 4 + 3]; }
  outline() {
    const out = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (this.alpha(x, y) > 40) continue;
      if (this.alpha(x - 1, y) > 140 || this.alpha(x + 1, y) > 140 || this.alpha(x, y - 1) > 140 || this.alpha(x, y + 1) > 140) out.push([x, y]);
    }
    for (const [x, y] of out) { const i = (y * S + x) * 4; this.d[i] = OUTLINE[0]; this.d[i + 1] = OUTLINE[1]; this.d[i + 2] = OUTLINE[2]; this.d[i + 3] = 255; }
  }
  glow() {
    const add = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (this.neon[y * S + x]) {
      const i = (y * S + x) * 4;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) {
        if (this.alpha(x + dx, y + dy) < 30) add.push([x + dx, y + dy, this.d[i], this.d[i + 1], this.d[i + 2], Math.abs(dx) + Math.abs(dy) > 1 ? 50 : 110]);
      }
    }
    for (const [x, y, r, g, b, a] of add) {
      if (x < 0 || y < 0 || x >= S || y >= S) continue;
      const j = (y * S + x) * 4;
      if (this.d[j + 3] < a) { this.d[j] = r; this.d[j + 1] = g; this.d[j + 2] = b; this.d[j + 3] = a; }
    }
  }
  glitch(r) { // horizontal tears + chroma split, Cyberpunk-style
    const rows = 2 + Math.floor(r() * 3);
    for (let k = 0; k < rows; k++) {
      const y0 = Math.floor(r() * S), h = 1 + Math.floor(r() * 2), sh = (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 3));
      for (let y = y0; y < Math.min(S, y0 + h); y++) {
        const row = this.d.slice(y * S * 4, (y + 1) * S * 4);
        for (let x = 0; x < S; x++) {
          const sx = x - sh;
          const di = (y * S + x) * 4;
          if (sx < 0 || sx >= S) { this.d[di + 3] = 0; continue; }
          for (let c = 0; c < 4; c++) this.d[di + c] = row[sx * 4 + c];
          if (this.d[di + 3]) { this.d[di] = Math.min(255, this.d[di] + 40); this.d[di + 2] = Math.min(255, this.d[di + 2] + 60); }
        }
      }
    }
  }
}

// --- the sprite ---------------------------------------------------------------------
export function drawPortrait(g, sprite = false) {
  const r = rng(g.seed ^ 0x9e3779b9);
  const pick = a => a[Math.floor(r() * a.length)];
  const T = g.traits || { tags: [] };
  const R = new Raster();
  const neon = pick(NEON), neon2 = pick(NEON.filter(n => n !== neon));
  const hair = T.ice ? '#dff4ff' : pick(HAIR[g.cls]);
  const skin = T.skeleton ? '#eae6d8' : T.shadow && g.cls === 'SHADE' ? '#4a3a5a' : T.ice ? '#e8f4ff' : pick(SKIN);
  const outfit = T.color || OUTFIT[g.cls];
  const eye = g.cls === 'SHADE' || g.cls === 'WRAITH' || T.blood ? pick(['#ff3048', '#ff7020', '#ff2a6d']) : pick(EYES);
  const form = T.form || 'human';

  const cx = 32;
  let hy = T.child ? 25 : 22, hrx = T.child ? 11 : 12, hry = T.child ? 10 : 11;
  if (T.tall && !T.child) hy = 19;
  const bodyTop = hy + hry - 1, bodyBot = Math.min(56, bodyTop + (T.tall ? 20 : T.child ? 12 : 15));

  // ---------- special forms ----------
  if (form === 'ship') { drawShip(R, r, outfit, neon, neon2); return finish(R, g, r, sprite); }
  if (form === 'orb') { drawOrb(R, r, g, neon, eye); return finish(R, g, r, sprite); }
  if (form === 'beast') { drawBeast(R, r, T, outfit, eye, neon); return finish(R, g, r, sprite); }

  // ---------- back layers ----------
  if (T.wings) drawWings(R, cx, bodyTop + 2, T.blood || g.cls === 'SHADE' ? '#2a1830' : '#e8e8f8', neon);
  if (T.fox) for (let k = 0; k < 3; k++) { const a = -0.9 + k * 0.6; for (let i = 0; i < 12; i++) R.blob(cx + 8 + Math.cos(a) * i * 1.1, bodyBot - 4 + Math.sin(a) * i * 1.1, 2.6 - i * 0.12, 2.6 - i * 0.12, i > 8 ? '#ffffff' : '#f0a040'); }
  const longHair = (T.longhair || T.fem || g.cls === 'PHANTOM' || g.cls === 'BANSHEE') && form !== 'headless';
  if (longHair && form !== 'head') {
    const len = Math.min(58, bodyTop + 10 + Math.floor(r() * 8));
    for (let y = hy - 4; y < len; y++) {
      const w = hrx + 2 + Math.min(3, (y - hy) * 0.15);
      R.rect(cx - w, y, w * 2 + 1, 1, y % 6 === 0 ? mix(hair, 1.2) : hair);
    }
    if (T.water) for (let i = 0; i < 4; i++) R.px(cx - hrx + r() * hrx * 2, len + 1 + r() * 3, '#60c8ff', 220, true);
  }
  if (T.chains) for (let i = 0; i < 9; i++) R.rect(6 + i * 2, bodyBot - i, 2, 1, i % 2 ? '#a0a8b0' : '#5a6068');

  // ---------- body ----------
  if (form === 'head') {
    // entrails & organs dangling beneath a floating head
    for (let k = 0; k < 4; k++) {
      let x = cx - 6 + k * 4;
      for (let y = hy + hry - 1; y < 58 - k * 2; y++) { x += Math.round(Math.sin(y * 0.5 + k) * 0.7); R.px(x, y, k % 2 ? '#c8283c' : '#ff6a8a'); R.px(x + 1, y, '#8a1828'); }
      R.blob(cx - 6 + k * 4, 48 + k * 2, 2.5, 2, '#d03050');
    }
    R.line(cx - 10, hy + hry + 3, cx + 10, hy + hry + 3, neon, true); // neon spine-port ring
  } else {
    const robeBottom = T.legless || g.cls === 'SPECTER' || (g.cls === 'PHANTOM' && r() < 0.5) || T.serpent;
    const wTop = T.child ? 10 : 12, wBot = T.fem ? 22 : 16;
    const top = form === 'headless' ? hy + 4 : bodyTop;
    R.trap(cx, top, bodyBot, wTop, wBot, outfit);
    // collar / belt detail
    R.rect(cx - wTop / 2 + 1, top, wTop - 1, 1, mix(outfit, 0.6));
    if (g.realm === 'EAST' || g.cls === 'YOKAI') for (let i = 0; i < 5; i++) { R.px(cx - 3 + i, top + 1 + i, mix(outfit, 0.55)); R.px(cx + 3 - i, top + 1 + i, mix(outfit, 0.55)); }
    R.rect(cx - wTop / 2 - 1, top + 9, wTop + 3, 1, neon, 255, true); // neon belt
    // arms
    const armY = top + 2;
    for (const s of [-1, 1]) {
      const ax = cx + s * (wTop / 2 + 2);
      R.rect(ax - 1, armY, 3, 8, outfit);
      R.blob(ax, armY + 9, 2, 2, T.skeleton ? '#eae6d8' : skin);
      if (s === 1 && (g.cls === 'REVENANT' || g.cls === 'SHADE') && r() < 0.5) R.line(ax + 2, armY + 9, ax + 7, armY - 3, neon2, true); // mantis blade
    }
    // legs / tail
    if (T.serpent) {
      for (let i = 0; i < 16; i++) { const x = cx + Math.round(Math.sin(i * 0.5) * 6) + i * 0.6, y = bodyBot + Math.min(6, i * 0.5); R.blob(x, y, 3.2 - i * 0.12, 2.6, '#4a8a5a'); }
    } else if (robeBottom) {
      for (let y = bodyBot + 1; y < Math.min(62, bodyBot + 7); y++) {
        const w = wBot - (y - bodyBot) * 2.6;
        for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) if ((x + y) % 3) R.px(x, y, outfit, 200 - (y - bodyBot) * 22);
      }
    } else {
      for (const s of [-1, 1]) {
        R.rect(cx + s * 4 - 1, bodyBot + 1, 3, 4, mix(outfit, 0.5));
        const fx = T.backfeet ? cx + s * 4 + (s === -1 ? 0 : -3) : cx + s * 4 - (s === -1 ? 3 : 0);
        R.rect(fx, bodyBot + 5, 4, 2, '#2a2230');
        if (r() < 0.5) R.px(fx + (s === -1 ? 0 : 3), bodyBot + 5, neon, 255, true);
      }
    }
    if (T.shroud) for (let y = top + 1; y < bodyBot; y += 3) R.line(cx - wTop / 2, y, cx + wTop / 2, y + 1, '#d8d4c4');
    if (T.drum) { R.blob(cx + 11, top + 9, 4, 4, '#8a3020'); R.blob(cx + 11, top + 7, 4, 1.5, '#e8dcc0'); }
    if (T.plates) for (let k = 0; k < 3; k++) { const px0 = 4 + r() * 8, py = 10 + r() * 30; R.blob(px0, py, 3, 1.5, '#f0f0f8'); R.px(px0, py, '#3060c0'); }
    if (T.lantern) { const lx = cx - wTop / 2 - 5; R.line(lx + 2, top + 8, lx + 2, top + 11, '#5a5060'); R.blob(lx + 2, top + 14, 2.5, 3, neon, false); R.px(lx + 2, top + 14, '#ffffff', 255, true); }
    if (T.weapon) R.line(cx + wTop / 2 + 3, top - 4, cx + wTop / 2 + 3, bodyBot + 4, neon2, true);
    if (T.umbrella) { R.line(cx - 14, top - 12, cx - 14, top + 10, '#6a4a2a'); R.trap(cx - 14, top - 16, top - 11, 2, 14, '#c83a3a'); }
  }

  // ---------- head ----------
  if (form === 'headless') {
    // neon-sealed neck stump, and the head carried under one arm
    R.blob(cx, hy + 4, 4, 1.5, '#7a1a28');
    R.line(cx - 4, hy + 3, cx + 4, hy + 3, neon, true);
    const hx = cx + 12, hhy = bodyTop + 10;
    R.blob(hx, hhy, 6, 5.5, skin);
    R.rect(hx - 6, hhy - 6, 12, 3, hair);
    R.rect(hx - 3, hhy - 1, 2, 2, '#140c14'); R.rect(hx + 1, hhy - 1, 2, 2, '#140c14');
    R.px(hx - 2, hhy - 1, eye, 255, true); R.px(hx + 2, hhy - 1, eye, 255, true);
  } else {
    const headY = form === 'head' ? hy + 4 : hy;
    if (T.longneck && form !== 'head') { R.rect(cx - 2, headY - 4, 5, 8, skin); }
    // horns (behind hair cap)
    if (T.horns) for (const s of [-1, 1]) for (let i = 0; i < 7; i++) R.rect(cx + s * (hrx - 3 + Math.floor(i / 2)), headY - hry - 1 - i + 3, 2, 1, i > 4 ? neon : '#e8dcc8', 255, i > 4);
    if (T.fox || T.cat) for (const s of [-1, 1]) for (let i = 0; i < 6; i++) R.rect(cx + s * (hrx - 5) - (s < 0 ? 5 - i : 0), headY - hry - 3 + i, 6 - i, 1, i < 2 ? '#ffffff' : hair);
    R.blob(cx, headY, hrx, hry, skin);
    if (T.horsehead) { R.blob(cx, headY + 3, hrx - 3, hry + 2, '#eae6d8'); R.rect(cx - 3, headY + 8, 2, 2, '#140c14'); R.rect(cx + 2, headY + 8, 2, 2, '#140c14'); }
    // face
    const ey = headY + 2;
    if (!T.faceless && !T.horsehead) {
      const style = T.skeleton || g.cls === 'REVENANT' ? 'hollow' : g.cls === 'SHADE' ? 'glow' : r() < 0.15 ? 'closed' : 'anime';
      const eyesX = T.cyclops ? [cx - 2] : [cx - 6, cx + 2];
      for (const ex of eyesX) {
        const w = T.cyclops ? 5 : 4;
        if (style === 'closed') { R.rect(ex, ey + 2, w, 1, '#201018'); continue; }
        R.rect(ex - 1, ey - 1, w + 2, 1, '#140c14');
        if (style === 'hollow') { R.rect(ex, ey, w, 4, '#0a0408'); R.px(ex + 1, ey + 1, eye, 255, true); R.px(ex + 2, ey + 1, eye, 255, true); }
        else if (style === 'glow') { R.rect(ex, ey, w, 3, eye, 255, true); R.rect(ex + 1, ey + 1, w - 2, 1, '#ffffff'); }
        else {
          R.rect(ex, ey, w, 5, '#ffffff'); R.rect(ex + 1, ey, w - 1, 5, eye); R.rect(ex + 1, ey + 3, w - 1, 2, mix(eye, 0.6));
          R.rect(ex + 1, ey + 1, 2, 3, '#0a0610'); R.px(ex + 2, ey + 1, '#ffffff'); R.px(ex + w - 1, ey + 3, '#ffffff');
        }
      }
      if (style === 'anime' && r() < 0.7) { R.rect(cx - 8, ey + 5, 2, 1, '#ff90a8'); R.rect(cx + 6, ey + 5, 2, 1, '#ff90a8'); }
      // mouth
      const my = ey + 7;
      if (T.fangs && (g.cls === 'REVENANT' || T.skeleton || r() < 0.5)) { R.rect(cx - 3, my, 7, 1, '#3a0810'); R.px(cx - 2, my + 1, '#ffffff'); R.px(cx + 2, my + 1, '#ffffff'); }
      else if (g.cls === 'BANSHEE') R.rect(cx - 1, my - 1, 3, 3, '#3a0810');
      else R.rect(cx - 1, my, 3, 1, '#7a3040');
      if (T.tongue) for (let i = 0; i < 6; i++) R.rect(cx, my + 1 + i, 2, 1, '#e04060');
      if (g.cls === 'BANSHEE' || T.water) for (let i = 0; i < 3; i++) { R.px(cx - 5, ey + 5 + i, '#80d0ff'); R.px(cx + 4, ey + 5 + i, '#80d0ff'); }
    } else if (T.faceless) {
      R.line(cx - 4, ey + 1, cx + 4, ey + 1, neon, true); // a single scan-line where the face should be
    }
    if (T.mask) { R.rect(cx - hrx + 3, ey + 5, hrx * 2 - 5, 4, '#f4f4f8'); R.line(cx - hrx + 3, ey + 7, cx + hrx - 3, ey + 7, '#c8c8d0'); }
    // hair cap + bangs
    if (!T.skeleton || r() < 0.4) {
      for (let x = -hrx; x <= hrx; x++) {
        const depth = (longHair ? 6 : 4) + ((x + 20) % 4 === 0 ? 2 : 0) + (Math.abs(x) > hrx - 3 ? 5 : 0) + (g.cls === 'PHANTOM' && Math.abs(x) < 4 ? 3 : 0);
        for (let y = 0; y < depth; y++) {
          const yy = headY - hry + y;
          const dx = x / hrx, dy = (yy + 0.5 - headY) / hry;
          if (dx * dx + dy * dy <= 1.05) R.px(cx + x, yy, y === 1 && x % 3 === 0 ? mix(hair, 1.4) : hair);
        }
      }
    }
    // headwear from Wikipedia traits
    const top = headY - hry;
    if (T.crown) { R.rect(cx - 6, top - 2, 13, 3, '#f0c040'); for (const x of [-6, -2, 2, 6]) R.rect(cx + x, top - 4, 1, 2, '#f0c040'); R.px(cx, top - 1, neon, 255, true); }
    else if (T.helmet) { R.blob(cx, top + 3, hrx + 1, 6, '#7a8090'); R.line(cx - hrx, top + 6, cx + hrx, top + 6, neon, true); }
    else if (T.hat) { R.rect(cx - hrx - 4, top + 2, hrx * 2 + 9, 2, '#2a2030'); R.rect(cx - 6, top - 5, 13, 7, '#2a2030'); R.rect(cx - 6, top - 1, 13, 1, neon, 255, true); }
    else if (T.hood) { for (let x = -hrx - 1; x <= hrx + 1; x++) { const yy = top + Math.round((x * x) / 26); R.px(cx + x, yy, mix(outfit, 0.7)); R.px(cx + x, yy - 1, mix(outfit, 0.55)); R.px(cx + x, yy - 2, mix(outfit, 0.45)); } }
    else if (T.veil) { for (let y = top; y < bodyBot; y++) { R.px(cx - hrx - 2, y, '#eceaf6', 200); R.px(cx + hrx + 2, y, '#eceaf6', 200); } R.rect(cx - hrx, top - 1, hrx * 2 + 1, 2, '#eceaf6', 220); }
    else if (g.cls === 'PHANTOM' && g.realm === 'EAST') { R.rect(cx - 5, top + 2, 11, 2, '#ffffff'); for (let i = 0; i < 3; i++) R.rect(cx - i, top + 1 - i, 1 + i * 2, 1, '#ffffff'); }
    if (T.talisman) { R.rect(cx - 2, top + 1, 5, 12, '#f0d860'); for (let y = 0; y < 9; y += 2) R.rect(cx - 1, top + 2 + y, 3, 1, '#c02020'); }
    if (T.doll) { R.line(cx + 4, ey - 2, cx + 8, ey + 4, '#401018'); }

    // ---------- cyberware (Cyberpunk 2077) ----------
    const mods = [];
    const pool = ['visor', 'cybereye', 'jaw', 'lines', 'phones', 'jack'];
    if (g.cls === 'SPECTER' || g.cls === 'PHANTOM') pool.push('halo', 'halo');
    while (mods.length < 2) { const m = pick(pool); if (!mods.includes(m)) mods.push(m); }
    if (T.faceless || T.horsehead || T.mask) mods[0] = 'phones';
    for (const m of mods) {
      if (m === 'visor') { R.rect(cx - hrx + 2, ey - 1, hrx * 2 - 3, 4, neon, 230, true); R.line(cx - hrx + 3, ey, cx + hrx - 4, ey, '#ffffff'); }
      if (m === 'cybereye') { R.blob(cx + 4, ey + 2, 3.5, 3.5, '#8a909c', false); R.blob(cx + 4, ey + 2, 2, 2, neon2, false); R.px(cx + 4, ey + 2, '#ffffff', 255, true); R.line(cx + 7, ey - 1, cx + hrx - 1, ey - 3, '#8a909c'); }
      if (m === 'jaw') { R.rect(cx - 5, ey + 6, 11, 4, '#9aa0aa'); R.rect(cx - 3, ey + 7, 7, 1, '#3a3a44'); R.rect(cx - 3, ey + 9, 7, 1, '#3a3a44'); R.px(cx + 5, ey + 7, neon, 255, true); }
      if (m === 'lines') { R.line(cx - hrx + 2, ey + 4, cx - 5, ey + 7, neon, true); R.px(cx - 5, ey + 7, '#ffffff'); R.line(cx + hrx - 3, ey + 3, cx + hrx - 3, ey + 7, neon2, true); }
      if (m === 'phones') { for (let x = -hrx; x <= hrx; x++) R.px(cx + x, top - 2 + Math.round((x * x) / (hrx * 3)), '#2a2a34'); for (const s of [-1, 1]) { R.rect(cx + s * hrx - 2, headY - 2, 4, 6, '#2a2a34'); R.rect(cx + s * hrx - 1, headY - 1, 2, 4, neon, 255, true); } }
      if (m === 'jack') { let x = cx - hrx, y = headY + 4; for (let i = 0; i < 10; i++) { x -= 1; y += i % 2; R.px(x, y, '#20202a'); } R.rect(x - 3, y, 3, 2, '#c0c4cc'); R.px(x - 4, y, neon, 255, true); }
      if (m === 'halo') { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; R.px(cx + Math.cos(a) * 9, top - 4 + Math.sin(a) * 2, neon, 255, true); } }
    }
  }
  if (T.fire) for (let k = 0; k < 3; k++) { const fx = r() < 0.5 ? 4 + r() * 8 : 52 + r() * 8, fy = 8 + r() * 36; R.blob(fx, fy, 2, 3, '#ff8a2a', false); R.px(fx, fy - 3, '#ffd040', 255, true); }
  if (T.tree) for (let k = 0; k < 5; k++) R.blob(r() * S, 2 + r() * 10, 2, 1.4, '#3a8a4a', false);
  if (T.ice) for (let k = 0; k < 8; k++) R.px(r() * S, r() * S, '#e8f8ff', 255, true);
  if (T.blood) for (let k = 0; k < 3; k++) { const x = cx - 8 + r() * 16; R.rect(x, hy + hry - 2, 1, 2 + r() * 3, '#c01020'); }
  return finish(R, g, r, sprite);
}

function finish(R, g, r, sprite) {
  R.outline();
  R.glow();
  if (r() < 0.7) R.glitch(r);
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!sprite) drawCard(c, g, r);
  const fig = document.createElement('canvas'); fig.width = fig.height = S;
  fig.getContext('2d').putImageData(new ImageData(R.d, S, S), 0, 0);
  c.drawImage(fig, 0, 0);
  if (!sprite) { // scanlines over the card
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < S; y += 2) c.fillRect(0, y, S, 1);
  }
  return cv;
}

// Cyber HUD card behind the sprite (Codex / Lab views)
function drawCard(c, g, r) {
  const realm = REALMS[g.realm].color;
  c.fillStyle = '#0a0911'; c.fillRect(0, 0, S, S);
  const grd = c.createRadialGradient(32, 26, 2, 32, 30, 40);
  grd.addColorStop(0, realm + '88'); grd.addColorStop(1, 'transparent');
  c.fillStyle = grd; c.fillRect(0, 0, S, S);
  c.fillStyle = 'rgba(0,240,255,0.10)';
  for (let i = 0; i < S; i += 8) { c.fillRect(i, 0, 1, S); c.fillRect(0, i, S, 1); }
  // floor line
  c.fillStyle = 'rgba(252,238,10,0.35)'; c.fillRect(0, 58, S, 1);
  // corner brackets
  c.fillStyle = '#fcee0a';
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [S - 1, 0, -1, 1], [0, S - 1, 1, -1], [S - 1, S - 1, -1, -1]]) {
    for (let i = 0; i < 6; i++) { c.fillRect(x + dx * i, y, 1, 1); c.fillRect(x, y + dy * i, 1, 1); }
  }
  // data barcode
  for (let i = 0; i < 10; i++) if (r() < 0.6) { c.fillStyle = 'rgba(255,42,109,0.8)'; c.fillRect(46 + i, 60, 1, 2); }
}

function drawWings(R, cx, y, col, neon) {
  for (const s of [-1, 1]) for (let i = 0; i < 14; i++) {
    const x = cx + s * (6 + i), h = 12 - Math.abs(i - 6);
    R.rect(x, y - h + 2, 1, h, i % 4 === 0 ? neon : col, 255, i % 4 === 0);
  }
}
function drawShip(R, r, outfit, neon, neon2) {
  const hull = '#3a2a24';
  R.trap(32, 44, 52, 50, 34, hull);
  R.line(8, 44, 56, 44, neon, true);
  for (const [mx, h] of [[22, 30], [36, 34]]) {
    R.rect(mx, 44 - h, 2, h, '#4a3a30');
    for (let y = 44 - h + 3; y < 40; y++) for (let x = mx - 9; x < mx + 11; x++) if ((x * 7 + y * 13) % 11 > 1) R.px(x, y, '#d8d8e4', 170 + ((x + y) % 3) * 20);
    R.px(mx, 44 - h - 1, neon2, 255, true);
  }
  for (let i = 0; i < 6; i++) R.px(12 + i * 7, 48, '#ffd040', 255, true); // portholes
  for (let x = 0; x < 64; x++) R.px(x, 55 + Math.round(Math.sin(x * 0.4) * 1.2), '#2a6aa0', 200);
}
function drawOrb(R, r, g, neon, eye) {
  const col = g.traits.fire ? '#ff8a2a' : neon;
  for (let i = 0; i < 14; i++) R.blob(32 + Math.sin(i * 0.7) * (i * 0.3), 30 - i * 1.6, 9 - i * 0.6, 4, col, false);
  R.blob(32, 34, 12, 12, col);
  R.blob(32, 34, 8, 8, mix(col, 1.4));
  R.rect(27, 33, 3, 4, '#140c14'); R.rect(34, 33, 3, 4, '#140c14');
  R.px(28, 33, '#ffffff'); R.px(35, 33, '#ffffff');
  R.rect(31, 39, 3, 1, '#7a3040');
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; R.px(32 + Math.cos(a) * 17, 34 + Math.sin(a) * 5, eye, 255, true); }
}
function drawBeast(R, r, T, outfit, eye, neon) {
  const col = T.color || (T.cat ? '#3a3040' : '#1a1820');
  R.blob(48, 30, 3, 9, col); // tail
  R.blob(34, 40, 15, 9, col);
  for (const x of [23, 29, 39, 45]) { R.rect(x, 46, 4, 9, mix(col, 0.8)); R.rect(x, 54, 5, 2, '#100c14'); }
  const hx = 20, hy = 30;
  R.blob(hx, hy, 10, 9, col);
  if (T.cat) for (const s of [-1, 1]) for (let i = 0; i < 5; i++) R.rect(hx + s * 5 - (s < 0 ? 4 - i : 0), hy - 13 + i, 5 - i, 1, col);
  else for (const s of [-1, 1]) R.blob(hx + s * 8, hy - 3, 2.5, 5, mix(col, 0.7));
  R.blob(hx - 6, hy + 4, 5, 3.5, mix(col, 1.15)); // snout
  R.px(hx - 10, hy + 3, '#100c14');
  R.rect(hx - 5, hy - 3, 3, 2, eye, 255, true); R.rect(hx + 1, hy - 3, 3, 2, eye, 255, true);
  R.line(24, 36, 44, 36, neon, true); // neon harness
  R.rect(14, 37, 13, 2, '#9aa0aa');
}

const urlCache = new Map();
const cvCache = new Map();
export function portraitCanvas(g, sprite = false) {
  const k = g.id + (sprite ? 's' : '');
  if (!cvCache.has(k)) cvCache.set(k, drawPortrait(g, sprite));
  return cvCache.get(k);
}
export function portraitURL(g) {
  if (!urlCache.has(g.id)) urlCache.set(g.id, portraitCanvas(g).toDataURL());
  return urlCache.get(g.id);
}
export const SPRITE_SIZE = S;
