// GHOST LAB — modular techno engine built on the Web Audio API.
// Every ghost is a module: sequenced voice -> filter -> FX -> out. Modules are patched
// together with cables: chain them for serial processing, or fan several into one
// target for parallel mixing. Everything ends at the BONFIRE (master).
import { rng } from './rng.js';

const SCALE = [0, 1, 3, 5, 7, 8, 10]; // Phrygian: dark and very techno
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export const FX_NAMES = {
  reverb: 'Cathedral Reverb', delay: 'Echo Crypt', distort: 'Hellfire Drive', crush: 'Bone Crusher',
  chorus: 'Choir of Many', phaser: 'Veil Phaser', tremolo: 'Heart Tremor', ring: 'Ring of Souls',
};

export class Engine {
  constructor() {
    this.ctx = null;
    this.bpm = 128;
    this.root = 45; // A2
    this.playing = false;
    this.step = 0;
    this.bar = 0;
    this.modules = new Map();
    this.stepListeners = [];
    this.events = []; // {time, id, vel} for visuals
  }

  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterIn = ctx.createGain();
    this.masterComp = ctx.createDynamicsCompressor();
    this.masterComp.threshold.value = -14; this.masterComp.ratio.value = 4;
    this.masterComp.attack.value = 0.005; this.masterComp.release.value = 0.15;
    this.masterGain = ctx.createGain(); this.masterGain.gain.value = 0.8;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
    this.masterIn.connect(this.masterComp).connect(this.masterGain).connect(this.analyser).connect(ctx.destination);
    this.recordDest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (this.recordDest) this.masterGain.connect(this.recordDest);
    this.ir = makeIR(ctx, 3.2);
    this.noise = makeNoise(ctx);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.fftSize);
  }

  get stepDur() { return 60 / this.bpm / 4; }

  setBpm(b) {
    this.bpm = Math.max(70, Math.min(180, b));
    for (const m of this.modules.values()) m.fx && m.fx.tempo && m.fx.tempo(this.stepDur);
  }

  noteFreq(deg, oct) {
    const d = ((deg % 7) + 7) % 7;
    const o = Math.floor(deg / 7);
    return mtof(this.root + 12 * (oct + o) + SCALE[d]);
  }

  addModule(id, kind, opts) {
    const m = new Module(this, id, kind, opts);
    this.modules.set(id, m);
    return m;
  }
  removeModule(id) {
    const m = this.modules.get(id);
    if (!m) return;
    for (const other of this.modules.values()) if (other.dests.has(id)) this.disconnect(other.id, id);
    m.dispose();
    this.modules.delete(id);
  }

  // --- patching ---
  canConnect(from, to) {
    if (from === to || from === 'master') return false;
    if (to === 'master') return true;
    // refuse cycles: does `to` already reach `from`?
    const seen = new Set();
    const walk = id => {
      if (id === from) return true;
      if (seen.has(id) || id === 'master') return false;
      seen.add(id);
      const m = this.modules.get(id);
      return m ? [...m.dests].some(walk) : false;
    };
    return !walk(to);
  }
  connect(from, to) {
    const a = this.modules.get(from);
    if (!a || a.dests.has(to) || !this.canConnect(from, to)) return false;
    const dest = to === 'master' ? this.masterIn : this.modules.get(to)?.input;
    if (!dest) return false;
    a.out.connect(dest);
    a.dests.add(to);
    return true;
  }
  disconnect(from, to) {
    const a = this.modules.get(from);
    if (!a || !a.dests.has(to)) return;
    const dest = to === 'master' ? this.masterIn : this.modules.get(to)?.input;
    try { a.out.disconnect(dest); } catch (e) { /* already gone */ }
    a.dests.delete(to);
  }
  reachesMaster(id, seen = new Set()) {
    if (id === 'master') return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const m = this.modules.get(id);
    return !!m && [...m.dests].some(d => this.reachesMaster(d, seen));
  }
  // Longest serial chain (in modules) that ends at master
  chainDepth(id, seen = new Set()) {
    if (id === 'master') return 0;
    const m = this.modules.get(id);
    if (!m || seen.has(id)) return -Infinity;
    seen.add(id);
    let best = -Infinity;
    for (const d of m.dests) best = Math.max(best, this.chainDepth(d, new Set(seen)));
    return best + 1;
  }

  // --- transport ---
  start() {
    this.init();
    this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.step = 0; this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.tick(), 25);
  }
  stop() {
    this.playing = false;
    clearInterval(this.timer);
  }
  tick() {
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextTime < ahead) {
      const t = this.nextTime, s = this.step;
      for (const m of this.modules.values()) {
        if (m.muted || !m.dests.size) continue;
        const vel = m.trigger(s, t);
        if (vel) this.events.push({ time: t, id: m.id, vel });
      }
      for (const fn of this.stepListeners) fn(s, t, this.bar);
      this.nextTime += this.stepDur;
      this.step = (s + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }
  // Pull visual events whose time has arrived
  drainEvents() {
    if (!this.ctx) return [];
    const now = this.ctx.currentTime, out = [];
    while (this.events.length && this.events[0].time <= now) out.push(this.events.shift());
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
    return out;
  }
  level() {
    if (!this.ctx) return 0;
    this.analyser.getByteTimeDomainData(this.waveData);
    let s = 0;
    for (let i = 0; i < this.waveData.length; i++) { const v = (this.waveData[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / this.waveData.length);
  }
}

// ---------------------------------------------------------------------------------
export class Module {
  constructor(engine, id, kind, opts = {}) {
    const ctx = engine.ctx;
    this.engine = engine; this.id = id; this.kind = kind; // kind: class name or 'DRUM'
    this.ghost = opts.ghost || null;
    this.dests = new Set();
    this.muted = false;
    this.p = Object.assign({ vol: 0.8, cutoff: 0.75, res: 0.2, mix: 0.35, haunt: 0.5, fx: opts.fx || 'reverb' }, opts.params || {});
    this.input = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass';
    this.dry = ctx.createGain(); this.wet = ctx.createGain();
    this.out = ctx.createGain();
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 256;
    this.meterData = new Uint8Array(256);
    this.input.connect(this.filter); this.voiceBus.connect(this.filter);
    this.filter.connect(this.dry).connect(this.out);
    this.wet.connect(this.out);
    this.out.connect(this.meter);
    this.setFx(this.p.fx);
    this.apply();
    this.pattern = opts.pattern || (kind === 'DRUM' ? defaultDrums() : genPattern(kind, this.ghost));
    this.lastFreq = 0;
  }

  setFx(name) {
    if (this.fx) { try { this.filter.disconnect(this.fx.input); } catch (e) { } this.fx.output.disconnect(); this.fx.dispose(); }
    this.p.fx = name;
    this.fx = makeFx(this.engine, name);
    this.filter.connect(this.fx.input);
    this.fx.output.connect(this.wet);
  }

  apply() {
    const t = this.engine.ctx.currentTime, p = this.p;
    this.filter.frequency.setTargetAtTime(80 * Math.pow(2, p.cutoff * 8), t, 0.03);
    this.filter.Q.setTargetAtTime(0.5 + p.res * 14, t, 0.03);
    this.dry.gain.setTargetAtTime(1 - p.mix * 0.85, t, 0.03);
    this.wet.gain.setTargetAtTime(p.mix * 1.1, t, 0.03);
    this.out.gain.setTargetAtTime(this.muted ? 0 : p.vol, t, 0.03);
  }
  setParam(k, v) { this.p[k] = v; if (k === 'fx') this.setFx(v); this.apply(); }
  setMuted(m) { this.muted = m; this.apply(); }

  level() {
    this.meter.getByteTimeDomainData(this.meterData);
    let peak = 0;
    for (let i = 0; i < this.meterData.length; i++) peak = Math.max(peak, Math.abs(this.meterData[i] - 128));
    return peak / 128;
  }

  trigger(step, t) {
    if (this.kind === 'DRUM') return this.drums(step, t);
    const s = this.pattern[step];
    if (!s || !s.on) return 0;
    VOICES[this.kind](this, s, t);
    return s.acc ? 1 : 0.7;
  }

  drums(step, t) {
    const ctx = this.engine.ctx, P = this.pattern, h = this.p.haunt;
    let hit = 0;
    if (P.kick[step]) {
      hit = 1;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.09 + h * 0.06);
      g.gain.setValueAtTime(1.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3 + h * 0.35);
      o.connect(g).connect(this.voiceBus); o.start(t); o.stop(t + 0.8);
      // rumble tail
      if (h > 0.4) {
        const r = ctx.createOscillator(), rg = ctx.createGain();
        r.type = 'triangle'; r.frequency.value = 44;
        rg.gain.setValueAtTime(0, t + 0.04); rg.gain.linearRampToValueAtTime(0.25 * h, t + 0.1);
        rg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        r.connect(rg).connect(this.voiceBus); r.start(t); r.stop(t + 0.5);
      }
    }
    if (P.clap[step]) {
      hit = hit || 0.8;
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.011;
        const n = noiseSrc(this.engine), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
        g.gain.setValueAtTime(0.5, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.18 : 0.03));
        n.connect(bp).connect(g).connect(this.voiceBus); n.start(tt); n.stop(tt + 0.25);
      }
    }
    if (P.hat[step]) {
      hit = hit || 0.5;
      const open = step % 4 === 2;
      const n = noiseSrc(this.engine), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 7000;
      g.gain.setValueAtTime(open ? 0.22 : 0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.16 : 0.04));
      n.connect(hp).connect(g).connect(this.voiceBus); n.start(t); n.stop(t + 0.2);
    }
    return hit;
  }

  dispose() {
    try { this.out.disconnect(); } catch (e) { }
    this.fx && this.fx.dispose();
  }

  serialize() {
    return { p: this.p, muted: this.muted, pattern: this.pattern };
  }
}

// ---------------------------------------------------------------------------------
// Pattern generation: each ghost's sixteen steps come from its seed.
export function genPattern(cls, ghost, salt = 0) {
  const r = rng((ghost ? ghost.seed : 1) + salt * 7919);
  const base = ghost ? ghost.degree : 0;
  const P = [];
  const pick = a => a[Math.floor(r() * a.length)];
  for (let i = 0; i < 16; i++) P.push({ on: false, deg: 0, acc: false, slide: false, len: 1 });
  const set = (i, o) => Object.assign(P[i], { on: true }, o);
  switch (cls) {
    case 'REVENANT':
      for (let i = 0; i < 16; i++) if (r() < 0.55 || i === 0) set(i, { deg: pick([0, 0, 0, 1, 2, 4, 7, -2]), acc: r() < 0.3, slide: r() < 0.2 });
      break;
    case 'SHADE':
      for (let i = 0; i < 16; i++) if (i % 4 === 2 || r() < 0.08) set(i, { deg: pick([0, 0, 0, 0, 3, 4]), acc: i % 8 === 2 });
      break;
    case 'POLTERGEIST':
      for (let i = 0; i < 16; i++) if (r() < 0.38) set(i, { deg: Math.floor(r() * 10), acc: r() < 0.3 });
      break;
    case 'YOKAI':
      for (let i = 0; i < 16; i += 2) if (r() < 0.75) set(i, { deg: base + pick([0, 2, 4, 5, 7, 9]), acc: r() < 0.25 });
      for (let i = 1; i < 16; i += 2) if (r() < 0.15) set(i, { deg: base + pick([0, 2, 4, 7]) });
      break;
    case 'BANSHEE': {
      const st = pick([0, 2, 4]);
      set(st, { deg: base + pick([0, 2, 4, 7]), len: 6 + Math.floor(r() * 3), acc: true });
      if (r() < 0.8) set(st + 8, { deg: base + pick([-1, 1, 3, 5]), len: 5 + Math.floor(r() * 3) });
      break;
    }
    case 'SPECTER':
      for (let i = 0; i < 16; i++) if (r() < 0.2 || i === 0) set(i, { deg: base + pick([0, 2, 4, 6, 7, 9]), acc: r() < 0.4 });
      break;
    case 'PHANTOM':
      set(0, { deg: base, len: 8 });
      set(8, { deg: base + pick([-2, 1, 3, -3]), len: 8 });
      break;
    case 'WRAITH':
    default:
      set(0, { deg: base + pick([0, 0, 3, 5]), len: 16 });
  }
  return P;
}

export function defaultDrums() {
  const k = [], c = [], h = [];
  for (let i = 0; i < 16; i++) { k.push(i % 4 === 0); c.push(i === 4 || i === 12); h.push(i % 4 === 2); }
  return { kick: k, clap: c, hat: h };
}

// ---------------------------------------------------------------------------------
// Voices — one per ghost class
function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}

const VOICES = {
  // Grudge Pad: chord of detuned saws
  WRAITH(m, s, t) {
    const E = m.engine, ctx = E.ctx, dur = s.len * E.stepDur, h = m.p.haunt;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.02);
    g.connect(m.voiceBus);
    for (const off of [0, 2, 4]) {
      const f = E.noteFreq(s.deg + off, 1);
      for (const det of [-1, 1]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f; o.detune.value = det * (6 + h * 30);
        o.connect(g); o.start(t); o.stop(t + dur * 1.05);
      }
    }
  },
  // Wail Lead: gliding saw with vibrato and falling cry
  BANSHEE(m, s, t) {
    const E = m.engine, ctx = E.ctx, dur = s.len * E.stepDur, h = m.p.haunt;
    const f = E.noteFreq(s.deg, 2);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.5; lg.gain.value = 10 + h * 50;
    lfo.connect(lg).connect(o.detune);
    o.frequency.setValueAtTime(f * 1.12, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    o.frequency.setValueAtTime(f, t + dur * 0.7);
    o.frequency.exponentialRampToValueAtTime(f * (0.75 - h * 0.2), t + dur);
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 2600; lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.08);
    g.gain.setValueAtTime(0.09, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(m.voiceBus);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  },
  // Knock Perc: metallic click + filtered noise
  POLTERGEIST(m, s, t) {
    const E = m.engine, ctx = E.ctx, h = m.p.haunt;
    const n = noiseSrc(E), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 600 + s.deg * 350; bp.Q.value = 4 + h * 10;
    env(g, t, 0.001, s.acc ? 0.5 : 0.3, 0.04 + h * 0.15);
    n.connect(bp).connect(g).connect(m.voiceBus); n.start(t); n.stop(t + 0.3);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'square';
    o.frequency.value = 1200 + s.deg * 210;
    env(og, t, 0.001, 0.06, 0.03);
    o.connect(og).connect(m.voiceBus); o.start(t); o.stop(t + 0.1);
  },
  // Spirit Pluck
  YOKAI(m, s, t) {
    const E = m.engine, ctx = E.ctx, h = m.p.haunt;
    const f = E.noteFreq(s.deg, 2 + (m.ghost ? m.ghost.octave : 0));
    const g = ctx.createGain();
    env(g, t, 0.002, s.acc ? 0.2 : 0.14, 0.15 + h * 0.6);
    g.connect(m.voiceBus);
    for (const [type, mult, amp] of [['triangle', 1, 1], ['sine', 2, 0.4], ['square', 3, 0.05]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mult; og.gain.value = amp;
      o.connect(og).connect(g); o.start(t); o.stop(t + 1);
    }
  },
  // Acid Bass: resonant saw with filter envelope and slides
  REVENANT(m, s, t) {
    const E = m.engine, ctx = E.ctx, h = m.p.haunt, dur = E.stepDur;
    const f = E.noteFreq(s.deg, m.ghost ? m.ghost.octave : 0);
    const o = ctx.createOscillator(); o.type = h > 0.75 ? 'square' : 'sawtooth';
    if (s.slide && m.lastFreq) { o.frequency.setValueAtTime(m.lastFreq, t); o.frequency.exponentialRampToValueAtTime(f, t + dur * 0.6); }
    else o.frequency.value = f;
    m.lastFreq = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 14;
    const top = (600 + h * 3200) * (s.acc ? 1.7 : 1);
    lp.frequency.setValueAtTime(top, t); lp.frequency.exponentialRampToValueAtTime(140, t + 0.18 + h * 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(s.acc ? 0.2 : 0.14, t); g.gain.setValueAtTime(s.acc ? 0.2 : 0.14, t + dur * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * (s.slide ? 1.1 : 0.95));
    o.connect(lp).connect(g).connect(m.voiceBus); o.start(t); o.stop(t + dur * 1.2);
  },
  // Grave Bell: two-operator FM
  SPECTER(m, s, t) {
    const E = m.engine, ctx = E.ctx, h = m.p.haunt;
    const f = E.noteFreq(s.deg, 3);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    mod.frequency.value = f * (m.ghost && m.ghost.seed % 2 ? 3.5 : 1.41);
    mg.gain.setValueAtTime(f * (1 + h * 5), t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.8);
    car.frequency.value = f;
    mod.connect(mg).connect(car.frequency);
    env(g, t, 0.002, s.acc ? 0.13 : 0.08, 1.4);
    car.connect(g).connect(m.voiceBus);
    car.start(t); mod.start(t); car.stop(t + 1.6); mod.stop(t + 1.6);
  },
  // Veil Choir: saws through vowel formants
  PHANTOM(m, s, t) {
    const E = m.engine, ctx = E.ctx, dur = s.len * E.stepDur, h = m.p.haunt;
    const vowels = [[800, 1150, 2900], [450, 800, 2830], [325, 700, 2530]]; // a, o, u
    const vi = Math.min(2, Math.floor(h * 3)), V = vowels[vi];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const mix = ctx.createGain(); mix.gain.value = 1;
    for (const off of [0, 2, 4]) {
      for (const det of [-8, 9]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = E.noteFreq(s.deg + off, 2); o.detune.value = det;
        o.connect(mix); o.start(t); o.stop(t + dur + 0.05);
      }
    }
    for (const [i, fq] of V.entries()) {
      const bp = ctx.createBiquadFilter(), bg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 9; bg.gain.value = [0.18, 0.12, 0.05][i];
      mix.connect(bp).connect(bg).connect(g);
    }
    g.connect(m.voiceBus);
  },
  // Abyss Sub: off-beat sub with grit
  SHADE(m, s, t) {
    const E = m.engine, ctx = E.ctx, h = m.p.haunt, dur = E.stepDur * 1.6;
    const f = E.noteFreq(s.deg, -1);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    env(g, t, 0.004, s.acc ? 0.4 : 0.3, dur);
    o.connect(g).connect(m.voiceBus); o.start(t); o.stop(t + dur + 0.1);
    const s2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    s2.type = 'sawtooth'; s2.frequency.value = f * 2;
    lp.frequency.value = 180 + h * 700;
    env(g2, t, 0.004, 0.05 + h * 0.1, dur);
    s2.connect(lp).connect(g2).connect(m.voiceBus); s2.start(t); s2.stop(t + dur + 0.1);
  },
};

// ---------------------------------------------------------------------------------
// FX units
function makeFx(E, name) {
  const ctx = E.ctx;
  const input = ctx.createGain(), output = ctx.createGain();
  const stops = [];
  const lfo = (freq, depth, target) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = depth;
    o.connect(g).connect(target); o.start(); stops.push(o);
    return o;
  };
  let tempo = null;
  switch (name) {
    case 'delay': {
      const d = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      d.delayTime.value = E.stepDur * 3; fb.gain.value = 0.48; lp.frequency.value = 2800;
      input.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(output);
      tempo = sd => d.delayTime.setTargetAtTime(sd * 3, ctx.currentTime, 0.05);
      break;
    }
    case 'distort': {
      const pre = ctx.createGain(), ws = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
      pre.gain.value = 3; ws.curve = driveCurve(60); ws.oversample = '2x'; lp.frequency.value = 5000;
      const post = ctx.createGain(); post.gain.value = 0.4;
      input.connect(pre).connect(ws).connect(lp).connect(post).connect(output);
      break;
    }
    case 'crush': {
      const ws = ctx.createWaveShaper(); ws.curve = crushCurve(5);
      const lp = ctx.createBiquadFilter(); lp.frequency.value = 6000;
      input.connect(ws).connect(lp).connect(output);
      break;
    }
    case 'chorus': {
      for (const [rate, base] of [[0.7, 0.012], [1.1, 0.019]]) {
        const d = ctx.createDelay(0.1); d.delayTime.value = base;
        lfo(rate, 0.004, d.delayTime);
        input.connect(d).connect(output);
      }
      break;
    }
    case 'phaser': {
      let node = input;
      for (let i = 0; i < 4; i++) {
        const ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.frequency.value = 900; ap.Q.value = 0.8;
        lfo(0.25, 700, ap.frequency);
        node.connect(ap); node = ap;
      }
      node.connect(output);
      input.connect(output);
      break;
    }
    case 'tremolo': {
      const g = ctx.createGain(); g.gain.value = 0.5;
      const o = lfo(E.bpm / 60 * 2, 0.5, g.gain);
      o.type = 'square';
      input.connect(g).connect(output);
      tempo = sd => o.frequency.setTargetAtTime(1 / (sd * 2), ctx.currentTime, 0.05);
      break;
    }
    case 'ring': {
      const g = ctx.createGain(); g.gain.value = 0;
      lfo(220, 1, g.gain);
      input.connect(g).connect(output);
      break;
    }
    case 'reverb':
    default: {
      const cv = ctx.createConvolver(); cv.buffer = E.ir;
      const pd = ctx.createDelay(0.2); pd.delayTime.value = 0.03;
      input.connect(pd).connect(cv).connect(output);
    }
  }
  return {
    input, output, tempo,
    dispose() { for (const o of stops) { try { o.stop(); } catch (e) { } } try { input.disconnect(); } catch (e) { } },
  };
}

function driveCurve(k) {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x)); }
  return c;
}
function crushCurve(bits) {
  const n = 4096, c = new Float32Array(n), steps = Math.pow(2, bits);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = Math.round(x * steps) / steps; }
  return c;
}
function makeIR(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return b;
}
function makeNoise(ctx) {
  const len = ctx.sampleRate, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function noiseSrc(E) {
  const s = E.ctx.createBufferSource(); s.buffer = E.noise; s.loop = true;
  s.loopStart = Math.random() * 0.5; s.loopEnd = s.loopStart + 0.45;
  return s;
}
