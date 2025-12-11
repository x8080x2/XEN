import { Express } from "express";
import { FileService } from "../services/fileService";
import { filePathSchema, fileContentSchema, validateRequest, formatValidationError } from "../utils/validation";
import { telegramBotService } from "../services/telegramBotService"; // Assuming telegramBotService is imported elsewhere and accessible

export function setupElectronRoutes(app: Express) {
  const fileService = new FileService();

  // List files from directory with fallback support
  app.get("/api/electron/listFiles", async (req, res) => {
    try {
      const dirpath = req.query.dirpath as string || '';
      const extensionFilter = req.query.ext as string;

      let extensions: string[] | undefined;
      if (extensionFilter) {
        extensions = extensionFilter.split(',').map(ext => ext.trim());
      } else {
        // Default to HTML files for compatibility
        extensions = ['.html', '.htm'];
      }

      const result = await fileService.listFilesWithFallback(dirpath, extensions, true);
      console.log(`[ElectronAPI] Listed ${result.files.length} files from user-package/${dirpath || 'files'}`);
      res.json(result);
    } catch (error) {
      console.error('[ElectronAPI] List files error:', error);
      res.status(500).json({ error: 'Failed to list files', files: [] });
    }
  });

  // List logo files with fallback support
  app.get("/api/electron/listLogoFiles", async (req, res) => {
    try {
      const logoExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
      const result = await fileService.listFilesWithFallback('files/logo', logoExtensions, true);
      console.log(`[ElectronAPI] Listed ${result.files.length} logo files from user-package/files/logo`);
      res.json(result);
    } catch (error) {
      console.error('[ElectronAPI] List logo files error:', error);
      res.status(500).json({ error: 'Failed to list logo files', files: [] });
    }
  });

  // Read file content with fallback support
  app.get("/api/electron/readFile", async (req, res) => {
    try {
      const filepath = req.query.filepath as string;

      // Enhanced validation for file path
      const validation = validateRequest(filePathSchema, filepath);
      if (!validation.success) {
        return res.status(400).json(formatValidationError(validation.errors));
      }

      const content = await fileService.readFileWithFallback(validation.data, true);

      if (content === null) {
        return res.status(404).json({ 
          error: 'File not found',
          message: 'The requested file does not exist in user-package location'
        });
      }

      console.log(`[ElectronAPI] Successfully read file from user-package: ${validation.data}`);
      res.json({ content, filepath: validation.data });
    } catch (error) {
      console.error('[ElectronAPI] Read file error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to read file due to server error'
      });
    }
  });

  // Write file with secure path validation
  app.post("/api/electron/writeFile", async (req, res) => {
    try {
      const { filepath, content } = req.body;

      // Validate file path
      const pathValidation = validateRequest(filePathSchema, filepath);
      if (!pathValidation.success) {
        return res.status(400).json({
          ...formatValidationError(pathValidation.errors),
          success: false
        });
      }

      // Validate file content
      const contentValidation = validateRequest(fileContentSchema, content);
      if (!contentValidation.success) {
        return res.status(400).json({
          ...formatValidationError(contentValidation.errors),
          success: false
        });
      }

      const success = await fileService.writeFileSecure(pathValidation.data, contentValidation.data);

      if (!success) {
        return res.status(400).json({ 
          error: 'Write operation failed',
          message: 'File path is not allowed or write operation failed',
          success: false 
        });
      }

      console.log(`[ElectronAPI] Successfully wrote file: ${pathValidation.data}`);
      res.json({ 
        success: true, 
        filepath: pathValidation.data,
        size: contentValidation.data.length 
      });
    } catch (error) {
      console.error('[ElectronAPI] Write file error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to write file due to server error',
        success: false 
      });
    }
  });

  // List config files (for loading INI files from both locations)
  app.get("/api/electron/listConfigFiles", async (req, res) => {
    try {
      const configExtensions = ['.ini', '.conf', '.config'];
      const result = await fileService.listFilesWithFallback('config', configExtensions, true);
      console.log(`[ElectronAPI] Listed ${result.files.length} config files from user-package/config`);
      res.json(result);
    } catch (error) {
      console.error('[ElectronAPI] List config files error:', error);
      res.status(500).json({ error: 'Failed to list config files', files: [] });
    }
  });

  // Dismiss a broadcast (permanently delete from database)
  app.post('/api/telegram/broadcasts/:broadcastId/dismiss', async (req, res) => {
    const { broadcastId } = req.params;
    const userId = req.header('X-User-ID') || 'desktop-user';

    console.log(`[Electron Routes] Permanently dismissing broadcast ${broadcastId} for user ${userId}`);

    await telegramBotService.dismissBroadcast(broadcastId, userId);

    res.json({ success: true, message: 'Broadcast permanently dismissed' });
  });

  console.log('[ElectronAPI] Electron-compatible routes registered');
}