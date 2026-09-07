import { useState, useEffect } from "react";
import api from "../services/api";
import "./QRModal.css";

interface QRModalProps {
  token: string;
  onClose: () => void;
}

export default function QRModal({ token, onClose }: QRModalProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQR() {
      try {
        const response = await api.get(`/qr/${token}`);
        setQr(response.data.qr);
      } catch (err: any) {
        setError(err.message || "Failed to load QR code");
      } finally {
        setLoading(false);
      }
    }
    fetchQR();
  }, [token]);

  const handleDownload = () => {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr;
    link.download = `filedrop-${token}.png`;
    link.click();
  };

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <button className="qr-close" onClick={onClose}>
          x
        </button>

        <div className="qr-header">
          <span className="qr-label">SCAN TO OPEN</span>
        </div>

        <div className="qr-body">
          {loading ? (
            <div className="qr-loading">Generating QR...</div>
          ) : error ? (
            <div className="qr-error">{error}</div>
          ) : qr ? (
            <img src={qr} alt="QR Code" className="qr-image" />
          ) : null}
        </div>

        <div className="qr-footer">
          <span className="qr-token">TOKEN: {token}</span>
        </div>
      </div>
    </div>
  );
}
