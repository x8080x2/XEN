
// Local file service for web-based fallbacks
export class LocalFileService {
  private templateCache = new Map<string, string>();
  private configCache: any = null;

  // Helper method to call backend API when electronAPI is not available
  private async callBackendAPI(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    try {
      const urlParams = new URLSearchParams(params);
      // Get server URL from Electron or use fallback
      const baseUrl = (window as any).REPLIT_SERVER_URL || 
                     window.electronAPI?.getServerUrl?.() || 
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

  // Electron API equivalent: readFile
  async readFile(filePath: string): Promise<string> {
    try {
      const result = await this.callBackendAPI('readFile', { filepath: filePath });
      return result.content;
    } catch (error) {
      console.error('Failed to read file via backend API:', error);
      throw error;
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
}

export const localFileService = new LocalFileService();
