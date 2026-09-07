import { useState, useRef } from "react";
import QRModal from "./QRModal";
import { useCountdown } from "../hooks/useCountdown";
import "./ShareResult.css";

interface ShareResultProps {
  shareUrl: string;
  shareToken: string;
  fileNames: string[];
  expiresAt: string;
}

export default function ShareResult({
  shareUrl,
  shareToken,
  fileNames,
  expiresAt,
}: ShareResultProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useCountdown(expiresAt);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const displayNames =
    fileNames.length === 1
      ? fileNames[0]
      : `${fileNames.length} files`;

  return (
    <>
      <div className="share-result">
        <div className="share-header">
          <span className="share-status">TRANSFER COMPLETE</span>
          <span className="share-status">SHARE CREATED</span>
        </div>

        <div className="share-info">
          <p className="share-token-label">TOKEN: {shareToken}</p>
          <p className="share-file-name">{displayNames}</p>
        </div>

        <div className="share-url-box">
          <code>{shareUrl}</code>
        </div>

        <div className="share-actions">
          <button
            className={`share-btn copy-btn ${copied ? "copied" : ""}`}
            onClick={handleCopyLink}
          >
            {copied ? "COPIED ✓" : "COPY LINK"}
          </button>
          <button className="share-btn qr-btn" onClick={() => setShowQR(true)}>
            SHOW QR
          </button>
        </div>

        <p className={`share-expiry ${countdown.expired ? "expired" : ""}`}>
          {countdown.expired
            ? "EXPIRED"
            : `EXPIRES IN: ${countdown.formatted}`}
        </p>
      </div>

      {showQR && (
        <QRModal token={shareToken} onClose={() => setShowQR(false)} />
      )}
    </>
  );
}
