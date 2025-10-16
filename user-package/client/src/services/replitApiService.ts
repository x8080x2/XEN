
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

  // Send emails via server-sent events (streaming)
  async sendEmails(emailData: any): Promise<EventSource> {
    const url = this.getEmailSendEndpoint();
    const eventSource = new EventSource(url, {
      // Note: EventSource doesn't support POST body directly
      // The server endpoint should handle this appropriately
    });

    console.log(`[ReplitAPI] Starting email sending stream: ${url}`);
    return eventSource;
  }

  // Send emails via job-based system (alternative)
  async sendEmailsJob(emailData: any): Promise<{ jobId: string }> {
    const response = await fetch(this.getApiEndpoint('api/emails/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`Failed to start email job: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[ReplitAPI] Email job started: ${result.jobId}`);
    return result;
  }

  // Check job status
  async checkJobStatus(jobId: string): Promise<any> {
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
