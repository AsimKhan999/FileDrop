import { Request, Response } from "express";
import { uploadService } from "../services/upload.service";
import { emitUploadCompleted, emitUploadFailed } from "../services/socket.service";

export class UploadController {
  async upload(req: Request, res: Response): Promise<void> {
    try {
      console.log(`> Upload request from: ${req.headers.origin || "unknown"}`);
      console.log(`> Files received: ${req.files?.length || 0}`);

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_FILES",
            message: "No files were uploaded.",
          },
        });
        return;
      }

      const password = req.body.password || undefined;
      const expirationMinutes = req.body.expirationMinutes
        ? parseInt(req.body.expirationMinutes, 10)
        : undefined;

      const results = await uploadService.uploadFiles(
        files.map((f) => ({
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          buffer: f.buffer,
        })),
        { password, expirationMinutes }
      );

      emitUploadCompleted(results.shareToken, {
        shareId: results.shareId,
        token: results.shareToken,
        files: results.files.map((f) => ({ id: f.id, name: f.originalName })),
      });

      res.status(201).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Upload error:", error);
      const token = req.body.shareToken;
      if (token) {
        emitUploadFailed(token, {
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
      res.status(500).json({
        success: false,
        error: {
          code: "UPLOAD_FAILED",
          message: "Failed to upload files.",
        },
      });
    }
  }
}

export const uploadController = new UploadController();
