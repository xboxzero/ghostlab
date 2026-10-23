// GHOST LAB — modular electronic music engine built on the Web Audio API.
//
// Signal flow of one module (ghost, drum or analog input):
//   voice ─┐
//   input ─┴─ filter ─ FX slot 1 ─ FX slot 2 ─ EQ low/mid/high ─ pan ─ fader ─ out ──> cables (other modules / master)
//                                                                              ├─ send A ──> Reverb bus
//                                                                              └─ send B ──> Echo bus
// Master: EQ ─ DJ filter ─ stutter ─ gate ─ crush ─ (+wash) ─ compressor ─ limiter ─ fader ─ endpoint
// Endpoint is either normal stereo or "sync out": clock pulses on LEFT, mono music on RIGHT
// (Pocket Operator / Volca style, for driving analog gear from the 3.5 mm jack).
import { rng } from './rng.js';
import { SCALES, DRUM_ROWS } from './genres.js';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

export const FX_NAMES = {
  none: '— none —',
  reverb: 'Cathedral Reverb', delay: 'Echo Crypt', pingpong: 'Ping-Pong Spirits', tape: 'Haunted Tape',
  distort: 'Hellfire Drive', crush: 'Bone Crusher', chorus: 'Choir of Many', phaser: 'Veil Phaser',
  flanger: 'Jet Wraith', wah: 'Banshee Wah', comb: 'Soul Resonator', tremolo: 'Heart Tremor', ring: 'Ring of Souls',
};

export class Engine {
  constructor() {
    this.ctx = null;
    this.bpm = 128;
    this.root = 45; // A2
    this.scale = SCALES.phrygian;
    this.swing = 0;
    this.playing = false;
    this.step = 0;
    this.bar = 0;
    this.modules = new Map();
    this.stepListeners = [];
    this.events = [];
    this.soloed = new Set();
    this.perf = { stutter: false, gate: false, wash: false, crush: false, stutterLen: 2 };
    this.sync = { out: false, outPpqn: 4 };
  }

  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'balanced' });
    this.ir = makeIR(ctx, 2.4);
    this.irLong = makeIR(ctx, 4.5);
    this.noise = makeNoise(ctx);

    this.masterIn = ctx.createGain();
    this.dcBlock = ctx.createBiquadFilter(); this.dcBlock.type = 'highpass'; this.dcBlock.frequency.value = 22; this.dcBlock.Q.value = 0.5;
    // master EQ
    this.mEq = eq3(ctx);
    // DJ filter: one knob, left = low-pass, right = high-pass
    this.djLP = ctx.createBiquadFilter(); this.djLP.type = 'lowpass'; this.djLP.frequency.value = 22000; this.djLP.Q.value = 0.9;
    this.djHP = ctx.createBiquadFilter(); this.djHP.type = 'highpass'; this.djHP.frequency.value = 10; this.djHP.Q.value = 0.9;
    // stutter (beat repeat): a delay line that loops its own contents when engaged
    this.stIn = ctx.createGain(); this.stDry = ctx.createGain(); this.stGate = ctx.createGain();
    this.stDelay = ctx.createDelay(4); this.stFb = ctx.createGain(); this.stWet = ctx.createGain(); this.stOut = ctx.createGain();
    this.stFb.gain.value = 0; this.stWet.gain.value = 0;
    this.stIn.connect(this.stDry).connect(this.stOut);
    this.stIn.connect(this.stGate).connect(this.stDelay); this.stDelay.connect(this.stFb).connect(this.stDelay);
    this.stDelay.connect(this.stWet).connect(this.stOut);
    // gate (trance chopper)
    this.gate = ctx.createGain();
    // crush
    this.crIn = ctx.createGain(); this.crDry = ctx.createGain(); this.crWet = ctx.createGain(); this.crOut = ctx.createGain();
    const crWs = ctx.createWaveShaper(); crWs.curve = crushCurve(3);
    this.crWet.gain.value = 0;
    this.crIn.connect(this.crDry).connect(this.crOut); this.crIn.connect(crWs).connect(this.crWet).connect(this.crOut);
    // wash: throw everything into a long reverb
    this.washSend = ctx.createGain(); this.washSend.gain.value = 0;
    const washVerb = this.washVerb = ctx.createConvolver(); washVerb.buffer = this.irLong;
    const washRet = ctx.createGain(); washRet.gain.value = 0.9;
    // dynamics
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.15;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3; this.limiter.knee.value = 0; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime); this.masterGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1.5); // gentle fade-in
    // Safety: a soft clipper after everything — nothing can leave the Lab louder than full scale
    this.guard = ctx.createAnalyser(); this.guard.fftSize = 512; this.guardData = new Float32Array(512); this.hot = 0;
    this.clipPre = ctx.createGain(); this.clipPre.gain.value = 0.5;
    this.clipper = ctx.createWaveShaper(); this.clipper.curve = softClipCurve(); this.clipper.oversample = '2x';
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;

    this.masterIn.connect(this.dcBlock).connect(this.mEq.input); this.mEq.output.connect(this.djLP).connect(this.djHP).connect(this.stIn);
    this.stOut.connect(this.gate).connect(this.crIn);
    this.crOut.connect(this.comp);
    this.crOut.connect(this.washSend); washVerb.connect(washRet).connect(this.comp); // washSend→washVerb only while Wash is held
    this.comp.connect(this.limiter).connect(this.masterGain).connect(this.clipPre).connect(this.clipper).connect(this.analyser);
    this.masterGain.connect(this.guard);

    // Endpoint: stereo, or sync-out (pulse L / mono music R)
    this.stereoOut = ctx.createGain();
    this.syncMusic = ctx.createGain(); this.syncMusic.gain.value = 0;
    this.syncMusic.channelCount = 1; this.syncMusic.channelCountMode = 'explicit'; this.syncMusic.channelInterpretation = 'speakers';
    this.pulseBus = ctx.createGain(); this.pulseBus.gain.value = 0;
    const merger = ctx.createChannelMerger(2);
    this.pulseBus.connect(merger, 0, 0); this.syncMusic.connect(merger, 0, 1);
    this.analyser.connect(this.stereoOut).connect(ctx.destination);
    this.analyser.connect(this.syncMusic);
    merger.connect(ctx.destination);

    this.recordDest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (this.recordDest) this.masterGain.connect(this.recordDest);

    // Send buses (returns feed the master)
    this.busA = makeBus(ctx, 'A'); // reverb
    const cv = ctx.createConvolver(); cv.buffer = this.ir;
    const pd = ctx.createDelay(0.2); pd.delayTime.value = 0.025;
    this.busA.input.connect(pd).connect(cv).connect(this.busA.ret);
    this.busB = makeBus(ctx, 'B'); // tempo echo
    this.busBDelay = ctx.createDelay(2); this.busBFb = ctx.createGain(); this.busBFb.gain.value = 0.45;
    const bLp = ctx.createBiquadFilter(); bLp.frequency.value = 3000; bLp.Q.value = 0.5;
    this.busB.input.connect(this.busBDelay); this.busBDelay.connect(bLp).connect(this.busBFb).connect(this.busBDelay); bLp.connect(this.busB.ret);
    for (const b of [this.busA, this.busB]) b.out.connect(this.masterIn);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.fftSize);
    this.setBpm(this.bpm);
  }

  get stepDur() { return 60 / this.bpm / 4; }

  setBpm(b) {
    this.bpm = Math.max(60, Math.min(220, Math.round(b * 10) / 10));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const m of this.modules.values()) m.tempo();
    this.busBDelay.delayTime.setTargetAtTime(this.stepDur * 3, t, 0.05);
    if (!this.perf.stutter) this.stDelay.delayTime.setTargetAtTime(this.stepDur * this.perf.stutterLen, t, 0.01);
  }
  setScale(name) { this.scale = SCALES[name] || SCALES.phrygian; }
  setRoot(midi) {
    this.root = midi;
    for (const m of this.modules.values()) m.tempo();
  }

  noteFreq(deg, oct) {
    const L = this.scale.length;
    const d = ((deg % L) + L) % L;
    const o = Math.floor(deg / L);
    return mtof(this.root + 12 * (oct + o) + this.scale[d]);
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
    this.soloed.delete(id);
    m.dispose();
    this.modules.delete(id);
    this.applySolo();
  }

  // --- solo ---
  setSolo(id, on) {
    if (on) this.soloed.add(id); else this.soloed.delete(id);
    this.applySolo();
  }
  applySolo() { for (const m of this.modules.values()) m.apply(); }
  audible(m) { return !m.muted && (!this.soloed.size || this.soloed.has(m.id)); }

  // --- patching ---
  canConnect(from, to) {
    if (from === to || from === 'master') return false;
    if (to === 'master') return true;
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
  chainDepth(id, seen = new Set()) {
    if (id === 'master') return 0;
    const m = this.modules.get(id);
    if (!m || seen.has(id)) return -Infinity;
    seen.add(id);
    let best = -Infinity;
    for (const d of m.dests) best = Math.max(best, this.chainDepth(d, new Set(seen)));
    return best + 1;
  }

  // --- master performance FX ---
  setDJ(v) { // -1 .. 1
    const t = this.ctx.currentTime;
    this.djValue = v;
    const lp = v < 0 ? 20000 * Math.pow(2, v * 8.5) : 22000;
    const hp = v > 0 ? 10 * Math.pow(2, v * 10) : 10;
    this.djLP.frequency.setTargetAtTime(lp, t, 0.02);
    this.djHP.frequency.setTargetAtTime(hp, t, 0.02);
  }
  setPerf(name, on) {
    const t = this.ctx.currentTime, P = this.perf;
    P[name] = on;
    if (name === 'stutter') {
      if (on) { // freeze what is already in the delay line and loop it
        this.stGate.gain.setValueAtTime(0, t); this.stFb.gain.setValueAtTime(1, t);
        this.stWet.gain.setValueAtTime(1, t); this.stDry.gain.setValueAtTime(0, t);
      } else {
        this.stGate.gain.setValueAtTime(1, t); this.stFb.gain.setValueAtTime(0, t);
        this.stWet.gain.setValueAtTime(0, t); this.stDry.gain.setValueAtTime(1, t);
        this.stDelay.delayTime.setValueAtTime(this.stepDur * P.stutterLen, t);
      }
    }
    if (name === 'gate' && !on) { this.gate.gain.cancelScheduledValues(t); this.gate.gain.setTargetAtTime(1, t, 0.005); }
    if (name === 'crush') { this.crWet.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.01); this.crDry.gain.setTargetAtTime(on ? 0.25 : 1, t, 0.01); }
    if (name === 'wash') {
      clearTimeout(this.washOff);
      if (on && !this.washOn) { this.washSend.connect(this.washVerb); this.washOn = true; }
      if (!on) this.washOff = setTimeout(() => { try { this.washSend.disconnect(this.washVerb); } catch (e) { } this.washOn = false; }, 6000);
      this.washSend.gain.setTargetAtTime(on ? 1.2 : 0, t, on ? 0.02 : 0.4);
      this.djHP.frequency.setTargetAtTime(on ? 700 : (this.djValue > 0 ? 10 * Math.pow(2, this.djValue * 10) : 10), t, on ? 0.4 : 0.1);
    }
  }
  setStutterLen(steps) { this.perf.stutterLen = steps; if (!this.perf.stutter) this.stDelay.delayTime.setValueAtTime(this.stepDur * steps, this.ctx.currentTime); }

  // --- endpoint ---
  setSyncOut(on, ppqn = 4) {
    this.sync.out = on; this.sync.outPpqn = ppqn;
    const t = this.ctx.currentTime;
    this.stereoOut.gain.setTargetAtTime(on ? 0 : 1, t, 0.01);
    this.syncMusic.gain.setTargetAtTime(on ? 1 : 0, t, 0.01);
    this.pulseBus.gain.setTargetAtTime(on ? 1 : 0, t, 0.01);
  }
  async outputDevices() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput'); } catch (e) { return []; }
  }
  canPickOutput() { return !!(this.ctx && this.ctx.setSinkId); }
  async setOutput(deviceId) {
    if (!this.canPickOutput()) throw new Error('This browser cannot choose an audio output. Try Chrome or Edge.');
    await this.ctx.setSinkId(deviceId === 'default' ? '' : deviceId);
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
  // External clock (analog sync in) can nudge the next step time
  alignTo(time) { if (this.playing) this.nextTime = time; }

  tick() {
    const now = this.ctx.currentTime;
    // If the tab was in the background (timers throttled), skip missed steps instead of
    // firing them all at once.
    if (this.nextTime < now - 0.05) {
      const missed = Math.ceil((now - this.nextTime) / this.stepDur);
      this.nextTime += missed * this.stepDur;
      this.step = (this.step + missed) % 16;
      this.bar += Math.floor(missed / 16);
    }
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
    this.watchdog();
    const ahead = now + 0.12;
    while (this.nextTime < ahead) {
      const s = this.step;
      const t = this.nextTime + (s % 2 ? this.swing * this.stepDur : 0);
      for (const m of this.modules.values()) {
        if (!this.audible(m) || !m.dests.size) continue;
        const vel = m.trigger(s, t);
        if (vel) this.events.push({ time: t, id: m.id, vel, step: s });
      }
      if (this.perf.gate) {
        this.gate.gain.setValueAtTime(1, t);
        this.gate.gain.setValueAtTime(0.0001, t + this.stepDur * 0.45);
      }
      if (this.sync.out && s % (4 / this.sync.outPpqn) === 0) {
        const c = this.ctx.createConstantSource ? this.ctx.createConstantSource() : null;
        if (c) { c.offset.value = 1; c.connect(this.pulseBus); c.start(this.nextTime); c.stop(this.nextTime + 0.015); }
      }
      for (const fn of this.stepListeners) fn(s, t, this.bar);
      this.nextTime += this.stepDur;
      this.step = (s + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }
  // Feedback guard: if the mix stays far above full scale for a second, flush every effect.
  watchdog() {
    this.guard.getFloatTimeDomainData(this.guardData);
    let peak = 0;
    for (let i = 0; i < this.guardData.length; i += 4) peak = Math.max(peak, Math.abs(this.guardData[i]));
    this.hot = peak > 1.8 ? this.hot + 1 : Math.max(0, this.hot - 2);
    if (this.hot > 40) { this.hot = 0; this.panic(); this.onPanic && this.onPanic(); }
  }
  // Kill every effect tail and feedback loop, keep the music playing.
  panic() {
    const t = this.ctx.currentTime;
    for (const m of this.modules.values()) { m.setFx(1, m.p.fx); m.setFx(2, m.p.fx2); m.apply(); }
    this.busBFb.gain.setValueAtTime(0, t); this.busBFb.gain.setValueAtTime(0.45, t + 0.6);
    for (const k of ['stutter', 'gate', 'wash', 'crush']) if (this.perf[k]) this.setPerf(k, false);
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setValueAtTime(0.3, t); this.masterGain.gain.linearRampToValueAtTime(this.masterLevel ?? 0.8, t + 1.5);
  }

  drainEvents() {
    if (!this.ctx) return [];
    const now = this.ctx.currentTime, out = [];
    this.events.sort((a, b) => a.time - b.time);
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

function makeBus(ctx, name) {
  const input = ctx.createGain(), ret = ctx.createGain(), out = ctx.createGain();
  const meter = ctx.createAnalyser(); meter.fftSize = 256;
  ret.connect(out); out.connect(meter);
  out.gain.value = 0.9;
  return { name, input, ret, out, meter, data: new Uint8Array(256), muted: false };
}
export function busLevel(b) {
  b.meter.getByteTimeDomainData(b.data);
  let peak = 0;
  for (let i = 0; i < b.data.length; i++) peak = Math.max(peak, Math.abs(b.data[i] - 128));
  return peak / 128;
}

function eq3(ctx) {
  const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 220;
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1100; mid.Q.value = 0.8;
  const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 4200;
  lo.connect(mid).connect(hi);
  return { input: lo, output: hi, lo, mid, hi };
}
export function setEq(e, low, mid, high, t) {
  e.lo.gain.setTargetAtTime(low, t, 0.03); e.mid.gain.setTargetAtTime(mid, t, 0.03); e.hi.gain.setTargetAtTime(high, t, 0.03);
}

// ---------------------------------------------------------------------------------
export class Module {
  constructor(engine, id, kind, opts = {}) {
    const ctx = engine.ctx;
    this.engine = engine; this.id = id; this.kind = kind; // class name, 'DRUM' or 'ANALOG'
    this.ghost = opts.ghost || null;
    this.modCut = 0;
    this.dests = new Set();
    this.muted = false;
    this.p = Object.assign({
      vol: 0.8, pan: 0, low: 0, mid: 0, high: 0, sendA: 0.12, sendB: 0,
      cutoff: 0.75, res: 0.2, fx: 'reverb', mix: 0.35, fx2: 'none', mix2: 0.3, haunt: 0.5,
    }, opts.fx ? { fx: opts.fx } : {}, opts.params || {});
    if (!FX_NAMES[this.p.fx]) this.p.fx = 'reverb';
    if (!FX_NAMES[this.p.fx2]) this.p.fx2 = 'none';

    this.input = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass';
    this.slot1 = makeSlot(ctx); this.slot2 = makeSlot(ctx);
    this.eq = eq3(ctx);
    this.pan = ctx.createStereoPanner();
    this.fader = ctx.createGain();
    this.out = ctx.createGain();
    this.sA = ctx.createGain(); this.sB = ctx.createGain();
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 256;
    this.meterData = new Uint8Array(256);

    this.input.connect(this.filter); this.voiceBus.connect(this.filter);
    this.filter.connect(this.slot1.input); this.slot1.output.connect(this.slot2.input);
    this.slot2.output.connect(this.eq.input); this.eq.output.connect(this.pan).connect(this.fader).connect(this.out);
    this.out.connect(this.meter);
    this.out.connect(this.sA).connect(engine.busA.input);
    this.out.connect(this.sB).connect(engine.busB.input);

    this.setFx(1, this.p.fx); this.setFx(2, this.p.fx2);
    this.apply();
    this.pattern = opts.pattern || (kind === 'DRUM' ? null : genPattern(kind, this.ghost));
    this.lastFreq = 0;
  }

  setFx(slot, name) {
    const S = slot === 1 ? this.slot1 : this.slot2;
    if (S.fx) { try { S.input.disconnect(S.fx.input); } catch (e) { } try { S.fx.output.disconnect(); } catch (e) { } S.fx.dispose(); S.fx = null; }
    this.p[slot === 1 ? 'fx' : 'fx2'] = name;
    if (name && name !== 'none') {
      S.fx = makeFx(this.engine, name, this);
      S.input.connect(S.fx.input);
      S.fx.output.connect(S.wet);
    }
  }
  tempo() { for (const S of [this.slot1, this.slot2]) S.fx && S.fx.tempo && S.fx.tempo(); }

  apply() {
    const t = this.engine.ctx.currentTime, p = this.p;
    this.filter.frequency.setTargetAtTime(Math.min(20000, 80 * Math.pow(2, Math.min(1, p.cutoff + this.modCut) * 8)), t, 0.03);
    this.filter.Q.setTargetAtTime(0.5 + p.res * 14, t, 0.03);
    for (const [S, fx, mix] of [[this.slot1, p.fx, p.mix], [this.slot2, p.fx2, p.mix2]]) {
      const on = fx && fx !== 'none';
      S.dry.gain.setTargetAtTime(on ? 1 - mix * 0.85 : 1, t, 0.03);
      S.wet.gain.setTargetAtTime(on ? mix * 1.1 : 0, t, 0.03);
    }
    setEq(this.eq, p.low, p.mid, p.high, t);
    this.pan.pan.setTargetAtTime(p.pan, t, 0.03);
    this.fader.gain.setTargetAtTime(this.engine.audible(this) ? p.vol : 0, t, 0.02);
    this.sA.gain.setTargetAtTime(p.sendA, t, 0.03);
    this.sB.gain.setTargetAtTime(p.sendB, t, 0.03);
  }
  setParam(k, v) {
    if (k === 'fx') this.setFx(1, v);
    else if (k === 'fx2') this.setFx(2, v);
    else this.p[k] = v;
    this.apply();
  }
  setMuted(m) { this.muted = m; this.apply(); }

  level() {
    this.meter.getByteTimeDomainData(this.meterData);
    let peak = 0;
    for (let i = 0; i < this.meterData.length; i++) peak = Math.max(peak, Math.abs(this.meterData[i] - 128));
    return peak / 128;
  }

  trigger(step, t) {
    if (this.kind === 'ANALOG') return 0;
    if (this.kind === 'DRUM') return this.drums(step, t);
    const s = this.pattern[step];
    if (!s || !s.on) return 0;
    VOICES[this.kind](this, s, t);
    return s.acc ? 1 : 0.7;
  }
  // Play one note right now (used by the analog trigger input)
  fire(vel = 1) {
    const t = this.engine.ctx.currentTime + 0.005;
    if (this.kind === 'DRUM') { DRUMS.kick(this, t, vel); return; }
    if (this.kind === 'ANALOG') return;
    const on = this.pattern.find(s => s.on) || { deg: 0, len: 2, acc: true };
    VOICES[this.kind](this, Object.assign({}, on, { acc: vel > 0.8 }), t);
  }

  drums(step, t) {
    let hit = 0;
    for (const row of DRUM_ROWS) {
      const v = this.pattern[row] && this.pattern[row][step];
      if (v) { DRUMS[row](this, t, v, step); hit = Math.max(hit, row === 'kick' ? 1 : 0.6); }
    }
    return hit;
  }

  dispose() {
    try { this.out.disconnect(); } catch (e) { }
    for (const S of [this.slot1, this.slot2]) S.fx && S.fx.dispose();
    if (this.source) try { this.source.disconnect(); } catch (e) { }
  }

  serialize() { return { p: this.p, muted: this.muted, pattern: this.kind === 'ANALOG' ? null : this.pattern }; }
}

function makeSlot(ctx) {
  const input = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), output = ctx.createGain();
  input.connect(dry).connect(output); wet.connect(output);
  wet.gain.value = 0;
  return { input, dry, wet, output, fx: null };
}

// ---------------------------------------------------------------------------------
// Pattern generation: a ghost's seed + the current genre's groove map.
export function genPattern(cls, ghost, salt = 0, genre = null) {
  const r = rng((ghost ? ghost.seed : 1) + salt * 7919 + (genre ? genre.id.length * 131 + genre.year : 0));
  const base = ghost ? ghost.degree : 0;
  const W = genre ? [...genre.groove].map(Number) : [6, 0, 3, 0, 6, 0, 3, 0, 6, 0, 3, 0, 6, 0, 3, 0];
  const B = genre ? [...genre.bass].map(c => c === 'x') : [...'..x...x...x...x.'].map(c => c === 'x');
  const P = [];
  const pick = a => a[Math.floor(r() * a.length)];
  for (let i = 0; i < 16; i++) P.push({ on: false, deg: 0, acc: false, slide: false, len: 1 });
  const set = (i, o) => Object.assign(P[i], { on: true }, o);
  switch (cls) {
    case 'REVENANT':
      for (let i = 0; i < 16; i++) if ((B[i] && r() < 0.85) || (!genre && r() < 0.5) || i === 0 && B[0]) set(i, { deg: pick([0, 0, 0, 1, 2, 4, 7, -2]), acc: W[i] >= 7 || r() < 0.2, slide: r() < 0.2 });
      break;
    case 'SHADE':
      for (let i = 0; i < 16; i++) if (B[i] && r() < 0.75) set(i, { deg: pick([0, 0, 0, 0, 3, 4]), acc: W[i] >= 7 });
      if (!P.some(s => s.on)) set(B.indexOf(true) >= 0 ? B.indexOf(true) : 2, { deg: 0 });
      break;
    case 'POLTERGEIST':
      for (let i = 0; i < 16; i++) if (r() < 0.12 + W[i] * 0.06) set(i, { deg: Math.floor(r() * 10), acc: W[i] >= 7 });
      break;
    case 'YOKAI':
      for (let i = 0; i < 16; i++) if (r() < W[i] * 0.1) set(i, { deg: base + pick([0, 2, 4, 5, 7, 9]), acc: W[i] >= 8 || r() < 0.2 });
      break;
    case 'BANSHEE': {
      const st = pick([0, 2, 4]);
      set(st, { deg: base + pick([0, 2, 4, 7]), len: 6 + Math.floor(r() * 3), acc: true });
      if (r() < 0.8) set(st + 8, { deg: base + pick([-1, 1, 3, 5]), len: 5 + Math.floor(r() * 3) });
      break;
    }
    case 'SPECTER':
      for (let i = 0; i < 16; i++) if (r() < 0.04 + W[i] * 0.035 || i === 0) set(i, { deg: base + pick([0, 2, 4, 6, 7, 9]), acc: r() < 0.4 });
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

export function emptyDrums() {
  const P = {};
  for (const r of DRUM_ROWS) P[r] = new Array(16).fill(0);
  return P;
}
// Upgrade an old-format (boolean kick/clap/hat) drum pattern
export function upgradeDrums(old) {
  const P = emptyDrums();
  if (!old) return null;
  for (const r of DRUM_ROWS) if (old[r]) P[r] = old[r].map(v => (v === true ? 1 : v === false ? 0 : v));
  if (old.clap) P.snare = old.clap.map(v => (v ? 1 : 0));
  return P;
}

// ---------------------------------------------------------------------------------
function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}
function noiseSrc(E) {
  const s = E.ctx.createBufferSource(); s.buffer = E.noise; s.loop = true;
  s.loopStart = Math.random() * 0.5; s.loopEnd = s.loopStart + 0.45;
  return s;
}

// Ritual Drum kit — every sound is synthesized
const LOG_DEGS = [0, 0, 4, 3, 0, 2, 0, 4];
const DRUMS = {
  kick(m, t, v) {
    const ctx = m.engine.ctx, h = m.p.haunt;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.09 + h * 0.06);
    g.gain.setValueAtTime(1.1 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3 + h * 0.35);
    o.connect(g).connect(m.voiceBus); o.start(t); o.stop(t + 0.8);
  },
  snare(m, t, v) {
    const ctx = m.engine.ctx;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011;
      const n = noiseSrc(m.engine), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
      g.gain.setValueAtTime(0.5 * v, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.18 : 0.03));
      n.connect(bp).connect(g).connect(m.voiceBus); n.start(tt); n.stop(tt + 0.25);
    }
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190;
    env(og, t, 0.001, 0.2 * v, 0.08);
    o.connect(og).connect(m.voiceBus); o.start(t); o.stop(t + 0.15);
  },
  hat(m, t, v) { hatVoice(m, t, v, 0.04, 0.14); },
  open(m, t, v) { hatVoice(m, t, v, 0.18, 0.2); },
  shaker(m, t, v) {
    const ctx = m.engine.ctx, n = noiseSrc(m.engine), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 9000;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(hp).connect(g).connect(m.voiceBus); n.start(t); n.stop(t + 0.08);
  },
  perc(m, t, v) { // rim / clave / ching
    const ctx = m.engine.ctx, o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1650; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6;
    env(g, t, 0.001, 0.35 * v, 0.03);
    o.connect(bp).connect(g).connect(m.voiceBus); o.start(t); o.stop(t + 0.06);
  },
  tom(m, t, v, step) { // dhol / kendang / tamborzão
    const ctx = m.engine.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    const f = step % 4 === 0 ? 110 : step % 2 ? 190 : 150;
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    env(g, t, 0.001, 0.45 * v, 0.18);
    o.connect(g).connect(m.voiceBus); o.start(t); o.stop(t + 0.3);
  },
  log(m, t, v, step) { // amapiano log drum: pitched, gliding, saturated
    const E = m.engine, ctx = E.ctx;
    const f = E.noteFreq(LOG_DEGS[step % 8], 0);
    const o = ctx.createOscillator(), ws = ctx.createWaveShaper(), g = ctx.createGain();
    ws.curve = driveCurve(8);
    o.frequency.setValueAtTime(f * 1.9, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    env(g, t, 0.003, 0.5 * v, 0.32);
    o.connect(ws).connect(g).connect(m.voiceBus); o.start(t); o.stop(t + 0.45);
  },
};
function hatVoice(m, t, v, dec, amp) {
  const ctx = m.engine.ctx, n = noiseSrc(m.engine), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 7000;
  g.gain.setValueAtTime(amp * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
  n.connect(hp).connect(g).connect(m.voiceBus); n.start(t); n.stop(t + dec + 0.05);
}

// Ghost voices — one per class
const VOICES = {
  WRAITH(m, s, t) { // Grudge Pad
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
  BANSHEE(m, s, t) { // Wail Lead
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
  POLTERGEIST(m, s, t) { // Knock Perc
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
  YOKAI(m, s, t) { // Spirit Pluck
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
  REVENANT(m, s, t) { // Acid Bass
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
  SPECTER(m, s, t) { // Grave Bell (2-op FM)
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
  PHANTOM(m, s, t) { // Veil Choir
    const E = m.engine, ctx = E.ctx, dur = s.len * E.stepDur, h = m.p.haunt;
    const vowels = [[800, 1150, 2900], [450, 800, 2830], [325, 700, 2530]];
    const V = vowels[Math.min(2, Math.floor(h * 3))];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const mix = ctx.createGain();
    for (const off of [0, 2, 4]) for (const det of [-8, 9]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = E.noteFreq(s.deg + off, 2); o.detune.value = det;
      o.connect(mix); o.start(t); o.stop(t + dur + 0.05);
    }
    for (const [i, fq] of V.entries()) {
      const bp = ctx.createBiquadFilter(), bg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 9; bg.gain.value = [0.18, 0.12, 0.05][i];
      mix.connect(bp).connect(bg).connect(g);
    }
    g.connect(m.voiceBus);
  },
  SHADE(m, s, t) { // Abyss Sub
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
function makeFx(E, name, mod) {
  const ctx = E.ctx;
  const input = ctx.createGain(), output = ctx.createGain();
  const stops = [];
  const lfo = (freq, depth, target, type = 'sine') => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = depth;
    o.connect(g).connect(target); o.start(); stops.push(o);
    return o;
  };
  let tempo = null;
  switch (name) {
    case 'delay': {
      const d = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      d.delayTime.value = E.stepDur * 3; fb.gain.value = 0.42; lp.frequency.value = 2800; lp.Q.value = 0.5;
      input.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(output);
      tempo = () => d.delayTime.setTargetAtTime(E.stepDur * 3, ctx.currentTime, 0.05);
      break;
    }
    case 'pingpong': {
      const dl = ctx.createDelay(2), dr = ctx.createDelay(2), fbl = ctx.createGain(), fbr = ctx.createGain();
      const merge = ctx.createChannelMerger(2), mono = ctx.createGain();
      mono.channelCount = 1; mono.channelCountMode = 'explicit';
      dl.delayTime.value = dr.delayTime.value = E.stepDur * 2; fbl.gain.value = fbr.gain.value = 0.45;
      input.connect(mono).connect(dl); dl.connect(fbl).connect(dr); dr.connect(fbr).connect(dl);
      dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); merge.connect(output);
      tempo = () => { dl.delayTime.setTargetAtTime(E.stepDur * 2, ctx.currentTime, 0.05); dr.delayTime.setTargetAtTime(E.stepDur * 2, ctx.currentTime, 0.05); };
      break;
    }
    case 'tape': { // wobbly, saturated tape echo
      const d = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper();
      d.delayTime.value = E.stepDur * 4; fb.gain.value = 0.5; lp.frequency.value = 1800; lp.Q.value = 0.5; ws.curve = driveCurve(6);
      lfo(0.6, 0.004, d.delayTime);
      input.connect(d); d.connect(lp).connect(ws).connect(fb).connect(d); ws.connect(output);
      tempo = () => d.delayTime.setTargetAtTime(E.stepDur * 4, ctx.currentTime, 0.05);
      break;
    }
    case 'distort': {
      const pre = ctx.createGain(), ws = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), post = ctx.createGain();
      pre.gain.value = 3; ws.curve = driveCurve(60); ws.oversample = '2x'; lp.frequency.value = 5000; post.gain.value = 0.4;
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
    case 'flanger': {
      const d = ctx.createDelay(0.05), fb = ctx.createGain();
      d.delayTime.value = 0.004; fb.gain.value = 0.55;
      lfo(0.2, 0.003, d.delayTime);
      const o2 = ctx.createGain(); o2.gain.value = 0.6;
      input.connect(d); d.connect(fb).connect(d); d.connect(o2); input.connect(o2); o2.connect(output);
      break;
    }
    case 'phaser': {
      let node = input;
      for (let i = 0; i < 4; i++) {
        const ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.frequency.value = 900; ap.Q.value = 0.8;
        lfo(0.25, 700, ap.frequency);
        node.connect(ap); node = ap;
      }
      node.connect(output); input.connect(output);
      break;
    }
    case 'wah': {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 7;
      const o = lfo(E.bpm / 60 / 2, 900, bp.frequency);
      const g = ctx.createGain(); g.gain.value = 1.2;
      input.connect(bp).connect(g).connect(output);
      tempo = () => o.frequency.setTargetAtTime(E.bpm / 60 / 2, ctx.currentTime, 0.05);
      break;
    }
    case 'comb': { // resonator tuned to the current key
      const d = ctx.createDelay(0.1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      fb.gain.value = 0.72; lp.frequency.value = 4000; lp.Q.value = 0.5; // loop gain stays well below 1
      const trim = ctx.createGain(); trim.gain.value = 0.4;
      const tune = () => d.delayTime.setTargetAtTime(1 / E.noteFreq(0, 2), ctx.currentTime, 0.02);
      tune();
      input.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(trim).connect(output);
      tempo = tune;
      break;
    }
    case 'tremolo': {
      const g = ctx.createGain(); g.gain.value = 0.5;
      const o = lfo(E.bpm / 60 * 2, 0.5, g.gain, 'square');
      input.connect(g).connect(output);
      tempo = () => o.frequency.setTargetAtTime(E.bpm / 60 * 2, ctx.currentTime, 0.05);
      break;
    }
    case 'ring': {
      const g = ctx.createGain(); g.gain.value = 0;
      const o = lfo(E.noteFreq(4, 2), 1, g.gain);
      input.connect(g).connect(output);
      tempo = () => o.frequency.setTargetAtTime(E.noteFreq(4, 2), ctx.currentTime, 0.05);
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
// Unity gain below 0.7, then a smooth knee that never exceeds 0.98. The shaper is fed at
// half level (clipPre) so inputs up to 2x full scale still land on the curve.
function softClipCurve() {
  const n = 8192, c = new Float32Array(n);
  const f = y => { const a = Math.abs(y); return Math.sign(y) * (a < 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28)); };
  for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; c[i] = f(2 * x); }
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
