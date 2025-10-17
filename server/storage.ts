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
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // App settings operations
  getAppSettings(userId: string, settingsType: string): Promise<AppSettings | undefined>;
  upsertAppSettings(settings: InsertAppSettings): Promise<AppSettings>;
  
  // License operations
  getLicenseByKey(licenseKey: string): Promise<License | undefined>;
  createLicense(license: InsertLicense): Promise<License>;
  updateLicense(id: string, license: Partial<License>): Promise<License>;
  getAllLicenses(): Promise<License[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private appSettings: Map<string, AppSettings>;
  private licenses: Map<string, License>;

  constructor() {
    this.users = new Map();
    this.appSettings = new Map();
    this.licenses = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  async getAppSettings(userId: string, settingsType: string): Promise<AppSettings | undefined> {
    return Array.from(this.appSettings.values()).find(
      (settings) => settings.userId === userId && settings.settingsType === settingsType,
    );
  }

  async upsertAppSettings(insertSettings: InsertAppSettings): Promise<AppSettings> {
    const existing = Array.from(this.appSettings.values()).find(
      (settings) => settings.userId === insertSettings.userId && settings.settingsType === insertSettings.settingsType,
    );

    if (existing) {
      const updated = { ...existing, ...insertSettings, updatedAt: new Date() };
      this.appSettings.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const settings: AppSettings = {
        ...insertSettings,
        id,
        updatedAt: new Date(),
      };
      this.appSettings.set(id, settings);
      return settings;
    }
  }

  async getLicenseByKey(licenseKey: string): Promise<License | undefined> {
    return Array.from(this.licenses.values()).find(
      (license) => license.licenseKey === licenseKey,
    );
  }

  async createLicense(insertLicense: InsertLicense): Promise<License> {
    const id = randomUUID();
    const license: License = {
      ...insertLicense,
      id,
      createdAt: new Date(),
    };
    this.licenses.set(id, license);
    return license;
  }

  async updateLicense(id: string, updates: Partial<License>): Promise<License> {
    const existing = this.licenses.get(id);
    if (!existing) {
      throw new Error(`License ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.licenses.set(id, updated);
    return updated;
  }

  async getAllLicenses(): Promise<License[]> {
    return Array.from(this.licenses.values());
  }
}

export class DatabaseStorage implements IStorage {
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
    return license ? {
      ...license,
      status: license.status as 'active' | 'expired' | 'revoked',
      expiresAt: license.expiresAt || undefined,
      telegramUserId: license.telegramUserId || undefined,
      telegramUsername: license.telegramUsername || undefined,
    } : undefined;
  }

  async createLicense(insertLicense: InsertLicense): Promise<License> {
    const [license] = await db
      .insert(licenses)
      .values(insertLicense)
      .returning();
    return {
      ...license,
      status: license.status as 'active' | 'expired' | 'revoked',
      expiresAt: license.expiresAt || undefined,
      telegramUserId: license.telegramUserId || undefined,
      telegramUsername: license.telegramUsername || undefined,
    };
  }

  async updateLicense(id: string, updates: Partial<License>): Promise<License> {
    const [license] = await db
      .update(licenses)
      .set(updates)
      .where(eq(licenses.id, id))
      .returning();
    return {
      ...license,
      status: license.status as 'active' | 'expired' | 'revoked',
      expiresAt: license.expiresAt || undefined,
      telegramUserId: license.telegramUserId || undefined,
      telegramUsername: license.telegramUsername || undefined,
    };
  }

  async getAllLicenses(): Promise<License[]> {
    const allLicenses = await db.select().from(licenses);
    return allLicenses.map(license => ({
      ...license,
      status: license.status as 'active' | 'expired' | 'revoked',
      expiresAt: license.expiresAt || undefined,
      telegramUserId: license.telegramUserId || undefined,
      telegramUsername: license.telegramUsername || undefined,
    }));
  }
}

// Always use database storage with SQLite
export const storage = new DatabaseStorage();
