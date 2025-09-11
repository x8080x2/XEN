import { Router } from 'express';
import { getMainLicenseService } from '../services/mainLicenseService';

const router = Router();

/**
 * Validate license endpoint
 */
router.post('/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required',
        code: 'MISSING_LICENSE_KEY'
      });
    }

    const licenseService = getMainLicenseService();
    const result = await licenseService.validateLicense(licenseKey);

    if (result.valid) {
      res.json({
        success: true,
        license: result.license,
        token: result.token,
        message: 'License validated successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        error: result.error || 'License validation failed',
        code: 'LICENSE_INVALID'
      });
    }
  } catch (error: any) {
    console.error('License validation error:', error);
    res.status(500).json({
      success: false,
      error: 'License validation error',
      details: error.message,
      code: 'VALIDATION_ERROR'
    });
  }
});

/**
 * Get current license status
 */
router.get('/status', async (req, res) => {
  try {
    const licenseService = getMainLicenseService();
    const result = await licenseService.getCurrentLicense();

    if (result.valid) {
      const usage = licenseService.getUsageSummary();
      res.json({
        success: true,
        license: result.license,
        usage,
        message: 'License status retrieved successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        error: result.error || 'No valid license',
        code: 'NO_LICENSE'
      });
    }
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
 * Check usage limits for email sending
 */
router.post('/check-limits', async (req, res) => {
  try {
    const { recipientCount } = req.body;

    if (!recipientCount || recipientCount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid recipient count is required',
        code: 'INVALID_RECIPIENT_COUNT'
      });
    }

    const licenseService = getMainLicenseService();
    const limitCheck = licenseService.checkEmailLimits(recipientCount);

    res.json({
      success: true,
      allowed: limitCheck.allowed,
      reason: limitCheck.reason,
      remaining: limitCheck.remaining,
      message: limitCheck.allowed ? 'Email send allowed' : 'Email limit exceeded'
    });
  } catch (error: any) {
    console.error('License limit check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check limits',
      details: error.message,
      code: 'LIMIT_CHECK_ERROR'
    });
  }
});

/**
 * Check if specific feature is available
 */
router.post('/check-feature', async (req, res) => {
  try {
    const { feature } = req.body;

    if (!feature) {
      return res.status(400).json({
        success: false,
        error: 'Feature name is required',
        code: 'MISSING_FEATURE'
      });
    }

    const licenseService = getMainLicenseService();
    const hasFeature = licenseService.hasFeature(feature);

    res.json({
      success: true,
      hasFeature,
      feature,
      message: hasFeature ? 'Feature available' : 'Feature not available'
    });
  } catch (error: any) {
    console.error('Feature check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check feature',
      details: error.message,
      code: 'FEATURE_CHECK_ERROR'
    });
  }
});

/**
 * Refresh license status (force re-validation)
 */
router.post('/refresh', async (req, res) => {
  try {
    const licenseService = getMainLicenseService();
    const result = await licenseService.getCurrentLicense(true); // Force refresh

    if (result.valid) {
      const usage = licenseService.getUsageSummary();
      res.json({
        success: true,
        license: result.license,
        usage,
        message: 'License refreshed successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        error: result.error || 'License refresh failed',
        code: 'REFRESH_FAILED'
      });
    }
  } catch (error: any) {
    console.error('License refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh license',
      details: error.message,
      code: 'REFRESH_ERROR'
    });
  }
});

export default router;