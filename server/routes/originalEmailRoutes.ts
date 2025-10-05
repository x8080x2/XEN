import type { Express } from "express";
import { advancedEmailService } from "../services/advancedEmailService";
import multer from "multer";

const upload = multer({ dest: 'uploads/' });

export function setupOriginalEmailRoutes(app: Express) {
  // Use the singleton instance instead of creating a new one

  // Main sendMail endpoint - exact clone functionality
  app.post("/api/original/sendMail", upload.any(), async (req, res) => {
    try {
      console.log('Original sendMail endpoint called with:', req.body);

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
        // SMTP settings
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        smtpPass: req.body.smtpPass,
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

      // Send progress updates via Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no'  // Disable nginx buffering
      });

      let totalSent = 0;
      let totalFailed = 0;

      try {
        const result = await advancedEmailService.sendMail(args, (progress) => {
          if (progress.status === 'success') {
            totalSent++;
          } else {
            totalFailed++;
          }

          // Send progress update
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            recipient: progress.recipient,
            subject: progress.subject,
            status: progress.status,
            error: progress.error,
            timestamp: progress.timestamp,
            totalSent,
            totalFailed,
            totalRecipients: recipients.length
          })}\n\n`);
          
          // Force flush to prevent buffering - use Node.js HTTP response method
          (res as any).flush?.();
        });

        // Send completion
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          success: result.success,
          sent: result.sent || totalSent,
          error: result.error,
          details: result.details
        })}\n\n`);
        (res as any).flush?.();

      } catch (error: any) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message || 'Unknown error occurred'
        })}\n\n`);
        (res as any).flush?.();
      }

      res.end();

    } catch (error: any) {
      console.error('Error in sendMail:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
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

  // Clear caches endpoint for testing new logo sources
  app.post("/api/original/clear-caches", async (req, res) => {
    try {
      advancedEmailService.clearCaches();
      res.json({ success: true, message: 'Caches cleared successfully' });
    } catch (error) {
      console.error('Error clearing caches:', error);
      res.status(500).json({ success: false, error: 'Failed to clear caches' });
    }
  });

  // Note: Cleanup handlers should be registered once in the main server file
  // Removed duplicate process handlers to prevent conflicts
}