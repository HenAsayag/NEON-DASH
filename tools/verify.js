/* Proves every shipped level is beatable, using the game's own physics.

   It lifts the CORE block straight out of index.html, then runs a beam search
   over one-button inputs at 60 Hz. If the search reaches the finish line, a
   human can too; if it stalls, it prints the block where it stalled, which is
   the spot that needs redesigning.

   Usage:  node tools/verify.js [pathToIndex.html] [beamWidth]              */

const fs = require("fs"), path = require("path");

const indexPath = process.argv[2] || path.join(__dirname, "..", "..", "index.html");
const BEAM = parseInt(process.argv[3] || "220", 10);

const html = fs.readFileSync(indexPath, "utf8");
const a = html.indexOf("/*==CORE_START==*/"), b = html.indexOf("/*==CORE_END==*/");
if(a < 0 || b < 0){ console.error("core markers not found in " + indexPath); process.exit(2); }
const core = html.slice(a, b);

const mod = { exports:{} };
new Function("module", "console", core)(mod, console);
const C = mod.exports;
const { PHYS, LEVELS, createSim, cloneSim, simInput, stepSim } = C;

const HZ = 60;
const SUB = Math.max(1, Math.round(1/(PHYS.TIMESTEP*HZ)));
const DT  = PHYS.TIMESTEP;

function advance(sim, hold){
  for(let k=0;k<SUB;k++){
    simInput(sim, hold);
    stepSim(sim, DT);
    if(sim.dead || sim.won) return;
  }
}

function solve(level, beamWidth){
  const maxFrames = Math.ceil((level.finishX / (PHYS.BASE_VX*0.7)) * HZ) + 240;
  let beam = [ createSim(level) ];
  let bestX = 0, bestCoins = 0;

  for(let f=0; f<maxFrames; f++){
    const seen = new Map();
    const next = [];
    for(let i=0;i<beam.length;i++){
      for(let h=0; h<2; h++){
        const s = cloneSim(beam[i]);
        advance(s, h===1);
        if(s.dead) continue;
        const e = s.ents[0];
        if(e.x > bestX) bestX = e.x;
        const coins = s.coins[0]+s.coins[1]+s.coins[2];
        if(coins > bestCoins) bestCoins = coins;
        if(s.won) return { ok:true, frames:f+1, coins, slots:s.coins.slice(), bestX:e.x };

        // Collapse states that will play out identically from here.
        const key = Math.round(e.y/2) + "|" + Math.round(e.vy/8) + "|" + e.mode + "|" + e.grav +
                    "|" + (e.mini?1:0) + "|" + (e.onGround?1:0) + "|" + s.ents.length +
                    "|" + coins + "|" + (e.dashing?1:0) +
                    (s.ents[1] ? "|" + Math.round(s.ents[1].y/2) : "");
        const prev = seen.get(key);
        const score = e.x + 3000*coins;
        if(prev !== undefined && prev.score >= score) continue;
        const rec = { sim:s, score };
        seen.set(key, rec);
        next.push(rec);
      }
    }
    if(!next.length) return { ok:false, frames:f, bestX, coins:bestCoins };
    next.sort((p,q)=>q.score-p.score);

    // Every surviving state shares the same x at a given frame, so score alone
    // cannot rank them and a plain truncation quietly keeps whichever input
    // pattern was generated first - usually "never press", which hugs the
    // floor and fails every ship and wave corridor. Round-robin across height
    // bands instead, so the beam stays vertically diverse.
    if(next.length > beamWidth){
      const bands = new Map();
      for(const r of next){
        const s = r.sim;
        // Band by height and by coins held, so a state that took a detour for a
        // coin always keeps a slot instead of being crowded out by the main line.
        const k = Math.round(s.ents[0].y/6) + "c" + (s.coins[0]+s.coins[1]+s.coins[2]);
        if(!bands.has(k)) bands.set(k, []);
        bands.get(k).push(r);
      }
      const keys = [...bands.keys()], picked = [];
      for(let d=0; picked.length < beamWidth; d++){
        let added = 0;
        for(const k of keys){
          const arr = bands.get(k);
          if(d < arr.length){ picked.push(arr[d]); added++; if(picked.length >= beamWidth) break; }
        }
        if(!added) break;
      }
      next.length = 0;
      for(const r of picked) next.push(r);
    }
    beam = next.slice(0, beamWidth).map(r=>r.sim);
  }
  return { ok:false, frames:maxFrames, bestX, coins:bestCoins, timeout:true };
}

let failed = 0;
for(const L of LEVELS){
  const t0 = Date.now();
  const r = solve(L, BEAM);
  const secs = (L.finishX / (PHYS.BASE_VX*L.meta.startSpeed)).toFixed(0);
  const label = (L.meta.name + " (" + L.meta.difficulty + ")").padEnd(26);
  if(r.ok){
    console.log("PASS  " + label +
      "beaten in " + (r.frames/HZ).toFixed(1) + "s, " +
      r.coins + "/3 coins, " + L.objects.length + " objects, " +
      L.meta.lengthBlocks + " blocks  [" + ((Date.now()-t0)/1000).toFixed(1) + "s search]");
    if(r.coins < 3) console.log("      note: only found " + r.coins + " coins; slots collected = [" + r.slots.join(",") + "]");
  } else {
    failed++;
    console.log("FAIL  " + label + (r.timeout?"ran out of frames":"stuck") +
      " at block " + (r.bestX/PHYS.UNIT).toFixed(1) +
      " of " + L.meta.lengthBlocks + "  [" + ((Date.now()-t0)/1000).toFixed(1) + "s]");
  }
}
process.exit(failed ? 1 : 0);
