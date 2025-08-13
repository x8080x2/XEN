import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const emailConfigs = pgTable("email_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUser: text("smtp_user").notNull(),
  smtpPassword: text("smtp_password").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name"),
  replyTo: text("reply_to"),
  priority: integer("priority").default(2),
  security: text("security").default("tls"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailJobs = pgTable("email_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  configId: varchar("config_id").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  recipients: jsonb("recipients").notNull(),
  attachments: jsonb("attachments"),
  status: text("status").default("pending"),
  settings: jsonb("settings"),
  totalRecipients: integer("total_recipients").notNull(),
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  settingsType: text("settings_type").notNull(),
  settings: jsonb("settings").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertEmailConfigSchema = createInsertSchema(emailConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailJobSchema = createInsertSchema(emailJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  sentAt: true,
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Email send request schema
export const emailSendRequestSchema = z.object({
  configId: z.string(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  recipients: z.array(z.string().email()),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string(),
    contentType: z.string(),
  })).optional(),
  settings: z.object({
    emailsPerSecond: z.number().min(1).max(50).default(5),
    sleepBetween: z.number().min(0).max(60).default(3),
    retryAttempts: z.number().min(0).max(10).default(3),
    minifyHtml: z.boolean().default(true),
    includeHtmlAttachment: z.boolean().default(false),
    htmlToBodyOnly: z.boolean().default(false),
    hiddenText: z.string().optional(),
    convertTo: z.string().optional(),
    qrCode: z.object({
      enabled: z.boolean().default(false),
      link: z.string().url().optional(),
      width: z.number().default(200),
      borderStyle: z.string().default("solid"),
      borderColor: z.string().default("#000000"),
      randomMetadata: z.boolean().default(false),
    }).optional(),
    zip: z.object({
      enabled: z.boolean().default(false),
      password: z.string().optional(),
      filenameTemplate: z.string().default("{user}_{date}"),
    }).optional(),
    proxy: z.object({
      enabled: z.boolean().default(false),
      type: z.string().default("socks5"),
      host: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
  }).optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type EmailConfig = typeof emailConfigs.$inferSelect;

export type InsertEmailJob = z.infer<typeof insertEmailJobSchema>;
export type EmailJob = typeof emailJobs.$inferSelect;

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

export type EmailSendRequest = z.infer<typeof emailSendRequestSchema>;
