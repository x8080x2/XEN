import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailSendRequestSchema } from "../shared/schema";
import { advancedEmailService } from "./services/advancedEmailService";
import { FileService } from "./services/fileService";
import { setupOriginalEmailRoutes } from "./routes/originalEmailRoutes";
import { 
  requireValidLicense, 
  requireFeature, 
  validateEmailLimits, 
  recordEmailUsage, 
  attachLicenseInfo 
} from "./middleware/licenseMiddleware";
import licenseRoutes from "./routes/licenseRoutes";

import { configService } from "./services/configService";
import multer from "multer";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";

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

  // License management routes
  app.use('/api/license', licenseRoutes);

  // User Package Authentication System  
  const userPackageTokens = new Map<string, {
    packageId: string;
    userId: string;
    createdAt: Date;
    lastUsed: Date;
    emailLimit: number;
    emailCount: number;
    isActive: boolean;
  }>();

  // Generate user package token (SECURED admin endpoint)
  app.post('/api/admin/generate-user-package-token', requireValidLicense, (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        return res.status(500).json({ 
          success: false, 
          error: 'ADMIN_SECRET environment variable must be configured' 
        });
      }
      if (req.headers['x-admin-secret'] !== adminSecret) {
        return res.status(403).json({ success: false, error: 'Invalid admin secret' });
      }

      const { packageId, userId, emailLimit = 1000 } = req.body;
      const token = randomBytes(32).toString('hex');
      
      userPackageTokens.set(token, {
        packageId: packageId || `pkg_${randomBytes(4).toString('hex')}`,
        userId: userId || `user_${randomBytes(4).toString('hex')}`,
        createdAt: new Date(),
        lastUsed: new Date(),
        emailLimit,
        emailCount: 0,
        isActive: true,
      });

      console.log(`Generated user package token for ${packageId || 'anonymous'}`);
      res.json({
        success: true,
        token,
        packageId: userPackageTokens.get(token)!.packageId,
        emailLimit,
      });
    } catch (error: any) {
      console.error('Token generation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // User Package Email Sending Endpoint
  app.post('/api/user-package/sendMail', upload.any(), async (req, res) => {
    try {
      // Authenticate user package
      const token = req.headers['x-package-token'] as string;
      if (!token) {
        return res.status(401).json({ success: false, error: 'Package token required' });
      }

      const packageAuth = userPackageTokens.get(token);
      if (!packageAuth || !packageAuth.isActive) {
        return res.status(401).json({ success: false, error: 'Invalid or inactive package token' });
      }

      // Parse recipients first, then check email limits
      let recipients = req.body.recipients;
      if (typeof recipients === 'string') {
        try {
          recipients = JSON.parse(recipients);
        } catch {
          recipients = recipients.split('\n').filter((r: string) => r.trim());
        }
      }

      // Validate recipients and check limits
      if (!recipients || (!Array.isArray(recipients) && typeof recipients !== 'string')) {
        return res.status(400).json({ success: false, error: 'Recipients required' });
      }
      
      const recipientCount = Array.isArray(recipients) ? recipients.length : 1;
      if (packageAuth.emailCount + recipientCount > packageAuth.emailLimit) {
        return res.status(429).json({ 
          success: false, 
          error: `Email limit exceeded. Remaining: ${packageAuth.emailLimit - packageAuth.emailCount}, Requested: ${recipientCount}` 
        });
      }

      // Update last used time
      packageAuth.lastUsed = new Date();

      console.log(`User package sendMail request from ${packageAuth.packageId}:`, req.body);

      // Forward to the same logic as main service
      const files = req.files as Express.Multer.File[];
      const attachments = files?.map(file => file.path) || [];

      let settings = req.body.settings;
      if (typeof settings === 'string') {
        try {
          settings = JSON.parse(settings);
        } catch {
          settings = {};
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
        // SMTP settings
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        smtpPass: req.body.smtpPass,
        // Advanced settings - all available to user packages
        sleep: req.body.sleep,
        qrSize: parseInt(req.body.qrSize) || 200,
        qrBorder: parseInt(req.body.qrBorder) || 2,
        qrForegroundColor: req.body.qrForegroundColor || '#000000',
        qrBackgroundColor: req.body.qrBackgroundColor || '#FFFFFF',
        hiddenImageFile: req.body.hiddenImageFile || '',
        hiddenImageSize: parseInt(req.body.hiddenImageSize) || 50,
        hiddenText: req.body.hiddenText || '',
        qrcode: req.body.qrcode === 'true' || req.body.qrcode === true,
        linkPlaceholder: req.body.linkPlaceholder,
        htmlImgBody: req.body.htmlImgBody === 'true' || req.body.htmlImgBody === true,
        randomMetadata: req.body.randomMetadata === 'true' || req.body.randomMetadata === true,
        minifyHtml: req.body.minifyHtml === 'true' || req.body.minifyHtml === true,
        emailPerSecond: parseInt(req.body.emailPerSecond) || 5,
        zipUse: req.body.zipUse === 'true' || req.body.zipUse === true,
        zipPassword: req.body.zipPassword,
        fileName: req.body.fileName,
        htmlConvert: req.body.htmlConvert,
        // Package identification for logging
        packageId: packageAuth.packageId,
        packageUserId: packageAuth.userId,
      };

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      res.setHeader('X-Accel-Buffering', 'no');

      let emailsSent = 0;

      // Use the same callback interface as original email routes
      try {
        const result = await emailService.sendMail(args, (progress: any) => {
          if (progress.status === 'success') {
            emailsSent++;
            packageAuth.emailCount++;
          }

          // Send progress update in same format as original
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            recipient: progress.recipient,
            subject: progress.subject,
            status: progress.status,
            error: progress.error,
            timestamp: progress.timestamp,
            emailsSent,
            totalRecipients: Array.isArray(args.recipients) ? args.recipients.length : 1,
            packageId: packageAuth.packageId
          })}\n\n`);
        });

        // Send completion notification
        res.write(`data: ${JSON.stringify({
          type: 'completed',
          totalSent: emailsSent,
          message: 'Email sending completed',
          packageId: packageAuth.packageId
        })}\n\n`);
        
        console.log(`User package ${packageAuth.packageId} completed sending ${emailsSent} emails`);
        res.end();
        
      } catch (error: any) {
        console.error('User package email sending error:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error.message,
          details: error.details || 'Unknown error occurred'
        })}\n\n`);
        res.end();
      }

    } catch (error: any) {
      console.error('User package sendMail error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Failed to process user package email request'
      });
    }
  });

  // Capability URL System - Direct email sending for users
  const capabilityTokens = new Map<string, {
    userId: string;
    createdAt: Date;
    lastUsed: Date;
    emailLimit: number;
    emailCount: number;
  }>();

  // Generate capability token for a user (SECURED admin endpoint)
  app.post('/api/admin/generate-capability-token', requireValidLicense, (req, res) => {
    try {
      // Additional security: Require admin secret (no default fallback)
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        return res.status(500).json({ 
          success: false, 
          error: 'ADMIN_SECRET environment variable must be configured' 
        });
      }
      if (req.headers['x-admin-secret'] !== adminSecret) {
        return res.status(403).json({ success: false, error: 'Invalid admin secret' });
      }

      const { userId, emailLimit = 1000 } = req.body;
      const token = randomBytes(32).toString('hex'); // Generate secure random token
      
      capabilityTokens.set(token, {
        userId: userId || 'user_' + randomBytes(4).toString('hex'),
        createdAt: new Date(),
        lastUsed: new Date(),
        emailLimit,
        emailCount: 0
      });

      res.json({
        success: true,
        token,
        sendUrl: `/api/cap/${token}/send`,
        fullUrl: `${req.protocol}://${req.get('host')}/api/cap/${token}/send`,
        emailLimit
      });
    } catch (error: any) {
      console.error('Token generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate capability token' });
    }
  });

  // Capability URL endpoint - Direct email sending with just URL
  app.post('/api/cap/:token/send', upload.any(), async (req, res) => {
    try {
      const { token } = req.params;
      const capability = capabilityTokens.get(token);

      // Validate capability token
      if (!capability) {
        return res.status(401).json({ success: false, error: 'Invalid capability token' });
      }

      // Check email limit
      if (capability.emailCount >= capability.emailLimit) {
        return res.status(429).json({ 
          success: false, 
          error: `Email limit reached (${capability.emailLimit})`,
          emailCount: capability.emailCount,
          emailLimit: capability.emailLimit
        });
      }

      // Update last used
      capability.lastUsed = new Date();

      const files = req.files as Express.Multer.File[];
      const attachments = files?.map(file => ({
        filename: file.originalname,
        path: file.path,
        contentType: file.mimetype,
      })) || [];

      // Parse and validate recipients
      let recipients = req.body.recipients;
      if (typeof recipients === 'string') {
        try {
          recipients = JSON.parse(recipients);
        } catch {
          recipients = recipients.split('\n').filter((r: string) => r.trim());
        }
      }

      // Validate recipients array
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Recipients must be a non-empty array' 
        });
      }

      // Update email count BEFORE sending (prevent race conditions)
      if (capability.emailCount + recipients.length > capability.emailLimit) {
        return res.status(429).json({ 
          success: false, 
          error: `Would exceed email limit (${capability.emailLimit})`,
          requested: recipients.length,
          available: capability.emailLimit - capability.emailCount
        });
      }
      
      capability.emailCount += recipients.length;

      // Set up Server-Sent Events for real-time progress
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const sendProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Load configuration from config service
      const config = configService.loadConfig();
      const emailConfig = configService.getEmailConfig();

      // Prepare arguments for email service (similar to original endpoint)
      const args = {
        ...req.body,
        recipients,
        attachments,
        senderEmail: req.body.senderEmail || emailConfig.SMTP?.USER || 'noreply@example.com',
        senderName: req.body.senderName || 'Email Sender',
        subject: req.body.subject || 'No Subject',
        html: req.body.html || req.body.emailContent || '<p>No content</p>',
        // SMTP settings from config or request
        smtpHost: req.body.smtpHost || emailConfig.SMTP?.HOST,
        smtpPort: req.body.smtpPort || emailConfig.SMTP?.PORT,
        smtpUser: req.body.smtpUser || emailConfig.SMTP?.USER,
        smtpPass: req.body.smtpPass || emailConfig.SMTP?.PASS,
        // Advanced settings with defaults
        emailPerSecond: parseInt(req.body.emailPerSecond) || parseInt(emailConfig.EMAILPERSECOND) || 5,
        sleep: req.body.sleep || emailConfig.SLEEP || '1000',
        qrcode: req.body.qrcode === 'true' || req.body.qrcode === true || emailConfig.QRCODE === 'true',
        qrSize: parseInt(req.body.qrSize) || parseInt(emailConfig.QR_WIDTH) || 200,
        qrBorder: parseInt(req.body.qrBorder) || parseInt(emailConfig.QR_BORDER_WIDTH) || 2,
        qrForegroundColor: req.body.qrForegroundColor || emailConfig.QR_FOREGROUND_COLOR || '#000000',
        qrBackgroundColor: req.body.qrBackgroundColor || emailConfig.QR_BACKGROUND_COLOR || '#FFFFFF',
        linkPlaceholder: req.body.linkPlaceholder || emailConfig.LINK_PLACEHOLDER,
        htmlImgBody: req.body.htmlImgBody === 'true' || req.body.htmlImgBody === true || emailConfig.HTML2IMG_BODY === 'true',
        randomMetadata: req.body.randomMetadata === 'true' || req.body.randomMetadata === true || emailConfig.RANDOM_METADATA === 'true',
        minifyHtml: req.body.minifyHtml === 'true' || req.body.minifyHtml === true || emailConfig.MINIFY_HTML === 'true',
        zipUse: req.body.zipUse === 'true' || req.body.zipUse === true || emailConfig.ZIP_USE === 'true',
        zipPassword: req.body.zipPassword || emailConfig.ZIP_PASSWORD,
        fileName: req.body.fileName || emailConfig.FILE_NAME,
        htmlConvert: req.body.htmlConvert || emailConfig.HTML_CONVERT
      };

      console.log(`[Capability] Starting email send for token ${token.substring(0, 8)}... (${recipients.length} recipients)`);
      sendProgress({ status: 'starting', recipients: recipients.length, token: token.substring(0, 8) });

      // Send emails using the advanced email service
      await emailService.sendMail(args, (progress: any) => {
        sendProgress(progress);
      });

      // Email count was already updated before sending to prevent race conditions
      
      sendProgress({ 
        type: 'complete',
        status: 'completed', 
        success: true,
        emailCount: capability.emailCount,
        emailLimit: capability.emailLimit,
        remaining: capability.emailLimit - capability.emailCount
      });
      
      console.log(`[Capability] Email send completed for token ${token.substring(0, 8)}...`);
      res.end();

    } catch (error: any) {
      console.error('Capability send error:', error);
      res.write(`data: ${JSON.stringify({ 
        status: 'error', 
        error: error.message || 'Failed to send emails' 
      })}\n\n`);
      res.end();
    }
  });

  // Get capability token info
  app.get('/api/cap/:token/info', (req, res) => {
    try {
      const { token } = req.params;
      const capability = capabilityTokens.get(token);

      if (!capability) {
        return res.status(401).json({ success: false, error: 'Invalid capability token' });
      }

      res.json({
        success: true,
        userId: capability.userId,
        emailCount: capability.emailCount,
        emailLimit: capability.emailLimit,
        remaining: capability.emailLimit - capability.emailCount,
        createdAt: capability.createdAt,
        lastUsed: capability.lastUsed
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
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

      // Start processing emails in background with job tracking
      emailService.sendMail({
        recipients: validatedData.recipients,
        subject: validatedData.subject,
        html: validatedData.content,
        jobId: job.id,
        attachments: files?.map(file => ({
          filename: file.originalname,
          path: file.path,
          contentType: file.mimetype,
        })) || []
      }, async (progress) => {
        // Update job progress in database
        try {
          await storage.updateEmailJob(job.id, {
            status: 'running',
            sentCount: progress.sent || 0,
            failedCount: progress.failed || 0
          });
          
          // Log individual email results
          if (progress.recipient && progress.status) {
            await storage.createEmailLog({
              jobId: job.id,
              recipient: progress.recipient,
              status: progress.status === 'success' ? 'success' : 'failed',
              error: progress.error || null,
              // sentAt will be auto-generated by schema
            });
          }
        } catch (dbError) {
          console.error('Failed to update job progress:', dbError);
        }
      }).catch(async (error) => {
        console.error('Email sending failed:', error);
        try {
          await storage.updateEmailJob(job.id, {
            status: 'failed'
            // Note: error field not supported in job updates
          });
        } catch (dbError) {
          console.error('Failed to update job with error:', dbError);
        }
      });

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