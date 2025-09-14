
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class ConfigService {
  private configData: any = {};

  loadLocalConfig(): any {
    const configPath = join(process.cwd(), 'config', 'setup.ini');
    const smtpPath = join(process.cwd(), 'config', 'smtp.ini');

    try {
      // Load setup.ini
      if (existsSync(configPath)) {
        const setupContent = readFileSync(configPath, 'utf8');
        const setupConfig = this.parseIniFile(setupContent);
        Object.assign(this.configData, setupConfig.CONFIG || {});
      }

      // Load smtp.ini
      if (existsSync(smtpPath)) {
        const smtpContent = readFileSync(smtpPath, 'utf8');
        const smtpConfig = this.parseIniFile(smtpContent);
        if (smtpConfig.smtp0) {
          this.configData.SMTP = smtpConfig.smtp0;
        }
      }

      console.log('[User Package ConfigService] Local configuration loaded');
      return this.configData;
    } catch (error) {
      console.error('[User Package ConfigService] Failed to load local config:', error);
      return {};
    }
  }

  loadLocalLeads(): string {
    const leadsPath = join(process.cwd(), 'files', 'leads.txt');
    try {
      if (existsSync(leadsPath)) {
        const leads = readFileSync(leadsPath, 'utf8').trim();
        console.log('[User Package ConfigService] Local leads loaded');
        return leads;
      }
    } catch (error) {
      console.error('[User Package ConfigService] Failed to load local leads:', error);
    }
    return '';
  }

  private parseIniFile(content: string): any {
    const result: any = {};
    let currentSection = '';

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
        continue;
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        result[currentSection] = {};
        continue;
      }

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

  private parseValue(value: string): any {
    if (value === '') return '';
    if (value === '0') return 0;
    if (value === '1') return 1;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }
}

export const configService = new ConfigService();
