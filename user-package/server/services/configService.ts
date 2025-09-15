
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export class ConfigService {
  private configData: any = {};
  private smtpConfigs: any[] = [];
  private currentSmtpIndex: number = 0;
  private rotationEnabled: boolean = false;

  constructor() {
    // Auto-load config on initialization
    this.loadLocalConfig();
    console.log('[User Package ConfigService] Constructor - Configuration auto-loaded');
  }

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
        
        // Load all SMTP configs for rotation
        const smtpKeys = Object.keys(smtpConfig).filter(key => key.startsWith('smtp'));
        this.smtpConfigs = smtpKeys.map(key => ({ 
          id: key, 
          ...smtpConfig[key],
          host: smtpConfig[key].host || '',
          port: smtpConfig[key].port || '587',
          user: smtpConfig[key].user || '',
          pass: smtpConfig[key].pass || '',
          fromEmail: smtpConfig[key].fromEmail || '',
          fromName: smtpConfig[key].fromName || ''
        }));
        
        if (smtpConfig.smtp0) {
          this.configData.SMTP = smtpConfig.smtp0;
        }
        
        console.log(`[User Package ConfigService] Loaded ${this.smtpConfigs.length} SMTP configs from ${smtpPath}`);
      } else {
        console.warn(`[User Package ConfigService] SMTP config file not found: ${smtpPath}`);
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
        const leadCount = leads.split('\n').filter(line => line.trim()).length;
        console.log(`[User Package ConfigService] Loaded ${leadCount} leads from ${leadsPath}`);
        return leads;
      } else {
        console.warn(`[User Package ConfigService] Leads file not found: ${leadsPath}`);
      }
    } catch (error) {
      console.error('[User Package ConfigService] Failed to load local leads:', error);
    }
    return '';
  }

  // Enhanced file system access methods
  readAnyFile(relativePath: string): string | null {
    try {
      const fullPath = join(process.cwd(), relativePath);
      
      // Security check: ensure we stay within project directory
      const resolvedPath = require('path').resolve(fullPath);
      const projectRoot = require('path').resolve(process.cwd());
      if (!resolvedPath.startsWith(projectRoot)) {
        throw new Error('Access denied: Outside project directory');
      }

      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf8');
        console.log(`[User Package ConfigService] File loaded: ${relativePath}`);
        return content;
      }
    } catch (error) {
      console.error(`[User Package ConfigService] Failed to read file ${relativePath}:`, error);
    }
    return null;
  }

  listDirectory(relativePath: string = ''): Array<{name: string, type: string, path: string}> | null {
    try {
      const fullPath = relativePath ? join(process.cwd(), relativePath) : process.cwd();
      
      // Security check
      const resolvedPath = require('path').resolve(fullPath);
      const projectRoot = require('path').resolve(process.cwd());
      if (!resolvedPath.startsWith(projectRoot)) {
        throw new Error('Access denied: Outside project directory');
      }

      if (existsSync(fullPath)) {
        const { readdirSync, statSync } = require('fs');
        const items = readdirSync(fullPath);
        
        return items.map((item: any) => {
          const itemPath = join(fullPath, item);
          const stats = statSync(itemPath);
          return {
            name: item,
            type: stats.isDirectory() ? 'directory' : 'file',
            path: join(relativePath, item)
          };
        });
      }
    } catch (error) {
      console.error(`[User Package ConfigService] Failed to list directory ${relativePath}:`, error);
    }
    return null;
  }

  getProjectStructure(): any {
    try {
      const structure = this.buildDirectoryTree(process.cwd(), '');
      console.log('[User Package ConfigService] Project structure built');
      return structure;
    } catch (error) {
      console.error('[User Package ConfigService] Failed to build project structure:', error);
      return null;
    }
  }

  private buildDirectoryTree(fullPath: string, relativePath: string, maxDepth: number = 3, currentDepth: number = 0): any {
    if (currentDepth >= maxDepth) return null;
    
    try {
      const { readdirSync, statSync } = require('fs');
      const items = readdirSync(fullPath);
      const result: any = {
        name: require('path').basename(fullPath) || 'root',
        type: 'directory',
        path: relativePath,
        children: []
      };

      for (const item of items) {
        // Skip hidden files and node_modules
        if (item.startsWith('.') || item === 'node_modules') continue;
        
        const itemFullPath = join(fullPath, item);
        const itemRelativePath = join(relativePath, item);
        const stats = statSync(itemFullPath);
        
        if (stats.isDirectory()) {
          const subtree = this.buildDirectoryTree(itemFullPath, itemRelativePath, maxDepth, currentDepth + 1);
          if (subtree) {
            result.children.push(subtree);
          }
        } else {
          result.children.push({
            name: item,
            type: 'file',
            path: itemRelativePath,
            size: stats.size
          });
        }
      }

      return result;
    } catch (error) {
      return null;
    }
  }

  // Enhanced config file discovery
  findConfigFiles(): Array<{path: string, type: string}> {
    const configFiles: Array<{path: string, type: string}> = [];
    
    // Standard config locations
    const configLocations = [
      { dir: 'config', types: ['.ini', '.conf', '.cfg'] },
      { dir: 'files', types: ['.txt', '.csv'] },
      { dir: '.', types: ['.env', '.ini', '.json'] }
    ];

    for (const location of configLocations) {
      try {
        const dirPath = join(process.cwd(), location.dir);
        if (existsSync(dirPath)) {
          const { readdirSync, statSync } = require('fs');
          const items = readdirSync(dirPath);
          
          for (const item of items) {
            const itemPath = join(dirPath, item);
            const stats = statSync(itemPath);
            
            if (stats.isFile()) {
              for (const type of location.types) {
                if (item.toLowerCase().endsWith(type)) {
                  const relativePath = join(location.dir === '.' ? '' : location.dir, item);
                  configFiles.push({
                    path: relativePath,
                    type: type.substring(1) // Remove dot
                  });
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`[User Package ConfigService] Failed to scan ${location.dir}:`, error);
      }
    }

    return configFiles;
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

  // SMTP Management Methods
  getAllSmtpConfigs(): any[] {
    return this.smtpConfigs || [];
  }

  getCurrentSmtpConfig(): any {
    if (this.smtpConfigs.length === 0) return null;
    return this.smtpConfigs[this.currentSmtpIndex] || this.smtpConfigs[0];
  }

  isSmtpRotationEnabled(): boolean {
    return this.rotationEnabled;
  }

  setSmtpRotation(enabled: boolean): void {
    this.rotationEnabled = enabled;
  }

  rotateSmtp(): any {
    if (this.smtpConfigs.length <= 1) return this.getCurrentSmtpConfig();
    
    this.currentSmtpIndex = (this.currentSmtpIndex + 1) % this.smtpConfigs.length;
    return this.getCurrentSmtpConfig();
  }

  addSmtpConfig(config: any): string {
    const smtpPath = join(process.cwd(), 'config', 'smtp.ini');
    let content = '';
    
    if (existsSync(smtpPath)) {
      content = readFileSync(smtpPath, 'utf8');
    }
    
    // Find next available smtp index
    const existingIds = this.smtpConfigs.map(s => s.id);
    let nextIndex = 0;
    while (existingIds.includes(`smtp${nextIndex}`)) {
      nextIndex++;
    }
    
    const smtpId = `smtp${nextIndex}`;
    const newSection = `\n[${smtpId}]\nhost=${config.host}\nport=${config.port}\nuser=${config.user}\npass=${config.pass}\nfromEmail=${config.fromEmail}\nfromName=${config.fromName || ''}\n`;
    
    writeFileSync(smtpPath, content + newSection, 'utf8');
    this.loadLocalConfig(); // Reload to include new SMTP
    console.log(`[User Package ConfigService] Added SMTP config: ${smtpId}`);
    return smtpId;
  }

  deleteSmtpConfig(smtpId: string): boolean {
    if (this.smtpConfigs.length <= 1) return false;
    
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
    this.loadLocalConfig(); // Reload after deletion
    
    // Adjust current index if needed
    if (this.currentSmtpIndex >= this.smtpConfigs.length) {
      this.currentSmtpIndex = 0;
    }
    
    console.log(`[User Package ConfigService] Deleted SMTP config: ${smtpId}`);
    return true;
  }
}

export const configService = new ConfigService();
