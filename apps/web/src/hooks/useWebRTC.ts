import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const CHUNK_SIZE = 16384;
const TIMEOUT_MS = 60000;

export interface WebRTCPeer {
  connected: boolean;
  roomCode: string | null;
  remoteSocketId: string | null;
  progress: number;
  status: string;
  error: string | null;
  createRoom: () => string;
  joinRoom: (code: string) => void;
  sendFiles: (files: File[]) => Promise<void>;
  leaveRoom: () => void;
  receivedFiles: File[];
  clearReceivedFiles: () => void;
  resetProgress: () => void;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(): WebRTCPeer {
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<File[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roleRef = useRef<"sender" | "receiver" | null>(null);
  const receivedChunksRef = useRef<Map<string, { metadata: any; chunks: ArrayBuffer[]; received: number }>>(new Map());
  const roomCodeRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const log = useCallback((...args: any[]) => {
    console.log("[WebRTC]", ...args);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearAllTimers();
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    roleRef.current = null;
    roomCodeRef.current = null;
    receivedChunksRef.current.clear();
    setConnected(false);
    setRoomCode(null);
    setRemoteSocketId(null);
    setProgress(0);
    setStatus("");
    setError(null);
  }, [clearAllTimers]);

  const handleIncomingMessage = useCallback((data: string | ArrayBuffer) => {
    if (typeof data === "string") {
      const msg = JSON.parse(data);

      if (msg.type === "file-metadata") {
        receivedChunksRef.current.set(msg.id, {
          metadata: { name: msg.name, size: msg.size, type: msg.mimeType },
          chunks: [],
          received: 0,
        });
        setStatus(`Receiving: ${msg.name}`);
      } else if (msg.type === "file-end") {
        const entry = receivedChunksRef.current.get(msg.id);
        if (entry) {
          const blob = new Blob(entry.chunks, { type: entry.metadata.type });
          const file = new File([blob], entry.metadata.name, {
            type: entry.metadata.type,
          });
          setReceivedFiles((prev) => [...prev, file]);
          receivedChunksRef.current.delete(msg.id);
        }
      } else if (msg.type === "transfer-complete") {
        setStatus("Transfer complete!");
        setProgress(100);
      }
    } else {
      const view = new DataView(data);
      const idLen = view.getUint8(0);
      const id = new TextDecoder().decode(new Uint8Array(data, 1, idLen));
      const entry = receivedChunksRef.current.get(id);
      if (entry) {
        entry.chunks.push(data.slice(1 + idLen));
        entry.received += data.byteLength - 1 - idLen;
        if (entry.metadata.size > 0) {
          setProgress(Math.round((entry.received / entry.metadata.size) * 100));
        }
      }
    }
  }, []);

  const createPeerConnection = useCallback((socket: Socket, role: "sender" | "receiver") => {
    log("Creating peer connection, role:", role);

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const code = roomCodeRef.current;
        if (code) {
          socket.emit("p2p:ice-candidate", {
            roomId: code,
            candidate: event.candidate,
          });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      log("ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        clearAllTimers();
        setConnected(true);
        setStatus("Connected! Ready to transfer.");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setConnected(false);
        setError("Connection lost. Try again.");
      }
    };

    if (role === "sender") {
      const dc = pc.createDataChannel("files");
      dcRef.current = dc;

      dc.onopen = () => {
        log("Data channel OPEN");
        setStatus("Data channel open. Ready to send.");
      };

      dc.onclose = () => setStatus("Data channel closed");
      dc.onerror = () => log("Data channel error");
    } else {
      pc.ondatachannel = (event) => {
        log("Received data channel");
        const dc = event.channel;
        dcRef.current = dc;

        dc.onopen = () => {
          log("Data channel OPEN");
          setStatus("Data channel open. Waiting for files...");
        };

        dc.onmessage = (event) => handleIncomingMessage(event.data);
        dc.onclose = () => setStatus("Data channel closed");
        dc.onerror = () => log("Data channel error");
      };
    }

    pcRef.current = pc;
    return pc;
  }, [log, handleIncomingMessage, clearAllTimers]);

  const createRoom = useCallback(() => {
    cleanup();
    const code = generateCode();
    log("Creating room:", code);

    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;
    roleRef.current = "sender";
    roomCodeRef.current = code;

    // Register listeners BEFORE connect
    socket.on("p2p:ready", async () => {
      log("Receiver ready — creating and sending offer");
      clearAllTimers();
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("p2p:offer", { roomId: code, offer: pc.localDescription });
        log("Offer sent");
      } catch (e) {
        log("Error sending offer:", e);
        setError("Failed to establish connection.");
      }
    });

    socket.on("p2p:answer", async (data: { answer: RTCSessionDescriptionInit }) => {
      log("Received answer");
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          log("Set remote description (answer) OK");
        } catch (e) {
          log("Error setting answer:", e);
        }
      }
    });

    socket.on("p2p:ice-candidate", async (data: { candidate: RTCIceCandidateInit }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          log("Error adding ICE candidate:", e);
        }
      }
    });

    socket.on("connect", () => {
      log("Socket connected:", socket.id);
      socket.emit("join:p2p", code);
      setRoomCode(code);
      setStatus("Room created. Waiting for receiver...");
      createPeerConnection(socket, "sender");

      // Start timeout
      timeoutRef.current = setTimeout(() => {
        if (!connected) {
          setError("No one joined. Share the code and try again.");
          setStatus("");
        }
      }, TIMEOUT_MS);
    });

    socket.on("connect_error", (err) => {
      log("Connect error:", err.message);
      setError("Cannot connect to server.");
    });

    return code;
  }, [cleanup, createPeerConnection, log, clearAllTimers, connected]);

  const joinRoom = useCallback(
    (code: string) => {
      cleanup();
      log("Joining room:", code);

      const socket = io(window.location.origin, {
        transports: ["websocket", "polling"],
      });

      socketRef.current = socket;
      roleRef.current = "receiver";
      roomCodeRef.current = code;

      // Register listeners BEFORE connect
      socket.on("p2p:offer", async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
        log("Received offer from:", data.from);
        clearAllTimers();
        setRemoteSocketId(data.from);

        const pc = pcRef.current;
        if (!pc) {
          log("ERROR: No peer connection");
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("p2p:answer", {
            roomId: code,
            answer: pc.localDescription,
          });
          log("Answer sent");
        } catch (e) {
          log("Error handling offer:", e);
          setError("Failed to connect to sender.");
        }
      });

      socket.on("p2p:answer", async (data: { answer: RTCSessionDescriptionInit }) => {
        if (pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          } catch (e) {
            log("Error setting answer:", e);
          }
        }
      });

      socket.on("p2p:ice-candidate", async (data: { candidate: RTCIceCandidateInit }) => {
        if (pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            log("Error adding ICE candidate:", e);
          }
        }
      });

      socket.on("connect", () => {
        log("Socket connected:", socket.id);
        socket.emit("join:p2p", code);
        setRoomCode(code);
        setStatus("Joined room. Establishing connection...");

        createPeerConnection(socket, "receiver");

        // Tell sender we're ready
        socket.emit("p2p:ready", { roomId: code });
        log("Emitted p2p:ready");

        // Timeout if no offer received (wrong code)
        timeoutRef.current = setTimeout(() => {
          if (!connected) {
            setError("Invalid code or sender not found. Check the code and try again.");
            setStatus("");
          }
        }, TIMEOUT_MS);
      });

      socket.on("connect_error", (err) => {
        log("Connect error:", err.message);
        setError("Cannot connect to server.");
      });
    },
    [cleanup, createPeerConnection, log]
  );

  const sendFiles = useCallback(
    async (files: File[]) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") {
        log("Cannot send: data channel state =", dc?.readyState ?? "null");
        setStatus("Data channel not ready. Waiting for connection...");
        return;
      }

      setStatus("Sending files...");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = `${Date.now()}-${i}`;

        dc.send(
          JSON.stringify({
            type: "file-metadata",
            id: fileId,
            name: file.name,
            size: file.size,
            mimeType: file.type,
          })
        );

        const reader = new FileReader();
        let offset = 0;

        await new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as ArrayBuffer;
            let chunkOffset = 0;

            const sendChunk = () => {
              while (chunkOffset < result.byteLength) {
                const chunk = result.slice(chunkOffset, chunkOffset + CHUNK_SIZE);

                const idBytes = new TextEncoder().encode(fileId);
                const packet = new Uint8Array(1 + idBytes.length + chunk.byteLength);
                packet[0] = idBytes.length;
                packet.set(idBytes, 1);
                packet.set(new Uint8Array(chunk), 1 + idBytes.length);

                if (dc.bufferedAmount > 65536) {
                  setTimeout(sendChunk, 10);
                  return;
                }

                dc.send(packet.buffer);
                chunkOffset += CHUNK_SIZE;
                offset += CHUNK_SIZE;

                setProgress(
                  Math.round(((offset / file.size) * 100 * (i + 1)) / files.length)
                );
              }

              dc.send(JSON.stringify({ type: "file-end", id: fileId }));
              resolve();
            };

            sendChunk();
          };

          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      }

      dc.send(JSON.stringify({ type: "transfer-complete" }));
      setStatus("Transfer complete!");
      setProgress(100);
    },
    []
  );

  const leaveRoom = useCallback(() => {
    if (roomCodeRef.current && socketRef.current) {
      socketRef.current.emit("leave:p2p", roomCodeRef.current);
    }
    cleanup();
  }, [cleanup]);

  const clearReceivedFiles = useCallback(() => {
    setReceivedFiles([]);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connected,
    roomCode,
    remoteSocketId,
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
  };
}
