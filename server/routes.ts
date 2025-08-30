import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailSendRequestSchema } from "@shared/schema";
import { advancedEmailService } from "./services/advancedEmailService";
import { FileService } from "./services/fileService";
import { setupOriginalEmailRoutes } from "./routes/originalEmailRoutes";

import { configService } from "./services/configService";
import multer from "multer";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const upload = multer({ dest: 'uploads/' });

export async function registerRoutes(app: Express): Promise<Server> {
  const emailService = advancedEmailService; // Using the singleton instance
  const fileService = new FileService();

  // Setup original email routes (exact clone functionality)
  setupOriginalEmailRoutes(app);

  // Config loading routes - exact clone from main.js
  app.get('/api/config/load', (req, res) => {
    try {
      const config = configService.loadConfig();
      const emailConfig = configService.getEmailConfig();
      res.json({ success: true, config: emailConfig });
    } catch (error) {
      console.error('Config load error:', error);
      res.status(500).json({ success: false, error: 'Failed to load configuration' });
    }
  });

  app.get('/api/config/smtp', (req, res) => {
    try {
      const config = configService.getEmailConfig();
      res.json({ success: true, smtp: config.SMTP || {} });
    } catch (error) {
      console.error('SMTP config error:', error);
      res.status(500).json({ success: false, error: 'Failed to load SMTP configuration' });
    }
  });

  // Load leads/maillist from files/leads.txt - exact clone from main.js line 562
  app.get('/api/config/loadLeads', (req, res) => {
    try {
      const leadsPath = join(process.cwd(), 'files', 'leads.txt');
      if (existsSync(leadsPath)) {
        const leadsContent = readFileSync(leadsPath, 'utf-8');
        const leads = Array.from(new Set(
          leadsContent
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean)
        ));
        console.log(`[ConfigService] Loaded ${leads.length} leads from leads.txt`);
        res.json({ success: true, leads: leads.join('\n') });
      } else {
        console.log('[ConfigService] No leads.txt found, returning empty');
        res.json({ success: true, leads: '' });
      }
    } catch (error: any) {
      console.error('Failed to load leads:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to load leads' });
    }
  });

  // Start email sending job
  app.post("/api/emails/send", upload.any(), async (req, res) => {
    try {
      const { recipients, subject, htmlContent, settings } = req.body;
      const files = req.files as Express.Multer.File[];

      // Parse JSON fields
      const parsedRecipients = JSON.parse(recipients);
      const parsedSettings = JSON.parse(settings);

      // Validate request
      const validatedData = emailSendRequestSchema.parse({
        configId: "default", // Using default config for now
        subject,
        content: htmlContent,
        recipients: parsedRecipients,
      });

      // Create email job
      const job = await storage.createEmailJob({
        userId: "default-user", // Using default user for now
        configId: validatedData.configId,
        subject: validatedData.subject,
        content: validatedData.content,
        recipients: validatedData.recipients,
        status: 'pending',
        totalRecipients: validatedData.recipients.length,
      });

      // Start processing emails in background  
      emailService.sendMail({
        recipients: validatedData.recipients,
        subject: validatedData.subject,
        html: validatedData.content,
        attachments: files?.map(file => ({
          filename: file.originalname,
          path: file.path,
          contentType: file.mimetype,
        })) || []
      }).catch(console.error);

      res.json({
        jobId: job.id,
        totalRecipients: job.totalRecipients,
        message: "Email sending started",
      });
    } catch (error) {
      console.error("Error starting email job:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid request" 
      });
    }
  });

  // Get email job status
  app.get("/api/emails/status/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await storage.getEmailJob(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const logs = await storage.getEmailLogsByJob(jobId);

      res.json({
        id: job.id,
        status: job.status,
        total: job.totalRecipients,
        sent: job.sentCount,
        failed: job.failedCount,
        logs: logs.map(log => ({
          recipient: log.recipient,
          status: log.status,
          message: log.status === 'success' 
            ? `Successfully sent to ${log.recipient}`
            : `Failed to send to ${log.recipient}: ${log.error}`,
          timestamp: log.sentAt,
        })),
      });
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get available placeholders
  app.get("/api/placeholders", (req, res) => {
    res.json({
      user: ["user", "email", "username", "domain", "domainbase", "initials", "userid", "userupper", "userlower"],
      random: ["randfirst", "randlast", "randname", "randcompany", "randdomain", "randtitle"],
      dynamic: ["date", "time", "hash6", "randnum4", "senderemail"],
    });
  });

  // Process HTML with placeholders (for preview)
  app.post("/api/html/process", async (req, res) => {
    try {
      const { htmlContent, recipient, settings } = req.body;

      if (!htmlContent || !recipient) {
        return res.status(400).json({ error: "HTML content and recipient required" });
      }

      // Use emailService for placeholder processing (removed duplicate placeholderService)
      const processedHtml = htmlContent; // Placeholders handled by AdvancedEmailService

      res.json({ processedHtml });
    } catch (error) {
      console.error("Error processing HTML:", error);
      res.status(500).json({ error: "Failed to process HTML" });
    }
  });

  // File upload endpoint
  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
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

  // Email configs
  app.get("/api/configs", async (req, res) => {
    try {
      const configs = await storage.getEmailConfigsByUser("default-user");
      res.json(configs);
    } catch (error) {
      console.error("Error getting configs:", error);
      res.status(500).json({ error: "Failed to get configs" });
    }
  });

  app.post("/api/configs", async (req, res) => {
    try {
      const config = await storage.createEmailConfig({
        ...req.body,
        userId: "default-user",
      });
      res.json(config);
    } catch (error) {
      console.error("Error creating config:", error);
      res.status(500).json({ error: "Failed to create config" });
    }
  });

  // SMTP Management Routes
  app.get("/api/smtp/list", (req, res) => {
    try {
      const smtpConfigs = configService.getAllSmtpConfigs();
      const currentSmtp = configService.getCurrentSmtpConfig();
      const rotationEnabled = configService.isSmtpRotationEnabled();
      
      res.json({
        success: true,
        smtpConfigs: smtpConfigs,
        currentSmtp: currentSmtp,
        rotationEnabled: rotationEnabled
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/smtp/toggle-rotation", (req, res) => {
    try {
      const { enabled } = req.body;
      configService.setSmtpRotation(enabled);
      
      res.json({
        success: true,
        rotationEnabled: configService.isSmtpRotationEnabled(),
        currentSmtp: configService.getCurrentSmtpConfig()
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/smtp/add", (req, res) => {
    try {
      const { host, port, user, pass, fromEmail, fromName } = req.body;
      
      if (!host || !port || !user || !pass || !fromEmail) {
        return res.status(400).json({ success: false, error: "All SMTP fields are required" });
      }
      
      const smtpId = configService.addSmtpConfig({
        host, port, user, pass, fromEmail, fromName
      });
      
      res.json({
        success: true,
        smtpId: smtpId,
        smtpConfigs: configService.getAllSmtpConfigs()
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/smtp/:smtpId", (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/smtp/rotate", (req, res) => {
    try {
      const nextSmtp = configService.rotateToNextSmtp();
      
      res.json({
        success: true,
        currentSmtp: nextSmtp,
        rotationEnabled: configService.isSmtpRotationEnabled()
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}