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

    // SECURITY: Hardware ID is mandatory for activation limit enforcement
    if (!hardwareId) {
      // If license is already bound, reject requests without hardwareId (bypass attempt)
      if (license.hardwareId) {
        console.warn(`[License Security] License ${licenseKey} verification blocked: no hardware ID provided but license is already bound`);
        return {
          valid: false,
          license,
          reason: 'Hardware verification required for this license'
        };
      }
      // If license not bound yet, still require hardwareId for new activations
      console.warn(`[License Security] License ${licenseKey} verification blocked: hardware ID is required`);
      return {
        valid: false,
        reason: 'Hardware ID is required for license verification'
      };
    }

    // Strict hardware binding enforcement (max 1 activation per license)
    if (hardwareId) {
      // If license is already bound to hardware
      if (license.hardwareId) {
        // Check if it matches current hardware
        if (license.hardwareId !== hardwareId) {
          // STRICT ENFORCEMENT: License is already activated on different computer
          console.warn(`[License Security] License ${licenseKey} activation blocked: already activated on different hardware`);
          return { 
            valid: false, 
            license, 
            reason: 'License is already activated on another computer. Each license can only be used on one computer. Contact support to transfer your license.' 
          };
        }
        // Hardware matches - license is valid on this computer
        console.log(`[License] License ${licenseKey} verified for bound hardware ${hardwareId.substring(0, 16)}...`);
      } else {
        // License not yet bound - bind it to this hardware (first activation)
        try {
          const updatedLicense = await storage.updateLicense(license.id, { 
            hardwareId,
            activatedAt: new Date()
          });
          
          // Verify the update actually saved the hardware binding
          if (!updatedLicense.hardwareId || updatedLicense.hardwareId !== hardwareId) {
            console.error(`[License] Failed to bind license ${licenseKey} to hardware - update did not persist`);
            return {
              valid: false,
              reason: 'Failed to activate license - please try again'
            };
          }
          
          console.log(`[License] License ${licenseKey} activated and bound to hardware ${hardwareId.substring(0, 16)}...`);
          // Return the updated license with hardware binding
          license.hardwareId = updatedLicense.hardwareId;
          license.activatedAt = updatedLicense.activatedAt;
        } catch (error) {
          console.error(`[License] Database error binding license ${licenseKey}:`, error);
          return {
            valid: false,
            reason: 'Failed to activate license - database error'
          };
        }
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
