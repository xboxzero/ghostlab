// GHOST LAB — the Ashen Atlas: a low-res, dithered, vertex-wobbling 3D world.
// Four dimensions: the three of space, plus TIME — each ring outward from the bonfire is an older age.
import * as THREE from 'three';
import { GHOSTS, REALMS } from './data.js';
import { atlasCanvas, COLS as ACOLS } from './portrait.js';
import { rng } from './rng.js';

export const ERAS = [
  { name: 'Age of Ancients', from: -9999, to: -1, tint: [0.55, 0.25, 0.1] },
  { name: 'Age of Empires',  from: 0, to: 999, tint: [0.45, 0.3, 0.12] },
  { name: 'Age of Lanterns', from: 1000, to: 1499, tint: [0.4, 0.15, 0.2] },
  { name: 'Age of Voyages',  from: 1500, to: 1699, tint: [0.25, 0.18, 0.35] },
  { name: 'Age of Candles',  from: 1700, to: 1849, tint: [0.3, 0.2, 0.3] },
  { name: 'Age of Iron',     from: 1850, to: 1949, tint: [0.18, 0.22, 0.32] },
  { name: 'Age of Static',   from: 1950, to: 9999, tint: [0.12, 0.25, 0.35] },
];
export const eraOf = y => ERAS.findIndex(e => y >= e.from && y <= e.to);
export const eraRadius = i => 64 - i * 7;

const REALM_KEYS = Object.keys(REALMS);
const realmAngle = k => (REALMS[k].angle / REALM_KEYS.length) * Math.PI * 2;

function psx(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(170.0, 110.0)) / vec2(170.0, 110.0) * gl_Position.w;');
  };
  return mat;
}

export class World {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 600);
    this.clock = new THREE.Clock();
    this.era = 3;
    this.bound = new Set();
    this.pulses = new Map();
    this.cam = { yaw: 0.6, pitch: 0.42, dist: 78, target: new THREE.Vector3(0, 2, 0), goal: null, idle: 0 };
    this.keys = {};
    this.level = 0;

    this.buildPost();
    this.buildWorld();
    this.buildGhosts();
    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // --- post-processing: render small, quantize with Bayer dithering, upscale pixelated ---
  buildPost() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, time: { value: 0 }, flash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time; uniform float flash; varying vec2 vUv;
        float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
        float bayer(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
        void main(){
          vec2 ca = vec2(0.0008 + flash * 0.003, 0.0);
          vec3 c = pow(vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b), vec3(1.0 / 2.2));
          c += flash * vec3(0.10, 0.09, 0.0);
          float d = bayer(gl_FragCoord.xy) - 0.5;
          float L = 14.0;
          c = floor(c * L + d * 0.85 + 0.5) / L;
          vec2 v = vUv - 0.5; c *= 1.0 - dot(v, v) * 1.3;
          c *= 0.9 + 0.1 * mod(gl_FragCoord.y, 2.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const scale = w > 1900 ? 3 : 2;
    this.lw = Math.max(160, Math.floor(w / scale)); this.lh = Math.max(100, Math.floor(h / scale));
    this.renderer.setSize(this.lw, this.lh, false);
    this.rt.setSize(this.lw, this.lh);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  buildWorld() {
    const S = this.scene, r = rng(1337);
    this.fogColor = new THREE.Color(0x0a0718);
    S.background = this.fogColor.clone();
    S.fog = new THREE.FogExp2(this.fogColor.clone(), 0.0078);

    S.add(new THREE.HemisphereLight(0x7080b0, 0x180c0c, 0.9));
    const moon = new THREE.DirectionalLight(0x8090c8, 0.7); moon.position.set(-60, 90, -40); S.add(moon);
    this.fireLight = new THREE.PointLight(0xff7a2a, 60, 70, 1.6); this.fireLight.position.set(0, 4, 0); S.add(this.fireLight);

    // Terrain: rolling ash with a sunken plaza at the centre
    const geo = new THREE.PlaneGeometry(360, 360, 72, 72); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z);
      let y = Math.sin(x * 0.07) * Math.cos(z * 0.06) * 2.2 + Math.sin(x * 0.21 + z * 0.13) * 0.8 + (r() - 0.5) * 0.9;
      y *= Math.min(1, Math.max(0, (d - 12) / 20));
      if (d > 85) y += (d - 85) * 0.35 + r() * 3;
      pos.setY(i, y);
      const k = 0.09 + r() * 0.05 + (d < 14 ? 0.05 : 0);
      cols.push(k * 1.05, k * 0.95, k * 1.1);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    this.ground = new THREE.Mesh(geo, psx(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    S.add(this.ground);

    const stone = psx(new THREE.MeshLambertMaterial({ color: 0x4a4650, flatShading: true }));
    const darkStone = psx(new THREE.MeshLambertMaterial({ color: 0x2a2630, flatShading: true }));

    // Plaza
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 0.6, 16), darkStone);
    plaza.position.y = 0.1; S.add(plaza);

    // Bonfire: stones, coiled sword, flame particles
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), stone);
      s.position.set(Math.cos(a) * 2.2, 0.6, Math.sin(a) * 2.2); s.rotation.set(r(), r(), r()); S.add(s);
    }
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.4, 0.08), psx(new THREE.MeshLambertMaterial({ color: 0x8a8a90, flatShading: true })));
    sword.position.set(0, 2.4, 0); sword.rotation.z = 0.12; S.add(sword);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), stone); hilt.position.set(0.3, 4.4, 0); hilt.rotation.z = 0.12; S.add(hilt);
    const N = 70;
    this.flameGeo = new THREE.BufferGeometry();
    this.flameData = [];
    const fp = new Float32Array(N * 3), fc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.flameData.push({ life: r(), x: 0, z: 0, s: 0.5 + r() });
    this.flameGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.flameGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    this.flames = new THREE.Points(this.flameGeo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    S.add(this.flames);

    // Souls rising (earned currency)
    this.souls = [];
    this.soulGeo = new THREE.BufferGeometry();
    this.soulGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(200 * 3), 3));
    this.soulPts = new THREE.Points(this.soulGeo, new THREE.PointsMaterial({ size: 1.2, color: 0xffe9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    S.add(this.soulPts);

    // Data rain (Cyberpunk drizzle)
    const RN = 260;
    this.rain = new Float32Array(RN * 3);
    for (let i = 0; i < RN; i++) { this.rain[i * 3] = (r() - 0.5) * 220; this.rain[i * 3 + 1] = r() * 60; this.rain[i * 3 + 2] = (r() - 0.5) * 220; }
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rain, 3));
    S.add(new THREE.Points(this.rainGeo, new THREE.PointsMaterial({ color: 0x00f0ff, size: 0.5, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));

    // Shrines of the eight realms
    this.shrines = [];
    for (const k of REALM_KEYS) {
      const a = realmAngle(k), R = 76;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      g.rotation.y = -a - Math.PI / 2;
      const col = new THREE.Color(REALMS[k].color);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 8), darkStone); base.position.y = 0.6; g.add(base);
      for (const [px, pz] of [[-4, -2], [4, -2], [-4, 3], [4, 3]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 11, 1.1), stone); p.position.set(px, 6.5, pz); g.add(p);
      }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(4, 0.6, 4, 8, Math.PI), stone); arch.position.set(0, 12, -2); g.add(arch);
      const arch2 = arch.clone(); arch2.position.z = 3; g.add(arch2);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 4), darkStone); spire.position.set(0, 19, 0.5); g.add(spire);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 7), psx(new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.25 })));
      banner.position.set(0, 7, -2.6); g.add(banner);
      const lamp = new THREE.PointLight(col, 40, 34, 1.8); lamp.position.set(0, 5, 0); g.add(lamp);
      const tube = new THREE.MeshBasicMaterial({ color: col });
      for (const [px, pz] of [[-4, -2], [4, -2], [-4, 3], [4, 3]]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.18, 10.5, 0.18), tube); t.position.set(px + (px < 0 ? 0.62 : -0.62), 6.5, pz + 0.62); g.add(t);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.12, 4, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0xfcee0a })); ring.position.set(0, 12, 3.7); g.add(ring);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), new THREE.MeshBasicMaterial({ color: col }));
      gem.position.set(0, 4.5, 0.5); g.add(gem);
      const label = textSprite(REALMS[k].name, REALMS[k].color);
      label.position.set(0, 26, 0); g.add(label);
      S.add(g);
      this.shrines.push({ k, g, gem, lamp });
    }

    // Graves, dead trees, broken pillars
    const tomb = psx(new THREE.MeshLambertMaterial({ color: 0x3a3840, flatShading: true }));
    const wood = psx(new THREE.MeshLambertMaterial({ color: 0x24180f, flatShading: true }));
    for (let i = 0; i < 110; i++) {
      const a = r() * Math.PI * 2, d = 16 + r() * 66;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const t = r();
      let m;
      if (t < 0.55) { m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8 + r(), 0.35), tomb); m.position.set(x, 0.8, z); m.rotation.set((r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3); }
      else if (t < 0.8) {
        m = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 7, 5), wood); trunk.position.y = 3.5; m.add(trunk);
        for (let b = 0; b < 4; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.15, 3, 4), wood); br.position.y = 4 + b; br.rotation.z = (r() - 0.5) * 2; br.rotation.y = r() * 6; m.add(br); }
        m.position.set(x, 0, z);
      } else { m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 2 + r() * 6, 7), stone); m.position.set(x, 1.5, z); m.rotation.z = (r() - 0.5) * 0.4; }
      S.add(m);
    }
    // Distant mountains
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2 + r() * 0.1, d = 150 + r() * 40;
      const mt = new THREE.Mesh(new THREE.ConeGeometry(14 + r() * 18, 40 + r() * 60, 5), darkStone);
      mt.position.set(Math.cos(a) * d, 10, Math.sin(a) * d); S.add(mt);
    }
    // Stars + moon
    const sp = [];
    for (let i = 0; i < 500; i++) { const a = r() * Math.PI * 2, e = 0.15 + r() * 1.3; sp.push(Math.cos(a) * Math.cos(e) * 400, Math.sin(e) * 400, Math.sin(a) * Math.cos(e) * 400); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    S.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xc8c8ff, size: 1, sizeAttenuation: false, fog: false })));
    const moonM = new THREE.Mesh(new THREE.CircleGeometry(22, 12), new THREE.MeshBasicMaterial({ color: 0xe8e0c8, fog: false }));
    moonM.position.set(-200, 210, -260); moonM.lookAt(0, 0, 0); S.add(moonM);

    // Time rings (the 4th dimension made visible)
    this.eraRings = ERAS.map((e, i) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(eraRadius(i) - 0.25, eraRadius(i) + 0.25, 96), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35;
      S.add(ring);
      return ring;
    });
  }

  buildGhosts() {
    this.sprites = [];
    const byRealmEra = {};
    for (const g of GHOSTS) {
      const key = g.realm + ':' + eraOf(g.year);
      (byRealmEra[key] = byRealmEra[key] || []).push(g);
    }
    const sectorW = (Math.PI * 2) / REALM_KEYS.length;
    const cols = ACOLS, rows = Math.ceil(GHOSTS.length / cols);
    // The atlas canvas is filled in as each 3D ghost is summoned (see portrait.js)
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    atlas.colorSpace = THREE.SRGBColorSpace; atlas.generateMipmaps = false; atlas.minFilter = THREE.LinearFilter;
    this.atlasTexes = [];
    for (const list of Object.values(byRealmEra)) {
      list.forEach((g, i) => {
        const r = rng(g.seed);
        const era = eraOf(g.year);
        const spread = sectorW * 0.82;
        const a = realmAngle(g.realm) - spread / 2 + spread * ((i + 0.5) / list.length) + (r() - 0.5) * 0.04;
        const rad = eraRadius(era) + (r() - 0.5) * 4.5;
        const tex = atlas.clone(); // shares one uploaded image; only the UV window differs
        tex.repeat.set(1 / cols, 1 / rows);
        tex.offset.set((g.id % cols) / cols, 1 - (Math.floor(g.id / cols) + 1) / rows);
        this.atlasTexes.push(tex);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, fog: true });
        const sp = new THREE.Sprite(mat);
        const base = new THREE.Vector3(Math.cos(a) * rad, 3 + r() * 3, Math.sin(a) * rad);
        sp.position.copy(base);
        sp.scale.setScalar(3.4);
        sp.userData = { id: g.id, base, phase: r() * 10, era };
        this.scene.add(sp);
        this.sprites[g.id] = sp;
      });
    }
    // glow wisps under bound ghosts
    this.glowTex = glowTexture();
    this.glows = new Map();
  }

  refreshAtlas() { for (const t of this.atlasTexes) t.needsUpdate = true; }

  setEra(i) {
    this.era = i;
    this.eraRings.forEach((ring, k) => { ring.material.opacity = k === i ? 0.85 : 0.14; ring.material.color.set(k === i ? 0xfcee0a : 0x00f0ff); });
    const t = ERAS[i].tint;
    this.fogTarget = new THREE.Color(t[0] * 0.12, t[1] * 0.12, t[2] * 0.14);
    this.refreshGhosts();
  }

  setBound(ids) {
    this.bound = new Set(ids);
    for (const [id, gl] of this.glows) if (!this.bound.has(id)) { this.scene.remove(gl); this.glows.delete(id); }
    for (const id of this.bound) if (!this.glows.has(id)) {
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: REALMS[GHOSTS[id].realm].color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      gl.scale.setScalar(6);
      this.scene.add(gl); this.glows.set(id, gl);
    }
    this.refreshGhosts();
  }

  refreshGhosts() {
    for (const sp of this.sprites) {
      if (!sp) continue;
      const on = sp.userData.era === this.era || this.bound.has(sp.userData.id);
      sp.material.opacity = on ? 1 : 0.13;
      sp.userData.active = on;
    }
  }

  focus(id) {
    const sp = this.sprites[id];
    if (!sp) return;
    this.cam.goal = { target: sp.userData.base.clone().setY(2), dist: 26, yaw: Math.atan2(sp.userData.base.x, sp.userData.base.z) };
    this.selected = id;
  }

  pulse(id, v) { this.pulses.set(id, Math.max(this.pulses.get(id) || 0, v)); }
  kick(v) { this.kickFlash = Math.max(this.kickFlash || 0, v); }
  soulBurst(n) {
    for (let i = 0; i < Math.min(n, 60); i++) this.souls.push({ p: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), v: new THREE.Vector3((Math.random() - 0.5) * 3, 6 + Math.random() * 6, (Math.random() - 0.5) * 3), life: 1.6 + Math.random() });
  }

  bindInput() {
    const el = this.canvas;
    let down = null, moved = 0;
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; moved = 0; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        moved += Math.abs(dx) + Math.abs(dy);
        this.cam.yaw -= dx * 0.006; this.cam.pitch = Math.min(1.35, Math.max(0.08, this.cam.pitch + dy * 0.004));
        down = { x: e.clientX, y: e.clientY };
        this.cam.goal = null; this.cam.idle = 0;
      } else {
        const id = this.pick(e);
        el.style.cursor = id != null ? 'pointer' : 'grab';
        this.hooks.onHover && this.hooks.onHover(id, e.clientX, e.clientY);
      }
    });
    el.addEventListener('pointerup', e => {
      if (down && moved < 6) { const id = this.pick(e); if (id != null) this.hooks.onPick(id); }
      down = null;
    });
    el.addEventListener('wheel', e => { e.preventDefault(); this.cam.dist = Math.min(150, Math.max(10, this.cam.dist * (1 + e.deltaY * 0.001))); this.cam.goal = null; }, { passive: false });
    addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }

  pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, this.camera);
    const hits = ray.intersectObjects(this.sprites.filter(s => s && s.userData.active), false);
    return hits.length ? hits[0].object.userData.id : null;
  }

  update(level) {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    const C = this.cam;
    // WASD walking
    const f = new THREE.Vector3(-Math.sin(C.yaw), 0, -Math.cos(C.yaw)), rt = new THREE.Vector3(-f.z, 0, f.x);
    const sp = 30 * dt;
    if (this.keys.w || this.keys.arrowup) { C.target.addScaledVector(f, sp); C.goal = null; C.idle = 0; }
    if (this.keys.s || this.keys.arrowdown) { C.target.addScaledVector(f, -sp); C.goal = null; C.idle = 0; }
    if (this.keys.a || this.keys.arrowleft) { C.target.addScaledVector(rt, -sp); C.goal = null; C.idle = 0; }
    if (this.keys.d || this.keys.arrowright) { C.target.addScaledVector(rt, sp); C.goal = null; C.idle = 0; }
    C.target.x = Math.max(-95, Math.min(95, C.target.x)); C.target.z = Math.max(-95, Math.min(95, C.target.z));
    C.idle += dt;
    if (C.goal) {
      C.target.lerp(C.goal.target, 0.06);
      C.dist += (C.goal.dist - C.dist) * 0.06;
      let dy = C.goal.yaw - C.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); C.yaw += dy * 0.06;
    } else if (C.idle > 8) C.yaw += dt * 0.05;
    this.camera.position.set(C.target.x + Math.sin(C.yaw) * Math.cos(C.pitch) * C.dist, C.target.y + Math.sin(C.pitch) * C.dist, C.target.z + Math.cos(C.yaw) * Math.cos(C.pitch) * C.dist);
    this.camera.lookAt(C.target);

    // fog follows the age
    if (this.fogTarget) { this.scene.fog.color.lerp(this.fogTarget, 0.03); this.scene.background.copy(this.scene.fog.color); }

    // bonfire flicker + audio
    this.level += (level - this.level) * 0.3;
    this.kickFlash = (this.kickFlash || 0) * 0.85;
    this.fireLight.intensity = 45 + Math.sin(t * 13) * 6 + Math.sin(t * 7.3) * 5 + this.level * 120 + this.kickFlash * 60;
    this.postMat.uniforms.flash.value = this.kickFlash * 0.6;
    const fp = this.flameGeo.attributes.position.array, fc = this.flameGeo.attributes.color.array;
    this.flameData.forEach((p, i) => {
      p.life += dt * (0.8 + p.s * 0.6);
      if (p.life > 1) { p.life = 0; p.x = (Math.random() - 0.5) * 1.6; p.z = (Math.random() - 0.5) * 1.6; }
      const k = p.life;
      fp[i * 3] = p.x * (1 - k) + Math.sin(t * 3 + i) * 0.2; fp[i * 3 + 1] = 0.8 + k * (3 + this.level * 8); fp[i * 3 + 2] = p.z * (1 - k);
      fc[i * 3] = 1; fc[i * 3 + 1] = 0.75 - k * 0.6; fc[i * 3 + 2] = 0.2 - k * 0.2;
    });
    this.flameGeo.attributes.position.needsUpdate = true; this.flameGeo.attributes.color.needsUpdate = true;

    // souls
    const sa = this.soulGeo.attributes.position.array;
    this.souls = this.souls.filter(s => (s.life -= dt) > 0);
    for (let i = 0; i < 200; i++) {
      const s = this.souls[i];
      if (s) { s.v.y -= dt * 2; s.v.multiplyScalar(0.985); s.p.addScaledVector(s.v, dt); sa[i * 3] = s.p.x; sa[i * 3 + 1] = s.p.y; sa[i * 3 + 2] = s.p.z; }
      else { sa[i * 3 + 1] = -999; }
    }
    this.soulGeo.attributes.position.needsUpdate = true;

    // data rain
    for (let i = 0; i < this.rain.length; i += 3) { this.rain[i + 1] -= dt * 22; if (this.rain[i + 1] < 0) this.rain[i + 1] = 60; }
    this.rainGeo.attributes.position.needsUpdate = true;

    // shrines
    for (const s of this.shrines) { s.gem.rotation.y = t * 0.8; s.gem.position.y = 4.5 + Math.sin(t * 1.5 + s.g.position.x) * 0.4; }

    // ghosts bob, pulse on notes
    for (const spr of this.sprites) {
      if (!spr) continue;
      const u = spr.userData;
      const pv = this.pulses.get(u.id) || 0;
      spr.position.set(u.base.x + Math.sin(t * 0.5 + u.phase) * 0.6, u.base.y + Math.sin(t * 1.3 + u.phase) * 0.5 + pv * 0.6, u.base.z + Math.cos(t * 0.4 + u.phase) * 0.6);
      spr.scale.setScalar((u.id === this.selected ? 4.6 : 3.4) * (1 + pv * 0.3));
      if (pv) this.pulses.set(u.id, pv * 0.88 < 0.02 ? 0 : pv * 0.88);
      const gl = this.glows.get(u.id);
      if (gl) { gl.position.copy(spr.position); gl.position.y -= 0.2; gl.material.opacity = 0.35 + pv * 0.8 + Math.sin(t * 2 + u.phase) * 0.1; gl.scale.setScalar(5 + pv * 5); }
    }

    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}

function textSprite(text, color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const c = cv.getContext('2d');
  c.font = '700 30px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(text, 258, 35);
  c.fillStyle = color; c.fillText(text, 256, 32);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(24, 3, 1);
  return sp;
}
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x - 15.5, y - 15.5) / 16;
    const b = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] / 16;
    if ((1 - d) * 1.2 > b + 0.15) { c.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - d)})`; c.fillRect(x, y, 1, 1); }
  }
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter;
  return t;
}
