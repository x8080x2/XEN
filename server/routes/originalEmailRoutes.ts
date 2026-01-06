import type { Express } from "express";
import { advancedEmailService } from "../services/advancedEmailService";
import multer from "multer";
import { configService } from "../services/configService";
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Configure multer with size limits to prevent DoS
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
    files: 10 // Max 10 files per request
  }
});

export function setupOriginalEmailRoutes(app: Express) {

  // Store progress logs in memory
  const progressLogs: any[] = [];
  let sendingInProgress = false;

  // Main sendMail endpoint - supports both polling and SSE
  app.post("/api/original/sendMail", (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'File too large. Maximum file size is 25MB.'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(413).json({
            success: false,
            error: 'Too many files. Maximum 10 files per upload.'
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
          error: 'File upload failed'
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      console.log('Original sendMail endpoint called with body keys:', Object.keys(req.body));
      console.log('SMTP Settings received:', {
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        hasSmtpPass: !!req.body.smtpPass,
        senderEmail: req.body.senderEmail,
        hasUserSmtpConfigs: !!req.body.userSmtpConfigs
      });

      // Validate SMTP settings early - accept either legacy single SMTP OR user SMTP configs
      // Desktop mode detection: check if userSmtpConfigs KEY exists (even if empty array)
      const isDesktopMode = 'userSmtpConfigs' in req.body;
      let hasUserSmtpConfigs = false;
      let userSmtpConfigsArray: any[] = [];
      
      if (isDesktopMode) {
        try {
          userSmtpConfigsArray = typeof req.body.userSmtpConfigs === 'string' 
            ? JSON.parse(req.body.userSmtpConfigs) 
            : req.body.userSmtpConfigs;
          
          if (!Array.isArray(userSmtpConfigsArray)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid userSmtpConfigs format. Expected JSON array.'
            });
          }
          
          hasUserSmtpConfigs = userSmtpConfigsArray.length > 0;
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Invalid userSmtpConfigs format. Expected JSON array.'
          });
        }
      }
      
      const hasLegacySmtp = req.body.smtpHost && req.body.smtpUser && req.body.smtpPass;

      // Desktop mode enforcement: must have userSmtpConfigs, cannot use server SMTP
      if (isDesktopMode && !hasUserSmtpConfigs) {
        return res.status(400).json({
          success: false,
          error: 'Desktop mode requires SMTP configuration in local smtp.ini file. Please configure user-package/config/smtp.ini with your SMTP credentials. Server SMTP is not available for desktop users.'
        });
      }

      // Web mode validation: must have legacy SMTP fields
      if (!isDesktopMode && !hasLegacySmtp) {
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
      const attachments = files?.map(file => ({
        path: file.path,
        filename: file.originalname,
        contentType: file.mimetype
      })) || [];

      // Parse recipients if it's a string
      let recipients = req.body.recipients;
      if (typeof recipients === 'string') {
        try {
          recipients = JSON.parse(recipients);
        } catch {
          recipients = recipients.split('\n').map((r: string) => r.trim()).filter((r: string) => r);
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

      // Parse user's SMTP configs array if provided (from desktop app)
      let userSmtpConfigs: any[] = [];
      let userSmtpRotationEnabled = false;
      
      if (req.body.userSmtpConfigs) {
        try {
          userSmtpConfigs = typeof req.body.userSmtpConfigs === 'string' 
            ? JSON.parse(req.body.userSmtpConfigs)
            : req.body.userSmtpConfigs;
          userSmtpRotationEnabled = req.body.smtpRotationEnabled === 'true' || req.body.smtpRotationEnabled === true;
          
          console.log('[Server] Received user SMTP configs:', {
            count: userSmtpConfigs.length,
            rotationEnabled: userSmtpRotationEnabled,
            configs: userSmtpConfigs.map(c => ({ 
              id: c.id, 
              host: c.host, 
              port: c.port,
              user: c.user === '' ? '(empty)' : c.user,
              pass: c.pass === '' ? '(empty)' : '***',
              fromEmail: c.fromEmail 
            }))
          });
        } catch (error) {
          console.error('[Server] Failed to parse user SMTP configs:', error);
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

        // Template rotation setting
        templateRotation: req.body.templateRotation === 'true' || req.body.templateRotation === true,

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

        // Reply-To setting
        replyTo: req.body.replyTo || '',
      };

      // Clear previous progress logs
      progressLogs.length = 0;
      sendingInProgress = true;

      // Start sending emails with progress tracking
      advancedEmailService.sendMail(args, (progress) => {
        // Store progress in memory for polling
        const progressData = {
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
        
        progressLogs.push(progressData);
      }).then((result: any) => {
        // Mark sending as complete FIRST
        sendingInProgress = false;
        
        // Add completion log with partial completion detection
        const completionLog: any = {
          type: 'complete',
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
        
        // Log warning if partial completion detected
        if (result.isPartialCompletion) {
          const reason = result.wasCancelled ? 'cancelled' : (result.unexpectedExit ? 'unexpected exit' : 'unknown');
          console.warn(`[Routes] Partial completion detected (${reason}): ${result.totalProcessed}/${result.totalRecipients} emails processed.`);
        }
        
        progressLogs.push(completionLog);
      }).catch((error: any) => {
        // Mark sending as complete FIRST
        sendingInProgress = false;
        
        // Add error log
        const errorLog = {
          type: 'error',
          error: error.message || 'Unknown error occurred'
        };
        
        console.error('[Routes] Email sending caught error:', error);
        progressLogs.push(errorLog);
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

  // Polling endpoint for progress updates
  app.get("/api/original/progress", (req, res) => {
    // Prevent caching to ensure fresh progress updates
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
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