import cron from "node-cron";
import { cleanupService } from "../services/cleanup.service";

const CLEANUP_INTERVAL = "*/1 * * * *"; // Every minute

let isRunning = false;

export function startCleanupWorker(): void {
  cron.schedule(CLEANUP_INTERVAL, async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await cleanupService.cleanupExpiredShares();
      await cleanupService.cleanupOrphanedFiles();
    } catch (error) {
      console.error("Cleanup worker error:", error);
    } finally {
      isRunning = false;
    }
  });

  console.log("> Cleanup worker started (runs every minute)");
}
