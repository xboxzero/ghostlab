// GHOST LAB — wiring the world, codex, lab, mixer, sound history, analog interface and game.
import { GHOSTS, REALMS, CLASSES, bindCost } from './data.js';
import { Engine, Module, genPattern, noteName } from './audio.js';
import { World, ERAS } from './world.js';
import { Lab } from './lab.js';
import { Codex } from './codex.js';
import { Mixer, PERF } from './mixer.js';
import { Analog } from './analog.js';
import { Game, RITES } from './game.js';
import { GENRES_SORTED, genreById, SCALES } from './genres.js';
import { GENRE_WIKI } from './genre-wiki.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAX_GHOSTS = 16;

const game = new Game();
const engine = new Engine();
engine.bpm = game.s.bpm;
let genre = genreById(game.s.genre);
game.genre = genre;
engine.setScale(genre.scale); engine.swing = genre.swing; engine.root = game.s.root;
let lab = null, mixer = null, analog = null;

// ---------- toasts ----------
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3200);
}
function banner(title, sub) {
  const b = $('#banner');
  b.innerHTML = `<div class="b-title">${esc(title)}</div><div class="b-sub">${esc(sub)}</div>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- world ----------
const tooltip = $('#tooltip');
const world = new World($('#world'), {
  onPick: id => codex.open(id),
  onHover: (id, x, y) => {
    if (id == null) { tooltip.style.display = 'none'; return; }
    const g = GHOSTS[id];
    tooltip.innerHTML = `<b>${esc(g.name)}</b><br><small>${esc(g.origin)} · ${CLASSES[g.cls].glyph} ${g.cls}</small>`;
    tooltip.style.display = 'block'; tooltip.style.left = x + 14 + 'px'; tooltip.style.top = y + 10 + 'px';
  },
});
world.setEra(game.s.era);
world.setBound(game.s.bound);

// ---------- codex ----------
const codex = new Codex($('#codex'), {
  era: () => game.s.era,
  seen: () => game.s.seen,
  isBound: id => game.isBound(id),
  onSeen: id => { game.markSeen(id); afterAction(); },
  bind: id => bindGhost(id),
  travel: era => setEra(era),
  preview: id => preview(id),
  seek: id => { world.focus(id); if (innerWidth < 800) togglePanel('codex', false); },
});

// ---------- HUD ----------
const eraInput = $('#era');
eraInput.value = game.s.era;
function setEra(i) {
  game.visitEra(i);
  eraInput.value = i;
  $('#era-name').textContent = ERAS[i].name;
  world.setEra(i);
  codex.fAge.checked && codex.renderList();
  afterAction();
}
eraInput.addEventListener('input', () => setEra(+eraInput.value));
$('#era-name').textContent = ERAS[game.s.era].name;

function updateHud() {
  $('#souls').textContent = game.s.souls.toLocaleString();
  if (document.activeElement !== $('#bpm')) $('#bpm').value = Math.round(engine.bpm);
  $('#bound-count').textContent = `${game.s.bound.length}/${MAX_GHOSTS}`;
  $('#rite-count').textContent = `${game.s.rites.length}/${RITES.length}`;
  $('#genre-chip').textContent = `${genre.name} · ${noteName(engine.root).replace(/\d/, '')}`;
}

$('#play').addEventListener('click', () => togglePlay());
function togglePlay(force) {
  if (!lab) return;
  const want = force ?? !engine.playing;
  if (!want) { engine.stop(); $('#play').textContent = '▶ PLAY'; $('#play').classList.remove('on'); }
  else { engine.start(); $('#play').textContent = '■ STOP'; $('#play').classList.add('on'); }
}
const setBpm = b => { engine.setBpm(b); game.s.bpm = engine.bpm; updateHud(); saveSoon(); };
$('#bpm').addEventListener('change', e => setBpm(+e.target.value || 128));
$('#bpm-down').addEventListener('click', () => setBpm(engine.bpm - 2));
$('#bpm-up').addEventListener('click', () => setBpm(engine.bpm + 2));

// Recording the séance (endpoint: file)
let rec = null, chunks = [];
function record() {
  if (!engine.recordDest || !window.MediaRecorder) { toast('Recording is not supported in this browser.'); return; }
  if (rec) { rec.stop(); return; }
  chunks = [];
  rec = new MediaRecorder(engine.recordDest.stream);
  rec.ondataavailable = e => chunks.push(e.data);
  rec.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    a.download = `ghostlab-${genre.id}-${Math.round(engine.bpm)}bpm.webm`; a.click();
    rec = null; document.querySelectorAll('#rec, .rec').forEach(b => b.classList.remove('on')); toast('Séance recording saved.');
  };
  rec.start(); document.querySelectorAll('#rec, .rec').forEach(b => b.classList.add('on')); toast('Recording the séance… press ● again to save.');
  if (!engine.playing) togglePlay(true);
}
$('#rec').addEventListener('click', record);

// ---------- panels ----------
function togglePanel(name, force) {
  const el = $('#' + name);
  const on = force ?? !el.classList.contains('open');
  el.classList.toggle('open', on);
  document.querySelector(`[data-panel="${name}"]`)?.classList.toggle('on', on);
  if (name === 'lab' && on && lab) requestAnimationFrame(() => lab.layout());
  if (name === 'rites' && on) renderRites();
  if (name === 'sound' && on) renderSound();
  if (name === 'mixer' && on && mixer) mixer.render();
  if (name === 'analog' && on && analog) analog.render($('#analog .an-body'));
  // the lab and mixer share the bottom of the screen
  if (on && name === 'mixer') togglePanel('lab', false);
  if (on && name === 'lab' && $('#mixer').classList.contains('open')) togglePanel('mixer', false);
}
document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => togglePanel(b.dataset.panel)));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => togglePanel(b.dataset.close, false)));
$('#lab-size').addEventListener('click', () => { $('#lab').classList.toggle('tall'); setTimeout(() => lab && lab.layout(), 260); });
$('#genre-chip').addEventListener('click', () => togglePanel('sound', true));

function renderRites() {
  $('#rites .rlist').innerHTML = RITES.map(r => {
    const done = game.s.rites.includes(r.id);
    return `<div class="rite ${done ? 'done' : ''}"><div class="rmark">${done ? '✦' : '✧'}</div><div><b>${r.name}</b><p>${r.desc}</p></div><div class="rrew">${r.reward ? '+' + r.reward : '♛'}</div></div>`;
  }).join('');
}

// ---------- Sound History (genres) ----------
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function renderSound() {
  const list = GENRES_SORTED();
  const w = GENRE_WIKI[genre.wiki];
  $('#sound .now').innerHTML = `
    <div class="now-head" style="--rc:${REALMS[genre.region].color}">
      <div><small>NOW SUMMONING</small><h3>${esc(genre.name)}</h3><div class="meta">${esc(genre.origin)} · ${esc(genre.era || genre.year)} · ${genre.bpm} BPM · ${genre.scale}</div></div>
    </div>
    <p>${esc(genre.about)}</p>
    ${w ? `<p class="wx">${esc(w.x)}</p><p class="src">Source: <a href="${esc(w.u)}" target="_blank" rel="noopener">Wikipedia — ${esc(w.t)}</a> · CC BY-SA 4.0</p>` : ''}
    <div class="row">
      <label class="slider">KEY<select data-key>${KEYS.map((k, i) => `<option value="${i}" ${(engine.root % 12) === i ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="slider">SCALE<select data-scale>${Object.keys(SCALES).map(k => `<option ${SCALES[k] === engine.scale ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="slider">SWING<input type="range" min="0" max="0.35" step="0.01" value="${engine.swing}" data-swing></label>
    </div>`;
  $('#sound .glist').innerHTML = list.map(g => `
    <button class="gcard ${g.id === genre.id ? 'cur' : ''}" data-genre="${g.id}" style="--rc:${REALMS[g.region].color}">
      <span class="yr">${esc(g.era || g.year)}</span><b>${esc(g.name)}</b><small>${esc(g.origin)}</small><em>${g.bpm}</em>
    </button>`).join('');
  $('#sound .glist').querySelectorAll('[data-genre]').forEach(b => b.onclick = () => setGenre(b.dataset.genre));
  $('#sound [data-key]').onchange = e => { engine.setRoot(36 + +e.target.value + (+e.target.value > 6 ? 0 : 12)); game.s.root = engine.root; updateHud(); saveSoon(); };
  $('#sound [data-scale]').onchange = e => { engine.setScale(e.target.value); saveSoon(); };
  $('#sound [data-swing]').oninput = e => { engine.swing = +e.target.value; };
}
function setGenre(id, quiet) {
  genre = genreById(id); game.genre = genre; game.s.genre = genre.id;
  engine.setScale(genre.scale); engine.swing = genre.swing;
  setBpm(genre.bpm);
  if (lab) {
    lab.regroove(genre);
    if (genre.sendB != null) for (const m of engine.modules.values()) if (m.ghost) m.setParam('sendB', genre.sendB);
  }
  if (!quiet) banner(genre.name.toUpperCase(), `${genre.origin} · ${genre.era || genre.year}`);
  if ($('#sound').classList.contains('open')) renderSound();
  if (mixer && $('#mixer').classList.contains('open')) mixer.render();
  afterAction();
}

// ---------- keys ----------
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.key === 'c') togglePanel('codex');
  if (e.key === 'l') togglePanel('lab');
  if (e.key === 'm') togglePanel('mixer');
  if (e.key === 'g') togglePanel('sound');
  if (e.key === 'i') togglePanel('analog');
  if (e.key === 'r') togglePanel('rites');
  if (e.key === 'h' || e.key === '?') togglePanel('help');
  if (e.key === '[') setEra(Math.max(0, game.s.era - 1));
  if (e.key === ']') setEra(Math.min(6, game.s.era + 1));
  if (e.key === 'Escape') ['codex', 'rites', 'help', 'sound', 'analog'].forEach(p => togglePanel(p, false));
  const perf = PERF.find(p => p[2] === e.key);
  if (perf && mixer && !e.repeat) mixer.perf(perf[0], true);
});
addEventListener('keyup', e => {
  const perf = PERF.find(p => p[2] === e.key);
  if (perf && mixer) mixer.perf(perf[0], false);
});

// ---------- binding ----------
function bindGhost(id) {
  const g = GHOSTS[id], cost = bindCost(g);
  if (game.s.bound.length >= MAX_GHOSTS) { toast(`Your Lab can hold ${MAX_GHOSTS} spirits. Release one first.`); return false; }
  if (game.s.souls < cost) { toast(`You need ${cost} souls. Play music to earn more.`); return false; }
  game.bind(id, cost);
  if (lab) { const mid = lab.addGhost(g); lab.patch(mid, 'master'); lab.select(mid); }
  world.setBound(game.s.bound);
  banner('SPIRIT BOUND', g.name);
  afterAction();
  return true;
}
function release(id) {
  const g = GHOSTS[id], refund = Math.floor(bindCost(g) / 2);
  game.release(id, refund);
  lab.remove('g' + id);
  world.setBound(game.s.bound);
  toast(`${g.name} returns to the dark. +${refund} souls`);
  afterAction();
}

// Hear a ghost without binding it — in the current genre
let previewN = 0;
function preview(id) {
  if (!lab) return;
  engine.init(); engine.ctx.resume();
  const g = GHOSTS[id], pid = 'preview' + (previewN++);
  const m = new Module(engine, pid, g.cls, { ghost: g, fx: g.fx, params: { fx2: g.fx2 }, pattern: genPattern(g.cls, g, 0, genre) });
  m.out.connect(engine.masterIn);
  const t0 = engine.playing ? engine.nextTime : engine.ctx.currentTime + 0.05;
  for (let i = 0; i < 32; i++) {
    const vel = m.trigger(i % 16, t0 + i * engine.stepDur);
    if (vel) engine.events.push({ time: t0 + i * engine.stepDur, id: 'g' + id, vel });
  }
  setTimeout(() => { m.out.disconnect(); m.dispose(); }, (32 * engine.stepDur + 4) * 1000);
  toast(`♪ ${g.name} — ${CLASSES[g.cls].voice} in ${genre.name}`);
}

// ---------- persistence + progress ----------
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (analog) game.s.analog = analog.cfg;
    game.save(lab ? lab.serialize() : null);
  }, 400);
}
function afterAction() {
  const done = game.checkRites(lab ? engine : null);
  for (const r of done) { banner('RITE FULFILLED', `${r.name}${r.reward ? ` · +${r.reward} souls` : ''}`); world.soulBurst(40); }
  if ($('#rites').classList.contains('open')) renderRites();
  updateHud();
  saveSoon();
}

// ---------- start ----------
function startLab() {
  engine.init();
  $('#lab').classList.add('open'); // boards need a size before nodes are placed
  engine.setBpm(game.s.bpm);
  engine.setRoot(game.s.root);
  lab = new Lab($('#lab'), engine, {
    toast,
    genre: () => genre,
    onChange: () => afterAction(),
    onParam: id => mixer && mixer.refreshStrip(id),
    onPatch: () => {},
    onSelect: () => {},
    openCodex: id => codex.open(id),
    release,
  });
  const saved = game.s.lab;
  const n = saved && saved.nodes || {};
  lab.addDrum(n.drum, n.drum && n.drum.state);
  game.s.bound.forEach(id => {
    const s = n['g' + id];
    if (GHOSTS[id]) lab.addGhost(GHOSTS[id], s ? { x: s.x, y: s.y } : null, s && s.state);
  });
  if (saved && saved.cables) for (const [a, b] of saved.cables) engine.connect(a, b);
  else for (const id of engine.modules.keys()) engine.connect(id, 'master');
  for (const [id, m] of engine.modules) if (m.muted) lab.nodes.get(id)?.el.classList.add('muted');

  mixer = new Mixer($('#mixer'), engine, {
    toast, record,
    onChange: () => afterAction(),
    onSolo: () => { game.s.flags.solo = true; afterAction(); },
    onPerf: () => { if (engine.playing) { game.s.flags.perf = true; afterAction(); } },
  });
  analog = new Analog(engine, {
    saved: game.s.analog, toast,
    save: () => saveSoon(),
    start: () => togglePlay(true),
    onBpm: () => { game.s.bpm = engine.bpm; updateHud(); },
    onKey: () => { game.s.root = engine.root; updateHud(); },
    onEnable: src => { lab.addAnalog(src); game.s.flags.analog = true; banner('ANALOG SÉANCE', 'Your synth has entered the Lab'); afterAction(); },
    onDisable: () => { lab.remove('analog'); afterAction(); },
  });
  if (analog.cfg.syncOut) engine.setSyncOut(true, analog.cfg.outPpqn);

  engine.stepListeners.push((step, t, bar) => {
    const delay = Math.max(0, (t - engine.ctx.currentTime) * 1000);
    setTimeout(() => {
      lab.playhead(step);
      $('#beat').classList.toggle('on', step % 4 === 0);
      if (step === 0 && bar > 0) {
        const earned = game.barIncome(engine);
        if (earned) { world.soulBurst(earned); floatSouls(earned); }
        afterAction();
      }
    }, delay);
  });
  togglePanel('lab', true);
  lab.renderRouting();
  lab.select(null);
  afterAction();
}

function floatSouls(n) {
  const el = document.createElement('div');
  el.className = 'soulpop'; el.textContent = `+${n}`;
  $('#souls-box').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

$('#start').addEventListener('click', () => {
  $('#title').classList.add('gone');
  setTimeout(() => $('#title').remove(), 1200);
  startLab();
  if (game.migrated) toast('Ghost Lab was rebuilt around Wikipedia references — your Lab starts fresh.');
  if (!game.s.introSeen) { game.s.introSeen = true; saveSoon(); setTimeout(() => togglePanel('help', true), 900); }
});
$('#reset').addEventListener('click', () => {
  if (confirm('Erase your Lab, souls and rites and begin anew?')) { game.reset(); location.reload(); }
});
$('#total').textContent = GHOSTS.length;
$('#total-genres').textContent = GENRES_SORTED().length;

// ---------- frame loop ----------
function frame() {
  if (lab) {
    for (const ev of engine.drainEvents()) {
      if (ev.id === 'drum') world.kick(ev.vel);
      else if (ev.id.startsWith('g')) world.pulse(+ev.id.slice(1), ev.vel);
      lab.flash(ev.id);
    }
    if ($('#lab').classList.contains('open')) lab.update();
    if ($('#mixer').classList.contains('open')) mixer.update();
    analog.update();
    if ($('#analog').classList.contains('open')) analog.paint();
  }
  world.update(lab ? engine.level() : 0);
  requestAnimationFrame(frame);
}
addEventListener('resize', () => lab && lab.layout());
updateHud();
frame();
