import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, normalize, sep } from 'path';

export class WindowsFileService {
  private projectRoot: string;

  constructor() {
    this.projectRoot = resolve(process.cwd());
  }

  // Windows-compatible path normalization
  private normalizePath(filePath: string): string {
    return normalize(filePath).replace(/\\/g, '/');
  }

  // Enhanced security check for Windows
  private isWithinProject(targetPath: string): boolean {
    const resolvedTarget = resolve(targetPath);
    const normalizedTarget = this.normalizePath(resolvedTarget);
    const normalizedRoot = this.normalizePath(this.projectRoot);
    
    return normalizedTarget.startsWith(normalizedRoot);
  }

  // Read any file with Windows path support
  readFile(relativePath: string): { success: boolean; content?: string; error?: string; info?: any } {
    try {
      // Handle both forward and backward slashes
      const cleanPath = relativePath.replace(/\\/g, '/');
      const fullPath = join(this.projectRoot, cleanPath);
      
      if (!this.isWithinProject(fullPath)) {
        return { success: false, error: 'Access denied: Outside project directory' };
      }

      if (!existsSync(fullPath)) {
        return { success: false, error: `File not found: ${cleanPath}` };
      }

      const stats = statSync(fullPath);
      if (!stats.isFile()) {
        return { success: false, error: 'Path is not a file' };
      }

      const content = readFileSync(fullPath, 'utf8');
      return { 
        success: true, 
        content,
        info: {
          path: cleanPath,
          size: stats.size,
          modified: stats.mtime
        }
      };
    } catch (error: any) {
      return { success: false, error: `Failed to read file: ${error.message}` };
    }
  }

  // List directory contents with Windows support
  listDirectory(relativePath: string = ''): { success: boolean; items?: Array<any>; error?: string } {
    try {
      const cleanPath = relativePath.replace(/\\/g, '/');
      const fullPath = cleanPath ? join(this.projectRoot, cleanPath) : this.projectRoot;
      
      if (!this.isWithinProject(fullPath)) {
        return { success: false, error: 'Access denied: Outside project directory' };
      }

      if (!existsSync(fullPath)) {
        return { success: false, error: 'Directory not found' };
      }

      const items = readdirSync(fullPath);
      const result = items.map(item => {
        const itemPath = join(fullPath, item);
        const stats = statSync(itemPath);
        const relativeName = cleanPath ? `${cleanPath}/${item}` : item;
        
        return {
          name: item,
          type: stats.isDirectory() ? 'directory' : 'file',
          path: relativeName,
          size: stats.isFile() ? stats.size : undefined,
          modified: stats.mtime
        };
      });

      return { success: true, items: result };
    } catch (error: any) {
      return { success: false, error: `Failed to list directory: ${error.message}` };
    }
  }

  // Load SMTP configurations specifically
  loadSmtpConfigs(): { success: boolean; configs?: any[]; error?: string } {
    try {
      const smtpPath = join(this.projectRoot, 'config', 'smtp.ini');
      
      if (!existsSync(smtpPath)) {
        return { success: false, error: 'SMTP config file not found at config/smtp.ini' };
      }

      const content = readFileSync(smtpPath, 'utf8');
      const configs = this.parseIniFile(content);
      
      // Convert to array format
      const smtpConfigs = Object.keys(configs)
        .filter(key => key.startsWith('smtp'))
        .map(key => ({
          id: key,
          ...configs[key],
          host: configs[key].host || '',
          port: parseInt(configs[key].port) || 587,
          user: configs[key].user || '',
          pass: configs[key].pass || '',
          fromEmail: configs[key].fromEmail || '',
          fromName: configs[key].fromName || ''
        }));

      return { success: true, configs: smtpConfigs };
    } catch (error: any) {
      return { success: false, error: `Failed to load SMTP configs: ${error.message}` };
    }
  }

  // Load setup configuration
  loadSetupConfig(): { success: boolean; config?: any; error?: string } {
    try {
      const setupPath = join(this.projectRoot, 'config', 'setup.ini');
      
      if (!existsSync(setupPath)) {
        return { success: false, error: 'Setup config file not found at config/setup.ini' };
      }

      const content = readFileSync(setupPath, 'utf8');
      const config = this.parseIniFile(content);
      
      return { success: true, config: config.CONFIG || config };
    } catch (error: any) {
      return { success: false, error: `Failed to load setup config: ${error.message}` };
    }
  }

  // Load leads file
  loadLeads(): { success: boolean; leads?: string; error?: string } {
    try {
      const leadsPath = join(this.projectRoot, 'files', 'leads.txt');
      
      if (!existsSync(leadsPath)) {
        return { success: false, error: 'Leads file not found at files/leads.txt' };
      }

      const content = readFileSync(leadsPath, 'utf8').trim();
      return { success: true, leads: content };
    } catch (error: any) {
      return { success: false, error: `Failed to load leads: ${error.message}` };
    }
  }

  // Find all config files in the project
  findAllConfigs(): { success: boolean; files?: Array<any>; error?: string } {
    try {
      const configFiles: Array<any> = [];
      
      // Check common config locations
      const locations = [
        { dir: 'config', extensions: ['.ini', '.conf', '.cfg'] },
        { dir: 'files', extensions: ['.txt', '.csv'] },
        { dir: '', extensions: ['.env', '.ini', '.json'] }
      ];

      for (const location of locations) {
        const dirPath = location.dir ? join(this.projectRoot, location.dir) : this.projectRoot;
        
        if (existsSync(dirPath)) {
          const items = readdirSync(dirPath);
          
          for (const item of items) {
            const itemPath = join(dirPath, item);
            const stats = statSync(itemPath);
            
            if (stats.isFile()) {
              for (const ext of location.extensions) {
                if (item.toLowerCase().endsWith(ext)) {
                  const relativePath = location.dir ? `${location.dir}/${item}` : item;
                  configFiles.push({
                    name: item,
                    path: relativePath,
                    type: ext.substring(1),
                    size: stats.size,
                    modified: stats.mtime
                  });
                  break;
                }
              }
            }
          }
        }
      }

      return { success: true, files: configFiles };
    } catch (error: any) {
      return { success: false, error: `Failed to find config files: ${error.message}` };
    }
  }

  // Parse INI file format
  private parseIniFile(content: string): any {
    const result: any = {};
    let currentSection = '';

    const lines = content.split(/\r?\n/); // Handle both Windows and Unix line endings
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

export const windowsFileService = new WindowsFileService();