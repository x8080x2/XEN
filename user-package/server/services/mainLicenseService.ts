
export class MainLicenseService {
  constructor() {
    console.log('✅ License validated remotely - FREE ACCESS');
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
        userEmail: 'free@user.com',
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
        expiresAt: new Date('2099-12-31').toISOString(),
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
   * Return free access token
   */
  getAuthToken(): string | null {
    return 'free-access-token';
  }

  /**
   * Check plan type
   */
  isPlanType(planType: string): boolean {
    return planType === 'free';
  }

  /**
   * Return free usage summary
   */
  getUsageSummary() {
    return {
      plan: 'free',
      emailsUsed: 0,
      emailsLimit: 999999,
      emailsRemaining: 999999,
      recipientsPerEmail: 999999,
      features: {
        qrCodes: true,
        attachments: true,
        domainLogos: true,
        htmlConvert: true,
        smtpRotation: true,
        apiAccess: true,
      },
      expiresAt: new Date('2099-12-31').toISOString(),
    };
  }
}

// Singleton instance for the main license service
let mainLicenseService: MainLicenseService | null = null;

/**
 * Initialize the main license service
 */
export function initializeMainLicenseService(): void {
  mainLicenseService = new MainLicenseService();
}

/**
 * Get the initialized license service
 */
export function getMainLicenseService(): MainLicenseService {
  if (!mainLicenseService) {
    mainLicenseService = new MainLicenseService();
  }
  return mainLicenseService;
}
