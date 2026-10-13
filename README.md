# 👻 Ghost Lab

**An encyclopaedia of the restless dead, wired into a modular techno synthesizer you play as a game.**

Live at **https://xboxzero.github.io/ghostlab/**

- **357 ghosts** from folklore around the world, across 8 realms (East Asia, Southeast Asia, South Asia, the Middle East, Africa, Europe, the Americas, Oceania), each with its own lore, stats and a procedurally drawn anime pixel portrait.
- **A 4D world**: a low-res, dithered, vertex-wobbling 3D graveyard in a 90s style, set in a Dark Souls-like world. The fourth dimension is **time**: each ring around the Bonfire is an age, with the oldest on the outside. Turn the **Chronos Dial** to travel through the ages.
- **A modular synth**: every ghost is an instrument (8 voice types: pads, wailing leads, knock percussion, plucks, acid bass, FM bells, formant choir, sub bass) with its own effect (reverb, delay, drive, bitcrush, chorus, phaser, tremolo, ring mod), filter, *Haunt* macro and 16-step sequence. There is also a built-in Ritual Drum.
- **Patching**: drag cables between ghosts. Chain them in **serial** (A → B → Bonfire, so A plays through B's filter and FX) or send them in **parallel** straight to the Bonfire.
- **The game**: music earns **souls** every bar. Longer serial chains and more realms earn more. Spend souls to bind new ghosts, fulfil **Rites** (quests) for rewards, and record your séance to a file.

## How to play

| | |
|---|---|
| **Space** | Play / stop |
| **Drag / scroll / WASD** | Look around / zoom / walk the world |
| **Click a ghost** | Open its Codex page (lore, voice preview, bind) |
| **[ ]** | Travel back / forward through the ages |
| **C / L / R / H** | Codex / Lab / Rites / Help |

In the Lab, drag from a ghost's orange **output** port to another ghost's **input** port (serial) or to the Bonfire (parallel). Click a cable to cut it. Select a ghost to shape its sound and edit its sequence.

## Tech

Plain static site: no build step. It uses [three.js](https://threejs.org) from a CDN for the world and the Web Audio API for all sound synthesis. Progress is saved in `localStorage`.

```
index.html        page shell + HUD
css/style.css     UI theme
js/data.js        the ghost codex (357 entries)
js/portrait.js    procedural anime pixel portraits
js/audio.js       modular synth engine, voices, FX, sequencer
js/world.js       3D world, post-process dithering, time rings
js/lab.js         patch board UI (serial / parallel routing)
js/codex.js       wiki UI
js/game.js        souls economy, rites, saving
js/main.js        wiring
```

Run locally with any static server, for example `python3 -m http.server`, then open http://localhost:8000.

Deploys automatically to GitHub Pages via `.github/workflows/pages.yml`.
