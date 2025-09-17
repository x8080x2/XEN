import { Express } from "express";
import { FileService } from "../services/fileService";

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

      const result = await fileService.listFilesWithFallback(dirpath, extensions);
      console.log(`[ElectronAPI] Listed ${result.files.length} files from ${dirpath || 'files'}`);
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
      const result = await fileService.listFilesWithFallback('files/logo', logoExtensions);
      console.log(`[ElectronAPI] Listed ${result.files.length} logo files`);
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
      
      if (!filepath) {
        return res.status(400).json({ error: 'filepath parameter is required' });
      }

      const content = await fileService.readFileWithFallback(filepath);
      
      if (content === null) {
        return res.status(404).json({ error: 'File not found' });
      }

      console.log(`[ElectronAPI] Successfully read file: ${filepath}`);
      res.json({ content });
    } catch (error) {
      console.error('[ElectronAPI] Read file error:', error);
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  // Write file with secure path validation
  app.post("/api/electron/writeFile", async (req, res) => {
    try {
      const { filepath, content } = req.body;
      
      if (!filepath || typeof content !== 'string') {
        return res.status(400).json({ 
          error: 'filepath and content are required',
          success: false 
        });
      }

      const success = await fileService.writeFileSecure(filepath, content);
      
      if (!success) {
        return res.status(400).json({ 
          error: 'Invalid file path or write failed',
          success: false 
        });
      }

      console.log(`[ElectronAPI] Successfully wrote file: ${filepath}`);
      res.json({ success: true });
    } catch (error) {
      console.error('[ElectronAPI] Write file error:', error);
      res.status(500).json({ error: 'Failed to write file', success: false });
    }
  });

  // List config files (for loading INI files from both locations)
  app.get("/api/electron/listConfigFiles", async (req, res) => {
    try {
      const configExtensions = ['.ini', '.conf', '.config'];
      const result = await fileService.listFilesWithFallback('config', configExtensions);
      console.log(`[ElectronAPI] Listed ${result.files.length} config files`);
      res.json(result);
    } catch (error) {
      console.error('[ElectronAPI] List config files error:', error);
      res.status(500).json({ error: 'Failed to list config files', files: [] });
    }
  });

  console.log('[ElectronAPI] Electron-compatible routes registered');
}