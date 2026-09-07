import { useState, useEffect, useRef, useCallback } from "react";
import JSZip from "jszip";
import Logo from "../components/Logo";
import { useWebRTC } from "../hooks/useWebRTC";
import "./P2PTransfer.css";

interface P2PTransferProps {
  onBack: () => void;
}

type Mode = "select" | "sender" | "receiver";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export default function P2PTransfer({ onBack }: P2PTransferProps) {
  const [mode, setMode] = useState<Mode>("select");
  const [files, setFiles] = useState<File[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [bytesSent, setBytesSent] = useState(0);
  const speedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    connected,
    roomCode,
    progress,
    status,
    error,
    createRoom,
    joinRoom,
    sendFiles,
    leaveRoom,
    receivedFiles,
    clearReceivedFiles,
    resetProgress,
  } = useWebRTC();

  useEffect(() => {
    return () => {
      leaveRoom();
      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);
    };
  }, []);

  // Speed calculation
  useEffect(() => {
    if (sending && progress > 0 && progress < 100) {
      if (!startTime) setStartTime(Date.now());
      const totalSize = files.reduce((a, f) => a + f.size, 0);
      const currentBytes = Math.round((progress / 100) * totalSize);
      setBytesSent(currentBytes);

      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);
      speedIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - (startTime || Date.now())) / 1000;
        if (elapsed > 0) {
          setSpeed(currentBytes / elapsed);
        }
      }, 500);
    } else {
      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);
      if (progress === 100) setSpeed(0);
    }
  }, [sending, progress, startTime, files]);

  const addFiles = useCallback((newFiles: File[]) => {
    setFileError(null);
    const oversized = newFiles.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError(`"${oversized.name}" exceeds 2GB limit`);
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleCreateRoom = () => {
    createRoom();
    setMode("sender");
  };

  const handleJoinRoom = () => {
    if (joinCode.trim().length === 6) {
      joinRoom(joinCode.trim().toUpperCase());
      setMode("receiver");
    }
  };

  const handleSendFiles = async () => {
    if (files.length > 0) {
      setSending(true);
      setStartTime(null);
      setSpeed(0);
      await sendFiles(files);
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    if (mode !== "select") {
      leaveRoom();
      setMode("select");
      setFiles([]);
      setJoinCode("");
      setSending(false);
      setFileError(null);
      setSpeed(0);
      setStartTime(null);
      clearReceivedFiles();
    } else {
      onBack();
    }
  };

  const handleRetry = () => {
    leaveRoom();
    setMode("select");
    setFiles([]);
    setFileError(null);
    setSending(false);
    setSpeed(0);
    setStartTime(null);
  };

  const handleSendAnother = () => {
    setFiles([]);
    setSending(false);
    setSpeed(0);
    setStartTime(null);
    resetProgress();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (mode !== "sender" || !connected) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) addFiles(pastedFiles);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [mode, connected, addFiles]);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="p2p-page">
      <div className="p2p-header">
        <h1>
          <Logo />
        </h1>
        <p>LAN Transfer</p>
      </div>
      <button className="p2p-back" onClick={handleBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> BACK
      </button>

      <div className="p2p-content">
        {error && (
          <div className="p2p-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>{error}</span>
            <button className="p2p-retry-btn" onClick={handleRetry}>TRY AGAIN</button>
          </div>
        )}

        {mode === "select" && !error && (
          <>
            <div className="p2p-section-title">WIRELESS TRANSFER</div>
            <p className="p2p-description">
              Transfer files directly between devices on the same network.
              No cloud. No account. Just browser-to-browser.
            </p>

            <button className="p2p-mode-btn" onClick={handleCreateRoom}>
              <span className="p2p-mode-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </span>
              <span className="p2p-mode-label">SEND FILES</span>
              <span className="p2p-mode-hint">Generate a code for the receiver</span>
            </button>

            <div className="p2p-divider">OR</div>

            <div className="p2p-join-section">
              <div className="p2p-section-title">ENTER CODE</div>
              <div className="p2p-join">
                <input
                  type="text"
                  className="p2p-join-input"
                  placeholder="6-digit code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                  maxLength={6}
                />
                <button
                  className="p2p-join-btn"
                  onClick={handleJoinRoom}
                  disabled={joinCode.trim().length !== 6}
                >
                  JOIN
                </button>
              </div>
              {joinCode.length > 0 && joinCode.length !== 6 && (
                <p className="p2p-code-error">Code must be exactly 6 characters</p>
              )}
            </div>
          </>
        )}

        {mode === "sender" && (
          <>
            <div className="p2p-section-title">YOUR CODE</div>
            {roomCode && (
              <div className="p2p-room-code">
                <span className="p2p-code">{roomCode}</span>
                <button className="p2p-copy-btn" onClick={handleCopyCode}>
                  {copied ? "COPIED!" : "COPY"}
                </button>
              </div>
            )}
            <p className="p2p-hint">
              Share this code with the receiver. They can enter it on their device.
            </p>

            <div className="p2p-status">{status}</div>

            {!connected && !error && (
              <div className="p2p-waiting">
                <div className="p2p-spinner"></div>
                <p>Waiting for receiver to join...</p>
              </div>
            )}

            {connected && !sending && progress === 0 && (
              <>
                <div className="p2p-section-title">SELECT FILES</div>
                <div
                  className={`p2p-file-input ${dragOver ? "p2p-drag-over" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    id="p2p-file-input"
                    ref={fileInputRef}
                  />
                  <label htmlFor="p2p-file-input">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <br />
                    {files.length > 0
                      ? `${files.length} file(s) selected`
                      : "Drop files here or click to browse"}
                    <br />
                    <span className="p2p-file-hint">Max 2GB per file</span>
                  </label>
                </div>

                {fileError && (
                  <p className="p2p-code-error">{fileError}</p>
                )}

                {files.length > 0 && (
                  <>
                    <div className="p2p-file-list">
                      {files.map((f, i) => (
                        <div key={i} className="p2p-file-item">
                          <span className="p2p-file-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </span>
                          <span className="p2p-file-name">{f.name}</span>
                          <span className="p2p-file-size">{formatSize(f.size)}</span>
                          <button
                            className="p2p-file-remove"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="p2p-total-size">Total: {formatSize(totalSize)}</div>
                    <button className="p2p-send-btn" onClick={handleSendFiles}>
                      SEND {files.length} FILE{files.length > 1 ? "S" : ""}
                    </button>
                  </>
                )}
              </>
            )}

            {sending && progress > 0 && progress < 100 && (
              <div className="p2p-progress">
                <div className="p2p-progress-bar">
                  <div
                    className="p2p-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="p2p-progress-info">
                  <p className="p2p-progress-text">{progress}%</p>
                  {speed > 0 && (
                    <p className="p2p-speed">{formatSpeed(speed)}</p>
                  )}
                </div>
              </div>
            )}

            {connected && progress === 100 && (
              <div className="p2p-complete">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p>Transfer Complete!</p>
                <button className="p2p-send-another-btn" onClick={handleSendAnother}>SEND ANOTHER</button>
              </div>
            )}
          </>
        )}

        {mode === "receiver" && (
          <>
            <div className="p2p-section-title">CONNECTED</div>
            <div className="p2p-status">{status}</div>

            {!connected && !error && (
              <div className="p2p-waiting">
                <div className="p2p-spinner"></div>
                <p>Establishing connection...</p>
              </div>
            )}

            {connected && progress === 0 && (
              <div className="p2p-waiting">
                <div className="p2p-spinner"></div>
                <p>Waiting for files...</p>
              </div>
            )}

            {progress > 0 && progress < 100 && (
              <div className="p2p-progress">
                <div className="p2p-progress-bar">
                  <div
                    className="p2p-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="p2p-progress-text">{progress}%</p>
              </div>
            )}

            {progress === 100 && (
              <div className="p2p-complete">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p>Files received!</p>
              </div>
            )}

            {receivedFiles.length > 0 && (
              <div className="p2p-received">
                <div className="p2p-section-title">RECEIVED FILES</div>
                {receivedFiles.map((file, i) => (
                  <div key={i} className="p2p-received-file">
                    <span className="p2p-file-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </span>
                    <span className="p2p-file-name">{file.name}</span>
                    <span className="p2p-file-size">{formatSize(file.size)}</span>
                  </div>
                ))}
                <button
                  className="p2p-send-btn"
                  onClick={async () => {
                    if (receivedFiles.length === 1) {
                      const file = receivedFiles[0];
                      const reader = new FileReader();
                      reader.onload = () => {
                        const a = document.createElement("a");
                        a.href = reader.result as string;
                        a.download = file.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      const zip = new JSZip();
                      receivedFiles.forEach((f) => zip.file(f.name, f));
                      const blob = await zip.generateAsync({ type: "blob" });
                      const reader = new FileReader();
                      reader.onload = () => {
                        const a = document.createElement("a");
                        a.href = reader.result as string;
                        a.download = "filedrop-files.zip";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      };
                      reader.readAsDataURL(blob);
                    }
                  }}
                >
                  {receivedFiles.length === 1 ? "DOWNLOAD FILE" : "DOWNLOAD ALL AS ZIP"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
