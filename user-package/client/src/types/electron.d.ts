
declare global {
  interface Window {
    electronAPI?: {
      readFile: (filepath: string) => Promise<string>;
      writeFile: (filepath: string, content: string) => Promise<boolean>;
      listFiles: (dirpath: string) => Promise<string[]>;
      readConfig: (configDir: string) => Promise<any>;
      selectFile: () => Promise<string | null>;
      selectFiles: () => Promise<string[] | null>;
      // Mode 1 - Local file access methods
      loadConfig: () => Promise<any>;
      loadLeads: () => Promise<any>;
      smtpList: () => Promise<any>;
      smtpToggleRotation: (enabled: boolean) => Promise<{ success: boolean; rotationEnabled: boolean; currentSmtp?: any }>;
      smtpAdd: (smtpData: { host: string; port: string; user: string; pass: string; fromEmail: string; fromName?: string }) => Promise<{ success: boolean; smtpId?: string; smtpConfigs?: any[]; currentSmtp?: any; error?: string }>;
      smtpDelete: (smtpId: string) => Promise<{ success: boolean; smtpConfigs?: any[]; currentSmtp?: any; error?: string }>;
      smtpRotate: () => Promise<{ success: boolean; currentSmtp?: any; rotationEnabled?: boolean; error?: string }>;
      fileUpload: (sourceFilePath: string) => Promise<{ success: boolean; filename?: string; path?: string; size?: number; mimetype?: string; error?: string }>;
    };
  }
}

export {};
