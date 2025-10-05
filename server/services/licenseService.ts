import { db } from "../db";
import { licenses, type License, type InsertLicense } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export class LicenseService {
  async verifyLicense(licenseKey: string): Promise<{ valid: boolean; license?: License; message: string }> {
    try {
      const [license] = await db
        .select()
        .from(licenses)
        .where(eq(licenses.licenseKey, licenseKey))
        .limit(1);

      if (!license) {
        return {
          valid: false,
          message: "License key not found"
        };
      }

      if (!license.isActive) {
        return {
          valid: false,
          license,
          message: "License key is inactive"
        };
      }

      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return {
          valid: false,
          license,
          message: "License key has expired"
        };
      }

      await db
        .update(licenses)
        .set({ lastValidated: new Date() })
        .where(eq(licenses.licenseKey, licenseKey));

      return {
        valid: true,
        license: {
          ...license,
          lastValidated: new Date()
        },
        message: "License key is valid"
      };
    } catch (error) {
      console.error("[LicenseService] Verification error:", error);
      return {
        valid: false,
        message: "License verification failed"
      };
    }
  }

  async createLicense(licenseData: InsertLicense): Promise<License> {
    const id = randomUUID();
    const newLicense: License = {
      ...licenseData,
      id,
      createdAt: new Date(),
      isActive: licenseData.isActive ?? true
    };

    const [created] = await db
      .insert(licenses)
      .values(newLicense)
      .returning();

    return created;
  }

  async getLicenseByKey(licenseKey: string): Promise<License | undefined> {
    const [license] = await db
      .select()
      .from(licenses)
      .where(eq(licenses.licenseKey, licenseKey))
      .limit(1);

    return license;
  }

  async updateLicense(licenseKey: string, updates: Partial<License>): Promise<License | undefined> {
    const [updated] = await db
      .update(licenses)
      .set(updates)
      .where(eq(licenses.licenseKey, licenseKey))
      .returning();

    return updated;
  }

  async deactivateLicense(licenseKey: string): Promise<boolean> {
    try {
      await db
        .update(licenses)
        .set({ isActive: false })
        .where(eq(licenses.licenseKey, licenseKey));

      return true;
    } catch (error) {
      console.error("[LicenseService] Deactivation error:", error);
      return false;
    }
  }

  async getAllLicenses(): Promise<License[]> {
    return db.select().from(licenses);
  }

  async getActiveLicenses(): Promise<License[]> {
    return db
      .select()
      .from(licenses)
      .where(eq(licenses.isActive, true));
  }
}

export const licenseService = new LicenseService();
