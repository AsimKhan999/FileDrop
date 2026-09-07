import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  shareToken?: string;
  onUploadProgress?: (data: { fileId: string; progress: number }) => void;
  onUploadCompleted?: (data: {
    shareId: string;
    token: string;
    files: { id: string; name: string }[];
  }) => void;
  onUploadFailed?: (data: { error: string }) => void;
  onDownloadStarted?: (data: { fileId: string; fileName: string }) => void;
  onDownloadCompleted?: (data: {
    fileId: string;
    fileName: string;
    downloadCount: number;
  }) => void;
  onShareExpired?: (data: { token: string }) => void;
}

export function useSocket(options: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      if (options.shareToken) {
        socket.emit("join:share", options.shareToken);
      }
    });

    if (options.onUploadProgress) {
      socket.on("upload:progress", options.onUploadProgress);
    }
    if (options.onUploadCompleted) {
      socket.on("upload:completed", options.onUploadCompleted);
    }
    if (options.onUploadFailed) {
      socket.on("upload:failed", options.onUploadFailed);
    }
    if (options.onDownloadStarted) {
      socket.on("download:started", options.onDownloadStarted);
    }
    if (options.onDownloadCompleted) {
      socket.on("download:completed", options.onDownloadCompleted);
    }
    if (options.onShareExpired) {
      socket.on("share:expired", options.onShareExpired);
    }

    return () => {
      if (options.shareToken) {
        socket.emit("leave:share", options.shareToken);
      }
      socket.disconnect();
    };
  }, [options.shareToken]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, emit };
}
