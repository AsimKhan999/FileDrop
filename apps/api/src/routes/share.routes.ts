import { Router, Request, Response } from "express";
import db from "../config/database";
import fs from "fs";
import JSZip from "jszip";
import { passwordService } from "../services/password.service";
import { storageService } from "../services/storage.service";
import { emitDownloadStarted, emitDownloadCompleted } from "../services/socket.service";

export const shareRouter = Router();

shareRouter.get("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const share = await db("shares").where({ token }).first();

    if (!share) {
      res.status(404).json({
        success: false,
        error: {
          code: "SHARE_NOT_FOUND",
          message: "This share link is invalid.",
        },
      });
      return;
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({
        success: false,
        error: {
          code: "SHARE_EXPIRED",
          message: "This share link has expired.",
        },
      });
      return;
    }

    const files = await db("files")
      .join("share_files", "files.id", "share_files.file_id")
      .where("share_files.share_id", share.id)
      .select(
        "files.id",
        "files.original_name",
        "files.size",
        "files.mime_type"
      );

    res.json({
      success: true,
      data: {
        shareId: share.id,
        token: share.token,
        files,
        expiresAt: share.expires_at,
        downloadCount: share.download_count,
        hasPassword: !!share.password_hash,
      },
    });
  } catch (error) {
    console.error("Get share error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve share information.",
      },
    });
  }
});

shareRouter.post("/:token/verify", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const share = await db("shares").where({ token }).first();

    if (!share) {
      res.status(404).json({
        success: false,
        error: {
          code: "SHARE_NOT_FOUND",
          message: "This share link is invalid.",
        },
      });
      return;
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({
        success: false,
        error: {
          code: "SHARE_EXPIRED",
          message: "This share link has expired.",
        },
      });
      return;
    }

    if (!share.password_hash) {
      res.json({ success: true, data: { verified: true } });
      return;
    }

    if (!password) {
      res.status(401).json({
        success: false,
        error: {
          code: "PASSWORD_REQUIRED",
          message: "This share is password protected.",
        },
      });
      return;
    }

    const valid = await passwordService.verify(password, share.password_hash);

    if (!valid) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_PASSWORD",
          message: "Incorrect password.",
        },
      });
      return;
    }

    res.json({ success: true, data: { verified: true } });
  } catch (error) {
    console.error("Verify share error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to verify share.",
      },
    });
  }
});

shareRouter.get(
  "/:token/files/:fileId/download",
  async (req: Request, res: Response) => {
    try {
      const { token, fileId } = req.params;

      const share = await db("shares").where({ token }).first();

      if (!share) {
        res.status(404).json({
          success: false,
          error: {
            code: "SHARE_NOT_FOUND",
            message: "This share link is invalid.",
          },
        });
        return;
      }

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        res.status(410).json({
          success: false,
          error: {
            code: "SHARE_EXPIRED",
            message: "This share link has expired.",
          },
        });
        return;
      }

      if (share.password_hash) {
        const password = (req.headers["x-share-password"] as string) || (req.query.password as string);
        if (!password) {
          res.status(401).json({
            success: false,
            error: {
              code: "PASSWORD_REQUIRED",
              message: "This share is password protected.",
            },
          });
          return;
        }
        const valid = await passwordService.verify(password, share.password_hash);
        if (!valid) {
          res.status(401).json({
            success: false,
            error: {
              code: "INVALID_PASSWORD",
              message: "Incorrect password.",
            },
          });
          return;
        }
      }

      const shareFile = await db("share_files")
        .where({ share_id: share.id, file_id: fileId })
        .first();

      if (!shareFile) {
        res.status(404).json({
          success: false,
          error: {
            code: "FILE_NOT_FOUND",
            message: "File not found in this share.",
          },
        });
        return;
      }

      const file = await db("files").where({ id: fileId }).first();

      if (!file) {
        res.status(404).json({
          success: false,
          error: {
            code: "FILE_NOT_FOUND",
            message: "File not found.",
          },
        });
        return;
      }

      const filePath = storageService.getFilePath(file.stored_name);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({
          success: false,
          error: {
            code: "FILE_MISSING",
            message: "File is no longer available.",
          },
        });
        return;
      }

      await db("shares")
        .where({ id: share.id })
        .increment("download_count", 1);

      await db("downloads").insert({
        share_id: share.id,
        file_id: file.id,
        status: "completed",
        completed_at: new Date(),
      });

      const safeName = file.original_name.replace(/[^a-zA-Z0-9._-]/g, "_");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
      );
      res.setHeader("Content-Type", file.mime_type);
      res.setHeader("Content-Transfer-Encoding", "binary");

      emitDownloadStarted(token, { fileId: file.id, fileName: file.original_name });

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      const updatedShare = await db("shares").where({ id: share.id }).first();
      emitDownloadCompleted(token, {
        fileId: file.id,
        fileName: file.original_name,
        downloadCount: updatedShare?.download_count || 0,
      });
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "DOWNLOAD_FAILED",
          message: "Failed to download file.",
        },
      });
    }
  }
);

shareRouter.get(
  "/:token/download-all",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const share = await db("shares").where({ token }).first();

      if (!share) {
        res.status(404).json({
          success: false,
          error: {
            code: "SHARE_NOT_FOUND",
            message: "This share link is invalid.",
          },
        });
        return;
      }

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        res.status(410).json({
          success: false,
          error: {
            code: "SHARE_EXPIRED",
            message: "This share link has expired.",
          },
        });
        return;
      }

      // Password check
      if (share.password_hash) {
        const password = req.query.password as string;
        if (!password) {
          res.status(401).json({
            success: false,
            error: {
              code: "PASSWORD_REQUIRED",
              message: "This share is password protected.",
            },
          });
          return;
        }
        const valid = await passwordService.verify(
          password,
          share.password_hash
        );
        if (!valid) {
          res.status(401).json({
            success: false,
            error: {
              code: "INVALID_PASSWORD",
              message: "Incorrect password.",
            },
          });
          return;
        }
      }

      // Get all files
      const files = await db("files")
        .join("share_files", "files.id", "share_files.file_id")
        .where("share_files.share_id", share.id)
        .select("files.*");

      if (files.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: "NO_FILES",
            message: "No files in this share.",
          },
        });
        return;
      }

      // If single file, download directly
      if (files.length === 1) {
        const file = files[0];
        const filePath = storageService.getFilePath(file.stored_name);
        if (!fs.existsSync(filePath)) {
          res.status(404).json({
            success: false,
            error: {
              code: "FILE_MISSING",
              message: "File is no longer available.",
            },
          });
          return;
        }

        await db("shares")
          .where({ id: share.id })
          .increment("download_count", 1);

        const safeName = file.original_name.replace(/[^a-zA-Z0-9._-]/g, "_");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
        );
        res.setHeader("Content-Type", file.mime_type);
        res.setHeader("Content-Transfer-Encoding", "binary");

        const fileStream = fs.createReadStream(filePath);
        fileStream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: { code: "STREAM_FAILED", message: "Failed to stream file." } });
          }
        });
        fileStream.pipe(res);
        return;
      }

      // For multiple files, create a zip
      const zip = new JSZip();

      for (const file of files) {
        const filePath = storageService.getFilePath(file.stored_name);
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          zip.file(file.original_name, buffer);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="filedrop-download.zip"`
      );
      res.send(zipBuffer);

      await db("shares")
        .where({ id: share.id })
        .increment("download_count", 1);
    } catch (error) {
      console.error("Download all error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "DOWNLOAD_FAILED",
          message: "Failed to download files.",
        },
      });
    }
  }
);
