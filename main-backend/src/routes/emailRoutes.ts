import { Express, Request, Response } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { LicenseToken } from '@shared/schema';
import { requirePermission } from '../middleware/apiKeyAuth';

// Import existing email services (copy from current server structure)
// Note: These would need to be moved from the main server directory
const upload = multer({ dest: 'temp/' });

export function setupEmailRoutes(app: Express) {
  const JWT_SECRET = process.env.JWT_SECRET || 'main-backend-jwt-secret';

  // Middleware to validate license token for email operations
  const validateLicenseToken = (req: Request, res: Response, next: any) => {
    try {
      const licenseToken = req.headers['x-license-token'] as string;
      
      if (!licenseToken) {
        return res.status(401).json({
          success: false,
          error: 'Missing license token',
          code: 'MISSING_LICENSE_TOKEN'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(licenseToken, JWT_SECRET) as LicenseToken;
      
      // Check if license is still valid (not expired)
      if (decoded.expiresAt < Date.now()) {
        return res.status(403).json({
          success: false,
          error: 'License has expired',
          code: 'LICENSE_EXPIRED'
        });
      }

      // Attach license info to request
      req.licenseInfo = decoded;
      
      next();
    } catch (error: any) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid license token',
          code: 'INVALID_LICENSE_TOKEN'
        });
      }

      console.error('License token validation error:', error);
      res.status(500).json({
        success: false,
        error: 'License token validation error',
        details: error.message,
        code: 'TOKEN_ERROR'
      });
    }
  };

  // Check feature availability
  const requireFeature = (feature: keyof LicenseToken['features']) => {
    return (req: Request, res: Response, next: any) => {
      const licenseInfo = req.licenseInfo as LicenseToken;
      
      if (!licenseInfo || !licenseInfo.features[feature]) {
        return res.status(403).json({
          success: false,
          error: `Feature '${feature}' not available in your license plan`,
          code: 'FEATURE_NOT_AVAILABLE'
        });
      }
      
      next();
    };
  };

  // Check email limits
  const checkEmailLimits = (req: Request, res: Response, next: any) => {
    try {
      const licenseInfo = req.licenseInfo as LicenseToken;
      
      // Extract recipient count from request
      let recipientCount = 0;
      
      if (req.body.recipients) {
        if (typeof req.body.recipients === 'string') {
          try {
            const parsed = JSON.parse(req.body.recipients);
            recipientCount = Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            recipientCount = req.body.recipients.split('\n').filter((r: string) => r.trim()).length;
          }
        } else if (Array.isArray(req.body.recipients)) {
          recipientCount = req.body.recipients.length;
        }
      }

      // Check recipients per email limit
      if (recipientCount > licenseInfo.features.maxRecipientsPerEmail) {
        return res.status(403).json({
          success: false,
          error: `Too many recipients. Maximum ${licenseInfo.features.maxRecipientsPerEmail} allowed per email.`,
          code: 'RECIPIENT_LIMIT_EXCEEDED'
        });
      }

      // Check monthly email limit
      const remainingEmails = licenseInfo.features.maxEmailsPerMonth - licenseInfo.emailsUsedThisMonth;
      if (remainingEmails < recipientCount) {
        return res.status(403).json({
          success: false,
          error: `Monthly email limit exceeded. ${remainingEmails} emails remaining.`,
          remaining: remainingEmails,
          code: 'EMAIL_LIMIT_EXCEEDED'
        });
      }

      // Store recipient count for usage tracking
      req.recipientCount = recipientCount;
      
      next();
    } catch (error: any) {
      console.error('Email limit check error:', error);
      res.status(500).json({
        success: false,
        error: 'Email limit check error',
        details: error.message,
        code: 'LIMIT_ERROR'
      });
    }
  };

  /**
   * Email sending endpoint - advanced/new API
   */
  app.post('/api/emails/send', 
    requirePermission('email:send'),
    validateLicenseToken,
    checkEmailLimits,
    upload.any(),
    async (req: Request, res: Response) => {
      try {
        // TODO: Implement actual email sending logic using existing services
        // This would use the advancedEmailService from the current codebase
        
        res.json({
          success: true,
          message: 'Email sending functionality not yet implemented in main backend',
          jobId: 'placeholder-job-id',
          totalRecipients: req.recipientCount || 0,
          code: 'NOT_IMPLEMENTED'
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
    requirePermission('email:send'),
    validateLicenseToken,
    checkEmailLimits,
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
    requirePermission('email:status'),
    validateLicenseToken,
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
    requirePermission('email:status'),
    validateLicenseToken,
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
    requirePermission('email:placeholders'),
    validateLicenseToken,
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
    requirePermission('email:preview'),
    validateLicenseToken,
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