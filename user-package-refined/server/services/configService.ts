import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
}

export interface SetupConfig {
  EMAILPERSECOND: string;
  FILE_NAME: string;
  HTML_CONVERT: string;
  HTML2IMG_BODY: string;
  LINK_PLACEHOLDER: string;
  MINIFY_HTML: string;
  PRIORITY: string;
  QRCODE: string;
  QR_WIDTH: string;
  QR_BORDER_WIDTH: string;
  QR_LINK: string;
  QR_BORDER_COLOR: string;
  QR_FOREGROUND_COLOR: string;
  QR_BACKGROUND_COLOR: string;
  RANDOM_METADATA: string;
  RETRY: string;
  SLEEP: string;
  ZIP_PASSWORD: string;
  ZIP_USE: string;
  DOMAIN_LOGO_SIZE: string;
  BORDER_STYLE: string;
  BORDER_COLOR: string;
  HIDDEN_IMAGE_FILE: string;
  HIDDEN_IMAGE_SIZE: string;
  HIDDEN_TEXT: string;
  PROXY_USE?: string;
  TYPE?: string;
  HOST?: string;
  PORT?: string;
  USER?: string;
  PASS?: string;
}

export class ConfigService {
  private configDir: string;
  private filesDir: string;

  constructor() {
    this.configDir = path.resolve(__dirname, '../../config');
    this.filesDir = path.resolve(__dirname, '../../files');
    
    // Ensure directories exist
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.filesDir)) {
      fs.mkdirSync(this.filesDir, { recursive: true });
    }
  }

  // Setup.ini management
  loadSetupConfig(): SetupConfig {
    const setupPath = path.join(this.configDir, 'setup.ini');
    
    if (!fs.existsSync(setupPath)) {
      // Return default config if file doesn't exist
      return this.getDefaultSetupConfig();
    }

    try {
      const content = fs.readFileSync(setupPath, 'utf-8');
      return this.parseIniFile(content);
    } catch (error) {
      console.error('Error loading setup.ini:', error);
      return this.getDefaultSetupConfig();
    }
  }

  saveSetupConfig(config: SetupConfig): void {
    const setupPath = path.join(this.configDir, 'setup.ini');
    
    try {
      const iniContent = this.formatIniFile(config);
      fs.writeFileSync(setupPath, iniContent, 'utf-8');
    } catch (error) {
      console.error('Error saving setup.ini:', error);
      throw new Error('Failed to save setup configuration');
    }
  }

  // SMTP.ini management
  loadSMTPConfig(): SMTPConfig[] {
    const smtpPath = path.join(this.configDir, 'smtp.ini');
    
    if (!fs.existsSync(smtpPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(smtpPath, 'utf-8');
      return this.parseSMTPFile(content);
    } catch (error) {
      console.error('Error loading smtp.ini:', error);
      return [];
    }
  }

  saveSMTPConfig(configs: SMTPConfig[]): void {
    const smtpPath = path.join(this.configDir, 'smtp.ini');
    
    try {
      const iniContent = this.formatSMTPFile(configs);
      fs.writeFileSync(smtpPath, iniContent, 'utf-8');
    } catch (error) {
      console.error('Error saving smtp.ini:', error);
      throw new Error('Failed to save SMTP configuration');
    }
  }

  // Leads.txt management
  loadLeads(): string[] {
    const leadsPath = path.join(this.filesDir, 'leads.txt');
    
    if (!fs.existsSync(leadsPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(leadsPath, 'utf-8');
      return content.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      console.error('Error loading leads.txt:', error);
      return [];
    }
  }

  saveLeads(leads: string[]): void {
    const leadsPath = path.join(this.filesDir, 'leads.txt');
    
    try {
      const content = leads.filter(lead => lead.trim().length > 0).join('\n') + '\n';
      fs.writeFileSync(leadsPath, content, 'utf-8');
    } catch (error) {
      console.error('Error saving leads.txt:', error);
      throw new Error('Failed to save leads');
    }
  }

  // Private helper methods
  private getDefaultSetupConfig(): SetupConfig {
    return {
      EMAILPERSECOND: '5',
      FILE_NAME: '{hash3}',
      HTML_CONVERT: '',
      HTML2IMG_BODY: '0',
      LINK_PLACEHOLDER: 'https://fb.com',
      MINIFY_HTML: '1',
      PRIORITY: '3',
      QRCODE: '1',
      QR_WIDTH: '200',
      QR_BORDER_WIDTH: '2',
      QR_LINK: 'https://fb.com',
      QR_BORDER_COLOR: '#000000',
      QR_FOREGROUND_COLOR: '#FF0000',
      QR_BACKGROUND_COLOR: '#FFFF00',
      RANDOM_METADATA: '0',
      RETRY: '0',
      SLEEP: '1',
      ZIP_PASSWORD: '',
      ZIP_USE: '0',
      DOMAIN_LOGO_SIZE: '150px',
      BORDER_STYLE: 'dotted',
      BORDER_COLOR: 'blue',
      HIDDEN_IMAGE_FILE: 'image.png',
      HIDDEN_IMAGE_SIZE: '50',
      HIDDEN_TEXT: 'HIDDEN',
      PROXY_USE: '1',
      TYPE: 'socks5',
      HOST: '',
      PORT: '',
      USER: '',
      PASS: '',
    };
  }

  private parseIniFile(content: string): SetupConfig {
    const config: any = {};
    const lines = content.split('\n');
    
    let currentSection = '';
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
        continue;
      }
      
      // Check for section headers
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        continue;
      }
      
      // Parse key-value pairs
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.slice(0, equalIndex).trim();
        const value = trimmed.slice(equalIndex + 1).trim();
        config[key] = value;
      }
    }
    
    return { ...this.getDefaultSetupConfig(), ...config };
  }

  private formatIniFile(config: SetupConfig): string {
    let content = '[CONFIG]\n';
    
    // Main config section
    const configKeys = [
      'EMAILPERSECOND', 'FILE_NAME', 'HTML_CONVERT', 'HTML2IMG_BODY',
      'LINK_PLACEHOLDER', 'MINIFY_HTML', 'PRIORITY', 'QRCODE', 'QR_WIDTH',
      'QR_BORDER_WIDTH', 'QR_LINK', 'QR_BORDER_COLOR', 'QR_FOREGROUND_COLOR',
      'QR_BACKGROUND_COLOR', 'RANDOM_METADATA', 'RETRY', 'SLEEP', 'ZIP_PASSWORD',
      'ZIP_USE', 'DOMAIN_LOGO_SIZE', 'BORDER_STYLE', 'BORDER_COLOR',
      'HIDDEN_IMAGE_FILE', 'HIDDEN_IMAGE_SIZE', 'HIDDEN_TEXT'
    ];
    
    for (const key of configKeys) {
      if (config[key as keyof SetupConfig] !== undefined) {
        content += `${key}=${config[key as keyof SetupConfig]}\n`;
      }
    }
    
    // Proxy section
    content += '\n[PROXY]\n';
    const proxyKeys = ['PROXY_USE', 'TYPE', 'HOST', 'PORT', 'USER', 'PASS'];
    for (const key of proxyKeys) {
      if (config[key as keyof SetupConfig] !== undefined) {
        content += `${key}=${config[key as keyof SetupConfig]}\n`;
      }
    }
    
    return content;
  }

  private parseSMTPFile(content: string): SMTPConfig[] {
    const configs: SMTPConfig[] = [];
    const lines = content.split('\n');
    
    let currentConfig: any = null;
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
        continue;
      }
      
      // Check for section headers
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Save previous config
        if (currentConfig) {
          configs.push(currentConfig);
        }
        
        currentSection = trimmed.slice(1, -1);
        currentConfig = {};
        continue;
      }
      
      // Parse key-value pairs
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0 && currentConfig) {
        const key = trimmed.slice(0, equalIndex).trim();
        const value = trimmed.slice(equalIndex + 1).trim();
        
        if (key === 'port') {
          currentConfig[key] = parseInt(value, 10);
        } else {
          currentConfig[key] = value;
        }
      }
    }
    
    // Save the last config
    if (currentConfig) {
      configs.push(currentConfig);
    }
    
    return configs;
  }

  private formatSMTPFile(configs: SMTPConfig[]): string {
    let content = '';
    
    configs.forEach((config, index) => {
      content += `[smtp${index}]\n`;
      content += `host=${config.host}\n`;
      content += `port=${config.port}\n`;
      content += `user=${config.user}\n`;
      content += `pass=${config.pass}\n`;
      content += `fromEmail=${config.fromEmail}\n`;
      content += '\n';
    });
    
    return content;
  }
}

// Export singleton instance
export const configService = new ConfigService();