import { z } from "zod";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

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

// Email Job Schema
export const emailJobSchema = z.object({
  id: z.string(),
  userId: z.string(),
  configId: z.string(),
  subject: z.string(),
  content: z.string(),
  recipients: z.array(z.string()),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  totalRecipients: z.number(),
  sentCount: z.number().default(0),
  failedCount: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export const insertEmailJobSchema = emailJobSchema.omit({ 
  id: true, 
  createdAt: true,
  sentCount: true,
  failedCount: true
});

export type EmailJob = z.infer<typeof emailJobSchema>;
export type InsertEmailJob = z.infer<typeof insertEmailJobSchema>;

// Email Log Schema
export const emailLogSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  recipient: z.string(),
  status: z.enum(['success', 'failed']),
  error: z.string().optional(),
  sentAt: z.date().default(() => new Date()),
});

export const insertEmailLogSchema = emailLogSchema.omit({ 
  id: true, 
  sentAt: true 
});

export type EmailLog = z.infer<typeof emailLogSchema>;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;

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
  createdAt: z.date().default(() => new Date()),
});

export const insertLicenseSchema = licenseSchema.omit({ 
  id: true, 
  createdAt: true 
});

export type License = z.infer<typeof licenseSchema>;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;

// Email Send Request Schema
export const emailSendRequestSchema = z.object({
  configId: z.string(),
  subject: z.string(),
  content: z.string(),
  recipients: z.array(z.string().email()),
});

export type EmailSendRequest = z.infer<typeof emailSendRequestSchema>;

// SQLite Table Definitions
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const emailConfigs = sqliteTable("email_configs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUser: text("smtp_user").notNull(),
  smtpPassword: text("smtp_password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const emailJobs = sqliteTable("email_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  configId: text("config_id").notNull().references(() => emailConfigs.id),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  recipients: text("recipients").notNull(),
  status: text("status").notNull().default("pending"),
  totalRecipients: integer("total_recipients").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: 'timestamp' }),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
});

export const emailLogs = sqliteTable("email_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id").notNull().references(() => emailJobs.id),
  recipient: text("recipient").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  sentAt: integer("sent_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  settingsType: text("settings_type").notNull(),
  settings: text("settings").notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const licenses = sqliteTable("licenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  licenseKey: text("license_key").notNull().unique(),
  telegramUserId: text("telegram_user_id"),
  telegramUsername: text("telegram_username"),
  status: text("status").notNull().default("active"),
  expiresAt: integer("expires_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  emailConfigs: many(emailConfigs),
  emailJobs: many(emailJobs),
  appSettings: many(appSettings),
}));

export const emailConfigsRelations = relations(emailConfigs, ({ one, many }) => ({
  user: one(users, {
    fields: [emailConfigs.userId],
    references: [users.id],
  }),
  emailJobs: many(emailJobs),
}));

export const emailJobsRelations = relations(emailJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [emailJobs.userId],
    references: [users.id],
  }),
  config: one(emailConfigs, {
    fields: [emailJobs.configId],
    references: [emailConfigs.id],
  }),
  logs: many(emailLogs),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  job: one(emailJobs, {
    fields: [emailLogs.jobId],
    references: [emailJobs.id],
  }),
}));

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  user: one(users, {
    fields: [appSettings.userId],
    references: [users.id],
  }),
}));
