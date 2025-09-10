import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import os from 'os';

interface LicenseServiceConfig {
  jwtSecret: string;
  mainBackendUrl: string;
  apiKey: string;
  clientVersion: string;
}

interface License {
  id: string;
  licenseKey: string;
  userId: string;
  userEmail: string;
  userName: string;
  planType: 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  features: {
    maxEmailsPerMonth: number;
    maxRecipientsPerEmail: number;
    allowQRCodes: boolean;
    allowAttachments: boolean;
    allowDomainLogos: boolean;
    allowHTMLConvert: boolean;
    smtpRotation: boolean;
    apiAccess: boolean;
  };
  emailsUsedThisMonth: number;
  expiresAt: Date;
}

export class LicenseService {
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
      JSON.stringify(os.cpus().map(cpu => cpu.model)),
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
      remaining: remainingEmails - recipientCount,
    };
  }

  /**
   * Get license status information
   */
  getLicenseStatus(): {
    isValid: boolean;
    planType?: string;
    expiresAt?: Date;
    emailsUsed?: number;
    emailsRemaining?: number;
    features?: License['features'];
    userEmail?: string;
    userName?: string;
    error?: string;
  } {
    if (!this.cachedLicense) {
      return {
        isValid: false,
        error: 'No license loaded',
      };
    }

    const isExpired = new Date(this.cachedLicense.expiresAt) < new Date();
    const isActive = this.cachedLicense.status === 'active';

    return {
      isValid: isActive && !isExpired,
      planType: this.cachedLicense.planType,
      expiresAt: this.cachedLicense.expiresAt,
      emailsUsed: this.cachedLicense.emailsUsedThisMonth,
      emailsRemaining: this.cachedLicense.features.maxEmailsPerMonth - this.cachedLicense.emailsUsedThisMonth,
      features: this.cachedLicense.features,
      userEmail: this.cachedLicense.userEmail,
      userName: this.cachedLicense.userName,
      error: isExpired ? 'License has expired' : !isActive ? 'License is not active' : undefined,
    };
  }

  /**
   * Get authentication token for main backend
   */
  getAuthToken(): string | null {
    return this.cachedToken;
  }

  /**
   * Clear cached license (for logout/license change)
   */
  clearCache(): void {
    this.cachedLicense = null;
    this.cachedToken = null;
    this.lastValidation = null;
  }

  /**
   * Get machine fingerprint
   */
  getMachineFingerprint(): string {
    return this.machineFingerprint;
  }
}

// Singleton instance
let licenseServiceInstance: LicenseService | null = null;

export function initializeLicenseService(config: LicenseServiceConfig): LicenseService {
  licenseServiceInstance = new LicenseService(config);
  return licenseServiceInstance;
}

export function getLicenseService(): LicenseService {
  if (!licenseServiceInstance) {
    throw new Error('License service not initialized. Call initializeLicenseService first.');
  }
  return licenseServiceInstance;
}