import { z } from "zod";
import { pgTable, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// Shared SMTP Configuration schema for desktop-server communication
export const smtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().int().positive("Port must be a positive number"),
  user: z.string().min(1, "SMTP user is required"),
  pass: z.string().min(1, "SMTP password is required"),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
  id: z.string().optional(), // For SMTP manager with multiple configs
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

// User Schema
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  createdAt: z.date().default(() => new Date()),
});

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Email Config Schema
export const emailConfigSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number(),
  smtpUser: z.string(),
  smtpPassword: z.string(),
  fromEmail: z.string().email(),
  fromName: z.string(),
  createdAt: z.date().default(() => new Date()),
});

export const insertEmailConfigSchema = emailConfigSchema.omit({ 
  id: true, 
  createdAt: true 
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;

// App Settings Schema
export const appSettingsSchema = z.object({
  id: z.string(),
  userId: z.string(),
  settingsType: z.string(),
  settings: z.record(z.any()),
  updatedAt: z.date().default(() => new Date()),
});

export const insertAppSettingsSchema = appSettingsSchema.omit({ 
  id: true, 
  updatedAt: true 
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;

// License Schema
export const licenseSchema = z.object({
  id: z.string(),
  licenseKey: z.string(),
  telegramUserId: z.string().optional(),
  telegramUsername: z.string().optional(),
  status: z.enum(['active', 'expired', 'revoked']),
  expiresAt: z.date().optional(),
  hardwareId: z.string().optional(),
  activatedAt: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const insertLicenseSchema = licenseSchema.omit({ 
  id: true, 
  createdAt: true 
});

export type License = z.infer<typeof licenseSchema>;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;

export interface LicenseUpdate {
  status?: 'active' | 'expired' | 'revoked';
  hardwareId?: string;
  activatedAt?: Date;
  expiresAt?: Date;
}

// PostgreSQL Table Definitions
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailConfigs = pgTable("email_configs", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  smtpHost: varchar("smtp_host", { length: 255 }).notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUser: varchar("smtp_user", { length: 255 }).notNull(),
  smtpPassword: text("smtp_password").notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  settingsType: varchar("settings_type", { length: 255 }).notNull(),
  settings: text("settings").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const licenses = pgTable("licenses", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  licenseKey: varchar("license_key", { length: 255 }).notNull().unique(),
  telegramUserId: varchar("telegram_user_id", { length: 255 }),
  telegramUsername: varchar("telegram_username", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  expiresAt: timestamp("expires_at"),
  hardwareId: varchar("hardware_id", { length: 255 }),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  emailConfigs: many(emailConfigs),
  appSettings: many(appSettings),
}));

export const emailConfigsRelations = relations(emailConfigs, ({ one }) => ({
  user: one(users, {
    fields: [emailConfigs.userId],
    references: [users.id],
  }),
}));

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  user: one(users, {
    fields: [appSettings.userId],
    references: [users.id],
  }),
}));