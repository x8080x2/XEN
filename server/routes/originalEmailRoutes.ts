import type { Express } from "express";
import { advancedEmailService } from "../services/advancedEmailService";
import { sendMailRequestSchema, validateRequest, formatValidationError } from "../utils/validation";
import { verifyLicenseMiddleware } from "../middleware/licenseMiddleware";
import multer from "multer";

const upload = multer({ dest: 'uploads/' });

export function setupOriginalEmailRoutes(app: Express) {

  // Main sendMail endpoint - with comprehensive validation (protected by license middleware)
  app.post("/api/original/sendMail", verifyLicenseMiddleware, upload.any(), async (req, res) => {
    try {
      console.log('Original sendMail endpoint called with body keys:', Object.keys(req.body));
      
      const files = req.files as Express.Multer.File[];
      const attachments = files?.map(file => file.path) || [];

      // Parse recipients if it's a string (for validation)
      let recipientsForValidation = req.body.recipients;
      if (typeof recipientsForValidation === 'string') {
        try {
          recipientsForValidation = JSON.parse(recipientsForValidation);
        } catch {
          recipientsForValidation = recipientsForValidation.split('\n').filter((r: string) => r.trim());
        }
      }

      // Parse settings if it's a string (for validation)
      let settingsForValidation = req.body.settings;
      if (typeof settingsForValidation === 'string') {
        try {
          settingsForValidation = JSON.parse(settingsForValidation);
        } catch {
          settingsForValidation = {};
        }
      }

      // Build validation payload from ONLY the fields we trust - no blanket spreading
      const requestData = {
        // Required fields
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        smtpPass: req.body.smtpPass,
        senderEmail: req.body.senderEmail,
        senderName: req.body.senderName,
        subject: req.body.subject,
        recipients: recipientsForValidation,
        html: req.body.html || req.body.emailContent,
        
        // Optional fields from body
        attachmentHtml: req.body.attachmentHtml,
        sleep: req.body.sleep,
        qrSize: req.body.qrSize,
        qrBorder: req.body.qrBorder,
        qrForegroundColor: req.body.qrForegroundColor,
        qrBackgroundColor: req.body.qrBackgroundColor,
        hiddenImageFile: req.body.hiddenImageFile,
        hiddenImageSize: req.body.hiddenImageSize,
        hiddenText: req.body.hiddenText,
        qrcode: req.body.qrcode,
        linkPlaceholder: req.body.linkPlaceholder,
        htmlImgBody: req.body.htmlImgBody,
        randomMetadata: req.body.randomMetadata,
        minifyHtml: req.body.minifyHtml,
        emailPerSecond: req.body.emailPerSecond,
        zipUse: req.body.zipUse,
        zipPassword: req.body.zipPassword,
        fileName: req.body.fileName,
        htmlConvert: req.body.htmlConvert,
        retry: req.body.retry,
        priority: req.body.priority,
        domainLogoSize: req.body.domainLogoSize,
        borderStyle: req.body.borderStyle,
        borderColor: req.body.borderColor,
        proxyUse: req.body.proxyUse,
        proxyType: req.body.proxyType,
        proxyHost: req.body.proxyHost,
        proxyPort: req.body.proxyPort,
        proxyUser: req.body.proxyUser,
        proxyPass: req.body.proxyPass,
        useAI: req.body.useAI,
        industry: req.body.industry,
        
        // Optional fields from parsed settings
        ...settingsForValidation
      };

      // Validate request with comprehensive schema
      const validation = validateRequest(sendMailRequestSchema, requestData);
      
      if (!validation.success) {
        console.error('Validation failed:', validation.errors);
        // Setup SSE for error response - MUST use 200 to keep stream open for client
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
          'X-Accel-Buffering': 'no'
        });
        
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Validation failed',
          details: validation.errors
        })}\n\n`);
        res.end();
        return;
      }

      // Use validated data and add attachments
      // The schema uses .passthrough() so all fields are already in validation.data
      const args = {
        ...validation.data,
        attachments
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

          // Send progress update with validated data
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            recipient: progress.recipient || 'Unknown',
            subject: progress.subject || args.subject || 'No Subject',
            status: progress.status,
            error: progress.error || null,
            timestamp: progress.timestamp || new Date().toISOString(),
            totalSent,
            totalFailed,
            totalRecipients: args.recipients.length, // Use validated recipients
            smtp: progress.smtp || null
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

  
}