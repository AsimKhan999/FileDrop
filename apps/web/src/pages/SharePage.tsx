import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useCountdown } from "../hooks/useCountdown";
import { useSocket } from "../hooks/useSocket";
import Logo from "../components/Logo";
import "./SharePage.css";

interface ShareFile {
  id: string;
  original_name: string;
  size: number;
  mime_type: string;
}

interface ShareData {
  shareId: string;
  token: string;
  files: ShareFile[];
  expiresAt: string;
  downloadCount: number;
  hasPassword: boolean;
}

function formatFileSize(bytes: number): string {
  const num = Number(bytes);
  if (num === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [share, setShare] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function fetchShare() {
      try {
        const response = await api.get(`/shares/${token}`);
        setShare(response.data);
        if (!response.data.hasPassword) {
          setVerified(true);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load share");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchShare();
    }
  }, [token]);

  const handleVerify = async () => {
    if (!password.trim()) return;
    setVerifying(true);
    setPasswordError(null);
    try {
      await api.post(`/shares/${token}/verify`, { password });
      setVerified(true);
    } catch (err: any) {
      setPasswordError(err.message || "Incorrect password");
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = (fileId: string) => {
    const link = document.createElement("a");
    link.href = `/api/shares/${token}/files/${fileId}/download`;
    if (share?.hasPassword) {
      link.href += `?password=${encodeURIComponent(password)}`;
    }
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="share-page">
        <button className="share-back" onClick={() => navigate("/")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> BACK
        </button>
        <div className="share-loading">Loading...</div>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="share-page">
        <button className="share-back" onClick={() => navigate("/")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> BACK
        </button>
        <div className="share-error">
          <Logo className="share-error-logo" />
          <p>{error || "Share not found"}</p>
        </div>
      </div>
    );
  }

  if (share.hasPassword && !verified) {
    return (
      <div className="share-page">
        <button className="share-back" onClick={() => navigate("/")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> BACK
        </button>
        <div className="share-header">
          <h1>
            <Logo />
          </h1>
        </div>
        <div className="share-content">
          <div className="share-title">PASSWORD PROTECTED</div>
          <p className="share-password-text">This share requires a password.</p>
          <input
            type="password"
            className="share-password-input"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
          {passwordError && (
            <p className="share-password-error">{passwordError}</p>
          )}
          <button
            className="share-unlock-btn"
            onClick={handleVerify}
            disabled={verifying || !password.trim()}
          >
            {verifying ? "VERIFYING..." : "UNLOCK"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <SharePageContent
      share={share}
      onDownload={handleDownload}
      password={password}
    />
  );
}

function SharePageContent({
  share,
  onDownload,
  password,
}: {
  share: ShareData;
  onDownload: (fileId: string) => void;
  password: string;
}) {
  const navigate = useNavigate();
  const countdown = useCountdown(share.expiresAt);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadCount, setDownloadCount] = useState(share.downloadCount);

  useSocket({
    shareToken: share.token,
    onDownloadCompleted: (data) => {
      setDownloadCount(data.downloadCount);
    },
    onShareExpired: () => {
      window.location.reload();
    },
  });

  const handleDownloadAll = () => {
    setDownloadingAll(true);
    const link = document.createElement("a");
    link.href = `/api/shares/${share.token}/download-all`;
    if (share.hasPassword) {
      link.href += `?password=${encodeURIComponent(password)}`;
    }
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingAll(false), 2000);
  };

  return (
    <div className="share-page">
      
      <div className="share-header">
        <h1>
          <Logo />
        </h1>
      </div>
      <button className="share-back" onClick={() => navigate("/")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> BACK
      </button>

      <div className="share-content">
        <div className="share-title">INCOMING TRANSFER</div>

        <div className="share-summary">
          <span>
            {share.files.length} FILE{share.files.length !== 1 ? "S" : ""}
          </span>
          <span>
            {formatFileSize(
              share.files.reduce((acc, f) => acc + Number(f.size), 0)
            )}
          </span>
          <span>
            {downloadCount} DOWNLOAD{downloadCount !== 1 ? "S" : ""}
          </span>
        </div>

        <div className="share-files">
          {share.files.map((file) => (
            <div key={file.id} className="share-file">
              <div className="share-file-info">
                <span className="share-file-icon">♦</span>
                <div className="share-file-details">
                  <span className="file-name">{file.original_name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
              </div>
              <button
                className="share-file-download"
                onClick={() => onDownload(file.id)}
              >
                ↓ DOWNLOAD
              </button>
            </div>
          ))}
        </div>

        {share.files.length > 1 && (
          <button
            className="share-download-all"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
          >
            {downloadingAll ? "DOWNLOADING..." : "DOWNLOAD ALL ↓"}
          </button>
        )}

        <div className={`share-expiry ${countdown.expired ? "expired" : ""}`}>
          {countdown.expired
            ? "EXPIRED"
            : `EXPIRES IN: ${countdown.formatted}`}
        </div>
      </div>
    </div>
  );
}
