# 👻 Ghost Lab

**A 4D codex of the restless dead, wired into a modular synth, a full mixer and your analog gear. You play it as a game.**

Live at **https://xboxzero.github.io/ghostlab/**

## What's inside

- **322 ghosts from world folklore**, each matched to a **Wikipedia** article. The Codex shows the article's lead text, a link and (when it is on Wikimedia Commons) its image. 256 ghosts have an article of their own; the rest link to the broader article that covers them (for example *Ghosts in Bengali culture*).
- **3D ghosts designed from Wikipedia**: every ghost is a procedural 3D model in a dark-fantasy style: lathe-turned gowns with realm textile patterns, strand hair, sculpted faces with glowing eyes, and studio lighting with realm-coloured rim light. Its form and props come from words in its article: a floating head with entrails (Krasue), headless with its head under one arm (Dullahan), a ghost ship (Flying Dutchman), a spectral hound (Black Shuck), a ghost light (Marfa lights), antlers (Herne), fox tails, horns, wings, talismans, crowns, hoods, veils, burial shrouds, chains and more. The Codex lists the traits it used and shows a live 3D model you can turn.
- **A 4D world**: a low-res, dithered, vertex-wobbling 3D graveyard with neon shrines and data rain. Its fourth dimension is **time**: each ring around the Bonfire is an age, with the oldest on the outside.
- **Sound History**: 26 grooves from electronic music history, weighted toward the Global South. It runs from Halim El-Dabh's 1944 *Expression of Zaar* and Charanjit Singh's *Ten Ragas to a Disco Beat* through Dub, Kwaito, Kuduro, Goa trance, Funk carioca, Raï, Champeta, Funkot, Mor lam, Shangaan electro, Mahraganat, Electro dabke, Singeli, Raptor house, Tribal guarachero, Gqom, Amapiano, Vinahouse and more. Each genre sets the tempo, swing, scale (incl. maqam Hijaz, raga Bhairav, pelog, khaen pentatonic), an 8-voice drum kit (with an amapiano log drum) and a groove map, and every ghost re-learns its part.
- **Modular synth**: 8 ghost voices (pads, wailing leads, knock percussion, plucks, acid bass, FM bells, formant choir, sub bass), each with a filter, **two FX slots** (13 effects incl. ping-pong, haunted tape, comb resonator tuned to the key, auto-wah, flanger), an XY pad and a 16-step sequence.
- **Patching**: chain ghosts in **serial** (A → B → Bonfire: A plays through B's filter and FX) or run them in **parallel**. Your analog synth can go through any ghost too.
- **Safe audio**: every feedback loop stays below unity gain, a soft clipper sits at the very end of the chain, a watchdog resets effects if the mix runs away, and **PANIC** (P) clears every effect tail.
- **Mixer**: channel strips with fader, pan, 3-band EQ, two sends (reverb bus, tempo-echo bus), mute, solo and meters; two return buses; a master section with EQ, a one-knob DJ filter, hold-to-play **Stutter / Gate / Wash / Crush** pads (keys 1–4) and a limiter. The **endpoint** can be any output device (Chrome/Edge) or a recorded file.
- **Analog In / Sync (3.5 mm)**: plug a hardware synth, drum machine, Volca or Pocket Operator into line-in:
  - its audio becomes a Lab module you can patch through ghosts
  - **pitch follow**: a held note sets the key every ghost plays in
  - **envelope**: its loudness can drive ghost filters, the DJ filter, a sidechain pump or Haunt
  - **trigger**: each hit fires a ghost
  - **sync in**: its clock pulses (1 per 16th / 8th / beat) set and phase-lock the tempo
  - **sync out**: clock pulses on the **left** channel and mono music on the **right**, Pocket Operator style, to drive your gear from the headphone jack. Built-in jacks can't carry DC control voltage; CV needs a DC-coupled interface.
- **The game**: music earns **souls** every bar. Spend them to bind ghosts of the current age, and fulfil 19 **Rites**, including a Global South tour, analog séance and live glitching.

## Keys

| | |
|---|---|
| **Space** | Play / stop |
| **Drag / scroll / WASD** | Look / zoom / walk the world |
| **C / L / M / G / I / R / H** | Codex / Lab / Mixer / Sound history / Analog in / Rites / Help |
| **1 2 3 4 (hold)** | Stutter / Gate / Wash / Crush |
| **P** | Panic: reset all effects |
| **[ ]** | Travel back / forward through the ages |

## Tech

Plain static site, no build step: [three.js](https://threejs.org) from a CDN for the world, and the Web Audio API (with an AudioWorklet for onset detection) for all sound. Progress is saved in `localStorage`. The microphone/line-in is only opened when you press *Connect analog input*.

```
index.html            page shell + HUD
css/style.css         Cyberpunk × Ragnarok UI
js/data.js            the ghost codex (322 entries)
js/wiki.js            Wikipedia references (generated from the REST API)
js/traits.js          Wikipedia text → visual traits
js/ghost3d.js         procedural 3D ghost models
js/portrait.js        renders the models into the sprite atlas (cached in IndexedDB) + Codex 3D viewer
js/genres.js          Sound History genres, scales, drum patterns
js/genre-wiki.js      Wikipedia references for genres
js/audio.js           synth engine, voices, FX, channel strips, buses, master, sync out
js/analog.js          analog input, pitch follow, envelope, sync in, triggers
js/detector-worklet.js onset/envelope AudioWorklet
js/mixer.js           mixer UI
js/lab.js             patch board UI
js/codex.js           wiki UI
js/world.js           3D world
js/game.js            souls, rites, saving
js/main.js            wiring
```

Run locally with any static server, for example `python3 -m http.server`, then open http://localhost:8000. Deploys to the `gh-pages` branch via `.github/workflows/pages.yml`.

## Credits

Ghost and genre descriptions are quoted from **Wikipedia** and available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each entry links to its source article. Images in the Codex load from Wikimedia Commons and link back to their articles.
