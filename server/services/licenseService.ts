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

  async verifyLicense(licenseKey: string): Promise<{ valid: boolean; license?: License; reason?: string }> {
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
