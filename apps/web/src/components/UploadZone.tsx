import { useState, useCallback, useRef } from "react";
import "./UploadZone.css";

interface UploadFileItem {
  file: File;
  id: string;
}

interface UploadZoneProps {
  onUploadComplete?: (result: {
    shareToken: string;
    shareUrl: string;
    expiresAt: string;
    hasPassword: boolean;
    files: { originalName: string; size: number }[];
  }) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<UploadFileItem[]>([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleUpload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedFiles.length === 0) return;

    try {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      const formData = new FormData();
      for (const item of selectedFiles) {
        formData.append("files", item.file);
      }
      if (password.trim()) {
        formData.append("password", password);
      }

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setIsUploading(false);
      setProgress(100);
      onUploadComplete?.({
        shareToken: result.data.shareToken,
        shareUrl: result.data.shareUrl,
        expiresAt: result.data.expiresAt,
        hasPassword: result.data.hasPassword,
        files: result.data.files,
      });
    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [selectedFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleAddMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleZoneClick = () => {
    if (selectedFiles.length === 0) {
      fileInputRef.current?.click();
    }
  };

  const hasFiles = selectedFiles.length > 0;
  const totalSize = selectedFiles.reduce((acc, item) => acc + item.file.size, 0);

  return (
    <div className="upload-zone-container">
      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        multiple
        onChange={handleFileSelect}
      />

      <div
        className={`upload-zone ${isDragOver ? "drag-over" : ""} ${isUploading ? "uploading" : ""} ${hasFiles ? "has-files" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
      >
        {isUploading ? (
          <div className="upload-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="progress-text">Uploading...</p>
          </div>
        ) : hasFiles ? (
          <div className="upload-files-view">
            <div className="upload-files-header">
              <div className="upload-files-count">
                <span className="files-count">{selectedFiles.length}</span>
                <span className="files-label">
                  {selectedFiles.length === 1 ? "FILE" : "FILES"} SELECTED
                </span>
              </div>
              <span className="files-total-size">
                {formatSize(totalSize)}
              </span>
            </div>

            <div className="upload-files-list">
              {selectedFiles.map((item) => (
                <div key={item.id} className="upload-file-row">
                  <span className="upload-file-icon">♦</span>
                  <span className="upload-file-name">{item.file.name}</span>
                  <span className="upload-file-size">
                    {formatSize(item.file.size)}
                  </span>
                  <button
                    className="upload-file-remove"
                    onClick={(e) => removeFile(e, item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="upload-password">
              <button
                className="upload-password-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPassword(!showPassword);
                }}
              >
                {showPassword ? "HIDE" : "SET"} PASSWORD
              </button>
              {showPassword && (
                <div className="upload-password-field">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    className="upload-password-input"
                    placeholder="Enter password (optional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="upload-password-eye"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPasswordVisible(!passwordVisible);
                    }}
                  >
                    {passwordVisible ? "◉" : "○"}
                  </button>
                </div>
              )}
            </div>

            <div className="upload-files-actions">
              <button className="upload-add-more" onClick={handleAddMore}>
                + ADD MORE
              </button>
              <button className="upload-submit" onClick={handleUpload}>
                UPLOAD ALL
              </button>
            </div>
          </div>
        ) : (
          <div className="upload-empty-view">
            <div className="upload-icon">↑</div>
            <p className="upload-text">Drop files here</p>
            <p className="upload-subtext">or</p>
            <button className="upload-button" onClick={handleAddMore}>
              Select Files
            </button>
          </div>
        )}

        {error && <p className="upload-error">{error}</p>}
      </div>
    </div>
  );
}
