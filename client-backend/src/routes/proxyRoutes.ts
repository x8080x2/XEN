import { Express, Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import { getLicenseService } from '../services/licenseService';

const upload = multer({ dest: 'temp/' });

export function setupProxyRoutes(app: Express) {
  // Middleware to validate license before proxying
  const validateLicenseMiddleware = async (req: Request, res: Response, next: any) => {
    try {
      const licenseService = getLicenseService();
      const license = await licenseService.getCurrentLicense();

      if (!license.valid) {
        return res.status(403).json({
          success: false,
          error: license.error || 'Invalid license',
          code: 'LICENSE_INVALID'
        });
      }

      // Add auth token to request headers for main backend
      const authToken = licenseService.getAuthToken();
      if (authToken) {
        req.headers['x-license-token'] = authToken;
      }
      req.headers['x-client-version'] = process.env.CLIENT_VERSION || '1.0.0';
      
      next();
    } catch (error: any) {
      console.error('License validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'License validation error',
        details: error.message,
        code: 'LICENSE_ERROR'
      });
    }
  };

  // Email usage validation middleware
  const validateEmailUsage = async (req: Request, res: Response, next: any) => {
    try {
      const licenseService = getLicenseService();
      
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

      const limitCheck = licenseService.checkEmailLimits(recipientCount);
      
      if (!limitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: limitCheck.reason,
          remaining: limitCheck.remaining,
          code: 'EMAIL_LIMIT_EXCEEDED'
        });
      }

      next();
    } catch (error: any) {
      console.error('Email usage validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Email usage validation error',
        details: error.message,
        code: 'USAGE_ERROR'
      });
    }
  };

  // Proxy helper function
  const proxyToMainBackend = async (req: Request, res: Response, endpoint: string, options: any = {}) => {
    try {
      const mainBackendUrl = process.env.MAIN_BACKEND_URL;
      if (!mainBackendUrl) {
        throw new Error('MAIN_BACKEND_URL not configured');
      }

      const config: any = {
        method: req.method,
        url: `${mainBackendUrl}${endpoint}`,
        headers: {
          ...req.headers,
          host: undefined, // Remove host header
        },
        timeout: options.timeout || 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      };

      // Add body for POST/PUT/PATCH requests
      if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        config.data = req.body;
      }

      // Add query parameters
      if (req.query && Object.keys(req.query).length > 0) {
        config.params = req.query;
      }

      const response = await axios(config);
      
      // Forward response
      res.status(response.status);
      
      // Forward response headers (excluding connection-related headers)
      const excludeHeaders = ['connection', 'keep-alive', 'transfer-encoding'];
      Object.keys(response.headers).forEach(key => {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          res.set(key, response.headers[key]);
        }
      });

      res.send(response.data);
    } catch (error: any) {
      console.error(`Proxy error for ${endpoint}:`, error.message);
      
      if (error.response) {
        // Forward error from main backend
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        res.status(503).json({
          success: false,
          error: 'Main backend unavailable',
          code: 'BACKEND_UNAVAILABLE'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Proxy error',
          details: error.message,
          code: 'PROXY_ERROR'
        });
      }
    }
  };

  // Email sending routes (require license validation and usage check)
  app.post('/api/emails/send', validateLicenseMiddleware, validateEmailUsage, upload.any(), (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/emails/send', { timeout: 60000 });
  });

  app.post('/api/original/sendMail', validateLicenseMiddleware, validateEmailUsage, upload.any(), (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/original/sendMail', { timeout: 60000 });
  });

  // Status and monitoring routes (require license validation)
  app.get('/api/emails/status/:jobId', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, `/api/emails/status/${req.params.jobId}`);
  });

  app.get('/api/original/getCampaignStatus/:campaignId', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, `/api/original/getCampaignStatus/${req.params.campaignId}`);
  });

  // Config routes (require license validation)
  app.get('/api/config/load', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/config/load');
  });

  app.get('/api/config/smtp', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/config/smtp');
  });

  app.get('/api/config/loadLeads', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/config/loadLeads');
  });

  // SMTP management routes (require license validation)
  app.get('/api/smtp/list', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/smtp/list');
  });

  app.post('/api/smtp/add', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/smtp/add');
  });

  app.post('/api/smtp/test', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/smtp/test');
  });

  app.delete('/api/smtp/delete/:smtpId', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, `/api/smtp/delete/${req.params.smtpId}`);
  });

  app.post('/api/smtp/setRotation', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/smtp/setRotation');
  });

  // File management routes (require license validation)
  app.get('/api/original/listFiles', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/original/listFiles');
  });

  app.get('/api/original/listLogoFiles', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/original/listLogoFiles');
  });

  app.get('/api/original/getFileContent/:filename', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, `/api/original/getFileContent/${req.params.filename}`);
  });

  app.post('/api/original/saveFile', validateLicenseMiddleware, upload.single('file'), (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/original/saveFile');
  });

  // Utility routes (require license validation)
  app.get('/api/placeholders', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/placeholders');
  });

  app.post('/api/html/process', validateLicenseMiddleware, (req: Request, res: Response) => {
    proxyToMainBackend(req, res, '/api/html/process');
  });

  // Generic proxy route for any other API calls (catch-all)
  app.use('/api/*', validateLicenseMiddleware, (req: Request, res: Response) => {
    const endpoint = req.originalUrl;
    proxyToMainBackend(req, res, endpoint);
  });
}