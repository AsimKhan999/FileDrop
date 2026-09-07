import fs from "fs";
import path from "path";
import db from "../config/database";
import { storageService } from "./storage.service";

export class CleanupService {
  async cleanupExpiredShares(): Promise<number> {
    const now = new Date();

    // Find expired shares
    const expiredShares = await db("shares")
      .whereNotNull("expires_at")
      .where("expires_at", "<", now)
      .select("id");

    if (expiredShares.length === 0) {
      return 0;
    }

    const expiredIds = expiredShares.map((s) => s.id);

    // Find files associated with expired shares
    const shareFiles = await db("share_files")
      .whereIn("share_id", expiredIds)
      .select("file_id");

    const fileIds = shareFiles.map((sf) => sf.file_id);

    // Get file records to delete physical files
    if (fileIds.length > 0) {
      const files = await db("files")
        .whereIn("id", fileIds)
        .select("stored_name");

      // Delete physical files
      for (const file of files) {
        try {
          await storageService.deleteFile(file.stored_name);
        } catch (err) {
          console.error(`Failed to delete file ${file.stored_name}:`, err);
        }
      }

      // Delete file records
      await db("files").whereIn("id", fileIds).del();
    }

    // Delete share_files records
    await db("share_files").whereIn("share_id", expiredIds).del();

    // Delete download records
    await db("downloads").whereIn("share_id", expiredIds).del();

    // Delete share records
    await db("shares").whereIn("id", expiredIds).del();

    console.log(`> Cleanup: Removed ${expiredShares.length} expired shares`);
    return expiredShares.length;
  }

  async cleanupOrphanedFiles(): Promise<number> {
    const uploadsDir = path.resolve(
      process.env.STORAGE_PATH || "./storage/uploads"
    );

    if (!fs.existsSync(uploadsDir)) {
      return 0;
    }

    // Get all files in storage
    const storageFiles = fs.readdirSync(uploadsDir);

    // Get all stored names in database
    const dbFiles = await db("files").select("stored_name");
    const dbFileNames = new Set(dbFiles.map((f) => f.stored_name));

    // Find orphaned files
    let deletedCount = 0;
    for (const fileName of storageFiles) {
      if (!dbFileNames.has(fileName)) {
        try {
          fs.unlinkSync(path.join(uploadsDir, fileName));
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete orphaned file ${fileName}:`, err);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`> Cleanup: Removed ${deletedCount} orphaned files`);
    }

    return deletedCount;
  }
}

export const cleanupService = new CleanupService();
