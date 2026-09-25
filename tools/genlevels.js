/* Authors the three NEON DASH levels and writes src/14-core-levels.part.

   Obstacles sit on the level's own beat grid:
       blocks per beat = BASE_VX * speed / UNIT * (60 / bpm)
   so they land on the music. Anything that depends on a jump arc - how many
   spikes a pad can clear, where an orb has to sit to be catchable - is
   computed from the same constants the engine uses rather than eyeballed,
   and a final pass warns about runs no cube jump can cross.

   Run:  node tools/genlevels.js                                            */

const fs = require("fs");
const path = require("path");

const BASE_VX = 311.6, UNIT = 30;
const VXB = BASE_VX/UNIT;               // 10.3867 blocks per second at speed 1
const G   = 2560;                       // cube gravity
const CUBE_H = 0.85;                    // cube hitbox height in blocks
const SPIKE_TOP = 0.5;                  // a ground spike's lethal box reaches this high

/* The arc of the player's feet after an impulse that reaches `H` blocks.
   Returns, in blocks relative to the launch point, the window in which the
   feet are above a ground spike, and where the jump lands. */
function arc(H, speed){
  const v = Math.sqrt(2*G*H*UNIT);
  const disc = Math.sqrt(Math.max(0, v*v - 2*G*SPIKE_TOP*UNIT));
  const t1 = (v-disc)/G, t2 = (v+disc)/G, tt = 2*v/G;
  return {
    v, clearFrom: t1*VXB*speed, clearTo: t2*VXB*speed,
    land: tt*VXB*speed, apexDX: (v/G)*VXB*speed, apexDY: H
  };
}
const CUBE_JUMP_H = 555*555/(2*G)/UNIT;           // 2.006 blocks

let WARNINGS = [];

function Builder(meta){
  const objs = [];
  let b = 0;
  let speed = meta.startSpeed || 1;
  // A beat is a different number of blocks at each speed, so x cannot be
  // recomputed from the beat cursor alone - it has to accumulate. Each speed
  // change pins the current position and the beat grid continues from there.
  let bAnchor = 0, xAnchor = 0;
  const beatLen = ()=> VXB*speed*(60/meta.bpm);
  const self = {
    meta, objs,
    get beat(){ return beatLen(); },
    get b(){ return b; },
    set b(v){ b = v; },
    x(off){ return Math.round(xAnchor + (b + (off||0) - bAnchor)*beatLen()); },
    setSpeed(s){ xAnchor = self.x(); bAnchor = b; speed = s; },
    get speed(){ return speed; },
    put(t,x,y,extra){
      const o = {t, x:Math.round(x), y:Math.round(y*100)/100};
      if(extra) Object.assign(o, extra);
      objs.push(o); return o;
    }
  };
  return self;
}

const P = {
  spike:(L,x,y,rot)=>L.put("spike",x,y||0, rot?{rot}:null),
  triple:(L,x,y)=>L.put("spike-triple",x,y||0),
  saw:(L,x,y)=>L.put("saw",x,y),
  block:(L,x,y)=>L.put("block",x,y),
  plat:(L,x,w,h)=>{ for(let i=0;i<w;i++) for(let j=0;j<h;j++) L.put("block",x+i,j); },
  roof:(L,x,w,y)=>{ for(let i=0;i<w;i++) L.put("block",x+i,y); },

  /* Ground spikes that a jump of height H, launched on contact at `contactX`,
     is guaranteed to clear - and that leave the landing spot free. */
  cleared:(L,contactX,H,count)=>{
    const a = arc(H, L.speed);
    const lo = contactX + a.clearFrom, hi = contactX + a.clearTo;
    const placed = [];
    // Start a full block past the contact point. The window opens almost at
    // once, but a spike sharing the pad's own cell is lethal: hazards are
    // tested before triggers, so it would kill before the pad ever fires.
    const first = Math.max(Math.ceil(lo - 0.3), Math.ceil(contactX + 1));
    for(let x = first; x + 0.7 <= hi; x++){
      if(x + 0.7 > contactX + a.land - 0.6) break;      // keep the landing clear
      if(x + 0.3 < lo) continue;
      placed.push(x);
      if(count && placed.length >= count) break;
    }
    placed.forEach(x=>P.spike(L,x,0));
    return { placed, land: contactX + a.land };
  },

  /* Orbs positioned at each successive jump apex, which is where the player
     hangs longest and so where the tap window is widest. */
  orbChain:(L, launchX, kinds)=>{
    const out = [];
    let y = CUBE_H/2, x = launchX;
    for(let k=0;k<kinds.length;k++){
      const a = arc(CUBE_JUMP_H, L.speed);
      x += a.apexDX;
      y += a.apexDY;
      out.push(L.put(kinds[k], Math.round(x), Math.round(y-0.5)));
    }
    const a2 = arc(CUBE_JUMP_H, L.speed);
    return { objs: out, apexX: x + a2.apexDX, topY: y + a2.apexDY, endX: x + a2.land };
  }
};

/* ======================================================================== *
   LEVEL 1 - First Light        128 BPM, easy
 * ======================================================================== */
function level1(){
  const L = Builder({
    id:"level-01", name:"First Light", difficulty:"easy", bpm:128,
    music:"assets/audio/level-01.mp3", musicOffsetMs:0,
    startMode:"cube", startSpeed:1, bgColor:"#140B2E", groundColor:"#241148", hue:0
  });

  /* 0-3 runway, then single spikes straight on the beat */
  [3,4,5,6].forEach(n=>{ L.b=n; P.spike(L, L.x()); });
  L.b = 8;  P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 10; P.spike(L, L.x());

  /* platforms: step up, run along, drop off */
  L.b = 12; P.plat(L, L.x(), 5, 1);
  L.b = 14.5; P.spike(L, L.x());
  L.b = 16; L.put("slope", L.x(), 0); P.plat(L, L.x()+1, 4, 1);
  L.b = 18; P.plat(L, L.x(), 5, 2);
  L.b = 20; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 22; L.put("spike-mini", L.x(), 0); L.put("block-half", L.x()+3, 0);

  /* first pad: a gap far too wide to jump */
  L.b = 24;
  const padX = L.x();
  L.put("pad-yellow", padX, 0);
  const r1 = P.cleared(L, padX-0.425, 3.2, 3);
  // Dead centre of the pad arc, not just "somewhere up there": the player's
  // centre at apex is CUBE_H/2 + 3.2 blocks, and a coin cell sits 0.5 below.
  L.put("coin", Math.round(padX + arc(3.2,L.speed).apexDX), Math.round(CUBE_H/2 + 3.2 - 0.5));
  L.b = 27; P.spike(L, L.x());

  /* first orbs: tap again in mid-air */
  L.b = 29;
  const c1 = P.orbChain(L, L.x(), ["orb-yellow"]);
  P.spike(L, Math.round(c1.apexX), 0);
  L.b = 32;
  const c2 = P.orbChain(L, L.x(), ["orb-yellow","orb-pink"]);
  P.spike(L, Math.round(c2.objs[0].x)+2, 0);
  L.b = 36; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 38; P.spike(L, L.x());

  /* ship corridor: the world floor stays the floor, a roof is added above */
  L.b = 40;
  const s1 = L.x();
  L.put("portal-ship", s1, 0);
  const s1len = Math.round(15*L.beat);
  P.roof(L, s1+3, s1len, 6);
  const shipPins = [[0,2],[1,2],[0,3],[1,2],[0,2],[1,3],[0,2],[1,2],[0,2],[1,2]];
  shipPins.forEach((pin,i)=>{
    const x = s1+14 + i*8, h = pin[1];
    if(x > s1+3+s1len-7) return;
    for(let j=0;j<h;j++) P.block(L, x, pin[0] ? 5-j : j);
    P.spike(L, x, pin[0] ? 5-h : h, pin[0]?180:0);
  });
  L.put("coin", s1+3+Math.round(s1len*0.5), 5);
  L.b = 57; L.put("portal-cube", L.x(), 0);

  /* gravity flip: run along the underside of a solid roof */
  L.b = 59;
  const g1 = L.x();
  L.put("portal-gravity-up", g1, 0);
  const g1len = Math.round(8*L.beat);
  P.roof(L, g1+2, g1len, 6);
  [0.30, 0.55, 0.80].forEach(f=>{
    P.spike(L, g1+2+Math.round(g1len*f), 5, 180);    // hangs down into the lane
  });
  // Sits in the one stretch of the lane where the player is provably on the
  // roof: past the landing of the first hop, before the takeoff for the second.
  L.put("coin", g1+2+Math.round((g1len*0.30 + g1len*0.55)/2), 5);
  L.put("portal-gravity-down", g1+2+g1len+1, 0);

  /* gentle wave corridor */
  L.b = 69;
  const w1 = L.x();
  L.put("portal-wave", w1, 0);
  const w1len = Math.round(10*L.beat);
  P.roof(L, w1+3, w1len, 6);
  for(let i=0;i<8;i++){
    const x = w1+12+i*8;
    if(x > w1+3+w1len-6) break;
    if(i%2===0){ P.block(L,x,0); P.spike(L,x,1); }
    else       { P.block(L,x,5); P.spike(L,x,4,180); }
  }
  L.b = 81; L.put("portal-cube", L.x(), 0);

  /* cube finale */
  L.b = 84; P.spike(L, L.x());
  L.b = 85; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 87; L.put("pad-pink", L.x(), 0); P.cleared(L, L.x()-0.425, 1.6, 2);
  L.b = 89; P.plat(L, L.x(), 4, 1);
  L.b = 91; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 93; P.spike(L, L.x());
  L.b = 95; P.triple(L, L.x());
  L.b = 97; P.plat(L, L.x(), 5, 1);
  L.b = 99; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 101; P.spike(L, L.x());

  L.b = 104;
  L.put("finish", L.x(), 0);
  L.meta.lengthBlocks = L.x();
  return L;
}

/* ======================================================================== *
   LEVEL 2 - Static Bloom       140 BPM, normal
 * ======================================================================== */
function level2(){
  const L = Builder({
    id:"level-02", name:"Static Bloom", difficulty:"normal", bpm:140,
    music:"assets/audio/level-02.mp3", musicOffsetMs:0,
    startMode:"cube", startSpeed:1, bgColor:"#17103a", groundColor:"#2a1657", hue:24
  });

  [3,4,5].forEach(n=>{ L.b=n; P.spike(L, L.x()); });
  L.b = 6;   P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 8;   P.plat(L, L.x(), 4, 1);
  L.b = 10;  P.triple(L, L.x());
  L.b = 12;  const oc = P.orbChain(L, L.x(), ["orb-yellow"]);
             P.spike(L, Math.round(oc.apexX), 0);
  L.b = 15;  P.saw(L, L.x(), 0);
  L.b = 17;  P.spike(L, L.x()); P.spike(L, L.x()+1);

  /* speed up into a ball tunnel */
  L.b = 18.5; L.put("speed-slow", L.x(), 0); L.setSpeed(0.807);
  L.b = 19.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 21.5; P.triple(L, L.x());
  L.b = 23.5; L.put("speed-fast", L.x(), 0); L.setSpeed(1.243);
  L.b = 25; P.spike(L, L.x());
  L.b = 26.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 28;
  const b1 = L.x();
  L.put("portal-ball", b1, 0);
  const b1len = Math.round(12*L.beat);
  P.roof(L, b1+4, b1len, 5);
  for(let i=0;i<8;i++){
    const x = b1+16 + i*11;
    if(x > b1+4+b1len-8) break;
    if(i%2===0){ P.spike(L,x,0); P.spike(L,x+1,0); }
    else       { P.spike(L,x,4,180); P.spike(L,x+1,4,180); }
  }
  L.put("coin", b1+4+Math.round(b1len*0.5), 2);
  L.b = 39; L.put("portal-cube", L.x(), 0);

  /* blue pad flips you onto the roof, then back */
  L.b = 41; L.put("speed-normal", L.x(), 0); L.setSpeed(1.0);
  L.b = 39; P.spike(L, L.x());
  L.b = 41;
  const q = L.x();
  L.put("pad-blue", q, 0);
  const qlen = Math.round(7*L.beat);
  P.roof(L, q+3, qlen, 6);
  [0.35, 0.62, 0.85].forEach(f=>{ P.spike(L, q+3+Math.round(qlen*f), 5, 180); });
  L.put("portal-gravity-down", q+3+qlen+1, 0);
  L.b = 50; P.spike(L, L.x());
  L.b = 51; P.spike(L, L.x()); P.spike(L, L.x()+1);

  /* UFO */
  L.b = 53;
  const u1 = L.x();
  L.put("portal-ufo", u1, 0);
  const u1len = Math.round(13*L.beat);
  P.roof(L, u1+3, u1len, 7);
  for(let i=0;i<9;i++){
    const x = u1+14 + i*9;
    if(x > u1+3+u1len-7) break;
    const h = 2 + (i%3===2 ? 1 : 0);
    if(i%2===0){ for(let j=0;j<h;j++) P.block(L,x,j); P.spike(L,x,h); }
    else       { for(let j=0;j<h;j++) P.block(L,x,6-j); P.spike(L,x,6-h,180); }
  }
  L.put("coin", u1+3+Math.round(u1len*0.72), 6);
  L.b = 67; L.put("portal-cube", L.x(), 0);

  /* saw alley, faster */
  L.b = 69; L.put("speed-faster", L.x(), 0); L.setSpeed(1.502);
  L.b = 70.5; P.spike(L, L.x());
  L.b = 72; P.saw(L, L.x(), 0);
  L.b = 73.5; P.plat(L, L.x(), 5, 1);
  L.b = 75; P.saw(L, L.x(), 3);
  L.b = 76.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 78;
  const pr = L.x(); L.put("pad-yellow", pr, 0); P.cleared(L, pr-0.425, 3.2, 4);
  L.b = 81; P.spike(L, L.x());
  L.b = 82; L.put("speed-normal", L.x(), 0); L.setSpeed(1.0);

  /* robot outro */
  L.b = 84; L.put("portal-robot", L.x(), 0);
  L.b = 86; P.plat(L, L.x(), 5, 2);
  L.b = 88.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 90.5; P.plat(L, L.x(), 5, 2);
  L.b = 93; P.triple(L, L.x());
  L.b = 95; L.put("portal-cube", L.x(), 0);
  L.b = 96.5; P.spike(L, L.x());
  L.b = 97.5; P.spike(L, L.x()); P.spike(L, L.x()+1);

  /* gravity ping-pong, then a long cube run home */
  L.b = 100; P.spike(L, L.x());
  L.b = 102;
  const bp = L.x(), bplen = Math.round(6*L.beat);
  L.put("pad-blue", bp, 0);
  P.roof(L, bp+3, bplen, 6);
  [0.38, 0.66].forEach(f=>{ P.spike(L, bp+3+Math.round(bplen*f), 5, 180); });
  L.put("coin", bp+3+Math.round(bplen*0.52), 5);          // only on the full roof lane
  L.put("portal-gravity-down", bp+3+bplen+1, 0);

  L.b = 110; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 112; P.plat(L, L.x(), 5, 1);
  L.b = 114; P.triple(L, L.x());
  L.b = 116;
  const oc2 = P.orbChain(L, L.x(), ["orb-yellow","orb-yellow"]);
  [0,1,2].forEach(k=>{ P.spike(L, Math.round(oc2.objs[0].x)+k*3, 0); });
  L.b = 120; P.spike(L, L.x());
  L.b = 121.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 123.5; P.saw(L, L.x(), 0);
  L.b = 125.5; P.plat(L, L.x(), 5, 2);
  L.b = 128; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 130; P.spike(L, L.x());

  L.b = 133;
  L.put("finish", L.x(), 0);
  L.meta.lengthBlocks = L.x();
  return L;
}

/* ======================================================================== *
   LEVEL 3 - Overdrive          160 BPM, hard
 * ======================================================================== */
function level3(){
  const L = Builder({
    id:"level-03", name:"Overdrive", difficulty:"hard", bpm:160,
    music:"assets/audio/level-03.mp3", musicOffsetMs:0,
    startMode:"cube", startSpeed:1.243, bgColor:"#1b0a33", groundColor:"#341063", hue:300
  });
  L.setSpeed(1.243);

  [3,4,5,6].forEach(n=>{ L.b=n; P.spike(L, L.x()); });
  L.b = 8;  P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 10; P.plat(L, L.x(), 5, 1);
  L.b = 12; P.triple(L, L.x());
  L.b = 14; P.saw(L, L.x(), 0);

  /* orb chain: three taps, each one caught at the previous apex */
  L.b = 16;
  const ch = P.orbChain(L, L.x(), ["orb-yellow","orb-yellow","orb-pink"]);
  [0,1,2,3].forEach(k=>{ P.spike(L, Math.round(ch.objs[0].x)+k*3, 0); });
  L.put("coin", Math.round(ch.apexX), Math.round(ch.topY-0.5));
  L.b = 21; P.spike(L, L.x());

  /* mini cube through a low lane */
  L.b = 23; L.put("portal-mini", L.x(), 0);
  L.b = 24.5;
  const m0 = L.x(), mlen = Math.round(6*L.beat);
  P.roof(L, m0, mlen, 3);
  for(let i=0;i<5;i++){
    const x = m0+8 + i*10;
    if(x > m0+mlen-5) break;
    P.spike(L, x); P.spike(L, x+1);
  }
  L.b = 31; L.put("portal-big", L.x(), 0);
  L.b = 32.5; P.spike(L,L.x()); P.spike(L,L.x()+1);

  /* wave corridor, mini in the middle */
  L.b = 34;
  const w0 = L.x(), wlen = Math.round(16*L.beat);
  L.put("portal-wave", w0, 0);
  P.roof(L, w0+3, wlen, 7);
  for(let i=0;i<16;i++){
    const x = w0+13 + i*7;
    if(x > w0+3+wlen-6) break;
    if(i%2===0){ P.block(L,x,0); P.spike(L,x,1); }
    else       { P.block(L,x,6); P.spike(L,x,5,180); }
  }
  L.put("portal-mini", w0+3+Math.round(wlen*0.42), 3);
  L.put("portal-big",  w0+3+Math.round(wlen*0.80), 3);
  L.put("coin", w0+3+Math.round(wlen*0.60), 3);
  L.b = 51; L.put("portal-cube", L.x(), 0);

  /* short dual: two mirrored cubes, both must survive */
  L.b = 53;
  const d0 = L.x();
  L.put("portal-dual", d0, 0);
  const dlen = Math.round(8*L.beat);
  P.roof(L, d0+2, dlen, 12);
  [3,4,5,6,7].forEach(n=>{
    L.b = 53+n;
    const x = L.x();
    P.spike(L, x, 0);
    P.spike(L, x, 11, 180);
  });
  L.b = 61.5; L.put("portal-dual", L.x(), 0);

  /* ship squeeze at high speed */
  L.b = 63; L.put("speed-faster", L.x(), 0); L.setSpeed(1.502);
  L.b = 64;
  const s0 = L.x(), slen = Math.round(13*L.beat);
  L.put("portal-ship", s0, 0);
  P.roof(L, s0+3, slen, 6);
  for(let i=0;i<10;i++){
    const x = s0+16 + i*11;
    if(x > s0+3+slen-8) break;
    const h = 2+(i%2);
    if(i%2===0){ for(let j=0;j<h;j++) P.block(L,x,j); P.spike(L,x,h); }
    else       { for(let j=0;j<h;j++) P.block(L,x,5-j); P.spike(L,x,5-h,180); }
  }
  L.put("coin", s0+3+Math.round(slen*0.46), 4);
  L.b = 78; L.put("portal-cube", L.x(), 0);
  L.b = 79; L.put("speed-fast", L.x(), 0); L.setSpeed(1.243);

  /* finale */
  L.b = 81; P.spike(L, L.x());
  L.b = 83;
  const pf = L.x(); L.put("pad-red", pf, 0); P.cleared(L, pf-0.425, 4.5, 5);
  L.b = 86; P.saw(L, L.x(), 1);
  L.b = 88; P.spike(L,L.x()); P.spike(L,L.x()+1);
  L.b = 90; P.plat(L, L.x(), 5, 1);
  L.b = 92; P.triple(L, L.x());
  L.b = 94.5; P.spike(L, L.x());
  L.b = 96; P.spike(L, L.x()); P.spike(L, L.x()+1);

  /* robot stairs, then a last cube sprint */
  L.b = 98; L.put("portal-robot", L.x(), 0);
  L.b = 100; P.plat(L, L.x(), 5, 2);
  L.b = 102.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 104.5; P.plat(L, L.x(), 5, 2);
  L.b = 107; P.triple(L, L.x());
  L.b = 109; L.put("portal-cube", L.x(), 0);

  L.b = 111;
  const p2 = L.x(); L.put("pad-yellow", p2, 0); P.cleared(L, p2-0.425, 3.2, 4);
  L.b = 114; P.saw(L, L.x(), 0);
  L.b = 116; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 118;
  const oc3 = P.orbChain(L, L.x(), ["orb-yellow","orb-yellow"]);
  [0,1,2,3].forEach(k=>{ P.spike(L, Math.round(oc3.objs[0].x)+k*3, 0); });
  L.b = 122; P.spike(L, L.x());
  L.b = 123.5; P.triple(L, L.x());
  L.b = 126; P.plat(L, L.x(), 5, 1);
  L.b = 128; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 130; P.spike(L, L.x());

  /* mirror: the world runs backwards while the controls do not */
  L.b = 132; L.put("portal-mirror", L.x(), 0);
  L.b = 134; P.spike(L, L.x());
  L.b = 136; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 138; P.plat(L, L.x(), 5, 1);
  L.b = 140.5; L.put("portal-mirror", L.x(), 0);

  /* dash orb: hold it down and fly a flat line over the whole field */
  L.b = 143;
  const dc = P.orbChain(L, L.x(), ["orb-dash"]);
  for(let i=0;i<12;i++) P.spike(L, Math.round(dc.objs[0].x)+2+i, 0);
  L.b = 148; P.spike(L, L.x());
  L.b = 150; P.spike(L, L.x()); P.spike(L, L.x()+1);

  L.b = 153;
  L.put("finish", L.x(), 0);
  L.meta.lengthBlocks = L.x();
  return L;
}

/* ======================================================================== *
   LEVEL 4 - Impossible         180 BPM, demon

   At 180 BPM a beat is 0.333s while a cube jump is airborne for 0.4336s, so
   a jump spans 1.3 beats and ground obstacles can never sit closer than about
   1.5 beats apart. The difficulty here is not tighter geometry - that would
   just be unbeatable - it is the rate of decisions: every section switches
   form, most windows are a handful of frames wide, and two of the corridors
   run at the top speed multiplier.
 * ======================================================================== */
function level4(){
  const L = Builder({
    id:"level-04", name:"Impossible", difficulty:"demon", bpm:180,
    music:"assets/audio/level-04.mp3", musicOffsetMs:0,
    startMode:"cube", startSpeed:1.502, bgColor:"#240733", groundColor:"#4a0f4f", hue:330
  });
  L.setSpeed(1.502);

  /* A - cold open, no runway to speak of */
  [4, 5.5, 7, 8.5].forEach(n=>{ L.b=n; P.spike(L, L.x()); });
  L.b = 10;   P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 12;   P.plat(L, L.x(), 6, 1);
  L.b = 14;   P.triple(L, L.x());
  L.b = 16;   P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 17.5; P.saw(L, L.x(), 0);

  /* B - three-orb chain, nothing but hazard underneath */
  L.b = 19.5;
  const ch1 = P.orbChain(L, L.x(), ["orb-yellow","orb-yellow","orb-pink"]);
  // The field has to start after the launch point - a spike on the takeoff
  // block kills before the chain begins - and end before the chain lands.
  for(let i=0;i<14;i++) if(i%4!==3) P.spike(L, Math.round(ch1.objs[0].x)-1+i, 0);
  L.put("coin", Math.round(ch1.apexX), Math.round(ch1.topY-0.5));
  L.b = 25.5; P.spike(L, L.x());
  L.b = 27;   P.spike(L, L.x()); P.spike(L, L.x()+1);

  /* C - mini cube under a three-block roof */
  L.b = 29; L.put("portal-mini", L.x(), 0);
  L.b = 30.5;
  const m0 = L.x(), mlen = Math.round(10*L.beat);
  P.roof(L, m0, mlen, 3);
  for(let i=0;i<9;i++){
    const x = m0 + 9 + i*9;
    if(x > m0+mlen-5) break;
    P.spike(L, x); P.spike(L, x+1);
  }
  L.b = 41; L.put("portal-big", L.x(), 0);

  /* D - wave at the top speed multiplier, two-block lane */
  L.b = 43; L.put("speed-fastest", L.x(), 0); L.setSpeed(1.849);
  L.b = 44.5;
  const w0 = L.x(), wlen = Math.round(17*L.beat);
  L.put("portal-wave", w0, 0);
  P.roof(L, w0+3, wlen, 5);
  for(let i=0;i<26;i++){
    const x = w0+13 + i*6;
    if(x > w0+3+wlen-6) break;
    if(i%2===0){ P.block(L,x,0); P.block(L,x,1); P.spike(L,x,2); }
    else       { P.block(L,x,4); P.block(L,x,3); P.spike(L,x,2,180); }
  }
  L.put("portal-mini", w0+3+Math.round(wlen*0.44), 2);
  L.put("portal-big",  w0+3+Math.round(wlen*0.81), 2);
  L.b = 62; L.put("portal-cube", L.x(), 0);

  /* E - ship squeeze */
  L.b = 64; L.put("speed-faster", L.x(), 0); L.setSpeed(1.502);
  L.b = 65.5;
  const s0 = L.x(), slen = Math.round(16*L.beat);
  L.put("portal-ship", s0, 0);
  P.roof(L, s0+3, slen, 5);
  for(let i=0;i<14;i++){
    const x = s0+15 + i*8;
    if(x > s0+3+slen-7) break;
    if(i%2===0){ P.block(L,x,0); P.block(L,x,1); P.spike(L,x,2); }
    else       { P.block(L,x,4); P.block(L,x,3); P.spike(L,x,2,180); }
  }
  L.put("coin", s0+3+Math.round(slen*0.30), 4);
  L.b = 82; L.put("portal-cube", L.x(), 0);

  /* F - ball, four-block tunnel, flips only on contact */
  L.b = 84;
  const b0 = L.x(), blen = Math.round(12*L.beat);
  L.put("portal-ball", b0, 0);
  P.roof(L, b0+4, blen, 4);
  for(let i=0;i<10;i++){
    const x = b0+15 + i*10;
    if(x > b0+4+blen-7) break;
    if(i%2===0){ P.spike(L,x,0); P.spike(L,x+1,0); }
    else       { P.spike(L,x,3,180); P.spike(L,x+1,3,180); }
  }
  L.put("coin", b0+4+Math.round(blen*0.52), 2);
  L.b = 97; L.put("portal-cube", L.x(), 0);

  /* G - ufo */
  L.b = 99;
  const u0 = L.x(), ulen = Math.round(13*L.beat);
  L.put("portal-ufo", u0, 0);
  P.roof(L, u0+3, ulen, 6);
  for(let i=0;i<12;i++){
    const x = u0+14 + i*8;
    if(x > u0+3+ulen-7) break;
    const h = 2 + (i%3===2 ? 1 : 0);
    if(i%2===0){ for(let j=0;j<h;j++) P.block(L,x,j); P.spike(L,x,h); }
    else       { for(let j=0;j<h;j++) P.block(L,x,5-j); P.spike(L,x,5-h,180); }
  }
  L.b = 113; L.put("portal-cube", L.x(), 0);

  /* H - dual: both cubes share one button and both have to survive */
  L.b = 115; L.put("portal-dual", L.x(), 0);
  const d0 = L.x(), dlen = Math.round(13*L.beat);
  P.roof(L, d0+2, dlen, 12);
  for(let k=0;k<8;k++){
    L.b = 116.5 + k*1.5;
    const x = L.x();
    P.spike(L, x, 0);
    P.spike(L, x, 11, 180);
  }
  L.b = 129; L.put("portal-dual", L.x(), 0);

  /* I - mirror, then a dash orb across the whole field */
  L.b = 131;   L.put("portal-mirror", L.x(), 0);
  L.b = 133;   P.spike(L, L.x());
  L.b = 134.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 136.5; P.triple(L, L.x());
  L.b = 138.5; L.put("portal-mirror", L.x(), 0);
  L.b = 140.5;
  const dc = P.orbChain(L, L.x(), ["orb-dash"]);
  for(let i=0;i<14;i++) P.spike(L, Math.round(dc.objs[0].x)+2+i, 0);
  L.b = 146; P.saw(L, L.x(), 1);

  /* J - robot stairs */
  L.b = 148; L.put("portal-robot", L.x(), 0);
  L.b = 150;   P.plat(L, L.x(), 6, 2);
  L.b = 152.5; P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 154.5; P.plat(L, L.x(), 6, 2);
  L.b = 157;   P.triple(L, L.x());
  L.b = 159;   L.put("portal-cube", L.x(), 0);

  /* K - finale, top speed the rest of the way */
  L.b = 161; L.put("speed-fastest", L.x(), 0); L.setSpeed(1.849);
  L.b = 162.5; P.spike(L, L.x());
  L.b = 164;   P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 166;
  const pf = L.x(); L.put("pad-red", pf, 0); P.cleared(L, pf-0.425, 4.5, 6);
  L.b = 169;   P.saw(L, L.x(), 1);
  L.b = 171;   P.triple(L, L.x());
  L.b = 173;   P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 175;   P.plat(L, L.x(), 6, 1);
  L.b = 177.5; P.triple(L, L.x());
  L.b = 180;   P.spike(L, L.x());
  L.b = 182;   P.spike(L, L.x()); P.spike(L, L.x()+1);
  L.b = 184;
  const oc4 = P.orbChain(L, L.x(), ["orb-yellow","orb-red"]);
  for(let i=0;i<12;i++) if(i%4!==3) P.spike(L, Math.round(oc4.objs[0].x)-3+i, 0);
  L.b = 189;   P.spike(L, L.x());
  L.b = 191;   P.triple(L, L.x());
  L.b = 193.5; P.spike(L, L.x()); P.spike(L, L.x()+1);

  L.b = 197;
  L.put("finish", L.x(), 0);
  L.meta.lengthBlocks = L.x();
  return L;
}

/* ---- sanity pass: no run of ground hazards a cube jump cannot cross ------ */
function audit(name, objs){
  const ground = new Set();
  for(const o of objs){
    if(o.y !== 0 || (o.rot||0) !== 0) continue;
    if(o.t === "spike" || o.t === "spike-mini") ground.add(o.x);
    if(o.t === "spike-triple"){ ground.add(o.x); ground.add(o.x+1); ground.add(o.x+2); }
    if(o.t === "saw"){ ground.add(o.x); ground.add(o.x+1); }
  }
  const pads  = objs.filter(o=>o.t.indexOf("pad-")===0).map(o=>o.x);
  const dashes = objs.filter(o=>o.t==="orb-dash").map(o=>o.x);
  const clearedByPad = x => pads.some(p => x >= p && x <= p+9) ||
                            dashes.some(p => x >= p && x <= p+16);
  const xs = [...ground].sort((a,b)=>a-b);
  let run = [], last = -99;
  const flush = ()=>{
    if(run.length > 3 && !clearedByPad(run[0]))
      WARNINGS.push(name+": "+run.length+" adjacent ground hazards at block "+run[0]+
                    " - no cube jump covers more than 3");
    run = [];
  };
  for(const x of xs){
    if(x === last+1) run.push(x);
    else { flush(); run = [x]; }
    last = x;
  }
  flush();
}

/* ------------------------------------------------------------------------- */
function emit(){
  const levels = [level1(), level2(), level3(), level4()];
  const out = levels.map(L=>{
    const seen = new Set(), objs = [];
    for(const o of L.objs.slice().sort((a,b)=>a.x-b.x || a.y-b.y)){
      const k = o.t+"|"+o.x+"|"+o.y+"|"+(o.rot||0);
      if(seen.has(k)) continue;
      seen.add(k); objs.push(o);
    }
    audit(L.meta.name, objs);
    return { meta:L.meta, objects:objs };
  });

  const body = out.map(l=>{
    const objs = l.objects.map(o=>JSON.stringify(o)).join(",\n    ");
    return "{\n  meta: " + JSON.stringify(l.meta, null, 2).replace(/\n/g,"\n  ") +
           ",\n  objects: [\n    " + objs + "\n  ]\n}";
  }).join(",\n");

  fs.writeFileSync(path.join(__dirname,"..","src","14-core-levels.part"),
    "\n/* --------------------------------------------------------------------------\n" +
    "   The three levels, embedded as objects rather than fetched: fetching a JSON\n" +
    "   file fails under file://, and this game has to survive a double click. The\n" +
    "   shape is exactly assets/levels/level-schema.json, so levels still import\n" +
    "   and export cleanly through the editor.\n" +
    "   Generated by tools/genlevels.js - edit there, not here.\n" +
    "   -------------------------------------------------------------------------- */\n" +
    "var LEVEL_SRC = [\n" + body + "\n];\n");

  out.forEach(l=>{
    const secs = l.meta.lengthBlocks/(VXB*l.meta.startSpeed);
    console.log(l.meta.name.padEnd(14),
      String(l.objects.length).padStart(4)+" obj",
      String(l.meta.lengthBlocks).padStart(5)+" blocks",
      "~"+secs.toFixed(0)+"s at start speed");
  });
  WARNINGS.forEach(w=>console.log("  WARN  "+w));
  if(!WARNINGS.length) console.log("  audit clean");
}
emit();
