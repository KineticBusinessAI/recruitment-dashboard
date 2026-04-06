const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DEFAULT_FILE = "HC_Command_v2_BPO_Headcount_Tracker.html";
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER;
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS;

if (!BASIC_AUTH_USER || !BASIC_AUTH_PASS) {
  console.error("Missing BASIC_AUTH_USER or BASIC_AUTH_PASS environment variables.");
  process.exit(1);
}

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function isAuthorized(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.slice("Basic ".length);
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const separatorIndex = credentials.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const username = credentials.slice(0, separatorIndex);
  const password = credentials.slice(separatorIndex + 1);

  return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS;
}

function resolveRequestPath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const relativePath = decodedPath === "/" ? DEFAULT_FILE : decodedPath.replace(/^\/+/, "");
  const normalizedPath = path.normalize(relativePath);
  const absolutePath = path.resolve(ROOT_DIR, normalizedPath);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/healthz") {
    send(res, 200, "ok", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (!isAuthorized(req)) {
    send(res, 401, "Authentication required", {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="Recruitment Dashboard"'
    });
    return;
  }

  const filePath = resolveRequestPath(requestUrl.pathname);
  if (!filePath) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Length": stats.size,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff"
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        send(res, 500, "Internal server error", {
          "Content-Type": "text/plain; charset=utf-8"
        });
        return;
      }

      res.destroy();
    });
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Recruitment dashboard listening on http://${HOST}:${PORT}`);
});
