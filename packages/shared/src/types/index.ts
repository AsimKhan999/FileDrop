export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileRecord {
  id: string;
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  checksum?: string;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Share {
  id: string;
  token: string;
  ownerId?: string;
  passwordHash?: string;
  expiresAt?: Date;
  maxDownloads?: number;
  downloadCount: number;
  deleteAfterDownload: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShareWithFiles extends Share {
  files: FileRecord[];
}

export interface Download {
  id: string;
  shareId: string;
  fileId: string;
  createdAt: Date;
  completedAt?: Date;
  status: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  uploadSpeed: number;
  remainingTime: number;
  status: string;
}
