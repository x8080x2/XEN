import type { Express } from "express";
import { AdvancedEmailService } from "../services/advancedEmailService";
import multer from "multer";

const upload = multer({ dest: 'uploads/' });

export function setupOriginalEmailRoutes(app: Express) {
  const emailService = new AdvancedEmailService();
  
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
        qrBorderColor: req.body.qrBorderColor,
        qrForegroundColor: req.body.qrForegroundColor || '#000000',
        qrBackgroundColor: req.body.qrBackgroundColor || '#FFFFFF',
        qrLink: req.body.qrLink,
        linkPlaceholder: req.body.linkPlaceholder,
        htmlImgBody: req.body.htmlImgBody === 'true' || req.body.htmlImgBody === true,
        randomMetadata: req.body.randomMetadata === 'true' || req.body.randomMetadata === true,
        minifyHtml: req.body.minifyHtml === 'true' || req.body.minifyHtml === true,

        emailPerSecond: parseInt(req.body.emailPerSecond) || 5,
        zipUse: req.body.zipUse === 'true' || req.body.zipUse === true,
        zipPassword: req.body.zipPassword,
        fileName: req.body.fileName,
        htmlConvert: req.body.htmlConvert,
        includeHiddenText: req.body.includeHiddenText === 'true' || req.body.includeHiddenText === true,
        hiddenText: req.body.hiddenText,
        // Additional missing parameters with proper conversion
        retry: parseInt(req.body.retry) || 0,
        priority: req.body.priority || '2',
        domainLogoSize: req.body.domainLogoSize || '70%',
        borderStyle: req.body.borderStyle || 'solid',
        borderColor: req.body.borderColor || '#000000',
        hiddenImgSize: parseInt(req.body.hiddenImgSize) || 50,
        hiddenImageFile: req.body.hiddenImageFile || '',
        // Proxy settings
        proxyUse: req.body.proxyUse === 'true' || req.body.proxyUse === true,
        proxyType: req.body.proxyType || 'socks5',
        proxyHost: req.body.proxyHost || '',
        proxyPort: req.body.proxyPort || '',
        proxyUser: req.body.proxyUser || '',
        proxyPass: req.body.proxyPass || '',
        // QR Code boolean
        qrcode: req.body.qrcode === 'true' || req.body.qrcode === true
      };
      
      // Send progress updates via Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      let totalSent = 0;
      let totalFailed = 0;
      
      try {
        const result = await emailService.sendMail(args, (progress) => {
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
        });
        
        // Send completion
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          success: result.success,
          sent: result.sent || totalSent,
          error: result.error,
          details: result.details
        })}\n\n`);
        
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message || 'Unknown error occurred'
        })}\n\n`);
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
    emailService.pauseSend();
    res.json({ success: true, message: 'Email sending paused' });
  });
  
  // Resume send endpoint
  app.post("/api/original/resume", (req, res) => {
    emailService.resumeSend();
    res.json({ success: true, message: 'Email sending resumed' });
  });
  
  // List files endpoint
  app.get("/api/original/listFiles", async (req, res) => {
    const folder = req.query.folder as string || 'files';
    const result = await emailService.listFiles(folder);
    res.json(result);
  });
  
  // List logo files endpoint
  app.get("/api/original/listLogoFiles", async (req, res) => {
    const result = await emailService.listLogoFiles();
    res.json(result);
  });
  
  // Read file endpoint
  app.post("/api/original/readFile", async (req, res) => {
    const { filepath } = req.body;
    const result = await emailService.readFile(filepath);
    res.json(result);
  });
  
  // Write file endpoint
  app.post("/api/original/writeFile", async (req, res) => {
    const { filepath, content } = req.body;
    const result = await emailService.writeFile(filepath, content);
    res.json(result);
  });
  
  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    emailService.cleanup();
  });
  
  process.on('SIGINT', () => {
    emailService.cleanup();
  });
}