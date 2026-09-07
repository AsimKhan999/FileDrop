export const FILE_DROP_CONSTANTS = {
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
  DEFAULT_EXPIRATION_MINUTES: 60,
  SHARE_TOKEN_LENGTH: 8,
  ALLOWED_EXPIRATION_OPTIONS: [10, 30, 60, 360, 1440, 4320, 10080], // minutes
} as const;

export const UPLOAD_STATUS = {
  QUEUED: "queued",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const SHARE_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  DELETED: "deleted",
  LOCKED: "locked",
  DOWNLOAD_LIMIT_REACHED: "download_limit_reached",
} as const;
