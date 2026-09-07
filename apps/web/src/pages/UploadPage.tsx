import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadZone from "../components/UploadZone";
import ShareResult from "../components/ShareResult";
import Logo from "../components/Logo";
import "./UploadPage.css";

interface UploadResult {
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
  hasPassword: boolean;
  files: { originalName: string; size: number }[];
}

function UploadPage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const navigate = useNavigate();

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
  };

  const handleReset = () => {
    setUploadResult(null);
  };

  return (
    <div className="upload-page">
      
      <div className="upload-header">
        <h1>
          <Logo />
        </h1>
        <p>Upload Files</p>
      </div>
      <button className="upload-back" onClick={() => navigate("/")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> BACK
      </button>

      <div className="upload-content">
        {uploadResult ? (
          <div className="result-container">
            <ShareResult
              shareUrl={uploadResult.shareUrl}
              shareToken={uploadResult.shareToken}
              fileNames={uploadResult.files.map((f) => f.originalName)}
              expiresAt={uploadResult.expiresAt}
            />
            <button className="reset-btn" onClick={handleReset}>
              Upload Another File
            </button>
          </div>
        ) : (
          <UploadZone onUploadComplete={handleUploadComplete} />
        )}
      </div>
    </div>
  );
}

export default UploadPage;
