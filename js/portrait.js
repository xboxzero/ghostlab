// Procedural 48x48 anime pixel portraits. Every ghost gets a unique face from its seed.
import { rng } from './rng.js';
import { REALMS } from './data.js';

const S = 48;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const HAIR = {
  WRAITH: ['#1a1020', '#2a0f18', '#101018', '#3a0a14'],
  BANSHEE: ['#c8d0e0', '#e8e8f0', '#5a6070', '#d04050'],
  POLTERGEIST: ['#e07030', '#40a0e0', '#d0d040', '#a050e0'],
  YOKAI: ['#f0a040', '#e8e8e8', '#60c080', '#e05080'],
  REVENANT: ['#404040', '#6a5040', '#203028', '#80705a'],
  SPECTER: ['#80e0ff', '#b0b0ff', '#e0ffff', '#70ffb0'],
  PHANTOM: ['#0c0c14', '#181018', '#e8e8f0', '#3a2a40'],
  SHADE: ['#200830', '#400818', '#080808', '#502060'],
};
const SKIN = ['#f0e8f4', '#e0f0ec', '#f4e0dc', '#dce4f8', '#e8dcc8'];
const EYES = ['#ff3048', '#40e0ff', '#ffd040', '#b060ff', '#60ff90', '#ff70c0'];
const ROBE = {
  WRAITH: '#2a2030', BANSHEE: '#c8ccd8', POLTERGEIST: '#5a3a70', YOKAI: '#a03030',
  REVENANT: '#5a5448', SPECTER: '#406080', PHANTOM: '#ece8f0', SHADE: '#100810',
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function drawPortrait(g, sprite = false) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const r = rng(g.seed ^ 0x9e3779b9);
  const pick = a => a[Math.floor(r() * a.length)];
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };

  const realmCol = REALMS[g.realm].color;
  const hair = pick(HAIR[g.cls]);
  const skin = pick(SKIN);
  const eye = g.cls === 'SHADE' || g.cls === 'WRAITH' ? pick(['#ff3048', '#ff7020', '#b060ff']) : pick(EYES);
  const robe = ROBE[g.cls];

  // Background: dark dithered aura in realm colour
  const cx = 24, cy = 22;
  if (!sprite) rect(0, 0, S, S, '#07060a');
  if (!sprite) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, (y - cy) * 0.9) / 30;
    const t = BAYER[(y & 3) * 4 + (x & 3)] / 16;
    if (1 - d > t + 0.25) px(x, y, shade(realmCol, 0.28 + (1 - d) * 0.25));
    else if (1 - d > t) px(x, y, shade(realmCol, 0.14));
  }

  // Floating motes
  for (let i = 0; i < 10; i++) px(r() * S, r() * S, r() < 0.5 ? shade(realmCol, 1.3) : '#ffffff');

  // Ghost tail / robe
  const tailSway = r() * 6 - 3;
  for (let y = 33; y < S; y++) {
    const t = (y - 33) / 15;
    const half = 13 - t * 4 + Math.sin(y * 0.6 + r()) * 1.2;
    const off = tailSway * t;
    for (let x = Math.round(cx - half + off); x <= Math.round(cx + half + off); x++) {
      const fade = BAYER[(y & 3) * 4 + (x & 3)] / 16;
      if (t < 0.55 || fade > t - 0.45) px(x, y, (x + y) % 7 === 0 ? shade(robe, 0.8) : robe);
    }
  }
  // Collar
  rect(cx - 9, 32, 19, 2, shade(robe, 0.7));
  if (g.cls === 'PHANTOM' || g.cls === 'YOKAI') { // kimono-style crossed collar
    for (let i = 0; i < 6; i++) { px(cx - 4 + i, 33 + i, shade(robe, 0.55)); px(cx + 4 - i, 33 + i, shade(robe, 0.55)); }
  }

  // Back hair (long)
  const longHair = ['PHANTOM', 'BANSHEE', 'WRAITH'].includes(g.cls) || r() < 0.35;
  if (longHair) {
    const len = 36 + Math.floor(r() * 10);
    for (let y = 12; y < len; y++) {
      const w = 12 + Math.min(4, (y - 12) * 0.3);
      rect(cx - w, y, w * 2 + 1, 1, y % 5 === 0 ? shade(hair, 1.25) : hair);
    }
    // strands
    for (let i = 0; i < 6; i++) { const x = cx - 14 + r() * 28; rect(x, len - 2, 1, 3 + r() * 5, hair); }
  }

  // Neck + head
  rect(cx - 2, 29, 5, 4, shade(skin, 0.85));
  for (let y = -10; y <= 10; y++) for (let x = -9; x <= 9; x++) {
    const chin = y > 3 ? 1 + (y - 3) * 0.16 : 1;
    if ((x * x) / 81 * chin * chin + (y * y) / 110 <= 1) px(cx + x, cy + y, skin);
  }
  // face shadow on one side
  for (let y = -6; y <= 8; y++) px(cx + 8 - Math.max(0, y - 4), cy + y, shade(skin, 0.85));

  // Ears/horns
  if (g.cls === 'YOKAI') {
    for (let i = 0; i < 6; i++) { rect(cx - 9 + Math.floor(i / 2), 8 - i, 6 - i, 1, hair); rect(cx + 4 + Math.ceil(i / 2), 8 - i, 6 - i, 1, hair); }
    px(cx - 6, 6, '#ffb0c0'); px(cx + 7, 6, '#ffb0c0');
  }
  if (g.cls === 'SHADE' && r() < 0.8) {
    const hc = pick(['#e8e0c8', '#b02020', '#303030']);
    for (let i = 0; i < 6; i++) { rect(cx - 8 - Math.floor(i / 3), 10 - i, 2, 1, hc); rect(cx + 7 + Math.floor(i / 3), 10 - i, 2, 1, hc); }
  }

  // Eyes — big anime eyes
  const eyeStyle = g.cls === 'REVENANT' ? 'hollow' : g.cls === 'SHADE' ? 'glow' : r() < 0.18 ? 'closed' : 'anime';
  const eyeY = cy + 1;
  for (const ex of [cx - 6, cx + 2]) {
    if (eyeStyle === 'closed') {
      rect(ex, eyeY + 2, 5, 1, '#201018'); px(ex, eyeY + 1, '#201018'); px(ex + 4, eyeY + 1, '#201018');
      continue;
    }
    rect(ex - 1, eyeY - 1, 7, 1, '#140c14');              // lash line
    px(ex + 5, eyeY - 2, '#140c14');
    if (eyeStyle === 'hollow') {
      rect(ex, eyeY, 5, 5, '#0a0408'); px(ex + 2, eyeY + 2, eye);
    } else if (eyeStyle === 'glow') {
      rect(ex, eyeY, 5, 4, eye); rect(ex + 1, eyeY + 1, 3, 2, '#ffffff');
    } else {
      rect(ex, eyeY, 5, 5, '#ffffff');
      rect(ex + 1, eyeY, 4, 5, eye);
      rect(ex + 1, eyeY + 3, 4, 2, shade(eye, 0.6));
      rect(ex + 2, eyeY + 1, 2, 3, '#0a0610');
      px(ex + 3, eyeY + 1, '#ffffff'); px(ex + 1, eyeY + 3, '#ffffff');
    }
  }
  // Brows for wraiths (angry)
  if (g.cls === 'WRAITH') { for (let i = 0; i < 4; i++) { px(cx - 6 + i, eyeY - 4 + Math.floor(i / 2), hair); px(cx + 6 - i, eyeY - 4 + Math.floor(i / 2), hair); } }
  // Blush
  if (eyeStyle === 'anime' && r() < 0.7) { rect(cx - 7, cy + 7, 2, 1, '#ff90a8'); rect(cx + 5, cy + 7, 2, 1, '#ff90a8'); }
  // Tears for banshees
  if (g.cls === 'BANSHEE') { for (let i = 0; i < 4; i++) { px(cx - 5, eyeY + 5 + i, '#80d0ff'); px(cx + 4, eyeY + 5 + i, '#80d0ff'); } }

  // Mouth
  const my = cy + 8;
  if (g.cls === 'BANSHEE') { rect(cx - 1, my - 1, 3, 3, '#3a0810'); }
  else if (g.cls === 'REVENANT' && r() < 0.4) { rect(cx - 7, my, 15, 1, '#601018'); px(cx - 7, my - 1, '#601018'); px(cx + 7, my - 1, '#601018'); }
  else if (g.cls === 'SHADE') { rect(cx - 2, my, 5, 1, '#200810'); px(cx - 2, my + 1, '#ffffff'); px(cx + 2, my + 1, '#ffffff'); }
  else { rect(cx - 1, my, 3, 1, '#7a3040'); }

  // Front hair / bangs
  const bangStyle = Math.floor(r() * 3);
  for (let x = -10; x <= 10; x++) {
    let depth;
    if (bangStyle === 0) depth = 6 + ((x + 20) % 4 === 0 ? 3 : 0) + (Math.abs(x) > 7 ? 6 : 0);           // spiky
    else if (bangStyle === 1) depth = 7 + (Math.abs(x) > 6 ? 8 : 0);                                       // hime cut
    else depth = 4 + Math.round((x + 10) * 0.45) + (x > 6 ? 4 : 0);                                        // side swept
    if (g.cls === 'PHANTOM' && Math.abs(x) < 5 && r() < 0.6) depth += 3;                                  // hair over face
    for (let y = 0; y < depth; y++) {
      const yy = cy - 11 + y;
      const inside = (x * x) / 110 + ((yy - cy + 1) ** 2) / 140 <= 1.05;
      if (inside) px(cx + x, yy, y === 1 && x % 3 === 0 ? shade(hair, 1.4) : hair);
    }
  }
  // Hair top cap
  for (let x = -8; x <= 8; x++) rect(cx + x, cy - 12 + Math.round(Math.abs(x) * Math.abs(x) / 24), 1, 2, hair);

  // Class accessories
  if (g.cls === 'PHANTOM' && (g.realm === 'EAST')) {                       // hitaikakushi headband
    rect(cx - 6, cy - 9, 13, 2, '#ffffff'); for (let i = 0; i < 3; i++) rect(cx - i, cy - 10 - i, 1 + i * 2, 1, '#ffffff');
  } else if (g.cls === 'PHANTOM' && r() < 0.5) {                           // veil
    for (let y = cy - 13; y < cy + 16; y++) { px(cx - 11 - (y > cy ? 1 : 0), y, '#e8e8f8'); px(cx + 11 + (y > cy ? 1 : 0), y, '#e8e8f8'); }
    rect(cx - 10, cy - 13, 21, 1, '#e8e8f8');
  }
  if (g.cls === 'REVENANT' && (g.realm === 'EAST' || r() < 0.25)) {       // ofuda talisman
    rect(cx - 2, cy - 12, 5, 12, '#f0d860'); for (let y = 0; y < 9; y += 2) rect(cx - 1, cy - 11 + y, 3, 1, '#c02020');
  } else if (g.cls === 'REVENANT') {                                      // stitches
    for (let i = 0; i < 5; i++) { px(cx + 3 + i, cy - 3 + i, '#401018'); px(cx + 3 + i, cy - 2 + i - (i % 2) * 2, '#401018'); }
  }
  if (g.cls === 'SPECTER' || g.cls === 'YOKAI') {                         // hitodama / foxfire
    for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
      const fx = r() < 0.5 ? 3 + r() * 8 : 37 + r() * 8, fy = 6 + r() * 30;
      const fc = pick(['#60c0ff', '#80ffe0', '#c080ff']);
      rect(fx, fy, 3, 3, fc); px(fx + 1, fy - 1, fc); px(fx + 1, fy - 2, fc); px(fx + 1, fy + 1, '#ffffff');
    }
  }
  if (g.cls === 'POLTERGEIST') {                                          // floating plates / sparks
    for (let k = 0; k < 3; k++) { const fx = r() < 0.5 ? 2 + r() * 8 : 38 + r() * 7, fy = 4 + r() * 34; rect(fx, fy, 4, 2, '#e8e8f0'); px(fx + 1, fy, '#4070c0'); }
  }
  if (g.cls === 'WRAITH') {                                               // chains
    for (let i = 0; i < 8; i++) { const x = 4 + i * 2, y = 40 - i; rect(x, y, 2, 1, i % 2 ? '#808890' : '#505860'); }
  }
  if (g.cls === 'BANSHEE' && r() < 0.6) {                                 // cowl
    for (let x = -12; x <= 12; x++) { const y = cy - 13 + Math.round((x * x) / 30); px(cx + x, y, shade(robe, 0.8)); px(cx + x, y - 1, shade(robe, 0.6)); }
  }

  if (sprite) return cv;
  // Frame
  c.strokeStyle = shade(realmCol, 0.6); c.lineWidth = 1; c.strokeRect(0.5, 0.5, S - 1, S - 1);
  px(0, 0, '#07060a'); px(S - 1, 0, '#07060a'); px(0, S - 1, '#07060a'); px(S - 1, S - 1, '#07060a');

  return cv;
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
