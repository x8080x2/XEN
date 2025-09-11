import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import os from 'os';
import { License } from '@shared/schema';

interface LicenseServiceConfig {
  jwtSecret: string;
  mainBackendUrl: string;
  apiKey: string;
  clientVersion: string;
}

export class MainLicenseService {
  private config: LicenseServiceConfig;
  private cachedLicense: License | null = null;
  private cachedToken: string | null = null;
  private lastValidation: Date | null = null;
  private validationInterval: number = 300000; // 5 minutes
  private machineFingerprint: string;

  constructor(config: LicenseServiceConfig) {
    this.config = config;
    this.machineFingerprint = this.generateMachineFingerprint();
  }

  /**
   * Generate machine fingerprint for license binding
   */
  private generateMachineFingerprint(): string {
    const components = [
      os.hostname(),
      os.platform(),
      os.arch(),
      JSON.stringify(os.cpus().map((cpu: any) => cpu.model)),
    ];
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Validate license with main backend
   */
  async validateLicense(licenseKey: string): Promise<{ 
    valid: boolean; 
    license?: License; 
    token?: string; 
    error?: string 
  }> {
    try {
      const response = await axios.post(
        `${this.config.mainBackendUrl}/api/license/validate`,
        {
          licenseKey,
          machineFingerprint: this.machineFingerprint,
          clientVersion: this.config.clientVersion,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.data.success) {
        const { license, token } = response.data;
        
        // Cache the license and token
        this.cachedLicense = license;
        this.cachedToken = token;
        this.lastValidation = new Date();

        console.log(`✅ License validated for ${license.userEmail} (${license.planType})`);
        
        return {
          valid: true,
          license,
          token,
        };
      } else {
        return {
          valid: false,
          error: response.data.error || 'License validation failed',
        };
      }
    } catch (error: any) {
      console.error('❌ License validation error:', error.message);
      return {
        valid: false,
        error: error.response?.data?.error || error.message || 'Connection to license server failed',
      };
    }
  }

  /**
   * Get current license status
   */
  async getCurrentLicense(forceRefresh = false): Promise<{ 
    valid: boolean; 
    license?: License; 
    token?: string; 
    error?: string 
  }> {
    // Check if we have a cached license and it's still valid
    if (!forceRefresh && this.cachedLicense && this.cachedToken && this.lastValidation) {
      const timeSinceValidation = Date.now() - this.lastValidation.getTime();
      
      if (timeSinceValidation < this.validationInterval) {
        // Check if license is still valid (not expired)
        if (new Date(this.cachedLicense.expiresAt) > new Date()) {
          return {
            valid: true,
            license: this.cachedLicense,
            token: this.cachedToken,
          };
        }
      }
    }

    // No valid cached license, need to re-validate
    if (this.cachedLicense?.licenseKey) {
      return await this.validateLicense(this.cachedLicense.licenseKey);
    }

    return {
      valid: false,
      error: 'No license configured',
    };
  }

  /**
   * Check if license allows specific feature
   */
  hasFeature(feature: keyof License['features']): boolean {
    if (!this.cachedLicense) {
      return false;
    }

    return Boolean(this.cachedLicense.features[feature]);
  }

  /**
   * Check email usage limits
   */
  checkEmailLimits(recipientCount: number): { 
    allowed: boolean; 
    reason?: string; 
    remaining?: number 
  } {
    if (!this.cachedLicense) {
      return {
        allowed: false,
        reason: 'No valid license',
      };
    }

    const { maxEmailsPerMonth, maxRecipientsPerEmail } = this.cachedLicense.features;
    const { emailsUsedThisMonth } = this.cachedLicense;

    // Check recipients per email limit
    if (recipientCount > maxRecipientsPerEmail) {
      return {
        allowed: false,
        reason: `Too many recipients. Maximum ${maxRecipientsPerEmail} allowed per email.`,
      };
    }

    // Check monthly email limit
    const remainingEmails = maxEmailsPerMonth - emailsUsedThisMonth;
    if (remainingEmails < recipientCount) {
      return {
        allowed: false,
        reason: `Monthly email limit exceeded. ${remainingEmails} emails remaining.`,
        remaining: remainingEmails,
      };
    }

    return {
      allowed: true,
      remaining: remainingEmails,
    };
  }

  /**
   * Get cached token for API requests
   */
  getAuthToken(): string | null {
    return this.cachedToken;
  }

  /**
   * Check if license is for specific plan types
   */
  isPlanType(planType: License['planType']): boolean {
    return this.cachedLicense?.planType === planType;
  }

  /**
   * Get usage summary
   */
  getUsageSummary() {
    if (!this.cachedLicense) {
      return null;
    }

    const { features, emailsUsedThisMonth } = this.cachedLicense;
    
    return {
      plan: this.cachedLicense.planType,
      emailsUsed: emailsUsedThisMonth,
      emailsLimit: features.maxEmailsPerMonth,
      emailsRemaining: features.maxEmailsPerMonth - emailsUsedThisMonth,
      recipientsPerEmail: features.maxRecipientsPerEmail,
      features: {
        qrCodes: features.allowQRCodes,
        attachments: features.allowAttachments,
        domainLogos: features.allowDomainLogos,
        htmlConvert: features.allowHTMLConvert,
        smtpRotation: features.smtpRotation,
        apiAccess: features.apiAccess,
      },
      expiresAt: this.cachedLicense.expiresAt,
    };
  }
}

// Singleton instance for the main license service
let mainLicenseService: MainLicenseService | null = null;

/**
 * Initialize the main license service
 */
export function initializeMainLicenseService(config: LicenseServiceConfig): void {
  mainLicenseService = new MainLicenseService(config);
}

/**
 * Get the initialized license service
 */
export function getMainLicenseService(): MainLicenseService {
  if (!mainLicenseService) {
    throw new Error('Main license service not initialized. Call initializeMainLicenseService() first.');
  }
  return mainLicenseService;
}