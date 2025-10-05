export interface LicenseVerificationResult {
  valid: boolean;
  message: string;
  license?: {
    expiresAt?: string;
    isActive?: boolean;
    metadata?: Record<string, any>;
  };
}

class LicenseService {
  private licenseKey: string | null = null;
  private serverUrl: string | null = null;
  private lastVerificationResult: LicenseVerificationResult | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    this.licenseKey = localStorage.getItem('license_key');
    this.serverUrl = localStorage.getItem('replit_server_url');
  }

  getLicenseKey(): string | null {
    if (!this.licenseKey) {
      this.loadFromStorage();
    }
    return this.licenseKey;
  }

  setLicenseKey(key: string): void {
    this.licenseKey = key;
    localStorage.setItem('license_key', key);
  }

  getServerUrl(): string | null {
    if (!this.serverUrl) {
      this.loadFromStorage();
    }
    return this.serverUrl;
  }

  hasLicense(): boolean {
    return !!this.getLicenseKey();
  }

  hasServerUrl(): boolean {
    return !!this.getServerUrl();
  }

  isConfigured(): boolean {
    return this.hasLicense() && this.hasServerUrl();
  }

  getLastVerificationResult(): LicenseVerificationResult | null {
    return this.lastVerificationResult;
  }

  async verifyLicense(): Promise<LicenseVerificationResult> {
    const licenseKey = this.getLicenseKey();
    const serverUrl = this.getServerUrl();

    if (!licenseKey) {
      this.lastVerificationResult = {
        valid: false,
        message: "No license key configured. Please add your license key in settings."
      };
      return this.lastVerificationResult;
    }

    if (!serverUrl) {
      this.lastVerificationResult = {
        valid: false,
        message: "No server URL configured. Please add the Replit server URL in settings."
      };
      return this.lastVerificationResult;
    }

    try {
      const response = await fetch(`${serverUrl}/api/license/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey })
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.lastVerificationResult = {
          valid: false,
          message: errorData.message || "License verification failed"
        };
        return this.lastVerificationResult;
      }

      const result = await response.json();
      this.lastVerificationResult = result;
      return result;
    } catch (error) {
      console.error('[LicenseService] Verification error:', error);
      this.lastVerificationResult = {
        valid: false,
        message: "Failed to connect to license server. Please check your server URL and internet connection."
      };
      return this.lastVerificationResult;
    }
  }

  clearLicense(): void {
    this.licenseKey = null;
    this.lastVerificationResult = null;
    localStorage.removeItem('license_key');
  }

  clearAll(): void {
    this.licenseKey = null;
    this.serverUrl = null;
    this.lastVerificationResult = null;
    localStorage.removeItem('license_key');
    localStorage.removeItem('replit_server_url');
  }
}

export const licenseService = new LicenseService();
