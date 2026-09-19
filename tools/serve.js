/* Minimal static server for local testing: node tools/serve.js <dir> <port> [outDir]
   Also accepts POST /save?name=<file>, writing a data: URL body into
   <dir>/../portfolio/. That is how rendered canvases (gameplay captures and
   the poster) get out of the browser and onto disk as real PNG files. */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(process.argv[2] || ".");
const port = parseInt(process.argv[3] || "8123", 10);
const outDir = path.resolve(process.argv[4] || path.join(root, "..", "portfolio"));
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json",
                ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg",
                ".mp3":"audio/mpeg", ".wav":"audio/wav", ".css":"text/css" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let p = decodeURIComponent(url.pathname);

  if(req.method === "POST" && p === "/save"){
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const name = path.basename(url.searchParams.get("name") || "out.png");
        const b64 = body.replace(/^data:image\/\w+;base64,/, "");
        fs.mkdirSync(outDir, { recursive: true });
        const file = path.join(outDir, name);
        fs.writeFileSync(file, Buffer.from(b64, "base64"));
        console.log("saved " + name + "  " + (b64.length/1365).toFixed(0) + " KB");
        res.writeHead(200, {"content-type":"text/plain"}).end("ok " + file);
      } catch(e){
        console.log("save failed: " + e.message);
        res.writeHead(500, {"content-type":"text/plain"}).end(e.message);
      }
    });
    return;
  }

  if(p === "/") p = "/index.html";
  const file = path.join(root, p);
  if(!file.startsWith(root)){ res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if(err){ res.writeHead(404, {"content-type":"text/plain"}).end("not found: " + p); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
                         "cache-control": "no-store" });
    res.end(buf);
  });
}).listen(port, "127.0.0.1", () => {
  console.log("serving " + root + " on http://127.0.0.1:" + port);
  console.log("captures -> " + outDir);
});
