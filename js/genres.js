// GHOST LAB — Sound History: grooves from electronic music around the world, weighted toward the
// Global South. Each genre sets tempo, swing, scale, a drum kit pattern and a groove map that
// re-shapes every ghost's sequence. Patterns are simplified sketches of each style, not transcriptions.
//
// Drum rows: x = hit, o = soft hit, . = rest (16 steps).
// groove: 0-9 weight per step, used to place ghost melodies.
// bass: where the bass ghosts (Revenants / Shades) are allowed to play.

export const SCALES = {
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  hijaz: [0, 1, 4, 5, 7, 8, 10],        // maqam Hijaz — Egypt, Levant, North Africa
  bhairav: [0, 1, 4, 5, 7, 8, 11],      // raga Bhairav — North India
  pentaMajor: [0, 2, 4, 7, 9],          // khaen lai / marimba pentatonic
  pentaMinor: [0, 3, 5, 7, 10],
  pelog: [0, 1, 3, 7, 8],               // a common 5-note pelog approximation — Java / Bali
};

export const GENRES = [
  {
    id: 'zaar', name: 'Expression of Zaar', origin: 'Cairo, Egypt', year: 1944, region: 'AFRICA', wiki: 'Halim El-Dabh',
    bpm: 92, swing: 0.12, scale: 'hijaz',
    about: 'Halim El-Dabh recorded a zār ceremony on a wire recorder and transformed it — one of the earliest known works of tape music.',
    drums: { kick: 'x.....x...x.....', tom: 'x..x..x...x..x..', perc: '..x.x...x.x.x...', shaker: 'o.o.o.o.o.o.o.o.' },
    groove: '9000300060003000', bass: 'x.........x.....',
  },
  {
    id: 'dub', name: 'Dub', origin: 'Kingston, Jamaica', year: 1970, region: 'AMERICAS', wiki: 'Dub music',
    bpm: 76, swing: 0.1, scale: 'minor', sendB: 0.45,
    about: 'King Tubby and Lee "Scratch" Perry turned the mixing desk into an instrument: echo, reverb and drop-outs.',
    drums: { kick: '........x.......', snare: '........x.......', hat: '..x...x...x...x.', perc: '....o.......o...' },
    groove: '0030003000300030', bass: 'x..x..x...x..x..',
  },
  {
    id: 'raga', name: 'Ten Ragas to a Disco Beat', origin: 'Bombay, India', year: 1982, region: 'SOUTH', wiki: 'Synthesizing: Ten Ragas to a Disco Beat',
    bpm: 120, swing: 0, scale: 'bhairav',
    about: 'Charanjit Singh played Indian ragas on a Roland TB-303 and TR-808 — squelching acid years before Chicago.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    groove: '5353535353535353', bass: 'xxxxxxxxxxxxxxxx',
  },
  {
    id: 'detroit', name: 'Detroit Techno', origin: 'Detroit, USA', year: 1985, region: 'AMERICAS', wiki: 'Detroit techno',
    bpm: 128, swing: 0, scale: 'phrygian',
    about: 'The Belleville Three fused funk, electro and Kraftwerk into a futurist Black music of machines.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', open: '..o.......o.....' },
    groove: '6030603060306030', bass: '..x...x...x...x.',
  },
  {
    id: 'rai', name: 'Pop Raï', origin: 'Oran, Algeria', year: 1985, era: '1980s pop raï', region: 'AFRICA', wiki: 'Raï',
    bpm: 104, swing: 0.08, scale: 'hijaz',
    about: 'Algerian popular music with roots in the 1920s; the young "cheb" singers of the 1980s brought it synths and drum machines.',
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', perc: 'x..x..x.x..x.x..', hat: 'x.o.x.o.x.o.x.o.' },
    groove: '7002007020070020', bass: 'x..x..x...x..x..',
  },
  {
    id: 'funk', name: 'Funk Carioca', origin: 'Rio de Janeiro, Brazil', year: 1989, region: 'AMERICAS', wiki: 'Funk carioca',
    bpm: 130, swing: 0.04, scale: 'minor',
    about: 'Miami bass reborn in the favelas; the 2000s tamborzão beat drove baile funk parties.',
    drums: { kick: 'x.....x...x.....', tom: 'x..x..x.x..x..x.', snare: '....x.......x...', perc: '..x...x...x...x.' },
    groove: '9009009090090090', bass: 'x..x..x...x..x..',
  },
  {
    id: 'kwaito', name: 'Kwaito', origin: 'Soweto, South Africa', year: 1990, region: 'AFRICA', wiki: 'Kwaito',
    bpm: 110, swing: 0.1, scale: 'minor',
    about: 'Born in Soweto between the late 1980s and 1990s: house slowed down, built from South African sounds and samples.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', shaker: 'xoxoxoxoxoxoxoxo' },
    groove: '5030503050305030', bass: 'x.x.x.x.x.x.x.x.',
  },
  {
    id: 'kuduro', name: 'Kuduro', origin: 'Luanda, Angola', year: 1988, region: 'AFRICA', wiki: 'Kuduro',
    bpm: 140, swing: 0.03, scale: 'minor',
    about: 'Uptempo, energetic music and dance developed in Luanda in the late 1980s, sampling carnival music like soca and zouk.',
    drums: { kick: 'x..x..x...x.x...', snare: '....x.......x...', tom: '..x...x...x..x..', hat: 'x.x.x.x.x.x.x.x.' },
    groove: '9009009009009000', bass: 'x..x..x...x.x...',
  },
  {
    id: 'goa', name: 'Goa Trance', origin: 'Goa, India', year: 1991, region: 'SOUTH', wiki: 'Goa trance',
    bpm: 145, swing: 0, scale: 'phrygian',
    about: 'Electronic dance music from the Indian state of Goa in the early 1990s, with drone-like rolling basslines.',
    drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', open: '..x...x...x...x.', snare: '....o.......o...' },
    groove: '5555555555555555', bass: '.xxx.xxx.xxx.xxx',
  },
  {
    id: 'asian', name: 'Asian Underground', origin: 'London & Punjab', year: 1995, region: 'SOUTH', wiki: 'Asian Underground',
    bpm: 135, swing: 0.06, scale: 'bhairav',
    about: 'British-Asian producers fused bhangra dhol, tabla and ragas with drum and bass and electronica.',
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', tom: 'x..x.xx.x..x.xx.', hat: 'x.x.x.x.x.x.x.x.' },
    groove: '9009090090090900', bass: 'x.....x...x.....',
  },
  {
    id: 'dembow', name: 'Dembow Riddim', origin: 'Jamaica → Panama → Puerto Rico & Dominican Rep.', year: 1990, region: 'AMERICAS', wiki: 'Dembow beat',
    bpm: 115, swing: 0, scale: 'minor',
    about: 'Named after Shabba Ranks\' 1990 dancehall song "Dem Bow" — the rhythm became the core of reggaetón and Dominican dembow.',
    drums: { kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.x.x.x.x.x.x.x.' },
    groove: '7007007070070070', bass: 'x..x..x.x..x..x.',
  },
  {
    id: 'champeta', name: 'Champeta', origin: 'Caribbean coast, Colombia', year: 1982, region: 'AMERICAS', wiki: 'Champeta',
    bpm: 112, swing: 0.05, scale: 'major',
    about: 'Music and dance from Colombia\'s Caribbean coast in the early 1980s, rooted in Palenque de San Basilio and played on picó sound systems.',
    drums: { kick: 'x...x...x...x...', snare: '..x...x...x...x.', perc: 'x.xx.xx.x.xx.xx.' },
    groove: '7373737373737373', bass: 'x..x..x.x..x..x.',
  },
  {
    id: 'funkot', name: 'Funkot', origin: 'Jakarta, Indonesia', year: 1995, region: 'SEA', wiki: 'Funkot',
    bpm: 180, swing: 0, scale: 'pelog',
    about: 'Indonesian house music from the 1990s at 160–220 BPM, also called "house kota".',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', tom: '..x.x.x...x.x.x.', hat: 'xxxxxxxxxxxxxxxx' },
    groove: '6060606060606060', bass: '..x...x...x...x.',
  },
  {
    id: 'molam', name: 'Mor Lam', origin: 'Laos & Isan, Thailand', year: 1970, era: 'Traditional → electric', region: 'SEA', wiki: 'Mor lam',
    bpm: 140, swing: 0.04, scale: 'pentaMajor',
    about: 'Traditional Lao song, also loved in Isan, sung over the khaen mouth organ — here imagined through drum machines and synths.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: 'x.x.x.x.x.x.x.x.' },
    groove: '8484848484848484', bass: 'x...x.x.x...x.x.',
  },
  {
    id: 'koplo', name: 'Dangdut Koplo', origin: 'East Java, Indonesia', year: 2001, region: 'SEA', wiki: 'Koplo',
    bpm: 140, swing: 0.05, scale: 'hijaz',
    about: 'A subgenre of dangdut that originated in East Java in the early 2000s, driven by kendang drums.',
    drums: { kick: 'x.......x.......', tom: 'x..x.x..x..x.x..', perc: '..x...x...x...x.', snare: '....x.......x...' },
    groove: '9009090090090900', bass: 'x..x....x..x....',
  },
  {
    id: 'shangaan', name: 'Shangaan Electro', origin: 'Limpopo, South Africa', year: 2005, region: 'AFRICA', wiki: 'Shangaan electro',
    bpm: 180, swing: 0, scale: 'pentaMajor',
    about: 'A 21st-century reboot of Tsonga folk and Tsonga disco from South African townships, popularised by Nozinja.',
    drums: { kick: 'x...x...x...x...', perc: 'x.xxx.xxx.xxx.xx', tom: '..x..x....x..x..' },
    groove: '9595959595959595', bass: 'x...x...x...x...',
  },
  {
    id: 'tecnobrega', name: 'Tecnobrega', origin: 'Belém, Brazil', year: 2002, region: 'AMERICAS', wiki: 'Tecnobrega',
    bpm: 140, swing: 0, scale: 'major',
    about: 'Music from Belém, Pará, made by remixing popular songs and 1980s hits into electronic brega.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', open: '......x.......x.' },
    groove: '7070707070707070', bass: 'x..x..x...x..x..',
  },
  {
    id: 'tribal', name: 'Tribal Guarachero', origin: 'Mexico', year: 2008, era: 'late 2000s', region: 'AMERICAS', wiki: 'Tribal guarachero',
    bpm: 128, swing: 0.06, scale: 'minor',
    about: 'Mexican "tribal" fuses electronic dance music with cumbia and rhythms from regional Mexican music.',
    drums: { kick: 'x.......x.......', snare: '....x.......x...', perc: 'x.xxx.xxx.xxx.xx', hat: '..x...x...x...x.' },
    groove: '7030703070307030', bass: 'x...x...x...x...',
  },
  {
    id: 'budots', name: 'Budots', origin: 'Davao, Philippines', year: 2007, region: 'SEA', wiki: 'Budots',
    bpm: 110, swing: 0.04, scale: 'minor',
    about: 'Street-style techno from Davao City built on techno and house with Visayan pop, spread across Bisaya-speaking regions.',
    drums: { kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    groove: '9009009009009000', bass: 'x..x..x...x..x..',
  },
  {
    id: 'mahraganat', name: 'Mahraganat', origin: 'Cairo, Egypt', year: 2007, region: 'AFRICA', wiki: 'Mahraganat',
    bpm: 130, swing: 0.05, scale: 'hijaz',
    about: 'Egyptian electro / shaabi-electro: working-class wedding music meets electronic dance music.',
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', perc: '..x.x...x.x...x.', hat: 'xxxxxxxxxxxxxxxx' },
    groove: '9009009090090090', bass: 'x..x..x.x..x..x.',
  },
  {
    id: 'dabke', name: 'Electro Dabke', origin: 'Ras al-Ayn, Syria', year: 1994, region: 'MIDEAST', wiki: 'Omar Souleyman',
    bpm: 140, swing: 0.03, scale: 'hijaz',
    about: 'Omar Souleyman began singing at weddings in 1994; his modernised dabke went on to play stages worldwide.',
    drums: { kick: 'x...x...x...x...', tom: 'x..x..x.x..x..x.', snare: '..x...x...x...x.' },
    groove: '9595959595959595', bass: 'x..x..x.x..x..x.',
  },
  {
    id: 'changa', name: 'Raptor House (Changa)', origin: 'Caracas, Venezuela', year: 1992, region: 'AMERICAS', wiki: 'Raptor house',
    bpm: 140, swing: 0, scale: 'minor',
    about: 'A lifestyle, dance and music culture from Caracas in the early 1990s, alive at parties until the late 2000s.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '..x...x...x...x.' },
    groove: '6060606060606060', bass: '..x...x...x...x.',
  },
  {
    id: 'singeli', name: 'Singeli', origin: 'Dar es Salaam, Tanzania', year: 2006, region: 'AFRICA', wiki: 'Singeli',
    bpm: 200, swing: 0, scale: 'minor',
    about: 'Born around the mid-2000s in Tandale, Dar es Salaam, with the Zaramo — very fast beats under MCs.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', perc: 'x.x.xx.xx.x.xx.x', hat: 'xxxxxxxxxxxxxxxx' },
    groove: '9090909090909090', bass: 'x...x...x...x...',
  },
  {
    id: 'gqom', name: 'Gqom', origin: 'Durban, South Africa', year: 2012, region: 'AFRICA', wiki: 'Gqom',
    bpm: 126, swing: 0, scale: 'phrygian',
    about: 'A South African subgenre of house that emerged in Durban in the early 2010s — raw, broken and percussive.',
    drums: { kick: 'x.....x...x.....', tom: '..x.....x....x..', snare: '....x.......x...' },
    groove: '9000009000900000', bass: 'x.....x...x.....',
  },
  {
    id: 'amapiano', name: 'Amapiano', origin: 'Gauteng, South Africa', year: 2012, region: 'AFRICA', wiki: 'Amapiano',
    bpm: 113, swing: 0.1, scale: 'minor',
    about: 'A hybrid of kwaito, deep house, gqom, jazz and soul with wide percussive basslines — the log drum.',
    drums: { kick: 'x...x...x...x...', shaker: 'xoxoxoxoxoxoxoxo', log: '..x..x.x...x..x.', snare: '....o.......x...', perc: '...x.......x....' },
    groove: '7030503070305030', bass: '..x..x.x...x..x.',
  },
  {
    id: 'vinahouse', name: 'Vinahouse', origin: 'Vietnam', year: 2015, era: '2010s', region: 'SEA', wiki: 'Vinahouse',
    bpm: 132, swing: 0, scale: 'minor',
    about: 'Electronic dance music popularised in Vietnam.',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', open: '..x...x...x...x.', hat: 'x.x.x.x.x.x.x.x.' },
    groove: '6060606060606060', bass: '.xx..xx..xx..xx.',
  },
];

export const DRUM_ROWS = ['kick', 'snare', 'hat', 'open', 'perc', 'tom', 'shaker', 'log'];

export function drumPattern(g) {
  const P = {};
  for (const row of DRUM_ROWS) {
    const s = (g.drums[row] || '................');
    P[row] = [...s].map(c => (c === 'x' ? 1 : c === 'o' ? 0.5 : 0));
  }
  return P;
}

export const GENRES_SORTED = () => [...GENRES].sort((a, b) => a.year - b.year);

export const genreById = id => GENRES.find(g => g.id === id) || GENRES.find(g => g.id === 'detroit');
