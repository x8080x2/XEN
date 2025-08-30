import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export class FileService {
  private uploadDir = "uploads";
  private filesDir = "files"; // Assuming 'files' is a base directory for templates/logos

  constructor() {
    this.ensureUploadDir();
    this.ensureFilesDir(); // Ensure the base files directory exists
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private async ensureFilesDir(): Promise<void> {
    try {
      await fs.access(this.filesDir);
    } catch {
      await fs.mkdir(this.filesDir, { recursive: true });
    }
  }

  async processUploadedFile(file: Express.Multer.File): Promise<any> {
    try {
      // Generate unique filename
      const ext = path.extname(file.originalname);
      const filename = `${crypto.randomUUID()}${ext}`;
      const filepath = path.join(this.uploadDir, filename);

      // Move file to permanent location
      await fs.rename(file.path, filepath);

      return {
        id: crypto.randomUUID(),
        originalName: file.originalname,
        filename,
        path: filepath,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
      };
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.unlink(file.path);
      } catch {}

      throw new Error(`Failed to process uploaded file: ${error}`);
    }
  }

  async processAttachment(attachment: any): Promise<any> {
    try {
      // Read file content
      const content = await fs.readFile(attachment.path);

      return {
        filename: attachment.filename,
        content,
        contentType: attachment.contentType,
      };
    } catch (error) {
      throw new Error(`Failed to process attachment: ${error}`);
    }
  }

  async deleteFile(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      console.error(`Failed to delete file ${filepath}:`, error);
    }
  }

  async readHtmlFile(filepath: string): Promise<string> {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read HTML file: ${error}`);
    }
  }

  async saveProcessedFile(content: string, filename: string): Promise<string> {
    try {
      const filepath = path.join(this.uploadDir, filename);
      await fs.writeFile(filepath, content, 'utf-8');
      return filepath;
    } catch (error) {
      throw new Error(`Failed to save processed file: ${error}`);
    }
  }

  async listFiles(): Promise<{ files: string[] }> {
    try {
      const files = await fs.readdir(this.filesDir);
      const htmlFiles = files.filter(file => file.endsWith('.html'));
      return { files: htmlFiles };
    } catch (error) {
      console.error('Error reading files directory:', error);
      return { files: [] };
    }
  }

  async listLogoFiles(): Promise<{ files: string[] }> {
    try {
      const logoDir = path.join(this.filesDir, 'logo');

      // Check if logo directory exists
      try {
        await fs.access(logoDir);
      } catch {
        // Directory doesn't exist, return empty array
        return { files: [] };
      }

      const files = await fs.readdir(logoDir);
      const imageFiles = files.filter(file =>
        /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file)
      );
      return { files: imageFiles };
    } catch (error) {
      console.error('Error reading logo files directory:', error);
      return { files: [] };
    }
  }
}