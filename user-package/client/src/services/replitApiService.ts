
// Electron-only Replit API service - no web fallbacks
class ElectronReplitApiService {
  private baseUrl: string | null = null;

  constructor() {
    this.initializeServerUrl();
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
    if (!this.baseUrl) {
      throw new Error('No server URL configured');
    }
    return this.baseUrl;
  }

  // Get API endpoint with automatic path construction
  getApiEndpoint(path: string): string {
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
      : emailData.recipients.map((r: any) => r.email || r).join('\n')
    );
    formData.append('subject', emailData.subject || '');
    formData.append('htmlContent', emailData.htmlContent || emailData.html || '');
    formData.append('senderName', emailData.smtpConfig?.fromName || emailData.smtpConfig?.senderName || '');
    formData.append('senderEmail', emailData.smtpConfig?.fromEmail || emailData.smtpConfig?.user || '');
    formData.append('replyTo', emailData.smtpConfig?.replyTo || '');
    
    // Add SMTP configuration for desktop mode (required by backend)
    // Backend checks for 'userSmtpConfigs' key to detect desktop mode
    const smtpConfigs = emailData.smtpConfig ? [emailData.smtpConfig] : [];
    formData.append('userSmtpConfigs', JSON.stringify(smtpConfigs));
    formData.append('smtpRotationEnabled', 'false'); // Single SMTP for now
    
    // Add settings if provided
    if (emailData.settings) {
      Object.keys(emailData.settings).forEach(key => {
        const value = emailData.settings[key];
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }
    
    console.log('[ReplitAPI] Sending email job with config:', {
      recipientCount: typeof emailData.recipients === 'string' 
        ? emailData.recipients.split('\n').length 
        : emailData.recipients.length,
      smtpHost: emailData.smtpConfig?.host,
      hasSmtpConfigs: smtpConfigs.length > 0
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
