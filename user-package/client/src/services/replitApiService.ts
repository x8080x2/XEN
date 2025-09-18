// Service for connecting to the hosted Replit server for email sending
export class ReplitApiService {
  private baseUrl: string;

  constructor() {
    // Get the Replit server URL from environment variables or electron context
    this.baseUrl = this.getServerUrl();
  }

  private getServerUrl(): string {
    // Check sources in order of priority
    const electronUrl = (window as any).REPLIT_SERVER_URL;
    const envUrl = process.env.REPLIT_SERVER_URL;
    const storedUrl = localStorage.getItem('replit_server_url');
    const fallbackUrl = 'https://7bb275f6-8278-4b24-a6bf-306c1d44cc7a-00-3rgrdg95qx2mk.worf.replit.dev';

    const url = electronUrl || envUrl || storedUrl || fallbackUrl;
    return url.trim().replace(/\/$/, ''); // Remove trailing slash
  }

  // Set server URL manually (for user configuration)
  public setServerUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
    localStorage.setItem('replit_server_url', this.baseUrl);
  }

  // Get current server URL
  public getServerUrlForDisplay(): string {
    return this.baseUrl;
  }

  // Send emails using the original sendMail endpoint
  public async sendEmails(data: {
    recipients: string[];
    subject: string;
    htmlContent: string;
    attachments: File[];
    settings: any;
    smtpConfig?: {
      host: string;
      port: number;
      user: string;
      password: string;
      senderName: string;
      replyTo: string;
    };
  }): Promise<any> {
    const formData = new FormData();
    
    // Append core email data
    formData.append('recipients', JSON.stringify(data.recipients));
    formData.append('subject', data.subject);
    formData.append('html', data.htmlContent);
    formData.append('emailContent', data.htmlContent);
    formData.append('settings', JSON.stringify(data.settings));
    
    // Add SMTP configuration if provided
    if (data.smtpConfig) {
      formData.append('smtpHost', data.smtpConfig.host);
      formData.append('smtpPort', data.smtpConfig.port.toString());
      formData.append('smtpUser', data.smtpConfig.user);
      formData.append('smtpPass', data.smtpConfig.password);
      formData.append('senderEmail', data.smtpConfig.user);
      formData.append('senderName', data.smtpConfig.senderName || '');
      formData.append('replyTo', data.smtpConfig.replyTo || data.smtpConfig.user);
    }
    
    // Append files
    data.attachments.forEach((file, index) => {
      formData.append(`attachment_${index}`, file);
    });

    const response = await fetch(`${this.baseUrl}/api/original/sendMail`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to send emails to Replit server');
    }

    return response.json();
  }

  // Alternative method using the job-based email sending endpoint
  public async sendEmailsJob(data: {
    recipients: string[];
    subject: string;
    htmlContent: string;
    attachments: File[];
    settings: any;
  }): Promise<any> {
    const formData = new FormData();
    
    formData.append('recipients', JSON.stringify(data.recipients));
    formData.append('subject', data.subject);
    formData.append('htmlContent', data.htmlContent);
    formData.append('settings', JSON.stringify(data.settings));
    
    // Append files
    data.attachments.forEach((file, index) => {
      formData.append(`attachment_${index}`, file);
    });

    const response = await fetch(`${this.baseUrl}/api/emails/send`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create email job');
    }

    return response.json();
  }

  // Get job status
  public async getJobStatus(jobId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/emails/status/${jobId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get job status');
    }

    return response.json();
  }

  // Get SMTP configurations from server
  public async getSmtpConfigs(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/smtp/list`);
    
    if (!response.ok) {
      throw new Error('Failed to get SMTP configurations');
    }

    return response.json();
  }

  // Test connection to the Replit server
  public async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/smtp/list`);
      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const replitApiService = new ReplitApiService();