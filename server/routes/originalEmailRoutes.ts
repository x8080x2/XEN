import type { Express } from "express";
import { advancedEmailService } from "../services/advancedEmailService";
import multer from "multer";
import { configService } from "../services/configService";
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const upload = multer({ dest: 'uploads/' });

export function setupOriginalEmailRoutes(app: Express) {

  // Store progress logs in memory
  const progressLogs: any[] = [];
  let sendingInProgress = false;

  // Main sendMail endpoint - supports both polling and SSE
  app.post("/api/original/sendMail", upload.any(), async (req, res) => {
    try {
      console.log('Original sendMail endpoint called with body keys:', Object.keys(req.body));
      console.log('SMTP Settings received:', {
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        hasSmtpPass: !!req.body.smtpPass,
        senderEmail: req.body.senderEmail
      });

      // Validate SMTP settings early
      if (!req.body.smtpHost || !req.body.smtpUser || !req.body.smtpPass) {
        const missingFields = [];
        if (!req.body.smtpHost) missingFields.push('Host');
        if (!req.body.smtpUser) missingFields.push('User');
        if (!req.body.smtpPass) missingFields.push('Password');

        return res.status(400).json({
          success: false,
          error: `SMTP configuration incomplete. Missing: ${missingFields.join(', ')}`
        });
      }

      const files = req.files as Express.Multer.File[];
      const attachments = files?.map(file => file.path) || [];

      // Parse recipients if it's a string
      let recipients = req.body.recipients;
      if (typeof recipients === 'string') {
        try {
          recipients = JSON.parse(recipients);
        } catch {
          recipients = recipients.split('\n').filter((r: string) => r.trim());
        }
      }

      // Parse settings if it's a string
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
        // SMTP settings - with validation
        smtpHost: req.body.smtpHost || '',
        smtpPort: req.body.smtpPort || '587',
        smtpUser: req.body.smtpUser || '',
        smtpPass: req.body.smtpPass || '',
        // Advanced settings
        sleep: req.body.sleep,
        qrSize: parseInt(req.body.qrSize) || 200,
        qrBorder: parseInt(req.body.qrBorder) || 2,
        qrForegroundColor: req.body.qrForegroundColor || '#000000',
        qrBackgroundColor: req.body.qrBackgroundColor || '#FFFFFF',
        // Hidden image overlay settings
        hiddenImageFile: req.body.hiddenImageFile || '',
        hiddenImageSize: parseInt(req.body.hiddenImageSize) || 50,
        hiddenText: req.body.hiddenText || '',
        // QR Code boolean
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

        // Additional missing parameters with proper conversion
        retry: parseInt(req.body.retry) || 0,
        priority: req.body.priority || '2',
        domainLogoSize: req.body.domainLogoSize || '70%',
        borderStyle: req.body.borderStyle || 'solid',
        borderColor: req.body.borderColor || '#000000',

        // Proxy settings
        proxyUse: req.body.proxyUse === 'true' || req.body.proxyUse === true,
        proxyType: req.body.proxyType || 'socks5',
        proxyHost: req.body.proxyHost || '',
        proxyPort: req.body.proxyPort || '',
        proxyUser: req.body.proxyUser || '',
        proxyPass: req.body.proxyPass || '',
      };

      // Clear previous progress logs
      progressLogs.length = 0;
      sendingInProgress = true;

      // Start sending emails with progress tracking
      advancedEmailService.sendMail(args, (progress) => {
        // Store progress in memory for polling
        progressLogs.push({
          recipient: progress.recipient || 'Unknown',
          subject: progress.subject || args.subject || 'No Subject',
          status: progress.status,
          error: progress.error || null,
          timestamp: progress.timestamp || new Date().toISOString(),
          totalSent: progress.totalSent,
          totalFailed: progress.totalFailed,
          totalRecipients: progress.totalRecipients,
          smtp: progress.smtp || null
        });
      }).then((result) => {
        // Add completion log
        progressLogs.push({
          type: 'complete',
          success: result.success,
          sent: result.sent,
          error: result.error,
          details: result.details
        });
        sendingInProgress = false;
      }).catch((error: any) => {
        // Add error log
        progressLogs.push({
          type: 'error',
          error: error.message || 'Unknown error occurred'
        });
        sendingInProgress = false;
      });

      // Return immediate response for polling mode
      res.json({ success: true, message: 'Email sending started' });

    } catch (error: any) {
      console.error('Error in sendMail:', error);
      sendingInProgress = false;
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  });

  // New endpoint to poll for progress
  app.get("/api/original/progress", (req, res) => {
    const since = parseInt(req.query.since as string) || 0;
    const newLogs = progressLogs.slice(since);
    
    res.json({
      logs: newLogs,
      total: progressLogs.length,
      inProgress: sendingInProgress
    });
  });

  // Cancel send endpoint
  app.post("/api/original/cancel", (req, res) => {
    advancedEmailService.cancelSend();
    sendingInProgress = false; // Stop the progress indicator
    res.json({ success: true, message: 'Email sending cancelled' });
  });

  // List files endpoint
  app.get("/api/original/listFiles", async (req, res) => {
    const folder = req.query.folder as string || 'files';
    const result = await advancedEmailService.listFiles(folder);
    res.json(result);
  });

  // List logo files endpoint
  app.get("/api/original/listLogoFiles", async (req, res) => {
    const result = await advancedEmailService.listLogoFiles();
    res.json(result);
  });

  // Read file endpoint
  app.post("/api/original/readFile", async (req, res) => {
    const { filepath } = req.body;
    const result = await advancedEmailService.readFile(filepath);
    res.json(result);
  });

  // Write file endpoint
  app.post("/api/original/writeFile", async (req, res) => {
    const { filepath, content } = req.body;
    const result = await advancedEmailService.writeFile(filepath, content);
    res.json(result);
  });

  // Load configuration from files
  app.get("/api/config/load", async (_req, res) => {
    try {
      configService.loadConfig();
      const config = configService.getEmailConfig();
      res.json({ success: true, config });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Save configuration to setup.ini
  app.post("/api/config/save", async (req, res) => {
    try {
      const updates = req.body;
      const configPath = join(process.cwd(), 'config', 'setup.ini');
      let content = readFileSync(configPath, 'utf8');

      // Update each key in the CONFIG section
      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (content.match(regex)) {
          content = content.replace(regex, `${key}=${value}`);
        } else {
          // Add new key after CONFIG section header
          content = content.replace('[CONFIG]', `[CONFIG]\n${key}=${value}`);
        }
      }

      writeFileSync(configPath, content, 'utf8');
      configService.loadConfig(); // Reload config
      res.json({ success: true, message: 'Configuration saved' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


}