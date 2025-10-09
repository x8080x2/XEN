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

    // Hardware binding check
    if (hardwareId) {
      if (license.hardwareId && license.hardwareId !== hardwareId) {
        return { 
          valid: false, 
          license, 
          reason: 'License is already activated on another computer' 
        };
      }

      // Bind license to this hardware if not already bound
      if (!license.hardwareId) {
        await storage.updateLicense(license.id, { 
          hardwareId,
          activatedAt: new Date()
        });
        console.log(`License ${licenseKey} bound to hardware ${hardwareId.substring(0, 16)}...`);
      }
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
