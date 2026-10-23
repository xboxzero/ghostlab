// GHOST LAB — the Mixer: one channel strip per module, two FX return buses and a master
// section with EQ, DJ filter, hold-to-play performance FX and the output endpoint.
import { REALMS } from './data.js';
import { portraitURL } from './portrait.js';
import { FX_NAMES, busLevel, setEq } from './audio.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fxOpts = sel => Object.entries(FX_NAMES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
export const PERF = [['stutter', 'STUTTER', '1'], ['gate', 'GATE', '2'], ['wash', 'WASH', '3'], ['crush', 'CRUSH', '4']];

export class Mixer {
  constructor(root, engine, hooks) {
    this.root = root; this.E = engine; this.hooks = hooks;
    this.strips = root.querySelector('.strips');
    this.master = root.querySelector('.masterbox');
    this.key = '';
    this.master.innerHTML = this.masterHTML();
    this.bindMaster();
  }

  name(m) {
    if (m.kind === 'DRUM') return 'Ritual Drum';
    if (m.kind === 'ANALOG') return 'Analog In';
    return m.ghost.name;
  }

  stripHTML(m) {
    const p = m.p, col = m.ghost ? REALMS[m.ghost.realm].color : m.kind === 'ANALOG' ? '#05ffa1' : '#fcee0a';
    const knob = (k, label, min, max, step = 0.01) => `<label class="kn"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${p[k]}" data-k="${k}"></label>`;
    return `<div class="strip ${m.muted ? 'muted' : ''} ${this.E.soloed.has(m.id) ? 'soloed' : ''}" data-id="${m.id}" style="--rc:${col}">
      <div class="s-head">${m.ghost ? `<img src="${portraitURL(m.ghost)}" alt="">` : `<i class="s-ico ${m.kind === 'ANALOG' ? 'jack' : 'drum'}"></i>`}<span title="${esc(this.name(m))}">${esc(this.name(m))}</span></div>
      <select data-k="fx" title="FX slot 1">${fxOpts(p.fx)}</select>
      <select data-k="fx2" title="FX slot 2">${fxOpts(p.fx2)}</select>
      <div class="kgrid">${knob('mix', 'FX1', 0, 1)}${knob('mix2', 'FX2', 0, 1)}
      ${knob('high', 'HI', -15, 15, 0.5)}${knob('mid', 'MID', -15, 15, 0.5)}${knob('low', 'LO', -15, 15, 0.5)}${knob('pan', 'PAN', -1, 1)}
      ${knob('sendA', 'SND A', 0, 1)}${knob('sendB', 'SND B', 0, 1)}</div>
      <div class="fadewrap"><input class="fader" type="range" min="0" max="1.2" step="0.01" value="${p.vol}" data-k="vol" aria-label="Fader"><div class="vu"><i></i></div></div>
      <div class="ms"><button data-m="mute" class="${m.muted ? 'on' : ''}">M</button><button data-m="solo" class="${this.E.soloed.has(m.id) ? 'on solo' : ''}">S</button></div>
    </div>`;
  }

  busHTML(b, label, sub) {
    return `<div class="strip bus" data-bus="${b.name}" style="--rc:#00f0ff">
      <div class="s-head"><i class="s-ico bus"></i><span>${label}</span></div>
      <div class="bus-sub">${sub}</div>
      <div class="fadewrap"><input class="fader" type="range" min="0" max="1.4" step="0.01" value="${b.out.gain.value}" data-bus-vol aria-label="Return level"><div class="vu"><i></i></div></div>
      <div class="ms"><button data-bus-mute class="${b.muted ? 'on' : ''}">M</button></div>
    </div>`;
  }

  masterHTML() {
    return `<div class="strip masterstrip">
      <div class="s-head"><i class="s-ico fire"></i><span>THE BONFIRE</span></div>
      <div class="kgrid three"><label class="kn"><span>HI</span><input type="range" min="-15" max="15" step="0.5" value="0" data-meq="hi"></label>
      <label class="kn"><span>MID</span><input type="range" min="-15" max="15" step="0.5" value="0" data-meq="mid"></label>
      <label class="kn"><span>LO</span><input type="range" min="-15" max="15" step="0.5" value="0" data-meq="lo"></label></div>
      <label class="kn dj"><span>DJ FILTER  ◀ LP · HP ▶</span><input type="range" min="-1" max="1" step="0.01" value="0" data-dj></label>
      <div class="pads">${PERF.map(([k, l, key]) => `<button class="pad" data-perf="${k}" title="Hold (key ${key})">${l}<small>${key}</small></button>`).join('')}</div>
      <label class="kn"><span>STUTTER LENGTH</span><select data-stlen><option value="1">1/16</option><option value="2" selected>1/8</option><option value="4">1/4</option><option value="8">1/2</option></select></label>
      <div class="fadewrap"><input class="fader" type="range" min="0" max="1.2" step="0.01" value="0.8" data-master aria-label="Master"><div class="vu"><i></i></div></div>
      <div class="endpoint"><span>ENDPOINT</span><select data-out><option value="default">System default output</option></select>
      <button data-a="rec" class="rec">● REC</button><button data-a="panic" class="danger" title="Reset every effect and feedback loop (P)">⚠ PANIC</button></div>
    </div>`;
  }

  bindMaster() {
    const M = this.master, E = this.E;
    M.querySelectorAll('[data-meq]').forEach(i => i.oninput = () => {
      const v = k => +M.querySelector(`[data-meq="${k}"]`).value;
      E.init(); setEq(E.mEq, v('lo'), v('mid'), v('hi'), E.ctx.currentTime);
    });
    M.querySelector('[data-dj]').oninput = e => { E.init(); E.setDJ(+e.target.value); };
    M.querySelector('[data-dj]').ondblclick = e => { e.target.value = 0; E.setDJ(0); };
    M.querySelector('[data-master]').oninput = e => { E.init(); E.masterLevel = +e.target.value; E.masterGain.gain.setTargetAtTime(E.masterLevel, E.ctx.currentTime, 0.02); };
    M.querySelector('[data-stlen]').onchange = e => { E.init(); E.setStutterLen(+e.target.value); };
    M.querySelectorAll('[data-perf]').forEach(b => {
      const on = e => { e.preventDefault(); this.perf(b.dataset.perf, true); b.setPointerCapture && e.pointerId != null && b.setPointerCapture(e.pointerId); };
      const off = () => this.perf(b.dataset.perf, false);
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
    });
    M.querySelector('[data-a="rec"]').onclick = () => this.hooks.record();
    M.querySelector('[data-a="panic"]').onclick = () => this.hooks.panic();
    const out = M.querySelector('[data-out]');
    out.onfocus = () => this.fillOutputs();
    out.onchange = async () => {
      try { await E.setOutput(out.value); this.hooks.toast('Endpoint: ' + out.selectedOptions[0].textContent); }
      catch (e) { this.hooks.toast(e.message); out.value = 'default'; }
    };
  }

  async fillOutputs() {
    const out = this.master.querySelector('[data-out]');
    if (!this.E.ctx || out.options.length > 1) return;
    if (!this.E.canPickOutput()) { out.title = 'Choosing an output needs Chrome or Edge.'; return; }
    for (const d of await this.E.outputDevices()) {
      if (d.deviceId === 'default' || !d.deviceId) continue;
      const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || 'Output ' + d.deviceId.slice(0, 6);
      out.appendChild(o);
    }
  }

  perf(name, on) {
    if (!this.E.ctx || this.E.perf[name] === on) return;
    this.E.setPerf(name, on);
    this.master.querySelector(`[data-perf="${name}"]`)?.classList.toggle('on', on);
    if (on) this.hooks.onPerf(name);
  }

  render() {
    const E = this.E;
    const mods = [...E.modules.values()].filter(m => !String(m.id).startsWith('preview'));
    this.key = mods.map(m => m.id).join(',');
    this.strips.innerHTML = mods.map(m => this.stripHTML(m)).join('') +
      this.busHTML(E.busA, 'RETURN A', 'Cathedral Reverb') + this.busHTML(E.busB, 'RETURN B', 'Tempo Echo');
    this.strips.querySelectorAll('.strip[data-id]').forEach(el => {
      const m = E.modules.get(el.dataset.id);
      el.querySelectorAll('[data-k]').forEach(inp => {
        const k = inp.dataset.k;
        const set = () => { m.setParam(k, inp.tagName === 'SELECT' ? inp.value : +inp.value); this.hooks.onChange(); };
        if (inp.tagName === 'SELECT') inp.onchange = set; else inp.oninput = set;
        if (inp.type === 'range') inp.ondblclick = () => { inp.value = { vol: 0.8, pan: 0, low: 0, mid: 0, high: 0 }[k] ?? inp.value; set(); };
      });
      el.querySelector('[data-m="mute"]').onclick = () => { m.setMuted(!m.muted); this.render(); this.hooks.onChange(); };
      el.querySelector('[data-m="solo"]').onclick = () => { E.setSolo(m.id, !E.soloed.has(m.id)); this.render(); this.hooks.onSolo(); };
    });
    for (const b of [E.busA, E.busB]) {
      const el = this.strips.querySelector(`[data-bus="${b.name}"]`);
      el.querySelector('[data-bus-vol]').oninput = e => { b.level = +e.target.value; if (!b.muted) b.out.gain.setTargetAtTime(b.level, E.ctx.currentTime, 0.02); };
      el.querySelector('[data-bus-mute]').onclick = () => { b.muted = !b.muted; b.out.gain.setTargetAtTime(b.muted ? 0 : (b.level ?? 0.9), E.ctx.currentTime, 0.02); this.render(); };
    }
  }

  update() {
    const E = this.E;
    if (!E.ctx) return;
    const key = [...E.modules.keys()].filter(id => !String(id).startsWith('preview')).join(',');
    if (key !== this.key) this.render();
    this.strips.querySelectorAll('.strip[data-id]').forEach(el => {
      const m = E.modules.get(el.dataset.id);
      if (m) el.querySelector('.vu i').style.height = Math.min(100, m.level() * 140) + '%';
    });
    for (const b of [E.busA, E.busB]) {
      const el = this.strips.querySelector(`[data-bus="${b.name}"] .vu i`);
      if (el) el.style.height = Math.min(100, busLevel(b) * 140) + '%';
    }
    const mv = this.master.querySelector('.vu i');
    mv.style.height = Math.min(100, E.level() * 400) + '%';
  }

  // sync a module's strip after the Lab inspector changed it
  refreshStrip(id) {
    const m = this.E.modules.get(id), el = this.strips.querySelector(`.strip[data-id="${id}"]`);
    if (!m || !el) return;
    el.querySelectorAll('[data-k]').forEach(inp => { inp.value = m.p[inp.dataset.k]; });
  }
}
