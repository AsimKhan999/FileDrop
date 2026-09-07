import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import db from "../config/database";
import { storageService } from "./storage.service";
import { generateStoredName, generateChecksum } from "../utils/file.utils";
import { generateShareToken } from "../utils/token.utils";
import { passwordService } from "./password.service";

const DEFAULT_EXPIRATION_MINUTES = parseInt(
  process.env.DEFAULT_EXPIRATION_MINUTES || "60",
  10
);

interface UploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface UploadOptions {
  password?: string;
  expirationMinutes?: number;
}

interface UploadResult {
  shareId: string;
  shareToken: string;
  shareUrl: string;
  expiresAt: Date;
  hasPassword: boolean;
  files: {
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
  }[];
}

export class UploadService {
  async uploadFiles(
    files: UploadFile[],
    options?: UploadOptions
  ): Promise<UploadResult> {
    if (files.length === 0) {
      throw new Error("No files provided");
    }

    // Upload all files to storage and create records
    const fileRecords = [];
    for (const file of files) {
      const storedName = generateStoredName(file.originalname);
      const checksum = generateChecksum(file.buffer);

      await storageService.saveBuffer(storedName, file.buffer);
      const storagePath = storageService.getFilePath(storedName);

      const [fileRecord] = await db("files")
        .insert({
          id: uuidv4(),
          original_name: file.originalname,
          stored_name: storedName,
          storage_path: storagePath,
          mime_type: file.mimetype,
          size: file.size,
          checksum,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");

      fileRecords.push(fileRecord);
    }

    // Create share token
    const token = generateShareToken();
    const expiresAt = new Date();
    const expirationMinutes =
      options?.expirationMinutes || DEFAULT_EXPIRATION_MINUTES;
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    // Hash password if provided
    let passwordHash: string | null = null;
    if (options?.password) {
      passwordHash = await passwordService.hash(options.password);
    }

    // Create share record
    const [shareRecord] = await db("shares")
      .insert({
        id: uuidv4(),
        token,
        password_hash: passwordHash,
        expires_at: expiresAt,
        download_count: 0,
        delete_after_download: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    // Link all files to share
    for (const fileRecord of fileRecords) {
      await db("share_files").insert({
        share_id: shareRecord.id,
        file_id: fileRecord.id,
      });
    }

    const baseUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const shareUrl = `${baseUrl}/share/${token}`;

    return {
      shareId: shareRecord.id,
      shareToken: token,
      shareUrl,
      expiresAt: shareRecord.expires_at,
      hasPassword: !!passwordHash,
      files: fileRecords.map((f) => ({
        id: f.id,
        originalName: f.original_name,
        size: f.size,
        mimeType: f.mime_type,
      })),
    };
  }
}

export const uploadService = new UploadService();
