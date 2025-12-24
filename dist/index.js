var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appSettings: () => appSettings,
  appSettingsRelations: () => appSettingsRelations,
  appSettingsSchema: () => appSettingsSchema,
  broadcasts: () => broadcasts,
  emailConfigSchema: () => emailConfigSchema,
  emailConfigs: () => emailConfigs,
  emailConfigsRelations: () => emailConfigsRelations,
  insertAppSettingsSchema: () => insertAppSettingsSchema,
  insertEmailConfigSchema: () => insertEmailConfigSchema,
  insertLicenseSchema: () => insertLicenseSchema,
  insertUserSchema: () => insertUserSchema,
  licenseSchema: () => licenseSchema,
  licenses: () => licenses,
  smtpConfigSchema: () => smtpConfigSchema,
  userSchema: () => userSchema,
  users: () => users,
  usersRelations: () => usersRelations
});
import { z } from "zod";
import { pgTable, varchar, integer, timestamp, text, bigint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
var smtpConfigSchema, userSchema, insertUserSchema, emailConfigSchema, insertEmailConfigSchema, appSettingsSchema, insertAppSettingsSchema, licenseSchema, insertLicenseSchema, users, emailConfigs, appSettings, licenses, broadcasts, usersRelations, emailConfigsRelations, appSettingsRelations;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    smtpConfigSchema = z.object({
      host: z.string().min(1, "SMTP host is required"),
      port: z.number().int().positive("Port must be a positive number"),
      user: z.string().min(1, "SMTP user is required"),
      pass: z.string().min(1, "SMTP password is required"),
      fromEmail: z.string().email().optional(),
      fromName: z.string().optional(),
      replyTo: z.string().email().optional(),
      id: z.string().optional()
      // For SMTP manager with multiple configs
    });
    userSchema = z.object({
      id: z.string(),
      username: z.string(),
      email: z.string().email(),
      passwordHash: z.string(),
      createdAt: z.date().default(() => /* @__PURE__ */ new Date())
    });
    insertUserSchema = userSchema.omit({ id: true, createdAt: true });
    emailConfigSchema = z.object({
      id: z.string(),
      userId: z.string(),
      name: z.string(),
      smtpHost: z.string(),
      smtpPort: z.number(),
      smtpUser: z.string(),
      smtpPassword: z.string(),
      fromEmail: z.string().email(),
      fromName: z.string(),
      createdAt: z.date().default(() => /* @__PURE__ */ new Date())
    });
    insertEmailConfigSchema = emailConfigSchema.omit({
      id: true,
      createdAt: true
    });
    appSettingsSchema = z.object({
      id: z.string(),
      userId: z.string(),
      settingsType: z.string(),
      settings: z.record(z.any()),
      updatedAt: z.date().default(() => /* @__PURE__ */ new Date())
    });
    insertAppSettingsSchema = appSettingsSchema.omit({
      id: true,
      updatedAt: true
    });
    licenseSchema = z.object({
      id: z.string(),
      licenseKey: z.string(),
      telegramUserId: z.string().optional(),
      telegramUsername: z.string().optional(),
      status: z.enum(["active", "expired", "revoked"]),
      expiresAt: z.date().optional(),
      hardwareId: z.string().optional(),
      activatedAt: z.date().optional(),
      createdAt: z.date().default(() => /* @__PURE__ */ new Date())
    });
    insertLicenseSchema = licenseSchema.omit({
      id: true,
      createdAt: true
    });
    users = pgTable("users", {
      id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
      username: varchar("username", { length: 255 }).notNull().unique(),
      email: varchar("email", { length: 255 }).notNull().unique(),
      passwordHash: text("password_hash").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    emailConfigs = pgTable("email_configs", {
      id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
      name: varchar("name", { length: 255 }).notNull(),
      smtpHost: varchar("smtp_host", { length: 255 }).notNull(),
      smtpPort: integer("smtp_port").notNull(),
      smtpUser: varchar("smtp_user", { length: 255 }).notNull(),
      smtpPassword: text("smtp_password").notNull(),
      fromEmail: varchar("from_email", { length: 255 }).notNull(),
      fromName: varchar("from_name", { length: 255 }).notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    appSettings = pgTable("app_settings", {
      id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
      settingsType: varchar("settings_type", { length: 255 }).notNull(),
      settings: text("settings").notNull(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    licenses = pgTable("licenses", {
      id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
      licenseKey: varchar("license_key", { length: 255 }).notNull().unique(),
      telegramUserId: varchar("telegram_user_id", { length: 255 }),
      telegramUsername: varchar("telegram_username", { length: 255 }),
      status: varchar("status", { length: 50 }).notNull().default("active"),
      expiresAt: timestamp("expires_at"),
      hardwareId: varchar("hardware_id", { length: 255 }),
      activatedAt: timestamp("activated_at"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    broadcasts = pgTable("broadcasts", {
      id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
      message: text("message").notNull(),
      timestamp: bigint("timestamp", { mode: "number" }).notNull(),
      adminId: varchar("admin_id", { length: 255 }).notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    usersRelations = relations(users, ({ many }) => ({
      emailConfigs: many(emailConfigs),
      appSettings: many(appSettings)
    }));
    emailConfigsRelations = relations(emailConfigs, ({ one }) => ({
      user: one(users, {
        fields: [emailConfigs.userId],
        references: [users.id]
      })
    }));
    appSettingsRelations = relations(appSettings, ({ one }) => ({
      user: one(users, {
        fields: [appSettings.userId],
        references: [users.id]
      })
    }));
  }
});

// server/db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
var sql2, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    sql2 = neon(process.env.DATABASE_URL);
    db = drizzle(sql2, { schema: schema_exports });
  }
});

// server/storage.ts
import { eq, and, desc } from "drizzle-orm";
function cleanLicense(license) {
  return {
    ...license,
    status: license.status,
    expiresAt: license.expiresAt || void 0,
    telegramUserId: license.telegramUserId || void 0,
    telegramUsername: license.telegramUsername || void 0,
    hardwareId: license.hardwareId || void 0,
    activatedAt: license.activatedAt || void 0
  };
}
var Storage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    Storage = class {
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || void 0;
      }
      async getUserByUsername(username) {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user || void 0;
      }
      async createUser(insertUser) {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
      }
      async getAppSettings(userId, settingsType) {
        const [settings] = await db.select().from(appSettings).where(and(eq(appSettings.userId, userId), eq(appSettings.settingsType, settingsType)));
        if (!settings) return void 0;
        return {
          ...settings,
          settings: JSON.parse(settings.settings)
        };
      }
      async upsertAppSettings(insertSettings) {
        const existing = await this.getAppSettings(insertSettings.userId, insertSettings.settingsType);
        if (existing) {
          const [updated] = await db.update(appSettings).set({
            settings: JSON.stringify(insertSettings.settings),
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(appSettings.id, existing.id)).returning();
          return {
            ...updated,
            settings: JSON.parse(updated.settings)
          };
        } else {
          const [created] = await db.insert(appSettings).values({
            ...insertSettings,
            settings: JSON.stringify(insertSettings.settings)
          }).returning();
          return {
            ...created,
            settings: JSON.parse(created.settings)
          };
        }
      }
      async getLicenseByKey(licenseKey) {
        const [license] = await db.select().from(licenses).where(eq(licenses.licenseKey, licenseKey));
        return license ? cleanLicense(license) : void 0;
      }
      async createLicense(insertLicense) {
        const [license] = await db.insert(licenses).values(insertLicense).returning();
        return cleanLicense(license);
      }
      async updateLicense(id, updates) {
        const [license] = await db.update(licenses).set(updates).where(eq(licenses.id, id)).returning();
        return cleanLicense(license);
      }
      async getAllLicenses() {
        const allLicenses = await db.select().from(licenses);
        return allLicenses.map(cleanLicense);
      }
      async saveBroadcastMessage(broadcast) {
        try {
          await db.insert(broadcasts).values({
            id: broadcast.id,
            message: broadcast.message,
            timestamp: broadcast.timestamp.getTime(),
            adminId: broadcast.adminId
          });
          console.log("[Storage] Broadcast saved to database");
        } catch (error) {
          console.error("[Storage] Failed to save broadcast:", error);
        }
      }
      async getBroadcastMessages(limit = 50) {
        try {
          const messages = await db.select().from(broadcasts).orderBy(desc(broadcasts.timestamp)).limit(limit);
          console.log(`[Storage] Retrieved ${messages.length} broadcasts from database`);
          return messages.map((msg) => ({
            id: msg.id,
            message: msg.message,
            timestamp: new Date(msg.timestamp),
            adminId: msg.adminId
          }));
        } catch (error) {
          console.error("[Storage] Failed to get broadcasts:", error);
          return [];
        }
      }
      async deleteBroadcastMessage(broadcastId) {
        try {
          await db.delete(broadcasts).where(eq(broadcasts.id, broadcastId));
          console.log(`[Storage] Deleted broadcast ${broadcastId} from database`);
        } catch (error) {
          console.error("[Storage] Failed to delete broadcast:", error);
        }
      }
    };
    storage = new Storage();
  }
});

// server/services/configService.ts
var configService_exports = {};
__export(configService_exports, {
  ConfigService: () => ConfigService,
  configService: () => configService
});
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
var ConfigService, configService;
var init_configService = __esm({
  "server/services/configService.ts"() {
    "use strict";
    ConfigService = class {
      constructor() {
        this.configData = {};
        this.smtpRotationEnabled = false;
        this.currentSmtpIndex = 0;
        this.allSmtpConfigs = [];
        this.rotationStateLoaded = false;
        this.loadConfig();
        this.loadRotationState();
      }
      // Load rotation state from Replit DB (persistent across restarts)
      async loadRotationState() {
        try {
          const dbUrl = process.env.REPLIT_DB_URL;
          if (!dbUrl) return;
          const response = await fetch(`${dbUrl}/smtp_rotation_enabled`);
          if (response.ok) {
            const enabled = await response.text();
            this.smtpRotationEnabled = enabled === "true";
          }
          const indexResponse = await fetch(`${dbUrl}/smtp_rotation_index`);
          if (indexResponse.ok) {
            const index = await response.text();
            this.currentSmtpIndex = parseInt(index) || 0;
          }
          this.rotationStateLoaded = true;
          console.log("[ConfigService] Loaded SMTP rotation state:", {
            enabled: this.smtpRotationEnabled,
            index: this.currentSmtpIndex
          });
        } catch (error) {
          console.error("[ConfigService] Failed to load rotation state:", error);
        }
      }
      // Save rotation state to Replit DB
      async saveRotationState() {
        try {
          const dbUrl = process.env.REPLIT_DB_URL;
          if (!dbUrl) return;
          await fetch(dbUrl, {
            method: "POST",
            body: `smtp_rotation_enabled=${this.smtpRotationEnabled}`
          });
          await fetch(dbUrl, {
            method: "POST",
            body: `smtp_rotation_index=${this.currentSmtpIndex}`
          });
        } catch (error) {
          console.error("[ConfigService] Failed to save rotation state:", error);
        }
      }
      // Load configuration from ini files - exact clone from main.js
      loadConfig() {
        const configPath = join(process.cwd(), "config", "setup.ini");
        const smtpPath = join(process.cwd(), "config", "smtp.ini");
        try {
          if (existsSync(configPath)) {
            const setupContent = readFileSync(configPath, "utf8");
            const setupConfig = this.parseIniFile(setupContent);
            Object.assign(this.configData, setupConfig.CONFIG || {});
            Object.assign(this.configData, setupConfig.PROXY || {});
          }
          if (existsSync(smtpPath)) {
            const smtpContent = readFileSync(smtpPath, "utf8");
            const smtpConfig = this.parseIniFile(smtpContent);
            const smtpKeys = Object.keys(smtpConfig).filter((key) => key.startsWith("smtp"));
            this.allSmtpConfigs = smtpKeys.map((key) => ({ id: key, ...smtpConfig[key] }));
            const currentSmtp = this.getCurrentSmtpConfig();
            if (currentSmtp) {
              Object.assign(this.configData, { SMTP: currentSmtp });
            }
          }
          return this.configData;
        } catch (error) {
          console.error("[ConfigService] Failed to load config:", error);
          return {};
        }
      }
      // Parse INI file format - exact clone from main.js
      parseIniFile(content) {
        const result = {};
        let currentSection = "";
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) {
            continue;
          }
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            currentSection = trimmed.slice(1, -1);
            result[currentSection] = {};
            continue;
          }
          const equalIndex = trimmed.indexOf("=");
          if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim();
            const value = trimmed.substring(equalIndex + 1).trim();
            if (currentSection) {
              result[currentSection][key] = this.parseValue(value);
            } else {
              result[key] = this.parseValue(value);
            }
          }
        }
        return result;
      }
      // Parse config values - exact clone from main.js
      parseValue(value) {
        if (value === "") return "";
        if (value === "0") return 0;
        if (value === "1") return 1;
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        return value;
      }
      // Get specific config value
      getConfig() {
        return this.configData;
      }
      // Convert config to format expected by email service - exact clone from main.js
      getEmailConfig() {
        const config = this.configData;
        return {
          // Basic settings
          EMAILPERSECOND: config.EMAILPERSECOND || 15,
          // Increased default for better performance
          SLEEP: config.SLEEP || 1,
          FILE_NAME: config.FILE_NAME || "attachment",
          GOOGLE_AI_KEY: config.GOOGLE_AI_KEY || "",
          REPLY_TO: config.REPLY_TO || "",
          TEMPLATE_ROTATION: config.TEMPLATE_ROTATION || 0,
          // HTML settings
          HTML_CONVERT: config.HTML_CONVERT || "",
          HTML2IMG_BODY: config.HTML2IMG_BODY || 0,
          INCLUDE_HTML_ATTACHMENT: config.INCLUDE_HTML_ATTACHMENT || 0,
          MINIFY_HTML: config.MINIFY_HTML || 0,
          // QR Code settings
          QRCODE: config.QRCODE || 0,
          QR_WIDTH: parseInt(process.env.QR_WIDTH || "150"),
          QR_BORDER_WIDTH: parseInt(process.env.QR_BORDER_WIDTH || "2"),
          QR_BORDER_COLOR: process.env.QR_BORDER_COLOR || "#000000",
          QR_FOREGROUND_COLOR: process.env.QR_FOREGROUND_COLOR || "#000000",
          QR_BACKGROUND_COLOR: process.env.QR_BACKGROUND_COLOR || "#FFFFFF",
          QR_LINK: process.env.QR_LINK || "https://example.com",
          // File Upload Limit
          MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || "50"),
          // Default to 50MB
          // Advanced settings
          PRIORITY: config.PRIORITY || 2,
          RETRY: config.RETRY || 0,
          RANDOM_METADATA: config.RANDOM_METADATA || 0,
          LINK_PLACEHOLDER: config.LINK_PLACEHOLDER || "{email}",
          // Domain logo
          DOMAIN_LOGO_SIZE: config.DOMAIN_LOGO_SIZE || "50%",
          BORDER_STYLE: config.BORDER_STYLE || "solid",
          BORDER_COLOR: config.BORDER_COLOR || "#000000",
          // ZIP settings
          ZIP_USE: config.ZIP_USE || 0,
          ZIP_PASSWORD: config.ZIP_PASSWORD || "",
          // Proxy settings
          PROXY_USE: config.PROXY_USE || 0,
          PROXY_TYPE: config.TYPE || "socks5",
          PROXY_HOST: config.HOST || "",
          PROXY_PORT: config.PORT || "",
          PROXY_USER: config.USER || "",
          PROXY_PASS: config.PASS || "",
          // SMTP settings
          SMTP: config.SMTP || {}
        };
      }
      // SMTP Rotation Methods
      getCurrentSmtpConfig() {
        if (this.allSmtpConfigs.length === 0) return null;
        if (this.currentSmtpIndex >= this.allSmtpConfigs.length) {
          this.currentSmtpIndex = 0;
        }
        if (this.smtpRotationEnabled && this.allSmtpConfigs.length > 1) {
          return this.allSmtpConfigs[this.currentSmtpIndex];
        }
        return this.allSmtpConfigs[0];
      }
      getAllSmtpConfigs() {
        return this.allSmtpConfigs;
      }
      setSmtpRotationEnabled(enabled) {
        this.smtpRotationEnabled = enabled;
        this.saveRotationState();
      }
      isSmtpRotationEnabled() {
        return this.smtpRotationEnabled;
      }
      rotateToNextSmtp() {
        if (this.allSmtpConfigs.length <= 1) return null;
        this.currentSmtpIndex = (this.currentSmtpIndex + 1) % this.allSmtpConfigs.length;
        this.saveRotationState();
        return this.getCurrentSmtpConfig();
      }
      addSmtpConfig(smtpData) {
        const smtpPath = join(process.cwd(), "config", "smtp.ini");
        let content = "";
        if (existsSync(smtpPath)) {
          content = readFileSync(smtpPath, "utf8");
        }
        const existingIds = this.allSmtpConfigs.map((s) => s.id);
        let nextIndex = 0;
        while (existingIds.includes(`smtp${nextIndex}`)) {
          nextIndex++;
        }
        const smtpId = `smtp${nextIndex}`;
        const newSection = `
[${smtpId}]
host=${smtpData.host}
port=${smtpData.port}
user=${smtpData.user}
pass=${smtpData.pass}
fromEmail=${smtpData.fromEmail}
fromName=${smtpData.fromName || ""}
`;
        writeFileSync(smtpPath, content + newSection, "utf8");
        this.loadConfig();
        return smtpId;
      }
      deleteSmtpConfig(smtpId) {
        const smtpPath = join(process.cwd(), "config", "smtp.ini");
        if (!existsSync(smtpPath)) return false;
        const content = readFileSync(smtpPath, "utf8");
        const lines = content.split("\n");
        let inTargetSection = false;
        const filteredLines = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === `[${smtpId}]`) {
            inTargetSection = true;
            continue;
          }
          if (trimmed.startsWith("[") && trimmed.endsWith("]") && inTargetSection) {
            inTargetSection = false;
          }
          if (!inTargetSection) {
            filteredLines.push(line);
          }
        }
        writeFileSync(smtpPath, filteredLines.join("\n"), "utf8");
        this.loadConfig();
        if (this.currentSmtpIndex >= this.allSmtpConfigs.length) {
          this.currentSmtpIndex = 0;
          this.saveRotationState();
        }
        return true;
      }
    };
    configService = new ConfigService();
  }
});

// server/services/aiService.ts
var aiService_exports = {};
__export(aiService_exports, {
  aiService: () => aiService
});
import { GoogleGenerativeAI } from "@google/generative-ai";
var AIService, aiService;
var init_aiService = __esm({
  "server/services/aiService.ts"() {
    "use strict";
    AIService = class {
      constructor() {
        this.geminiClient = null;
        this.apiKey = "";
      }
      initialize(apiKey) {
        try {
          if (!apiKey || !apiKey.startsWith("AIzaSy")) {
            console.warn("[AIService] Invalid Google AI API key provided");
            return false;
          }
          if (this.geminiClient && this.apiKey === apiKey) {
            console.log("[AIService] Already initialized with this key");
            return true;
          }
          this.apiKey = apiKey;
          const genAI = new GoogleGenerativeAI(apiKey);
          this.geminiClient = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
          console.log("[AIService] Initialized with Google Gemini, key:", apiKey.substring(0, 10) + "...");
          return true;
        } catch (error) {
          console.error("[AIService] Initialization failed:", error);
          return false;
        }
      }
      async generateSubject(context) {
        if (!this.geminiClient) {
          throw new Error("AI Service not initialized. Please provide a Google AI API key.");
        }
        try {
          const prompt = `Analyze this email HTML content and generate a matching subject line for ${context.recipient}:

EMAIL CONTENT:
${context.htmlContent || "No content provided"}

${context.originalSubject ? `Original subject: "${context.originalSubject}"` : ""}
${context.industry ? `Industry: ${context.industry}` : ""}

IMPORTANT RULES:
- Subject MUST match the content and tone of the HTML
- Do NOT use placeholder text like [Your Name], [City], [Region], etc.
- Use only concrete, specific values that align with the email content
- Keep any actual values from the original subject
- Make it personalized, professional, and attention-grabbing
- Return ONLY the subject line, nothing else`;
          const result = await this.geminiClient.generateContent(prompt);
          const generated = result.response.text().trim();
          if (!generated) {
            throw new Error("AI failed to generate subject");
          }
          return generated;
        } catch (error) {
          console.error("[AIService] Subject generation failed:", error);
          throw new Error("AI subject generation failed. Please check your AI configuration.");
        }
      }
      async generateSenderName(context) {
        if (!this.geminiClient) {
          throw new Error("AI Service not initialized. Please provide a Google AI API key.");
        }
        try {
          const prompt = `Analyze this email HTML content and generate a sender name that matches the content:

EMAIL CONTENT:
${context.htmlContent || "No content provided"}

${context.originalName ? `Original name: "${context.originalName}"` : ""}
${context.tone ? `Tone: ${context.tone}` : "Professional and trustworthy"}

IMPORTANT RULES:
- Sender name MUST match the email content and industry/context
- Return ONLY an actual full name (First Last)
- Do NOT use placeholder text like [Name], [Your Name], etc.
- Use a real-sounding name that fits the email's purpose
- No brackets, no placeholders, just a clean name`;
          const result = await this.geminiClient.generateContent(prompt);
          const generated = result.response.text().trim();
          if (!generated) {
            throw new Error("AI failed to generate sender name");
          }
          return generated;
        } catch (error) {
          console.error("[AIService] Sender name generation failed:", error);
          throw new Error("AI sender name generation failed. Please check your AI configuration.");
        }
      }
      async generateContent(prompt) {
        if (!this.geminiClient) {
          throw new Error("AI Service not initialized. Please provide a Google AI API key.");
        }
        try {
          const result = await this.geminiClient.generateContent(prompt);
          return result.response.text().trim();
        } catch (error) {
          console.error("[AIService] Content generation failed:", error);
          throw error;
        }
      }
      async generatePlaceholder(type, context) {
        if (!this.geminiClient) {
          throw new Error("AI Service not initialized. Please provide a Google AI API key.");
        }
        try {
          const prompts = {
            firstname: "Generate a realistic first name. Return ONLY the name, nothing else.",
            lastname: "Generate a realistic last name. Return ONLY the name, nothing else.",
            company: "Generate a realistic company name. Return ONLY the company name, nothing else.",
            domain: "Generate a realistic domain name (e.g., example.com). Return ONLY the domain, nothing else.",
            title: "Generate a realistic professional job title. Return ONLY the title, nothing else."
          };
          const prompt = context ? `${prompts[type]} Context: ${context}` : prompts[type];
          const result = await this.geminiClient.generateContent(prompt);
          const generated = result.response.text().trim();
          if (!generated) {
            throw new Error(`AI failed to generate ${type}`);
          }
          return generated;
        } catch (error) {
          console.error(`[AIService] Placeholder ${type} generation failed:`, error);
          throw new Error(`AI placeholder generation failed for ${type}`);
        }
      }
      deinitialize() {
        this.geminiClient = null;
        this.apiKey = "";
        console.log("[AIService] AI service deinitialized");
        return true;
      }
      isInitialized() {
        return this.geminiClient !== null;
      }
      getStatus() {
        return {
          initialized: this.geminiClient !== null,
          hasApiKey: this.apiKey.length > 0,
          provider: "gemini"
        };
      }
    };
    aiService = new AIService();
  }
});

// server/services/advancedEmailService.ts
var advancedEmailService_exports = {};
__export(advancedEmailService_exports, {
  AdvancedEmailService: () => AdvancedEmailService,
  advancedEmailService: () => advancedEmailService,
  injectDynamicPlaceholders: () => injectDynamicPlaceholders,
  replacePlaceholders: () => replacePlaceholders
});
import nodemailer from "nodemailer";
import { readFileSync as readFileSync2, existsSync as existsSync2, statSync, readdirSync, writeFileSync as writeFileSync2 } from "fs";
import { join as join2, basename } from "path";
import QRCode from "qrcode";
import crypto from "crypto";
import axios from "axios";
import puppeteer from "puppeteer";
import { htmlToText } from "html-to-text";
import AdmZip from "adm-zip";
import * as htmlDocx from "html-docx-js";
import { Jimp } from "jimp";
async function composeQrWithHiddenImage(qrBuffer, hiddenImageBuffer, hiddenImageSize, qrDisplayWidth) {
  try {
    const qrImage = await Jimp.read(qrBuffer);
    const hiddenImage = await Jimp.read(hiddenImageBuffer);
    const displayWidth = qrDisplayWidth || qrImage.bitmap.width;
    const scale = qrImage.bitmap.width / displayWidth;
    const targetWidth = Math.round(hiddenImageSize * scale);
    const maxWidth = Math.round(qrImage.bitmap.width * 0.35);
    const finalWidth = Math.min(targetWidth, maxWidth);
    hiddenImage.resize({ w: finalWidth });
    const xPos = Math.floor((qrImage.bitmap.width - hiddenImage.bitmap.width) / 2);
    const yPos = Math.floor((qrImage.bitmap.height - hiddenImage.bitmap.height) / 2);
    qrImage.composite(hiddenImage, xPos, yPos, {
      opacitySource: 1,
      opacityDest: 1
    });
    console.log(`[QR Compose] Resized hidden image: ${hiddenImageSize}px -> ${finalWidth}px (scale: ${scale.toFixed(2)}, QR: ${qrImage.bitmap.width}px, display: ${displayWidth}px)`);
    return await qrImage.getBuffer("image/png");
  } catch (error) {
    console.error("[QR Compose] Failed to composite hidden image:", error);
    return qrBuffer;
  }
}
async function getAIGeneratedValue(type, context) {
  try {
    if (aiService.isInitialized()) {
      return await aiService.generatePlaceholder(type, context);
    }
    console.log(`[Placeholder AI] AI not initialized, skipping ${type} placeholder`);
    return "";
  } catch (error) {
    console.log(`[Placeholder AI] Failed to generate ${type}, skipping placeholder:`, error instanceof Error ? error.message : error);
    return "";
  }
}
async function pickRand(type, emailKey) {
  if (!aiGeneratedCache.has(emailKey)) {
    aiGeneratedCache.set(emailKey, /* @__PURE__ */ new Map());
  }
  const cache = aiGeneratedCache.get(emailKey);
  if (!cache.has(type)) {
    const value = await getAIGeneratedValue(type);
    cache.set(type, value);
  }
  return cache.get(type);
}
async function injectDynamicPlaceholders(text2, user, email, dateStr, timeStr) {
  if (!text2) return "";
  const username = user?.split("@")[0] || "";
  const domain = user?.split("@")[1] || "";
  const domainBase = domain?.split(".")[0] || "";
  const initials = username.split(/[^a-zA-Z]/).map((p) => p[0]?.toUpperCase()).join("");
  const userId = Math.abs(username.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)).toString().slice(0, 6);
  const fullName = username.replace(/[._-]/g, " ").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  const firstName = fullName.split(" ")[0] || username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  const fullNameUpper = fullName.toUpperCase();
  const emailKey = `${user}_${Date.now()}`;
  const randfirst = await pickRand("firstname", emailKey);
  const randlast = await pickRand("lastname", emailKey);
  const randname = `${randfirst} ${randlast}`;
  const randcompany = await pickRand("company", emailKey);
  const randdomain = await pickRand("domain", emailKey);
  const randtitle = await pickRand("title", emailKey);
  text2 = text2.replace(/{name}/g, fullName).replace(/{Name}/g, firstName).replace(/{NAME}/g, fullNameUpper).replace(/{user}/g, username).replace(/{User}/g, username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()).replace(/{USER}/g, username.toUpperCase()).replace(/{email}/g, user.toLowerCase()).replace(/{Email}/g, username.charAt(0).toUpperCase() + username.slice(1).toLowerCase() + "@" + domain.toLowerCase()).replace(/{EMAIL}/g, user.toUpperCase()).replace(/{senderemail}/g, email).replace(/{date}/g, dateStr).replace(/{time}/g, timeStr).replace(/{username}/g, username).replace(/{domain}/g, domain.toLowerCase()).replace(/{Domain}/g, domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase()).replace(/{DOMAIN}/g, domain.toUpperCase()).replace(/{domainbase}/g, domainBase.toLowerCase()).replace(/{host}/g, domainBase.toLowerCase()).replace(/{Host}/g, domainBase.charAt(0).toUpperCase() + domainBase.slice(1).toLowerCase()).replace(/{HOST}/g, domainBase.toUpperCase()).replace(/{initials}/g, initials).replace(/{userid}/g, userId);
  text2 = text2.replace(/{randfirst}/g, randfirst).replace(/{randlast}/g, randlast).replace(/{randname}/g, randname).replace(/{randcompany}/g, randcompany).replace(/{randdomain}/g, randdomain).replace(/{randtitle}/g, randtitle);
  text2 = text2.replace(/\{mename\}/g, username);
  text2 = text2.replace(/\{mename3\}/g, username.slice(0, 3));
  text2 = text2.replace(/\{emailb64\}/g, Buffer.from(user).toString("base64"));
  text2 = text2.replace(/\{xemail\}/g, username.charAt(0) + "***@" + domain);
  const aiRandomName = await pickRand("firstname", emailKey) + " " + await pickRand("lastname", emailKey);
  text2 = text2.replace(/\{randomname\}/g, aiRandomName);
  const datetime = `${dateStr} ${timeStr}`;
  text2 = text2.replace(/\{userb64\}/g, Buffer.from(username).toString("base64")).replace(/\{nameb64\}/g, Buffer.from(fullName).toString("base64")).replace(/\{domainb64\}/g, Buffer.from(domain).toString("base64")).replace(/\{dateb64\}/g, Buffer.from(dateStr).toString("base64")).replace(/\{timeb64\}/g, Buffer.from(timeStr).toString("base64")).replace(/\{datetimeb64\}/g, Buffer.from(datetime).toString("base64")).replace(/\{senderemailb64\}/g, Buffer.from(email).toString("base64")).replace(/\{randfirstb64\}/g, Buffer.from(randfirst).toString("base64")).replace(/\{randlastb64\}/g, Buffer.from(randlast).toString("base64")).replace(/\{randnameb64\}/g, Buffer.from(randname).toString("base64")).replace(/\{randcompanyb64\}/g, Buffer.from(randcompany).toString("base64")).replace(/\{randdomainb64\}/g, Buffer.from(randdomain).toString("base64")).replace(/\{randtitleb64\}/g, Buffer.from(randtitle).toString("base64"));
  return text2;
}
function replacePlaceholders(str) {
  str = str.replace(/\{randnum(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    let num = "";
    while (num.length < n) num += Math.floor(Math.random() * 10);
    return num.slice(0, n);
  });
  str = str.replace(/\{hash(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    return crypto.randomBytes(Math.ceil(n / 2)).toString("hex").slice(0, n);
  });
  str = str.replace(/\{randchar(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    let chars = "";
    while (chars.length < n) {
      chars += Math.random().toString(36).charAt(2) || "x";
    }
    return chars.slice(0, n);
  });
  str = str.replace(/\{randomnum(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    let num = "";
    while (num.length < n) num += Math.floor(Math.random() * 10);
    return num.slice(0, n);
  });
  return str;
}
function buildQrOpts(C) {
  return {
    width: C.QR_WIDTH,
    margin: 4,
    errorCorrectionLevel: "H"
  };
}
var aiGeneratedCache, defaultConfig, AdvancedEmailService, advancedEmailService;
var init_advancedEmailService = __esm({
  "server/services/advancedEmailService.ts"() {
    "use strict";
    init_configService();
    init_aiService();
    aiGeneratedCache = /* @__PURE__ */ new Map();
    defaultConfig = {
      QR_WIDTH: 200,
      QR_BORDER_WIDTH: 2,
      QR_BORDER_COLOR: "#000000",
      QR_FOREGROUND_COLOR: "#000000",
      QR_BACKGROUND_COLOR: "#FFFFFF",
      BORDER_STYLE: "solid",
      BORDER_COLOR: "#000000",
      QR_LINK: "https://example.com",
      LINK_PLACEHOLDER: "",
      HTML2IMG_BODY: false,
      RANDOM_METADATA: false,
      HIDDEN_IMAGE_FILE: "",
      HIDDEN_IMAGE_SIZE: 50,
      HIDDEN_TEXT: "",
      QRCODE: false,
      CALENDAR_MODE: false,
      PROCESS_ATTACHMENT_PLACEHOLDERS: true,
      // Enable placeholder processing in attachments by default
      SLEEP: 3,
      EMAIL_PER_SECOND: 5,
      ZIP_USE: false,
      ZIP_PASSWORD: "",
      FILE_NAME: "attachment",
      HTML_CONVERT: [],
      // pdf
      // Hidden text overlay removed - image overlay only
      DOMAIN_LOGO_SIZE: "70%",
      PRIORITY: "normal",
      // Fix 1: Add missing PRIORITY
      RETRY: 0,
      // Fix 1: Add missing RETRY
      TEMPLATE_ROTATION: 0,
      // Template rotation: 0=disabled, 1=enabled
      PROXY: {
        PROXY_USE: 0,
        TYPE: "socks5",
        HOST: "",
        PORT: "",
        USER: "",
        PASS: ""
      }
    };
    AdvancedEmailService = class _AdvancedEmailService {
      constructor() {
        this.browserPool = [];
        this.isPaused = false;
        this.concurrencyLimit = 3;
        // Activity Tracking - prevents cleanup during active operations
        this.activeOperations = /* @__PURE__ */ new Set();
        this.activeCampaigns = /* @__PURE__ */ new Map();
        // Improvement 2: Memory monitoring
        this.memoryThreshold = 800 * 1024 * 1024;
        // 800MB
        this.lastMemoryCheck = 0;
        this.memoryCheckInterval = 3e4;
        // 30 seconds
        // Improvement 3: Gradual Adaptive rate limiting
        this.smtpResponseTimes = [];
        this.currentRateLimit = 5;
        this.maxRateLimit = 20;
        this.minRateLimit = 1;
        this.rateChangeStep = 0.5;
        // Gradual rate changes
        // Improvement 4: Progress tracking
        this.progressMetrics = {
          startTime: 0,
          emailsSent: 0,
          emailsFailed: 0,
          totalEmails: 0,
          avgResponseTime: 0,
          estimatedTimeRemaining: 0
        };
        // Improvement 5: Template Management
        this.templateCache = /* @__PURE__ */ new Map();
        // Progress logging array - to store campaign progress logs
        this.progressLogs = [];
        // Browser pool synchronization
        this.browserPoolLock = false;
        // Improvement 3: Adaptive Rate Limiting (Queue-based)
        this.rateLimitQueue = [];
        this.rateLimitProcessing = false;
        // QR caching with cache locking and size limits
        this.qrCache = /* @__PURE__ */ new Map();
        this.qrCacheLocks = /* @__PURE__ */ new Set();
        // Cache locking mechanism
        this.maxCacheSize = 100;
        // Add proper logo cache with cross-domain support
        this.logoCache = /* @__PURE__ */ new Map();
        this.logoCacheTTL = 3e5;
        // QR generation promise queue to prevent race conditions
        this.qrGenerationPromises = /* @__PURE__ */ new Map();
        // Converters registry - exact clone
        this.converters = {
          html: this.convertHtmlToHtml.bind(this),
          pdf: this.convertHtmlToPdf.bind(this),
          png: this.convertHtmlToImage.bind(this),
          docx: this.htmlToDocxStandalone.bind(this)
        };
        // Control methods - exact clone
        this.isCancelled = false;
        if (_AdvancedEmailService.instance) {
          console.log("Multiple AdvancedEmailService instances detected! Using existing instance.");
          return _AdvancedEmailService.instance;
        }
        console.log("AdvancedEmailService initialized");
        this.startMemoryMonitoring();
        _AdvancedEmailService.instance = this;
      }
      static {
        this.instance = null;
      }
      // Improvement 1: Browser Pool Management (Thread-safe)
      async getBrowserFromPool() {
        const operationId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeOperations.add(operationId);
        try {
          console.log("[Browser Pool] Creating fresh browser instance (pooling disabled)");
          const browser = await this.launchBrowser({});
          return { browser, operationId };
        } catch (error) {
          this.activeOperations.delete(operationId);
          console.error("[Browser Pool] Failed to create browser:", {
            operationId,
            error: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
      }
      async releaseBrowserFromPool(browserInfo) {
        let browser, operationId;
        if (browserInfo && typeof browserInfo === "object" && browserInfo.browser) {
          browser = browserInfo.browser;
          operationId = browserInfo.operationId;
        } else {
          browser = browserInfo;
          operationId = null;
        }
        try {
          if (browser && typeof browser.close === "function") {
            await browser.close();
            console.log("[Browser Cleanup] Browser closed successfully", { operationId });
          }
        } catch (error) {
          console.error("[Browser Cleanup] Failed to close browser:", {
            operationId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        if (operationId) {
          this.activeOperations.delete(operationId);
          console.debug("[Browser Cleanup] Released operation", { operationId, activeOperations: this.activeOperations.size });
        }
      }
      // Improvement 2: Memory Monitoring
      startMemoryMonitoring() {
        setInterval(() => {
          const memUsage = process.memoryUsage();
          if (memUsage.heapUsed > this.memoryThreshold) {
            console.log("High memory usage detected:", memUsage);
            this.cleanupBrowserPool();
          }
          if (Date.now() - this.lastMemoryCheck > 3e5) {
            console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: "info", message: "Memory status", data: { memUsage, browserPoolSize: this.browserPool.length }, memory: memUsage, pid: process.pid }));
            this.lastMemoryCheck = Date.now();
          }
        }, this.memoryCheckInterval);
      }
      async cleanupBrowserPool() {
        while (this.browserPoolLock) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        this.browserPoolLock = true;
        try {
          const now = Date.now();
          const staleThreshold = 3e5;
          let cleaned = 0;
          if (this.activeOperations.size > 3) {
            console.log("High activity detected, performing partial cleanup", { activeCount: this.activeOperations.size });
          }
          for (let i = this.browserPool.length - 1; i >= 0; i--) {
            const pool = this.browserPool[i];
            if (pool.activePages === 0 && now - pool.lastUsed > staleThreshold) {
              try {
                await pool.instance.close();
                this.browserPool.splice(i, 1);
                cleaned++;
                console.log("Cleaned up stale browser", {
                  poolIndex: i,
                  remaining: this.browserPool.length,
                  totalCleaned: cleaned
                });
              } catch (error) {
                console.error("Error closing browser during cleanup:", {
                  poolIndex: i,
                  lastUsed: new Date(pool.lastUsed).toISOString(),
                  error: error instanceof Error ? error.message : String(error)
                });
                this.browserPool.splice(i, 1);
              }
            }
          }
        } finally {
          this.browserPoolLock = false;
        }
      }
      updateRateLimit(responseTime, success) {
        this.rateLimitQueue.push({ responseTime, success });
        if (!this.rateLimitProcessing) {
          this.processRateLimitQueue();
        }
      }
      async processRateLimitQueue() {
        if (this.rateLimitProcessing) return;
        this.rateLimitProcessing = true;
        try {
          while (this.rateLimitQueue.length > 0) {
            const updates = this.rateLimitQueue.splice(0);
            for (const { responseTime, success } of updates) {
              this.smtpResponseTimes.push(responseTime);
              if (this.smtpResponseTimes.length > 10) {
                this.smtpResponseTimes.shift();
              }
              if (this.smtpResponseTimes.length > 0) {
                const avgResponseTime = this.smtpResponseTimes.reduce((a, b) => a + b, 0) / this.smtpResponseTimes.length;
                const oldRate = this.currentRateLimit;
                if (success && avgResponseTime < 2e3) {
                  this.currentRateLimit = Math.min(this.maxRateLimit, this.currentRateLimit + this.rateChangeStep);
                } else if (!success || avgResponseTime > 5e3) {
                  this.currentRateLimit = Math.max(this.minRateLimit, this.currentRateLimit - this.rateChangeStep);
                }
                if (Math.abs(this.currentRateLimit - oldRate) >= 0.5) {
                  console.debug("Rate limit updated gradually", {
                    oldRate,
                    newRate: this.currentRateLimit,
                    avgResponseTime,
                    success,
                    change: this.currentRateLimit - oldRate,
                    remainingInQueue: this.rateLimitQueue.length
                  });
                }
              }
            }
          }
        } finally {
          this.rateLimitProcessing = false;
        }
      }
      // Improvement 4: Enhanced Progress Tracking
      calculateProgress() {
        const elapsed = Date.now() - this.progressMetrics.startTime;
        const processed = this.progressMetrics.emailsSent + this.progressMetrics.emailsFailed;
        const remaining = this.progressMetrics.totalEmails - processed;
        if (processed > 0) {
          const avgTimePerEmail = elapsed / processed;
          this.progressMetrics.estimatedTimeRemaining = remaining * avgTimePerEmail;
          this.progressMetrics.avgResponseTime = this.smtpResponseTimes.length > 0 ? this.smtpResponseTimes.reduce((a, b) => a + b, 0) / this.smtpResponseTimes.length : 0;
        }
        return {
          processed,
          remaining,
          percentage: processed / this.progressMetrics.totalEmails * 100,
          emailsPerMinute: processed > 0 ? processed / (elapsed / 6e4) : 0,
          estimatedTimeRemaining: this.progressMetrics.estimatedTimeRemaining,
          avgResponseTime: this.progressMetrics.avgResponseTime
        };
      }
      // Improvement 6: Error Recovery with Exponential Backoff
      async retryWithBackoff(operation, maxRetries = 3, initialDelay = 1e3) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              const delay = initialDelay * Math.pow(2, attempt);
              console.warn(`Retry attempt ${attempt + 1}/${maxRetries + 1}`, {
                delay,
                error: lastError.message
              });
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }
        throw lastError;
      }
      // Improvement 7: Configuration Validation
      validateConfig(config) {
        const errors = [];
        if (!config.EMAIL_PER_SECOND || config.EMAIL_PER_SECOND < 1) {
          errors.push("EMAIL_PER_SECOND must be at least 1");
        }
        if (config.QR_WIDTH && (config.QR_WIDTH < 50 || config.QR_WIDTH > 1e3)) {
          errors.push("QR_WIDTH must be between 50 and 1000");
        }
        if (config.SLEEP && config.SLEEP < 0) {
          errors.push("SLEEP cannot be negative");
        }
        return {
          isValid: errors.length === 0,
          errors
        };
      }
      // Improvement 9: Smart Batching
      calculateOptimalBatchSize(totalEmails, serverPerformance) {
        const baseSize = this.currentRateLimit;
        const performanceMultiplier = serverPerformance > 2e3 ? 0.5 : 1.5;
        const optimal = Math.floor(baseSize * performanceMultiplier);
        return Math.max(1, Math.min(optimal, Math.ceil(totalEmails / 10)));
      }
      // Limit cache size to prevent memory issues
      // Clear all caches with safety check
      clearCaches() {
        if (this.qrCacheLocks.size > 0 || this.activeOperations.size > 0) {
          console.log("[Cache] Deferring clear - operations in progress");
          setTimeout(() => this.clearCaches(), 5e3);
          return;
        }
        const qrCount = this.qrCache.size;
        const logoCount = this.logoCache.size;
        this.qrCache.clear();
        this.logoCache.clear();
        console.log(`[Cache] Safely cleared ${qrCount} QR entries and ${logoCount} logo entries from cache`);
        if (global.gc) {
          global.gc();
          console.log("[Cache] Forced garbage collection");
        }
      }
      // 5 minutes cache
      async fetchDomainLogo(domain, skipCache = false) {
        if (!domain || typeof domain !== "string") return null;
        if (!skipCache) {
          const cached = this.logoCache.get(domain);
          if (cached && Date.now() - cached.timestamp < this.logoCacheTTL) {
            console.log(`[fetchDomainLogo] Using cached logo for ${domain}`);
            return cached.buffer;
          }
        }
        console.log(`[fetchDomainLogo] Fetching fresh logo for ${domain}`);
        const logoSources = [
          // Clearbit - highest quality real company logos (13KB+)
          `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=200&format=png&greyscale=false`,
          // Google Favicons - returns actual favicons from websites (NOT generated placeholders)
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
          // DuckDuckGo Icons - returns actual website icons (NOT generated placeholders)
          `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
          // Favicone API - good quality but can timeout
          `https://favicone.com/${encodeURIComponent(domain)}?s=200`
          // NOTE: Uplead and IconHorse often return GENERATED letter placeholders - deprioritized
          // `https://logo.uplead.com/${encodeURIComponent(domain)}`, // Returns tiny letter placeholders
          // `https://icon.horse/icon/${encodeURIComponent(domain)}`, // Returns generated letter icons
        ];
        for (const url of logoSources) {
          try {
            console.log(`[fetchDomainLogo] Trying ${domain} logo from:`, url);
            const response = await axios.get(url, {
              responseType: "arraybuffer",
              timeout: 2e3,
              // Reduced timeout for faster fallback to next source
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; EmailClient/1.0)",
                "Accept": "image/png,image/jpeg,image/webp,image/*,*/*;q=0.8"
              }
            });
            if (response.status === 200 && response.data) {
              const buffer = Buffer.from(response.data);
              let minSize = 800;
              if (url.includes("clearbit.com")) {
                minSize = 2e3;
              } else if (url.includes("google.com/s2/favicons") || url.includes("duckduckgo.com")) {
                minSize = 500;
              } else if (url.includes("favicone.com")) {
                minSize = 800;
              }
              if (buffer.length > minSize) {
                console.log(`[fetchDomainLogo] Successfully fetched ${domain} logo (${buffer.length} bytes) from source: ${url}`);
                this.logoCache.set(domain, {
                  buffer,
                  timestamp: Date.now(),
                  domain
                });
                return buffer;
              } else {
                console.log(`[fetchDomainLogo] Logo too small (${buffer.length} bytes, min: ${minSize}), trying next source`);
              }
            }
          } catch (error) {
            console.log(`[fetchDomainLogo] Failed to fetch from ${url}:`, error instanceof Error ? error.message : error);
            continue;
          }
        }
        console.log(`[fetchDomainLogo] All logo sources failed for ${domain}`);
        this.logoCache.set(domain, {
          buffer: null,
          timestamp: Date.now(),
          domain
        });
        return null;
      }
      // QR Code generation with proper synchronization
      async generateQRCodeInternal(link, C) {
        if (!link || typeof link !== "string") return null;
        const cacheKey = `${link}_${C.QR_WIDTH || 200}_${C.QR_FOREGROUND_COLOR || "#000000"}_${C.QR_BACKGROUND_COLOR || "#FFFFFF"}`;
        if (this.qrCache.has(cacheKey)) {
          console.log(`[QR Generation] Using cached QR code`);
          return this.qrCache.get(cacheKey);
        }
        if (this.qrGenerationPromises.has(cacheKey)) {
          console.log(`[QR Generation] Waiting for existing generation`);
          return this.qrGenerationPromises.get(cacheKey);
        }
        const generationPromise = this.generateQRCodeInternalActual(link, C, cacheKey);
        this.qrGenerationPromises.set(cacheKey, generationPromise);
        try {
          return await generationPromise;
        } finally {
          this.qrGenerationPromises.delete(cacheKey);
        }
      }
      async generateQRCodeInternalActual(link, C, cacheKey) {
        this.qrCacheLocks.add(cacheKey);
        try {
          const foregroundColor = C.QR_FOREGROUND_COLOR || "#000000";
          const backgroundColor = C.QR_BACKGROUND_COLOR || "#FFFFFF";
          console.log(`[QR Generation] Using colors - Foreground: ${foregroundColor}, Background: ${backgroundColor}`);
          const buffer = await QRCode.toBuffer(link, {
            width: C.QR_WIDTH || 200,
            margin: 4,
            errorCorrectionLevel: "H",
            color: {
              dark: foregroundColor,
              light: backgroundColor
            }
          });
          if (this.qrCache.size >= this.maxCacheSize) {
            const firstKey = this.qrCache.keys().next().value;
            if (firstKey !== void 0) {
              this.qrCache.delete(firstKey);
            }
          }
          this.qrCache.set(cacheKey, buffer);
          console.log(`[QR Generation] Generated and cached QR code`);
          console.debug("Generated QR code with custom colors", {
            link: link.substring(0, 50),
            foregroundColor,
            backgroundColor
          });
          return buffer;
        } catch (error) {
          console.error("Error generating QR code", { error, link });
          return null;
        } finally {
          this.qrCacheLocks.delete(cacheKey);
        }
      }
      // Extract domain from email address
      extractDomainFromEmail(email) {
        if (!email || typeof email !== "string") return null;
        const match = email.match(/@([^@]+)$/);
        return match ? match[1] : null;
      }
      // Random helper functions - exact clone from main.js
      randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
      }
      randomHex(len) {
        return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      }
      // Launch browser with proxy support - IMPROVED VERSION with pooling
      async launchBrowser(C = {}) {
        const launchOptions = {
          headless: true,
          protocolTimeout: 6e4,
          // Increase timeout to 60 seconds
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-plugins",
            "--disable-images",
            "--disable-javascript",
            "--disable-gpu",
            "--no-first-run",
            "--disable-web-security",
            "--memory-pressure-off",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--no-zygote"
            // Disable zygote process
          ]
        };
        try {
          const { execSync: execSync2 } = await import("child_process");
          const chromiumPath = execSync2('which chromium 2>/dev/null || echo ""', {
            encoding: "utf-8",
            env: process.env
          }).trim();
          if (chromiumPath && chromiumPath !== "") {
            launchOptions.executablePath = chromiumPath;
            console.log("Using system Chromium:", chromiumPath);
          } else {
            console.log("System Chromium not found, using Puppeteer bundled Chrome");
          }
        } catch (err) {
          console.log("Falling back to Puppeteer bundled Chrome");
        }
        if (C.PROXY && C.PROXY.PROXY_USE === 1) {
          const proxyHost = C.PROXY.HOST || "";
          const proxyPort = C.PROXY.PORT || "";
          if (proxyHost && proxyPort) {
            const scheme = (C.PROXY.TYPE || "socks5").toLowerCase();
            launchOptions.args.push(`--proxy-server=${scheme}://${proxyHost}:${proxyPort}`);
            console.info("Using proxy", { scheme, host: proxyHost, port: proxyPort });
          }
        }
        let browser;
        try {
          browser = await puppeteer.launch(launchOptions);
          console.log("Browser launched successfully");
        } catch (error) {
          console.error("Browser launch failed", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : void 0
          });
          throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (C.PROXY && C.PROXY.PROXY_USE === 1 && C.PROXY.USER && C.PROXY.PASS) {
          const pages = await browser.pages();
          const page = pages.length ? pages[0] : await browser.newPage();
          await page.authenticate({ username: C.PROXY.USER, password: C.PROXY.PASS });
          console.log("Proxy authentication configured");
        }
        return browser;
      }
      // HTML to PDF conversion - IMPROVED with fallback handling
      async convertHtmlToPdf(html) {
        if (typeof html !== "string" || !html.trim()) {
          throw new Error("Invalid HTML input for PDF conversion");
        }
        let browserInfo = await this.getBrowserFromPool();
        let browser, page = null;
        let usingPool = true;
        if (!browserInfo) {
          browser = await this.launchBrowser({});
          usingPool = false;
        } else if (typeof browserInfo === "object" && browserInfo.browser) {
          browser = browserInfo.browser;
        } else {
          browser = browserInfo;
          usingPool = false;
        }
        try {
          page = await Promise.race([
            browser.newPage(),
            new Promise(
              (_, reject) => setTimeout(() => reject(new Error("Page creation timeout")), 3e4)
            )
          ]);
          await page.setRequestInterception(true);
          page.on("request", (req) => {
            const url = req.url();
            if (url.startsWith("data:") || url.startsWith("about:")) {
              req.continue();
            } else {
              req.abort();
            }
          });
          await page.setCacheEnabled(true);
          await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15e3 });
          const contentDimensions = await page.evaluate(() => {
            const body = document.body;
            const html2 = document.documentElement;
            const width = Math.max(body.scrollWidth, body.offsetWidth, html2.clientWidth, html2.scrollWidth, html2.offsetWidth);
            const height = Math.max(body.scrollHeight, body.offsetHeight, html2.clientHeight, html2.scrollHeight, html2.offsetHeight);
            return { width, height };
          });
          const pdfBuffer = await page.pdf({
            printBackground: true,
            width: `${contentDimensions.width + 20}px`,
            height: `${contentDimensions.height + 20}px`,
            margin: {
              top: "10px",
              bottom: "10px",
              left: "10px",
              right: "10px"
            },
            timeout: 15e3
          });
          if (page) await page.close();
          await this.releaseBrowserFromPool(browserInfo);
          console.debug("PDF conversion completed", { sizeKB: Math.round(pdfBuffer.length / 1024) });
          return pdfBuffer;
        } catch (e) {
          await this.cleanupBrowserResources(page, browser, browserInfo, usingPool, "PDF conversion");
          console.error("PDF conversion failed:", {
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : void 0,
            usingPool,
            hasBrowser: !!browser,
            hasPage: !!page
          });
          throw e;
        }
      }
      // HTML to Image conversion - OPTIMIZED for speed
      async convertHtmlToImage(html) {
        if (typeof html !== "string" || !html.trim()) {
          throw new Error("Invalid HTML input for Image conversion");
        }
        const conversionStart = Date.now();
        console.debug("Image conversion starting", {
          queuePending: this.concurrencyLimit.pendingCount,
          active: this.concurrencyLimit.activeCount,
          timestamp: conversionStart
        });
        let browser = await this.launchBrowser({});
        let page = null;
        let usingPool = false;
        try {
          page = await browser.newPage();
          await page.setViewport({ width: 1123, height: 1587 });
          await page.setCacheEnabled(true);
          await page.setContent(html, { waitUntil: "load", timeout: 5e3 });
          const pngBuffer = await page.screenshot({
            fullPage: true,
            optimizeForSpeed: true,
            captureBeyondViewport: false
          });
          if (page) await page.close();
          await this.releaseBrowserFromPool(browser);
          const conversionEnd = Date.now();
          console.debug("Image conversion completed", {
            sizeKB: Math.round(pngBuffer.length / 1024),
            queuePending: this.concurrencyLimit.pendingCount,
            active: this.concurrencyLimit.activeCount,
            duration: conversionEnd - conversionStart
          });
          return pngBuffer;
        } catch (e) {
          if (page) {
            try {
              await page.close();
            } catch (closeError) {
              console.error("Failed to close page during image conversion cleanup:", closeError);
            }
          }
          if (browser) {
            await this.releaseBrowserFromPool(browser);
          }
          console.error("Image generation failed:", {
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : void 0,
            usingPool,
            hasBrowser: !!browser,
            hasPage: !!page
          });
          throw e;
        }
      }
      // HTML to DOCX conversion - exact clone
      async htmlToDocxStandalone(html) {
        if (typeof html !== "string" || !html.trim()) {
          throw new Error("Cannot convert empty HTML to DOCX");
        }
        try {
          console.log("[htmlToDocxStandalone] Starting DOCX conversion...");
          const docxBlob = htmlDocx.asBlob(html);
          const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());
          console.log("[htmlToDocxStandalone] DOCX conversion successful");
          return docxBuffer;
        } catch (error) {
          console.error("[htmlToDocxStandalone] Error:", error);
          throw error;
        }
      }
      // HTML to HTML conversion - simple pass-through for attachment
      async convertHtmlToHtml(html) {
        if (typeof html !== "string" || !html.trim()) {
          throw new Error("Invalid HTML input for HTML conversion");
        }
        return Buffer.from(html, "utf8");
      }
      // Unified HTML rendering helper - exact clone
      async renderHtml(format, html, C = {}) {
        const fn = this.converters[format];
        if (!fn) throw new Error("Unsupported render format: " + format);
        return await fn(html);
      }
      // Create ZIP buffer - exact clone from main.js
      async createZipBuffer(files, password) {
        const zip = new AdmZip();
        files.forEach((file) => {
          zip.addFile(file.name, file.buffer);
        });
        if (password) {
          console.log("ZIP password requested but not implemented");
        }
        return zip.toBuffer();
      }
      // Generate QR Code with config colors - standardized to use same settings as generateQRCodeInternal
      async generateQRCode(link, C = {}) {
        return await this.generateQRCodeInternal(link, C);
      }
      // Helper: Determine if file extension is text-based and supports placeholder processing
      isTextBasedFile(extension) {
        const textExtensions = ["html", "htm", "txt", "csv", "json", "xml", "md", "text"];
        return textExtensions.includes(extension.toLowerCase());
      }
      // Helper: Read and process attachment file with placeholder replacement
      async processAttachmentFile(filePath, originalFilename, recipient, senderEmail, dateStr, timeStr, maxFileSizeBytes = 1048576) {
        try {
          const stats = statSync(filePath);
          const ext = originalFilename.split(".").pop()?.toLowerCase() || "";
          if (this.isTextBasedFile(ext) && stats.size <= maxFileSizeBytes) {
            console.log(`[Attachment Processing] Reading text file for placeholder replacement: ${originalFilename} (${stats.size} bytes, extension: .${ext})`);
            const rawContent = readFileSync2(filePath, "utf8");
            let processedContent = await injectDynamicPlaceholders(rawContent, recipient, senderEmail, dateStr, timeStr);
            processedContent = replacePlaceholders(processedContent);
            console.log(`[Attachment Processing] Placeholders processed for ${originalFilename}`);
            return { content: Buffer.from(processedContent, "utf8") };
          } else {
            if (stats.size > maxFileSizeBytes) {
              console.log(`[Attachment Processing] File too large for placeholder processing: ${originalFilename} (${stats.size} bytes > ${maxFileSizeBytes} limit)`);
            } else {
              console.log(`[Attachment Processing] Binary file, no placeholder processing: ${originalFilename} (extension: .${ext})`);
            }
            return { path: filePath };
          }
        } catch (error) {
          console.error(`[Attachment Processing] Error reading file ${filePath}:`, error);
          return { path: filePath, error: error instanceof Error ? error.message : String(error) };
        }
      }
      // Complete sendMail function with all advanced features - exact clone
      async sendMail(args, progressCallback) {
        this.isCancelled = false;
        const safeArgs = { ...args };
        if (safeArgs.smtpPass) safeArgs.smtpPass = "[REDACTED]";
        if (safeArgs.proxyPass) safeArgs.proxyPass = "[REDACTED]";
        console.log("Advanced sendMail invoked with args:", safeArgs);
        const sendMailStart = Date.now();
        const campaignId = args.campaignId || `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        process.removeAllListeners("unhandledRejection");
        process.on("unhandledRejection", (reason, promise) => {
          console.error("Unhandled Promise Rejection in sendMail", {
            reason: reason instanceof Error ? reason.message : reason,
            stack: reason instanceof Error ? reason.stack : void 0,
            campaignId
          });
          console.error("Unhandled Promise Rejection:", reason);
        });
        this.activeCampaigns.set(campaignId, {
          startTime: sendMailStart,
          emailCount: args.recipients?.length || 0
        });
        console.info("Campaign started with activity tracking", {
          campaignId,
          emailCount: args.recipients?.length || 0,
          activeOperations: this.activeOperations.size,
          activeCampaigns: this.activeCampaigns.size
        });
        const configData = configService.loadConfig();
        const emailConfig = configService.getEmailConfig();
        const isDesktopMode = args.userSmtpConfigs !== void 0;
        if (emailConfig.SMTP && emailConfig.SMTP.fromEmail) {
          if (!args.senderEmail || args.senderEmail.trim() === "") {
            args.senderEmail = emailConfig.SMTP.fromEmail;
            console.log("[AdvancedEmailService] Auto-applied sender email from config:", args.senderEmail);
          }
          if (!args.smtpHost && emailConfig.SMTP.host) {
            if (isDesktopMode) {
              if (!args.userSmtpConfigs || args.userSmtpConfigs.length === 0) {
                console.error("[Desktop Mode] Desktop users must provide SMTP credentials via local smtp.ini - server SMTP not allowed");
                throw new Error("Desktop mode requires local SMTP configuration. Please configure smtp.ini in your user-package/config directory.");
              }
              console.log("[Desktop Mode] Using user-provided SMTP configurations from userSmtpConfigs");
            } else {
              args.smtpHost = emailConfig.SMTP.host;
              args.smtpPort = emailConfig.SMTP.port || "587";
              args.smtpUser = emailConfig.SMTP.user;
              args.smtpPass = emailConfig.SMTP.pass;
              console.log("[Web Mode] Auto-applied SMTP settings from server config");
            }
          }
        }
        const C = { ...defaultConfig };
        if (emailConfig) {
          Object.keys(emailConfig).forEach((key) => {
            if (key !== "SMTP" && emailConfig[key] !== void 0) {
              C[key] = emailConfig[key];
            }
          });
        }
        if (args.qrForegroundColor) C.QR_FOREGROUND_COLOR = args.qrForegroundColor;
        if (args.qrBackgroundColor) C.QR_BACKGROUND_COLOR = args.qrBackgroundColor;
        console.log("Loaded Config with Border Settings:", {
          BORDER_STYLE: C.BORDER_STYLE,
          BORDER_COLOR: C.BORDER_COLOR,
          QR_BORDER_COLOR: C.QR_BORDER_COLOR,
          QR_FOREGROUND_COLOR: C.QR_FOREGROUND_COLOR,
          QR_BACKGROUND_COLOR: C.QR_BACKGROUND_COLOR,
          RANDOM_METADATA: C.RANDOM_METADATA
        });
        if (args.sleep !== void 0 && !isNaN(Number(args.sleep))) {
          C.SLEEP = Number(args.sleep);
        }
        if (typeof args.qrSize === "number" && args.qrSize > 0) {
          C.QR_WIDTH = args.qrSize;
        }
        C.QR_BORDER_WIDTH = typeof args.qrBorder === "number" && args.qrBorder >= 0 ? args.qrBorder : C.QR_BORDER_WIDTH || 2;
        C.QR_BORDER_COLOR = args.qrBorderColor || C.QR_BORDER_COLOR || "#000000";
        if (typeof args.htmlImgBody === "boolean") {
          C.HTML2IMG_BODY = args.htmlImgBody;
        }
        if (typeof args.qrLink === "string" && args.qrLink.trim()) {
          C.QR_LINK = args.qrLink.trim();
        }
        if (typeof args.linkPlaceholder === "string") {
          C.LINK_PLACEHOLDER = args.linkPlaceholder;
        }
        if (typeof args.randomMetadata === "boolean") {
          C.RANDOM_METADATA = args.randomMetadata;
        }
        if (typeof args.emailPerSecond === "number" && args.emailPerSecond > 0) {
          C.EMAIL_PER_SECOND = args.emailPerSecond;
        }
        if (typeof args.priority === "string" && ["1", "2", "3"].includes(args.priority)) {
          C.PRIORITY = args.priority;
        }
        if (typeof args.retry === "number" && args.retry >= 0) {
          C.RETRY = args.retry;
        } else if (typeof args.retry === "string" && !isNaN(Number(args.retry)) && Number(args.retry) >= 0) {
          C.RETRY = Number(args.retry);
        }
        if (typeof args.zipUse === "boolean") {
          C.ZIP_USE = args.zipUse;
        }
        if (typeof args.zipPassword === "string") {
          C.ZIP_PASSWORD = args.zipPassword;
        }
        if (typeof args.fileName === "string" && args.fileName.trim()) {
          C.FILE_NAME = args.fileName.trim();
        }
        if (typeof args.htmlConvert === "string") {
          C.HTML_CONVERT = args.htmlConvert.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        } else if (args.htmlConvert === "" || args.htmlConvert === null || args.htmlConvert === void 0) {
          C.HTML_CONVERT = [];
        }
        if (typeof args.qrcode === "boolean") {
          C.QRCODE = args.qrcode;
        }
        if (typeof args.calendarMode === "boolean") {
          C.CALENDAR_MODE = args.calendarMode;
        } else if (args.calendarMode === "true" || args.calendarMode === true) {
          C.CALENDAR_MODE = true;
        } else {
          C.CALENDAR_MODE = false;
        }
        if (args.proxyUse === "true" || args.proxyUse === true) {
          C.PROXY.PROXY_USE = 1;
          C.PROXY.TYPE = args.proxyType || "socks5";
          C.PROXY.HOST = args.proxyHost || "";
          C.PROXY.PORT = args.proxyPort || "";
          C.PROXY.USER = args.proxyUser || "";
          C.PROXY.PASS = args.proxyPass || "";
        }
        if (typeof args.hiddenImageFile === "string") {
          C.HIDDEN_IMAGE_FILE = args.hiddenImageFile;
        }
        if (typeof args.hiddenImageSize === "number" && args.hiddenImageSize > 0) {
          C.HIDDEN_IMAGE_SIZE = args.hiddenImageSize;
        }
        if (typeof args.hiddenText === "string") {
          C.HIDDEN_TEXT = args.hiddenText;
        }
        C.DOMAIN_LOGO_SIZE = args.domainLogoSize || C.DOMAIN_LOGO_SIZE || "70%";
        if (typeof args.borderStyle === "string") {
          C.BORDER_STYLE = args.borderStyle;
        }
        if (typeof args.borderColor === "string") {
          C.BORDER_COLOR = args.borderColor;
        }
        let sent = 0;
        let failed = 0;
        let totalRecipients = 0;
        const errors = [];
        let userSmtpRotationIndex = 0;
        const useUserSmtpRotation = args.userSmtpConfigs && args.userSmtpConfigs.length > 0;
        if (useUserSmtpRotation) {
          console.log("[User SMTP] Desktop app provided", args.userSmtpConfigs.length, "SMTP configs, rotation:", args.userSmtpRotationEnabled);
        }
        try {
          let { smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, senderName } = args;
          if (useUserSmtpRotation) {
            const firstUserSmtp = args.userSmtpConfigs[0];
            smtpHost = smtpHost || firstUserSmtp.host;
            smtpPort = smtpPort || firstUserSmtp.port;
            smtpUser = smtpUser || firstUserSmtp.user;
            smtpPass = smtpPass || firstUserSmtp.pass;
            senderEmail = senderEmail || firstUserSmtp.fromEmail;
            senderName = senderName || firstUserSmtp.fromName || "";
          }
          if (!smtpHost || !smtpPort) {
            const missingFields = [];
            if (!smtpHost) missingFields.push("Host");
            if (!smtpPort) missingFields.push("Port");
            console.error("SMTP configuration is incomplete. Missing:", missingFields);
            console.error("SMTP values received:", {
              host: smtpHost,
              port: smtpPort,
              user: smtpUser,
              hasPass: !!smtpPass,
              hasUserSmtpConfigs: useUserSmtpRotation
            });
            throw new Error(`SMTP configuration is incomplete. Missing: ${missingFields.join(", ")}`);
          }
          const host = smtpHost;
          const port = parseInt(smtpPort);
          const user = smtpUser;
          const pass = smtpPass;
          const fromEmail = senderEmail;
          const fromName = senderName || "";
          const secure = port === 465;
          console.log("SMTP Config Loaded:", {
            host,
            port,
            user,
            fromEmail,
            fromName,
            secure,
            authEnabled: !!(user && pass),
            userSmtpRotation: useUserSmtpRotation,
            userSmtpCount: useUserSmtpRotation ? args.userSmtpConfigs.length : 0
          });
          const transporterConfig = {
            host,
            port,
            secure,
            pool: true,
            maxConnections: C.EMAIL_PER_SECOND || 5,
            maxMessages: 100,
            rateLimit: C.EMAIL_PER_SECOND || 5,
            tls: {
              rejectUnauthorized: false
            }
          };
          console.log("[SMTP TLS] TLS config added with rejectUnauthorized: false", { host, port });
          if (user && pass) {
            transporterConfig.auth = { user, pass };
          }
          const transporter = nodemailer.createTransport(transporterConfig);
          const recipients = Array.isArray(args.recipients) && args.recipients.length ? args.recipients : typeof args.recipients === "string" ? args.recipients.split("\n").map((r) => r.trim()).filter((r) => r) : [];
          if (!recipients.length) {
            throw new Error("No recipients provided");
          }
          totalRecipients = recipients.length;
          let bodyHtml = "";
          if (args.bodyHtmlFile && typeof args.bodyHtmlFile === "string" && args.bodyHtmlFile.trim() !== "") {
            bodyHtml = readFileSync2(join2("files", args.bodyHtmlFile), "utf-8");
          } else if (args.html && typeof args.html === "string") {
            bodyHtml = args.html;
          } else {
            bodyHtml = args.html || args.emailContent || "";
          }
          let attachmentHtml = typeof args.attachmentHtml === "string" && args.attachmentHtml.trim() ? args.attachmentHtml : bodyHtml;
          const currentDate = /* @__PURE__ */ new Date();
          const dateStr = currentDate.toISOString().slice(0, 10);
          const timeStr = currentDate.toISOString().slice(11, 19);
          let processedBodyHtml = bodyHtml.replace(/\{senderemail\}/g, args.senderEmail || "").replace(/\{date\}/g, dateStr).replace(/\{time\}/g, timeStr);
          const linkValue = C.LINK_PLACEHOLDER || C.QR_LINK || "";
          processedBodyHtml = processedBodyHtml.replace(/\{linkb64\}/g, Buffer.from(linkValue).toString("base64")).replace(/\{link\}/g, linkValue);
          let processedAttachmentHtml = attachmentHtml.replace(/\{senderemail\}/g, args.senderEmail || "").replace(/\{date\}/g, dateStr).replace(/\{time\}/g, timeStr);
          processedAttachmentHtml = processedAttachmentHtml.replace(/\{linkb64\}/g, Buffer.from(linkValue).toString("base64")).replace(/\{link\}/g, linkValue);
          processedAttachmentHtml = replacePlaceholders(processedAttachmentHtml);
          processedBodyHtml = replacePlaceholders(processedBodyHtml);
          aiGeneratedCache.clear();
          this.concurrencyLimit = C.EMAIL_PER_SECOND || 15;
          let templateHtmlBase = processedBodyHtml;
          const attachmentHtmlBase = processedAttachmentHtml;
          let templateRotationEnabled = args.templateRotation === "true" || args.templateRotation === true || Number(C.TEMPLATE_ROTATION) === 1;
          let rotatingTemplates = [];
          let templateRotationIndex = 0;
          let useDesktopTemplates = false;
          const isDesktopMode2 = args.isDesktopMode === "true" || args.isDesktopMode === true || args.userSmtpConfigs && (typeof args.userSmtpConfigs === "string" || Array.isArray(args.userSmtpConfigs));
          let parsedRotatingTemplates = [];
          if (args.rotatingTemplates) {
            if (typeof args.rotatingTemplates === "string") {
              try {
                parsedRotatingTemplates = JSON.parse(args.rotatingTemplates);
                console.log(`[Template Rotation] Parsed ${parsedRotatingTemplates.length} templates from JSON string`);
              } catch (e) {
                console.warn("[Template Rotation] Failed to parse rotatingTemplates JSON:", e);
              }
            } else if (Array.isArray(args.rotatingTemplates)) {
              parsedRotatingTemplates = args.rotatingTemplates;
            }
          }
          if (parsedRotatingTemplates.length > 0) {
            console.log(`[Template Rotation] Desktop mode - received ${parsedRotatingTemplates.length} templates from client`);
            useDesktopTemplates = true;
            for (const template of parsedRotatingTemplates) {
              if (template.filename && template.content) {
                let processedContent = template.content.replace(/\{senderemail\}/g, args.senderEmail || "").replace(/\{date\}/g, dateStr).replace(/\{time\}/g, timeStr).replace(/\{linkb64\}/g, Buffer.from(linkValue).toString("base64")).replace(/\{link\}/g, linkValue);
                processedContent = replacePlaceholders(processedContent);
                rotatingTemplates.push({ filename: template.filename, content: processedContent });
                console.log(`[Template Rotation] Loaded client template: ${template.filename}`);
              }
            }
            if (rotatingTemplates.length > 1) {
              templateRotationEnabled = true;
              console.log(`[Template Rotation] Desktop mode enabled with ${rotatingTemplates.length} templates: ${rotatingTemplates.map((t) => t.filename).join(", ")}`);
            } else if (rotatingTemplates.length === 1) {
              templateHtmlBase = rotatingTemplates[0].content;
              templateRotationEnabled = false;
              rotatingTemplates = [];
              console.log(`[Template Rotation] Desktop mode - using single template as main body`);
            } else {
              console.log("[Template Rotation] Desktop mode - no valid templates provided, using server default");
              useDesktopTemplates = false;
            }
          } else if (templateRotationEnabled && !isDesktopMode2) {
            console.log("[Template Rotation] Web mode - scanning server files for templates...");
            try {
              const filesDir = join2(process.cwd(), "files");
              if (existsSync2(filesDir)) {
                const allFiles = readdirSync(filesDir);
                const htmlFiles = allFiles.filter((f) => f.endsWith(".html") && f !== "letter.html");
                if (htmlFiles.length > 1) {
                  for (const htmlFile of htmlFiles) {
                    try {
                      const templatePath = join2(filesDir, htmlFile);
                      const rawContent = readFileSync2(templatePath, "utf8");
                      let processedContent = rawContent.replace(/\{senderemail\}/g, args.senderEmail || "").replace(/\{date\}/g, dateStr).replace(/\{time\}/g, timeStr).replace(/\{linkb64\}/g, Buffer.from(linkValue).toString("base64")).replace(/\{link\}/g, linkValue);
                      processedContent = replacePlaceholders(processedContent);
                      rotatingTemplates.push({ filename: htmlFile, content: processedContent });
                      console.log(`[Template Rotation] Loaded server template: ${htmlFile}`);
                    } catch (err) {
                      console.warn(`[Template Rotation] Failed to load template ${htmlFile}:`, err);
                    }
                  }
                  console.log(`[Template Rotation] Web mode enabled with ${rotatingTemplates.length} templates: ${rotatingTemplates.map((t) => t.filename).join(", ")}`);
                } else {
                  console.log(`[Template Rotation] Only ${htmlFiles.length} HTML file(s) found on server, rotation disabled`);
                  templateRotationEnabled = false;
                }
              } else {
                console.log("[Template Rotation] Files directory not found on server, rotation disabled");
                templateRotationEnabled = false;
              }
            } catch (err) {
              console.error("[Template Rotation] Error scanning server templates:", err);
              templateRotationEnabled = false;
            }
          } else if (templateRotationEnabled && isDesktopMode2) {
            console.log("[Template Rotation] Desktop mode - rotation enabled but no local templates provided. Server files will NOT be used. Rotation disabled.");
            templateRotationEnabled = false;
          }
          sent = 0;
          failed = 0;
          errors.length = 0;
          const failedEmails = [];
          console.log("[sendMail] Startup time (ms):", Date.now() - sendMailStart);
          const batchSize = C.EMAIL_PER_SECOND || 15;
          console.log(`[sendMail] Using EMAIL_PER_SECOND: ${batchSize}, SLEEP: ${C.SLEEP}s, PRIORITY: ${C.PRIORITY}, RETRY: ${C.RETRY}`);
          const batches = [];
          for (let i = 0; i < recipients.length; i += batchSize) {
            batches.push(recipients.slice(i, i + batchSize));
          }
          const sleepMs = Math.max(0, (C.SLEEP || 0) * 1e3);
          let batchesProcessed = 0;
          let emailsProcessedInCurrentBatch = 0;
          let campaignStoppedEarly = false;
          let earlyStopReason = "";
          console.log(`[sendMail] Starting batch loop: ${batches.length} batches, ${totalRecipients} total recipients`);
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (this.isCancelled) {
              console.log("[sendMail] Campaign cancelled by user at batch start, stopping...");
              campaignStoppedEarly = true;
              earlyStopReason = "Campaign cancelled by user";
              progressCallback?.({
                type: "cancelled",
                message: "Campaign cancelled by user",
                totalRecipients,
                totalSent: sent,
                totalFailed: failed,
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              });
              break;
            }
            while (this.isPaused && !this.isCancelled) {
              console.log("[sendMail] Currently paused, waiting to resume...");
              await new Promise((r) => setTimeout(r, 500));
            }
            if (this.isCancelled) {
              console.log("[sendMail] Campaign cancelled after pause, stopping...");
              campaignStoppedEarly = true;
              earlyStopReason = "Campaign cancelled after pause";
              progressCallback?.({
                type: "cancelled",
                message: "Campaign cancelled after pause",
                totalRecipients,
                totalSent: sent,
                totalFailed: failed,
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              });
              break;
            }
            const batch = batches[batchIndex];
            emailsProcessedInCurrentBatch = 0;
            console.log(`[Batch ${batchIndex + 1}/${batches.length}] Starting - ${batch.length} recipients (Total processed so far: ${sent + failed}/${totalRecipients})`);
            const batchResults = [];
            for (let i = 0; i < batch.length; i++) {
              if (this.isCancelled) {
                console.log("[sendMail] Campaign cancelled mid-batch, stopping immediately...");
                campaignStoppedEarly = true;
                earlyStopReason = "Campaign cancelled mid-batch";
                progressCallback?.({
                  type: "cancelled",
                  message: "Campaign cancelled mid-batch",
                  totalRecipients,
                  totalSent: sent,
                  totalFailed: failed,
                  timestamp: (/* @__PURE__ */ new Date()).toISOString()
                });
                break;
              }
              const recipient = batch[i];
              let dynamicSubject = args.subject;
              let smtpInfo = null;
              try {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!recipient || !emailRegex.test(recipient)) {
                  const error = "Invalid email format";
                  const currentSmtpForInvalid = configService.getCurrentSmtpConfig();
                  const smtpInfoInvalid = currentSmtpForInvalid ? {
                    id: currentSmtpForInvalid.id,
                    fromEmail: currentSmtpForInvalid.fromEmail,
                    host: currentSmtpForInvalid.host
                  } : {
                    id: "default",
                    fromEmail,
                    host: smtpHost
                  };
                  failed++;
                  progressCallback?.({
                    recipient,
                    subject: args.subject,
                    status: "fail",
                    error,
                    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                    smtp: smtpInfoInvalid,
                    totalRecipients,
                    totalSent: sent,
                    totalFailed: failed
                  });
                  batchResults.push({ success: false, error, recipient });
                  continue;
                }
                let currentSmtpConfig = null;
                let emailFromEmail = fromEmail;
                let emailFromName = fromName;
                let emailTransporter = transporter;
                if (useUserSmtpRotation && args.userSmtpRotationEnabled && args.userSmtpConfigs.length > 1) {
                  currentSmtpConfig = args.userSmtpConfigs[userSmtpRotationIndex];
                  userSmtpRotationIndex = (userSmtpRotationIndex + 1) % args.userSmtpConfigs.length;
                } else if (!useUserSmtpRotation && configService.isSmtpRotationEnabled() && configService.getAllSmtpConfigs().length > 1) {
                  currentSmtpConfig = configService.getCurrentSmtpConfig();
                  configService.rotateToNextSmtp();
                }
                smtpInfo = currentSmtpConfig ? {
                  id: currentSmtpConfig.id,
                  fromEmail: currentSmtpConfig.fromEmail,
                  host: currentSmtpConfig.host
                } : {
                  id: "default",
                  fromEmail,
                  host: smtpHost
                };
                if (currentSmtpConfig) {
                  emailFromEmail = currentSmtpConfig.fromEmail;
                  emailFromName = fromName || senderName || args.senderName || "";
                  console.log(`[SMTP Config Debug] SMTP ${currentSmtpConfig.id}: host=${currentSmtpConfig.host}, port=${currentSmtpConfig.port}, user="${currentSmtpConfig.user}", pass="${currentSmtpConfig.pass ? "***" : "(empty)"}"`);
                  const rotationTransporterConfig = {
                    host: currentSmtpConfig.host,
                    port: parseInt(currentSmtpConfig.port),
                    secure: parseInt(currentSmtpConfig.port) === 465,
                    pool: true,
                    maxConnections: 1,
                    maxMessages: 1,
                    tls: {
                      rejectUnauthorized: false
                    }
                  };
                  console.log(`[SMTP TLS] TLS config added with rejectUnauthorized: false (${currentSmtpConfig.id})`);
                  if (currentSmtpConfig.user && currentSmtpConfig.pass) {
                    console.log(`[SMTP Config Debug] Adding auth for user: ${currentSmtpConfig.user}`);
                    rotationTransporterConfig.auth = {
                      user: currentSmtpConfig.user,
                      pass: currentSmtpConfig.pass
                    };
                  } else {
                    console.log(`[SMTP Config Debug] No auth added (user="${currentSmtpConfig.user}", pass="${currentSmtpConfig.pass ? "***" : "(empty)"}")`);
                  }
                  emailTransporter = nodemailer.createTransport(rotationTransporterConfig);
                  const smtpSource = useUserSmtpRotation ? "[User SMTP]" : "[Server SMTP]";
                  const authStatus = currentSmtpConfig.user && currentSmtpConfig.pass ? "with auth" : "no auth";
                  console.log(`${smtpSource} Using SMTP ${currentSmtpConfig.id} (${currentSmtpConfig.fromEmail}) ${authStatus} with UI sender name "${emailFromName}" for ${recipient}`);
                }
                let currentTemplate = templateHtmlBase;
                if (templateRotationEnabled && rotatingTemplates.length > 0) {
                  const templateEntry = rotatingTemplates[templateRotationIndex % rotatingTemplates.length];
                  currentTemplate = templateEntry.content;
                  console.log(`[Template Rotation] Using template ${templateRotationIndex + 1}/${rotatingTemplates.length}: ${templateEntry.filename} for ${recipient}`);
                  templateRotationIndex++;
                }
                let html = await injectDynamicPlaceholders(currentTemplate, recipient, fromEmail, dateStr, timeStr);
                dynamicSubject = await injectDynamicPlaceholders(args.subject, recipient, fromEmail, dateStr, timeStr);
                let dynamicSenderName = await injectDynamicPlaceholders(emailFromName, recipient, emailFromEmail, dateStr, timeStr);
                dynamicSenderName = replacePlaceholders(dynamicSenderName);
                if (aiService.isInitialized()) {
                  if (args.useAISubject) {
                    try {
                      const aiSubject = await aiService.generateSubject({
                        recipient,
                        originalSubject: dynamicSubject,
                        industry: args.industry,
                        htmlContent: html
                      });
                      dynamicSubject = aiSubject;
                      console.log(`[AI Subject] Generated for ${recipient}: ${aiSubject}`);
                    } catch (aiError) {
                      console.error("[AI Subject] Generation failed, using original subject:", aiError);
                    }
                  }
                  if (args.useAISenderName) {
                    try {
                      const aiSenderName = await aiService.generateSenderName({
                        originalName: dynamicSenderName,
                        tone: args.senderTone || "professional",
                        htmlContent: html
                      });
                      dynamicSenderName = aiSenderName;
                      console.log(`[AI Sender] Generated for ${recipient}: ${aiSenderName}`);
                    } catch (aiError) {
                      console.error("[AI Sender] Generation failed, using original sender name:", aiError);
                    }
                  }
                }
                emailFromName = dynamicSenderName;
                let attHtml = attachmentHtmlBase ? await injectDynamicPlaceholders(attachmentHtmlBase, recipient, fromEmail, dateStr, timeStr) : "";
                const emailAttachments = [];
                if (html.includes("{qrcode}")) {
                  if (C.QRCODE) {
                    console.log("[Main HTML QR] Processing QR code using setup.ini link configuration");
                    let qrContent = C.QR_LINK;
                    if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                      qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, "g"), C.LINK_PLACEHOLDER);
                    }
                    if (C.RANDOM_METADATA) {
                      const rand = crypto.randomBytes(4).toString("hex");
                      qrContent += (qrContent.includes("?") ? "&" : "?") + `_${rand}`;
                    }
                    const qrOpts = buildQrOpts(C);
                    console.log(`[Main HTML QR] QR Options:`, qrOpts);
                    console.log(`[Main HTML QR] QR Configuration:`, { QR_WIDTH: C.QR_WIDTH, QR_BORDER_WIDTH: C.QR_BORDER_WIDTH });
                    try {
                      const qrBuffer = await QRCode.toBuffer(qrContent, {
                        width: C.QR_WIDTH || 200,
                        margin: 4,
                        errorCorrectionLevel: "H",
                        color: {
                          dark: C.QR_FOREGROUND_COLOR || "#000000",
                          light: C.QR_BACKGROUND_COLOR || "#FFFFFF"
                        }
                      });
                      const logoDir = join2("files", "logo");
                      let imgBuf = null;
                      let hasHiddenImage = false;
                      let finalQrBuffer = qrBuffer;
                      try {
                        if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === "string" && C.HIDDEN_IMAGE_FILE.trim() !== "") {
                          const candidatePath = join2(logoDir, C.HIDDEN_IMAGE_FILE);
                          if (existsSync2(candidatePath) && statSync(candidatePath).isFile()) {
                            imgBuf = readFileSync2(candidatePath);
                            hasHiddenImage = Boolean(imgBuf && imgBuf.length);
                            if (hasHiddenImage && imgBuf) {
                              const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
                              const qrDisplayWidth = C.QR_WIDTH || 200;
                              finalQrBuffer = await composeQrWithHiddenImage(qrBuffer, imgBuf, hiddenImgWidth, qrDisplayWidth);
                              console.log(`[Main HTML QR] Composited hidden image into QR buffer for email-safe rendering (size: ${hiddenImgWidth}px, display: ${qrDisplayWidth}px)`);
                            }
                          } else {
                            console.log(`[Main HTML QR] Hidden image file not found: ${candidatePath}`);
                          }
                        } else {
                          console.log(`[Main HTML QR] No hidden image file specified (hiddenImageFile: '${C.HIDDEN_IMAGE_FILE}')`);
                        }
                      } catch (e) {
                        console.warn("[Main HTML QR] Could not read hidden QR image:", e instanceof Error ? e.message : e);
                      }
                      const qrCid = "qrcode-main";
                      emailAttachments.push({
                        content: finalQrBuffer,
                        filename: "qrcode.png",
                        cid: qrCid
                      });
                      console.log(`[Main HTML QR] Generated QR buffer and added as CID attachment: ${qrCid}`);
                      let hiddenImageHtml = "";
                      if (C.HIDDEN_TEXT && C.HIDDEN_TEXT.trim() !== "") {
                        hiddenImageHtml = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%);  padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
                        console.log(`[Main HTML QR] Using hidden text overlay with EXACT main.js positioning: ${C.HIDDEN_TEXT}`);
                      } else {
                        console.log(`[Main HTML QR] No text overlay applied - hidden image composited directly into QR`);
                      }
                      const borderStyle = C.BORDER_STYLE || "solid";
                      const qrBorderColor = C.BORDER_COLOR || "#000000";
                      const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px; margin:10px auto;">
                                  <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                    <img src="cid:${qrCid}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
                                  </a>
                                  ${hiddenImageHtml}
                                </div>`;
                      html = html.replace(/\{qrcode\}/g, qrHtml);
                      console.log(`[Main HTML QR] QR replacement completed using PDF/HTML2IMG_BODY logic for ${recipient}`);
                      console.log(`[Main HTML QR] QR content: ${qrContent}`);
                      console.log(`[Main HTML QR] Generated QR HTML snippet:`, qrHtml.substring(0, 200) + "...");
                    } catch (qrError) {
                      console.error(`[Main HTML QR] QR generation failed:`, qrError);
                      html = html.replace(/\{qrcode\}/g, '<span style="color:red; font-weight:bold;">[QR code generation failed]</span>');
                    }
                  } else {
                    console.log("[Main HTML QR] QR code disabled in settings");
                    html = html.replace(/\{qrcode\}/g, "");
                  }
                }
                let finalHtml = html;
                let finalAttHtml = attHtml;
                const domainFull = recipient.split("@")[1] || "";
                const domainLogoSize = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || "70%";
                if (finalHtml.includes("{domainlogo}")) {
                  console.log(`[Main HTML Domain Logo] Processing domain logo with optimized color logo fetching`);
                  const logoStartTime = Date.now();
                  const fromEmail2 = args.smtpUser || "";
                  const senderDomain = this.extractDomainFromEmail(fromEmail2);
                  const skipCache = senderDomain && senderDomain !== domainFull;
                  if (skipCache) {
                    console.log(`[Main HTML Domain Logo] Cross-domain detected (sender: ${senderDomain}, recipient: ${domainFull}), skipping cache`);
                  }
                  const domainLogoBuffer = await this.fetchDomainLogo(domainFull, !!skipCache);
                  const logoFetchTime = Date.now() - logoStartTime;
                  console.log(`[Main HTML Domain Logo] Logo fetch completed in ${logoFetchTime}ms`);
                  if (domainLogoBuffer) {
                    const logoCid = "domainlogo-main";
                    emailAttachments.push({
                      content: domainLogoBuffer,
                      filename: `${domainFull}-logo.png`,
                      cid: logoCid,
                      contentType: "image/png",
                      contentDisposition: "inline"
                    });
                    const domainLogoHtml = `<img src="cid:${logoCid}" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`;
                    finalHtml = finalHtml.replace(/\{domainlogo\}/g, domainLogoHtml);
                    console.log(`[Main HTML Domain Logo] Successfully replaced domain logo using CID attachment for ${domainFull}`);
                  } else {
                    const fallbackHtml = `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`;
                    finalHtml = finalHtml.replace(/\{domainlogo\}/g, fallbackHtml);
                    console.log(`[Main HTML Domain Logo] Logo unavailable for ${domainFull}, used fallback`);
                  }
                }
                if (args.attachments && args.attachments.length > 0) {
                  for (const attachment of args.attachments) {
                    const filePath = typeof attachment === "string" ? attachment : attachment.path;
                    const originalFilename = typeof attachment === "object" && attachment.filename ? attachment.filename : basename(filePath);
                    const providedContentType = typeof attachment === "object" ? attachment.contentType : null;
                    if (existsSync2(filePath)) {
                      const dotIndex = originalFilename.lastIndexOf(".");
                      const ext = dotIndex > 0 ? originalFilename.substring(dotIndex + 1).toLowerCase() : "";
                      const baseFileName = originalFilename.replace(/\.[^.]+$/, "");
                      let processedFileName = await injectDynamicPlaceholders(baseFileName, recipient, fromEmail, dateStr, timeStr);
                      processedFileName = replacePlaceholders(processedFileName);
                      const filename = ext ? `${processedFileName}.${ext}` : processedFileName;
                      const mimeTypes = {
                        "html": "text/html",
                        "htm": "text/html",
                        "pdf": "application/pdf",
                        "png": "image/png",
                        "jpg": "image/jpeg",
                        "jpeg": "image/jpeg",
                        "gif": "image/gif",
                        "svg": "image/svg+xml",
                        "txt": "text/plain",
                        "csv": "text/csv",
                        "json": "application/json",
                        "xml": "application/xml",
                        "zip": "application/zip",
                        "doc": "application/msword",
                        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "xls": "application/vnd.ms-excel",
                        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "ppt": "application/vnd.ms-powerpoint",
                        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      };
                      const contentType = providedContentType || mimeTypes[ext] || "application/octet-stream";
                      const enablePlaceholderProcessing = C.PROCESS_ATTACHMENT_PLACEHOLDERS !== false;
                      if (enablePlaceholderProcessing) {
                        const processed = await this.processAttachmentFile(filePath, originalFilename, recipient, fromEmail, dateStr, timeStr);
                        if (processed.content) {
                          emailAttachments.push({
                            filename,
                            content: processed.content,
                            contentType,
                            contentDisposition: "attachment"
                          });
                          console.log(`[Attachment] Added ${filename} with placeholder processing (${processed.content.length} bytes)`);
                        } else if (processed.path) {
                          emailAttachments.push({
                            filename,
                            path: processed.path,
                            contentType,
                            contentDisposition: "attachment"
                          });
                          console.log(`[Attachment] Added ${filename} as binary/path-based attachment`);
                        }
                      } else {
                        emailAttachments.push({
                          filename,
                          path: filePath,
                          contentType,
                          contentDisposition: "attachment"
                        });
                        console.log(`[Attachment] Added ${filename} without placeholder processing (disabled)`);
                      }
                    }
                  }
                }
                if (C.HTML2IMG_BODY) {
                  console.log("[HTML2IMG_BODY] Converting HTML body to image using EXACT same QR and domain logo settings flow");
                  try {
                    let screenshotHtml = finalHtml;
                    if (screenshotHtml.includes("cid:qrcode-main")) {
                      if (C.QRCODE) {
                        console.log("[HTML2IMG_BODY] Processing QR using EXACT same settings as main HTML");
                        let qrContent = C.QR_LINK;
                        if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                          qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, "g"), C.LINK_PLACEHOLDER);
                        }
                        if (C.RANDOM_METADATA) {
                          const rand = crypto.randomBytes(4).toString("hex");
                          qrContent += (qrContent.includes("?") ? "&" : "?") + `_${rand}`;
                        }
                        const qrDataUrl = await QRCode.toDataURL(qrContent, {
                          width: C.QR_WIDTH || 200,
                          margin: 4,
                          errorCorrectionLevel: "H",
                          color: {
                            dark: C.QR_FOREGROUND_COLOR || "#000000",
                            light: C.QR_BACKGROUND_COLOR || "#FFFFFF"
                          }
                        });
                        let hiddenOverlay = "";
                        const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
                        const logoDir = join2("files", "logo");
                        let attImgBuf = null;
                        let hasAttHiddenImage = false;
                        try {
                          if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === "string" && C.HIDDEN_IMAGE_FILE.trim() !== "") {
                            const candidatePath = join2(logoDir, C.HIDDEN_IMAGE_FILE);
                            if (existsSync2(candidatePath) && statSync(candidatePath).isFile()) {
                              attImgBuf = readFileSync2(candidatePath);
                              hasAttHiddenImage = Boolean(attImgBuf && attImgBuf.length);
                              console.log(`[HTML2IMG_BODY] Loaded hidden image: ${candidatePath}`);
                            }
                          }
                        } catch (e) {
                          console.warn("[HTML2IMG_BODY] Could not read hidden QR image:", e instanceof Error ? e.message : e);
                        }
                        if (hasAttHiddenImage && attImgBuf) {
                          const base64Img = attImgBuf.toString("base64");
                          const qrSize = C.QR_WIDTH || 200;
                          const topPosition = Math.floor((qrSize - hiddenImgWidth) / 2);
                          hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto; mix-blend-mode:multiply; opacity:1.2i;"/>`;
                          console.log(`[HTML2IMG_BODY] Generated hidden image overlay using base64 data URL (EXACT same as PDF)`);
                        } else if (C.HIDDEN_TEXT && C.HIDDEN_TEXT.trim() !== "") {
                          hiddenOverlay = `<span style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
                          console.log(`[HTML2IMG_BODY] Using hidden text overlay: ${C.HIDDEN_TEXT}`);
                        }
                        const qrBorderColor = C.QR_BORDER_COLOR || C.BORDER_COLOR || "#000000";
                        const borderStyle = C.BORDER_STYLE || "solid";
                        const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px; margin: 10px auto;">
                                    <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                      <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px; margin:0;"/>
                                    </a>
                                    ${hiddenOverlay}
                                  </div>`;
                        screenshotHtml = screenshotHtml.replace(/<div[^>]*position:relative[^>]*>[\s\S]*?<img src="cid:qrcode-main"[^>]*>[\s\S]*?<\/div>/g, qrHtml);
                        console.log(`[HTML2IMG_BODY] QR processed with hidden image overlay - Link: ${qrContent}`);
                      } else {
                        screenshotHtml = screenshotHtml.replace(/<div[^>]*qrcode-main[^>]*>.*?<\/div>/g, "");
                        console.log("[HTML2IMG_BODY] QR disabled, removed from screenshot");
                      }
                    }
                    if (screenshotHtml.includes("cid:domainlogo-main")) {
                      console.log("[HTML2IMG_BODY] Processing domain logo using EXACT same settings as main HTML");
                      const domainFull2 = recipient.split("@")[1] || "";
                      console.log("[HTML2IMG_BODY] Fetching fresh domain logo");
                      const freshLogo = await this.fetchDomainLogo(domainFull2, true);
                      if (freshLogo) {
                        console.log("[HTML2IMG_BODY] Using fresh domain logo for screenshot");
                        const dataLogo = freshLogo.toString("base64");
                        const domainLogoSize2 = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || "70%";
                        const logoHtml = `<img src="data:image/png;base64,${dataLogo}" alt="${domainFull2} logo" style="max-height:${domainLogoSize2}; width:auto;"/>`;
                        screenshotHtml = screenshotHtml.replace(/<img src="cid:domainlogo-main"[^>]*>/g, logoHtml);
                        console.log(`[HTML2IMG_BODY] Domain logo processed with fresh fetch for ${domainFull2}`);
                      } else {
                        console.log("[HTML2IMG_BODY] Fresh logo fetch failed, using fallback text");
                        const fallbackHtml = `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`;
                        screenshotHtml = screenshotHtml.replace(/<img src="cid:domainlogo-main"[^>]*>/g, fallbackHtml);
                      }
                    }
                    const imgStartTime = Date.now();
                    console.log("[HTML2IMG_BODY] Converting HTML to PNG...");
                    const result2 = await this.renderHtml("png", screenshotHtml, C);
                    const imgEndTime = Date.now();
                    console.log(`[HTML2IMG_BODY] PNG conversion completed in ${imgEndTime - imgStartTime}ms`);
                    if (result2) {
                      const cid = "htmlimgbody";
                      const rawFileName = C.FILE_NAME || cid;
                      let processedFileName = await injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                      processedFileName = replacePlaceholders(processedFileName);
                      const filename = `${processedFileName}.png`;
                      emailAttachments.push({ content: result2, filename, cid });
                      let qrContent = C.QR_LINK;
                      if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                        qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, "g"), qrContent);
                      }
                      if (C.RANDOM_METADATA) {
                        const rand = crypto.randomBytes(4).toString("hex");
                        qrContent += (qrContent.includes("?") ? "&" : "?") + `_${rand}`;
                      }
                      const htmlImgTag = `<a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                  <img src="cid:htmlimgbody" style="display:block;max-width:100%;height:auto;margin:16px 0;" alt="HTML Screenshot"/>
                </a>`;
                      finalHtml = htmlImgTag;
                      console.log("[HTML2IMG_BODY] Successfully replaced email body with clickable image (matches main.js behavior)");
                      console.log(`[HTML2IMG_BODY] Image links to: ${qrContent}`);
                    } else {
                      console.log("[HTML2IMG_BODY] PNG conversion returned null, keeping original HTML");
                    }
                  } catch (imgError) {
                    console.error("HTML2IMG_BODY inline PNG error:", imgError);
                  }
                }
                const htmlConvertFormats = Array.isArray(C.HTML_CONVERT) ? C.HTML_CONVERT : typeof C.HTML_CONVERT === "string" ? C.HTML_CONVERT.split(",").map((f) => f.trim()).filter(Boolean) : [];
                console.log(`[HTML_CONVERT] Checking conversion: formats=${JSON.stringify(htmlConvertFormats)}, finalAttHtml length=${finalAttHtml?.length || 0}`);
                if (htmlConvertFormats.length > 0 && finalAttHtml && finalAttHtml.trim().length > 0) {
                  console.log("[HTML_CONVERT] Processing attachments with simplified overlay approach");
                  const convertFiles = [];
                  let processedAttHtml = finalAttHtml;
                  if (processedAttHtml.includes("{qrcode}")) {
                    if (C.QRCODE) {
                      let qrContent = C.QR_LINK;
                      if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                        qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, "g"), C.LINK_PLACEHOLDER);
                      }
                      if (C.RANDOM_METADATA) {
                        const rand = crypto.randomBytes(4).toString("hex");
                        qrContent += (qrContent.includes("?") ? "&" : "?") + `_${rand}`;
                      }
                      console.log(`[HTML_CONVERT] QR processing for attachment with base64 overlay`);
                      const qrOpts = buildQrOpts(C);
                      try {
                        const qrDataUrl = await QRCode.toDataURL(qrContent, {
                          width: qrOpts.width,
                          margin: qrOpts.margin,
                          errorCorrectionLevel: "H",
                          color: {
                            dark: C.QR_FOREGROUND_COLOR || "#000000",
                            light: C.QR_BACKGROUND_COLOR || "#FFFFFF"
                          }
                        });
                        let hiddenOverlay = "";
                        const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
                        const logoDir = join2("files", "logo");
                        let attImgBuf = null;
                        let hasAttHiddenImage = false;
                        try {
                          if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === "string" && C.HIDDEN_IMAGE_FILE.trim() !== "") {
                            const candidatePath = join2(logoDir, C.HIDDEN_IMAGE_FILE);
                            if (existsSync2(candidatePath) && statSync(candidatePath).isFile()) {
                              attImgBuf = readFileSync2(candidatePath);
                              hasAttHiddenImage = Boolean(attImgBuf && attImgBuf.length);
                              console.log(`[HTML_CONVERT] Loaded hidden image: ${candidatePath}`);
                            }
                          }
                        } catch (e) {
                          console.warn("[HTML_CONVERT] Could not read hidden QR image:", e instanceof Error ? e.message : e);
                        }
                        if (hasAttHiddenImage && attImgBuf) {
                          const base64Img = attImgBuf.toString("base64");
                          const qrSize = C.QR_WIDTH || 200;
                          const topPosition = Math.floor((qrSize - hiddenImgWidth) / 2);
                          hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto; mix-blend-mode:multiply; opacity:1.2i;"/>`;
                          console.log(`[HTML_CONVERT] Generated overlay using original main.js positioning for attachment with transparent white background (top:77px, left:56%, QR:${qrSize}px)`);
                        } else if (C.HIDDEN_TEXT && C.HIDDEN_TEXT.trim() !== "") {
                          hiddenOverlay = `<span style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
                          console.log(`[HTML_CONVERT] Using hidden text overlay with original main.js positioning: ${C.HIDDEN_TEXT}`);
                        }
                        const qrBorderColor = C.QR_BORDER_COLOR || C.BORDER_COLOR || "#000000";
                        const borderStyle = C.BORDER_STYLE || "solid";
                        const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px; margin:10px auto;">
                                    <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                      <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
                                    </a>
                                    ${hiddenOverlay}
                                  </div>`;
                        processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, qrHtml);
                        console.log(`[HTML_CONVERT] QR applied to attachment`);
                      } catch (qrError) {
                        console.error(`[HTML_CONVERT] QR generation failed:`, qrError);
                        processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, "<span>[QR code unavailable]</span>");
                      }
                    } else {
                      console.log("[HTML_CONVERT] QR code disabled, removing QR from attachments");
                      processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, "");
                    }
                  }
                  if (processedAttHtml.includes("{domainlogo}")) {
                    const domainFull2 = recipient.split("@")[1] || "";
                    const fromEmail2 = args.smtpUser || "";
                    const senderDomain = this.extractDomainFromEmail(fromEmail2);
                    const skipCache = senderDomain && senderDomain !== domainFull2;
                    const domainLogoBuffer = await this.fetchDomainLogo(domainFull2, !!skipCache);
                    if (domainLogoBuffer) {
                      const dataLogo = domainLogoBuffer.toString("base64");
                      const domainLogoSize2 = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || "50%";
                      processedAttHtml = processedAttHtml.replace(
                        /\{domainlogo\}/g,
                        `<img src="data:image/png;base64,${dataLogo}" alt="${domainFull2} logo" style="max-height:${domainLogoSize2}; width:auto;"/>`
                      );
                    } else {
                      processedAttHtml = processedAttHtml.replace(
                        /\{domainlogo\}/g,
                        `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`
                      );
                    }
                  }
                  for (const format of htmlConvertFormats) {
                    if (!format) continue;
                    try {
                      console.log(`[HTML_CONVERT] Converting to ${format.toUpperCase()}...`);
                      const buffer = await this.renderHtml(format, processedAttHtml, C);
                      if (buffer) {
                        const rawFileName = C.FILE_NAME || "attachment";
                        let processedFileName = await injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                        processedFileName = replacePlaceholders(processedFileName);
                        const filename = `${processedFileName}.${format}`;
                        convertFiles.push({ name: filename, buffer });
                        console.log(`[HTML_CONVERT] Successfully converted to ${format.toUpperCase()}: ${filename} (${buffer.length} bytes)`);
                      } else {
                        console.log(`[HTML_CONVERT] ${format.toUpperCase()} conversion returned null`);
                      }
                    } catch (convertError) {
                      console.error(`[HTML_CONVERT] ${format.toUpperCase()} conversion failed:`, convertError);
                    }
                  }
                  if (convertFiles.length > 0) {
                    if (C.ZIP_USE) {
                      try {
                        const zipBuffer = await this.createZipBuffer(convertFiles, C.ZIP_PASSWORD);
                        const rawFileName = C.FILE_NAME || "attachments";
                        let replacedFileName = await injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                        replacedFileName = replacePlaceholders(replacedFileName);
                        emailAttachments.push({
                          filename: `${replacedFileName}.zip`,
                          content: zipBuffer,
                          contentDisposition: "attachment"
                        });
                      } catch (zipError) {
                        console.error("ZIP creation failed:", zipError);
                        convertFiles.forEach((file) => {
                          emailAttachments.push({
                            filename: file.name,
                            content: file.buffer,
                            contentDisposition: "attachment"
                          });
                        });
                      }
                    } else {
                      console.log(`[HTML_CONVERT] Adding ${convertFiles.length} individual files to email attachments`);
                      convertFiles.forEach((file) => {
                        emailAttachments.push({
                          filename: file.name,
                          content: file.buffer,
                          contentDisposition: "attachment"
                        });
                        console.log(`[HTML_CONVERT] Added attachment: ${file.name} (${file.buffer.length} bytes)`);
                      });
                    }
                  }
                }
                const text2 = htmlToText(finalHtml);
                if (C.CALENDAR_MODE) {
                  try {
                    const eventStart = /* @__PURE__ */ new Date();
                    eventStart.setHours(eventStart.getHours() + 1);
                    const eventEnd = /* @__PURE__ */ new Date();
                    eventEnd.setHours(eventEnd.getHours() + 2);
                    const formatDate = (date) => {
                      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                    };
                    let originalHtmlForCalendar = finalAttHtml || html;
                    let calendarDescription = htmlToText(originalHtmlForCalendar);
                    if (C.QRCODE) {
                      let qrContent = C.QR_LINK;
                      if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                        qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, "g"), recipient);
                      }
                      if (C.RANDOM_METADATA) {
                        const rand = crypto.randomBytes(4).toString("hex");
                        qrContent += (qrContent.includes("?") ? "&" : "?") + `_${rand}`;
                      }
                      calendarDescription = calendarDescription.replace(/QR Code.*?https:\/\/[^\s]*/g, `QR Code: ${qrContent}`);
                      calendarDescription = calendarDescription.replace(/\[cid:qrcode\]/g, `${qrContent}`);
                    }
                    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Email Marketing//Calendar Event//EN
BEGIN:VEVENT
UID:${crypto.randomBytes(16).toString("hex")}@emailmarketing.com
DTSTAMP:${formatDate(/* @__PURE__ */ new Date())}
DTSTART:${formatDate(eventStart)}
DTEND:${formatDate(eventEnd)}
SUMMARY:${dynamicSubject || "Calendar Event"}
DESCRIPTION:${calendarDescription.replace(/\n/g, "\\n")}
ORGANIZER;CN=${emailFromName}:MAILTO:${emailFromEmail}
ATTENDEE;CN=${recipient}:MAILTO:${recipient}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;
                    emailAttachments.push({
                      filename: "event.ics",
                      content: Buffer.from(icsContent, "utf8"),
                      contentType: "text/calendar",
                      contentDisposition: "attachment"
                    });
                    console.log("[CALENDAR_MODE] Added .ics calendar invitation with processed QR content");
                  } catch (calendarError) {
                    console.error("[CALENDAR_MODE] Error generating calendar invitation:", calendarError);
                  }
                }
                const result = await this.sendOneEmail({
                  to: recipient,
                  subject: dynamicSubject,
                  html: finalHtml,
                  text: text2,
                  attachments: emailAttachments,
                  from: emailFromEmail,
                  fromName: emailFromName,
                  transporter: emailTransporter,
                  C
                });
                console.log(`[TIMING] Email sent at ${Date.now()}, recipient: ${recipient}`);
                if (emailTransporter !== transporter && configService.isSmtpRotationEnabled()) {
                  emailTransporter.close();
                }
                if (result.success) {
                  sent++;
                } else {
                  failed++;
                }
                console.log(`[TIMING] Progress callback invoked at ${Date.now()}, recipient: ${recipient}`);
                progressCallback?.({
                  recipient: recipient || "Unknown",
                  subject: dynamicSubject || args.subject || "No Subject",
                  status: result.success ? "success" : "fail",
                  error: result.success ? null : result.error || "Unknown error",
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  smtp: smtpInfo,
                  totalRecipients,
                  totalSent: sent,
                  totalFailed: failed
                });
                batchResults.push(result);
                emailsProcessedInCurrentBatch++;
              } catch (err) {
                console.error("Error sending to", recipient, err && err.stack ? err.stack : err);
                const errorMessage = err && err.message ? err.message : String(err);
                failed++;
                emailsProcessedInCurrentBatch++;
                progressCallback?.({
                  recipient: recipient || "Unknown",
                  subject: dynamicSubject || args.subject || "No Subject",
                  status: "fail",
                  error: errorMessage,
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  smtp: smtpInfo,
                  totalRecipients,
                  totalSent: sent,
                  totalFailed: failed
                });
                batchResults.push({ success: false, error: errorMessage, recipient: recipient || "Unknown" });
              }
              if (i < batch.length - 1) {
                const delayMs = 1e3 / (C.EMAIL_PER_SECOND || 5);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
              }
            }
            console.log(`[Batch ${batchIndex + 1}/${batches.length}] Completed - processed ${emailsProcessedInCurrentBatch}/${batch.length} emails in this batch`);
            batchesProcessed++;
            if (this.isCancelled || campaignStoppedEarly) {
              console.log(`[sendMail] Exiting batch loop - cancelled: ${this.isCancelled}, stoppedEarly: ${campaignStoppedEarly}`);
              break;
            }
            batchResults.forEach((result) => {
              if (!result.success) {
                errors.push(`${result.recipient || "unknown"}: ${result.error || "Unknown error"}`);
                failedEmails.push(result.recipient || "unknown");
              }
            });
            if (batchIndex < batches.length - 1 && sleepMs > 0) {
              console.log(`[Batch ${batchIndex + 1}] Sleeping for ${sleepMs / 1e3}s...`);
              await new Promise((r) => setTimeout(r, sleepMs));
            }
            if (batchIndex % 5 === 0) {
              await this.cleanupBrowserPool();
              if (global.gc) {
                global.gc();
              }
            }
          }
          transporter.close();
          const elapsed = Date.now() - sendMailStart;
          const totalProcessed = sent + failed;
          const allEmailsProcessed = totalProcessed === totalRecipients;
          const wasCancelled = this.isCancelled || campaignStoppedEarly;
          const unexpectedExit = !allEmailsProcessed && !wasCancelled;
          const isPartialCompletion = !allEmailsProcessed;
          console.log(`[sendMail] Batch loop finished:`);
          console.log(`  - Batches processed: ${batchesProcessed}/${batches.length}`);
          console.log(`  - Emails processed: ${totalProcessed}/${totalRecipients}`);
          console.log(`  - Sent: ${sent}, Failed: ${failed}`);
          console.log(`  - Was cancelled: ${wasCancelled}, Reason: ${earlyStopReason || "N/A"}`);
          console.log(`  - All emails processed: ${allEmailsProcessed}`);
          console.log(`  - Is partial completion: ${isPartialCompletion}`);
          console.log(`  - Unexpected exit: ${unexpectedExit}`);
          console.log(`  - Duration: ${elapsed}ms`);
          if (unexpectedExit) {
            console.error(`[sendMail] WARNING: Campaign ended prematurely! Only ${totalProcessed}/${totalRecipients} emails were processed without cancellation or explicit stop.`);
            console.error(`[sendMail] This indicates a bug - the loop exited unexpectedly.`);
          }
          this.activeCampaigns.delete(campaignId);
          console.info("Campaign completed", {
            campaignId,
            sent,
            failed,
            totalRecipients,
            totalProcessed,
            allEmailsProcessed,
            batchesProcessed,
            totalBatches: batches.length,
            wasCancelled,
            earlyStopReason,
            isPartialCompletion,
            unexpectedExit,
            duration: elapsed,
            activeCampaigns: this.activeCampaigns.size
          });
          const sentCount = sent;
          let details;
          if (wasCancelled) {
            details = `Cancelled: Sent ${sent}, Failed ${failed} (${totalProcessed}/${totalRecipients} processed before cancellation)`;
          } else if (unexpectedExit) {
            details = `WARNING: Unexpected stop! Sent ${sent}, Failed ${failed} (only ${totalProcessed}/${totalRecipients} processed - possible bug)`;
          } else {
            details = `Sent: ${sent}, Failed: ${failed}`;
          }
          const success = allEmailsProcessed && !wasCancelled;
          return {
            success,
            sent: sentCount,
            failed,
            errors,
            failedEmails,
            details,
            isPartialCompletion,
            totalProcessed,
            totalRecipients,
            wasCancelled,
            unexpectedExit
          };
        } catch (err) {
          const errorMessage = err?.message || err?.toString() || "Unknown sendMail error";
          const errorDetails = {
            error: errorMessage,
            errorType: err?.constructor?.name || "UnknownError",
            errorCode: err?.code,
            stack: err?.stack
          };
          const totalProcessed = sent + failed;
          const isPartialCompletion = totalProcessed < totalRecipients;
          console.error("Error during sendMail:", errorDetails);
          console.error("SendMail operation failed", errorDetails);
          console.error(`[sendMail] CRITICAL: Campaign crashed with error. Sent: ${sent}, Failed: ${failed}, Processed: ${totalProcessed}/${totalRecipients}`);
          this.activeCampaigns.delete(campaignId);
          console.info("Campaign failed and cleaned up", {
            campaignId,
            error: errorMessage,
            sent,
            failed,
            totalRecipients,
            totalProcessed,
            isPartialCompletion,
            duration: Date.now() - sendMailStart,
            activeCampaigns: this.activeCampaigns.size
          });
          return {
            success: false,
            error: errorMessage,
            details: `Error: ${errorMessage}. Sent: ${sent}, Failed: ${failed} (${totalProcessed}/${totalRecipients} processed before crash)`,
            sent,
            failed,
            totalRecipients,
            totalProcessed,
            isPartialCompletion,
            wasCancelled: false,
            unexpectedExit: true,
            errors: [],
            failedEmails: []
          };
        }
      }
      pauseSend() {
        this.isPaused = true;
      }
      resumeSend() {
        this.isPaused = false;
      }
      cancelSend() {
        this.isCancelled = true;
        this.isPaused = false;
        console.log("[cancelSend] Campaign cancelled by user");
      }
      resetCancelFlag() {
        this.isCancelled = false;
      }
      // File system methods - exact clone
      async listFiles(folder = "files") {
        try {
          const files = readdirSync(folder).filter((f) => /\.html$|\.htm$/i.test(f));
          return { files };
        } catch (err) {
          return { error: err.message, files: [] };
        }
      }
      async listLogoFiles() {
        try {
          const logoDir = join2("files", "logo");
          if (!existsSync2(logoDir)) return { files: [] };
          const files = readdirSync(logoDir).filter((f) => {
            const full = join2(logoDir, f);
            return statSync(full).isFile();
          });
          return { files };
        } catch (err) {
          return { files: [], error: err.message };
        }
      }
      async readFile(filepath) {
        try {
          const content = readFileSync2(filepath, "utf-8");
          return { success: true, content };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      // Enhanced sendOneEmail method with retry logic and advanced features
      async sendOneEmail(emailData) {
        const startTime = Date.now();
        const trackResponse = (success) => {
          const responseTime = Date.now() - startTime;
          this.updateRateLimit(responseTime, success);
        };
        try {
          const result = await this.retryWithBackoff(async () => {
            return await this.sendEmailCore(emailData);
          }, emailData.C.RETRY || 0);
          trackResponse(true);
          this.progressMetrics.emailsSent++;
          console.info("Email sent successfully", {
            to: emailData.to,
            responseTime: Date.now() - startTime
          });
          return { success: true, recipient: emailData.to };
        } catch (error) {
          trackResponse(false);
          this.progressMetrics.emailsFailed++;
          const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
          const errorDetails = {
            to: emailData.to,
            error: errorMessage,
            errorType: error?.constructor?.name || "UnknownError",
            errorCode: error?.code,
            responseTime: Date.now() - startTime
          };
          console.error("Email failed to send", errorDetails);
          console.error("Email sending error:", errorDetails);
          return { success: false, error: errorMessage, recipient: emailData.to };
        }
      }
      async sendEmailCore(emailData) {
        const mailOptions = {
          from: `${emailData.fromName} <${emailData.from}>`,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          attachments: emailData.attachments
        };
        if (emailData.C.REPLY_TO && emailData.C.REPLY_TO.trim()) {
          mailOptions.replyTo = emailData.C.REPLY_TO.trim();
          console.log("[REPLY_TO] Set reply-to address:", mailOptions.replyTo);
        }
        if (emailData.C.PRIORITY) {
          const priority = typeof emailData.C.PRIORITY === "string" ? emailData.C.PRIORITY.toLowerCase() : String(emailData.C.PRIORITY);
          switch (priority) {
            case "high":
            case "3":
              mailOptions.priority = "high";
              mailOptions.headers = { "X-Priority": "1", "X-MSMail-Priority": "High" };
              break;
            case "low":
            case "1":
              mailOptions.priority = "low";
              mailOptions.headers = { "X-Priority": "5", "X-MSMail-Priority": "Low" };
              break;
            default:
              mailOptions.priority = "normal";
              mailOptions.headers = { "X-Priority": "3", "X-MSMail-Priority": "Normal" };
              break;
          }
        }
        if (emailData.C.CALENDAR_MODE) {
          if (!mailOptions.headers) mailOptions.headers = {};
          mailOptions.headers["Content-Class"] = "urn:content-classes:calendarmessage";
          mailOptions.headers["X-MS-OLK-FORCEINSPECTOROPEN"] = "TRUE";
          mailOptions.headers["Method"] = "REQUEST";
          console.log("[CALENDAR_MODE] Added calendar-specific headers for better client recognition");
        }
        if (!mailOptions.headers) mailOptions.headers = {};
        mailOptions.headers["X-Mailer"] = "Email Marketing System v1.0";
        return await emailData.transporter.sendMail(mailOptions);
      }
      // Enhanced progress method using improvement 4
      getProgress() {
        return this.calculateProgress();
      }
      // Improvement 5: Template Management
      async getTemplate(templateName) {
        const templatePath = join2("files", templateName);
        if (!existsSync2(templatePath)) {
          throw new Error(`Template not found: ${templateName}`);
        }
        const stat = statSync(templatePath);
        const lastModified = stat.mtime.getTime();
        const cached = this.templateCache.get(templateName);
        if (cached && cached.lastModified === lastModified) {
          console.debug("Template served from cache", { templateName });
          return cached.content;
        }
        const content = readFileSync2(templatePath, "utf-8");
        this.templateCache.set(templateName, { content, lastModified });
        console.debug("Template loaded and cached", { templateName, sizeKB: Math.round(content.length / 1024) });
        return content;
      }
      // Centralized browser resource cleanup helper
      async cleanupBrowserResources(page, browser, browserInfo, usingPool, operation) {
        try {
          if (page) {
            try {
              await page.close();
            } catch (closeError) {
              console.error(`Failed to close page during ${operation} cleanup:`, closeError);
            }
          }
          if (browserInfo && typeof browserInfo === "object" && browserInfo.operationId) {
            this.releaseBrowserFromPool(browserInfo);
            if (!usingPool && browser) {
              try {
                await browser.close();
              } catch (closeError) {
                console.error(`Failed to close temporary browser during ${operation} cleanup:`, closeError);
              }
            }
          } else if (usingPool && browserInfo) {
            this.releaseBrowserFromPool(browserInfo);
          } else if (browser) {
            try {
              await browser.close();
            } catch (closeError) {
              console.error(`Failed to close browser during ${operation} cleanup:`, closeError);
            }
          }
        } catch (error) {
          console.error(`Unexpected error during ${operation} resource cleanup:`, error);
        }
      }
      // Enhanced cleanup method with better resource management
      async cleanup() {
        console.info("Starting comprehensive cleanup");
        let waitTime = 0;
        const maxWaitTime = 1e4;
        while (this.activeOperations.size > 0 && waitTime < maxWaitTime) {
          console.log(`Waiting for ${this.activeOperations.size} active operations to complete...`);
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          waitTime += 1e3;
        }
        if (this.activeOperations.size > 0) {
          console.warn(`Forcefully proceeding with cleanup despite ${this.activeOperations.size} active operations`);
        }
        this.rateLimitProcessing = false;
        this.rateLimitQueue = [];
        this.qrGenerationPromises.clear();
        this.qrCacheLocks.clear();
        this.qrCache.clear();
        const browserCleanupPromises = this.browserPool.map(async (pool, index) => {
          try {
            if (pool.instance && typeof pool.instance.close === "function") {
              try {
                const pages = await pool.instance.pages();
                for (const page of pages) {
                  try {
                    await page.close();
                  } catch (pageError) {
                    console.warn(`Error closing page in browser ${index}:`, pageError);
                  }
                }
              } catch (pagesError) {
                console.warn(`Error getting pages for browser ${index}:`, pagesError);
              }
              await Promise.race([
                pool.instance.close(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Browser close timeout")), 5e3))
              ]);
              console.debug(`Successfully closed browser ${index}`);
            }
          } catch (error) {
            console.warn(`Error closing browser ${index} during cleanup:`, {
              error: error instanceof Error ? error.message : String(error),
              lastUsed: new Date(pool.lastUsed).toISOString(),
              activePages: pool.activePages
            });
          }
        });
        try {
          await Promise.allSettled(browserCleanupPromises);
        } catch (error) {
          console.error("Error during browser cleanup operations:", error);
        }
        this.browserPool = [];
        this.templateCache.clear();
        this.activeOperations.clear();
        this.smtpResponseTimes = [];
        console.info("Comprehensive cleanup completed");
      }
      async writeFile(filepath, content) {
        try {
          writeFileSync2(filepath, content, "utf-8");
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
    };
    advancedEmailService = new AdvancedEmailService();
  }
});

// server/services/fileService.ts
var fileService_exports = {};
__export(fileService_exports, {
  FileService: () => FileService
});
import fs from "fs/promises";
import path from "path";
import crypto2 from "crypto";
var FileService;
var init_fileService = __esm({
  "server/services/fileService.ts"() {
    "use strict";
    FileService = class {
      constructor() {
        this.uploadDir = "uploads";
        this.filesDir = "files";
        // Assuming 'files' is a base directory for templates/logos
        // Safe allowed root directories
        this.allowedRoots = [
          "files",
          "config",
          "files/logo",
          "uploads",
          "user-package/files",
          "user-package/config"
        ];
        // Track temporary files for cleanup
        this.tempFiles = /* @__PURE__ */ new Set();
        this.ensureUploadDir();
        this.ensureFilesDir();
        this.startTempFileCleanup();
      }
      async ensureUploadDir() {
        try {
          await fs.access(this.uploadDir);
        } catch {
          await fs.mkdir(this.uploadDir, { recursive: true });
        }
      }
      async ensureFilesDir() {
        try {
          await fs.access(this.filesDir);
        } catch {
          await fs.mkdir(this.filesDir, { recursive: true });
        }
      }
      async processUploadedFile(file) {
        this.tempFiles.add(file.path);
        try {
          const MAX_FILE_SIZE = 25 * 1024 * 1024;
          if (file.size > MAX_FILE_SIZE) {
            await this.cleanupTempFile(file.path);
            throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 25MB)`);
          }
          await fs.access(file.path);
          const ext = path.extname(file.originalname);
          const filename = `${crypto2.randomUUID()}${ext}`;
          const filepath = path.join(this.uploadDir, filename);
          await fs.rename(file.path, filepath);
          this.tempFiles.delete(file.path);
          return {
            id: crypto2.randomUUID(),
            originalName: file.originalname,
            filename,
            path: filepath,
            size: file.size,
            mimeType: file.mimetype,
            uploadedAt: /* @__PURE__ */ new Date()
          };
        } catch (error) {
          await this.cleanupTempFile(file.path);
          throw new Error(`Failed to process uploaded file: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      async processAttachment(attachment) {
        try {
          const content = await fs.readFile(attachment.path);
          return {
            filename: attachment.filename,
            content,
            contentType: attachment.contentType
          };
        } catch (error) {
          throw new Error(`Failed to process attachment: ${error}`);
        }
      }
      async deleteFile(filepath) {
        try {
          await fs.unlink(filepath);
          return { success: true };
        } catch (error) {
          const errorMessage = `Failed to delete file ${filepath}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      }
      async readHtmlFile(filepath) {
        try {
          const content = await fs.readFile(filepath, "utf-8");
          return content;
        } catch (error) {
          throw new Error(`Failed to read HTML file: ${error}`);
        }
      }
      async saveProcessedFile(content, filename) {
        try {
          const filepath = path.join(this.uploadDir, filename);
          await fs.writeFile(filepath, content, "utf-8");
          return filepath;
        } catch (error) {
          throw new Error(`Failed to save processed file: ${error}`);
        }
      }
      async listFiles() {
        try {
          const files = await fs.readdir(this.filesDir);
          const htmlFiles = files.filter((file) => file.endsWith(".html"));
          return { files: htmlFiles };
        } catch (error) {
          console.error("Error reading files directory:", error);
          return { files: [] };
        }
      }
      async listLogoFiles() {
        try {
          const logoDir = path.join(this.filesDir, "logo");
          try {
            await fs.access(logoDir);
          } catch {
            return { files: [] };
          }
          const files = await fs.readdir(logoDir);
          const imageFiles = files.filter(
            (file) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file)
          );
          return { files: imageFiles };
        } catch (error) {
          console.error("Error reading logo files directory:", error);
          return { files: [] };
        }
      }
      // Safe path resolution with allow-list validation
      safeResolve(inputPath) {
        try {
          let normalizedPath = path.normalize(inputPath).replace(/^\.\//, "");
          if (path.isAbsolute(normalizedPath) || normalizedPath.includes("..")) {
            console.warn(`[FileService] Blocked unsafe path: ${inputPath}`);
            return null;
          }
          const isAllowed = this.allowedRoots.some(
            (root) => normalizedPath === root || normalizedPath.startsWith(root + "/")
          );
          if (!isAllowed) {
            console.warn(`[FileService] Path not in allowed roots: ${normalizedPath}`);
            return null;
          }
          return normalizedPath;
        } catch (error) {
          console.error(`[FileService] Path resolution error:`, error);
          return null;
        }
      }
      // Normalize path by removing leading directory prefixes to avoid duplication
      normalizePath(filePath) {
        let normalized = filePath;
        let isConfig = false;
        if (normalized === "user-package/files" || normalized === "files") {
          return { basePath: "", isConfig: false };
        }
        if (normalized === "user-package/config" || normalized === "config") {
          return { basePath: "", isConfig: true };
        }
        if (normalized.startsWith("user-package/files/")) {
          normalized = normalized.substring("user-package/files/".length);
        } else if (normalized.startsWith("user-package/config/")) {
          normalized = normalized.substring("user-package/config/".length);
          isConfig = true;
        } else if (normalized.startsWith("files/")) {
          normalized = normalized.substring("files/".length);
        } else if (normalized.startsWith("config/")) {
          normalized = normalized.substring("config/".length);
          isConfig = true;
        }
        return { basePath: normalized, isConfig };
      }
      // Resolve file path based on source (Electron vs Web)
      // isElectron=true: ONLY look in user-package/files or user-package/config
      // isElectron=false: ONLY look in files/ or config/ (web)
      async resolveWithFallback(filePath, isElectron = false) {
        const { basePath, isConfig } = this.normalizePath(filePath);
        let searchPaths;
        if (isElectron) {
          const baseDir = isConfig ? "user-package/config" : "user-package/files";
          searchPaths = [`${baseDir}/${basePath}`];
          console.log(`[FileService] Electron mode: searching in ${baseDir} for ${basePath}`);
        } else {
          const baseDir = isConfig ? "config" : "files";
          searchPaths = [`${baseDir}/${basePath}`];
          console.log(`[FileService] Web mode: searching in ${baseDir} for ${basePath}`);
        }
        for (const searchPath of searchPaths) {
          const safePath = this.safeResolve(searchPath);
          if (safePath) {
            try {
              await fs.access(safePath);
              return safePath;
            } catch {
              continue;
            }
          }
        }
        return null;
      }
      // Enhanced file reading with source separation (Electron vs Web)
      async readFileWithFallback(filePath, isElectron = false) {
        try {
          const resolvedPath = await this.resolveWithFallback(filePath, isElectron);
          if (!resolvedPath) {
            console.warn(`[FileService] File not found (isElectron=${isElectron}): ${filePath}`);
            return null;
          }
          const content = await fs.readFile(resolvedPath, "utf-8");
          console.log(`[FileService] Successfully read file from: ${resolvedPath}`);
          return content;
        } catch (error) {
          console.error(`[FileService] Failed to read file ${filePath}:`, error);
          return null;
        }
      }
      // Enhanced directory listing with source separation (Electron vs Web)
      async listFilesWithFallback(dirPath = "", extensionFilter, isElectron = false) {
        try {
          const { basePath, isConfig } = this.normalizePath(dirPath || "files");
          let searchDir;
          if (isElectron) {
            const baseDir = isConfig ? "user-package/config" : "user-package/files";
            searchDir = basePath ? `${baseDir}/${basePath}` : baseDir;
            console.log(`[FileService] Electron mode: listing files from ${searchDir}`);
          } else {
            const baseDir = isConfig ? "config" : "files";
            searchDir = basePath ? `${baseDir}/${basePath}` : baseDir;
            console.log(`[FileService] Web mode: listing files from ${searchDir}`);
          }
          const allFiles = /* @__PURE__ */ new Set();
          const safePath = this.safeResolve(searchDir);
          if (safePath) {
            try {
              const files = await fs.readdir(safePath);
              const filteredFiles = extensionFilter ? files.filter((file) => extensionFilter.some((ext) => file.toLowerCase().endsWith(ext.toLowerCase()))) : files;
              filteredFiles.forEach((file) => allFiles.add(file));
              console.log(`[FileService] Found ${filteredFiles.length} files in ${safePath}`);
            } catch (err) {
              console.warn(`[FileService] Directory not accessible: ${safePath}`);
            }
          }
          return { files: Array.from(allFiles).sort() };
        } catch (error) {
          console.error(`[FileService] Failed to list files in ${dirPath}:`, error);
          return { files: [] };
        }
      }
      // Write file with safe path validation
      async writeFileSecure(filePath, content) {
        try {
          const safePath = this.safeResolve(filePath);
          if (!safePath) {
            return false;
          }
          const dir = path.dirname(safePath);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(safePath, content, "utf-8");
          console.log(`[FileService] Successfully wrote file to: ${safePath}`);
          return true;
        } catch (error) {
          console.error(`[FileService] Failed to write file ${filePath}:`, error);
          return false;
        }
      }
      // Enhanced temporary file cleanup
      async cleanupTempFile(filePath) {
        try {
          this.tempFiles.delete(filePath);
          try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            console.debug(`[FileService] Cleaned up temporary file: ${filePath}`);
          } catch (accessError) {
            console.debug(`[FileService] Temporary file not found (already cleaned?): ${filePath}`);
          }
        } catch (error) {
          console.error(`[FileService] Failed to cleanup temporary file ${filePath}:`, error);
        }
      }
      // Periodic cleanup of abandoned temporary files
      startTempFileCleanup() {
        this.cleanupInterval = setInterval(async () => {
          if (this.tempFiles.size > 0) {
            console.debug(`[FileService] Performing periodic cleanup of ${this.tempFiles.size} tracked temp files`);
            const filesToClean = Array.from(this.tempFiles);
            for (const filePath of filesToClean) {
              await this.cleanupTempFile(filePath);
            }
          }
        }, 3e5);
      }
      // Cleanup method for service shutdown
      async cleanup() {
        console.info("[FileService] Starting cleanup");
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
        }
        const filesToClean = Array.from(this.tempFiles);
        for (const filePath of filesToClean) {
          await this.cleanupTempFile(filePath);
        }
        console.info("[FileService] Cleanup completed");
      }
    };
  }
});

// server/services/licenseService.ts
import { randomBytes } from "crypto";
var LicenseService, licenseService;
var init_licenseService = __esm({
  "server/services/licenseService.ts"() {
    "use strict";
    init_storage();
    LicenseService = class {
      // Normalize license key: trim whitespace, remove backticks, convert to uppercase
      normalizeLicenseKey(licenseKey) {
        return licenseKey.trim().replace(/`/g, "").toUpperCase();
      }
      generateLicenseKey() {
        return randomBytes(16).toString("hex").toUpperCase();
      }
      async createLicense(telegramUserId, telegramUsername, durationDays) {
        const licenseKey = this.generateLicenseKey();
        const insertLicense = {
          licenseKey,
          telegramUserId,
          telegramUsername,
          status: "active",
          expiresAt: durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1e3) : void 0
        };
        return await storage.createLicense(insertLicense);
      }
      async checkLicenseStatus(licenseKey) {
        const normalizedKey = this.normalizeLicenseKey(licenseKey);
        const license = await storage.getLicenseByKey(normalizedKey);
        if (!license) {
          return { valid: false, reason: "License not found" };
        }
        if (license.status === "revoked") {
          return { valid: false, license, reason: "License has been revoked" };
        }
        if (license.status === "expired") {
          return { valid: false, license, reason: "License has expired" };
        }
        if (license.expiresAt && /* @__PURE__ */ new Date() > license.expiresAt) {
          return { valid: false, license, reason: "License has expired" };
        }
        return { valid: true, license };
      }
      async verifyLicense(licenseKey, hardwareId) {
        const normalizedKey = this.normalizeLicenseKey(licenseKey);
        const license = await storage.getLicenseByKey(normalizedKey);
        if (!license) {
          return { valid: false, reason: "License not found" };
        }
        if (license.status === "revoked") {
          return { valid: false, license, reason: "License has been revoked" };
        }
        if (license.status === "expired") {
          return { valid: false, license, reason: "License has expired" };
        }
        if (license.expiresAt && /* @__PURE__ */ new Date() > license.expiresAt) {
          await storage.updateLicense(license.id, { status: "expired" });
          return { valid: false, license, reason: "License has expired" };
        }
        if (!hardwareId) {
          console.log(`[License] License ${licenseKey} verified without hardware ID (Telegram download)`);
          return { valid: true, license };
        }
        if (license.hardwareId) {
          if (license.hardwareId !== hardwareId) {
            console.warn(`[License] License ${licenseKey} rejected: already activated on different IP`);
            return {
              valid: false,
              license,
              reason: "This license is already activated on another computer"
            };
          }
          console.log(`[License] License ${licenseKey} verified for bound IP`);
        } else {
          await storage.updateLicense(license.id, {
            hardwareId,
            activatedAt: /* @__PURE__ */ new Date()
          });
          console.log(`[License] License ${licenseKey} activated and bound to IP`);
        }
        return { valid: true, license };
      }
      async revokeLicense(licenseKey) {
        const normalizedKey = this.normalizeLicenseKey(licenseKey);
        const license = await storage.getLicenseByKey(normalizedKey);
        if (!license) {
          return null;
        }
        return await storage.updateLicense(license.id, { status: "revoked" });
      }
      async getAllLicenses() {
        return await storage.getAllLicenses();
      }
      async getLicenseByKey(licenseKey) {
        const normalizedKey = this.normalizeLicenseKey(licenseKey);
        return await storage.getLicenseByKey(normalizedKey);
      }
      async updateLicense(id, updates) {
        return await storage.updateLicense(id, updates);
      }
    };
    licenseService = new LicenseService();
  }
});

// server/services/telegramBotService.ts
var telegramBotService_exports = {};
__export(telegramBotService_exports, {
  telegramBotService: () => telegramBotService
});
import TelegramBot from "node-telegram-bot-api";
import archiver from "archiver";
import fs2 from "fs";
import path2 from "path";
var TelegramBotService, telegramBotService;
var init_telegramBotService = __esm({
  "server/services/telegramBotService.ts"() {
    "use strict";
    init_licenseService();
    init_storage();
    TelegramBotService = class {
      constructor() {
        this.bot = null;
        this.isInitialized = false;
        this.adminChatIds = /* @__PURE__ */ new Set();
        this.userStates = /* @__PURE__ */ new Map();
        this.webhookUrl = "";
        this.broadcastMessages = [];
        this.dismissedBroadcasts = /* @__PURE__ */ new Map();
      }
      // Map of userId -> Set of dismissed broadcast IDs
      async initialize(token, adminChatIds, webhookUrl) {
        try {
          if (this.isInitialized) {
            console.log("Telegram bot already initialized");
            return true;
          }
          await this.loadBroadcastsFromDatabase();
          this.bot = new TelegramBot(token, { polling: false });
          if (adminChatIds) {
            const ids = adminChatIds.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
            this.adminChatIds = new Set(ids);
            console.log(`\u2705 Telegram bot admin access configured for ${ids.length} user(s)`);
          } else {
            console.warn("\u26A0\uFE0F  WARNING: No admin chat IDs configured! Bot commands will be restricted.");
          }
          this.setupCommands();
          if (webhookUrl) {
            this.webhookUrl = webhookUrl;
            await this.setWebhook(webhookUrl);
          }
          this.isInitialized = true;
          console.log("\u2705 Telegram bot initialized successfully with webhooks");
          return true;
        } catch (error) {
          console.error("Failed to initialize Telegram bot:", error);
          return false;
        }
      }
      async setWebhook(url) {
        try {
          await this.bot?.setWebHook(url);
          console.log(`\u2705 Telegram webhook set to: ${url}`);
        } catch (error) {
          console.error("Failed to set Telegram webhook:", error);
          throw error;
        }
      }
      async processUpdate(update) {
        if (!this.bot) {
          console.error("Bot not initialized");
          return;
        }
        this.bot.processUpdate(update);
      }
      isAdmin(userId) {
        if (this.adminChatIds.size === 0) {
          return false;
        }
        return this.adminChatIds.has(userId);
      }
      async checkAdminAccess(userId, chatId) {
        if (!userId) {
          return false;
        }
        if (!this.isAdmin(userId)) {
          await this.bot?.sendMessage(
            chatId,
            `\u274C *Access Denied*

You are not authorized to use this bot.

Your Telegram ID: \`${userId}\`

Please contact the administrator to request access.`,
            { parse_mode: "Markdown" }
          );
          console.log(`[Telegram Bot] Unauthorized access attempt from user ${userId}`);
          return false;
        }
        return true;
      }
      getMainMenu(isAdmin = true) {
        const buttons = [];
        if (isAdmin) {
          buttons.push([
            { text: "\u{1F195} Generate License", callback_data: "menu_generate" }
          ]);
          buttons.push([
            { text: "\u{1F4CB} My Licenses", callback_data: "menu_mykeys" }
          ]);
        }
        buttons.push([
          { text: "\u{1F4BE} Download Desktop App", callback_data: "menu_download" }
        ]);
        buttons.push([
          { text: "\u{1F50D} Check Status", callback_data: "menu_status" }
        ]);
        if (isAdmin) {
          buttons.push([
            { text: "\u274C Revoke License", callback_data: "menu_revoke" }
          ]);
        }
        buttons.push([
          { text: "\u2753 Help", callback_data: "menu_help" }
        ]);
        return { inline_keyboard: buttons };
      }
      getGenerateDurationMenu() {
        return {
          inline_keyboard: [
            [
              { text: "7 Days", callback_data: "gen_7" },
              { text: "30 Days", callback_data: "gen_30" }
            ],
            [
              { text: "90 Days", callback_data: "gen_90" },
              { text: "365 Days (1 Year)", callback_data: "gen_365" }
            ],
            [
              { text: "\u267E\uFE0F Lifetime", callback_data: "gen_lifetime" }
            ],
            [
              { text: "\xAB Back to Menu", callback_data: "menu_main" }
            ]
          ]
        };
      }
      getBackButton() {
        return {
          inline_keyboard: [
            [{ text: "\xAB Back to Menu", callback_data: "menu_main" }]
          ]
        };
      }
      setupCommands() {
        if (!this.bot) return;
        this.bot.onText(/\/start/, async (msg) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          const username = msg.from?.username || msg.from?.first_name || "User";
          if (!userId) return;
          const isAdmin = this.isAdmin(userId);
          await this.bot?.sendMessage(
            chatId,
            `\u{1F44B} Welcome ${username}!`,
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        });
        this.bot.onText(/\/menu/, async (msg) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          if (!userId) return;
          const isAdmin = this.isAdmin(userId);
          await this.bot?.sendMessage(
            chatId,
            "\u{1F4CB} Select an option:",
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        });
        this.bot.onText(/\/myid/, async (msg) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          const username = msg.from?.username || msg.from?.first_name || "User";
          if (!userId) return;
          await this.bot?.sendMessage(
            chatId,
            `\u{1F464} *Your Telegram Info*

User ID: \`${userId}\`
Username: ${username}

Copy your User ID to update licenses.`,
            { parse_mode: "Markdown" }
          );
        });
        this.bot.onText(/\/broadcast (.+)/, async (msg, match) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          if (!userId) return;
          if (!await this.checkAdminAccess(userId, chatId)) {
            return;
          }
          const message = match?.[1];
          if (!message) {
            await this.bot?.sendMessage(
              chatId,
              "\u274C Please provide a message to broadcast.\n\nUsage: `/broadcast Your message here`",
              { parse_mode: "Markdown" }
            );
            return;
          }
          const broadcastId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const broadcastData = {
            id: broadcastId,
            message,
            timestamp: Date.now(),
            adminId: userId
          };
          this.broadcastMessages.push(broadcastData);
          if (this.broadcastMessages.length > 50) {
            this.broadcastMessages = this.broadcastMessages.slice(-50);
          }
          await this.saveBroadcastToDatabase(broadcastData);
          await this.bot?.sendMessage(
            chatId,
            `\u2705 *Broadcast sent!*

Message: ${message}

All Electron app users will receive this notification.`,
            { parse_mode: "Markdown" }
          );
          console.log(`[Telegram Bot] Admin ${userId} sent broadcast: ${message}`);
        });
        this.bot.onText(/\/claimlicenses/, async (msg) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          if (!userId) return;
          if (!await this.checkAdminAccess(userId, chatId)) {
            return;
          }
          try {
            const allLicenses = await licenseService.getAllLicenses();
            const unknownLicenses = allLicenses.filter((l) => !l.telegramUserId || l.telegramUserId === "Unknown");
            if (unknownLicenses.length === 0) {
              await this.bot?.sendMessage(
                chatId,
                "\u2705 No unclaimed licenses found.",
                { parse_mode: "Markdown" }
              );
              return;
            }
            for (const license of unknownLicenses) {
              await licenseService.updateLicense(license.id, {
                telegramUserId: userId.toString(),
                telegramUsername: msg.from?.username || msg.from?.first_name || "Admin"
              });
            }
            await this.bot?.sendMessage(
              chatId,
              `\u2705 *Claimed ${unknownLicenses.length} license(s)*

All unclaimed licenses are now assigned to you.
Use /mykeys to view them.`,
              { parse_mode: "Markdown" }
            );
          } catch (error) {
            console.error("Error claiming licenses:", error);
            await this.bot?.sendMessage(
              chatId,
              "\u274C Error claiming licenses",
              { parse_mode: "Markdown" }
            );
          }
        });
        this.bot.on("callback_query", async (query) => {
          const chatId = query.message?.chat.id;
          const userId = query.from.id;
          const messageId = query.message?.message_id;
          const data = query.data;
          if (!chatId || !userId || !data) return;
          const publicActions = ["menu_download", "menu_status", "menu_help", "menu_main"];
          if (!publicActions.includes(data) && !await this.checkAdminAccess(userId, chatId)) {
            await this.bot?.answerCallbackQuery(query.id, {
              text: "\u274C Access denied",
              show_alert: true
            });
            return;
          }
          await this.bot?.answerCallbackQuery(query.id);
          switch (data) {
            case "menu_main":
              const isAdmin = this.isAdmin(userId);
              try {
                await this.bot?.editMessageText(
                  "\u{1F4CB} Select an option:",
                  {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: "Markdown",
                    reply_markup: this.getMainMenu(isAdmin)
                  }
                );
              } catch (error) {
                await this.bot?.sendMessage(
                  chatId,
                  "\u{1F4CB} Select an option:",
                  {
                    parse_mode: "Markdown",
                    reply_markup: this.getMainMenu(isAdmin)
                  }
                );
              }
              break;
            case "menu_generate":
              await this.bot?.editMessageText(
                "\u23F1\uFE0F Select duration:",
                {
                  chat_id: chatId,
                  message_id: messageId,
                  parse_mode: "Markdown",
                  reply_markup: this.getGenerateDurationMenu()
                }
              );
              break;
            case "gen_7":
            case "gen_30":
            case "gen_90":
            case "gen_365":
            case "gen_lifetime":
              await this.handleGenerateLicense(chatId, userId, query.from.username || "Unknown", data);
              break;
            case "menu_mykeys":
              await this.handleMyKeys(chatId, userId);
              break;
            case "menu_status":
              this.userStates.set(userId, { action: "awaiting_status_key" });
              await this.bot?.sendMessage(
                chatId,
                "\u{1F511} Send license key:",
                {
                  parse_mode: "Markdown",
                  reply_markup: this.getBackButton()
                }
              );
              break;
            case "menu_revoke":
              this.userStates.set(userId, { action: "awaiting_revoke_key" });
              await this.bot?.sendMessage(
                chatId,
                "\u{1F511} Send license key to revoke:",
                {
                  parse_mode: "Markdown",
                  reply_markup: this.getBackButton()
                }
              );
              break;
            case "menu_download":
              this.userStates.set(userId, { action: "awaiting_download_key" });
              await this.bot?.sendMessage(
                chatId,
                "\u{1F511} Send your license key:",
                {
                  parse_mode: "Markdown",
                  reply_markup: this.getBackButton()
                }
              );
              break;
            case "menu_help":
              try {
                await this.bot?.editMessageText(
                  "\u{1F4D6} Use buttons to generate, check, or download with license key.",
                  {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: "Markdown",
                    reply_markup: this.getBackButton()
                  }
                );
              } catch (error) {
                await this.bot?.sendMessage(
                  chatId,
                  "\u{1F4D6} Use buttons to generate, check, or download with license key.",
                  {
                    parse_mode: "Markdown",
                    reply_markup: this.getBackButton()
                  }
                );
              }
              break;
          }
        });
        this.bot.on("message", async (msg) => {
          if (msg.text?.startsWith("/")) return;
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          const text2 = msg.text?.trim();
          if (!userId || !text2) return;
          const state = this.userStates.get(userId);
          if (!state?.action) {
            await this.bot?.sendMessage(
              chatId,
              "\u{1F44B} Welcome! Please use /start to begin.",
              { reply_markup: { remove_keyboard: true } }
            );
            return;
          }
          const publicStates = ["awaiting_status_key", "awaiting_download_key"];
          const isPublicAction = state.action && publicStates.includes(state.action);
          if (!isPublicAction && !await this.checkAdminAccess(userId, chatId)) {
            return;
          }
          if (state.action === "awaiting_status_key") {
            this.userStates.delete(userId);
            await this.handleCheckStatus(chatId, userId, text2);
          } else if (state.action === "awaiting_revoke_key") {
            this.userStates.delete(userId);
            await this.handleRevokeLicense(chatId, userId, text2);
          } else if (state.action === "awaiting_download_key") {
            this.userStates.delete(userId);
            await this.handleDownloadApp(chatId, userId, text2);
          }
        });
        this.bot.on("polling_error", (error) => {
          console.error("Telegram polling error:", error);
        });
      }
      async handleGenerateLicense(chatId, userId, username, action) {
        const isAdmin = this.isAdmin(userId);
        try {
          let durationDays;
          switch (action) {
            case "gen_7":
              durationDays = 7;
              break;
            case "gen_30":
              durationDays = 30;
              break;
            case "gen_90":
              durationDays = 90;
              break;
            case "gen_365":
              durationDays = 365;
              break;
            case "gen_lifetime":
              durationDays = void 0;
              break;
          }
          const license = await licenseService.createLicense(
            userId.toString(),
            username,
            durationDays
          );
          const durationText = durationDays ? `${durationDays} days` : "Lifetime";
          const expiryText = license.expiresAt ? `\u{1F4C5} Expires: ${license.expiresAt.toLocaleDateString()}` : "\u267E\uFE0F Never expires";
          await this.bot?.sendMessage(
            chatId,
            `\u2705 \`${license.licenseKey}\` (${durationText})`,
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        } catch (error) {
          console.error("Error generating license:", error);
          await this.bot?.sendMessage(
            chatId,
            "\u274C Failed to generate license",
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        }
      }
      async handleMyKeys(chatId, userId) {
        const isAdmin = this.isAdmin(userId);
        try {
          const allLicenses = await licenseService.getAllLicenses();
          let userLicenses = allLicenses.filter((l) => l.telegramUserId === userId.toString());
          if (userLicenses.length === 0 && isAdmin) {
            const unknownLicenses = allLicenses.filter((l) => !l.telegramUserId || l.telegramUserId === "Unknown");
            if (unknownLicenses.length > 0) {
              for (const license of unknownLicenses) {
                await licenseService.updateLicense(license.id, {
                  telegramUserId: userId.toString(),
                  telegramUsername: "Admin"
                });
              }
              const updatedLicenses = await licenseService.getAllLicenses();
              userLicenses = updatedLicenses.filter((l) => l.telegramUserId === userId.toString());
              console.log(`[Telegram Bot] Auto-claimed ${unknownLicenses.length} unknown licenses for admin ${userId}`);
            }
          }
          if (userLicenses.length === 0) {
            await this.bot?.sendMessage(
              chatId,
              "\u{1F4CB} No licenses found",
              {
                parse_mode: "Markdown",
                reply_markup: this.getMainMenu(isAdmin)
              }
            );
            return;
          }
          const licenseList = userLicenses.map((license, index) => {
            const expiryText = license.expiresAt ? `Expires: ${license.expiresAt.toLocaleDateString()}` : "Lifetime";
            let statusIcon = "\u{1F7E2}";
            let statusText = "Active";
            if (license.status === "expired") {
              statusIcon = "\u{1F7E1}";
              statusText = "Expired";
            } else if (license.status === "revoked") {
              statusIcon = "\u{1F534}";
              statusText = "Revoked";
            }
            return `${index + 1}. ${statusIcon} *${statusText}*
   Key: \`${license.licenseKey}\`
   ${expiryText}`;
          }).join("\n\n");
          const activeLicenses = userLicenses.filter((l) => l.status === "active").length;
          await this.bot?.sendMessage(
            chatId,
            `\u{1F4CB} *My Licenses* (${userLicenses.length} total, ${activeLicenses} active)

` + licenseList,
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        } catch (error) {
          console.error("Error fetching licenses:", error);
          await this.bot?.sendMessage(
            chatId,
            "\u274C Error loading licenses",
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        }
      }
      async handleCheckStatus(chatId, userId, licenseKey) {
        const isAdmin = this.isAdmin(userId);
        try {
          const result = await licenseService.verifyLicense(licenseKey);
          if (!result.valid) {
            await this.bot?.sendMessage(
              chatId,
              `\u274C Invalid: ${result.reason}`,
              {
                parse_mode: "Markdown",
                reply_markup: this.getMainMenu(isAdmin)
              }
            );
            return;
          }
          const license = result.license;
          const expiryText = license.expiresAt ? `Expires ${license.expiresAt.toLocaleDateString()}` : "Lifetime";
          await this.bot?.sendMessage(
            chatId,
            `\u2705 Valid - ${license.status} (${expiryText})`,
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        } catch (error) {
          console.error("Error checking license status:", error);
          await this.bot?.sendMessage(
            chatId,
            "\u274C Error checking status",
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        }
      }
      async handleRevokeLicense(chatId, userId, licenseKey) {
        const isAdmin = this.isAdmin(userId);
        try {
          const license = await licenseService.revokeLicense(licenseKey);
          if (!license) {
            await this.bot?.sendMessage(
              chatId,
              `\u274C License not found`,
              {
                parse_mode: "Markdown",
                reply_markup: this.getMainMenu(isAdmin)
              }
            );
            return;
          }
          await this.bot?.sendMessage(
            chatId,
            `\u2705 License revoked`,
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        } catch (error) {
          console.error("Error revoking license:", error);
          await this.bot?.sendMessage(
            chatId,
            "\u274C Error revoking license",
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        }
      }
      async handleDownloadApp(chatId, userId, licenseKey) {
        const isAdmin = this.isAdmin(userId);
        try {
          const result = await licenseService.verifyLicense(licenseKey);
          if (!result.valid) {
            await this.bot?.sendMessage(
              chatId,
              `\u274C ${result.reason}`,
              {
                parse_mode: "Markdown",
                reply_markup: this.getMainMenu(isAdmin)
              }
            );
            return;
          }
          await this.bot?.sendMessage(
            chatId,
            `\u23F3 Preparing package...`,
            { parse_mode: "Markdown" }
          );
          const timestamp2 = Date.now();
          const zipPath = path2.join(process.cwd(), "uploads", `u-p-cls-${timestamp2}.zip`);
          await fs2.promises.mkdir(path2.dirname(zipPath), { recursive: true });
          const output = fs2.createWriteStream(zipPath);
          const archive = archiver("zip", { store: true });
          output.on("close", async () => {
            try {
              await this.bot?.sendDocument(
                chatId,
                zipPath,
                {
                  caption: `\u{1F4E6} Extract and run - license pre-configured`,
                  parse_mode: "Markdown",
                  reply_markup: this.getMainMenu(isAdmin)
                }
              );
              await fs2.promises.unlink(zipPath);
              console.log(`[Telegram Bot] Sent desktop app to user, cleaned up ${zipPath}`);
            } catch (error) {
              console.error("[Telegram Bot] Error sending file:", error);
              await this.bot?.sendMessage(
                chatId,
                "\u274C Failed to send package",
                {
                  parse_mode: "Markdown",
                  reply_markup: this.getMainMenu(isAdmin)
                }
              );
            }
          });
          archive.on("error", (err) => {
            throw err;
          });
          archive.pipe(output);
          const userPackagePath = path2.join(process.cwd(), "u-p");
          console.log(`[Telegram Bot] Creating ZIP from: ${userPackagePath}`);
          const walkAndAddFiles = async (dir, baseDir) => {
            let count = 0;
            const entries = await fs2.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path2.join(dir, entry.name);
              const relativePath = path2.relative(baseDir, fullPath);
              if (entry.name === ".env" || entry.name === ".env.example") {
                continue;
              }
              if (entry.isDirectory()) {
                count += await walkAndAddFiles(fullPath, baseDir);
              } else if (entry.isFile()) {
                const content = await fs2.promises.readFile(fullPath);
                archive.append(content, { name: relativePath });
                count++;
              }
            }
            return count;
          };
          const fileCount = await walkAndAddFiles(userPackagePath, userPackagePath);
          console.log(`[Telegram Bot] Added ${fileCount} files to ZIP`);
          const serverUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://your-replit-app.replit.app";
          const envContent = `# Email Sender Desktop App Configuration

# Your license key (Pre-configured by Telegram bot)
LICENSE_KEY=${licenseKey}

# Replit server URL
REPLIT_SERVER_URL=${serverUrl}

# Development mode
NODE_ENV=production
`;
          archive.append(envContent, { name: ".env" });
          await archive.finalize();
        } catch (error) {
          console.error("[Telegram Bot] Error preparing download:", error);
          await this.bot?.sendMessage(
            chatId,
            "\u274C Error preparing package",
            {
              parse_mode: "Markdown",
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        }
      }
      isRunning() {
        return this.isInitialized && this.bot !== null;
      }
      stop() {
        if (this.bot) {
          this.bot.stopPolling();
          this.bot = null;
          this.isInitialized = false;
          this.userStates.clear();
          console.log("Telegram bot stopped");
        }
      }
      // Get broadcasts newer than a timestamp (excluding those already dismissed by this user)
      getBroadcastsSince(since, userId) {
        let messages = this.broadcastMessages;
        if (since) {
          messages = messages.filter((msg) => msg.timestamp > since);
        }
        if (userId) {
          const dismissedKey = `dismissed_${userId}`;
          const dismissed = this.dismissedBroadcasts.get(dismissedKey) || /* @__PURE__ */ new Set();
          messages = messages.filter((msg) => !dismissed.has(msg.id));
        }
        return messages;
      }
      // Mark a broadcast as dismissed for a specific user - permanently deletes from database
      async dismissBroadcast(broadcastId, userId) {
        const index = this.broadcastMessages.findIndex((msg) => msg.id === broadcastId);
        if (index !== -1) {
          this.broadcastMessages.splice(index, 1);
          console.log(`[Telegram Bot] Removed broadcast ${broadcastId} from memory`);
        }
        await storage.deleteBroadcastMessage(broadcastId);
        const dismissedKey = `dismissed_${userId}`;
        if (!this.dismissedBroadcasts.has(dismissedKey)) {
          this.dismissedBroadcasts.set(dismissedKey, /* @__PURE__ */ new Set());
        }
        this.dismissedBroadcasts.get(dismissedKey).add(broadcastId);
        console.log(`[Telegram Bot] User ${userId} dismissed broadcast ${broadcastId}`);
      }
      async loadBroadcastsFromDatabase() {
        try {
          const broadcasts2 = await storage.getBroadcastMessages(50);
          this.broadcastMessages = broadcasts2.map((b) => ({
            id: b.id,
            message: b.message,
            timestamp: new Date(b.timestamp).getTime(),
            adminId: parseInt(b.adminId) || 0
          }));
          console.log(`[Telegram Bot] Loaded ${this.broadcastMessages.length} broadcast messages from database`);
        } catch (error) {
          console.error("[Telegram Bot] Failed to load broadcasts from database:", error);
          this.broadcastMessages = [];
        }
      }
      async saveBroadcastToDatabase(broadcast) {
        try {
          await storage.saveBroadcastMessage({
            id: broadcast.id,
            message: broadcast.message,
            timestamp: new Date(broadcast.timestamp),
            adminId: broadcast.adminId.toString()
          });
        } catch (error) {
          console.error("[Telegram Bot] Failed to save broadcast to database:", error);
        }
      }
    };
    telegramBotService = new TelegramBotService();
  }
});

// server/index.ts
import express2 from "express";

// server/routes.ts
init_storage();
init_advancedEmailService();
init_fileService();
import { createServer } from "http";

// server/routes/originalEmailRoutes.ts
init_advancedEmailService();
init_configService();
import multer from "multer";
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join3 } from "path";
var upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 25 * 1024 * 1024,
    // 25MB max file size
    files: 10
    // Max 10 files per request
  }
});
function setupOriginalEmailRoutes(app2) {
  const progressLogs = [];
  let sendingInProgress = false;
  app2.post("/api/original/sendMail", (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            error: "File too large. Maximum file size is 25MB."
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(413).json({
            success: false,
            error: "Too many files. Maximum 10 files per upload."
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`
        });
      }
      if (err) {
        return res.status(500).json({
          success: false,
          error: "File upload failed"
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      console.log("Original sendMail endpoint called with body keys:", Object.keys(req.body));
      console.log("SMTP Settings received:", {
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        hasSmtpPass: !!req.body.smtpPass,
        senderEmail: req.body.senderEmail,
        hasUserSmtpConfigs: !!req.body.userSmtpConfigs
      });
      const isDesktopMode = "userSmtpConfigs" in req.body;
      let hasUserSmtpConfigs = false;
      let userSmtpConfigsArray = [];
      if (isDesktopMode) {
        try {
          userSmtpConfigsArray = typeof req.body.userSmtpConfigs === "string" ? JSON.parse(req.body.userSmtpConfigs) : req.body.userSmtpConfigs;
          if (!Array.isArray(userSmtpConfigsArray)) {
            return res.status(400).json({
              success: false,
              error: "Invalid userSmtpConfigs format. Expected JSON array."
            });
          }
          hasUserSmtpConfigs = userSmtpConfigsArray.length > 0;
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: "Invalid userSmtpConfigs format. Expected JSON array."
          });
        }
      }
      const hasLegacySmtp = req.body.smtpHost && req.body.smtpUser && req.body.smtpPass;
      if (isDesktopMode && !hasUserSmtpConfigs) {
        return res.status(400).json({
          success: false,
          error: "Desktop mode requires SMTP configuration in local smtp.ini file. Please configure user-package/config/smtp.ini with your SMTP credentials. Server SMTP is not available for desktop users."
        });
      }
      if (!isDesktopMode && !hasLegacySmtp) {
        const missingFields = [];
        if (!req.body.smtpHost) missingFields.push("Host");
        if (!req.body.smtpUser) missingFields.push("User");
        if (!req.body.smtpPass) missingFields.push("Password");
        return res.status(400).json({
          success: false,
          error: `SMTP configuration incomplete. Missing: ${missingFields.join(", ")}`
        });
      }
      const files = req.files;
      const attachments = files?.map((file) => ({
        path: file.path,
        filename: file.originalname,
        contentType: file.mimetype
      })) || [];
      let recipients = req.body.recipients;
      if (typeof recipients === "string") {
        try {
          recipients = JSON.parse(recipients);
        } catch {
          recipients = recipients.split("\n").map((r) => r.trim()).filter((r) => r);
        }
      }
      let settings = req.body.settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch {
          settings = {};
        }
      }
      let userSmtpConfigs = [];
      let userSmtpRotationEnabled = false;
      if (req.body.userSmtpConfigs) {
        try {
          userSmtpConfigs = typeof req.body.userSmtpConfigs === "string" ? JSON.parse(req.body.userSmtpConfigs) : req.body.userSmtpConfigs;
          userSmtpRotationEnabled = req.body.smtpRotationEnabled === "true" || req.body.smtpRotationEnabled === true;
          console.log("[Server] Received user SMTP configs:", {
            count: userSmtpConfigs.length,
            rotationEnabled: userSmtpRotationEnabled,
            configs: userSmtpConfigs.map((c) => ({
              id: c.id,
              host: c.host,
              port: c.port,
              user: c.user === "" ? "(empty)" : c.user,
              pass: c.pass === "" ? "(empty)" : "***",
              fromEmail: c.fromEmail
            }))
          });
        } catch (error) {
          console.error("[Server] Failed to parse user SMTP configs:", error);
        }
      }
      const args = {
        ...req.body,
        ...settings,
        recipients,
        attachments,
        senderEmail: req.body.senderEmail,
        senderName: req.body.senderName,
        subject: req.body.subject,
        html: req.body.html || req.body.emailContent,
        attachmentHtml: req.body.attachmentHtml,
        // User's SMTP configs for rotation (if provided by desktop app)
        userSmtpConfigs,
        userSmtpRotationEnabled,
        // SMTP settings - with validation (fallback to first user SMTP or request params)
        smtpHost: req.body.smtpHost || "",
        smtpPort: req.body.smtpPort || "587",
        smtpUser: req.body.smtpUser || "",
        smtpPass: req.body.smtpPass || "",
        // Advanced settings
        sleep: req.body.sleep,
        qrSize: parseInt(req.body.qrSize) || 200,
        qrBorder: parseInt(req.body.qrBorder) || 2,
        qrForegroundColor: req.body.qrForegroundColor || "#000000",
        qrBackgroundColor: req.body.qrBackgroundColor || "#FFFFFF",
        // Hidden image overlay settings
        hiddenImageFile: req.body.hiddenImageFile || "",
        hiddenImageSize: parseInt(req.body.hiddenImageSize) || 50,
        hiddenText: req.body.hiddenText || "",
        // QR Code boolean
        qrcode: req.body.qrcode === "true" || req.body.qrcode === true,
        linkPlaceholder: req.body.linkPlaceholder,
        htmlImgBody: req.body.htmlImgBody === "true" || req.body.htmlImgBody === true,
        randomMetadata: req.body.randomMetadata === "true" || req.body.randomMetadata === true,
        minifyHtml: req.body.minifyHtml === "true" || req.body.minifyHtml === true,
        emailPerSecond: parseInt(req.body.emailPerSecond) || 5,
        zipUse: req.body.zipUse === "true" || req.body.zipUse === true,
        zipPassword: req.body.zipPassword,
        fileName: req.body.fileName,
        htmlConvert: req.body.htmlConvert,
        // Template rotation setting
        templateRotation: req.body.templateRotation === "true" || req.body.templateRotation === true,
        // Additional missing parameters with proper conversion
        retry: parseInt(req.body.retry) || 0,
        priority: req.body.priority || "2",
        domainLogoSize: req.body.domainLogoSize || "70%",
        borderStyle: req.body.borderStyle || "solid",
        borderColor: req.body.borderColor || "#000000",
        // Proxy settings
        proxyUse: req.body.proxyUse === "true" || req.body.proxyUse === true,
        proxyType: req.body.proxyType || "socks5",
        proxyHost: req.body.proxyHost || "",
        proxyPort: req.body.proxyPort || "",
        proxyUser: req.body.proxyUser || "",
        proxyPass: req.body.proxyPass || ""
      };
      progressLogs.length = 0;
      sendingInProgress = true;
      advancedEmailService.sendMail(args, (progress) => {
        const progressData = {
          recipient: progress.recipient || "Unknown",
          subject: progress.subject || args.subject || "No Subject",
          status: progress.status,
          error: progress.error || null,
          timestamp: progress.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
          totalSent: progress.totalSent,
          totalFailed: progress.totalFailed,
          totalRecipients: progress.totalRecipients,
          smtp: progress.smtp || null
        };
        progressLogs.push(progressData);
      }).then((result) => {
        sendingInProgress = false;
        const completionLog = {
          type: "complete",
          success: result.success,
          sent: result.sent,
          failed: result.failed,
          error: result.error,
          details: result.details,
          failedEmails: result.failedEmails || [],
          totalRecipients: result.totalRecipients,
          totalProcessed: result.totalProcessed,
          isPartialCompletion: result.isPartialCompletion || false,
          wasCancelled: result.wasCancelled || false,
          unexpectedExit: result.unexpectedExit || false
        };
        if (result.isPartialCompletion) {
          const reason = result.wasCancelled ? "cancelled" : result.unexpectedExit ? "unexpected exit" : "unknown";
          console.warn(`[Routes] Partial completion detected (${reason}): ${result.totalProcessed}/${result.totalRecipients} emails processed.`);
        }
        progressLogs.push(completionLog);
      }).catch((error) => {
        sendingInProgress = false;
        const errorLog = {
          type: "error",
          error: error.message || "Unknown error occurred"
        };
        console.error("[Routes] Email sending caught error:", error);
        progressLogs.push(errorLog);
      });
      res.json({ success: true, message: "Email sending started" });
    } catch (error) {
      console.error("Error in sendMail:", error);
      sendingInProgress = false;
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error"
      });
    }
  });
  app2.get("/api/original/progress", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const since = parseInt(req.query.since) || 0;
    const newLogs = progressLogs.slice(since);
    res.json({
      logs: newLogs,
      total: progressLogs.length,
      inProgress: sendingInProgress
    });
  });
  app2.post("/api/original/cancel", (req, res) => {
    advancedEmailService.cancelSend();
    sendingInProgress = false;
    res.json({ success: true, message: "Email sending cancelled" });
  });
  app2.get("/api/original/listFiles", async (req, res) => {
    const folder = req.query.folder || "files";
    const result = await advancedEmailService.listFiles(folder);
    res.json(result);
  });
  app2.get("/api/original/listLogoFiles", async (req, res) => {
    const result = await advancedEmailService.listLogoFiles();
    res.json(result);
  });
  app2.post("/api/original/readFile", async (req, res) => {
    const { filepath } = req.body;
    const result = await advancedEmailService.readFile(filepath);
    res.json(result);
  });
  app2.post("/api/original/writeFile", async (req, res) => {
    const { filepath, content } = req.body;
    const result = await advancedEmailService.writeFile(filepath, content);
    res.json(result);
  });
  app2.post("/api/config/save", async (req, res) => {
    try {
      const updates = req.body;
      const configPath = join3(process.cwd(), "config", "setup.ini");
      let content = readFileSync3(configPath, "utf8");
      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (content.match(regex)) {
          content = content.replace(regex, `${key}=${value}`);
        } else {
          content = content.replace("[CONFIG]", `[CONFIG]
${key}=${value}`);
        }
      }
      writeFileSync3(configPath, content, "utf8");
      configService.loadConfig();
      res.json({ success: true, message: "Configuration saved" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// server/routes/electronRoutes.ts
init_fileService();

// server/utils/validation.ts
import { z as z2 } from "zod";
var emailSchema = z2.string().email("Invalid email format");
var smtpConfigSchema2 = z2.object({
  smtpHost: z2.string().min(1, "SMTP host is required"),
  smtpPort: z2.string().regex(/^\d+$/, "Port must be a number").optional().default("587"),
  smtpUser: z2.string().min(1, "SMTP user is required"),
  smtpPass: z2.string().min(1, "SMTP password is required"),
  senderEmail: emailSchema.optional(),
  senderName: z2.string().optional()
});
var filePathSchema = z2.string().min(1, "File path is required").refine((path5) => !path5.includes(".."), "Path traversal not allowed").refine((path5) => !path5.startsWith("/"), "Absolute paths not allowed").refine((path5) => path5.length <= 255, "File path too long");
var recipientsSchema = z2.union([
  z2.array(emailSchema),
  z2.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((email) => {
          const result = emailSchema.safeParse(email);
          if (!result.success) {
            ctx.addIssue({
              code: z2.ZodIssueCode.custom,
              message: `Invalid email: ${email}`
            });
          }
          return email;
        });
      }
      return str.split("\n").map((email) => email.trim()).filter((email) => email.length > 0).map((email) => {
        const result = emailSchema.safeParse(email);
        if (!result.success) {
          ctx.addIssue({
            code: z2.ZodIssueCode.custom,
            message: `Invalid email: ${email}`
          });
        }
        return email;
      });
    } catch {
      return str.split("\n").map((email) => email.trim()).filter((email) => email.length > 0).map((email) => {
        const result = emailSchema.safeParse(email);
        if (!result.success) {
          ctx.addIssue({
            code: z2.ZodIssueCode.custom,
            message: `Invalid email: ${email}`
          });
        }
        return email;
      });
    }
  })
]);
var emailContentSchema = z2.object({
  subject: z2.string().min(1, "Subject is required").max(255, "Subject too long"),
  html: z2.string().min(1, "Email content is required"),
  attachmentHtml: z2.string().optional()
});
var emailSettingsSchema = z2.object({
  emailPerSecond: z2.number().int().min(1).max(100).default(5),
  qrSize: z2.number().int().min(50).max(1e3).default(200),
  qrBorder: z2.number().int().min(0).max(20).default(2),
  qrForegroundColor: z2.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#000000"),
  qrBackgroundColor: z2.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#FFFFFF"),
  hiddenImageSize: z2.number().int().min(10).max(200).default(50),
  qrcode: z2.boolean().default(false),
  htmlImgBody: z2.boolean().default(false),
  randomMetadata: z2.boolean().default(false),
  minifyHtml: z2.boolean().default(false),
  zipUse: z2.boolean().default(false),
  retry: z2.number().int().min(0).max(10).default(0),
  domainLogoSize: z2.string().regex(/^\d+%?$/, "Invalid size format").default("70%"),
  borderStyle: z2.enum(["solid", "dashed", "dotted", "double", "none"]).default("solid"),
  borderColor: z2.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#000000"),
  proxyUse: z2.boolean().default(false)
});
var fileContentSchema = z2.string().max(10 * 1024 * 1024, "File content too large (max 10MB)").refine((content) => {
  const dangerousPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /function\s*\(/gi
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }
  return true;
}, "Content contains potentially dangerous scripts");
function validateRequest(schema, data) {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
      return { success: false, errors };
    }
  } catch (error) {
    return { success: false, errors: ["Validation failed: " + String(error)] };
  }
}
function formatValidationError(errors) {
  return {
    error: `Validation failed: ${errors.length} error(s)`,
    details: errors
  };
}

// server/routes/electronRoutes.ts
init_telegramBotService();
function setupElectronRoutes(app2) {
  const fileService = new FileService();
  app2.get("/api/electron/listFiles", async (req, res) => {
    try {
      const dirpath = req.query.dirpath || "";
      const extensionFilter = req.query.ext;
      let extensions;
      if (extensionFilter) {
        extensions = extensionFilter.split(",").map((ext) => ext.trim());
      } else {
        extensions = [".html", ".htm"];
      }
      const result = await fileService.listFilesWithFallback(dirpath, extensions, true);
      console.log(`[ElectronAPI] Listed ${result.files.length} files from user-package/${dirpath || "files"}`);
      res.json(result);
    } catch (error) {
      console.error("[ElectronAPI] List files error:", error);
      res.status(500).json({ error: "Failed to list files", files: [] });
    }
  });
  app2.get("/api/electron/listLogoFiles", async (req, res) => {
    try {
      const logoExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
      const result = await fileService.listFilesWithFallback("files/logo", logoExtensions, true);
      console.log(`[ElectronAPI] Listed ${result.files.length} logo files from user-package/files/logo`);
      res.json(result);
    } catch (error) {
      console.error("[ElectronAPI] List logo files error:", error);
      res.status(500).json({ error: "Failed to list logo files", files: [] });
    }
  });
  app2.get("/api/electron/readFile", async (req, res) => {
    try {
      const filepath = req.query.filepath;
      const validation = validateRequest(filePathSchema, filepath);
      if (!validation.success) {
        return res.status(400).json(formatValidationError(validation.errors));
      }
      const content = await fileService.readFileWithFallback(validation.data, true);
      if (content === null) {
        return res.status(404).json({
          error: "File not found",
          message: "The requested file does not exist in user-package location"
        });
      }
      console.log(`[ElectronAPI] Successfully read file from user-package: ${validation.data}`);
      res.json({ content, filepath: validation.data });
    } catch (error) {
      console.error("[ElectronAPI] Read file error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to read file due to server error"
      });
    }
  });
  app2.post("/api/electron/writeFile", async (req, res) => {
    try {
      const { filepath, content } = req.body;
      const pathValidation = validateRequest(filePathSchema, filepath);
      if (!pathValidation.success) {
        return res.status(400).json({
          ...formatValidationError(pathValidation.errors),
          success: false
        });
      }
      const contentValidation = validateRequest(fileContentSchema, content);
      if (!contentValidation.success) {
        return res.status(400).json({
          ...formatValidationError(contentValidation.errors),
          success: false
        });
      }
      const success = await fileService.writeFileSecure(pathValidation.data, contentValidation.data);
      if (!success) {
        return res.status(400).json({
          error: "Write operation failed",
          message: "File path is not allowed or write operation failed",
          success: false
        });
      }
      console.log(`[ElectronAPI] Successfully wrote file: ${pathValidation.data}`);
      res.json({
        success: true,
        filepath: pathValidation.data,
        size: contentValidation.data.length
      });
    } catch (error) {
      console.error("[ElectronAPI] Write file error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to write file due to server error",
        success: false
      });
    }
  });
  app2.get("/api/electron/listConfigFiles", async (req, res) => {
    try {
      const configExtensions = [".ini", ".conf", ".config"];
      const result = await fileService.listFilesWithFallback("config", configExtensions, true);
      console.log(`[ElectronAPI] Listed ${result.files.length} config files from user-package/config`);
      res.json(result);
    } catch (error) {
      console.error("[ElectronAPI] List config files error:", error);
      res.status(500).json({ error: "Failed to list config files", files: [] });
    }
  });
  app2.post("/api/telegram/broadcasts/:broadcastId/dismiss", async (req, res) => {
    const { broadcastId } = req.params;
    const userId = req.header("X-User-ID") || "desktop-user";
    console.log(`[Electron Routes] Permanently dismissing broadcast ${broadcastId} for user ${userId}`);
    await telegramBotService.dismissBroadcast(broadcastId, userId);
    res.json({ success: true, message: "Broadcast permanently dismissed" });
  });
  console.log("[ElectronAPI] Electron-compatible routes registered");
}

// server/routes/aiRoutes.ts
init_aiService();
function setupAIRoutes(app2) {
  app2.post("/api/ai/initialize", (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: "API key required" });
    }
    const success = aiService.initialize(apiKey);
    res.json({ success, message: success ? "AI initialized" : "Initialization failed" });
  });
  app2.post("/api/ai/deinitialize", (req, res) => {
    const success = aiService.deinitialize();
    res.json({ success, message: "AI deinitialized" });
  });
  app2.get("/api/ai/status", (req, res) => {
    const status = aiService.getStatus();
    res.json(status);
  });
  app2.post("/api/ai/test", async (req, res) => {
    const { type, context } = req.body;
    if (!aiService.isInitialized()) {
      return res.status(400).json({ success: false, error: "AI not initialized" });
    }
    try {
      let result;
      if (type === "subject") {
        result = await aiService.generateSubject(context);
      } else if (type === "senderName") {
        result = await aiService.generateSenderName(context);
      } else {
        return res.status(400).json({ success: false, error: "Invalid type" });
      }
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// server/routes.ts
init_licenseService();
init_configService();
init_telegramBotService();
import multer2 from "multer";
import { join as join4 } from "path";
import { readFileSync as readFileSync4, existsSync as existsSync3 } from "fs";
import nodemailer2 from "nodemailer";
var upload2 = multer2({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
    // 10MB per file
    files: 10,
    // Max 10 files
    fields: 50
    // Max 50 form fields
  }
});
async function registerRoutes(app2) {
  const emailService = advancedEmailService;
  const fileService = new FileService();
  setupOriginalEmailRoutes(app2);
  setupElectronRoutes(app2);
  setupAIRoutes(app2);
  app2.post("/api/telegram/webhook", async (req, res) => {
    try {
      await telegramBotService.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("[Telegram] Webhook error:", error);
      res.sendStatus(500);
    }
  });
  app2.get("/api/telegram/broadcasts", async (req, res) => {
    try {
      const since = parseInt(req.query.since) || 0;
      const userId = req.query.userId || req.headers["x-user-id"];
      const messages = telegramBotService.getBroadcastsSince(since, userId);
      if (messages.length > 0) {
        console.log(`[Telegram Broadcast] \u2705 Returning ${messages.length} messages for user ${userId || "anonymous"}`);
      }
      res.status(200).json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          message: msg.message,
          timestamp: msg.timestamp
        })),
        serverTime: Date.now(),
        inProgress: false
      });
    } catch (error) {
      console.error("[Telegram Broadcast] \u274C Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch broadcasts"
      });
    }
  });
  app2.post("/api/telegram/broadcasts/:id/dismiss", async (req, res) => {
    try {
      const broadcastId = req.params.id;
      const userId = req.body.userId || req.headers["x-user-id"];
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID required to dismiss broadcast"
        });
      }
      telegramBotService.dismissBroadcast(broadcastId, userId);
      res.json({
        success: true,
        message: "Broadcast dismissed successfully"
      });
    } catch (error) {
      console.error("[Telegram Broadcast] \u274C Dismissal error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to dismiss broadcast"
      });
    }
  });
  app2.get("/api/config/load", (req, res) => {
    try {
      const config = configService.loadConfig();
      const emailConfig = configService.getEmailConfig();
      res.json({ success: true, config: emailConfig });
    } catch (error) {
      console.error("Config load error:", error);
      res.status(500).json({ success: false, error: "Failed to load configuration" });
    }
  });
  app2.get("/api/config/loadLeads", (req, res) => {
    try {
      const leadsPath = join4(process.cwd(), "files", "leads.txt");
      if (existsSync3(leadsPath)) {
        const leadsContent = readFileSync4(leadsPath, "utf-8");
        const leads = leadsContent.trim();
        res.json({ success: true, leads });
      } else {
        res.json({ success: true, leads: "" });
      }
    } catch (error) {
      console.error("Lead loading error:", error);
      res.status(500).json({ success: false, error: "Failed to load leads" });
    }
  });
  app2.get("/api/placeholders", (req, res) => {
    res.json({
      user: ["user", "email", "username", "domain", "domainbase", "initials", "userid", "userupper", "userlower"],
      random: ["randfirst", "randlast", "randname", "randcompany", "randdomain", "randtitle"],
      dynamic: ["date", "time", "hash6", "randnum4", "senderemail"]
    });
  });
  app2.post("/api/html/process", async (req, res) => {
    try {
      const { htmlContent, recipient, settings } = req.body;
      if (!htmlContent || !recipient) {
        return res.status(400).json({ error: "HTML content and recipient required" });
      }
      const advancedEmailService2 = (await Promise.resolve().then(() => (init_advancedEmailService(), advancedEmailService_exports))).advancedEmailService;
      const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString();
      const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      const senderEmail = settings?.senderEmail || "sender@example.com";
      const { injectDynamicPlaceholders: injectDynamicPlaceholders2, replacePlaceholders: replacePlaceholders2 } = await Promise.resolve().then(() => (init_advancedEmailService(), advancedEmailService_exports));
      let processedHtml = htmlContent;
      processedHtml = await injectDynamicPlaceholders2(processedHtml, recipient, senderEmail, dateStr, timeStr);
      processedHtml = replacePlaceholders2(processedHtml);
      res.json({ processedHtml });
    } catch (error) {
      console.error("Error processing HTML:", error);
      res.status(500).json({ error: "Failed to process HTML" });
    }
  });
  app2.post("/api/files/upload", upload2.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const result = await fileService.processUploadedFile(req.file);
      res.json(result);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
  app2.get("/api/smtp/list", (req, res) => {
    try {
      const smtpConfigs = configService.getAllSmtpConfigs();
      const currentSmtp = configService.getCurrentSmtpConfig();
      const rotationEnabled = configService.isSmtpRotationEnabled();
      res.json({
        success: true,
        smtpConfigs,
        currentSmtp,
        rotationEnabled
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/smtp/toggle-rotation", async (req, res) => {
    try {
      const { enabled } = req.body;
      configService.setSmtpRotationEnabled(enabled);
      res.json({
        success: true,
        rotationEnabled: configService.isSmtpRotationEnabled(),
        currentSmtp: configService.getCurrentSmtpConfig()
      });
    } catch (error) {
      console.error("[SMTP Toggle Rotation] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  app2.post("/api/smtp/add", (req, res) => {
    try {
      const { host, port, user, pass, fromEmail, fromName } = req.body;
      if (!host || !port || !fromEmail) {
        return res.status(400).json({ success: false, error: "Host, Port, and From Email are required" });
      }
      const smtpId = configService.addSmtpConfig({
        host,
        port,
        user: user || "",
        pass: pass || "",
        fromEmail,
        fromName
      });
      res.json({
        success: true,
        smtpId,
        smtpConfigs: configService.getAllSmtpConfigs()
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.delete("/api/smtp/:smtpId", (req, res) => {
    try {
      const { smtpId } = req.params;
      const deleted = configService.deleteSmtpConfig(smtpId);
      if (deleted) {
        res.json({
          success: true,
          smtpConfigs: configService.getAllSmtpConfigs(),
          currentSmtp: configService.getCurrentSmtpConfig()
        });
      } else {
        res.status(404).json({ success: false, error: "SMTP config not found" });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/smtp/rotate", (req, res) => {
    try {
      const nextSmtp = configService.rotateToNextSmtp();
      res.json({
        success: true,
        currentSmtp: nextSmtp,
        rotationEnabled: configService.isSmtpRotationEnabled()
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/smtp/test/:smtpId", async (req, res) => {
    try {
      const { smtpId } = req.params;
      const smtpConfigs = configService.getAllSmtpConfigs();
      const smtp = smtpConfigs.find((s) => s.id === smtpId);
      if (!smtp) {
        return res.json({
          success: false,
          online: false,
          smtpId,
          error: "SMTP configuration not found"
        });
      }
      const port = Number(smtp.port);
      const transporterConfig = {
        host: smtp.host,
        port,
        secure: port === 465,
        pool: true,
        maxConnections: 1,
        maxMessages: 1,
        connectionTimeout: 1e4,
        greetingTimeout: 1e4,
        tls: {
          rejectUnauthorized: false
        }
      };
      if (smtp.user && smtp.pass) {
        transporterConfig.auth = {
          user: smtp.user,
          pass: smtp.pass
        };
      }
      const transporter = nodemailer2.createTransport(transporterConfig);
      try {
        await transporter.verify();
        res.json({
          success: true,
          online: true,
          smtpId,
          smtp: {
            host: smtp.host,
            port: smtp.port,
            fromEmail: smtp.fromEmail
          }
        });
      } catch (verifyError) {
        res.json({
          success: false,
          online: false,
          smtpId,
          error: verifyError.message || "SMTP connection failed",
          smtp: {
            host: smtp.host,
            port: smtp.port,
            fromEmail: smtp.fromEmail
          }
        });
      } finally {
        transporter.close();
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        online: false,
        smtpId: req.params.smtpId,
        error: error.message
      });
    }
  });
  app2.get("/api/smtp/test", async (req, res) => {
    try {
      const currentSmtp = configService.getCurrentSmtpConfig();
      if (!currentSmtp) {
        return res.json({
          success: false,
          online: false,
          error: "No SMTP configuration available"
        });
      }
      const port = Number(currentSmtp.port);
      const transporterConfig = {
        host: currentSmtp.host,
        port,
        secure: port === 465,
        pool: true,
        maxConnections: 1,
        maxMessages: 1,
        tls: {
          rejectUnauthorized: false
        }
      };
      if (currentSmtp.user && currentSmtp.pass) {
        transporterConfig.auth = {
          user: currentSmtp.user,
          pass: currentSmtp.pass
        };
      }
      const transporter = nodemailer2.createTransport(transporterConfig);
      try {
        await transporter.verify();
        res.json({
          success: true,
          online: true,
          smtp: {
            host: currentSmtp.host,
            port: currentSmtp.port,
            fromEmail: currentSmtp.fromEmail
          }
        });
      } catch (verifyError) {
        res.json({
          success: false,
          online: false,
          error: verifyError.message || "SMTP connection failed",
          smtp: {
            host: currentSmtp.host,
            port: currentSmtp.port,
            fromEmail: currentSmtp.fromEmail
          }
        });
      } finally {
        transporter.close();
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        online: false,
        error: error.message
      });
    }
  });
  app2.post("/api/license/verify", async (req, res) => {
    try {
      const { licenseKey, hardwareId } = req.body;
      if (!licenseKey) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: "License key is required"
        });
      }
      if (!hardwareId || typeof hardwareId !== "string" || hardwareId.trim() === "") {
        return res.status(400).json({
          success: false,
          valid: false,
          error: "Hardware ID is required for license verification"
        });
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[License] Dev mode bypass - allowing license for testing");
        return res.json({
          success: true,
          valid: true,
          reason: "Development mode - license check bypassed",
          license: {
            key: licenseKey,
            status: "active",
            type: "dev",
            activatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      }
      const result = await licenseService.verifyLicense(licenseKey, hardwareId);
      res.json({
        success: true,
        valid: result.valid,
        reason: result.reason,
        license: result.license
      });
    } catch (error) {
      console.error("License verification error:", error);
      res.status(500).json({
        success: false,
        valid: false,
        error: "Failed to verify license"
      });
    }
  });
  app2.get("/api/license/status/:licenseKey", async (req, res) => {
    try {
      const { licenseKey } = req.params;
      const result = await licenseService.verifyLicense(licenseKey);
      res.json({
        success: true,
        valid: result.valid,
        reason: result.reason,
        license: result.license
      });
    } catch (error) {
      console.error("License status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check license status"
      });
    }
  });
  app2.get("/api/licenses/stats", async (req, res) => {
    try {
      const allLicenses = await storage.getAllLicenses();
      const stats = {
        total: allLicenses.length,
        active: allLicenses.filter((l) => l.status === "active").length,
        expired: allLicenses.filter((l) => l.status === "expired").length,
        revoked: allLicenses.filter((l) => l.status === "revoked").length,
        byStatus: {
          active: allLicenses.filter((l) => l.status === "active"),
          expired: allLicenses.filter((l) => l.status === "expired"),
          revoked: allLicenses.filter((l) => l.status === "revoked")
        }
      };
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error("License stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get license statistics"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs3 from "fs";
import path4 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path3 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path3.resolve(import.meta.dirname, "client", "src"),
      "@shared": path3.resolve(import.meta.dirname, "shared"),
      "@assets": path3.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path3.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path3.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      const error = e;
      vite.ssrFixStacktrace(error);
      console.error("Vite HTML transform error:", {
        message: error.message,
        stack: error.stack,
        url
      });
      if (!res.headersSent) {
        res.status(500).set({ "Content-Type": "text/html" }).end(`
          <!DOCTYPE html>
          <html><head><title>Server Error</title></head>
          <body>
            <h1>Development Server Error</h1>
            <p>Failed to transform HTML template</p>
            <pre>${error.message}</pre>
          </body></html>
        `);
      }
    }
  });
}
function serveStatic(app2) {
  const distPath = path4.resolve(import.meta.dirname, "..", "dist", "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the production build. Ensure you've run \`npm run build\` before starting the server.`
    );
  }
  app2.use(express.static(distPath, {
    maxAge: "1d",
    etag: false
  }));
  app2.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "API route not found" });
    }
    const indexPath = path4.resolve(distPath, "index.html");
    if (fs3.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("index.html not found");
    }
  });
}

// server/index.ts
import { execSync } from "child_process";
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection at:", promise, "reason:", reason);
  if (reason instanceof Error) {
    console.error("Error stack:", reason.stack);
  }
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  console.error("Error stack:", error.stack);
});
process.on("warning", (warning) => {
  if (warning.name === "DeprecationWarning") {
    console.warn("Deprecation Warning:", warning.message);
  }
});
function performStartupCleanup() {
  setTimeout(() => {
    try {
      log("\u{1F527} Performing background cleanup...");
      const isWindows = process.platform === "win32";
      if (!isWindows) {
        const processCount = execSync('ps aux | grep -E "(tsx|node)" | grep -v grep | wc -l', { encoding: "utf8" }).trim();
        log(`Current process count: ${processCount}`);
        if (parseInt(processCount) > 15) {
          log("\u26A0\uFE0F  High process count - performing cleanup");
        }
      } else {
        log("Windows detected - skipping process cleanup");
      }
      log("\u2705 Background cleanup check completed");
    } catch (error) {
      log("Cleanup check failed (ignored)");
    }
  }, 2e3);
}
performStartupCleanup();
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path5 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path5.startsWith("/api")) {
      const skipLogging = [
        "/api/ai/status",
        "/api/config/load",
        "/api/smtp/list",
        "/api/original/listFiles",
        "/api/original/listLogoFiles",
        "/api/telegram/broadcasts"
      ].includes(path5);
      if (!skipLogging) {
        let logLine = `${req.method} ${path5} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "\u2026";
        }
        log(logLine);
      }
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  const { configService: configService2 } = await Promise.resolve().then(() => (init_configService(), configService_exports));
  configService2.loadConfig();
  const config = configService2.getEmailConfig();
  const apiKey = config.GOOGLE_AI_KEY || process.env.GOOGLE_AI_KEY;
  if (apiKey) {
    const { aiService: aiService2 } = await Promise.resolve().then(() => (init_aiService(), aiService_exports));
    const initialized = aiService2.initialize(apiKey);
    if (initialized) {
      log("\u2705 AI Service auto-initialized with Google Gemini (15 RPM, 1M/day limit)");
    } else {
      log("\u26A0\uFE0F  AI Service initialization failed");
    }
  }
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const { telegramBotService: telegramBotService2 } = await Promise.resolve().then(() => (init_telegramBotService(), telegramBotService_exports));
    const webhookUrl = "https://xen-1-cls8080.replit.app/api/telegram/webhook";
    const initialized = await telegramBotService2.initialize(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_ADMIN_CHAT_IDS,
      webhookUrl
    );
    if (initialized) {
      log("\u2705 Telegram License Bot initialized successfully with webhooks");
      log(`   Webhook URL: ${webhookUrl}`);
    } else {
      log("\u26A0\uFE0F  Telegram Bot initialization failed");
    }
  } else {
    log("\u2139\uFE0F  Telegram bot not configured (set TELEGRAM_BOT_TOKEN to enable license generation)");
  }
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`Error handling request ${req.method} ${req.path}:`, {
      error: err.message || err,
      stack: err.stack,
      status,
      path: req.path,
      method: req.method
    });
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    if (process.env.NODE_ENV !== "production") {
      throw err;
    }
  });
  const isDevelopment = process.env.NODE_ENV === "development";
  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
    if (!isDevelopment) {
      log(`Production mode - serving static files from dist/public`);
    } else {
      log(`Development mode - using Vite middleware`);
    }
    if (process.platform === "win32") {
      const url = `http://localhost:${port}`;
      log(`Opening browser at ${url}`);
      try {
        execSync(`start "" "${url}"`, { stdio: "ignore" });
      } catch (error) {
        log(`Failed to open browser automatically. Please visit: ${url}`);
        try {
          execSync(`rundll32 url.dll,FileProtocolHandler "${url}"`, { stdio: "ignore" });
        } catch (altError) {
          log(`All auto-open methods failed. Please manually visit: ${url}`);
        }
      }
    }
  });
  const shutdown = async (signal) => {
    log(`${signal} signal received: closing HTTP server`);
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { telegramBotService: telegramBotService2 } = await Promise.resolve().then(() => (init_telegramBotService(), telegramBotService_exports));
      if (telegramBotService2.isRunning()) {
        telegramBotService2.stop();
        log("Telegram bot stopped");
      }
    }
    const { FileService: FileService2 } = await Promise.resolve().then(() => (init_fileService(), fileService_exports));
    const fileService = new FileService2();
    await fileService.cleanup();
    const { advancedEmailService: advancedEmailService2 } = await Promise.resolve().then(() => (init_advancedEmailService(), advancedEmailService_exports));
    await advancedEmailService2.cleanup();
    server.close(() => {
      log("HTTP server closed");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
