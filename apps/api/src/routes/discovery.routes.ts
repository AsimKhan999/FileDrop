import { Router, Request, Response } from "express";
import { browseDevices } from "../services/discovery.service";

export const discoveryRouter = Router();

discoveryRouter.get("/devices", async (_req: Request, res: Response) => {
  try {
    const devices = await browseDevices();
    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    console.error("Discovery error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "DISCOVERY_FAILED",
        message: "Failed to discover devices.",
      },
    });
  }
});
