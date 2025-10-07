
export {};

declare global {
  interface Window {
    electron?: {
      readFile: (filepath: string) => Promise<string>;
      writeFile: (filepath: string, content: string) => Promise<boolean>;
      listFiles: (dirpath: string) => Promise<string[]>;
      readConfig: (configDir: string) => Promise<{ setup?: string; smtp?: string }>;
      selectFile: () => Promise<string | null>;
      selectFiles: () => Promise<string[] | null>;
      loadConfig: () => Promise<{ success: boolean; config: any }>;
      loadLeads: () => Promise<{ success: boolean; leads: string }>;
      smtpList: () => Promise<{
        success: boolean;
        smtpConfigs: any[];
        currentSmtp: any;
        rotationEnabled: boolean;
      }>;
      smtpToggleRotation: (enabled: boolean) => Promise<{
        success: boolean;
        rotationEnabled: boolean;
      }>;
      minimize: () => void;
      close: () => void;
    };
    REPLIT_SERVER_URL?: string;
  }
}
