declare global {
  interface Window {
    electronAPI?: {
      onAdminBroadcast: (callback: (data: { id: string; message: string; timestamp: number }) => void) => void;
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
      smtpTest: () => Promise<{ online: boolean; smtp?: any; error?: string }>;
      fileUpload: (sourceFilePath: string) => Promise<{ id?: string; originalName?: string; filename?: string; path?: string; size?: number; mimeType?: string; uploadedAt?: Date; success?: boolean; error?: string }>;
      getServerUrl: () => string | undefined;

      // NOTE: Email sending and AI operations now use backend API via replitApiService
      // sendEmail, getEmailProgress, cancelEmail, and AI features have been removed
      // Desktop app connects to backend server for email processing and AI features
    };
  }
}

export {};