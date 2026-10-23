// GHOST LAB — procedural 3D ghosts in a realistic dark-fantasy style.
// Each spirit is built from its class, realm and the traits read from its Wikipedia article:
// flowing lathe-turned gowns with realm textile patterns, strand hair, sculpted heads with
// glowing eyes, tapered limbs, and props (horns, crowns, hoods, veils, wings, tails, chains,
// lanterns, talismans, entrails…). Special forms: floating head, headless, ghost light,
// spectral beast and ghost ship. Feet at y = 0, facing +z, roughly 2 units tall.
import * as THREE from 'three';
import { rng } from './rng.js';
import { REALMS } from './data.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
const lerpHex = (a, b, t) => '#' + C(a).lerp(C(b), t).getHexString();

const SKINS = ['#f2d6c4', '#e8c0a4', '#d6a283', '#b07a56', '#8a5a3c', '#6a4430'];
const HAIRS = {
  WRAITH: ['#141018', '#2a1a1a', '#1a2030', '#3a3a44'], BANSHEE: ['#e8e6ee', '#b8bcc8', '#7a7f8a', '#d8d4dc'],
  POLTERGEIST: ['#6a2a18', '#c8a060', '#3a2418', '#8a1a1a'], YOKAI: ['#141018', '#e8e6ee', '#b06a2a', '#8a1a1a'],
  REVENANT: ['#3a3a3a', '#4a3a2a', '#6a6a60', '#2a2420'], SPECTER: ['#dfe8f4', '#a8c8e8', '#e8e6ee', '#90b0d0'],
  PHANTOM: ['#0e0c12', '#141018', '#e8e6ee', '#24182a'], SHADE: ['#0c0a10', '#2a1030', '#141018', '#3a1420'],
};
const OUTFIT = {
  WRAITH: '#2e2838', BANSHEE: '#8a8f9a', POLTERGEIST: '#5a3a7a', YOKAI: '#a8323a',
  REVENANT: '#4e4838', SPECTER: '#86b4e0', PHANTOM: '#efebf2', SHADE: '#1a1422',
};
const EYE = {
  WRAITH: '#ff3040', SHADE: '#ff2a50', SPECTER: '#80ffff', PHANTOM: '#c8ecff', BANSHEE: '#9fd0ff',
  REVENANT: '#ffb030', YOKAI: '#ffcc30', POLTERGEIST: '#c070ff',
};
const ETHEREAL = new Set(['PHANTOM', 'SPECTER', 'BANSHEE', 'WRAITH']);

// --- shared textures -------------------------------------------------------------------
const texCache = {};
function patternTex(realm) {
  if (texCache[realm]) return texCache[realm];
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S);
  c.strokeStyle = c.fillStyle = 'rgba(0,0,0,0.11)'; c.lineWidth = 1.5;
  switch (realm) {
    case 'EAST': for (let y = 0; y < S + 16; y += 16) for (let x = 0; x < S + 32; x += 32) for (let k = 3; k > 0; k--) { c.beginPath(); c.arc(x + (y / 16 % 2) * 16, y, k * 5, Math.PI, 0); c.stroke(); } break;
    case 'SEA': for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { c.beginPath(); c.arc(x + 8, y + 8, 4, 0, 7); c.fill(); c.fillRect(x, y, 2, 2); } for (let i = -S; i < S; i += 24) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S, S); c.stroke(); } break;
    case 'SOUTH': for (let x = 0; x < S; x += 32) { c.fillRect(x, 0, 6, S); c.fillRect(x + 10, 0, 2, S); } for (let y = 8; y < S; y += 16) for (let x = 20; x < S; x += 32) { c.beginPath(); c.ellipse(x, y, 3, 6, 0.5, 0, 7); c.fill(); } break;
    case 'MIDEAST': for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) { c.save(); c.translate(x + 16, y + 16); for (let k = 0; k < 2; k++) { c.rotate(Math.PI / 4); c.strokeRect(-9, -9, 18, 18); } c.restore(); } break;
    case 'AFRICA': for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) { if ((x + y) / 32 % 2) for (let i = 0; i < 32; i += 6) c.fillRect(x + i, y, 3, 32); else for (let i = 0; i < 32; i += 6) c.fillRect(x, y + i, 32, 3); } break;
    case 'EUROPE': for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { c.beginPath(); c.moveTo(x + 8, y); c.lineTo(x + 16, y + 8); c.lineTo(x + 8, y + 16); c.lineTo(x, y + 8); c.closePath(); c.stroke(); } break;
    case 'AMERICAS': for (let y = 0; y < S; y += 16) { c.beginPath(); for (let x = 0; x <= S; x += 8) c.lineTo(x, y + ((x / 8) % 2 ? 0 : 8)); c.stroke(); } for (let x = 0; x < S; x += 32) c.fillRect(x, 0, 3, S); break;
    default: for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { c.beginPath(); c.moveTo(x, y + 16); c.lineTo(x + 8, y); c.lineTo(x + 16, y + 16); c.closePath(); if ((x + y) / 16 % 2) c.fill(); else c.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[realm] = t);
}
function glowTex() {
  if (texCache.glow) return texCache.glow;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return (texCache.glow = new THREE.CanvasTexture(cv));
}
function talismanTex() {
  if (texCache.tal) return texCache.tal;
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#e8d070'; c.fillRect(0, 0, 32, 96);
  c.fillStyle = '#a01818'; for (let y = 10; y < 90; y += 14) { c.fillRect(8, y, 16, 3); c.fillRect(14, y - 4, 4, 10); }
  return (texCache.tal = new THREE.CanvasTexture(cv));
}

// --- geometry helpers --------------------------------------------------------------------
// A tube whose radius follows taper(t) along the path (t = 0 → 1)
function taperTube(points, r0, r1, segs = 16, radial = 7, taper = null) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, ctr = curve.getPointAt(t);
    const r = taper ? taper(t) : r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const v = V3(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(ctr).multiplyScalar(r).add(ctr);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
// A lathe-turned garment with cloth folds, a ragged hem, and optional fade-out at the bottom
function gown(profile, { folds = 9, fold = 0.025, ragged = 0, fade = 0, seed = 1 } = {}) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 56);
  const pos = geo.attributes.position, n = pos.count;
  const top = Math.max(...profile.map(p => p[1])), bot = Math.min(...profile.map(p => p[1]));
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x), h = (y - bot) / (top - bot);
    const k = 1 + Math.sin(a * folds + seed) * fold * (1 - h) * 6 + Math.sin(a * (folds * 2 + 1) + seed * 2) * fold * (1 - h) * 2;
    x *= k; z *= k;
    if (ragged && h < 0.12) y -= ragged * (0.5 + 0.5 * Math.sin(a * 7 + seed)) * (1 - h / 0.12) * (0.6 + 0.4 * Math.sin(a * 23));
    pos.setXYZ(i, x, y, z);
    const alpha = fade ? Math.min(1, Math.max(0, (h - 0.02) / fade)) : 1;
    col.set([1, 1, 1, alpha], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.computeVertexNormals();
  return geo;
}
// Sculpted head: tapered jaw, flatter back
function headGeo(r) {
  const geo = new THREE.SphereGeometry(r, 40, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    y *= 1.12;
    if (y < 0) { const k = 1 - 0.28 * (-y / (r * 1.12)); x *= k; z *= k * 0.98; }
    if (z < 0) z *= 0.92;
    if (z > 0 && Math.abs(y) < r * 0.3) z *= 1.04; // cheekbones / brow
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// --- the builder ------------------------------------------------------------------------
export function buildGhost(g) {
  const r = rng(g.seed ^ 0x51ed270b);
  const pick = a => a[Math.floor(r() * a.length)];
  const T = g.traits || { tags: [] };
  const form = T.form || 'human';
  const root = new THREE.Group();
  const disposables = [];
  const add = (geo, mat, parent = root) => { const m = new THREE.Mesh(geo, mat); parent.add(m); disposables.push(geo); return m; };
  const M = (o, phys = false) => { const m = phys ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
  const glow = hex => { const m = new THREE.MeshBasicMaterial({ color: C(hex).multiplyScalar(1.6), toneMapped: false }); disposables.push(m); return m; };

  const realm = REALMS[g.realm].color;
  const ethereal = ETHEREAL.has(g.cls) || T.legless;
  let skin = pick(SKINS);
  if (ethereal) skin = lerpHex(skin, '#d4dcea', 0.5);
  if (g.cls === 'REVENANT') skin = lerpHex(skin, '#8a9476', 0.55);
  if (g.cls === 'SHADE' || T.shadow) skin = lerpHex(skin, '#3a3048', 0.6);
  if (T.ice) skin = lerpHex(skin, '#dff0ff', 0.6);
  const boneHex = '#e6e0cc';
  const hair = T.ice ? '#eef6ff' : pick(HAIRS[g.cls]);
  const base = OUTFIT[g.cls];
  // every spirit gets its own shade: class colour pulled toward its realm, with a little jitter
  const outfit = T.color ? lerpHex(T.color, realm, 0.12) : (() => {
    const b = {}, rr = {}; C(base).getHSL(b); C(realm).getHSL(rr);
    const sat = Math.min(0.75, b.s * 0.5 + 0.18 + r() * 0.15);
    return '#' + new THREE.Color().setHSL(r() < 0.3 ? b.h : rr.h + (r() - 0.5) * 0.06, sat, Math.max(0.05, b.l + (r() - 0.5) * 0.08)).getHexString();
  })();
  const eyeHex = T.fire ? '#ff8a2a' : T.blood ? '#ff2a3a' : EYE[g.cls];

  const skinMat = M({ color: T.skeleton ? boneHex : skin, roughness: 0.55, emissive: C(T.skeleton ? boneHex : skin).multiplyScalar(ethereal ? 0.16 : 0.05) });
  const hairMat = M({ color: hair, roughness: 0.42, sheen: 0.6, sheenColor: C(hair).lerp(C('#ffffff'), 0.4), sheenRoughness: 0.35, side: THREE.DoubleSide }, true);
  const clothMat = M({
    color: outfit, map: patternTex(g.realm), roughness: T.water ? 0.35 : 0.82, sheen: 0.45, sheenColor: C(outfit).lerp(C('#ffffff'), 0.18), envMapIntensity: 0.35,
    side: THREE.DoubleSide, vertexColors: true, transparent: ethereal, opacity: ethereal ? 0.9 : 1,
    emissive: C(g.cls === 'SPECTER' ? outfit : '#000000').multiplyScalar(0.35),
  }, true);
  const sleeveMat = M({
    color: outfit, map: patternTex(g.realm), roughness: 0.82, sheen: 0.45, sheenColor: C(outfit).lerp(C('#ffffff'), 0.18), envMapIntensity: 0.35, side: THREE.DoubleSide,
    transparent: ethereal, opacity: ethereal ? 0.9 : 1, emissive: C(g.cls === 'SPECTER' ? outfit : '#000000').multiplyScalar(0.35),
  }, true);
  const darkMat = M({ color: '#120c10', roughness: 0.9 });
  const metalMat = M({ color: '#9aa0aa', metalness: 1, roughness: 0.32 });
  const goldMat = M({ color: '#e0b040', metalness: 1, roughness: 0.25 });
  const eyeGlow = glow(eyeHex);
  const bodyScale = T.child ? 0.78 : T.tall ? 1.12 : 1;

  // ---------- special forms ----------
  if (form === 'ship') { buildShip(root, add, M, glow, r, realm); return finish(); }
  if (form === 'orb') { buildOrb(root, add, glow, T, realm, r); return finish(); }
  if (form === 'beast') { buildBeast(root, add, M, glow, T, eyeHex, g); return finish(); }

  const body = new THREE.Group(); root.add(body);
  const headR = T.child ? 0.155 : 0.145;
  let headPos = V3(0, 1.82, 0.01);
  if (T.longneck) headPos = V3(0.05, 2.12, 0.04);
  const fem = !!T.fem;

  // ---------- body ----------
  if (form !== 'head') {
    const floorLen = ethereal || fem || T.serpent || g.cls === 'YOKAI' || g.cls === 'SHADE';
    const hem = floorLen ? 0.02 : 0.52;
    const flare = fem ? 0.46 : 0.36;
    const profile = [
      [flare, hem], [flare * 0.86, hem + 0.25], [fem ? 0.27 : 0.25, 0.92], [0.17, 1.12], [fem ? 0.2 : 0.21, 1.3], [0.205, 1.44], [0.16, 1.55], [0.075, 1.62], [0.06, 1.66],
    ];
    if (T.serpent) profile.splice(0, 2, [0.22, 0.72], [0.2, 0.85]);
    const fade = (ethereal && !T.serpent) ? 0.35 : 0;
    const robe = add(gown(profile, { folds: 8 + Math.floor(r() * 5), fold: 0.022, ragged: g.cls === 'WRAITH' || g.cls === 'BANSHEE' ? 0.12 : 0.03, fade, seed: r() * 6 }), clothMat, body);
    robe.renderOrder = 1;
    // shoulders
    for (const s of [-1, 1]) { const sh = add(new THREE.SphereGeometry(0.075, 20, 14), sleeveMat, body); sh.position.set(s * 0.17, 1.5, -0.005); sh.scale.set(1.1, 0.8, 1); }
    // kimono collar & obi for East / Yokai, sash elsewhere
    if (g.realm === 'EAST' || g.cls === 'YOKAI') {
      const obi = add(new THREE.CylinderGeometry(0.185, 0.18, 0.13, 40, 1, true), M({ color: pick(['#c8a040', '#8a1a2a', '#2a3a6a', '#e8e0d0']), roughness: 0.6, side: THREE.DoubleSide }), body); obi.position.y = 1.16;
      for (const s of [-1, 1]) { const col = add(new THREE.BoxGeometry(0.03, 0.26, 0.012), M({ color: '#f4f0ea', roughness: 0.7 }), body); col.position.set(s * 0.04, 1.45, 0.185); col.rotation.z = s * 0.45; }
    } else {
      const belt = add(new THREE.TorusGeometry(0.175, 0.012, 8, 40), g.cls === 'REVENANT' ? metalMat : M({ color: '#3a2a1a', roughness: 0.6 }), body); belt.rotation.x = Math.PI / 2; belt.position.y = 1.13;
      // a realm-coloured sash across the chest
      const sash = add(new THREE.TorusGeometry(0.22, 0.018, 6, 40), M({ color: realm, roughness: 0.5, metalness: 0.15, emissive: C(realm).multiplyScalar(0.15) }), body);
      sash.position.set(0, 1.33, 0); sash.rotation.set(Math.PI / 2, 0.55 * (r() < 0.5 ? 1 : -1), 0); sash.scale.set(1, 0.95, 1);
    }
    if (T.shroud) for (let i = 0; i < 6; i++) { const b = add(new THREE.TorusGeometry(0.2 + i * 0.02, 0.01, 6, 32), M({ color: '#d8d0bc', roughness: 0.9 }), body); b.rotation.x = Math.PI / 2 + (r() - 0.5) * 0.3; b.position.y = 0.4 + i * 0.16; }
    if (T.helmet && !T.shroud) { // pauldrons for soldiers and warriors
      for (const s of [-1, 1]) { const pd = add(new THREE.SphereGeometry(0.09, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), metalMat, body); pd.position.set(s * 0.18, 1.52, 0); pd.scale.set(1.2, 0.7, 1.1); }
    }
    // legs & feet when the gown is short
    if (!floorLen) {
      for (const s of [-1, 1]) {
        add(taperTube([V3(s * 0.08, 0.62, 0), V3(s * 0.085, 0.32, 0.01), V3(s * 0.08, 0.06, 0)], 0.055, 0.04, 8, 8), M({ color: '#2a2420', roughness: 0.8 }), body);
        const boot = add(new THREE.BoxGeometry(0.09, 0.07, 0.17), M({ color: '#1a1410', roughness: 0.5 }), body);
        boot.position.set(s * 0.08, 0.035, T.backfeet ? -0.04 : 0.04);
      }
    }
    // serpent tail instead of legs
    if (T.serpent) {
      const pts = []; for (let i = 0; i <= 14; i++) { const a = i * 0.55; pts.push(V3(Math.cos(a) * (0.12 + i * 0.02), 0.78 - i * 0.05, Math.sin(a) * (0.12 + i * 0.02))); }
      add(taperTube(pts, 0.17, 0.02, 60, 12), M({ color: '#3a6a46', roughness: 0.35, metalness: 0.1 }), body);
    }
    // arms
    const limp = g.cls === 'PHANTOM' || (g.cls === 'BANSHEE' && r() < 0.5);
    const armCol = T.skeleton ? boneHex : skin;
    for (const s of [-1, 1]) {
      const sh = V3(s * 0.2, 1.48, 0);
      const el = limp ? V3(s * 0.21, 1.22, 0.16) : V3(s * 0.27, 1.2, 0.04);
      const wr = limp ? V3(s * 0.13, 1.18, 0.38) : V3(s * 0.25 + (s > 0 && (T.weapon || T.lantern) ? 0.05 : 0), 0.95, 0.14);
      // sleeve (wide for kimono / robes)
      const wide = g.realm === 'EAST' || g.cls === 'YOKAI' || g.cls === 'PHANTOM';
      add(taperTube([sh, el, wr.clone().lerp(el, 0.15)], 0.065, wide ? 0.12 : 0.07, 12, 10), sleeveMat, body);
      add(taperTube([el.clone().lerp(wr, 0.5), wr], 0.028, 0.024, 4, 8), M({ color: armCol, roughness: 0.55 }), body);
      const hand = add(new THREE.SphereGeometry(0.035, 14, 10), skinMat, body);
      hand.position.copy(wr).add(limp ? V3(0, -0.035, 0.03) : V3(0, -0.03, 0.01)); hand.scale.set(0.8, 1.25, 0.6);
      if (limp) for (let f = 0; f < 4; f++) add(taperTube([hand.position.clone().add(V3((f - 1.5) * 0.012, -0.02, 0.01)), hand.position.clone().add(V3((f - 1.5) * 0.014, -0.09, 0.02))], 0.007, 0.004, 3, 5), skinMat, body);
      if (s > 0) root.userData.hand = hand.position.clone();
    }
    // neck
    if (form !== 'headless') {
      const neckTop = headPos.y - 0.1;
      add(taperTube([V3(0, 1.58, 0), V3(headPos.x * 0.5, (1.58 + neckTop) / 2, 0.005), V3(headPos.x, neckTop, 0.01)], 0.05, 0.045, 6, 12), skinMat, body);
    } else {
      const stump = add(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 16), M({ color: '#5a1018', roughness: 0.3 }), body); stump.position.y = 1.64;
      const ember = add(new THREE.CircleGeometry(0.045, 16), glow('#ff5a20'), body); ember.rotation.x = -Math.PI / 2; ember.position.y = 1.661;
    }
  }

  // ---------- head ----------
  const head = new THREE.Group();
  if (form === 'headless') {
    head.position.copy((root.userData.hand || V3(0.28, 0.95, 0.15)).clone().add(V3(0.02, 0.06, 0.06)));
    head.scale.setScalar(0.85); head.rotation.set(0.2, -0.4, 0.3);
  } else if (form === 'head') {
    head.position.set(0, 1.55, 0);
  } else head.position.copy(headPos);
  root.add(head);
  buildHead(head, { add, M, glow, r, T, g, skinMat, hairMat, darkMat, eyeGlow, metalMat, goldMat, clothMat: sleeveMat, headR, fem, skin, hair });

  if (form === 'head') { // Krasue / Penanggalan: entrails beneath a floating head
    const gut = M({ color: '#9a1e2e', roughness: 0.22, metalness: 0.05, emissive: C('#3a0408') }, true);
    for (let k = 0; k < 7; k++) {
      const pts = [V3(0, 1.42, 0)];
      for (let i = 1; i <= 6; i++) pts.push(V3(Math.sin(i * 1.3 + k) * 0.08 + (k - 3) * 0.025, 1.42 - i * 0.12 - k * 0.02, Math.cos(i + k) * 0.06));
      add(taperTube(pts, 0.03, 0.012, 30, 8), gut);
    }
    for (const [x, y, s] of [[0.04, 1.28, 0.06], [-0.05, 1.2, 0.05], [0.01, 1.08, 0.045]]) { const o = add(new THREE.SphereGeometry(s, 16, 12), gut); o.position.set(x, y, 0.02); o.scale.y = 1.3; }
    const aura = add(new THREE.SphereGeometry(0.03, 8, 8), glow('#ff4a60')); aura.position.set(0, 1.25, 0.05);
  }

  // ---------- props & extras from Wikipedia traits ----------
  const hand = root.userData.hand || V3(0.28, 0.95, 0.15);
  if (T.wings) {
    const bat = g.cls === 'SHADE' || T.blood || T.shadow;
    const wm = M({ color: bat ? '#2a1a26' : '#f2f0f6', roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: bat ? 0.95 : 0.9 });
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.bezierCurveTo(0.3, 0.35, 0.65, 0.55, 0.9, 0.5);
      if (bat) { for (let i = 0; i < 4; i++) sh.quadraticCurveTo(0.8 - i * 0.18, 0.25 - i * 0.05, 0.72 - i * 0.2, -0.05 - i * 0.04); sh.lineTo(0, -0.1); }
      else sh.bezierCurveTo(0.8, 0.2, 0.5, -0.25, 0, -0.15);
      const w = add(new THREE.ShapeGeometry(sh, 16), wm);
      w.position.set(s * 0.06, 1.42, -0.16); w.rotation.set(0, s > 0 ? -0.5 : Math.PI + 0.5, 0.15 * s);
    }
  }
  if (T.fox) {
    const fur = M({ color: '#d88a3a', roughness: 0.9 }), tip = M({ color: '#f4f0ea', roughness: 0.9 });
    const n = g.name.match(/nine|gumiho|tamamo/i) ? 9 : 3;
    for (let k = 0; k < n; k++) {
      const a = (k / Math.max(1, n - 1) - 0.5) * 2.2;
      const pts = [V3(0, 1.0, -0.18), V3(Math.sin(a) * 0.35, 0.85, -0.42), V3(Math.sin(a) * 0.7, 1.15, -0.5), V3(Math.sin(a) * 0.82, 1.55, -0.45)];
      add(taperTube(pts, 0.02, 0.02, 18, 9, t => 0.015 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.045), fur);
      const tp = add(new THREE.SphereGeometry(0.032, 10, 8), tip); tp.position.copy(pts[3]); tp.scale.y = 1.5;
    }
  }
  if (T.chains) for (let i = 0; i < 9; i++) { const l = add(new THREE.TorusGeometry(0.025, 0.007, 6, 12), metalMat); l.position.set(-0.25 - i * 0.012, 0.92 - i * 0.045, 0.12); l.rotation.y = i % 2 ? Math.PI / 2 : 0; }
  if (T.lantern) {
    const lg = new THREE.Group(); lg.position.copy(hand).add(V3(0, -0.14, 0.02)); root.add(lg);
    add(new THREE.BoxGeometry(0.08, 0.1, 0.08), M({ color: '#3a2a1a', metalness: 0.6, roughness: 0.4, wireframe: true }), lg);
    add(new THREE.SphereGeometry(0.03, 12, 10), glow('#ffcf70'), lg);
    const gl = new THREE.PointLight('#ffb050', 1.2, 1.2, 2); lg.add(gl);
  }
  if (T.weapon) {
    const scythe = /scythe|ankou|death/i.test(g.lore + g.name);
    const shaft = add(new THREE.CylinderGeometry(0.012, 0.012, scythe ? 1.9 : 0.9, 8), M({ color: '#3a2a1e', roughness: 0.7 }));
    shaft.position.copy(hand).add(V3(0, scythe ? 0.25 : 0.1, 0));
    const blade = add(scythe ? new THREE.TorusGeometry(0.28, 0.02, 4, 24, Math.PI * 0.7) : new THREE.BoxGeometry(0.04, 0.55, 0.006), metalMat);
    blade.position.copy(shaft.position).add(V3(scythe ? -0.2 : 0, scythe ? 0.85 : 0.6, 0));
    if (scythe) blade.rotation.z = Math.PI * 0.55;
  }
  if (T.drum) { const d = add(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 24), M({ color: '#7a2a1a', roughness: 0.6 })); d.position.set(-0.32, 1.05, 0.08); d.rotation.z = 1.2; }
  if (T.umbrella) {
    const u = add(new THREE.ConeGeometry(0.45, 0.2, 16, 1, true), M({ color: '#a83030', roughness: 0.7, side: THREE.DoubleSide }));
    u.position.copy(hand).add(V3(0, 0.95, 0));
    const st = add(new THREE.CylinderGeometry(0.01, 0.01, 1, 6), M({ color: '#5a4030' })); st.position.copy(hand).add(V3(0, 0.45, 0));
  }
  if (T.plates || g.cls === 'POLTERGEIST') {
    const pm = M({ color: '#f2f2f6', roughness: 0.25, metalness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const p = add(T.plates ? new THREE.CylinderGeometry(0.09, 0.07, 0.015, 24) : new THREE.BoxGeometry(0.07, 0.07, 0.07), T.plates ? pm : M({ color: pick(['#6a4a2a', '#8a8f9a', '#4a3a6a']), roughness: 0.6 }));
      p.position.set((r() < 0.5 ? -1 : 1) * (0.42 + r() * 0.2), 1.0 + r() * 0.9, (r() - 0.5) * 0.4); p.rotation.set(r() * 3, r() * 3, r() * 3);
    }
  }
  if (T.fire) for (let i = 0; i < 5; i++) {
    const f = add(new THREE.ConeGeometry(0.05, 0.16, 10), glow(pick(['#ff8a2a', '#ffcf40', '#ff5a20'])));
    f.position.set((r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.25), 0.9 + r() * 1.1, (r() - 0.5) * 0.4);
  }
  if (T.ice) for (let i = 0; i < 6; i++) {
    const c = add(new THREE.OctahedronGeometry(0.04 + r() * 0.03), M({ color: '#cfefff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8 }));
    c.position.set((r() - 0.5) * 1.1, 0.3 + r() * 1.8, (r() - 0.5) * 0.5); c.scale.y = 2;
  }
  if (T.water) for (let i = 0; i < 6; i++) { const d = add(new THREE.SphereGeometry(0.012, 8, 6), M({ color: '#9fd8ff', roughness: 0.05, transparent: true, opacity: 0.8 })); d.position.set((r() - 0.5) * 0.5, 0.3 + r() * 1.4, 0.15 + r() * 0.1); d.scale.y = 1.8; }
  if (T.tree) for (let i = 0; i < 8; i++) { const lf = add(new THREE.CircleGeometry(0.04, 5), M({ color: pick(['#3a7a3a', '#5a8a2a', '#2a5a2a']), side: THREE.DoubleSide, roughness: 0.8 })); lf.position.set((r() - 0.5) * 1.0, 0.6 + r() * 1.6, (r() - 0.5) * 0.5); lf.rotation.set(r() * 3, r() * 3, 0); lf.scale.y = 1.8; }

  // spirit motes
  for (let i = 0; i < 7; i++) {
    const w = add(new THREE.SphereGeometry(0.012 + r() * 0.012, 8, 6), glow(i % 2 ? realm : eyeHex));
    w.position.set((r() - 0.5) * 1.2, 0.4 + r() * 1.8, (r() - 0.5) * 0.6);
  }
  root.scale.setScalar(bodyScale);
  return finish();

  function finish() {
    // soft halo behind the figure in its realm colour
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: realm, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    disposables.push(halo.material);
    const box = new THREE.Box3().setFromObject(root);
    const ctr = box.getCenter(V3()), size = box.getSize(V3());
    halo.position.set(ctr.x, ctr.y, ctr.z - 0.6); halo.scale.set(size.y * 1.1, size.y * 1.1, 1); halo.renderOrder = -1;
    root.add(halo);
    root.userData.form = form;
    root.userData.longneck = !!T.longneck;
    root.userData.dispose = () => { disposables.forEach(d => d.dispose && d.dispose()); };
    return root;
  }
}

function buildHead(head, k) {
  const { add, M, glow, r, T, g, skinMat, hairMat, darkMat, eyeGlow, metalMat, goldMat, clothMat, headR, fem, hair } = k;
  const pick = a => a[Math.floor(r() * a.length)];
  const R = headR;
  add(headGeo(R), skinMat, head);
  if (T.horsehead) { const s = add(new THREE.ConeGeometry(R * 0.7, R * 2.4, 16), M({ color: '#e6e0cc', roughness: 0.6 }), head); s.rotation.x = Math.PI / 2 + 0.25; s.position.set(0, -0.02, R * 1.3); }
  // ears
  for (const s of [-1, 1]) {
    const pointy = g.cls === 'YOKAI' || g.cls === 'SHADE' || T.fox || T.cat;
    const e = add(pointy ? new THREE.ConeGeometry(0.022, 0.08, 8) : new THREE.SphereGeometry(0.028, 10, 8), skinMat, head);
    e.position.set(s * R * 0.98, 0.0, -0.01); if (pointy) e.rotation.z = -s * 1.1; else e.scale.set(0.45, 1, 0.8);
  }
  // face
  const fz = R * 0.93;
  if (!T.faceless && !T.horsehead) {
    const eyes = T.cyclops ? [0] : [-1, 1];
    for (const s of eyes) {
      const x = s * R * 0.36, big = T.cyclops ? 1.7 : 1;
      const ez = R * 0.86; // eyeball centre sits just under the skin so it shows through
      const sock = add(new THREE.SphereGeometry(0.03 * big, 16, 12), T.skeleton || g.cls === 'REVENANT' ? darkMat : M({ color: '#f6f4f2', roughness: 0.2 }), head);
      sock.position.set(x, R * 0.1, ez); sock.scale.set(1.3, 0.85, 0.9);
      const iris = add(new THREE.SphereGeometry(0.016 * big, 14, 12), eyeGlow, head); iris.position.set(x, R * 0.1, ez + 0.022 * big);
      const pupil = add(new THREE.SphereGeometry(0.007 * big, 10, 8), darkMat, head); pupil.position.set(x, R * 0.1, ez + 0.03 * big);
      if (!T.skeleton) { // upper lid + lash line
        const lid = add(new THREE.SphereGeometry(0.034 * big, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), skinMat, head);
        lid.position.set(x, R * 0.11, ez - 0.002); lid.scale.set(1.3, 0.85, 0.95); lid.rotation.x = g.cls === 'WRAITH' ? 0.45 : 0.22;
        const lash = add(new THREE.TorusGeometry(0.03 * big, 0.003, 4, 16, Math.PI), darkMat, head);
        lash.position.set(x, R * 0.11, ez + 0.012); lash.scale.set(1.3, 0.7, 1);
      }
      const brow = add(new THREE.BoxGeometry(0.05 * big, 0.008, 0.012), M({ color: hair, roughness: 0.6 }), head);
      brow.position.set(x, R * 0.38, R * 0.96); brow.rotation.z = (g.cls === 'WRAITH' || g.cls === 'SHADE') ? s * 0.35 : -s * 0.12;
    }
    const nose = add(new THREE.ConeGeometry(0.014, 0.045, 8), skinMat, head); nose.position.set(0, -R * 0.1, R * 1.03); nose.rotation.x = Math.PI / 2 + 0.6;
    if (T.skeleton) { nose.visible = false; const nh = add(new THREE.ConeGeometry(0.012, 0.03, 3), darkMat, head); nh.position.set(0, -R * 0.08, fz * 0.97); nh.rotation.x = Math.PI; }
    const wail = g.cls === 'BANSHEE';
    const mouth = add(new THREE.SphereGeometry(wail ? 0.022 : 0.018, 12, 8), wail ? darkMat : M({ color: '#7a3a3e', roughness: 0.4 }), head);
    mouth.position.set(0, -R * 0.44, R * 0.9); mouth.scale.set(wail ? 1 : 1.6, wail ? 1.6 : 0.35, 0.5);
    if (T.fangs || g.cls === 'SHADE') for (const s of [-1, 1]) { const f = add(new THREE.ConeGeometry(0.005, 0.02, 6), M({ color: '#f4f2ea' }), head); f.position.set(s * 0.012, -R * 0.48, fz * 0.92); f.rotation.x = Math.PI; }
    if (T.tongue) add(taperTube([V3(0, -R * 0.45, fz * 0.92), V3(0, -R * 0.9, fz * 1.05), V3(0.01, -R * 1.8, fz * 1.0)], 0.012, 0.008, 10, 8), M({ color: '#c0405a', roughness: 0.25 }, true), head);
    if (T.blood) { const d = add(taperTube([V3(0.01, -R * 0.5, fz * 0.92), V3(0.012, -R * 0.75, fz * 0.88)], 0.006, 0.003, 4, 6), M({ color: '#8a0a14', roughness: 0.15 }), head); d.renderOrder = 2; }
    if (g.cls === 'BANSHEE' || T.water) for (const s of [-1, 1]) add(taperTube([V3(s * R * 0.36, R * 0.02, fz * 0.92), V3(s * R * 0.38, -R * 0.5, fz * 0.86)], 0.004, 0.002, 4, 5), M({ color: '#bfe8ff', roughness: 0.05, transparent: true, opacity: 0.7 }), head);
  }
  if (T.mask) { const m = add(new THREE.SphereGeometry(R * 1.02, 24, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.55, Math.PI * 0.3), M({ color: '#f4f2f0', roughness: 0.4, side: THREE.DoubleSide }), head); m.position.z = 0.004; }

  // hair
  if (!T.skeleton || r() < 0.5) {
    const cap = add(new THREE.SphereGeometry(R * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat, head);
    cap.rotation.x = -0.32; cap.position.set(0, 0.012, -0.01);
    const long = T.longhair || fem || g.cls === 'PHANTOM' || g.cls === 'BANSHEE';
    const len = long ? 0.55 + r() * 0.45 : 0.12;
    const strands = long ? 46 : 18;
    if (long) { // a flowing curtain of hair behind the head, open at the face
      const geo = new THREE.CylinderGeometry(R * 1.04, R * 1.45, len + R * 0.6, 40, 10, true, Math.PI * 0.32, Math.PI * 1.36);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getX(i), p.getZ(i)); const k = 1 + Math.sin(a * 9 + y * 6) * 0.04; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k - 0.02); }
      geo.computeVertexNormals();
      add(geo, hairMat, head).position.y = R * 0.3 - (len + R * 0.6) / 2;
    }
    for (let i = 0; i < strands; i++) {
      const a = Math.PI * 0.08 + (i / (strands - 1)) * Math.PI * 1.84; // around the back and sides
      const sx = Math.sin(a) * R * 1.0, sz = Math.cos(a) * R * 1.0;
      if (sz > R * 0.55 && !long) continue;
      const start = V3(sx * 0.9, R * 0.75, sz * 0.9 - 0.01);
      const out = V3(sx * 1.25, 0, sz > 0 ? sz * 0.6 : sz * 1.25);
      const w = Math.sin(i * 1.7) * 0.02;
      const pts = [start, V3(out.x, -R * 0.2, out.z), V3(out.x * 1.08 + w, -len * 0.5, out.z * 1.1), V3(out.x * 1.0 - w, -len, out.z * 1.05)];
      if (sz > R * 0.6) continue; // keep the face clear
      add(taperTube(pts, 0.016, 0.004, 14, 5, t => 0.018 * (1 - t * 0.75)), hairMat, head);
    }
    // bangs / hair over the face for yūrei-type phantoms
    const over = g.cls === 'PHANTOM' && g.realm === 'EAST';
    for (let i = 0; i < (over ? 9 : 5); i++) {
      const x = (i / (over ? 8 : 4) - 0.5) * R * 1.4;
      const pts = [V3(x * 0.6, R * 0.95, R * 0.45), V3(x, R * 0.55, R * 1.02), V3(x * 1.1, over ? -R * 0.9 : R * 0.2, R * 1.06)];
      add(taperTube(pts, 0.022, 0.004, 8, 6, t => 0.022 * (1 - t * 0.85)), hairMat, head);
    }
  }
  // headwear from traits
  const top = R * 1.05;
  if (T.horns) for (const s of [-1, 1]) {
    const pts = [V3(s * R * 0.5, top * 0.7, 0), V3(s * R * 0.95, top * 1.15, -0.02), V3(s * R * 1.3, top * 1.25, -0.08), V3(s * R * 1.5, top * 1.6, -0.06)];
    add(taperTube(pts, 0.03, 0.002, 16, 8), M({ color: g.cls === 'SHADE' ? '#2a1418' : '#d8ccb0', roughness: 0.4 }), head);
  }
  if (T.antlers) {
    const bone = M({ color: '#cbb894', roughness: 0.55 });
    for (const s of [-1, 1]) {
      const main = [V3(s * R * 0.45, top * 0.8, -0.02), V3(s * R * 1.1, top * 1.5, -0.05), V3(s * R * 1.5, top * 2.3, -0.02), V3(s * R * 1.4, top * 3.0, 0.02)];
      add(taperTube(main, 0.022, 0.006, 16, 7), bone, head);
      for (const [t, dx, dy] of [[0.35, 0.6, 0.5], [0.6, 0.2, 0.7], [0.8, 0.5, 0.45]]) {
        const p0 = new THREE.CatmullRomCurve3(main).getPointAt(t);
        add(taperTube([p0, p0.clone().add(V3(s * R * dx, top * dy, 0.04))], 0.012, 0.003, 4, 6), bone, head);
      }
    }
  }
  if (T.fox || T.cat) for (const s of [-1, 1]) { const e = add(new THREE.ConeGeometry(0.045, 0.12, 4), M({ color: T.fox ? '#d88a3a' : hair, roughness: 0.9 }), head); e.position.set(s * R * 0.62, top * 0.95, -0.01); e.rotation.z = -s * 0.35; }
  if (T.crown) {
    const c = add(new THREE.CylinderGeometry(R * 0.82, R * 0.8, 0.05, 24, 1, true), goldMat, head); c.position.y = top * 0.82;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = add(new THREE.ConeGeometry(0.012, 0.05, 6), goldMat, head); p.position.set(Math.sin(a) * R * 0.81, top * 0.82 + 0.045, Math.cos(a) * R * 0.81); }
    const gem = add(new THREE.OctahedronGeometry(0.015), glow('#ff3050'), head); gem.position.set(0, top * 0.82, R * 0.83);
  } else if (T.helmet) {
    add(new THREE.SphereGeometry(R * 1.12, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), metalMat, head).position.y = 0.01;
    const ng = add(new THREE.BoxGeometry(0.014, 0.09, 0.015), metalMat, head); ng.position.set(0, 0.02, R * 1.1);
  } else if (T.hat) {
    const brim = add(new THREE.CylinderGeometry(R * 2.1, R * 2.1, 0.012, 32), M({ color: '#1e1814', roughness: 0.8 }), head); brim.position.y = top * 0.72;
    const crown = add(new THREE.CylinderGeometry(R * 0.85, R * 1.0, 0.16, 24), M({ color: '#1e1814', roughness: 0.8 }), head); crown.position.y = top * 0.72 + 0.08;
  } else if (T.hood || (g.cls === 'BANSHEE' && r() < 0.6) || g.cls === 'WRAITH') {
    // sphere azimuth π/2 faces +z, so leave a gap there for the face
    const hood = add(new THREE.SphereGeometry(R * 1.32, 32, 20, Math.PI * 0.74, Math.PI * 1.52, 0, Math.PI * 0.72), clothMat, head);
    hood.position.set(0, 0.03, -0.03);
  } else if (T.veil) {
    add(new THREE.SphereGeometry(R * 1.25, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.75), M({ color: '#f4f2fa', roughness: 0.8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), head).position.y = -0.02;
  } else if (g.cls === 'PHANTOM' && g.realm === 'EAST') { // hitaikakushi
    const tri = add(new THREE.CircleGeometry(0.04, 3), M({ color: '#ffffff', side: THREE.DoubleSide }), head); tri.position.set(0, R * 0.62, R * 0.93); tri.rotation.set(-0.35, 0, Math.PI / 2 * 3);
  }
  if (T.talisman) { const t = add(new THREE.PlaneGeometry(0.06, 0.2), M({ map: talismanTex(), roughness: 0.8, side: THREE.DoubleSide }), head); t.position.set(0, -0.02, R * 1.05); t.rotation.x = -0.1; }
  if (g.cls === 'SPECTER' || (g.cls === 'PHANTOM' && T.tags.includes('white'))) { // faint halo ring
    const ring = add(new THREE.TorusGeometry(R * 0.9, 0.006, 6, 40), glow('#cfefff'), head); ring.rotation.x = Math.PI / 2 - 0.2; ring.position.y = top * 1.25;
  }
}

function buildOrb(root, add, glow, T, realm, r) {
  const col = T.fire ? '#ff9a3a' : realm;
  const core = add(new THREE.SphereGeometry(0.18, 32, 24), glow('#ffffff')); core.position.y = 1.2;
  const shell = add(new THREE.SphereGeometry(0.3, 32, 24), new THREE.MeshBasicMaterial({ color: C(col).multiplyScalar(1.3), transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false })); shell.position.y = 1.2;
  for (let i = 0; i < 6; i++) {
    const pts = [V3(0, 1.2, 0), V3((r() - 0.5) * 0.3, 1.5 + r() * 0.2, (r() - 0.5) * 0.2), V3((r() - 0.5) * 0.3, 1.9 + r() * 0.3, (r() - 0.5) * 0.2)];
    add(taperTube(pts, 0.1, 0.005, 12, 8), new THREE.MeshBasicMaterial({ color: C(col).multiplyScalar(1.2), transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false }));
  }
  for (let i = 0; i < 12; i++) { const s = add(new THREE.SphereGeometry(0.02, 8, 6), glow(col)); s.position.set((r() - 0.5) * 0.9, 0.7 + r() * 1.2, (r() - 0.5) * 0.4); }
}

function buildBeast(root, add, M, glow, T, eyeHex, g) {
  const fur = M({ color: T.color || (T.cat ? '#2a2430' : '#141014'), roughness: 0.95, sheen: 1, sheenColor: C('#5a4a6a') }, true);
  const horse = /horse|mule|calf|helhest/i.test(g.name + ' ' + g.lore);
  const legs = /three-legged/i.test(g.lore + (g.wiki ? g.wiki.x : '')) ? 3 : 4;
  const b = add(new THREE.CapsuleGeometry(0.3, 0.62, 8, 20), fur); b.rotation.z = Math.PI / 2; b.position.set(0, 0.78, 0);
  const legX = [-0.32, -0.12, 0.18, 0.36].slice(0, legs);
  legX.forEach((x, i) => add(taperTube([V3(x, 0.75, i % 2 ? 0.14 : -0.14), V3(x + 0.05, 0.4, i % 2 ? 0.15 : -0.15), V3(x - 0.02, 0.03, i % 2 ? 0.14 : -0.14)], 0.1, 0.05, 8, 10), fur));
  const neck = horse ? [V3(-0.45, 0.88, 0), V3(-0.62, 1.18, 0), V3(-0.7, 1.38, 0)] : [V3(-0.45, 0.88, 0), V3(-0.6, 1.03, 0)];
  add(taperTube(neck, 0.17, 0.12, 10, 12), fur);
  const hp = neck[neck.length - 1];
  const head = add(new THREE.SphereGeometry(0.17, 24, 18), fur); head.position.copy(hp).add(V3(-0.08, 0.05, 0)); head.scale.set(1.25, 1, 0.9);
  const snout = add(new THREE.CapsuleGeometry(horse ? 0.08 : 0.07, horse ? 0.28 : 0.16, 6, 12), fur);
  snout.rotation.z = Math.PI / 2 + (horse ? 0.5 : 0.1); snout.position.copy(head.position).add(V3(-0.2, horse ? -0.08 : -0.04, 0));
  for (const s of [-1, 1]) {
    const e = add(new THREE.ConeGeometry(0.05, T.cat ? 0.12 : 0.14, 6), fur); e.position.copy(head.position).add(V3(0.02, 0.16, s * 0.08)); e.rotation.x = s * 0.3;
    const eye = add(new THREE.SphereGeometry(0.025, 10, 8), glow(eyeHex)); eye.position.copy(head.position).add(V3(-0.13, 0.04, s * 0.085));
  }
  add(taperTube([V3(0.55, 0.88, 0), V3(0.8, 1.02, 0), V3(0.95, 0.82, 0.05)], 0.06, 0.015, 10, 8), fur);
  root.rotation.y = -0.5;
}

function buildShip(root, add, M, glow, r, realm) {
  const wood = M({ color: '#2a2018', roughness: 0.8, transparent: true, opacity: 0.92 });
  const sh = new THREE.Shape();
  sh.moveTo(-1.1, 0.5); sh.quadraticCurveTo(-0.9, 0, 0, 0); sh.quadraticCurveTo(0.9, 0, 1.25, 0.6); sh.lineTo(-1.1, 0.6); sh.closePath();
  const hull = add(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), wood);
  hull.position.set(0, 0.25, -0.25);
  const sailMat = M({ color: '#d8dccf', roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.75, emissive: C(realm).multiplyScalar(0.15) });
  for (const [x, h] of [[-0.45, 1.7], [0.35, 1.95]]) {
    const mast = add(new THREE.CylinderGeometry(0.025, 0.03, h, 8), wood); mast.position.set(x, 0.85 + h / 2, 0);
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.PlaneGeometry(0.75 - k * 0.15, 0.55, 8, 6);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.06 + (r() - 0.5) * 0.02);
      geo.computeVertexNormals();
      const s = add(geo, sailMat); s.position.set(x, 1.15 + k * 0.65 + 0.2, 0.03);
    }
    const lamp = add(new THREE.SphereGeometry(0.035, 10, 8), glow('#7fffb0')); lamp.position.set(x, 0.9 + h, 0);
  }
  for (let i = 0; i < 5; i++) { const w = add(new THREE.SphereGeometry(0.025, 8, 6), glow('#7fffb0')); w.position.set(-0.8 + i * 0.4, 0.62, 0.3); }
  root.rotation.y = -0.6;
  root.scale.setScalar(0.85);
}
