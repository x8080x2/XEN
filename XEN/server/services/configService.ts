import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Config loading service - exact clone from main.js lines 25-108
export class ConfigService {
  private configData: any = {};
  private smtpRotationEnabled: boolean = false;
  private currentSmtpIndex = 0;
  private allSmtpConfigs: any[] = [];
  private rotationStateLoaded = false;

  constructor() {
    this.loadConfig();
    this.loadRotationState();
  }

  // Load rotation state from Replit DB (persistent across restarts)
  private async loadRotationState() {
    try {
      const dbUrl = process.env.REPLIT_DB_URL;
      if (!dbUrl) return;

      const response = await fetch(`${dbUrl}/smtp_rotation_enabled`);
      if (response.ok) {
        const enabled = await response.text();
        this.smtpRotationEnabled = enabled === 'true';
      }

      const indexResponse = await fetch(`${dbUrl}/smtp_rotation_index`);
      if (indexResponse.ok) {
        const index = await response.text();
        this.currentSmtpIndex = parseInt(index) || 0;
      }

      this.rotationStateLoaded = true;
      console.log('[ConfigService] Loaded SMTP rotation state:', {
        enabled: this.smtpRotationEnabled,
        index: this.currentSmtpIndex
      });
    } catch (error) {
      console.error('[ConfigService] Failed to load rotation state:', error);
    }
  }

  // Save rotation state to Replit DB
  private async saveRotationState() {
    try {
      const dbUrl = process.env.REPLIT_DB_URL;
      if (!dbUrl) return;

      await fetch(dbUrl, {
        method: 'POST',
        body: `smtp_rotation_enabled=${this.smtpRotationEnabled}`
      });

      await fetch(dbUrl, {
        method: 'POST',
        body: `smtp_rotation_index=${this.currentSmtpIndex}`
      });
    } catch (error) {
      console.error('[ConfigService] Failed to save rotation state:', error);
    }
  }

  // Load configuration from ini files - exact clone from main.js
  loadConfig(): any {
    const configPath = join(process.cwd(), 'config', 'setup.ini');
    const smtpPath = join(process.cwd(), 'config', 'smtp.ini');

    try {
      // Load setup.ini
      if (existsSync(configPath)) {
        const setupContent = readFileSync(configPath, 'utf8');
        const setupConfig = this.parseIniFile(setupContent);
        Object.assign(this.configData, setupConfig.CONFIG || {});
        Object.assign(this.configData, setupConfig.PROXY || {});
      }

      // Load smtp.ini
      if (existsSync(smtpPath)) {
        const smtpContent = readFileSync(smtpPath, 'utf8');
        const smtpConfig = this.parseIniFile(smtpContent);
        // Load all SMTP configs for rotation
        const smtpKeys = Object.keys(smtpConfig).filter(key => key.startsWith('smtp'));
        this.allSmtpConfigs = smtpKeys.map(key => ({ id: key, ...smtpConfig[key] }));

        // Get current SMTP config (first one or rotated one)
        const currentSmtp = this.getCurrentSmtpConfig();
        if (currentSmtp) {
          Object.assign(this.configData, { SMTP: currentSmtp });
        }
      }

      // Config loaded successfully (logging disabled to reduce console clutter)
      return this.configData;
    } catch (error) {
      console.error('[ConfigService] Failed to load config:', error);
      return {};
    }
  }

  // Parse INI file format - exact clone from main.js
  private parseIniFile(content: string): any {
    const result: any = {};
    let currentSection = '';

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
        continue;
      }

      // Section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        result[currentSection] = {};
        continue;
      }

      // Key-value pair
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();

        if (currentSection) {
          result[currentSection][key] = this.parseValue(value);
        } else {
          result[key] = this.parseValue(value);
        }
      }
    }

    return result;
  }

  // Parse config values - exact clone from main.js
  private parseValue(value: string): any {
    if (value === '') return '';
    if (value === '0') return 0;
    if (value === '1') return 1;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  // Get specific config value
  getConfig(): any {
    return this.configData;
  }

  // Convert config to format expected by email service - exact clone from main.js
  getEmailConfig(): any {
    const config = this.configData;
    return {
      // Basic settings
      EMAILPERSECOND: config.EMAILPERSECOND || 15, // Increased default for better performance
      SLEEP: config.SLEEP || 1,
      FILE_NAME: config.FILE_NAME || 'attachment',
      GOOGLE_AI_KEY: config.GOOGLE_AI_KEY || '',
      REPLY_TO: config.REPLY_TO || '',
      TEMPLATE_ROTATION: config.TEMPLATE_ROTATION || 0,

      // HTML settings
      HTML_CONVERT: config.HTML_CONVERT || '',
      HTML2IMG_BODY: config.HTML2IMG_BODY || 0,
      INCLUDE_HTML_ATTACHMENT: config.INCLUDE_HTML_ATTACHMENT || 0,
      MINIFY_HTML: config.MINIFY_HTML || 0,

      // QR Code settings
      QRCODE: config.QRCODE || 0,
      QR_WIDTH: parseInt(process.env.QR_WIDTH || '150'),
      QR_BORDER_WIDTH: parseInt(process.env.QR_BORDER_WIDTH || '2'),
      QR_BORDER_COLOR: process.env.QR_BORDER_COLOR || '#000000',
      QR_FOREGROUND_COLOR: process.env.QR_FOREGROUND_COLOR || '#000000',
      QR_BACKGROUND_COLOR: process.env.QR_BACKGROUND_COLOR || '#FFFFFF',
      QR_LINK: process.env.QR_LINK || 'https://example.com',

      // File Upload Limit
      MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50'), // Default to 50MB

      // Advanced settings
      PRIORITY: config.PRIORITY || 2,
      RETRY: config.RETRY || 0,
      RANDOM_METADATA: config.RANDOM_METADATA || 0,
      LINK_PLACEHOLDER: config.LINK_PLACEHOLDER || '{email}',

      // Domain logo
      DOMAIN_LOGO_SIZE: config.DOMAIN_LOGO_SIZE || '50%',
      BORDER_STYLE: config.BORDER_STYLE || 'solid',
      BORDER_COLOR: config.BORDER_COLOR || '#000000',

      // ZIP settings
      ZIP_USE: config.ZIP_USE || 0,
      ZIP_PASSWORD: config.ZIP_PASSWORD || '',

      // Proxy settings
      PROXY_USE: config.PROXY_USE || 0,
      PROXY_TYPE: config.TYPE || 'socks5',
      PROXY_HOST: config.HOST || '',
      PROXY_PORT: config.PORT || '',
      PROXY_USER: config.USER || '',
      PROXY_PASS: config.PASS || '',

      // SMTP settings
      SMTP: config.SMTP || {}
    };
  }

  // SMTP Rotation Methods
  getCurrentSmtpConfig() {
    if (this.allSmtpConfigs.length === 0) return null;
    // Ensure currentSmtpIndex is within bounds, especially after loading state
    if (this.currentSmtpIndex >= this.allSmtpConfigs.length) {
      this.currentSmtpIndex = 0;
    }
    if (this.smtpRotationEnabled && this.allSmtpConfigs.length > 1) {
      return this.allSmtpConfigs[this.currentSmtpIndex];
    }
    return this.allSmtpConfigs[0];
  }

  getAllSmtpConfigs() {
    return this.allSmtpConfigs;
  }

  setSmtpRotationEnabled(enabled: boolean) {
    this.smtpRotationEnabled = enabled;
    this.saveRotationState();
  }

  isSmtpRotationEnabled() {
    return this.smtpRotationEnabled;
  }

  rotateToNextSmtp() {
    if (this.allSmtpConfigs.length <= 1) return null;
    this.currentSmtpIndex = (this.currentSmtpIndex + 1) % this.allSmtpConfigs.length;
    this.saveRotationState();
    return this.getCurrentSmtpConfig();
  }

  addSmtpConfig(smtpData: any) {
    const smtpPath = join(process.cwd(), 'config', 'smtp.ini');
    let content = '';

    if (existsSync(smtpPath)) {
      content = readFileSync(smtpPath, 'utf8');
    }

    // Find next available smtp index
    const existingIds = this.allSmtpConfigs.map(s => s.id);
    let nextIndex = 0;
    while (existingIds.includes(`smtp${nextIndex}`)) {
      nextIndex++;
    }

    const smtpId = `smtp${nextIndex}`;
    const newSection = `\n[${smtpId}]\nhost=${smtpData.host}\nport=${smtpData.port}\nuser=${smtpData.user}\npass=${smtpData.pass}\nfromEmail=${smtpData.fromEmail}\nfromName=${smtpData.fromName || ''}\n`;

    writeFileSync(smtpPath, content + newSection, 'utf8');
    this.loadConfig(); // Reload to include new SMTP
    return smtpId;
  }

  deleteSmtpConfig(smtpId: string) {
    const smtpPath = join(process.cwd(), 'config', 'smtp.ini');

    if (!existsSync(smtpPath)) return false;

    const content = readFileSync(smtpPath, 'utf8');
    const lines = content.split('\n');

    let inTargetSection = false;
    const filteredLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === `[${smtpId}]`) {
        inTargetSection = true;
        continue;
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']') && inTargetSection) {
        inTargetSection = false;
      }

      if (!inTargetSection) {
        filteredLines.push(line);
      }
    }

    writeFileSync(smtpPath, filteredLines.join('\n'), 'utf8');
    this.loadConfig(); // Reload after deletion

    // Reset current index if it's out of bounds
    if (this.currentSmtpIndex >= this.allSmtpConfigs.length) {
      this.currentSmtpIndex = 0;
      this.saveRotationState(); // Save state if index changed
    }

    return true;
  }
}

export const configService = new ConfigService();