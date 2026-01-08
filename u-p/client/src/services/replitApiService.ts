// API service for communicating with the Replit backend
// This handles both web and desktop (Electron) modes

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

const getBaseUrl = () => {
  if (isElectron()) {
    // In Electron, use the server URL from environment (set by main.js)
    const serverUrl = (window as any).REPLIT_SERVER_URL;
    if (!serverUrl) {
      console.error('[replitApi] No REPLIT_SERVER_URL found - server URL not configured');
      throw new Error('Backend server URL not configured for desktop app. Please check your .env file.');
    }
    return serverUrl.trim().replace(/\/$/, ''); // Remove trailing slash
  }
  return ''; // Empty string for web mode (uses relative paths)
};

export const replitApi = {
  // Read a file from the server
  readFile: async (filepath: string): Promise<string> => {
    // Use Electron IPC if available
    if (isElectron() && window.electronAPI?.readFile) {
      console.log('[replitApi] Using Electron API to read file:', filepath);
      return await window.electronAPI.readFile(filepath);
    }

    const response = await fetch(`${getBaseUrl()}/api/original/readFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath })
    });

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  },

  // List files in a directory
  listFiles: async (dirpath: string): Promise<string[]> => {
    // Use Electron IPC if available
    if (isElectron() && window.electronAPI?.listFiles) {
      console.log('[replitApi] Using Electron API to list files:', dirpath);
      return await window.electronAPI.listFiles(dirpath);
    }

    const response = await fetch(`${getBaseUrl()}/api/original/listFiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirpath })
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files;
  },

  // Load configuration
  loadConfig: async (): Promise<any> => {
    // Use Electron IPC if available
    if (isElectron() && window.electronAPI?.loadConfig) {
      console.log('[replitApi] Using Electron API to load config');
      const result = await window.electronAPI.loadConfig();
      return result;
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/config/load`);

      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[replitApi] Failed to load config:', error);
      return { success: false, config: {} };
    }
  },

  // Test SMTP connection
  testSmtp: async (): Promise<{ online: boolean; smtp?: any; error?: string }> => {
    // Use Electron IPC if available
    if (isElectron() && window.electronAPI?.smtpTest) {
      console.log('[replitApi] Using Electron API to test SMTP');
      return await window.electronAPI.smtpTest();
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/smtp/test`);

      if (!response.ok) {
        throw new Error(`Failed to test SMTP: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[replitApi] SMTP test failed:', error);
      return { online: false, error: 'SMTP test failed' };
    }
  },

  // Check AI service status
  checkAiStatus: async (): Promise<{ enabled: boolean; error?: string }> => {
    // Both desktop and web versions can use backend AI service
    try {
      const response = await fetch(`${getBaseUrl()}/api/ai/status`);

      if (!response.ok) {
        throw new Error(`Failed to check AI status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[replitApi] AI status check failed:', error);
      return { enabled: false, error: 'AI service check failed' };
    }
  },
};

// Electron-only Replit API service - no web fallbacks
class ElectronReplitApiService {
  private baseUrl: string | null = null;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize in constructor - wait until first use (lazy initialization)
    // This allows window.REPLIT_SERVER_URL to be set by Electron main process
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initializeServerUrl();
      this.initialized = true;
    }
  }

  private initializeServerUrl(): void {
    // Only check environment sources - no hardcoded fallbacks
    const sources = [
      (window as any).REPLIT_SERVER_URL, // From Electron main process
      process.env.REPLIT_SERVER_URL, // From environment
      localStorage.getItem('replit_server_url'), // From user settings
    ];

    for (const url of sources) {
      if (url && typeof url === 'string' && url.trim()) {
        this.baseUrl = url.trim().replace(/\/$/, ''); // Remove trailing slash
        console.log(`[ReplitAPI] Using server URL: ${this.baseUrl}`);
        return;
      }
    }

    throw new Error('No Replit server URL configured. Please set the server URL in settings.');
  }

  // Set server URL manually (for user configuration)
  setServerUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid server URL provided');
    }

    this.baseUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem('replit_server_url', this.baseUrl);
    console.log(`[ReplitAPI] Server URL updated: ${this.baseUrl}`);
  }

  // Get current server URL
  getServerUrl(): string {
    this.ensureInitialized();
    if (!this.baseUrl) {
      throw new Error('No server URL configured');
    }
    return this.baseUrl;
  }

  // Get API endpoint with automatic path construction
  getApiEndpoint(path: string): string {
    this.ensureInitialized();
    if (!this.baseUrl) {
      throw new Error('No server URL configured');
    }
    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${this.baseUrl}/${cleanPath}`;
  }

  // Get common API endpoints
  getEmailSendEndpoint(): string {
    return this.getApiEndpoint('api/original/sendMail');
  }

  getConfigEndpoint(): string {
    return this.getApiEndpoint('api/config/load');
  }

  getSmtpListEndpoint(): string {
    return this.getApiEndpoint('api/smtp/list');
  }

  // Test connection to server
  async testConnection(url?: string): Promise<{ success: boolean; message: string; url: string }> {
    if (!url) {
      this.ensureInitialized();
    }
    const testUrl = url || this.baseUrl;

    if (!testUrl) {
      return { 
        success: false, 
        message: 'No server URL to test', 
        url: testUrl || '' 
      };
    }

    try {
      const configEndpoint = url ? `${url}/api/config/load` : this.getConfigEndpoint();
      const response = await fetch(configEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        return { 
          success: true, 
          message: 'Connection successful', 
          url: testUrl 
        };
      } else {
        return { 
          success: false, 
          message: `Server responded with status ${response.status}`, 
          url: testUrl 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        url: testUrl 
      };
    }
  }

  // Send emails using the backend's /api/original/sendMail endpoint
  async sendEmailsJob(emailData: any): Promise<{ success: boolean; message: string }> {
    // Convert emailData to FormData format expected by backend
    const formData = new FormData();

    // Add email content fields
    formData.append('recipients', typeof emailData.recipients === 'string' 
      ? emailData.recipients 
      : emailData.recipients.map((r: any) => (r.email || r).trim()).join('\n')
    );
    formData.append('subject', emailData.subject || '');
    formData.append('html', emailData.htmlContent || emailData.html || '');
    formData.append('senderName', emailData.smtpConfig?.fromName || emailData.smtpConfig?.senderName || '');
    formData.append('senderEmail', emailData.smtpConfig?.fromEmail || emailData.smtpConfig?.user || '');
    formData.append('replyTo', emailData.smtpConfig?.replyTo || '');

    // Add SMTP configuration for desktop mode (required by backend)
    // Backend checks for 'userSmtpConfigs' key to detect desktop mode
    const smtpConfigs = emailData.smtpConfig ? [emailData.smtpConfig] : [];
    formData.append('userSmtpConfigs', JSON.stringify(smtpConfigs));
    formData.append('smtpRotationEnabled', 'false'); // Single SMTP for now

    // Add settings if provided (excluding attachments which are handled separately)
    if (emailData.settings) {
      Object.keys(emailData.settings).forEach(key => {
        // Skip attachments - they'll be added as binary files below
        if (key === 'attachments') return;
        
        const value = emailData.settings[key];
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }

    // Add attachments as binary files (not JSON)
    // Backend expects them as multipart 'attachments' fields
    if (emailData.settings?.attachments && Array.isArray(emailData.settings.attachments)) {
      for (const attachment of emailData.settings.attachments) {
        if (attachment.content && attachment.filename) {
          // Convert base64 back to Blob if needed
          if (typeof attachment.content === 'string' && attachment.encoding === 'base64') {
            try {
              // Decode base64 to binary
              const binaryString = atob(attachment.content);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: attachment.contentType || 'application/octet-stream' });
              const file = new File([blob], attachment.filename, { type: attachment.contentType });
              formData.append('attachments', file);
              console.log('[ReplitAPI] Added attachment as File:', attachment.filename);
            } catch (e) {
              console.error('[ReplitAPI] Failed to decode base64 attachment:', attachment.filename, e);
            }
          } else if (attachment.content instanceof Blob || attachment.content instanceof File) {
            // Already a Blob/File, append directly
            formData.append('attachments', attachment.content, attachment.filename);
            console.log('[ReplitAPI] Added attachment as Blob/File:', attachment.filename);
          }
        }
      }
    }

    // Add tunnel ID for port 25 SMTP routing (if available)
    if (isElectron() && window.electronAPI?.getTunnelId) {
      try {
        const tunnelId = await window.electronAPI.getTunnelId();
        if (tunnelId) {
          formData.append('tunnelId', tunnelId);
          console.log('[ReplitAPI] Added tunnel ID for port 25 routing:', tunnelId);
        }
      } catch (e) {
        console.log('[ReplitAPI] Could not get tunnel ID (not critical)');
      }
    }

    console.log('[ReplitAPI] Sending email job with config:', {
      recipientCount: typeof emailData.recipients === 'string' 
        ? emailData.recipients.split('\n').length 
        : emailData.recipients.length,
      smtpHost: emailData.smtpConfig?.host,
      smtpPort: emailData.smtpConfig?.port,
      hasSmtpConfigs: smtpConfigs.length > 0,
      attachmentCount: emailData.settings?.attachments?.length || 0
    });

    const response = await fetch(this.getApiEndpoint('api/original/sendMail'), {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start email sending: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`[ReplitAPI] Email sending started:`, result);
    return result;
  }

  // Send emails using pre-built FormData (simpler, same as web version)
  // This avoids unnecessary base64 conversion for file attachments
  async sendEmailsFormData(formData: FormData): Promise<{ success: boolean; message: string }> {
    console.log('[ReplitAPI] Sending email via FormData (direct method)...');
    
    const response = await fetch(this.getApiEndpoint('api/original/sendMail'), {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start email sending: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`[ReplitAPI] Email sending started (FormData):`, result);
    return result;
  }

  // Check email sending progress
  async checkJobStatus(since: number = 0): Promise<any> {
    const response = await fetch(this.getApiEndpoint(`api/original/progress?since=${since}`));

    if (!response.ok) {
      throw new Error(`Failed to check progress: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Get SMTP configurations
  async getSmtpList(): Promise<any> {
    const response = await fetch(this.getSmtpListEndpoint());

    if (!response.ok) {
      throw new Error(`Failed to fetch SMTP list: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Cancel sending
  async cancelSending(): Promise<any> {
    const response = await fetch(this.getApiEndpoint('api/original/cancel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel sending: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const replitApiService = new ElectronReplitApiService();