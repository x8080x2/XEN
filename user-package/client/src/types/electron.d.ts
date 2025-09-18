
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
    };
  }
}

export {};
