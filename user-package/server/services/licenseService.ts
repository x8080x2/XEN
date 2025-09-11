import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { 
  License, 
  LicenseToken, 
  LicenseValidation, 
  licenseTokenSchema,
  licenseValidationSchema 
} from '@shared/schema';

interface LicenseServiceConfig {
  jwtSecret: string;
  mainBackendUrl: string;
  apiKey: string;
  clientVersion: string;
}

export class LicenseService {
  private config: LicenseServiceConfig;
  private cachedLicense: License | null = null;
  private cachedToken: string | null = null;
  private lastValidation: Date | null = null;
  private validationInterval: number = 300000; // 5 minutes

  constructor(config: LicenseServiceConfig) {
    this.config = config;
  }

  /**
   * Generate machine fingerprint for license binding
   */
  generateMachineFingerprint(): string {
    const os = require('os');
    const components = [
      os.hostname(),
      os.platform(),
      os.arch(),
      JSON.stringify(os.cpus().map((cpu: any) => cpu.model)),
      JSON.stringify(os.networkInterfaces()),
    ];
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Get client IP address
   */
  private async getClientIP(): Promise<string> {
    try {
      const axios = require('axios');
      // Try to get public IP from external service
      const response = await axios.get('https://api.ipify.org?format=json', {
        timeout: 5000,
      });
      return response.data.ip;
    } catch (error) {
      // Fallback to getting local network IP
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      for (const name of Object.keys(networkInterfaces)) {
        const iface = networkInterfaces[name];
        if (iface) {
          for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
              return alias.address;
            }
          }
        }
      }
      return '127.0.0.1'; // Last resort fallback
    }
  }

  /**
   * Validate license with main backend
   */
  async validateLicense(licenseKey: string, machineFingerprint?: string): Promise<{ 
    valid: boolean; 
    license?: License; 
    token?: string; 
    error?: string 
  }> {
    try {
      const clientIP = await this.getClientIP();
      
      const validation: LicenseValidation = {
        licenseKey,
        machineFingerprint: machineFingerprint || this.generateMachineFingerprint(),
        ipAddress: clientIP,
        clientVersion: this.config.clientVersion,
      };

      // Validate request data
      licenseValidationSchema.parse(validation);

      const response = await axios.post(
        `${this.config.mainBackendUrl}/api/license/validate`,
        validation,
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
      console.error('License validation error:', error.message);
      return {
        valid: false,
        error: error.response?.data?.error || error.message || 'Connection to license server failed',
      };
    }
  }

  /**
   * Verify JWT token locally
   */
  verifyToken(token: string): { valid: boolean; payload?: LicenseToken; error?: string } {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      // Validate token structure
      const payload = licenseTokenSchema.parse(decoded);
      
      // Check expiration
      if (payload.expiresAt < Date.now()) {
        return {
          valid: false,
          error: 'License has expired',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid token',
      };
    }
  }

  /**
   * Get current license status
   */
  async getCurrentLicense(): Promise<{ 
    valid: boolean; 
    license?: License; 
    token?: string; 
    error?: string 
  }> {
    // Check if we have a cached license and it's still valid
    if (this.cachedLicense && this.cachedToken && this.lastValidation) {
      const timeSinceValidation = Date.now() - this.lastValidation.getTime();
      
      if (timeSinceValidation < this.validationInterval) {
        // Verify the cached token is still valid
        const tokenCheck = this.verifyToken(this.cachedToken);
        if (tokenCheck.valid) {
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
   * Record email usage
   */
  async recordEmailUsage(recipientCount: number): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.cachedLicense || !this.cachedToken) {
        return {
          success: false,
          error: 'No valid license',
        };
      }

      const response = await axios.post(
        `${this.config.mainBackendUrl}/api/license/usage`,
        {
          action: 'email_sent',
          count: recipientCount,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.cachedToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      if (response.data.success) {
        // Update cached usage count
        this.cachedLicense.emailsUsedThisMonth += recipientCount;
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to record usage',
        };
      }
    } catch (error: any) {
      console.error('Usage recording error:', error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to record usage',
      };
    }
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
    error?: string;
  } {
    if (!this.cachedLicense) {
      return {
        isValid: false,
        error: 'No license loaded',
      };
    }

    const isExpired = this.cachedLicense.expiresAt < new Date();
    const isActive = this.cachedLicense.status === 'active';

    return {
      isValid: isActive && !isExpired,
      planType: this.cachedLicense.planType,
      expiresAt: this.cachedLicense.expiresAt,
      emailsUsed: this.cachedLicense.emailsUsedThisMonth,
      emailsRemaining: this.cachedLicense.features.maxEmailsPerMonth - this.cachedLicense.emailsUsedThisMonth,
      features: this.cachedLicense.features,
      error: isExpired ? 'License has expired' : !isActive ? 'License is not active' : undefined,
    };
  }

  /**
   * Clear cached license (for logout/license change)
   */
  clearCache(): void {
    this.cachedLicense = null;
    this.cachedToken = null;
    this.lastValidation = null;
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

export { licenseServiceInstance };