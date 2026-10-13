// GHOST LAB — wiring the world, the codex, the lab and the game together.
import { GHOSTS, REALMS, CLASSES, bindCost } from './data.js';
import { Engine, Module } from './audio.js';
import { World, ERAS } from './world.js';
import { Lab } from './lab.js';
import { Codex } from './codex.js';
import { Game, RITES } from './game.js';

const $ = s => document.querySelector(s);
const MAX_GHOSTS = 16;

const game = new Game();
const engine = new Engine();
engine.bpm = game.s.bpm;
let lab = null;

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
  b.innerHTML = `<div class="b-title">${title}</div><div class="b-sub">${sub}</div>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- world ----------
const tooltip = $('#tooltip');
const world = new World($('#world'), {
  onPick: id => codex.open(id),
  onHover: (id, x, y) => {
    if (id == null) { tooltip.style.display = 'none'; return; }
    const g = GHOSTS[id];
    tooltip.innerHTML = `<b>${g.name}</b><br><small>${g.origin} · ${CLASSES[g.cls].glyph} ${g.cls}</small>`;
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
  $('#bpm').value = engine.bpm;
  $('#bound-count').textContent = `${game.s.bound.length}/${MAX_GHOSTS}`;
  $('#rite-count').textContent = `${game.s.rites.length}/${RITES.length}`;
}

$('#play').addEventListener('click', () => togglePlay());
function togglePlay() {
  if (!lab) return;
  if (engine.playing) { engine.stop(); $('#play').textContent = '▶ PLAY'; $('#play').classList.remove('on'); }
  else { engine.start(); $('#play').textContent = '■ STOP'; $('#play').classList.add('on'); }
}
$('#bpm').addEventListener('change', e => { engine.setBpm(+e.target.value || 128); game.s.bpm = engine.bpm; updateHud(); saveSoon(); });
$('#bpm-down').addEventListener('click', () => { engine.setBpm(engine.bpm - 2); game.s.bpm = engine.bpm; updateHud(); saveSoon(); });
$('#bpm-up').addEventListener('click', () => { engine.setBpm(engine.bpm + 2); game.s.bpm = engine.bpm; updateHud(); saveSoon(); });

// Recording the séance
let rec = null, chunks = [];
$('#rec').addEventListener('click', () => {
  if (!engine.recordDest || !window.MediaRecorder) { toast('Recording is not supported in this browser.'); return; }
  if (rec) { rec.stop(); return; }
  chunks = [];
  rec = new MediaRecorder(engine.recordDest.stream);
  rec.ondataavailable = e => chunks.push(e.data);
  rec.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    a.download = 'ghostlab-seance.webm'; a.click();
    rec = null; $('#rec').classList.remove('on'); toast('Séance recording saved.');
  };
  rec.start(); $('#rec').classList.add('on'); toast('Recording the séance… press ● again to save.');
  if (!engine.playing) togglePlay();
});

// Panels
function togglePanel(name, force) {
  const el = $('#' + name);
  const on = force ?? !el.classList.contains('open');
  el.classList.toggle('open', on);
  document.querySelector(`[data-panel="${name}"]`)?.classList.toggle('on', on);
  if (name === 'lab' && on && lab) requestAnimationFrame(() => lab.layout());
  if (name === 'rites' && on) renderRites();
}
document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => togglePanel(b.dataset.panel)));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => togglePanel(b.dataset.close, false)));
$('#lab-size').addEventListener('click', () => { $('#lab').classList.toggle('tall'); setTimeout(() => lab && lab.layout(), 260); });

function renderRites() {
  $('#rites .rlist').innerHTML = RITES.map(r => {
    const done = game.s.rites.includes(r.id);
    return `<div class="rite ${done ? 'done' : ''}"><div class="rmark">${done ? '✦' : '✧'}</div><div><b>${r.name}</b><p>${r.desc}</p></div><div class="rrew">${r.reward ? '+' + r.reward : '♛'}</div></div>`;
  }).join('');
}

addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.key === 'c') togglePanel('codex');
  if (e.key === 'l') togglePanel('lab');
  if (e.key === 'r') togglePanel('rites');
  if (e.key === 'h' || e.key === '?') togglePanel('help');
  if (e.key === '[') setEra(Math.max(0, game.s.era - 1));
  if (e.key === ']') setEra(Math.min(6, game.s.era + 1));
  if (e.key === 'Escape') ['codex', 'rites', 'help'].forEach(p => togglePanel(p, false));
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

// Hear a ghost without binding it
let previewN = 0;
function preview(id) {
  if (!lab) return;
  engine.init(); engine.ctx.resume();
  const g = GHOSTS[id], pid = 'preview' + (previewN++);
  const m = new Module(engine, pid, g.cls, { ghost: g, fx: g.fx });
  m.out.connect(engine.masterIn);
  const t0 = engine.playing ? engine.nextTime : engine.ctx.currentTime + 0.05;
  for (let i = 0; i < 32; i++) {
    const vel = m.trigger(i % 16, t0 + i * engine.stepDur);
    if (vel) engine.events.push({ time: t0 + i * engine.stepDur, id: 'g' + id, vel });
  }
  engine.events.sort((a, b) => a.time - b.time);
  setTimeout(() => { m.out.disconnect(); m.dispose(); }, (32 * engine.stepDur + 4) * 1000);
  toast(`♪ ${g.name} — ${CLASSES[g.cls].voice}`);
}

// ---------- persistence + progress ----------
let saveTimer = null;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => game.save(lab ? lab.serialize() : null), 400); }
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
  lab = new Lab($('#lab'), engine, {
    toast,
    onChange: () => afterAction(),
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
    lab.addGhost(GHOSTS[id], s ? { x: s.x, y: s.y } : null, s && s.state);
  });
  if (saved && saved.cables) for (const [a, b] of saved.cables) engine.connect(a, b);
  else for (const id of engine.modules.keys()) engine.connect(id, 'master');
  for (const [id, m] of engine.modules) if (m.muted) lab.nodes.get(id)?.el.classList.add('muted');

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
  if (!game.s.introSeen) { game.s.introSeen = true; saveSoon(); setTimeout(() => togglePanel('help', true), 900); }
});
$('#reset').addEventListener('click', () => {
  if (confirm('Erase your Lab, souls and rites and begin anew?')) { game.reset(); location.reload(); }
});
$('#total').textContent = GHOSTS.length;

// ---------- frame loop ----------
function frame() {
  if (lab) {
    for (const ev of engine.drainEvents()) {
      if (ev.id === 'drum') world.kick(ev.vel);
      else if (ev.id.startsWith('g')) world.pulse(+ev.id.slice(1), ev.vel);
      lab.flash(ev.id);
    }
    lab.update();
  }
  world.update(lab ? engine.level() : 0);
  requestAnimationFrame(frame);
}
addEventListener('resize', () => lab && lab.layout());
updateHud();
frame();
