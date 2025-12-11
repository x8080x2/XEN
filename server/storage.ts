import {
  type AppSettings,
  type InsertAppSettings,
  type User,
  type InsertUser,
  type License,
  type InsertLicense,
  users,
  appSettings,
  licenses,
  broadcasts
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

function cleanLicense(license: any): License {
  return {
    ...license,
    status: license.status as 'active' | 'expired' | 'revoked',
    expiresAt: license.expiresAt || undefined,
    telegramUserId: license.telegramUserId || undefined,
    telegramUsername: license.telegramUsername || undefined,
    hardwareId: license.hardwareId || undefined,
    activatedAt: license.activatedAt || undefined,
  };
}

class Storage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user as User || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user as User;
  }

  async getAppSettings(userId: string, settingsType: string): Promise<AppSettings | undefined> {
    const [settings] = await db
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.userId, userId), eq(appSettings.settingsType, settingsType)));
    if (!settings) return undefined;
    return {
      ...settings,
      settings: JSON.parse(settings.settings as string)
    };
  }

  async upsertAppSettings(insertSettings: InsertAppSettings): Promise<AppSettings> {
    const existing = await this.getAppSettings(insertSettings.userId, insertSettings.settingsType);

    if (existing) {
      const [updated] = await db
        .update(appSettings)
        .set({
          settings: JSON.stringify(insertSettings.settings),
          updatedAt: new Date()
        } as any)
        .where(eq(appSettings.id, existing.id))
        .returning();
      return {
        ...updated,
        settings: JSON.parse(updated.settings as string)
      };
    } else {
      const [created] = await db
        .insert(appSettings)
        .values({
          ...insertSettings,
          settings: JSON.stringify(insertSettings.settings)
        } as any)
        .returning();
      return {
        ...created,
        settings: JSON.parse(created.settings as string)
      };
    }
  }

  async getLicenseByKey(licenseKey: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.licenseKey, licenseKey));
    return license ? cleanLicense(license) : undefined;
  }

  async createLicense(insertLicense: InsertLicense): Promise<License> {
    const [license] = await db.insert(licenses).values(insertLicense).returning();
    return cleanLicense(license);
  }

  async updateLicense(id: string, updates: Partial<License>): Promise<License> {
    const [license] = await db.update(licenses).set(updates).where(eq(licenses.id, id)).returning();
    return cleanLicense(license);
  }

  async getAllLicenses(): Promise<License[]> {
    return db.select().from(licenses).all();
  }

  async saveBroadcastMessage(broadcast: { id: string; message: string; timestamp: Date; adminId: string }): Promise<void> {
    try {
      await db.insert(broadcasts).values({
        id: broadcast.id,
        message: broadcast.message,
        timestamp: broadcast.timestamp.getTime(),
        adminId: broadcast.adminId,
      });
      console.log('[Storage] Broadcast saved to database');
    } catch (error) {
      console.error('[Storage] Failed to save broadcast:', error);
    }
  }

  async getBroadcastMessages(limit: number = 50): Promise<Array<{ id: string; message: string; timestamp: Date; adminId: string }>> {
    try {
      const messages = await db.select()
        .from(broadcasts)
        .orderBy(desc(broadcasts.timestamp))
        .limit(limit);

      console.log(`[Storage] Retrieved ${messages.length} broadcasts from database`);

      return messages.map(msg => ({
        id: msg.id,
        message: msg.message,
        timestamp: new Date(msg.timestamp),
        adminId: msg.adminId,
      }));
    } catch (error) {
      console.error('[Storage] Failed to get broadcasts:', error);
      return [];
    }
  }

  async deleteBroadcastMessage(broadcastId: string): Promise<void> {
    try {
      await db.delete(broadcasts).where(eq(broadcasts.id, broadcastId));
      console.log(`[Storage] Deleted broadcast ${broadcastId} from database`);
    } catch (error) {
      console.error('[Storage] Failed to delete broadcast:', error);
    }
  }
}

export const storage = new Storage();