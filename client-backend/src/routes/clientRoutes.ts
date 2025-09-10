import { Express, Request, Response } from 'express';
import { getLicenseService } from '../services/licenseService';

export function setupClientRoutes(app: Express) {
  // License management routes
  
  /**
   * Activate license
   */
  app.post('/api/license/activate', async (req: Request, res: Response) => {
    try {
      const { licenseKey } = req.body;
      
      if (!licenseKey) {
        return res.status(400).json({
          success: false,
          error: 'License key is required',
          code: 'MISSING_LICENSE_KEY'
        });
      }

      const licenseService = getLicenseService();
      const result = await licenseService.validateLicense(licenseKey);

      if (result.valid) {
        res.json({
          success: true,
          message: 'License activated successfully',
          license: {
            planType: result.license?.planType,
            userEmail: result.license?.userEmail,
            userName: result.license?.userName,
            expiresAt: result.license?.expiresAt,
            features: result.license?.features,
            emailsUsed: result.license?.emailsUsedThisMonth,
            emailsRemaining: result.license ? 
              result.license.features.maxEmailsPerMonth - result.license.emailsUsedThisMonth : 0,
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: 'ACTIVATION_FAILED'
        });
      }
    } catch (error: any) {
      console.error('License activation error:', error);
      res.status(500).json({
        success: false,
        error: 'License activation failed',
        details: error.message,
        code: 'ACTIVATION_ERROR'
      });
    }
  });

  /**
   * Get license status
   */
  app.get('/api/license/status', async (req: Request, res: Response) => {
    try {
      const licenseService = getLicenseService();
      const status = licenseService.getLicenseStatus();

      res.json({
        success: true,
        status: {
          isValid: status.isValid,
          planType: status.planType,
          userEmail: status.userEmail,
          userName: status.userName,
          expiresAt: status.expiresAt,
          emailsUsed: status.emailsUsed,
          emailsRemaining: status.emailsRemaining,
          features: status.features,
          error: status.error,
        }
      });
    } catch (error: any) {
      console.error('License status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get license status',
        details: error.message,
        code: 'STATUS_ERROR'
      });
    }
  });

  /**
   * Refresh license (force re-validation)
   */
  app.post('/api/license/refresh', async (req: Request, res: Response) => {
    try {
      const licenseService = getLicenseService();
      const result = await licenseService.getCurrentLicense(true);

      if (result.valid) {
        res.json({
          success: true,
          message: 'License refreshed successfully',
          license: {
            planType: result.license?.planType,
            userEmail: result.license?.userEmail,
            userName: result.license?.userName,
            expiresAt: result.license?.expiresAt,
            features: result.license?.features,
            emailsUsed: result.license?.emailsUsedThisMonth,
            emailsRemaining: result.license ? 
              result.license.features.maxEmailsPerMonth - result.license.emailsUsedThisMonth : 0,
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: 'REFRESH_FAILED'
        });
      }
    } catch (error: any) {
      console.error('License refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'License refresh failed',
        details: error.message,
        code: 'REFRESH_ERROR'
      });
    }
  });

  /**
   * Deactivate license (clear cache)
   */
  app.post('/api/license/deactivate', (req: Request, res: Response) => {
    try {
      const licenseService = getLicenseService();
      licenseService.clearCache();

      res.json({
        success: true,
        message: 'License deactivated successfully'
      });
    } catch (error: any) {
      console.error('License deactivation error:', error);
      res.status(500).json({
        success: false,
        error: 'License deactivation failed',
        details: error.message,
        code: 'DEACTIVATION_ERROR'
      });
    }
  });

  /**
   * Get client information
   */
  app.get('/api/client/info', (req: Request, res: Response) => {
    try {
      const licenseService = getLicenseService();
      
      res.json({
        success: true,
        client: {
          version: process.env.CLIENT_VERSION || '1.0.0',
          machineFingerprint: licenseService.getMachineFingerprint(),
          mainBackendUrl: process.env.MAIN_BACKEND_URL || 'unknown',
          status: 'connected',
        }
      });
    } catch (error: any) {
      console.error('Client info error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get client info',
        details: error.message,
        code: 'CLIENT_INFO_ERROR'
      });
    }
  });

  /**
   * Health check endpoint
   */
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.CLIENT_VERSION || '1.0.0',
    });
  });
}