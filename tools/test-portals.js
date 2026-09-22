const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const mod = { exports: {} };
new Function('module', html.slice(html.indexOf('/*==CORE_START==*/'), html.indexOf('/*==CORE_END==*/')))(mod);
const C = mod.exports;
let checks = 0;
// Cross each mandatory gate from above, below and through its visible artwork.
for (const [gate, def] of Object.entries(C.OBJ).filter(([, d]) => d.mode || d.grav !== undefined)) {
  for (const mode of Object.keys(C.MODES)) for (const mini of [false, true]) {
    for (const grav of [-1, 1]) for (const height of [0.5, 6, 11.5]) {
      const level = C.parseLevel({ meta: { startMode: mode, lengthBlocks: 40 }, objects: [{ t: gate, x: 10, y: 0 }] });
      const sim = C.createSim(level), e = sim.ents[0];
      e.mini = mini; e.grav = grav; e.onGround = false;
      e.x = 9 * C.PHYS.UNIT; e.y = height * C.PHYS.UNIT;
      for (let i = 0; i < 240 && e.x < 11.5 * C.PHYS.UNIT; i++) {
        C.simInput(sim, false); C.stepSim(sim, C.PHYS.TIMESTEP);
      }
      assert.equal(sim.dead, false);
      assert.equal(sim.used[0], 1, `${mode} must activate ${gate} at height ${height}`);
      if (def.mode) assert.equal(e.mode, def.mode);
      if (def.grav !== undefined) assert.equal(e.grav, def.grav);
      checks++;
    }
  }
}
console.log(`PASS ${checks} mandatory portal crossings`);
