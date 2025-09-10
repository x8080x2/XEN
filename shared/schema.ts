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

// License Schema
export const licenseSchema = z.object({
  id: z.string(),
  licenseKey: z.string().min(32).max(64), // Unique license key
  userId: z.string(),
  userEmail: z.string().email(),
  userName: z.string(),
  planType: z.enum(['basic', 'professional', 'enterprise']),
  status: z.enum(['active', 'suspended', 'expired', 'revoked']),
  features: z.object({
    maxEmailsPerMonth: z.number(),
    maxRecipientsPerEmail: z.number(),
    allowQRCodes: z.boolean(),
    allowAttachments: z.boolean(),
    allowDomainLogos: z.boolean(),
    allowHTMLConvert: z.boolean(),
    smtpRotation: z.boolean(),
    apiAccess: z.boolean(),
  }),
  emailsUsedThisMonth: z.number().default(0),
  issuedAt: z.date().default(() => new Date()),
  expiresAt: z.date(),
  lastValidated: z.date().optional(),
  machineFingerprint: z.string().optional(), // Hardware/machine identification
  activationCount: z.number().default(0), // Track activations
  maxActivations: z.number().default(1), // License transfer limit
});

export const insertLicenseSchema = licenseSchema.omit({ 
  id: true, 
  issuedAt: true,
  emailsUsedThisMonth: true,
  activationCount: true,
  lastValidated: true
});

export type License = z.infer<typeof licenseSchema>;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;

// License Token Schema (JWT payload)
export const licenseTokenSchema = z.object({
  licenseId: z.string(),
  licenseKey: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  planType: z.enum(['basic', 'professional', 'enterprise']),
  features: z.object({
    maxEmailsPerMonth: z.number(),
    maxRecipientsPerEmail: z.number(),
    allowQRCodes: z.boolean(),
    allowAttachments: z.boolean(),
    allowDomainLogos: z.boolean(),
    allowHTMLConvert: z.boolean(),
    smtpRotation: z.boolean(),
    apiAccess: z.boolean(),
  }),
  emailsUsedThisMonth: z.number(),
  expiresAt: z.number(), // Unix timestamp
  iat: z.number().optional(), // Issued at
  exp: z.number().optional(), // Expires at (JWT)
});

export type LicenseToken = z.infer<typeof licenseTokenSchema>;

// License Validation Request Schema
export const licenseValidationSchema = z.object({
  licenseKey: z.string(),
  machineFingerprint: z.string().optional(),
  clientVersion: z.string().optional(),
});

export type LicenseValidation = z.infer<typeof licenseValidationSchema>;

// License Usage Schema
export const licenseUsageSchema = z.object({
  id: z.string(),
  licenseId: z.string(),
  action: z.string(), // 'email_sent', 'api_call', etc.
  count: z.number().default(1),
  metadata: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date()),
});

export const insertLicenseUsageSchema = licenseUsageSchema.omit({ 
  id: true, 
  timestamp: true 
});

export type LicenseUsage = z.infer<typeof licenseUsageSchema>;
export type InsertLicenseUsage = z.infer<typeof insertLicenseUsageSchema>;

// Main Backend API Key Schema
export const apiKeySchema = z.object({
  id: z.string(),
  keyName: z.string(),
  hashedKey: z.string(),
  permissions: z.array(z.string()),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  lastUsed: z.date().optional(),
});

export const insertApiKeySchema = apiKeySchema.omit({ 
  id: true, 
  createdAt: true,
  lastUsed: true
});

export type ApiKey = z.infer<typeof apiKeySchema>;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;