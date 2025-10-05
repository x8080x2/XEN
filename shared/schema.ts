import { z } from "zod";
import { pgTable, varchar, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
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

// Email Send Request Schema
export const emailSendRequestSchema = z.object({
  configId: z.string(),
  subject: z.string(),
  content: z.string(),
  recipients: z.array(z.string().email()),
});

export type EmailSendRequest = z.infer<typeof emailSendRequestSchema>;

// Drizzle Table Definitions
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailConfigs = pgTable("email_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  smtpHost: varchar("smtp_host", { length: 255 }).notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUser: varchar("smtp_user", { length: 255 }).notNull(),
  smtpPassword: varchar("smtp_password", { length: 255 }).notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailJobs = pgTable("email_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  configId: varchar("config_id", { length: 255 }).notNull().references(() => emailConfigs.id),
  subject: varchar("subject", { length: 1000 }).notNull(),
  content: text("content").notNull(),
  recipients: jsonb("recipients").notNull().$type<string[]>(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  totalRecipients: integer("total_recipients").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 255 }).notNull().references(() => emailJobs.id),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  settingsType: varchar("settings_type", { length: 255 }).notNull(),
  settings: jsonb("settings").notNull().$type<Record<string, any>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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


