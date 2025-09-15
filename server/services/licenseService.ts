
export class LicenseService {
  constructor() {
    // No initialization needed for free version
  }

  /**
   * Always return valid for free access
   */
  async validateLicense(licenseKey: string): Promise<{ 
    valid: boolean; 
    license?: any; 
    token?: string; 
    error?: string 
  }> {
    return {
      valid: true,
      license: {
        licenseKey: 'FREE-ACCESS',
        planType: 'free',
        features: {
          maxEmailsPerMonth: 999999,
          maxRecipientsPerEmail: 999999,
          allowQRCodes: true,
          allowAttachments: true,
          allowDomainLogos: true,
          allowHTMLConvert: true,
          smtpRotation: true,
          apiAccess: true,
        },
        emailsUsedThisMonth: 0,
        status: 'active',
        expiresAt: new Date('2099-12-31'),
      },
      token: 'free-access-token',
    };
  }

  /**
   * Always return valid for free access
   */
  async getCurrentLicense(): Promise<{ 
    valid: boolean; 
    license?: any; 
    token?: string; 
    error?: string 
  }> {
    return this.validateLicense('FREE-ACCESS');
  }

  /**
   * All features available in free version
   */
  hasFeature(feature: string): boolean {
    return true;
  }

  /**
   * No email limits in free version
   */
  checkEmailLimits(recipientCount: number): { 
    allowed: boolean; 
    reason?: string; 
    remaining?: number 
  } {
    return {
      allowed: true,
      remaining: 999999,
    };
  }

  /**
   * No usage recording needed for free version
   */
  async recordEmailUsage(recipientCount: number): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  /**
   * Return free license status
   */
  getLicenseStatus() {
    return {
      isValid: true,
      planType: 'free',
      emailsUsed: 0,
      emailsRemaining: 999999,
      features: {
        maxEmailsPerMonth: 999999,
        maxRecipientsPerEmail: 999999,
        allowQRCodes: true,
        allowAttachments: true,
        allowDomainLogos: true,
        allowHTMLConvert: true,
        smtpRotation: true,
        apiAccess: true,
      },
    };
  }

  /**
   * No cache to clear for free version
   */
  clearCache(): void {
    // Nothing to clear
  }
}

// Singleton instance
let licenseServiceInstance: LicenseService | null = null;

export function initializeLicenseService(): LicenseService {
  licenseServiceInstance = new LicenseService();
  return licenseServiceInstance;
}

export function getLicenseService(): LicenseService {
  if (!licenseServiceInstance) {
    licenseServiceInstance = new LicenseService();
  }
  return licenseServiceInstance;
}

export { licenseServiceInstance };
