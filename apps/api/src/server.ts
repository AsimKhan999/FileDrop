import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import app from "./app";
import { initSocket } from "./services/socket.service";
import { startDiscovery, stopDiscovery } from "./services/discovery.service";
import { startCleanupWorker } from "./jobs/cleanup.worker";

const PORT = Number(process.env.PORT) || 5000;

const certDir = path.join(__dirname, "certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");

let server: http.Server;

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  server = https.createServer(httpsOptions, app);
  console.log(`> HTTPS enabled`);
} else {
  server = http.createServer(app);
  console.log(`> HTTPS not available, running HTTP`);
}

initSocket(server);

server.listen(PORT, "0.0.0.0", () => {
  const protocol = fs.existsSync(keyPath) ? "https" : "http";
  console.log(`> FileDrop API running on ${protocol}://0.0.0.0:${PORT}`);
  console.log(`> Environment: ${process.env.NODE_ENV || "development"}`);
  startCleanupWorker();
  startDiscovery();
});

// Graceful shutdown
process.on("SIGINT", () => {
  stopDiscovery();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopDiscovery();
  process.exit(0);
});
