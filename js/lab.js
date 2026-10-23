// GHOST LAB — the patch board. Ghost modules are cards; drag from an OUT port to an IN port
// to run a cable. Chains of cables = SERIAL. Many cables into one input = PARALLEL.
import { GHOSTS, REALMS, CLASSES } from './data.js';
import { portraitURL } from './portrait.js';
import { FX_NAMES, genPattern, upgradeDrums } from './audio.js';
import { DRUM_ROWS, drumPattern } from './genres.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Lab {
  constructor(root, engine, hooks) {
    this.root = root; this.engine = engine; this.hooks = hooks;
    this.board = root.querySelector('.board');
    this.svg = root.querySelector('.cables');
    this.inspector = root.querySelector('.inspector');
    this.routing = root.querySelector('.routing');
    this.nodes = new Map();
    this.paths = new Map();
    this.selected = null;
    this.salt = {};
    this.tmp = document.createElementNS(NS, 'path'); this.tmp.setAttribute('class', 'cable tmp'); this.svg.appendChild(this.tmp);
    this.makeMaster();
  }

  // --- nodes ---
  makeMaster() {
    const el = document.createElement('div');
    el.className = 'node master';
    el.innerHTML = `<div class="port in" title="Bonfire input"></div><div class="fire"></div><div class="nb"><div class="nn">THE BONFIRE</div><div class="nc">Master out · all souls end here</div><div class="meter"><i></i></div></div>`;
    this.board.appendChild(el);
    this.nodes.set('master', { el, x: 0, y: 0, master: true });
    this.wireNode('master', el);
  }

  addGhost(g, pos, state) {
    const id = 'g' + g.id;
    if (this.nodes.has(id)) return id;
    const genre = this.hooks.genre();
    const m = this.engine.addModule(id, g.cls, {
      ghost: g, fx: g.fx, params: Object.assign({ fx2: g.fx2 }, state && state.p),
      pattern: (state && state.pattern) || genPattern(g.cls, g, 0, genre),
    });
    if (state && state.muted) m.setMuted(true);
    const c = CLASSES[g.cls];
    const el = document.createElement('div');
    el.className = 'node';
    el.style.setProperty('--rc', REALMS[g.realm].color);
    el.innerHTML = `<div class="port in" title="Input: sound passing through ${esc(g.name)}'s FX"></div>
      <img class="np" src="${portraitURL(g)}" alt="">
      <div class="nb"><div class="nn">${esc(g.name)}</div><div class="nc">${c.glyph} ${c.voice}</div><div class="meter"><i></i></div></div>
      <button class="mute" title="Mute">M</button>
      <div class="port out" title="Output: drag to another ghost (serial) or the Bonfire"></div>`;
    this.board.appendChild(el);
    const p = pos || this.freeSpot();
    this.nodes.set(id, { el, x: p.x, y: p.y, ghost: g });
    this.wireNode(id, el);
    this.place(id);
    return id;
  }

  addDrum(pos, state) {
    const id = 'drum';
    const pattern = (state && upgradeDrums(state.pattern)) || drumPattern(this.hooks.genre());
    const m = this.engine.addModule(id, 'DRUM', { fx: 'distort', params: Object.assign({ mix: 0.12, cutoff: 0.95, sendA: 0.05 }, state && state.p), pattern });
    if (state && state.muted) m.setMuted(true);
    const el = document.createElement('div');
    el.className = 'node drum';
    el.innerHTML = `<div class="port in" title="Input"></div><div class="drumicon"></div>
      <div class="nb"><div class="nn">RITUAL DRUM</div><div class="nc">◉ 8-voice kit</div><div class="meter"><i></i></div></div>
      <button class="mute" title="Mute">M</button><div class="port out" title="Output"></div>`;
    this.board.appendChild(el);
    const p = pos || this.freeSpot();
    this.nodes.set(id, { el, x: p.x, y: p.y, drum: true });
    this.wireNode(id, el);
    this.place(id);
  }

  addAnalog(source, pos) {
    const id = 'analog';
    if (this.nodes.has(id)) return id;
    const m = this.engine.addModule(id, 'ANALOG', { fx: 'none', params: { fx: 'none', mix: 0.3, cutoff: 1, sendA: 0.1, vol: 0.9 } });
    m.source = source; source.connect(m.voiceBus);
    const el = document.createElement('div');
    el.className = 'node analog';
    el.innerHTML = `<div class="port in" title="Input"></div><div class="jackicon"></div>
      <div class="nb"><div class="nn">ANALOG IN</div><div class="nc">⏚ 3.5 mm line-in</div><div class="meter"><i></i></div></div>
      <button class="mute" title="Mute">M</button><div class="port out" title="Output: patch into a ghost to haunt your synth"></div>`;
    this.board.appendChild(el);
    const p = pos || this.freeSpot();
    this.nodes.set(id, { el, x: p.x, y: p.y, analog: true });
    this.wireNode(id, el);
    this.place(id);
    this.patch(id, 'master');
    return id;
  }

  remove(id) {
    const n = this.nodes.get(id);
    if (!n || n.master) return;
    this.engine.removeModule(id);
    n.el.remove();
    this.nodes.delete(id);
    if (this.selected === id) this.select(null);
    this.changed();
  }

  freeSpot() {
    const small = innerWidth < 900, NW = small ? 165 : 240, NH = small ? 52 : 78;
    const master = this.nodes.get('master').el;
    const cols = Math.max(1, Math.floor((this.board.clientWidth - master.offsetWidth - 30) / NW));
    for (let i = 0; i < 80; i++) {
      const x = 14 + (i % cols) * NW, y = 14 + Math.floor(i / cols) * NH;
      let free = true;
      for (const n of this.nodes.values()) if (!n.master && Math.abs(n.x - x) < NW - 20 && Math.abs(n.y - y) < NH - 10) free = false;
      if (free) return { x, y };
    }
    return { x: 20 + Math.random() * 200, y: 20 + Math.random() * 200 };
  }

  place(id) {
    const n = this.nodes.get(id);
    if (!this.board.clientWidth) { n.el.style.transform = `translate(${n.x}px, ${n.y}px)`; return; }
    if (n.master) {
      n.x = this.board.clientWidth - n.el.offsetWidth - 16;
      n.y = Math.max(10, this.board.clientHeight / 2 - n.el.offsetHeight / 2);
    } else {
      n.x = Math.max(4, Math.min(n.x, this.board.clientWidth - n.el.offsetWidth - 4));
      n.y = Math.max(4, Math.min(n.y, this.board.clientHeight - n.el.offsetHeight - 4));
    }
    n.el.style.transform = `translate(${n.x}px, ${n.y}px)`;
  }
  layout() { for (const id of this.nodes.keys()) this.place(id); }

  wireNode(id, el) {
    // drag node
    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('port') || e.target.tagName === 'BUTTON') return;
      this.select(id);
      if (id === 'master') return;
      const n = this.nodes.get(id), sx = e.clientX - n.x, sy = e.clientY - n.y;
      el.setPointerCapture(e.pointerId);
      const mv = ev => { n.x = ev.clientX - sx; n.y = ev.clientY - sy; this.place(id); };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); this.changed(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
    const mute = el.querySelector('.mute');
    if (mute) mute.addEventListener('click', () => {
      const m = this.engine.modules.get(id); m.setMuted(!m.muted);
      el.classList.toggle('muted', m.muted); this.changed();
      if (this.selected === id) this.renderInspector();
    });
    const out = el.querySelector('.port.out');
    if (out) out.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      const start = this.portPos(id, 'out');
      const color = this.cableColor(id);
      this.tmp.style.stroke = color; this.tmp.style.display = 'block';
      const br = this.board.getBoundingClientRect();
      const mv = ev => this.tmp.setAttribute('d', curve(start, { x: ev.clientX - br.left, y: ev.clientY - br.top }));
      const up = ev => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
        this.tmp.style.display = 'none';
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const node = t && t.closest('.node');
        if (!node) return;
        const to = [...this.nodes].find(([, n]) => n.el === node)?.[0];
        if (!to || to === id) return;
        this.patch(id, to);
      };
      mv(e);
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }

  patch(from, to) {
    if (!this.engine.canConnect(from, to)) { this.hooks.toast('The dead flow one way. That cable would make a loop.'); return false; }
    if (this.engine.connect(from, to)) { this.changed(); this.hooks.onPatch && this.hooks.onPatch(); return true; }
    return false;
  }
  unpatch(from, to) { this.engine.disconnect(from, to); this.changed(); }

  portPos(id, which) {
    const n = this.nodes.get(id);
    const p = n.el.querySelector('.port.' + which);
    const br = this.board.getBoundingClientRect(), r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2 - br.left, y: r.top + r.height / 2 - br.top };
  }
  cableColor(id) {
    const n = this.nodes.get(id);
    return n.ghost ? REALMS[n.ghost.realm].color : '#ffb050';
  }

  drawCables() {
    const want = new Set();
    for (const m of this.engine.modules.values()) {
      for (const to of m.dests) {
        const key = m.id + '>' + to;
        want.add(key);
        let P = this.paths.get(key);
        if (!P) {
          const hit = document.createElementNS(NS, 'path'); hit.setAttribute('class', 'cable-hit');
          const vis = document.createElementNS(NS, 'path');
          const title = document.createElementNS(NS, 'title'); title.textContent = 'Click to cut this cable';
          hit.appendChild(title);
          hit.addEventListener('click', () => this.unpatch(m.id, to));
          hit.addEventListener('pointerenter', () => vis.classList.add('hover'));
          hit.addEventListener('pointerleave', () => vis.classList.remove('hover'));
          this.svg.insertBefore(vis, this.tmp); this.svg.insertBefore(hit, this.tmp);
          P = { vis, hit }; this.paths.set(key, P);
        }
        if (!this.nodes.has(m.id) || !this.nodes.has(to)) continue;
        const d = curve(this.portPos(m.id, 'out'), this.portPos(to, 'in'));
        P.vis.setAttribute('d', d); P.hit.setAttribute('d', d);
        P.vis.setAttribute('class', 'cable ' + (to === 'master' ? 'parallel' : 'serial') + (P.vis.classList.contains('hover') ? ' hover' : ''));
        P.vis.style.stroke = this.cableColor(m.id);
      }
    }
    for (const [k, P] of this.paths) if (!want.has(k)) { P.vis.remove(); P.hit.remove(); this.paths.delete(k); }
  }

  // per-frame
  update() {
    this.drawCables();
    for (const [id, n] of this.nodes) {
      const i = n.el.querySelector('.meter i');
      const lv = id === 'master' ? this.engine.level() * 3 : this.engine.modules.get(id)?.level() || 0;
      i.style.width = Math.min(100, lv * 160) + '%';
    }
  }

  flash(id) {
    const n = this.nodes.get(id);
    if (!n) return;
    n.el.classList.remove('hit'); void n.el.offsetWidth; n.el.classList.add('hit');
  }

  changed() {
    this.renderRouting();
    this.hooks.onChange && this.hooks.onChange();
  }

  renderRouting() {
    const E = this.engine, name = id => id === 'master' ? 'Bonfire' : id === 'drum' ? 'Drum' : id === 'analog' ? 'Analog In' : GHOSTS[+id.slice(1)].name;
    const hasInput = new Set();
    for (const m of E.modules.values()) for (const d of m.dests) hasInput.add(d);
    const chains = [];
    const walk = (id, path) => {
      const m = E.modules.get(id);
      if (!m) return;
      if (!m.dests.size) { chains.push({ path: [...path, id], dead: true }); return; }
      for (const d of m.dests) { if (d === 'master') chains.push({ path: [...path, id, 'master'] }); else walk(d, [...path, id]); }
    };
    for (const id of E.modules.keys()) if (!hasInput.has(id)) walk(id, []);
    const direct = [...E.modules.values()].filter(m => m.dests.has('master')).length;
    this.routing.innerHTML = `<span class="tag par">PARALLEL ×${direct}</span>` + chains.map(c => {
      const serial = c.path.length > 2 && !c.dead;
      return `<span class="chain ${c.dead ? 'dead' : serial ? 'ser' : ''}">${serial ? '<b>SERIAL</b> ' : c.dead ? '<b>SILENT</b> ' : ''}${c.path.map(p => esc(name(p))).join(' → ')}</span>`;
    }).join('');
  }

  // --- inspector ---
  select(id) {
    this.selected = id;
    for (const [k, n] of this.nodes) n.el.classList.toggle('sel', k === id);
    this.renderInspector();
    if (id && this.nodes.get(id)?.ghost) this.hooks.onSelect && this.hooks.onSelect(this.nodes.get(id).ghost.id);
  }

  renderInspector() {
    const id = this.selected, I = this.inspector;
    if (!id || id === 'master') {
      I.innerHTML = `<div class="ins-empty"><h3>THE BONFIRE</h3>
        <p>Every sound must reach the fire to be heard.</p>
        <p><b>Parallel:</b> many ghosts → Bonfire. Each is heard on its own.</p>
        <p><b>Serial:</b> Ghost A → Ghost B → Bonfire. A's voice is haunted by B's filter & two FX slots.</p>
        <p>Drag from a ghost's <span class="dot out"></span> output to another <span class="dot in"></span> input. Click a cable to cut it. Select a ghost to shape its sound. Open the <b>MIXER</b> for EQ, sends, solo and performance FX.</p>
        <label class="slider">MASTER<input type="range" min="0" max="1.2" step="0.01" value="${this.engine.masterGain.gain.value}" data-master></label></div>`;
      I.querySelector('[data-master]').oninput = e => this.engine.masterGain.gain.setTargetAtTime(+e.target.value, this.engine.ctx.currentTime, 0.03);
      return;
    }
    const m = this.engine.modules.get(id), n = this.nodes.get(id);
    if (!m) return;
    const g = n.ghost;
    const title = g ? `<img src="${portraitURL(g)}" class="ins-pic"><div><h3>${esc(g.name)}</h3><div class="sub">${CLASSES[g.cls].glyph} ${CLASSES[g.cls].voice} · ${esc(g.origin)}</div></div>`
      : n.analog ? `<div class="jackicon big"></div><div><h3>ANALOG IN</h3><div class="sub">Your hardware synth, live from the 3.5 mm input</div></div>`
        : `<div class="drumicon big"></div><div><h3>RITUAL DRUM</h3><div class="sub">8-voice kit · follows the Sound History genre</div></div>`;
    const sl = (k, label) => `<label class="slider">${label}<input type="range" min="0" max="1" step="0.01" value="${m.p[k]}" data-k="${k}"></label>`;
    const fxSel = (k) => `<select data-fxk="${k}">${Object.entries(FX_NAMES).map(([f, v]) => `<option value="${f}" ${f === m.p[k] ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    const others = [...this.nodes.keys()].filter(k => k !== id && this.engine.canConnect(id, k) && !m.dests.has(k));
    const nm = k => k === 'master' ? 'The Bonfire' : k === 'drum' ? 'Ritual Drum' : k === 'analog' ? 'Analog In' : GHOSTS[+k.slice(1)].name;
    I.innerHTML = `<div class="ins-head">${title}</div>
      <div class="xyrow">
        <div class="xy" title="Drag: X = cutoff, Y = FX 1 mix. Double-click to recentre."><i style="left:${m.p.cutoff * 100}%;top:${(1 - m.p.mix) * 100}%"></i><span>CUTOFF →</span><em>FX ↑</em></div>
        <div class="grid1">${sl('vol', 'VOLUME')}${sl('res', 'RESONANCE')}${n.analog ? '' : sl('haunt', g ? 'HAUNT' : 'BOOM')}</div>
      </div>
      <div class="grid2">
        <label class="slider">FX SLOT 1${fxSel('fx')}</label>${sl('mix', 'MIX 1')}
        <label class="slider">FX SLOT 2${fxSel('fx2')}</label>${sl('mix2', 'MIX 2')}
      </div>
      ${n.analog ? '' : `<div class="steps-title">SEQUENCE <small>${g ? 'click: on/off · right/shift-click: pitch up · alt-click: down' : 'click: off → hit → soft'}</small></div>
      <div class="steps">${this.stepsHTML(m)}</div>`}
      <div class="sends"><span>SENDS TO:</span> ${[...m.dests].map(d => `<button class="chip" data-cut="${d}" title="Cut">${esc(nm(d))} ✕</button>`).join('') || '<i>nothing — silent!</i>'}
        ${others.length ? `<select data-send><option value="">+ connect to…</option>${others.map(k => `<option value="${k}">${esc(nm(k))}${k === 'master' ? ' (parallel)' : ' (serial)'}</option>`).join('')}</select>` : ''}</div>
      <div class="ins-actions">
        ${g ? '<button data-act="reroll">⚄ Reroll</button><button data-act="codex">📖 Codex</button>' : n.analog ? '' : '<button data-act="drumfill">⚄ Genre beat</button><button data-act="drumrand">⚄ Mutate</button>'}
        <button data-act="mute">${m.muted ? 'Unmute' : 'Mute'}</button>
        ${g ? '<button data-act="release" class="danger">Release</button>' : ''}
      </div>`;
    const changed = () => { this.hooks.onChange(); this.hooks.onParam && this.hooks.onParam(id); };
    I.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => { m.setParam(inp.dataset.k, +inp.value); this.syncXY(m); changed(); });
    I.querySelectorAll('[data-fxk]').forEach(sel => sel.onchange = () => { m.setParam(sel.dataset.fxk, sel.value); changed(); });
    I.querySelectorAll('[data-cut]').forEach(b => b.onclick = () => { this.unpatch(id, b.dataset.cut); this.renderInspector(); });
    const send = I.querySelector('[data-send]');
    if (send) send.onchange = () => { if (send.value) { this.patch(id, send.value); this.renderInspector(); } };
    // XY pad: X = cutoff, Y = FX slot 1 mix
    const xy = I.querySelector('.xy');
    const drag = e => {
      const r = xy.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
      m.setParam('cutoff', x); m.setParam('mix', y); this.syncXY(m);
      I.querySelectorAll('input[data-k]').forEach(inp => { inp.value = m.p[inp.dataset.k]; });
    };
    xy.addEventListener('pointerdown', e => {
      xy.setPointerCapture(e.pointerId); drag(e);
      const mv = ev => drag(ev), up = () => { xy.removeEventListener('pointermove', mv); xy.removeEventListener('pointerup', up); changed(); };
      xy.addEventListener('pointermove', mv); xy.addEventListener('pointerup', up);
    });
    xy.ondblclick = () => { m.setParam('cutoff', 0.75); m.setParam('mix', 0.35); this.syncXY(m); changed(); };
    I.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'reroll') { this.salt[id] = (this.salt[id] || 0) + 1; m.pattern = genPattern(g.cls, g, this.salt[id], this.hooks.genre()); }
      if (a === 'drumfill') m.pattern = drumPattern(this.hooks.genre());
      if (a === 'drumrand') {
        for (const row of DRUM_ROWS) for (let i = 0; i < 16; i++) {
          const v = m.pattern[row][i];
          if (Math.random() < 0.08) m.pattern[row][i] = v ? 0 : (Math.random() < 0.5 ? 0.5 : 1);
        }
        for (let i = 0; i < 16; i += 4) m.pattern.kick[i] = m.pattern.kick[i] || (this.hooks.genre().drums.kick || '')[i] === 'x' ? 1 : 0;
      }
      if (a === 'mute') { m.setMuted(!m.muted); n.el.classList.toggle('muted', m.muted); }
      if (a === 'codex') { this.hooks.openCodex(g.id); return; }
      if (a === 'release') { this.hooks.release(g.id); return; }
      this.renderInspector(); this.changed(); this.hooks.onParam && this.hooks.onParam(id);
    });
    this.bindSteps(m);
  }

  syncXY(m) {
    const dot = this.inspector.querySelector('.xy i');
    if (dot) { dot.style.left = m.p.cutoff * 100 + '%'; dot.style.top = (1 - m.p.mix) * 100 + '%'; }
  }

  stepsHTML(m) {
    if (m.kind === 'DRUM') {
      return DRUM_ROWS.map(row => `<div class="drow"><span>${row.toUpperCase()}</span>${m.pattern[row].map((v, i) => `<button class="st ${v ? 'on' : ''} ${v === 0.5 ? 'soft' : ''} ${i % 4 === 0 ? 'beat' : ''}" data-row="${row}" data-i="${i}"></button>`).join('')}</div>`).join('');
    }
    return `<div class="drow mel">${m.pattern.map((s, i) => `<button class="st ${s.on ? 'on' : ''} ${i % 4 === 0 ? 'beat' : ''}" data-i="${i}" style="--h:${s.on ? 20 + ((s.deg % 14 + 14) % 14) * 5.5 : 0}%"><i></i></button>`).join('')}</div>`;
  }

  bindSteps(m) {
    this.inspector.querySelectorAll('.st').forEach(b => {
      const i = +b.dataset.i;
      const act = e => {
        e.preventDefault();
        if (m.kind === 'DRUM') { const row = b.dataset.row, v = m.pattern[row][i]; m.pattern[row][i] = v === 0 ? 1 : v === 1 ? 0.5 : 0; }
        else {
          const s = m.pattern[i];
          const up = e.button === 2 || e.shiftKey, down = e.altKey;
          if ((up || down) && s.on) s.deg += up ? 1 : -1;
          else { s.on = !s.on; s.len = { WRAITH: 8, PHANTOM: 8, BANSHEE: 4 }[m.kind] || 1; }
        }
        this.inspector.querySelector('.steps').innerHTML = this.stepsHTML(m);
        this.bindSteps(m);
        this.hooks.onChange();
      };
      b.addEventListener('click', act);
      b.addEventListener('contextmenu', act);
    });
  }

  // A new genre: every ghost and the drum re-learn their parts (unless locked)
  regroove(genre) {
    for (const [id, n] of this.nodes) {
      const m = this.engine.modules.get(id);
      if (!m) continue;
      if (n.ghost) m.pattern = genPattern(n.ghost.cls, n.ghost, this.salt[id] || 0, genre);
      if (n.drum) m.pattern = drumPattern(genre);
    }
    this.renderInspector();
  }

  playhead(step) {
    this.inspector.querySelectorAll('.drow').forEach(r => r.querySelectorAll('.st').forEach((b, i) => b.classList.toggle('ph', i === step)));
  }

  serialize() {
    const nodes = {};
    for (const [id, n] of this.nodes) if (!n.master && !n.analog) nodes[id] = { x: Math.round(n.x), y: Math.round(n.y), state: this.engine.modules.get(id).serialize() };
    const cables = [];
    for (const m of this.engine.modules.values()) if (m.kind !== 'ANALOG') for (const d of m.dests) cables.push([m.id, d]);
    return { nodes, cables };
  }
}

function curve(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y + 30} ${b.x - dx},${b.y + 30} ${b.x},${b.y}`;
}
