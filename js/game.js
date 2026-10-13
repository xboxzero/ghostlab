// GHOST LAB — game state, souls economy, rites and saving.
import { GHOSTS, REALMS } from './data.js';

const SAVE_KEY = 'ghostlab-save-v1';
const STARTERS = ['Yūrei', 'Krasue', 'Headless Horseman'];

export const RITES = [
  { id: 'seance', name: 'First Séance', desc: 'Press PLAY and keep the music alive for 4 bars.', reward: 100, check: s => s.bars >= 4 },
  { id: 'read', name: 'Speak with the Dead', desc: 'Read 10 entries in the Codex.', reward: 80, check: s => s.seen.length >= 10 },
  { id: 'bind', name: 'The Binding', desc: 'Bind a new ghost into your Lab.', reward: 120, check: s => s.bound.length > STARTERS.length },
  { id: 'serial', name: 'Chain of Souls', desc: 'Make a SERIAL chain: 3 modules in a row before the Bonfire.', reward: 200, check: (s, x) => x.depth >= 3 },
  { id: 'parallel', name: 'Parallel Choir', desc: 'Wire 4 modules straight into the Bonfire in PARALLEL.', reward: 200, check: (s, x) => x.parallel >= 4 },
  { id: 'possess', name: 'Possession', desc: 'Route the Ritual Drum through a ghost instead of straight to the fire.', reward: 150, check: (s, x) => x.drumPossessed },
  { id: 'ages', name: 'Walker of Ages', desc: 'Turn the Chronos Dial through all 7 ages.', reward: 150, check: s => s.erasVisited.length >= 7 },
  { id: 'pilgrim', name: 'Pilgrim of Realms', desc: 'Bind ghosts from 4 different realms.', reward: 250, check: (s, x) => x.realms >= 4 },
  { id: 'hollow', name: 'Hollow Tempo', desc: 'Play at 140 BPM or faster for 8 bars.', reward: 150, check: s => s.fastBars >= 8 },
  { id: 'legion', name: 'Legion', desc: 'Have 10 ghosts in your Lab at once.', reward: 400, check: s => s.bound.length >= 10 },
  { id: 'night', name: 'The Long Night', desc: 'Play 128 bars in total.', reward: 300, check: s => s.bars >= 128 },
  { id: 'scholar', name: 'Codex Scholar', desc: 'Read 50 Codex entries.', reward: 300, check: s => s.seen.length >= 50 },
  { id: 'world', name: 'World Séance', desc: 'Bind a ghost from every one of the 8 realms.', reward: 800, check: (s, x) => x.realms >= 8 },
  { id: 'lord', name: 'Lord of Cinders', desc: 'Hoard 5000 souls.', reward: 0, check: s => s.souls >= 5000 },
];

export class Game {
  constructor() {
    this.s = this.load() || this.fresh();
  }
  fresh() {
    const bound = STARTERS.map(n => GHOSTS.find(g => g.name === n).id);
    return { souls: 300, bound, seen: [], rites: [], bars: 0, fastBars: 0, erasVisited: [3], era: 3, bpm: 128, lab: null, totalEarned: 0 };
  }
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return Object.assign(this.fresh(), JSON.parse(raw)); } catch (e) { }
    return null;
  }
  save(lab) {
    if (lab) this.s.lab = lab;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { }
  }
  reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

  isBound(id) { return this.s.bound.includes(id); }
  markSeen(id) { if (!this.s.seen.includes(id)) this.s.seen.push(id); }
  visitEra(i) { this.s.era = i; if (!this.s.erasVisited.includes(i)) this.s.erasVisited.push(i); }
  bind(id, cost) {
    if (this.isBound(id) || this.s.souls < cost) return false;
    this.s.souls -= cost; this.s.bound.push(id); return true;
  }
  release(id, refund) {
    this.s.bound = this.s.bound.filter(b => b !== id);
    this.s.souls += refund;
  }
  realmsBound() { return new Set(this.s.bound.map(id => GHOSTS[id].realm)).size; }

  // Called once per bar while playing. Returns souls earned.
  barIncome(engine) {
    let income = 0;
    const realms = new Set();
    for (const m of engine.modules.values()) {
      if (m.muted || !engine.reachesMaster(m.id)) continue;
      const depth = engine.chainDepth(m.id);
      income += 1 + Math.max(0, depth - 1) * 0.75;
      if (m.ghost) realms.add(m.ghost.realm);
    }
    const resonance = 1 + realms.size * 0.15 + (engine.bpm >= 140 ? 0.25 : 0);
    const earned = Math.round(income * resonance);
    this.s.souls += earned; this.s.totalEarned += earned;
    this.s.bars++;
    if (engine.bpm >= 140) this.s.fastBars++;
    this.lastResonance = resonance;
    return earned;
  }

  // Checks rites; returns newly completed ones.
  checkRites(engine) {
    let parallel = 0, depth = 0, drumPossessed = false;
    if (engine) for (const m of engine.modules.values()) {
      if (m.dests.has('master') && !m.muted) parallel++;
      depth = Math.max(depth, engine.chainDepth(m.id));
      if (m.kind === 'DRUM' && m.dests.size && !m.dests.has('master') && engine.reachesMaster(m.id)) drumPossessed = true;
    }
    const x = { parallel, depth, drumPossessed, realms: this.realmsBound() };
    const done = [];
    for (const r of RITES) {
      if (this.s.rites.includes(r.id)) continue;
      if (r.check(this.s, x)) { this.s.rites.push(r.id); this.s.souls += r.reward; done.push(r); }
    }
    return done;
  }
}

export { REALMS };
