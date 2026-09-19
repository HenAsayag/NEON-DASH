/* Prints the objects around a block position, to diagnose a solver stall.
   Usage: node tools/at.js <levelIndex> <block> [span]                       */
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname,"..","index.html"), "utf8");
const core = html.slice(html.indexOf("/*==CORE_START==*/"), html.indexOf("/*==CORE_END==*/"));
const mod = { exports:{} };
new Function("module","console",core)(mod, console);

const li = parseInt(process.argv[2]||"0",10);
const at = parseFloat(process.argv[3]||"0");
const span = parseFloat(process.argv[4]||"14");
const L = mod.exports.LEVEL_SRC[li];

console.log(L.meta.name, "- objects from block", (at-span).toFixed(0), "to", (at+span).toFixed(0));
const rows = {};
for(const o of L.objects){
  const d = mod.exports.OBJ[o.t];
  if(o.x+ (d?d.w:1) < at-span || o.x > at+span) continue;
  (rows[o.x] = rows[o.x] || []).push(o.t + "@y" + o.y + (o.rot?("r"+o.rot):""));
}
Object.keys(rows).map(Number).sort((a,b)=>a-b).forEach(x=>{
  console.log(String(x).padStart(5), rows[x].join("  "));
});
