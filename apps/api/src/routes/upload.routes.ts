import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { uploadController } from "../controllers/upload.controller";

const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
  // Documents
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/html", "text/css", "text/javascript",
  // Archives
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/gzip", "application/x-tar",
  // Audio
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac",
  // Video
  "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo",
  // Code
  "application/json", "application/xml", "application/javascript",
  // Other
  "application/octet-stream",
];

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "2147483648", 10), // 2GB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed.`));
    }
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.array("files", 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            error: {
              code: "FILE_TOO_LARGE",
              message: "File size exceeds the limit.",
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: "UPLOAD_ERROR",
            message: err.message,
          },
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: err.message || "Invalid file type.",
          },
        });
      }
      next();
    });
  },
  (req, res) => uploadController.upload(req, res)
);
