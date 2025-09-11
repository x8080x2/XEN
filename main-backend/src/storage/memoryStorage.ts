import crypto from 'crypto';
import { License, LicenseUsage, ApiKey } from '@shared/schema';

// In-memory storage for licenses, usage, and API keys
class MemoryStorage {
  private licenses: Map<string, License> = new Map();
  private licenseUsage: Map<string, LicenseUsage[]> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();

  // License management
  createLicense(license: Omit<License, 'id'>): License {
    const id = crypto.randomBytes(16).toString('hex');
    const newLicense: License = {
      ...license,
      id,
    };

    this.licenses.set(license.licenseKey, newLicense);
    // Updated log to include IP address binding
    console.log(`📝 License created: ${license.userEmail} (${license.planType}) - Key: ${license.licenseKey.substring(0, 8)}... - Expires: ${license.expiresAt.toISOString()}`);
    console.log(`🔒 Machine binding: ${license.machineFingerprint || 'Not bound'}`);
    console.log(`🌐 IP binding: ${license.ipAddress || 'Not bound'}`);
    console.log(`🔢 Activation limit: ${license.activationCount}/${license.maxActivations}`);
    return newLicense;
  }

  getLicenseByKey(licenseKey: string): License | null {
    return this.licenses.get(licenseKey) || null;
  }

  getLicenseById(id: string): License | null {
    for (const license of this.licenses.values()) {
      if (license.id === id) {
        return license;
      }
    }
    return null;
  }

  updateLicense(licenseKey: string, updates: Partial<License>): License | null {
    const license = this.licenses.get(licenseKey);
    if (!license) return null;

    const updatedLicense = { ...license, ...updates };
    this.licenses.set(licenseKey, updatedLicense);
    return updatedLicense;
  }

  getAllLicenses(): License[] {
    return Array.from(this.licenses.values());
  }

  deleteLicense(licenseKey: string): boolean {
    return this.licenses.delete(licenseKey);
  }

  // Usage tracking
  recordUsage(licenseId: string, usage: Omit<LicenseUsage, 'id' | 'timestamp'>): LicenseUsage {
    const id = crypto.randomBytes(16).toString('hex');
    const newUsage: LicenseUsage = {
      ...usage,
      id,
      timestamp: new Date(),
    };

    const existingUsage = this.licenseUsage.get(licenseId) || [];
    existingUsage.push(newUsage);
    this.licenseUsage.set(licenseId, existingUsage);

    return newUsage;
  }

  getUsageByLicense(licenseId: string): LicenseUsage[] {
    return this.licenseUsage.get(licenseId) || [];
  }

  getUsageByLicenseAndAction(licenseId: string, action: string): LicenseUsage[] {
    const usage = this.licenseUsage.get(licenseId) || [];
    return usage.filter(u => u.action === action);
  }

  getMonthlyEmailUsage(licenseId: string): number {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = this.licenseUsage.get(licenseId) || [];
    return usage
      .filter(u => u.action === 'email_sent' && u.timestamp >= firstOfMonth)
      .reduce((total, u) => total + u.count, 0);
  }

  // API key management
  createApiKey(apiKey: Omit<ApiKey, 'id' | 'createdAt'>): ApiKey {
    const id = crypto.randomBytes(16).toString('hex');
    const newApiKey: ApiKey = {
      ...apiKey,
      id,
      createdAt: new Date(),
    };

    this.apiKeys.set(newApiKey.hashedKey, newApiKey);
    return newApiKey;
  }

  getApiKeyByHash(hashedKey: string): ApiKey | null {
    return this.apiKeys.get(hashedKey) || null;
  }

  updateApiKeyLastUsed(hashedKey: string): void {
    const apiKey = this.apiKeys.get(hashedKey);
    if (apiKey) {
      apiKey.lastUsed = new Date();
      this.apiKeys.set(hashedKey, apiKey);
    }
  }

  deactivateApiKey(hashedKey: string): boolean {
    const apiKey = this.apiKeys.get(hashedKey);
    if (apiKey) {
      apiKey.isActive = false;
      this.apiKeys.set(hashedKey, apiKey);
      return true;
    }
    return false;
  }

  getAllApiKeys(): ApiKey[] {
    return Array.from(this.apiKeys.values());
  }

  // Cleanup methods
  cleanupExpiredLicenses(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, license] of this.licenses.entries()) {
      if (license.expiresAt < now && license.status !== 'expired') {
        license.status = 'expired';
        this.licenses.set(key, license);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Statistics
  getStats() {
    const totalLicenses = this.licenses.size;
    const activeLicenses = Array.from(this.licenses.values()).filter(l => l.status === 'active').length;
    const expiredLicenses = Array.from(this.licenses.values()).filter(l => l.status === 'expired').length;
    const totalApiKeys = this.apiKeys.size;
    const activeApiKeys = Array.from(this.apiKeys.values()).filter(k => k.isActive).length;

    return {
      licenses: {
        total: totalLicenses,
        active: activeLicenses,
        expired: expiredLicenses,
      },
      apiKeys: {
        total: totalApiKeys,
        active: activeApiKeys,
      },
    };
  }
}

// Singleton instance
let storageInstance: MemoryStorage | null = null;

export function initializeStorage(): MemoryStorage {
  if (!storageInstance) {
    storageInstance = new MemoryStorage();

    // Create default admin API key if none exists
    const defaultApiKey = process.env.DEFAULT_API_KEY || 'admin-api-key-2024';
    const hashedKey = crypto.createHash('sha256').update(defaultApiKey).digest('hex');

    storageInstance.createApiKey({
      keyName: 'Default Admin Key',
      hashedKey,
      permissions: ['*'],
      isActive: true,
    });

    console.log('✅ Memory storage initialized with default API key');
  }

  return storageInstance;
}

export function getStorage(): MemoryStorage {
  if (!storageInstance) {
    throw new Error('Storage not initialized. Call initializeStorage first.');
  }
  return storageInstance;
}