import { Express, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getStorage } from '../storage/memoryStorage';
import { License, LicenseToken, licenseValidationSchema } from '@shared/schema';
import { requirePermission } from '../middleware/apiKeyAuth';

export function setupLicenseRoutes(app: Express) {
  const storage = getStorage();
  const JWT_SECRET = process.env.JWT_SECRET || 'main-backend-jwt-secret';

  /**
   * Validate license and return JWT token
   */
  app.post('/api/license/validate', requirePermission('license:validate'), async (req: Request, res: Response) => {
    try {
      // Validate request data
      const validation = licenseValidationSchema.parse(req.body);
      const { licenseKey, machineFingerprint, clientVersion } = validation;

      // Get license from storage
      const license = storage.getLicenseByKey(licenseKey);
      
      if (!license) {
        return res.status(404).json({
          success: false,
          error: 'License not found',
          code: 'LICENSE_NOT_FOUND'
        });
      }

      // Check license status
      if (license.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: `License is ${license.status}`,
          code: 'LICENSE_INACTIVE'
        });
      }

      // Check expiration
      if (license.expiresAt < new Date()) {
        // Update status to expired
        storage.updateLicense(licenseKey, { status: 'expired' });
        
        return res.status(403).json({
          success: false,
          error: 'License has expired',
          code: 'LICENSE_EXPIRED'
        });
      }

      // Check machine fingerprint for license binding
      if (machineFingerprint && license.machineFingerprint) {
        if (license.machineFingerprint !== machineFingerprint) {
          return res.status(403).json({
            success: false,
            error: 'License is bound to a different machine',
            code: 'MACHINE_MISMATCH'
          });
        }
      } else if (machineFingerprint && !license.machineFingerprint) {
        // Bind license to this machine on first use
        storage.updateLicense(licenseKey, { 
          machineFingerprint,
          activationCount: license.activationCount + 1,
          lastValidated: new Date()
        });
      }

      // Check activation limit
      if (license.activationCount >= license.maxActivations && license.machineFingerprint !== machineFingerprint) {
        return res.status(403).json({
          success: false,
          error: 'License activation limit exceeded',
          code: 'ACTIVATION_LIMIT_EXCEEDED'
        });
      }

      // Get current month's email usage
      const emailsUsedThisMonth = storage.getMonthlyEmailUsage(license.id);
      
      // Update license with current usage and last validated
      const updatedLicense = storage.updateLicense(licenseKey, {
        emailsUsedThisMonth,
        lastValidated: new Date()
      });

      if (!updatedLicense) {
        throw new Error('Failed to update license');
      }

      // Create JWT token
      const tokenPayload: LicenseToken = {
        licenseId: license.id,
        licenseKey: license.licenseKey,
        userId: license.userId,
        userEmail: license.userEmail,
        planType: license.planType,
        features: license.features,
        emailsUsedThisMonth,
        expiresAt: license.expiresAt.getTime(),
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: '24h', // Token expires in 24 hours
        issuer: 'email-sender-main-backend',
        audience: 'email-sender-client',
      });

      res.json({
        success: true,
        license: updatedLicense,
        token,
      });

      console.log(`✅ License validated: ${license.userEmail} (${license.planType}) - ${emailsUsedThisMonth}/${license.features.maxEmailsPerMonth} emails used`);

    } catch (error: any) {
      console.error('License validation error:', error);
      res.status(500).json({
        success: false,
        error: 'License validation failed',
        details: error.message,
        code: 'VALIDATION_ERROR'
      });
    }
  });

  /**
   * Record license usage
   */
  app.post('/api/license/usage', async (req: Request, res: Response) => {
    try {
      // Extract license token from request headers
      const licenseToken = req.headers['x-license-token'] as string;
      
      if (!licenseToken) {
        return res.status(401).json({
          success: false,
          error: 'Missing license token',
          code: 'MISSING_LICENSE_TOKEN'
        });
      }

      // Verify and decode JWT token
      const decoded = jwt.verify(licenseToken, JWT_SECRET) as LicenseToken;
      
      const { action, count = 1, metadata } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Action is required',
          code: 'MISSING_ACTION'
        });
      }

      // Record usage in storage
      const usage = storage.recordUsage(decoded.licenseId, {
        licenseId: decoded.licenseId,
        action,
        count,
        metadata,
      });

      // Update license email usage if it's an email action
      if (action === 'email_sent') {
        const license = storage.getLicenseById(decoded.licenseId);
        if (license) {
          const newEmailCount = license.emailsUsedThisMonth + count;
          storage.updateLicense(license.licenseKey, {
            emailsUsedThisMonth: newEmailCount
          });
        }
      }

      res.json({
        success: true,
        usage,
        message: `Recorded ${count} ${action} actions`
      });

      console.log(`📊 Usage recorded: ${decoded.userEmail} - ${action} x${count}`);

    } catch (error: any) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid license token',
          code: 'INVALID_LICENSE_TOKEN'
        });
      }

      console.error('Usage recording error:', error);
      res.status(500).json({
        success: false,
        error: 'Usage recording failed',
        details: error.message,
        code: 'USAGE_ERROR'
      });
    }
  });

  /**
   * Create new license (admin only)
   */
  app.post('/api/license/create', requirePermission('license:admin'), (req: Request, res: Response) => {
    try {
      const {
        licenseKey,
        userId,
        userEmail,
        userName,
        planType,
        features,
        expiresAt,
        maxActivations = 1
      } = req.body;

      // Generate license key if not provided
      const finalLicenseKey = licenseKey || crypto.randomBytes(32).toString('hex');

      // Check if license key already exists
      if (storage.getLicenseByKey(finalLicenseKey)) {
        return res.status(400).json({
          success: false,
          error: 'License key already exists',
          code: 'LICENSE_KEY_EXISTS'
        });
      }

      const license = storage.createLicense({
        licenseKey: finalLicenseKey,
        userId,
        userEmail,
        userName,
        planType,
        status: 'active',
        features,
        emailsUsedThisMonth: 0,
        issuedAt: new Date(),
        expiresAt: new Date(expiresAt),
        activationCount: 0,
        maxActivations,
      });

      res.json({
        success: true,
        license,
        message: 'License created successfully'
      });

      console.log(`🆕 License created: ${userEmail} (${planType}) - expires ${new Date(expiresAt).toISOString()}`);

    } catch (error: any) {
      console.error('License creation error:', error);
      res.status(500).json({
        success: false,
        error: 'License creation failed',
        details: error.message,
        code: 'CREATION_ERROR'
      });
    }
  });

  /**
   * List all licenses (admin only)
   */
  app.get('/api/license/list', requirePermission('license:admin'), (req: Request, res: Response) => {
    try {
      const licenses = storage.getAllLicenses();
      
      // Add current usage data
      const licensesWithUsage = licenses.map(license => ({
        ...license,
        emailsUsedThisMonth: storage.getMonthlyEmailUsage(license.id),
        recentUsage: storage.getUsageByLicense(license.id).slice(-10), // Last 10 usage records
      }));

      res.json({
        success: true,
        licenses: licensesWithUsage,
        total: licenses.length
      });

    } catch (error: any) {
      console.error('License listing error:', error);
      res.status(500).json({
        success: false,
        error: 'License listing failed',
        details: error.message,
        code: 'LISTING_ERROR'
      });
    }
  });

  /**
   * Update license (admin only)
   */
  app.put('/api/license/:licenseKey', requirePermission('license:admin'), (req: Request, res: Response) => {
    try {
      const { licenseKey } = req.params;
      const updates = req.body;

      const updatedLicense = storage.updateLicense(licenseKey, updates);

      if (!updatedLicense) {
        return res.status(404).json({
          success: false,
          error: 'License not found',
          code: 'LICENSE_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        license: updatedLicense,
        message: 'License updated successfully'
      });

      console.log(`🔄 License updated: ${updatedLicense.userEmail}`);

    } catch (error: any) {
      console.error('License update error:', error);
      res.status(500).json({
        success: false,
        error: 'License update failed',
        details: error.message,
        code: 'UPDATE_ERROR'
      });
    }
  });

  /**
   * Delete license (admin only)
   */
  app.delete('/api/license/:licenseKey', requirePermission('license:admin'), (req: Request, res: Response) => {
    try {
      const { licenseKey } = req.params;

      const deleted = storage.deleteLicense(licenseKey);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'License not found',
          code: 'LICENSE_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'License deleted successfully'
      });

      console.log(`🗑️ License deleted: ${licenseKey}`);

    } catch (error: any) {
      console.error('License deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'License deletion failed',
        details: error.message,
        code: 'DELETION_ERROR'
      });
    }
  });

  /**
   * Get license statistics (admin only)
   */
  app.get('/api/license/stats', requirePermission('license:admin'), (req: Request, res: Response) => {
    try {
      const stats = storage.getStats();
      
      // Additional license-specific stats
      const licenses = storage.getAllLicenses();
      const planTypeCounts = licenses.reduce((acc, license) => {
        acc[license.planType] = (acc[license.planType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusCounts = licenses.reduce((acc, license) => {
        acc[license.status] = (acc[license.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        stats: {
          ...stats,
          planTypes: planTypeCounts,
          statuses: statusCounts,
        }
      });

    } catch (error: any) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Stats retrieval failed',
        details: error.message,
        code: 'STATS_ERROR'
      });
    }
  });
}