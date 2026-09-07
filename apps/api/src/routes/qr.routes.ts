import { Router, Request, Response } from "express";
import { qrCodeService } from "../services/qrcode.service";
import os from "os";

export const qrRouter = Router();

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

qrRouter.get("/qr/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const ip = getLocalIP();
    const port = process.env.PORT || "5000";
    const shareUrl = `http://${ip}:${port}/share/${token}`;

    const dataUrl = await qrCodeService.generateDataURL(shareUrl);

    res.json({
      success: true,
      data: {
        qr: dataUrl,
        url: shareUrl,
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "QR_FAILED",
        message: "Failed to generate QR code.",
      },
    });
  }
});

qrRouter.get("/qr/:token/image", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const ip = getLocalIP();
    const port = process.env.PORT || "5000";
    const shareUrl = `http://${ip}:${port}/share/${token}`;

    const buffer = await qrCodeService.generateBuffer(shareUrl);

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (error) {
    console.error("QR image error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "QR_FAILED",
        message: "Failed to generate QR image.",
      },
    });
  }
});
