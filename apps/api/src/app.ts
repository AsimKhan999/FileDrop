import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { healthRouter } from "./routes/health";
import { uploadRouter } from "./routes/upload.routes";
import { shareRouter } from "./routes/share.routes";
import { qrRouter } from "./routes/qr.routes";
import { discoveryRouter } from "./routes/discovery.routes";

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      /^http:\/\/192\.168\.\d+\.\d+/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Rate limiting - skip OPTIONS preflight and static assets
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.method === "OPTIONS" || !req.path.startsWith("/api"),
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: (req) => req.method === "OPTIONS",
  message: {
    success: false,
    error: {
      code: "UPLOAD_RATE_LIMIT",
      message: "Too many uploads, please wait before trying again.",
    },
  },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 downloads per minute
  message: {
    success: false,
    error: {
      code: "DOWNLOAD_RATE_LIMIT",
      message: "Too many downloads, please wait before trying again.",
    },
  },
});

app.use(limiter);
app.use(morgan("dev"));
app.use(express.json());

// API routes with specific rate limits
app.use("/api", healthRouter);
app.options("/api/uploads", cors());
app.use("/api/uploads", uploadLimiter, uploadRouter);
app.use("/api/shares", shareRouter);
app.use("/api", qrRouter);
app.use("/api", discoveryRouter);

// Apply download limiter to share download routes
app.use("/api/shares/:token/files/:fileId/download", downloadLimiter);
app.use("/api/shares/:token/download-all", downloadLimiter);

// Serve frontend build
const webDistPath = path.resolve(__dirname, "../../web/dist");
// Do not cache index.html so updates are always picked up
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith("/share") || !req.path.includes(".")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
app.use(express.static(webDistPath, {
  etag: false,
  setHeaders: (res, path) => {
    if (path.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  },
}));

// SPA fallback - serve index.html for non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(webDistPath, "index.html"));
  }
});

// Input validation middleware
app.use((req, res, next) => {
  // Prevent path traversal in URL params
  const suspicious = /(\.\.|%2e%2e|%252e)/i;
  if (suspicious.test(req.url) || suspicious.test(decodeURIComponent(req.url))) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PATH",
        message: "Invalid path detected.",
      },
    });
  }
  next();
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
);

export default app;
