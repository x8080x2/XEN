import { Express, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { LicenseToken } from '@shared/schema';
import { requirePermission } from '../middleware/apiKeyAuth';

const upload = multer({ dest: 'temp/' });

export function setupConfigRoutes(app: Express) {
  const JWT_SECRET = process.env.JWT_SECRET || 'main-backend-jwt-secret';

  // Middleware to validate license token
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

      const decoded = jwt.verify(licenseToken, JWT_SECRET) as LicenseToken;
      
      if (decoded.expiresAt < Date.now()) {
        return res.status(403).json({
          success: false,
          error: 'License has expired',
          code: 'LICENSE_EXPIRED'
        });
      }

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
        code: 'TOKEN_ERROR'
      });
    }
  };

  /**
   * Load configuration
   */
  app.get('/api/config/load',
    requirePermission('config:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        const licenseInfo = req.licenseInfo as LicenseToken;
        
        // Return configuration based on license features
        const config = {
          EMAILPERSECOND: 5, // Default rate limit
          SLEEP: 1,
          FILE_NAME: 'attachment',
          
          // Feature-based config
          HTML_CONVERT: licenseInfo.features.allowHTMLConvert ? 'pdf' : '',
          QRCODE: licenseInfo.features.allowQRCodes ? 1 : 0,
          INCLUDE_HTML_ATTACHMENT: licenseInfo.features.allowAttachments ? 1 : 0,
          
          // QR Code settings (if allowed)
          QR_WIDTH: 150,
          QR_BORDER_WIDTH: 2,
          QR_BORDER_COLOR: '#000000',
          QR_FOREGROUND_COLOR: '#000000',
          QR_BACKGROUND_COLOR: '#FFFFFF',
          QR_LINK: 'https://example.com',
          
          // Domain logo settings (if allowed)
          DOMAIN_LOGO_SIZE: licenseInfo.features.allowDomainLogos ? '50%' : '0%',
          
          // Advanced settings
          PRIORITY: 2,
          RETRY: 0,
          RANDOM_METADATA: 0,
          LINK_PLACEHOLDER: '{email}',
          
          // License info
          LICENSE_PLAN: licenseInfo.planType,
          LICENSE_FEATURES: licenseInfo.features,
          EMAILS_REMAINING: licenseInfo.features.maxEmailsPerMonth - licenseInfo.emailsUsedThisMonth,
        };

        res.json({
          success: true,
          config
        });

      } catch (error: any) {
        console.error('Config load error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to load configuration',
          details: error.message,
          code: 'CONFIG_ERROR'
        });
      }
    }
  );

  /**
   * Get SMTP configuration
   */
  app.get('/api/config/smtp',
    requirePermission('config:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        // TODO: Implement SMTP config retrieval
        // This would be stored securely and returned based on license
        
        res.json({
          success: true,
          smtp: {},
          message: 'SMTP configuration not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('SMTP config error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to load SMTP configuration',
          details: error.message,
          code: 'SMTP_ERROR'
        });
      }
    }
  );

  /**
   * Load leads/mailing list
   */
  app.get('/api/config/loadLeads',
    requirePermission('config:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        // TODO: Implement leads loading from secure storage
        // This would be user-specific and stored securely
        
        res.json({
          success: true,
          leads: '',
          message: 'Leads loading not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Leads loading error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to load leads',
          details: error.message,
          code: 'LEADS_ERROR'
        });
      }
    }
  );

  /**
   * SMTP Management Routes
   */
  
  // List SMTP configurations
  app.get('/api/smtp/list',
    requirePermission('smtp:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        const licenseInfo = req.licenseInfo as LicenseToken;
        
        if (!licenseInfo.features.smtpRotation) {
          return res.status(403).json({
            success: false,
            error: 'SMTP rotation not available in your license plan',
            code: 'FEATURE_NOT_AVAILABLE'
          });
        }

        // TODO: Implement SMTP list retrieval
        
        res.json({
          success: true,
          smtpConfigs: [],
          message: 'SMTP list not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('SMTP list error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list SMTP configurations',
          details: error.message,
          code: 'SMTP_LIST_ERROR'
        });
      }
    }
  );

  // Add SMTP configuration
  app.post('/api/smtp/add',
    requirePermission('smtp:write'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        const licenseInfo = req.licenseInfo as LicenseToken;
        
        if (!licenseInfo.features.smtpRotation) {
          return res.status(403).json({
            success: false,
            error: 'SMTP rotation not available in your license plan',
            code: 'FEATURE_NOT_AVAILABLE'
          });
        }

        // TODO: Implement SMTP configuration addition
        
        res.json({
          success: true,
          message: 'SMTP add not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('SMTP add error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to add SMTP configuration',
          details: error.message,
          code: 'SMTP_ADD_ERROR'
        });
      }
    }
  );

  // Test SMTP configuration
  app.post('/api/smtp/test',
    requirePermission('smtp:test'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        // TODO: Implement SMTP testing
        
        res.json({
          success: true,
          message: 'SMTP test not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('SMTP test error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to test SMTP configuration',
          details: error.message,
          code: 'SMTP_TEST_ERROR'
        });
      }
    }
  );

  /**
   * File Management Routes
   */
  
  // List files
  app.get('/api/original/listFiles',
    requirePermission('files:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        // TODO: Implement file listing for user-specific files
        
        res.json({
          success: true,
          files: [],
          message: 'File listing not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('File listing error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list files',
          details: error.message,
          code: 'FILE_LIST_ERROR'
        });
      }
    }
  );

  // List logo files
  app.get('/api/original/listLogoFiles',
    requirePermission('files:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        const licenseInfo = req.licenseInfo as LicenseToken;
        
        if (!licenseInfo.features.allowDomainLogos) {
          return res.status(403).json({
            success: false,
            error: 'Domain logos not available in your license plan',
            code: 'FEATURE_NOT_AVAILABLE'
          });
        }

        // TODO: Implement logo file listing
        
        res.json({
          success: true,
          files: [],
          message: 'Logo file listing not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('Logo file listing error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list logo files',
          details: error.message,
          code: 'LOGO_LIST_ERROR'
        });
      }
    }
  );

  // Get file content
  app.get('/api/original/getFileContent/:filename',
    requirePermission('files:read'),
    validateLicenseToken,
    (req: Request, res: Response) => {
      try {
        // TODO: Implement secure file content retrieval
        
        res.json({
          success: true,
          content: '',
          message: 'File content retrieval not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('File content error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get file content',
          details: error.message,
          code: 'FILE_CONTENT_ERROR'
        });
      }
    }
  );

  // Save file
  app.post('/api/original/saveFile',
    requirePermission('files:write'),
    validateLicenseToken,
    upload.single('file'),
    (req: Request, res: Response) => {
      try {
        // TODO: Implement secure file saving with user isolation
        
        res.json({
          success: true,
          message: 'File saving not yet implemented in main backend',
          code: 'NOT_IMPLEMENTED'
        });

      } catch (error: any) {
        console.error('File save error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to save file',
          details: error.message,
          code: 'FILE_SAVE_ERROR'
        });
      }
    }
  );
}