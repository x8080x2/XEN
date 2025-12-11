import {
  type AppSettings,
  type InsertAppSettings,
  type User,
  type InsertUser,
  type License,
  type InsertLicense,
  users,
  appSettings,
  licenses
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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
      // Use pool.prepare for raw SQL with better-sqlite3
      const { pool } = await import('./db');
      
      // Create table
      pool.prepare(`
        CREATE TABLE IF NOT EXISTS broadcasts (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          adminId TEXT NOT NULL
        )
      `).run();

      // Insert or replace broadcast
      pool.prepare(`
        INSERT OR REPLACE INTO broadcasts (id, message, timestamp, adminId) 
        VALUES (?, ?, ?, ?)
      `).run(broadcast.id, broadcast.message, broadcast.timestamp.getTime(), broadcast.adminId);

      // Keep only last 50 messages
      pool.prepare(`
        DELETE FROM broadcasts WHERE id NOT IN (
          SELECT id FROM broadcasts ORDER BY timestamp DESC LIMIT 50
        )
      `).run();
      
      console.log('[Storage] Broadcast saved successfully');
    } catch (error) {
      console.error('[Storage] Failed to save broadcast:', error);
    }
  }

  async getBroadcastMessages(limit: number = 50): Promise<Array<{ id: string; message: string; timestamp: Date; adminId: string }>> {
    try {
      // Use pool.prepare for raw SQL with better-sqlite3
      const { pool } = await import('./db');
      
      // Ensure table exists
      pool.prepare(`
        CREATE TABLE IF NOT EXISTS broadcasts (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          adminId TEXT NOT NULL
        )
      `).run();

      // Query broadcasts
      const rows = pool.prepare(`
        SELECT * FROM broadcasts ORDER BY timestamp DESC LIMIT ?
      `).all(limit);

      return (rows as any[]).map((row: any) => ({
        id: row.id,
        message: row.message,
        timestamp: new Date(row.timestamp),
        adminId: row.adminId
      }));
    } catch (error) {
      console.error('[Storage] Failed to get broadcasts:', error);
      return [];
    }
  }
}

export const storage = new Storage();