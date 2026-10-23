// GHOST LAB — reads a spirit's Wikipedia text (and its legend line) and turns the words into
// visual traits for its sprite: body form, features, colours and props.
// Only the article's own text is used when the article is about this spirit; for broader
// "context" articles we read just the spirit's own legend line, so a general article on,
// say, Chinese ghosts doesn't give every Chinese ghost the same look.

const has = (t, ...words) => words.some(w => (w instanceof RegExp ? w.test(t) : t.includes(w)));

export function traitsOf(g) {
  const w = g.wiki;
  const text = ((w && w.s ? `${w.x} ${w.d} ` : '') + `${g.lore} ${g.name}`).toLowerCase();
  const T = { tags: [] };
  const tag = (k, label, v = true) => { if (!T[k]) { T[k] = v; T.tags.push(label); } };

  // --- body form ---
  if (has(text, 'ship', 'canoe', 'boat', 'vessel')) tag('form', 'ghost ship', 'ship');
  else if (has(text, /\b(flying|floating|detached|severed) head\b/, 'head that', 'head with', 'entrails', 'internal organs', 'organs dangl', 'intestines'))
    tag('form', 'floating head + entrails', 'head');
  else if (has(text, 'headless', 'without a head', 'no head', 'carries his head', 'carrying her head', 'its own head', 'holding his head'))
    tag('form', 'headless', 'headless');
  else if (has(text, /\b(lights?|orbs?|fireballs?|ball of fire|balls of fire|will-o)/, 'luminous', 'plasma', 'glow') && !has(text, 'woman', 'man ', 'girl', 'child'))
    tag('form', 'ghost light', 'orb');
  else if (has(text, /\b(dog|hound|hounds|calf|mule|horse with|three-legged horse|black dog)\b/) && !has(text, 'woman', 'girl', 'horse-headed', 'horse face', 'horse-face'))
    tag('form', 'spectral beast', 'beast');
  else if (has(text, /\bcat\b/, 'bakeneko') && !has(text, 'woman')) tag('form', 'cat spirit', 'beast');

  // --- who ---
  if (has(text, /\b(woman|women|female|she|her|girl|maiden|wife|mother|lady|bride|widow|queen|nun|daughter|sister|witch)\b/)) tag('fem', 'feminine');
  if (has(text, /\b(child|children|infant|baby|babies|boy|girl|fetus|foetus|unborn)\b/)) tag('child', 'child-sized');
  if (has(text, 'giant', 'tall', 'towering', 'enormous', 'huge')) tag('tall', 'towering');

  // --- body features ---
  if (has(text, 'skeleton', 'skeletal', 'bones', 'skull', 'bone ')) tag('skeleton', 'skeletal');
  if (has(text, 'fox', 'kitsune', 'nine-tailed', 'gumiho')) tag('fox', 'fox ears & tails');
  else if (has(text, /\bcat\b/, 'bakeneko')) tag('cat', 'cat ears');
  if (has(text, /\b(horns?|horned|oni|demon|demons|devil|demoness)\b/)) tag('horns', 'horns');
  if (has(text, /\b(wings?|winged|bat|bats|bird|birds)\b/) && T.form !== 'ship' && T.form !== 'orb') tag('wings', 'wings');
  if (has(text, 'snake', 'serpent', 'reptil', 'snake-bodied')) tag('serpent', 'serpent tail');
  if (has(text, 'horse-headed', 'horse head', 'horse face', 'horse-face', 'horse skull', 'ox-head')) tag('horsehead', 'horse/ox mask');
  if (has(text, 'tongue')) tag('tongue', 'long tongue');
  if (has(text, 'slit', 'mouth', 'teeth', 'fangs', 'devour', 'eats', 'eating', 'flesh')) tag('fangs', 'hungry mouth');
  if (has(text, 'one-eyed', 'one eye', 'single eye', 'cyclop')) tag('cyclops', 'one eye');
  if (has(text, 'faceless', 'no face', 'featureless', 'without a face', /\begg\b/)) tag('faceless', 'faceless');
  if (has(text, 'backward', 'backwards', 'reversed feet', 'feet turned')) tag('backfeet', 'backward feet');
  if (has(text, /\b(no feet|legless|without legs|half of|upper half|torso|one-legged|one leg)\b/)) tag('legless', 'legless');
  if (has(text, 'long hair', 'long black hair', 'hair', 'dishevel')) tag('longhair', 'long hair');
  if (has(text, 'neck')) tag('longneck', 'stretching neck');

  // --- elements ---
  if (has(text, 'water', 'drown', 'river', ' sea', 'lake', 'well', 'ocean', 'swim', 'pool')) tag('water', 'water-soaked');
  if (has(text, 'fire', 'flame', 'burn', 'lightning')) tag('fire', 'fire');
  if (has(text, 'blood', 'vampir')) tag('blood', 'blood');
  if (has(text, 'tree', 'forest', 'jungle', 'banana', 'leaves')) tag('tree', 'forest');
  if (has(text, 'snow', 'ice', 'frozen', 'freez', 'winter', 'cold')) tag('ice', 'frost');
  if (has(text, 'shadow', 'darkness', 'dark ')) tag('shadow', 'shadow-cloaked');

  // --- props & costume ---
  if (has(text, /\b(crown|king|queen|emperor|empress|prince|princess|royal|lord)\b/)) tag('crown', 'crown');
  else if (has(text, /\b(helmet|soldier|soldiers|warrior|warriors|legion|samurai|trooper|army)\b/)) tag('helmet', 'helmet');
  else if (has(text, /\b(hat|sombrero|cap)\b/)) tag('hat', 'hat');
  else if (has(text, /\b(nun|monk|priest|hood|hooded|cowl|cloak|robe)\b/)) tag('hood', 'hood');
  else if (has(text, /\b(veil|bride|wedding|widow)\b/)) tag('veil', 'veil');
  if (has(text, /\b(mask|masked)\b/)) tag('mask', 'mask');
  if (has(text, /\b(chain|chains|chained)\b/)) tag('chains', 'chains');
  if (has(text, /\b(lantern|lamp|candle|candles|torch|torches)\b/)) tag('lantern', 'lantern');
  if (has(text, /\b(sword|scythe|spear|whip|knife|blade|sickle|club)\b/)) tag('weapon', 'weapon');
  if (has(text, /\b(drum|drums|drummer)\b/)) tag('drum', 'drum');
  if (has(text, /\b(doll|dolls)\b/)) tag('doll', 'doll stitches');
  if (has(text, /\b(plate|plates)\b/)) tag('plates', 'plates');
  if (has(text, /\b(talisman|ofuda|paper)\b/)) tag('talisman', 'talisman');
  if (has(text, /\b(shroud|burial|wrapped|bandage)\b/)) tag('shroud', 'burial shroud');
  if (has(text, 'umbrella')) tag('umbrella', 'umbrella');

  // --- colour words ---
  const col = [['white', '#ecebf4'], ['red', '#d8283c'], ['black', '#17141e'], ['green', '#3fae6a'], ['blue', '#3a6fd8'],
    ['grey', '#8a8a96'], ['gray', '#8a8a96'], ['brown', '#7a5236'], ['gold', '#e0b040'], ['yellow', '#e8d040']];
  for (const [w2, c] of col) if (has(text, new RegExp(`\\b${w2}\\b`))) { T.color = c; T.tags.push(w2); break; }
  return T;
}
