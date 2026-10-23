// GHOST LAB — summoning: renders every 3D ghost once into a sprite atlas (used by the world
// and for every portrait in the UI), and a live turntable viewer for the Codex.
import * as THREE from 'three';
import { buildGhost } from './ghost3d.js';
import { GHOSTS, REALMS } from './data.js';

export const CELL = 128;
export const COLS = 18;
const ROWS = Math.ceil(GHOSTS.length / COLS);
const RENDER = 256;

export const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = COLS * CELL; atlasCanvas.height = ROWS * CELL;
const actx = atlasCanvas.getContext('2d');
export const summoned = new Set();

let renderer, scene, cam, rim, rim2, key;
function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER, RENDER, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  // a tiny "studio" environment for reflections on metal, gems and wet surfaces
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x15161e, side: THREE.BackSide })));
  for (const [x, y, z, c] of [[0, 4.5, 2, 0xfff0e0], [-4.5, 1, -2, 0x6080ff], [4.5, 2, -1, 0xff70a0]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(4), side: THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p);
  }
  scene.environment = pm.fromScene(env, 0.04).texture;
  scene.add(new THREE.HemisphereLight(0x8899cc, 0x1a120e, 0.55));
  key = new THREE.DirectionalLight(0xffe2c4, 3.2); key.position.set(1.6, 2.6, 4.2); scene.add(key);
  rim = new THREE.DirectionalLight(0xffffff, 4.5); rim.position.set(-3, 2.4, -3); scene.add(rim);
  rim2 = new THREE.DirectionalLight(0x88ccff, 1.6); rim2.position.set(3.2, 1.2, -2.6); scene.add(rim2);
  const fill = new THREE.DirectionalLight(0x8090c0, 0.4); fill.position.set(-2, 0.5, 3); scene.add(fill);
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
}

// Frame a model: people get a knee-up three-quarter shot, other forms are fitted to their bounds
function frame(model, camera, pad = 1) {
  const form = model.userData.form;
  let target, h;
  if (form === 'human' && model.userData.longneck) { target = new THREE.Vector3(0, 1.72 * model.scale.y, 0); h = 1.55 * model.scale.y; }
  else if (form === 'human') { target = new THREE.Vector3(0, 1.56 * model.scale.y, 0); h = 1.22 * model.scale.y; }
  else if (form === 'headless') { target = new THREE.Vector3(0, 1.3 * model.scale.y, 0); h = 1.5 * model.scale.y; }
  else if (form === 'head') { target = new THREE.Vector3(0, 1.45, 0); h = 1.3; }
  else {
    const box = new THREE.Box3().setFromObject(model);
    target = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()); h = Math.max(s.y, s.x * 0.95) * 1.05;
  }
  h *= pad;
  const dist = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(target.x, target.y + h * 0.06, target.z + dist);
  camera.lookAt(target);
}

// Render (or re-render) one ghost into the atlas
export function summonOne(g) { setup(); renderOne(g); urlCache.delete(g.id); }
function renderOne(g) {
  const model = buildGhost(g);
  if (model.userData.form === 'human' || model.userData.form === 'headless' || model.userData.form === 'head') model.rotation.y = -0.38;
  rim.color.set(REALMS[g.realm].color);
  scene.add(model);
  frame(model, cam);
  renderer.render(scene, cam);
  const x = (g.id % COLS) * CELL, y = Math.floor(g.id / COLS) * CELL;
  actx.clearRect(x, y, CELL, CELL);
  actx.drawImage(renderer.domElement, x, y, CELL, CELL);
  scene.remove(model);
  model.userData.dispose();
  summoned.add(g.id);
}

// --- atlas cache (IndexedDB) so only the first visit has to build every model -----------
const ATLAS_KEY = 'atlas-3d-v2-' + GHOSTS.length; // bump when the models change
function idb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('ghostlab', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('cache');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function loadCachedAtlas() {
  try {
    const db = await idb();
    const blob = await new Promise((res, rej) => { const q = db.transaction('cache').objectStore('cache').get(ATLAS_KEY); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (!blob) return false;
    const bmp = await createImageBitmap(blob);
    if (bmp.width !== atlasCanvas.width || bmp.height !== atlasCanvas.height) return false;
    actx.drawImage(bmp, 0, 0);
    GHOSTS.forEach(g => summoned.add(g.id));
    return true;
  } catch (e) { return false; }
}
function saveAtlas() {
  try {
    atlasCanvas.toBlob(async blob => {
      try { const db = await idb(); db.transaction('cache', 'readwrite').objectStore('cache').put(blob, ATLAS_KEY); } catch (e) { }
    }, 'image/webp', 0.92);
  } catch (e) { }
}

// Render every ghost, a slice of time per frame, so the page stays responsive.
export async function summonAll(onProgress) {
  if (await loadCachedAtlas()) { onProgress && onProgress(1); return; }
  await summonFresh(onProgress);
  saveAtlas();
}
function summonFresh(onProgress) {
  setup();
  let i = 0;
  return new Promise(resolve => {
    const step = () => {
      const t0 = performance.now();
      while (i < GHOSTS.length && performance.now() - t0 < 14) renderOne(GHOSTS[i++]);
      onProgress && onProgress(i / GHOSTS.length);
      if (i < GHOSTS.length) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

// --- portraits for the UI (cropped from the atlas over a dark card) ---------------------
const urlCache = new Map();
export function portraitURL(g) {
  if (urlCache.has(g.id)) return urlCache.get(g.id);
  const cv = document.createElement('canvas'); cv.width = cv.height = CELL;
  const c = cv.getContext('2d');
  const col = REALMS[g.realm].color;
  const grd = c.createRadialGradient(CELL / 2, CELL * 0.42, 4, CELL / 2, CELL / 2, CELL * 0.7);
  grd.addColorStop(0, col + '66'); grd.addColorStop(0.55, '#141626'); grd.addColorStop(1, '#06070c');
  c.fillStyle = grd; c.fillRect(0, 0, CELL, CELL);
  c.drawImage(atlasCanvas, (g.id % COLS) * CELL, Math.floor(g.id / COLS) * CELL, CELL, CELL, 0, 0, CELL, CELL);
  const url = cv.toDataURL('image/webp', 0.9);
  if (summoned.has(g.id)) urlCache.set(g.id, url);
  return url;
}

// --- live 3D viewer (Codex) ------------------------------------------------------------
export class Viewer {
  constructor() { this.model = null; this.raf = 0; this.yaw = -0.38; this.drag = null; }
  attach(container, g) {
    setup();
    this.detach();
    const el = renderer.domElement;
    el.className = 'viewer3d';
    container.appendChild(el);
    const size = Math.round(container.clientWidth || 200);
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(size, size, false);
    this.model = buildGhost(g);
    this.base = this.model.position.y;
    rim.color.set(REALMS[g.realm].color);
    scene.add(this.model);
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    frame(this.model, this.cam, 1.12);
    this.yaw = this.model.userData.form === 'beast' || this.model.userData.form === 'ship' ? this.model.rotation.y : -0.38;
    el.onpointerdown = e => { this.drag = { x: e.clientX, yaw: this.yaw }; el.setPointerCapture(e.pointerId); };
    el.onpointermove = e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; };
    el.onpointerup = () => { this.drag = null; };
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (!this.drag) this.yaw += 0.004;
      this.model.rotation.y = this.yaw;
      this.model.position.y = this.base + Math.sin(t * 1.4) * 0.03;
      renderer.render(scene, this.cam);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  detach() {
    cancelAnimationFrame(this.raf);
    if (this.model) { scene.remove(this.model); this.model.userData.dispose(); this.model = null; }
    if (renderer && renderer.domElement.parentNode) renderer.domElement.remove();
    if (renderer) { renderer.setPixelRatio(1); renderer.setSize(RENDER, RENDER, false); }
  }
}
export const SPRITE_SIZE = CELL;
