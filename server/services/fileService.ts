import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export class FileService {
  private uploadDir = "uploads";
  private filesDir = "files"; // Assuming 'files' is a base directory for templates/logos
  
  // Safe allowed root directories
  private allowedRoots = [
    "files",
    "config", 
    "files/logo",
    "uploads",
    "user-package/files",
    "user-package/config"
  ];

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

  async deleteFile(filepath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.unlink(filepath);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to delete file ${filepath}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      return { success: false, error: errorMessage };
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

  // Safe path resolution with allow-list validation
  private safeResolve(inputPath: string): string | null {
    try {
      // Normalize the path and remove any leading ./
      let normalizedPath = path.normalize(inputPath).replace(/^\.\//, '');
      
      // Block absolute paths and path traversal
      if (path.isAbsolute(normalizedPath) || normalizedPath.includes('..')) {
        console.warn(`[FileService] Blocked unsafe path: ${inputPath}`);
        return null;
      }

      // Check if path starts with allowed root
      const isAllowed = this.allowedRoots.some(root => 
        normalizedPath === root || normalizedPath.startsWith(root + '/')
      );

      if (!isAllowed) {
        console.warn(`[FileService] Path not in allowed roots: ${normalizedPath}`);
        return null;
      }

      return normalizedPath;
    } catch (error) {
      console.error(`[FileService] Path resolution error:`, error);
      return null;
    }
  }

  // Fallback resolution: try main files, then user-package/files
  private async resolveWithFallback(filePath: string): Promise<string | null> {
    const searchPaths = [
      `files/${filePath}`,
      `user-package/files/${filePath}`,
      filePath // Try exact path if it includes directory prefix
    ];

    for (const searchPath of searchPaths) {
      const safePath = this.safeResolve(searchPath);
      if (safePath) {
        try {
          await fs.access(safePath);
          return safePath;
        } catch {
          // Continue to next path
          continue;
        }
      }
    }
    return null;
  }

  // Enhanced file reading with fallback support
  async readFileWithFallback(filePath: string): Promise<string | null> {
    try {
      const resolvedPath = await this.resolveWithFallback(filePath);
      if (!resolvedPath) {
        console.warn(`[FileService] File not found in any location: ${filePath}`);
        return null;
      }
      
      const content = await fs.readFile(resolvedPath, 'utf-8');
      console.log(`[FileService] Successfully read file from: ${resolvedPath}`);
      return content;
    } catch (error) {
      console.error(`[FileService] Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  // Enhanced directory listing with fallback support
  async listFilesWithFallback(dirPath: string = '', extensionFilter?: string[]): Promise<{ files: string[] }> {
    try {
      const searchDirs = [
        dirPath || 'files',
        `user-package/${dirPath || 'files'}`
      ];

      const allFiles = new Set<string>();

      for (const searchDir of searchDirs) {
        const safePath = this.safeResolve(searchDir);
        if (safePath) {
          try {
            const files = await fs.readdir(safePath);
            const filteredFiles = extensionFilter 
              ? files.filter(file => extensionFilter.some(ext => file.toLowerCase().endsWith(ext.toLowerCase())))
              : files;
            
            filteredFiles.forEach(file => allFiles.add(file));
            console.log(`[FileService] Found ${filteredFiles.length} files in ${safePath}`);
          } catch {
            // Continue to next directory
            continue;
          }
        }
      }

      return { files: Array.from(allFiles).sort() };
    } catch (error) {
      console.error(`[FileService] Failed to list files in ${dirPath}:`, error);
      return { files: [] };
    }
  }

  // Write file with safe path validation
  async writeFileSecure(filePath: string, content: string): Promise<boolean> {
    try {
      const safePath = this.safeResolve(filePath);
      if (!safePath) {
        return false;
      }

      // Ensure directory exists
      const dir = path.dirname(safePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(safePath, content, 'utf-8');
      console.log(`[FileService] Successfully wrote file to: ${safePath}`);
      return true;
    } catch (error) {
      console.error(`[FileService] Failed to write file ${filePath}:`, error);
      return false;
    }
  }
}