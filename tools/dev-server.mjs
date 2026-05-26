import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const normalizedPath = path.normalize(decodeURIComponent(url.pathname));
    const relativePath =
      normalizedPath === "/" || normalizedPath === "\\" ? "index.html" : normalizedPath.replace(/^[/\\]+/, "");
    const targetPath = path.resolve(root, relativePath);

    if (!targetPath.startsWith(root)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const body = await readFile(targetPath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(targetPath)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Int Web running at http://${host}:${port}`);
});
