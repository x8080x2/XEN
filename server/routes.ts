import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { advancedEmailService } from "./services/advancedEmailService";
import { FileService } from "./services/fileService";
import { setupOriginalEmailRoutes } from "./routes/originalEmailRoutes";
import { setupElectronRoutes } from "./routes/electronRoutes";
import { setupAIRoutes } from "./routes/aiRoutes";
import { licenseService } from "./services/licenseService";
import { tunnelService } from "./services/tunnelService";

import { configService } from "./services/configService";
import multer from "multer";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import nodemailer from "nodemailer";
import { telegramBotService } from './services/telegramBotService';

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

  // Telegram webhook endpoint (receives updates from Telegram)
  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      await telegramBotService.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error('[Telegram] Webhook error:', error);
      res.sendStatus(500);
    }
  });

  // Get broadcast messages (polling endpoint for Electron apps)
  app.get('/api/telegram/broadcasts', async (req, res) => {
    try {
      const since = parseInt(req.query.since as string) || 0;
      const userId = req.query.userId as string || req.headers['x-user-id'] as string;

      const messages = telegramBotService.getBroadcastsSince(since, userId);
      
      // Only log when there are actual messages to return
      if (messages.length > 0) {
        console.log(`[Telegram Broadcast] ✅ Returning ${messages.length} messages for user ${userId || 'anonymous'}`);
      }

      res.status(200).json({
        success: true,
        messages: messages.map(msg => ({
          id: msg.id,
          message: msg.message,
          timestamp: msg.timestamp
        })),
        serverTime: Date.now(),
        inProgress: false
      });
    } catch (error) {
      console.error('[Telegram Broadcast] ❌ Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch broadcasts'
      });
    }
  });

  // Dismiss a broadcast for a specific user
  app.post('/api/telegram/broadcasts/:id/dismiss', async (req, res) => {
    try {
      const broadcastId = req.params.id;
      const userId = req.body.userId || req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID required to dismiss broadcast'
        });
      }

      telegramBotService.dismissBroadcast(broadcastId, userId);

      res.json({
        success: true,
        message: 'Broadcast dismissed successfully'
      });
    } catch (error) {
      console.error('[Telegram Broadcast] ❌ Dismissal error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dismiss broadcast'
      });
    }
  });

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
      processedHtml = await injectDynamicPlaceholders(processedHtml, recipient, senderEmail, dateStr, timeStr);
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

  // SMTP toggle rotation
  app.post("/api/smtp/toggle-rotation", async (req, res) => {
    try {
      const { enabled } = req.body;
      configService.setSmtpRotationEnabled(enabled);

      res.json({
        success: true,
        rotationEnabled: configService.isSmtpRotationEnabled(),
        currentSmtp: configService.getCurrentSmtpConfig()
      });
    } catch (error: any) {
      console.error('[SMTP Toggle Rotation] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.post("/api/smtp/add", (req, res) => {
    try {
      const { host, port, user, pass, fromEmail, fromName } = req.body;

      // Only require host, port, and fromEmail - username/password are optional
      if (!host || !port || !fromEmail) {
        return res.status(400).json({ success: false, error: "Host, Port, and From Email are required" });
      }

      const smtpId = configService.addSmtpConfig({
        host, port, user: user || '', pass: pass || '', fromEmail, fromName
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

  app.get("/api/smtp/test/:smtpId", async (req, res) => {
    try {
      const { smtpId } = req.params;
      const smtpConfigs = configService.getAllSmtpConfigs();
      const smtp = smtpConfigs.find((s: any) => s.id === smtpId);

      if (!smtp) {
        return res.json({
          success: false,
          online: false,
          smtpId,
          error: "SMTP configuration not found"
        });
      }

      const port = Number(smtp.port);
      const transporterConfig: any = {
        host: smtp.host,
        port: port,
        secure: port === 465,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        tls: {
          rejectUnauthorized: false
        }
      };
      
      // For port 25, disable TLS entirely and add timeout settings to avoid connection hanging
      // Note: pooling and rate limiting are not used for port 25 to prevent connection hangs
      if (port === 25) {
        transporterConfig.ignoreTLS = true;
        transporterConfig.requireTLS = false;
        transporterConfig.secure = false;
        transporterConfig.connectionTimeout = 30000;
        transporterConfig.greetingTimeout = 30000;
        transporterConfig.socketTimeout = 60000;
      }

      if (smtp.user && smtp.pass) {
        transporterConfig.auth = {
          user: smtp.user,
          pass: smtp.pass
        };
      }

      const transporter = nodemailer.createTransport(transporterConfig);

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
      } catch (verifyError: any) {
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        online: false,
        smtpId: req.params.smtpId,
        error: error.message
      });
    }
  });

  app.get("/api/smtp/test", async (req, res) => {
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
      const transporterConfig: any = {
        host: currentSmtp.host,
        port: port,
        secure: port === 465,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        tls: {
          rejectUnauthorized: false
        }
      };
      
      // For port 25, disable TLS entirely and add timeout settings to avoid connection hanging
      // Note: pooling and rate limiting are not used for port 25 to prevent connection hangs
      if (port === 25) {
        transporterConfig.ignoreTLS = true;
        transporterConfig.requireTLS = false;
        transporterConfig.secure = false;
        transporterConfig.connectionTimeout = 30000;
        transporterConfig.greetingTimeout = 30000;
        transporterConfig.socketTimeout = 60000;
      }

      if (currentSmtp.user && currentSmtp.pass) {
        transporterConfig.auth = {
          user: currentSmtp.user,
          pass: currentSmtp.pass
        };
      }

      const transporter = nodemailer.createTransport(transporterConfig);

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
      } catch (verifyError: any) {
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        online: false,
        error: error.message
      });
    }
  });

  app.post("/api/license/verify", async (req, res) => {
    try {
      const { licenseKey, hardwareId } = req.body;

      if (!licenseKey) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'License key is required'
        });
      }

      if (!hardwareId || typeof hardwareId !== 'string' || hardwareId.trim() === '') {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Hardware ID is required for license verification'
        });
      }

      // Development mode bypass for testing with dev URL
      if (process.env.NODE_ENV === 'development') {
        console.log('[License] Dev mode bypass - allowing license for testing');
        return res.json({
          success: true,
          valid: true,
          reason: 'Development mode - license check bypassed',
          license: {
            key: licenseKey,
            status: 'active',
            type: 'dev',
            activatedAt: new Date().toISOString()
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

  app.get("/api/licenses/stats", async (req, res) => {
    try {
      const allLicenses = await storage.getAllLicenses();

      const stats = {
        total: allLicenses.length,
        active: allLicenses.filter(l => l.status === 'active').length,
        expired: allLicenses.filter(l => l.status === 'expired').length,
        revoked: allLicenses.filter(l => l.status === 'revoked').length,
        byStatus: {
          active: allLicenses.filter(l => l.status === 'active'),
          expired: allLicenses.filter(l => l.status === 'expired'),
          revoked: allLicenses.filter(l => l.status === 'revoked')
        }
      };

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error('License stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get license statistics'
      });
    }
  });

  // Tunnel status endpoints for port 25 SMTP routing
  app.get("/api/tunnel/status/:licenseKey", async (req, res) => {
    try {
      const { licenseKey } = req.params;
      const status = tunnelService.getClientStatus(licenseKey);
      
      res.json({
        success: true,
        ...status
      });
    } catch (error: any) {
      console.error('Tunnel status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tunnel status'
      });
    }
  });

  // Tunnel status by tunnel ID (hashed license key - more secure for desktop app)
  app.get("/api/tunnel/status-by-id/:tunnelId", async (req, res) => {
    try {
      const { tunnelId } = req.params;
      const status = tunnelService.getTunnelStatusById(tunnelId);
      
      res.json({
        success: true,
        ...status
      });
    } catch (error: any) {
      console.error('Tunnel status by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tunnel status'
      });
    }
  });

  app.get("/api/tunnel/clients", async (req, res) => {
    try {
      const clients = tunnelService.getAllConnectedClients();
      
      res.json({
        success: true,
        count: clients.length,
        clients: clients.map(key => key.substring(0, 8) + '...')
      });
    } catch (error: any) {
      console.error('Tunnel clients error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tunnel clients'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}