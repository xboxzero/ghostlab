// GHOST LAB — Analog interface. Plug a hardware synth (or drum machine, modular, Volca,
// Pocket Operator…) into the computer's 3.5 mm line/mic input and:
//   • hear it as a module in the Lab, patchable through any ghost's FX (serial)
//   • PITCH FOLLOW: the note you hold sets the key every ghost plays in
//   • ENVELOPE: its loudness modulates ghost filters, the DJ filter, or pumps the mix
//   • SYNC IN: clock pulses set the tempo and phase-lock the sequencer
//   • TRIGGER: each note / hit fires a ghost of your choice
// And the other way: SYNC OUT puts clock pulses on the LEFT output channel (mono music on
// the RIGHT) so the Lab can drive gear with a sync input from the headphone jack.
import { noteName } from './audio.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Analog {
  constructor(engine, hooks) {
    this.E = engine; this.hooks = hooks;
    this.on = false;
    this.cfg = Object.assign({
      device: '', gain: 1, pitch: false, envTarget: 'none', envAmount: 0.6,
      syncIn: false, ppqn: 4, autoStart: true, trig: false, trigTarget: 'drum', threshold: 0.25,
      syncOut: false, outPpqn: 4,
    }, hooks.saved || {});
    this.env = 0; this.note = null; this.noteHist = []; this.onsets = []; this.bpmIn = null;
    this.lastPitchAt = 0; this.lastModAt = 0;
  }

  async inputs() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) { return []; }
  }

  async enable() {
    const E = this.E; E.init(); await E.ctx.resume();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser has no audio input support.');
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };
    if (this.cfg.device) audio.deviceId = { exact: this.cfg.device };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    const ctx = E.ctx;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.trim = ctx.createGain(); this.trim.gain.value = this.cfg.gain;
    this.an = ctx.createAnalyser(); this.an.fftSize = 2048;
    this.buf = new Float32Array(this.an.fftSize);
    this.src.connect(this.trim); this.trim.connect(this.an);
    if (!this.workletReady) { await ctx.audioWorklet.addModule('js/detector-worklet.js'); this.workletReady = true; }
    this.det = new AudioWorkletNode(ctx, 'ghost-detector');
    this.det.port.postMessage({ threshold: this.cfg.threshold });
    this.det.port.onmessage = e => this.onMsg(e.data);
    this.trim.connect(this.det);
    this.on = true;
    this.hooks.onEnable(this.trim);
  }

  disable() {
    if (!this.on) return;
    try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) { }
    try { this.src.disconnect(); this.trim.disconnect(); this.det.disconnect(); } catch (e) { }
    this.on = false;
    this.E.masterIn.gain.setTargetAtTime(1, this.E.ctx.currentTime, 0.05);
    this.hooks.onDisable();
  }

  onMsg(m) {
    if (m.type === 'env') { this.env = m.level; return; }
    if (m.type !== 'onset') return;
    const E = this.E, c = this.cfg;
    if (c.trig) {
      const mod = E.modules.get(c.trigTarget);
      if (mod) { mod.fire(Math.min(1, m.level * 2)); E.events.push({ time: E.ctx.currentTime, id: mod.id, vel: 1 }); }
    }
    if (c.syncIn) {
      this.onsets.push(m.time);
      if (this.onsets.length > 8) this.onsets.shift();
      const iv = [];
      for (let i = 1; i < this.onsets.length; i++) iv.push(this.onsets[i] - this.onsets[i - 1]);
      const recent = iv.slice(-4);
      if (recent.length >= 3) {
        const med = [...recent].sort((a, b) => a - b)[1];
        if (recent.every(x => Math.abs(x - med) / med < 0.15)) {
          const bpm = 60 / (med * c.ppqn);
          if (bpm >= 60 && bpm <= 220) {
            this.bpmIn = bpm;
            if (Math.abs(bpm - E.bpm) > 0.4) { E.setBpm(bpm); this.hooks.onBpm(); }
            if (!E.playing && c.autoStart) this.hooks.start();
          }
        }
      }
      // phase-lock: put the next step on the pulse grid
      if (E.playing) {
        const per = (4 / c.ppqn) * E.stepDur;
        let tn = m.time;
        while (tn < E.nextTime - per / 2) tn += per;
        const off = tn - E.nextTime;
        if (Math.abs(off) > 0.008 && Math.abs(off) < per / 2) E.alignTo(tn);
      }
    }
  }

  // per animation frame
  update() {
    if (!this.on) return;
    const E = this.E, c = this.cfg, now = performance.now();
    if (c.pitch && now - this.lastPitchAt > 70) {
      this.lastPitchAt = now;
      this.an.getFloatTimeDomainData(this.buf);
      const f = detectPitch(this.buf, E.ctx.sampleRate);
      if (f > 0) {
        const midi = Math.round(69 + 12 * Math.log2(f / 440));
        this.noteHist.push(midi); if (this.noteHist.length > 3) this.noteHist.shift();
        if (this.noteHist.length === 3 && this.noteHist.every(n => n === midi)) {
          this.note = midi;
          const pc = ((midi % 12) + 12) % 12, root = 36 + pc + (pc > 6 ? 0 : 12);
          if (root !== E.root) { E.setRoot(root); this.hooks.onKey(root); }
        }
      }
    }
    if (now - this.lastModAt > 30) {
      this.lastModAt = now;
      const v = Math.min(1, this.env * 2.5) * c.envAmount;
      const t = E.ctx.currentTime;
      if (c.envTarget === 'cutoff') for (const m of E.modules.values()) { if (m.kind !== 'ANALOG') { m.modCut = v * 0.6; m.apply(); } }
      if (c.envTarget === 'dj') E.setDJ(-0.9 + v * 0.9);
      if (c.envTarget === 'duck') E.masterIn.gain.setTargetAtTime(1 - Math.min(0.85, v), t, 0.01);
      if (c.envTarget === 'haunt') for (const m of E.modules.values()) if (m.ghost) m.p.haunt = Math.min(1, 0.2 + v);
    }
  }

  setTarget(t) {
    const E = this.E;
    if (this.cfg.envTarget === 'cutoff') for (const m of E.modules.values()) { m.modCut = 0; m.apply(); }
    if (this.cfg.envTarget === 'dj') E.setDJ(0);
    if (this.cfg.envTarget === 'duck') E.masterIn.gain.setTargetAtTime(1, E.ctx.currentTime, 0.05);
    this.cfg.envTarget = t;
  }

  async render(root) {
    const c = this.cfg, E = this.E;
    const ins = this.on || this.cfg.device ? await this.inputs() : [];
    const outs = E.ctx ? await E.outputDevices() : [];
    const targets = [['drum', 'Ritual Drum'], ...[...E.modules.values()].filter(m => m.ghost).map(m => [m.id, m.ghost.name])];
    root.innerHTML = `
      <section class="an-sec">
        <h4>LINE IN · 3.5 mm</h4>
        <p class="hint">Connect your synth's output to the computer's line-in (or a USB audio interface). Turn down speakers first if using a microphone jack.</p>
        <div class="row"><button data-a="toggle" class="${this.on ? 'on' : ''}">${this.on ? '■ Disconnect' : '⏻ Connect analog input'}</button>
        <span class="meterbox"><i id="an-meter"></i></span></div>
        ${ins.length ? `<label class="slider">INPUT DEVICE<select data-c="device"><option value="">Default input</option>${ins.map(d => `<option value="${esc(d.deviceId)}" ${d.deviceId === c.device ? 'selected' : ''}>${esc(d.label || 'Input ' + d.deviceId.slice(0, 5))}</option>`).join('')}</select></label>` : ''}
        <label class="slider">INPUT GAIN<input type="range" min="0" max="4" step="0.01" value="${c.gain}" data-c="gain"></label>
        <label class="slider">TRIGGER THRESHOLD<input type="range" min="0.02" max="0.9" step="0.01" value="${c.threshold}" data-c="threshold"></label>
        <p class="hint">The input appears in the Lab as <b>ANALOG IN</b> — patch it into a ghost to run your synth through its effects.</p>
      </section>
      <section class="an-sec">
        <h4>CONTROL FROM YOUR SYNTH</h4>
        <label class="chk"><input type="checkbox" data-c="pitch" ${c.pitch ? 'checked' : ''}> PITCH FOLLOW — held note sets the key <b id="an-note">${this.note != null ? noteName(this.note) : '—'}</b></label>
        <label class="slider">ENVELOPE →<select data-c="envTarget">${[['none', 'nothing'], ['cutoff', 'ghost filters (open with loudness)'], ['dj', 'master DJ filter'], ['duck', 'sidechain duck / pump'], ['haunt', 'ghost Haunt']].map(([k, v]) => `<option value="${k}" ${k === c.envTarget ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="slider">ENVELOPE AMOUNT<input type="range" min="0" max="1" step="0.01" value="${c.envAmount}" data-c="envAmount"></label>
        <label class="chk"><input type="checkbox" data-c="trig" ${c.trig ? 'checked' : ''}> TRIGGER — each hit fires</label>
        <select data-c="trigTarget">${targets.map(([k, v]) => `<option value="${k}" ${k === c.trigTarget ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      </section>
      <section class="an-sec">
        <h4>SYNC IN · clock from your gear</h4>
        <label class="chk"><input type="checkbox" data-c="syncIn" ${c.syncIn ? 'checked' : ''}> Follow clock pulses <b id="an-bpm">${this.bpmIn ? this.bpmIn.toFixed(1) + ' BPM' : ''}</b></label>
        <label class="slider">PULSES<select data-c="ppqn">${[[4, '1 per 16th (Volca, many modular)'], [2, '1 per 8th (Pocket Operator)'], [1, '1 per beat']].map(([k, v]) => `<option value="${k}" ${+k === +c.ppqn ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="chk"><input type="checkbox" data-c="autoStart" ${c.autoStart ? 'checked' : ''}> Start playing on first pulses</label>
      </section>
      <section class="an-sec">
        <h4>SYNC OUT · drive your gear</h4>
        <label class="chk"><input type="checkbox" data-c="syncOut" ${c.syncOut ? 'checked' : ''}> Clock pulses on LEFT · mono music on RIGHT</label>
        <label class="slider">PULSES<select data-c="outPpqn">${[[4, '1 per 16th (Volca)'], [2, '1 per 8th (Pocket Operator)'], [1, '1 per beat']].map(([k, v]) => `<option value="${k}" ${+k === +c.outPpqn ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <p class="hint">Use a stereo-to-dual-mono splitter cable: left → your synth's SYNC IN, right → your mixer. Turn output volume up. Built-in headphone jacks can't send DC control voltage (CV); that needs a DC-coupled interface.</p>
        ${outs.length && E.canPickOutput() ? `<label class="slider">OUTPUT DEVICE<select data-out>${outs.map(d => `<option value="${esc(d.deviceId)}">${esc(d.label || d.deviceId.slice(0, 8))}</option>`).join('')}</select></label>` : ''}
      </section>`;
    root.querySelector('[data-a="toggle"]').onclick = async () => {
      try { if (this.on) this.disable(); else await this.enable(); }
      catch (e) { this.hooks.toast(e.name === 'NotAllowedError' ? 'Input permission was denied.' : 'Could not open input: ' + e.message); }
      this.render(root); this.hooks.save();
    };
    root.querySelectorAll('[data-c]').forEach(el => {
      el.onchange = el.oninput = async () => {
        const k = el.dataset.c;
        let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
        if (k === 'ppqn' || k === 'outPpqn') v = +v;
        if (k === 'envTarget') this.setTarget(v); else c[k] = v;
        if (k === 'gain' && this.trim) this.trim.gain.setTargetAtTime(v, E.ctx.currentTime, 0.02);
        if (k === 'threshold' && this.det) this.det.port.postMessage({ threshold: v });
        if (k === 'syncIn') this.onsets = [];
        if (k === 'syncOut' || k === 'outPpqn') { E.init(); E.setSyncOut(c.syncOut, c.outPpqn); }
        if (k === 'device' && this.on && el.type !== 'range') { this.disable(); try { await this.enable(); } catch (e) { this.hooks.toast(e.message); } this.render(root); }
        this.hooks.save();
      };
    });
    const out = root.querySelector('[data-out]');
    if (out) out.onchange = async () => { try { await E.setOutput(out.value); this.hooks.toast('Output switched.'); } catch (e) { this.hooks.toast(e.message); } };
  }

  // live readouts in the open panel
  paint() {
    const m = document.getElementById('an-meter');
    if (m) m.style.width = Math.min(100, this.env * 200) + '%';
    const n = document.getElementById('an-note');
    if (n) n.textContent = this.note != null ? noteName(this.note) : '—';
    const b = document.getElementById('an-bpm');
    if (b) b.textContent = this.bpmIn ? this.bpmIn.toFixed(1) + ' BPM' : '';
  }
}

// Autocorrelation pitch detector (returns Hz, or -1 when unpitched/quiet)
export function detectPitch(buf, sr) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.015) return -1;
  const N = buf.length, maxLag = Math.floor(sr / 40), minLag = Math.floor(sr / 1500);
  let best = -1, bestCorr = 0;
  const c = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < N - lag; i++) s += buf[i] * buf[i + lag];
    c[lag] = s;
  }
  let e0 = 0; for (let i = 0; i < N; i++) e0 += buf[i] * buf[i];
  // first strong peak after the first dip
  let lag = minLag;
  while (lag < maxLag && c[lag] > 0) lag++;
  for (; lag <= maxLag; lag++) if (c[lag] > bestCorr) { bestCorr = c[lag]; best = lag; }
  if (best < 0 || bestCorr / e0 < 0.3) return -1;
  const a = c[best - 1] || 0, b = c[best], d = c[best + 1] || 0;
  const shift = (a - d) / (2 * (a - 2 * b + d) || 1);
  return sr / (best + shift);
}
