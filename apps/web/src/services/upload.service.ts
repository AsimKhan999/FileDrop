import api from "./api";

export interface UploadResult {
  fileId: string;
  shareId: string;
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
  file: {
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
  };
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<UploadResult>("/uploads", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(progress);
      }
    },
  });

  return response.data;
}
