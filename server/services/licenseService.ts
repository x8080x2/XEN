import { storage } from '../storage';
import type { License, InsertLicense } from '@shared/schema';
import { randomBytes } from 'crypto';

class LicenseService {
  generateLicenseKey(): string {
    return randomBytes(16).toString('hex').toUpperCase();
  }

  async createLicense(
    telegramUserId?: string,
    telegramUsername?: string,
    durationDays?: number
  ): Promise<License> {
    const licenseKey = this.generateLicenseKey();
    
    const insertLicense: InsertLicense = {
      licenseKey,
      telegramUserId,
      telegramUsername,
      status: 'active',
      expiresAt: durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : undefined,
    };

    return await storage.createLicense(insertLicense);
  }

  async checkLicenseStatus(
    licenseKey: string
  ): Promise<{ valid: boolean; license?: License; reason?: string }> {
    const license = await storage.getLicenseByKey(licenseKey);

    if (!license) {
      return { valid: false, reason: 'License not found' };
    }

    if (license.status === 'revoked') {
      return { valid: false, license, reason: 'License has been revoked' };
    }

    if (license.status === 'expired') {
      return { valid: false, license, reason: 'License has expired' };
    }

    if (license.expiresAt && new Date() > license.expiresAt) {
      return { valid: false, license, reason: 'License has expired' };
    }

    // For status checks, return valid if license is active (no hardware binding check)
    return { valid: true, license };
  }

  async verifyLicense(
    licenseKey: string, 
    hardwareId?: string
  ): Promise<{ valid: boolean; license?: License; reason?: string }> {
    const license = await storage.getLicenseByKey(licenseKey);

    if (!license) {
      return { valid: false, reason: 'License not found' };
    }

    if (license.status === 'revoked') {
      return { valid: false, license, reason: 'License has been revoked' };
    }

    if (license.status === 'expired') {
      return { valid: false, license, reason: 'License has expired' };
    }

    if (license.expiresAt && new Date() > license.expiresAt) {
      await storage.updateLicense(license.id, { status: 'expired' });
      return { valid: false, license, reason: 'License has expired' };
    }

    // If no hardware ID provided (e.g., Telegram bot download), just verify license is active
    if (!hardwareId) {
      console.log(`[License] License ${licenseKey} verified without hardware ID (Telegram download)`);
      return { valid: true, license };
    }

    // Hardware binding: one license per computer (IP address)
    if (license.hardwareId) {
      // License already bound - check if it matches
      if (license.hardwareId !== hardwareId) {
        console.warn(`[License] License ${licenseKey} rejected: already activated on different IP`);
        return { 
          valid: false, 
          license, 
          reason: 'This license is already activated on another computer' 
        };
      }
      // Hardware matches - valid
      console.log(`[License] License ${licenseKey} verified for bound IP`);
    } else {
      // First activation - bind to this IP
      await storage.updateLicense(license.id, { 
        hardwareId,
        activatedAt: new Date()
      });
      console.log(`[License] License ${licenseKey} activated and bound to IP`);
    }

    return { valid: true, license };
  }

  async revokeLicense(licenseKey: string): Promise<License | null> {
    const license = await storage.getLicenseByKey(licenseKey);
    if (!license) {
      return null;
    }

    return await storage.updateLicense(license.id, { status: 'revoked' });
  }

  async getAllLicenses(): Promise<License[]> {
    return await storage.getAllLicenses();
  }

  async getLicenseByKey(licenseKey: string): Promise<License | undefined> {
    return await storage.getLicenseByKey(licenseKey);
  }
}

export const licenseService = new LicenseService();
