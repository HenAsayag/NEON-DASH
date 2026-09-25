# NEON DASH — build notes

**To play, you only need `index.html`.** Double-click it, or serve the folder.
Everything else here is the toolchain that produced and checked it.

```
index.html     the game: HTML + CSS + JS in one file, Canvas 2D, no dependencies
assets/        the sprite kit, unchanged. Optional - delete it and the game
               still runs on procedural stand-ins
src/*.part     the sources index.html is concatenated from, in filename order
tools/         build, level generation, and the level verifier
```

## Rebuilding

```bash
node tools/genlevels.js                 # authors the 3 levels -> src/14-core-levels.part
node tools/build.js index.html          # concatenates src/*.part -> index.html
node tools/verify.js index.html 400     # proves every level is beatable
```

`build.js` is a plain `cat` in filename order — there is no transpiling, no
bundler and no minifier, so what ships is exactly what is in `src/`.

## Why a generator instead of hand-written level JSON

Obstacles have to land on the beat, and a beat is a different number of blocks
at every speed:

```
blocks per beat = BASE_VX * speed / UNIT * (60 / bpm)
```

`genlevels.js` computes that, and computes anything else that depends on a jump
arc from the same constants the engine uses — how many spikes a given pad can
clear, and where an orb has to sit to be catchable. It also audits the result
and refuses to stay quiet about runs of ground hazards no jump can cross.

Levels are emitted in exactly the schema in `assets/levels/level-schema.json`,
so they still round-trip through the in-game editor's import/export.

## Why a verifier

"Every level is always beatable" is an acceptance criterion, and the honest way
to hold it is to check rather than to assert. `verify.js` lifts the `CORE` block
straight out of the shipped `index.html` — the same physics the player runs —
and beam-searches one-button inputs at 60 Hz. If it reaches the finish line, a
human can. If it stalls, it prints the block it stalled at, which is the spot
that needs redesigning. It found four real design bugs during development:

- a spike sharing a pad's cell, which killed the player before the pad fired
- a platform three blocks tall, which no cube or robot jump can reach
- four adjacent ground spikes, which no jump covers
- sections overlapping because the beat cursor was recomputed rather than
  accumulated across a speed change

`tools/at.js <level> <block>` prints what is at a given block, for diagnosing a
stall. `tools/serve.js <dir> <port>` is a static server for local testing.

## Leaderboard

Off by default and local-only. See FIREBASE.md to connect Cloud Firestore.

Same data and security model as the pitzi-roll board - anonymous auth, a
first-come-first-served nickname registry, one score row per player per level
that can only improve - but driven over the Firestore REST API with plain
fetch() rather than the CDN SDK, so the single-file, runs-from-file:// property
is preserved.

## Current state

```
PASS  First Light (easy)      beaten in 48.7s, 3/3 coins,  274 objects,  506 blocks
PASS  Static Bloom (normal)   beaten in 46.9s, 3/3 coins,  330 objects,  636 blocks
PASS  Overdrive (hard)        beaten in 52.6s, 3/3 coins,  407 objects,  757 blocks
PASS  Impossible (demon)      beaten in 59.5s, 3/3 coins,  720 objects, 1092 blocks
```
