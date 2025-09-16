import { 
  type EmailConfig, 
  type InsertEmailConfig,
  type EmailJob,
  type InsertEmailJob,
  type EmailLog,
  type InsertEmailLog,
  type AppSettings,
  type InsertAppSettings,
  type User, 
  type InsertUser,
  users,
  emailConfigs,
  emailJobs,
  emailLogs,
  appSettings
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Email config operations
  getEmailConfig(id: string): Promise<EmailConfig | undefined>;
  getEmailConfigsByUser(userId: string): Promise<EmailConfig[]>;
  createEmailConfig(config: InsertEmailConfig): Promise<EmailConfig>;
  updateEmailConfig(id: string, config: Partial<EmailConfig>): Promise<EmailConfig>;
  deleteEmailConfig(id: string): Promise<void>;
  
  // Email job operations
  getEmailJob(id: string): Promise<EmailJob | undefined>;
  getEmailJobsByUser(userId: string): Promise<EmailJob[]>;
  createEmailJob(job: InsertEmailJob): Promise<EmailJob>;
  updateEmailJob(id: string, job: Partial<EmailJob>): Promise<EmailJob>;
  
  // Email log operations
  getEmailLogsByJob(jobId: string): Promise<EmailLog[]>;
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  
  // App settings operations
  getAppSettings(userId: string, settingsType: string): Promise<AppSettings | undefined>;
  upsertAppSettings(settings: InsertAppSettings): Promise<AppSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private emailConfigs: Map<string, EmailConfig>;
  private emailJobs: Map<string, EmailJob>;
  private emailLogs: Map<string, EmailLog>;
  private appSettings: Map<string, AppSettings>;

  constructor() {
    this.users = new Map();
    this.emailConfigs = new Map();
    this.emailJobs = new Map();
    this.emailLogs = new Map();
    this.appSettings = new Map();
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

  async getEmailConfig(id: string): Promise<EmailConfig | undefined> {
    return this.emailConfigs.get(id);
  }

  async getEmailConfigsByUser(userId: string): Promise<EmailConfig[]> {
    return Array.from(this.emailConfigs.values()).filter(
      (config) => config.userId === userId,
    );
  }

  async createEmailConfig(insertConfig: InsertEmailConfig): Promise<EmailConfig> {
    const id = randomUUID();
    const config: EmailConfig = {
      ...insertConfig,
      id,
      createdAt: new Date(),
    };
    this.emailConfigs.set(id, config);
    return config;
  }

  async updateEmailConfig(id: string, updates: Partial<EmailConfig>): Promise<EmailConfig> {
    const existing = this.emailConfigs.get(id);
    if (!existing) {
      throw new Error(`Email config ${id} not found`);
    }
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.emailConfigs.set(id, updated);
    return updated;
  }

  async deleteEmailConfig(id: string): Promise<void> {
    this.emailConfigs.delete(id);
  }

  async getEmailJob(id: string): Promise<EmailJob | undefined> {
    return this.emailJobs.get(id);
  }

  async getEmailJobsByUser(userId: string): Promise<EmailJob[]> {
    return Array.from(this.emailJobs.values()).filter(
      (job) => job.userId === userId,
    );
  }

  async createEmailJob(insertJob: InsertEmailJob): Promise<EmailJob> {
    const id = randomUUID();
    const job: EmailJob = {
      ...insertJob,
      id,
      createdAt: new Date(),
      sentCount: 0,
      failedCount: 0,
    };
    this.emailJobs.set(id, job);
    return job;
  }

  async updateEmailJob(id: string, updates: Partial<EmailJob>): Promise<EmailJob> {
    const existing = this.emailJobs.get(id);
    if (!existing) {
      throw new Error(`Email job ${id} not found`);
    }
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.emailJobs.set(id, updated);
    return updated;
  }

  async getEmailLogsByJob(jobId: string): Promise<EmailLog[]> {
    return Array.from(this.emailLogs.values()).filter(
      (log) => log.jobId === jobId,
    );
  }

  async createEmailLog(insertLog: InsertEmailLog): Promise<EmailLog> {
    const id = randomUUID();
    const log: EmailLog = {
      ...insertLog,
      id,
      sentAt: new Date(),
    };
    this.emailLogs.set(id, log);
    return log;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getEmailConfig(id: string): Promise<EmailConfig | undefined> {
    const [config] = await db.select().from(emailConfigs).where(eq(emailConfigs.id, id));
    return config || undefined;
  }

  async getEmailConfigsByUser(userId: string): Promise<EmailConfig[]> {
    return await db.select().from(emailConfigs).where(eq(emailConfigs.userId, userId));
  }

  async createEmailConfig(insertConfig: InsertEmailConfig): Promise<EmailConfig> {
    const [config] = await db
      .insert(emailConfigs)
      .values(insertConfig)
      .returning();
    return config;
  }

  async updateEmailConfig(id: string, updates: Partial<EmailConfig>): Promise<EmailConfig> {
    const [config] = await db
      .update(emailConfigs)
      .set(updates)
      .where(eq(emailConfigs.id, id))
      .returning();
    return config;
  }

  async deleteEmailConfig(id: string): Promise<void> {
    await db.delete(emailConfigs).where(eq(emailConfigs.id, id));
  }

  async getEmailJob(id: string): Promise<EmailJob | undefined> {
    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, id));
    return job ? {
      ...job,
      status: job.status as 'pending' | 'running' | 'completed' | 'failed',
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined
    } : undefined;
  }

  async getEmailJobsByUser(userId: string): Promise<EmailJob[]> {
    const jobs = await db.select().from(emailJobs).where(eq(emailJobs.userId, userId));
    return jobs.map(job => ({
      ...job,
      status: job.status as 'pending' | 'running' | 'completed' | 'failed',
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined
    }));
  }

  async createEmailJob(insertJob: InsertEmailJob): Promise<EmailJob> {
    const [job] = await db
      .insert(emailJobs)
      .values(insertJob)
      .returning();
    return {
      ...job,
      status: job.status as 'pending' | 'running' | 'completed' | 'failed',
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined
    };
  }

  async updateEmailJob(id: string, updates: Partial<EmailJob>): Promise<EmailJob> {
    const [job] = await db
      .update(emailJobs)
      .set(updates)
      .where(eq(emailJobs.id, id))
      .returning();
    return {
      ...job,
      status: job.status as 'pending' | 'running' | 'completed' | 'failed',
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined
    };
  }

  async getEmailLogsByJob(jobId: string): Promise<EmailLog[]> {
    const logs = await db.select().from(emailLogs).where(eq(emailLogs.jobId, jobId));
    return logs.map(log => ({
      ...log,
      status: log.status as 'success' | 'failed',
      error: log.error || undefined
    }));
  }

  async createEmailLog(insertLog: InsertEmailLog): Promise<EmailLog> {
    const [log] = await db
      .insert(emailLogs)
      .values(insertLog)
      .returning();
    return {
      ...log,
      status: log.status as 'success' | 'failed',
      error: log.error || undefined
    };
  }

  async getAppSettings(userId: string, settingsType: string): Promise<AppSettings | undefined> {
    const [settings] = await db
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.userId, userId), eq(appSettings.settingsType, settingsType)));
    return settings || undefined;
  }

  async upsertAppSettings(insertSettings: InsertAppSettings): Promise<AppSettings> {
    const existing = await this.getAppSettings(insertSettings.userId, insertSettings.settingsType);
    
    if (existing) {
      const [updated] = await db
        .update(appSettings)
        .set({ ...insertSettings, updatedAt: new Date() })
        .where(eq(appSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(appSettings)
        .values(insertSettings)
        .returning();
      return created;
    }
  }
}

// Use memory storage for local development, database storage when DATABASE_URL is available
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
