import { useState, useCallback } from "react";
import { uploadFile, UploadResult } from "../services/upload.service";

interface UseUploadReturn {
  upload: (file: File) => Promise<UploadResult | null>;
  progress: number;
  status: "idle" | "uploading" | "completed" | "failed";
  error: string | null;
  reset: () => void;
}

export function useUpload(): UseUploadReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "completed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus("idle");
    setError(null);
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    try {
      setStatus("uploading");
      setProgress(0);
      setError(null);

      const result = await uploadFile(file, setProgress);
      setStatus("completed");
      setProgress(100);
      return result;
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Upload failed");
      return null;
    }
  }, []);

  return { upload, progress, status, error, reset };
}
