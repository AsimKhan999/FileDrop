import fs from "fs";
import path from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage/uploads";

export class StorageService {
  private basePath: string;

  constructor(basePath: string = STORAGE_PATH) {
    this.basePath = path.resolve(basePath);
    this.ensureDirectoryExists(this.basePath);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async saveFile(
    storedName: string,
    fileStream: fs.ReadStream
  ): Promise<string> {
    const filePath = path.join(this.basePath, storedName);
    const writeStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      fileStream.pipe(writeStream);
      writeStream.on("finish", () => resolve(filePath));
      writeStream.on("error", reject);
    });
  }

  async saveBuffer(storedName: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(this.basePath, storedName);
    this.ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  getFilePath(storedName: string): string {
    return path.join(this.basePath, storedName);
  }

  async deleteFile(storedName: string): Promise<void> {
    const filePath = this.getFilePath(storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async fileExists(storedName: string): Promise<boolean> {
    const filePath = this.getFilePath(storedName);
    return fs.existsSync(filePath);
  }
}

export const storageService = new StorageService();
