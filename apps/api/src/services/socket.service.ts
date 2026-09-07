import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`> Socket connected: ${socket.id}`);

    socket.on("join:share", (shareToken: string) => {
      socket.join(`share:${shareToken}`);
      console.log(`> Socket ${socket.id} joined share:${shareToken}`);
    });

    socket.on("leave:share", (shareToken: string) => {
      socket.leave(`share:${shareToken}`);
    });

    // WebRTC signaling
    socket.on("join:p2p", (roomId: string) => {
      socket.join(`p2p:${roomId}`);
      const room = io.sockets.adapter.rooms.get(`p2p:${roomId}`);
      console.log(`> Socket ${socket.id} joined p2p:${roomId} (room size: ${room?.size ?? 0})`);
    });

    socket.on("p2p:ready", (data: { roomId: string }) => {
      console.log(`> p2p:ready from ${socket.id} to p2p:${data.roomId}`);
      socket.to(`p2p:${data.roomId}`).emit("p2p:ready", {
        from: socket.id,
      });
    });

    socket.on("leave:p2p", (roomId: string) => {
      socket.leave(`p2p:${roomId}`);
    });

    socket.on("p2p:offer", (data: { roomId: string; offer: unknown }) => {
      const room = io.sockets.adapter.rooms.get(`p2p:${data.roomId}`);
      console.log(`> p2p:offer from ${socket.id} to p2p:${data.roomId} (room size: ${room?.size ?? 0})`);
      socket.to(`p2p:${data.roomId}`).emit("p2p:offer", {
        offer: data.offer,
        from: socket.id,
      });
    });

    socket.on("p2p:answer", (data: { roomId: string; answer: unknown }) => {
      console.log(`> p2p:answer from ${socket.id} to p2p:${data.roomId}`);
      socket.to(`p2p:${data.roomId}`).emit("p2p:answer", {
        answer: data.answer,
        from: socket.id,
      });
    });

    socket.on("p2p:ice-candidate", (data: { roomId: string; candidate: unknown }) => {
      console.log(`> p2p:ice-candidate from ${socket.id} to p2p:${data.roomId}`);
      socket.to(`p2p:${data.roomId}`).emit("p2p:ice-candidate", {
        candidate: data.candidate,
        from: socket.id,
      });
    });

    socket.on("disconnect", () => {
      console.log(`> Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}

export function emitUploadProgress(
  shareToken: string,
  data: { fileId: string; progress: number }
) {
  io?.to(`share:${shareToken}`).emit("upload:progress", data);
}

export function emitUploadCompleted(
  shareToken: string,
  data: { shareId: string; token: string; files: { id: string; name: string }[] }
) {
  io?.to(`share:${shareToken}`).emit("upload:completed", data);
}

export function emitUploadFailed(shareToken: string, data: { error: string }) {
  io?.to(`share:${shareToken}`).emit("upload:failed", data);
}

export function emitDownloadStarted(
  shareToken: string,
  data: { fileId: string; fileName: string }
) {
  io?.to(`share:${shareToken}`).emit("download:started", data);
}

export function emitDownloadCompleted(
  shareToken: string,
  data: { fileId: string; fileName: string; downloadCount: number }
) {
  io?.to(`share:${shareToken}`).emit("download:completed", data);
}

export function emitShareExpired(shareToken: string) {
  io?.to(`share:${shareToken}`).emit("share:expired", { token: shareToken });
}
