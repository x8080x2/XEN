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

  // Main sendMail endpoint - SSE streaming for real-time updates
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

      // Set up SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Start sending emails with real-time progress streaming
      advancedEmailService.sendMail(args, (progress) => {
        // Stream progress updates immediately
        const data = {
          type: 'progress',
          recipient: progress.recipient || 'Unknown',
          subject: progress.subject || args.subject || 'No Subject',
          status: progress.status,
          error: progress.error || null,
          timestamp: progress.timestamp || new Date().toISOString(),
          totalSent: progress.totalSent,
          totalFailed: progress.totalFailed,
          totalRecipients: progress.totalRecipients,
          smtp: progress.smtp || null
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }).then((result) => {
        // Send completion event
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          success: result.success,
          sent: result.sent,
          error: result.error,
          details: result.details
        })}\n\n`);
        res.end();
      }).catch((error: any) => {
        // Send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message || 'Unknown error occurred'
        })}\n\n`);
        res.end();
      });

    } catch (error: any) {
      console.error('Error in sendMail:', error);
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

  // Pause send endpoint
  app.post("/api/original/pause", (req, res) => {
    advancedEmailService.pauseSend();
    res.json({ success: true, message: 'Email sending paused' });
  });

  // Resume send endpoint
  app.post("/api/original/resume", (req, res) => {
    advancedEmailService.resumeSend();
    res.json({ success: true, message: 'Email sending resumed' });
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