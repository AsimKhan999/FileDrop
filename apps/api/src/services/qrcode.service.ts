import QRCode from "qrcode";

export class QRCodeService {
  async generateDataURL(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: "#00ff41",
        light: "#050505",
      },
    });
  }

  async generateBuffer(url: string): Promise<Buffer> {
    return QRCode.toBuffer(url, {
      width: 256,
      margin: 2,
      color: {
        dark: "#00ff41",
        light: "#050505",
      },
    });
  }
}

export const qrCodeService = new QRCodeService();
