import { z } from "zod";

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