
// Electron-only Replit API service - no web fallbacks
class ElectronReplitApiService {
  private baseUrl: string | null = null;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize immediately - lazy load when needed
  }

  private initializeServerUrl(): void {
    if (this.initialized) return;
    
    // Only check environment sources - no hardcoded fallbacks
    const sources = [
      (window as any).REPLIT_SERVER_URL, // From Electron main process
      process.env.REPLIT_SERVER_URL, // From environment
      localStorage.getItem('replit_server_url'), // From user settings
    ];

    for (const url of sources) {
      if (url && typeof url === 'string' && url.trim()) {
        this.baseUrl = url.trim().replace(/\/$/, ''); // Remove trailing slash
        this.initialized = true;
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
    this.initialized = true;
    localStorage.setItem('replit_server_url', this.baseUrl);
    console.log(`[ReplitAPI] Server URL updated: ${this.baseUrl}`);
  }

  // Get current server URL
  getServerUrl(): string {
    this.initializeServerUrl();
    if (!this.baseUrl) {
      throw new Error('No server URL configured');
    }
    return this.baseUrl;
  }

  // Get API endpoint with automatic path construction
  getApiEndpoint(path: string): string {
    this.initializeServerUrl();
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
      this.initializeServerUrl();
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

  // Send emails via job-based system
  async sendEmails(emailData: any, licenseKey?: string): Promise<{ jobId: string; totalRecipients: number }> {
    const formData = new FormData();
    
    // Append form fields (matching backend expectations)
    formData.append('recipients', JSON.stringify(emailData.recipients));
    formData.append('subject', emailData.subject);
    formData.append('htmlContent', emailData.htmlContent);
    formData.append('settings', JSON.stringify(emailData.settings));
    
    // Append SMTP config if provided
    if (emailData.smtpConfig) {
      formData.append('smtpHost', emailData.smtpConfig.host);
      formData.append('smtpPort', emailData.smtpConfig.port.toString());
      formData.append('smtpUser', emailData.smtpConfig.user);
      formData.append('smtpPassword', emailData.smtpConfig.password);
      formData.append('senderName', emailData.smtpConfig.senderName);
      formData.append('replyTo', emailData.smtpConfig.replyTo || '');
    }
    
    // Append file attachments if any
    if (emailData.attachments && Array.isArray(emailData.attachments)) {
      emailData.attachments.forEach((file: File, index: number) => {
        formData.append(`attachment_${index}`, file);
      });
    }

    const headers: Record<string, string> = {};
    
    if (licenseKey) {
      headers['X-License-Key'] = licenseKey;
    }

    const response = await fetch(this.getApiEndpoint('api/emails/send'), {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to start email job: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[ReplitAPI] Email job started: ${result.jobId}`);
    return result;
  }

  // Get job status (alias for compatibility)
  async getJobStatus(jobId: string): Promise<any> {
    const response = await fetch(this.getApiEndpoint(`api/emails/status/${jobId}`));
    
    if (!response.ok) {
      throw new Error(`Failed to check job status: ${response.status} ${response.statusText}`);
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

  // AI Service Methods
  async checkAIStatus(): Promise<{ initialized: boolean; hasApiKey: boolean; provider: string }> {
    try {
      const response = await fetch(this.getApiEndpoint('api/ai/status'));
      
      if (!response.ok) {
        throw new Error(`Failed to check AI status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('[ReplitAPI] AI status check failed:', error);
      return { initialized: false, hasApiKey: false, provider: 'none' };
    }
  }

  async initializeAI(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.getApiEndpoint('api/ai/initialize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize AI: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('[ReplitAPI] AI initialization failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testAIGeneration(type: 'subject' | 'senderName' | 'html', context: any): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const response = await fetch(this.getApiEndpoint('api/ai/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, context })
      });

      if (!response.ok) {
        throw new Error(`AI test failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('[ReplitAPI] AI test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const replitApiService = new ElectronReplitApiService();
