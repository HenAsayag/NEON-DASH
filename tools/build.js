/* Concatenates src/*.part (lexicographic order) into the shipped index.html. */
const fs = require("fs"), path = require("path");
const src  = path.join(__dirname, "..", "src");
const dest = process.argv[2] || path.join(__dirname, "..", "..", "index.html");

const parts = fs.readdirSync(src).filter(f=>f.endsWith(".part")).sort();
const out = parts.map(f=>fs.readFileSync(path.join(src,f),"utf8")).join("");
fs.writeFileSync(dest, out);
console.log("built", dest, (out.length/1024).toFixed(1)+" KB from", parts.length, "parts");
