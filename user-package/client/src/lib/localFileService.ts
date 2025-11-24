// Local file service for Electron
export class LocalFileService {
  private templateCache = new Map<string, string>();
  private configCache: any = null;

  // Helper method to call backend API when electronAPI is not available
  private async callBackendAPI(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    try {
      const urlParams = new URLSearchParams(params);
      // Get server URL from Electron or use fallback
      const baseUrl = (window as any).REPLIT_SERVER_URL ||
                     'https://your-repl-name.your-username.repl.co';
      const response = await fetch(`${baseUrl}/api/electron/${endpoint}?${urlParams}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Backend API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Electron API equivalent: listFiles
  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await this.callBackendAPI('listFiles', { dirpath: dirPath });
      return files;
    } catch (error) {
      console.error('Failed to list files via backend API:', error);
      return [];
    }
  }

  // Simulate reading config from localStorage or IndexedDB
  async loadLocalConfig(): Promise<any> {
    if (this.configCache) return this.configCache;

    try {
      const savedConfig = localStorage.getItem('emailSenderConfig');
      if (savedConfig) {
        this.configCache = JSON.parse(savedConfig);
        return this.configCache;
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
    }

    // Return default config
    this.configCache = {
      SMTP: {
        host: '',
        port: '587',
        user: '',
        pass: '',
        fromEmail: '',
        fromName: ''
      },
      EMAILPERSECOND: 5,
      SLEEP: 3,
      QRCODE: false,
      RANDOM_METADATA: false,
      HTML2IMG_BODY: false,
      ZIP_USE: false,
      PROXY_USE: false
    };

    return this.configCache;
  }

  // Save config to localStorage
  async saveLocalConfig(config: any): Promise<boolean> {
    try {
      localStorage.setItem('emailSenderConfig', JSON.stringify(config));
      this.configCache = config;
      return true;
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
      return false;
    }
  }

  // Load leads from localStorage
  async loadLocalLeads(): Promise<string[]> {
    try {
      const savedLeads = localStorage.getItem('emailSenderLeads');
      if (savedLeads) {
        return JSON.parse(savedLeads);
      }
    } catch (error) {
      console.error('Failed to load leads from localStorage:', error);
    }
    return [];
  }

  // Save leads to localStorage
  async saveLocalLeads(leads: string[]): Promise<boolean> {
    try {
      localStorage.setItem('emailSenderLeads', JSON.stringify(leads));
      return true;
    } catch (error) {
      console.error('Failed to save leads to localStorage:', error);
      return false;
    }
  }

  // File picker for templates
  async selectTemplateFile(): Promise<{ name: string; content: string } | null> {
    try {
      // Use File API for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.html,.htm,.txt';

      return new Promise((resolve) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const content = await file.text();
            resolve({ name: file.name, content });
          } else {
            resolve(null);
          }
        };

        input.oncancel = () => resolve(null);
        input.click();
      });
    } catch (error) {
      console.error('Failed to select template file:', error);
      return null;
    }
  }

  // Multiple file picker for attachments
  async selectAttachmentFiles(): Promise<File[] | null> {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;

      return new Promise((resolve) => {
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            resolve(Array.from(files));
          } else {
            resolve(null);
          }
        };

        input.oncancel = () => resolve(null);
        input.click();
      });
    } catch (error) {
      console.error('Failed to select attachment files:', error);
      return null;
    }
  }

  // Read file - try Electron API first, fallback to backend API
  async readFile(filePath: string): Promise<string | null> {
    // Try Electron API if available
    if (window.electronAPI?.readFile) {
      // Check cache first
      if (this.templateCache.has(filePath)) {
        console.log(`[Cache] Using cached content for ${filePath}`);
        return this.templateCache.get(filePath)!;
      }

      try {
        const content = await window.electronAPI.readFile(filePath);
        if (content) {
          // Cache the content
          this.templateCache.set(filePath, content);
          console.log(`[LocalFileService] Successfully read and cached: ${filePath}`);
          return content;
        }
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
      }
    }

    // Fallback to backend API
    try {
      const result = await this.callBackendAPI('readFile', { filepath: filePath });
      return result.content;
    } catch (error) {
      console.error('Failed to read file via backend API:', error);
      return null;
    }
  }

  // Electron API only: writeFile
  async writeFile(filePath: string, content: string): Promise<boolean> {
    if (!window.electronAPI?.writeFile) {
      throw new Error('Electron API not available - this feature requires the desktop app');
    }

    try {
      const success = await window.electronAPI.writeFile(filePath, content);

      if (success) {
        // Update cache if write was successful
        this.templateCache.set(filePath, content);
        console.log(`[LocalFileService] Successfully wrote file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
      return false;
    }
  }

  // Electron API only: readConfig
  async readConfig(configDir: string = 'config'): Promise<any> {
    if (!window.electronAPI?.readConfig) {
      throw new Error('Electron API not available - this feature requires the desktop app');
    }

    // Check cache first
    if (this.configCache) {
      console.log('[Cache] Using cached config');
      return this.configCache;
    }

    try {
      const config = await window.electronAPI.readConfig(configDir);

      // Cache the config
      this.configCache = config;
      console.log('[LocalFileService] Successfully loaded and cached config');
      return config;
    } catch (error) {
      console.error('Failed to read config:', error);
      return null;
    }
  }

  // Clear cache method
  clearCache(): void {
    this.templateCache.clear();
    this.configCache = null;
    console.log('[LocalFileService] Cache cleared');
  }
}

export const localFileService = new LocalFileService();