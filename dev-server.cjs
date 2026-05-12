const http = require("http");
const fs = require("fs");
const path = require("path");

const port = 8010;
const root = process.cwd();
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".csv": "text/csv"
};

http.createServer((req, res) => {
  const target = req.url === "/" ? "index.html" : decodeURIComponent(req.url.slice(1));
  const filePath = path.resolve(root, target);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, body) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(body);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Project 3 preview: http://127.0.0.1:${port}/`);
});
