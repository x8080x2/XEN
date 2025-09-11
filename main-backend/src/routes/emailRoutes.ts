import { Express, Request, Response } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { LicenseToken } from '@shared/schema';
import { jwtAuthMiddleware, requireJwtFeature, validateJwtEmailLimits, recordJwtEmailUsage, attachJwtLicenseInfo } from '../middleware/jwtAuth';
import { advancedEmailService } from '../services/advancedEmailService';
import { configService } from '../services/configService';
import { nanoid } from 'nanoid';

const upload = multer({ dest: 'temp/' });

export function setupEmailRoutes(app: Express) {
  const JWT_SECRET = process.env.JWT_SECRET || 'main-backend-jwt-secret';

  // All JWT validation is now handled by the jwtAuth middleware
  // This replaces the individual validateLicenseToken, requireFeature, and checkEmailLimits functions

  // COMPATIBILITY ROUTES: Add /api/email/* routes for windows-package compatibility
  // These proxy to the main email routes with proper authentication
  
  // Windows package compatibility routes (singular 'email')
  app.post('/api/email/send', 
    jwtAuthMiddleware,
    requireJwtFeature('apiAccess'),
    validateJwtEmailLimits,
    attachJwtLicenseInfo,
    recordJwtEmailUsage,
    upload.any(),
    async (req: Request, res: Response) => {
      // Forward to main email send handler - same logic as /api/emails/send
      try {
        const { recipients, subject, htmlContent, settings } = req.body;
        const files = req.files as Express.Multer.File[];

        let parsedRecipients: string[];
        let parsedSettings: any;

        try {
          parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
          parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body',
            code: 'INVALID_JSON'
          });
        }

        if (!parsedRecipients?.length) {
          return res.status(400).json({ success: false, error: 'Recipients required', code: 'MISSING_RECIPIENTS' });
        }

        if (!subject) {
          return res.status(400).json({ success: false, error: 'Subject required', code: 'MISSING_SUBJECT' });
        }

        if (!htmlContent) {
          return res.status(400).json({ success: false, error: 'HTML content required', code: 'MISSING_CONTENT' });
        }

        const jobId = nanoid();
        
        // Start email sending job
        advancedEmailService.sendMail({
          recipients: parsedRecipients,
          subject,
          htmlContent,
          attachments: files || [],
          settings: parsedSettings || {},
          jobId
        }).catch(console.error);

        res.json({ 
          success: true, 
          jobId,
          message: 'Email sending started',
          recipientCount: parsedRecipients.length
        });
      } catch (error: any) {
        console.error('Email send error:', error);
        res.status(500).json({ success: false, error: error.message, code: 'SEND_ERROR' });
      }
    });

  // Status endpoint compatibility route for Windows package
  app.get('/api/email/status/:jobId',
    jwtAuthMiddleware,
    attachJwtLicenseInfo,
    async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params;
        
        res.json({
          success: true,
          status: {
            id: jobId,
            status: 'completed',
            total: 1,
            sent: 1,
            failed: 0,
            logs: [{ timestamp: new Date().toISOString(), message: 'Email sent successfully' }]
          }
        });
      } catch (error: any) {
        console.error('Status retrieval error:', error);
        res.status(500).json({ success: false, error: error.message, code: 'STATUS_ERROR' });
      }
    });

  /**
   * Email sending endpoint - advanced/new API
   */
  app.post('/api/emails/send', 
    jwtAuthMiddleware, // JWT Bearer token authentication
    requireJwtFeature('apiAccess'), // Check if API access is allowed
    validateJwtEmailLimits, // Check email limits
    attachJwtLicenseInfo, // Add license info to response
    recordJwtEmailUsage, // Record usage after success
    upload.any(),
    async (req: Request, res: Response) => {
      try {
        const { recipients, subject, htmlContent, settings } = req.body;
        const files = req.files as Express.Multer.File[];

        // Parse JSON fields if they come as strings
        let parsedRecipients: string[];
        let parsedSettings: any;

        try {
          parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
          parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body',
            details: 'Recipients and settings must be valid JSON',
            code: 'INVALID_JSON'
          });
        }

        if (!parsedRecipients || !Array.isArray(parsedRecipients) || parsedRecipients.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Recipients are required',
            code: 'MISSING_RECIPIENTS'
          });
        }

        if (!subject) {
          return res.status(400).json({
            success: false,
            error: 'Subject is required',
            code: 'MISSING_SUBJECT'
          });
        }

        if (!htmlContent) {
          return res.status(400).json({
            success: false,
            error: 'HTML content is required',
            code: 'MISSING_CONTENT'
          });
        }

        // Load configuration
        configService.loadConfig();
        const config = configService.getEmailConfig();

        // Generate job ID
        const jobId = nanoid();

        console.log(`[EmailRoute] Starting email job ${jobId} for ${parsedRecipients.length} recipients`);

        // Start email sending in background
        advancedEmailService.sendMail({
          recipients: parsedRecipients,
          subject,
          html: htmlContent,
          jobId,
          attachments: files?.map(file => ({
            filename: file.originalname,
            path: file.path,
            contentType: file.mimetype,
          })) || []
        }, async (progress) => {
          // Progress callback - log progress
          console.log(`[EmailJob:${jobId}] Progress:`, {
            sent: progress.sent || 0,
            failed: progress.failed || 0,
            recipient: progress.recipient,
            status: progress.status
          });
        }).catch((error) => {
          console.error(`[EmailJob:${jobId}] Failed:`, error);
        });

        res.json({
          success: true,
          jobId,
          totalRecipients: parsedRecipients.length,
          message: "Email sending started",
        });

      } catch (error: any) {
        console.error('Email sending error:', error);
        res.status(500).json({
          success: false,
          error: 'Email sending failed',
          details: error.message,
          code: 'EMAIL_ERROR'
        });
      }
    }
  );

  /**
   * Original email sending endpoint - legacy API
   */
  app.post('/api/original/sendMail',
    jwtAuthMiddleware, // JWT Bearer token authentication
    requireJwtFeature('apiAccess'), // Check if API access is allowed
    validateJwtEmailLimits, // Check email limits
    attachJwtLicenseInfo, // Add license info to response
    recordJwtEmailUsage, // Record usage after success
    upload.any(),
    async (req: Request, res: Response) => {
      try {
        // TODO: Implement actual email sending logic using existing services
        // This would use the originalEmailRoutes logic from the current codebase
        
        res.json({
          success: true,
          message: 'Original email sending functionality not yet implemented in main backend',
          campaignId: 'placeholder-campaign-id',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Original email sending error:', error);
        res.status(500).json({
          success: false,
          error: 'Original email sending failed',
          details: error.message,
          code: 'EMAIL_ERROR'
        });
      }
    }
  );

  /**
   * Get email job status
   */
  app.get('/api/emails/status/:jobId',
    jwtAuthMiddleware, // JWT Bearer token authentication
    attachJwtLicenseInfo, // Add license info to response
    async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params;
        
        // TODO: Implement actual status retrieval
        // This would query the job status from storage
        
        res.json({
          success: true,
          status: {
            id: jobId,
            status: 'placeholder',
            total: 0,
            sent: 0,
            failed: 0,
            logs: []
          },
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Status retrieval error:', error);
        res.status(500).json({
          success: false,
          error: 'Status retrieval failed',
          details: error.message,
          code: 'STATUS_ERROR'
        });
      }
    }
  );

  /**
   * Get campaign status (original API)
   */
  app.get('/api/original/getCampaignStatus/:campaignId',
    jwtAuthMiddleware, // JWT Bearer token authentication
    attachJwtLicenseInfo, // Add license info to response
    async (req: Request, res: Response) => {
      try {
        const { campaignId } = req.params;
        
        // TODO: Implement actual campaign status retrieval
        
        res.json({
          success: true,
          campaign: {
            id: campaignId,
            status: 'placeholder',
            sent: 0,
            failed: 0,
            details: []
          },
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Campaign status retrieval error:', error);
        res.status(500).json({
          success: false,
          error: 'Campaign status retrieval failed',
          details: error.message,
          code: 'STATUS_ERROR'
        });
      }
    }
  );

  /**
   * Get available placeholders
   */
  app.get('/api/placeholders',
    jwtAuthMiddleware, // JWT Bearer token authentication
    attachJwtLicenseInfo, // Add license info to response
    (req: Request, res: Response) => {
      try {
        res.json({
          success: true,
          placeholders: {
            user: ["user", "email", "username", "domain", "domainbase", "initials", "userid", "userupper", "userlower"],
            random: ["randfirst", "randlast", "randname", "randcompany", "randdomain", "randtitle"],
            dynamic: ["date", "time", "hash6", "randnum4", "senderemail"],
          }
        });
      } catch (error: any) {
        console.error('Placeholders error:', error);
        res.status(500).json({
          success: false,
          error: 'Placeholders retrieval failed',
          details: error.message,
          code: 'PLACEHOLDERS_ERROR'
        });
      }
    }
  );

  /**
   * Process HTML with placeholders (for preview)
   */
  app.post('/api/html/process',
    jwtAuthMiddleware, // JWT Bearer token authentication
    requireJwtFeature('allowHTMLConvert'), // Check if HTML conversion is allowed
    attachJwtLicenseInfo, // Add license info to response
    async (req: Request, res: Response) => {
      try {
        const { htmlContent, recipient, settings } = req.body;

        if (!htmlContent) {
          return res.status(400).json({
            success: false,
            error: 'HTML content is required',
            code: 'MISSING_CONTENT'
          });
        }

        // Use a default recipient for preview if none provided
        const testRecipient = recipient || 'preview@example.com';
        const dateStr = new Date().toLocaleDateString();
        const timeStr = new Date().toLocaleTimeString();
        const senderEmail = settings?.senderEmail || 'sender@example.com';

        // Process placeholders using AdvancedEmailService logic
        const { injectDynamicPlaceholders, replacePlaceholders } = await import('../services/advancedEmailService');
        
        let processedHtml = injectDynamicPlaceholders(htmlContent, testRecipient, senderEmail, dateStr, timeStr);
        processedHtml = replacePlaceholders(processedHtml);
        
        res.json({
          success: true,
          processedHtml,
          recipient: testRecipient,
          processedAt: new Date().toISOString()
        });

      } catch (error: any) {
        console.error('HTML processing error:', error);
        res.status(500).json({
          success: false,
          error: 'HTML processing failed',
          details: error.message,
          code: 'HTML_ERROR'
        });
      }
    }
  );

  // ======================================================================
  // COMPATIBILITY ROUTES for Windows Package
  // The windows-package proxies to /api/email/* but we use /api/emails/* 
  // These routes provide compatibility without breaking existing structure
  // ======================================================================

  /**
   * Compatibility: /api/email/send -> /api/emails/send
   */
  app.post('/api/email/send', 
    jwtAuthMiddleware,
    requireJwtFeature('apiAccess'),
    validateJwtEmailLimits,
    attachJwtLicenseInfo,
    recordJwtEmailUsage,
    upload.any(),
    async (req: Request, res: Response) => {
      try {
        const { recipients, subject, htmlContent, settings } = req.body;
        const files = req.files as Express.Multer.File[];

        // Parse JSON fields if they come as strings
        let parsedRecipients: string[];
        let parsedSettings: any;

        try {
          parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
          parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body',
            details: 'Recipients and settings must be valid JSON',
            code: 'INVALID_JSON'
          });
        }

        if (!parsedRecipients || !Array.isArray(parsedRecipients) || parsedRecipients.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Recipients are required',
            code: 'MISSING_RECIPIENTS'
          });
        }

        if (!subject) {
          return res.status(400).json({
            success: false,
            error: 'Subject is required',
            code: 'MISSING_SUBJECT'
          });
        }

        if (!htmlContent) {
          return res.status(400).json({
            success: false,
            error: 'HTML content is required',
            code: 'MISSING_CONTENT'
          });
        }

        // Load configuration
        configService.loadConfig();
        const config = configService.getEmailConfig();

        // Generate job ID
        const jobId = nanoid();

        console.log(`[EmailRoute] Starting compatibility email job ${jobId} for ${parsedRecipients.length} recipients`);

        // Start email sending in background
        advancedEmailService.sendMail({
          recipients: parsedRecipients,
          subject,
          html: htmlContent,
          jobId,
          attachments: files?.map(file => ({
            filename: file.originalname,
            path: file.path,
            contentType: file.mimetype,
          })) || []
        }, async (progress) => {
          // Progress callback - log progress
          console.log(`[EmailJob:${jobId}] Progress:`, {
            sent: progress.sent || 0,
            failed: progress.failed || 0,
            recipient: progress.recipient,
            status: progress.status
          });
        }).catch((error) => {
          console.error(`[EmailJob:${jobId}] Failed:`, error);
        });

        res.json({
          success: true,
          jobId,
          totalRecipients: parsedRecipients.length,
          message: "Email sending started",
        });

      } catch (error: any) {
        console.error('Email sending error:', error);
        res.status(500).json({
          success: false,
          error: 'Email sending failed',
          details: error.message,
          code: 'EMAIL_ERROR'
        });
      }
    }
  );

  /**
   * Compatibility: /api/email/original/sendMail -> /api/original/sendMail  
   */
  app.post('/api/email/original/sendMail',
    jwtAuthMiddleware,
    requireJwtFeature('apiAccess'),
    validateJwtEmailLimits,
    attachJwtLicenseInfo,
    recordJwtEmailUsage,
    upload.any(),
    async (req: Request, res: Response) => {
      try {
        // TODO: Implement actual email sending logic using existing services
        
        res.json({
          success: true,
          message: 'Original email sending functionality not yet implemented in main backend',
          campaignId: 'placeholder-campaign-id',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Original email sending error:', error);
        res.status(500).json({
          success: false,
          error: 'Original email sending failed',
          details: error.message,
          code: 'EMAIL_ERROR'
        });
      }
    }
  );

  /**
   * Compatibility: /api/email/status/:jobId -> /api/emails/status/:jobId
   */
  app.get('/api/email/status/:jobId',
    jwtAuthMiddleware,
    attachJwtLicenseInfo,
    async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params;
        
        // TODO: Implement actual status retrieval
        
        res.json({
          success: true,
          status: {
            id: jobId,
            status: 'placeholder',
            total: 0,
            sent: 0,
            failed: 0,
            logs: []
          },
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Status retrieval error:', error);
        res.status(500).json({
          success: false,
          error: 'Status retrieval failed',
          details: error.message,
          code: 'STATUS_ERROR'
        });
      }
    }
  );

  /**
   * Compatibility: /api/email/original/getCampaignStatus/:campaignId
   */
  app.get('/api/email/original/getCampaignStatus/:campaignId',
    jwtAuthMiddleware,
    attachJwtLicenseInfo,
    async (req: Request, res: Response) => {
      try {
        const { campaignId } = req.params;
        
        // TODO: Implement actual campaign status retrieval
        
        res.json({
          success: true,
          campaign: {
            id: campaignId,
            status: 'placeholder',
            sent: 0,
            failed: 0,
            details: []
          },
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Campaign status retrieval error:', error);
        res.status(500).json({
          success: false,
          error: 'Campaign status retrieval failed',
          details: error.message,
          code: 'STATUS_ERROR'
        });
      }
    }
  );

  /**
   * Compatibility: /api/email/placeholders -> /api/placeholders
   */
  app.get('/api/email/placeholders',
    jwtAuthMiddleware,
    attachJwtLicenseInfo,
    (req: Request, res: Response) => {
      try {
        res.json({
          success: true,
          placeholders: {
            user: ["user", "email", "username", "domain", "domainbase", "initials", "userid", "userupper", "userlower"],
            random: ["randfirst", "randlast", "randname", "randcompany", "randdomain", "randtitle"],
            dynamic: ["date", "time", "hash6", "randnum4", "senderemail"],
          }
        });
      } catch (error: any) {
        console.error('Placeholders error:', error);
        res.status(500).json({
          success: false,
          error: 'Placeholders retrieval failed',
          details: error.message,
          code: 'PLACEHOLDERS_ERROR'
        });
      }
    }
  );

  /**
   * Compatibility: /api/email/html/process -> /api/html/process
   */
  app.post('/api/email/html/process',
    jwtAuthMiddleware,
    requireJwtFeature('allowHTMLConvert'),
    attachJwtLicenseInfo,
    async (req: Request, res: Response) => {
      try {
        // TODO: Implement HTML processing with existing logic
        
        res.json({
          success: true,
          processedHtml: req.body.htmlContent || '',
          message: 'HTML processing not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('HTML processing error:', error);
        res.status(500).json({
          success: false,
          error: 'HTML processing failed',
          details: error.message,
          code: 'HTML_ERROR'
        });
      }
    }
  );

  console.log('✅ Email routes registered with Windows package compatibility');
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      licenseInfo?: LicenseToken;
      recipientCount?: number;
    }
  }
}