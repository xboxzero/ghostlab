// GHOST LAB — the Codex: a wiki of the restless dead, searchable across realm, class and time.
import { GHOSTS, REALMS, CLASSES, eraLabel, bindCost } from './data.js';
import { portraitURL } from './portrait.js';
import { ERAS, eraOf } from './world.js';
import { FX_NAMES } from './audio.js';
import { Viewer } from './portrait.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIN_Y = -2600, MAX_Y = 2030;

export class Codex {
  constructor(root, hooks) {
    this.root = root; this.hooks = hooks;
    this.list = root.querySelector('.list');
    this.entry = root.querySelector('.entry');
    this.count = root.querySelector('.count');
    this.q = root.querySelector('[data-q]');
    this.fRealm = root.querySelector('[data-realm]');
    this.fClass = root.querySelector('[data-class]');
    this.fAge = root.querySelector('[data-age]');
    this.fRealm.innerHTML = '<option value="">All realms</option>' + Object.entries(REALMS).map(([k, r]) => `<option value="${k}">${r.short}</option>`).join('');
    this.fClass.innerHTML = '<option value="">All classes</option>' + Object.entries(CLASSES).map(([k, c]) => `<option value="${k}">${c.glyph} ${k[0] + k.slice(1).toLowerCase()}</option>`).join('');
    for (const el of [this.q, this.fRealm, this.fClass, this.fAge]) el.addEventListener('input', () => this.renderList());
    this.viewer = new Viewer();
    this.list.addEventListener('click', e => { const it = e.target.closest('[data-id]'); if (it) this.open(+it.dataset.id); });
    this.renderList();
  }

  renderList() {
    const q = this.q.value.trim().toLowerCase(), realm = this.fRealm.value, cls = this.fClass.value, age = this.fAge.checked;
    const era = this.hooks.era();
    const items = GHOSTS.filter(g =>
      (!q || (g.name + ' ' + g.origin + ' ' + g.lore + ' ' + (g.wiki ? g.wiki.t + ' ' + g.wiki.x : '')).toLowerCase().includes(q)) &&
      (!realm || g.realm === realm) && (!cls || g.cls === cls) && (!age || eraOf(g.year) === era));
    items.sort((a, b) => a.name.localeCompare(b.name));
    const seen = this.hooks.seen();
    this.count.textContent = `${items.length} of ${GHOSTS.length} spirits · ${seen.length} read`;
    this.list.innerHTML = items.map(g => `<button class="li ${this.hooks.isBound(g.id) ? 'bound' : ''} ${seen.includes(g.id) ? 'seen' : ''}" data-id="${g.id}" style="--rc:${REALMS[g.realm].color}">
      <img src="${portraitURL(g)}" alt="" loading="lazy"><span><b>${esc(g.name)}</b><small>${esc(g.origin)} · ${eraLabel(g.year)}</small></span><em>${CLASSES[g.cls].glyph}</em></button>`).join('');
  }

  show() { this.root.classList.add('open'); }

  open(id) {
    const g = GHOSTS[id];
    this.hooks.onSeen(id);
    this.count.textContent = `${this.hooks.seen().length} of ${GHOSTS.length} spirits read`;
    this.current = id;
    const R = REALMS[g.realm], C = CLASSES[g.cls], era = eraOf(g.year);
    const bound = this.hooks.isBound(id), cost = bindCost(g), inAge = era === this.hooks.era();
    const pips = (n, label) => `<div class="stat"><span>${label}</span>${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
    const pct = ((Math.max(MIN_Y, g.year) - MIN_Y) / (MAX_Y - MIN_Y)) * 100;
    const kin = GHOSTS.filter(o => o.id !== id && (o.realm === g.realm && eraOf(o.year) === era || o.cls === g.cls && o.realm === g.realm)).slice(0, 6);
    let bindBtn;
    if (bound) bindBtn = `<button class="big bound" disabled>✓ Bound to your Lab</button>`;
    else if (!inAge) bindBtn = `<button class="big" data-act="travel">⌛ Travel to the ${ERAS[era].name} to bind</button>`;
    else bindBtn = `<button class="big gold" data-act="bind">Bind spirit — ${cost} souls</button>`;
    this.entry.innerHTML = `
      <button class="back" data-act="back">‹ Back to index</button>
      <div class="hero" style="--rc:${R.color}">
        <div class="vbox" title="Drag to turn"><img src="${portraitURL(g)}" alt="Portrait of ${esc(g.name)}"></div>
        <div>
          <h2>${esc(g.name)}</h2>
          <div class="meta">${esc(g.origin)} · <span style="color:${R.color}">${R.name}</span></div>
          <div class="meta">First told: <b>c. ${eraLabel(g.year)}</b> · ${ERAS[era].name}</div>
          <div class="meta">Class: <b>${C.glyph} ${g.cls}</b></div>
        </div>
      </div>
      ${this.wikiHTML(g)}
      ${g.traits.tags.length ? `<div class="traits"><h4>SPRITE DESIGN · READ FROM WIKIPEDIA</h4>${g.traits.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="stats">${pips(g.dread, 'DREAD')}${pips(g.wail, 'WAIL')}${pips(g.speed, 'SPEED')}</div>
      <div class="sigil"><h4>SOUND SIGIL</h4>
        <div>Voice: <b>${C.voice}</b> — ${C.desc}</div>
        <div>Effect: <b>${FX_NAMES[g.fx]}</b></div>
      </div>
      <div class="timeline" title="Where this spirit sits in time"><div class="tl-bar">${ERAS.map((e, i) => `<span class="${i === era ? 'cur' : ''}"></span>`).join('')}</div><i style="left:${pct}%"></i><small>3000 BCE</small><small>Today</small></div>
      <div class="acts">${bindBtn}<button data-act="preview">♪ Hear its voice</button><button data-act="seek">◎ Seek in the world</button></div>
      ${kin.length ? `<h4>KINDRED SPIRITS</h4><div class="kin">${kin.map(k => `<button data-kin="${k.id}" title="${esc(k.name)}"><img src="${portraitURL(k)}" alt=""><span>${esc(k.name)}</span></button>`).join('')}</div>` : ''}`;
    this.entry.classList.add('on'); this.list.classList.add('off');
    if (this.hooks.ready()) { const box = this.entry.querySelector('.vbox'); box.innerHTML = ''; this.viewer.attach(box, g); }
    this.entry.scrollTop = 0;
    this.entry.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'back') this.back();
      if (a === 'bind') { if (this.hooks.bind(id)) this.open(id); }
      if (a === 'travel') { this.hooks.travel(era); this.open(id); }
      if (a === 'preview') this.hooks.preview(id);
      if (a === 'seek') this.hooks.seek(id);
    });
    this.entry.querySelectorAll('[data-kin]').forEach(b => b.onclick = () => this.open(+b.dataset.kin));
    this.show();
  }

  wikiHTML(g) {
    const w = g.wiki;
    if (!w) return `<p class="lore">${esc(g.lore)}</p>`;
    const img = w.img ? `<a class="wimg" href="${esc(w.u)}" target="_blank" rel="noopener"><img src="${esc(w.img)}" alt="Image from the Wikipedia article ${esc(w.t)}" loading="lazy" referrerpolicy="no-referrer"></a>` : '';
    if (w.s) {
      return `<div class="wiki">${img}<p class="lore">${esc(w.x)}</p>
        <p class="src">Source: <a href="${esc(w.u)}" target="_blank" rel="noopener">Wikipedia — ${esc(w.t)}</a> · text CC BY-SA 4.0</p></div>`;
    }
    return `<p class="lore">${esc(g.lore)}</p>
      <div class="wiki ctx">${img}<h4>WIKIPEDIA CONTEXT · ${esc(w.t)}</h4><p>${esc(w.x)}</p>
      <p class="src">Source: <a href="${esc(w.u)}" target="_blank" rel="noopener">Wikipedia — ${esc(w.t)}</a> · text CC BY-SA 4.0</p></div>`;
  }

  close() { this.viewer.detach(); }
  back() { this.viewer.detach(); this.entry.classList.remove('on'); this.list.classList.remove('off'); this.current = null; this.renderList(); }
  refresh() { if (this.current != null) this.open(this.current); else this.renderList(); }
}
