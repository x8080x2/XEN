import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { advancedEmailService } from "./services/advancedEmailService";
import { FileService } from "./services/fileService";
import { setupOriginalEmailRoutes } from "./routes/originalEmailRoutes";
import { setupElectronRoutes } from "./routes/electronRoutes";
import { setupAIRoutes } from "./routes/aiRoutes";
import { licenseService } from "./services/licenseService";

import { configService } from "./services/configService";
import multer from "multer";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files
    fields: 50 // Max 50 form fields
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const emailService = advancedEmailService; // Using the singleton instance
  const fileService = new FileService();

  // Setup original email routes (exact clone functionality)
  setupOriginalEmailRoutes(app);

  // Setup electron-compatible routes for user-package integration
  setupElectronRoutes(app);

  // Setup AI routes
  setupAIRoutes(app);


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

  // Load leads/maillist from files/leads.txt
  app.get('/api/config/loadLeads', (req, res) => {
    try {
      const leadsPath = join(process.cwd(), 'files', 'leads.txt');
      if (existsSync(leadsPath)) {
        const leadsContent = readFileSync(leadsPath, 'utf-8');
        const leads = leadsContent.trim();
        res.json({ success: true, leads });
      } else {
        res.json({ success: true, leads: '' });
      }
    } catch (error) {
      console.error('Lead loading error:', error);
      res.status(500).json({ success: false, error: 'Failed to load leads' });
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

      // Process placeholders using AdvancedEmailService logic
      const advancedEmailService = (await import('./services/advancedEmailService')).advancedEmailService;

      // Use the same placeholder processing as the email service
      const dateStr = new Date().toLocaleDateString();
      const timeStr = new Date().toLocaleTimeString();
      const senderEmail = settings?.senderEmail || 'sender@example.com';

      // Import the placeholder processing functions
      const { injectDynamicPlaceholders, replacePlaceholders } = await import('./services/advancedEmailService');

      let processedHtml = htmlContent;
      processedHtml = injectDynamicPlaceholders(processedHtml, recipient, senderEmail, dateStr, timeStr);
      processedHtml = replacePlaceholders(processedHtml);

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

  app.post("/api/license/verify", async (req, res) => {
    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        return res.status(400).json({ 
          success: false, 
          valid: false,
          error: 'License key is required' 
        });
      }

      const result = await licenseService.verifyLicense(licenseKey);

      res.json({
        success: true,
        valid: result.valid,
        reason: result.reason,
        license: result.license
      });
    } catch (error: any) {
      console.error('License verification error:', error);
      res.status(500).json({ 
        success: false, 
        valid: false,
        error: 'Failed to verify license' 
      });
    }
  });

  app.get("/api/license/status/:licenseKey", async (req, res) => {
    try {
      const { licenseKey } = req.params;

      const result = await licenseService.verifyLicense(licenseKey);

      res.json({
        success: true,
        valid: result.valid,
        reason: result.reason,
        license: result.license
      });
    } catch (error: any) {
      console.error('License status error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to check license status' 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}