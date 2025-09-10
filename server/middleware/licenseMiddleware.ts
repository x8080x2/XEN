import { Request, Response, NextFunction } from 'express';
import { getMainLicenseService } from '../services/mainLicenseService';

// Extend Express Request type to include license info
declare global {
  namespace Express {
    interface Request {
      license?: {
        valid: boolean;
        token?: string;
        features?: any;
        licenseId?: string;
        userId?: string;
        planType?: string;
      };
    }
  }
}

/**
 * Middleware to validate license for protected routes
 */
export async function requireValidLicense(req: Request, res: Response, next: NextFunction) {
  try {
    const licenseService = getMainLicenseService();
    const licenseStatus = await licenseService.getCurrentLicense();

    if (!licenseStatus.valid) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired license',
        details: licenseStatus.error,
        code: 'LICENSE_INVALID'
      });
    }

    // Attach license info to request
    req.license = {
      valid: true,
      features: licenseStatus.license?.features,
      planType: licenseStatus.license?.planType,
    };

    next();
  } catch (error: any) {
    console.error('License validation middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'License validation error',
      details: error.message,
      code: 'LICENSE_ERROR'
    });
  }
}

/**
 * Middleware to check specific feature access
 */
export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const licenseService = getMainLicenseService();
      
      if (!licenseService.hasFeature(feature as any)) {
        return res.status(403).json({
          success: false,
          error: `Feature '${feature}' not available in your license plan`,
          code: 'FEATURE_NOT_AVAILABLE'
        });
      }

      next();
    } catch (error: any) {
      console.error('Feature validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Feature validation error',
        details: error.message,
        code: 'FEATURE_ERROR'
      });
    }
  };
}

/**
 * Middleware to validate email sending limits
 */
export function validateEmailLimits(req: Request, res: Response, next: NextFunction) {
  try {
    const licenseService = getMainLicenseService();
    
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

    // Attach recipient count to request for later usage recording
    req.recipientCount = recipientCount;
    
    next();
  } catch (error: any) {
    console.error('Email limit validation middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Email limit validation error',
      details: error.message,
      code: 'LIMIT_ERROR'
    });
  }
}

/**
 * Middleware to record email usage after successful sending
 */
export function recordEmailUsage(req: Request, res: Response, next: NextFunction) {
  // Store original res.json to capture response
  const originalJson = res.json;
  
  res.json = function(body: any) {
    // Check if request was successful
    if (res.statusCode >= 200 && res.statusCode < 300 && req.recipientCount) {
      // Record usage asynchronously (don't block response)
      setTimeout(async () => {
        try {
          const licenseService = getMainLicenseService();
          // Note: recordEmailUsage method may need to be implemented
        } catch (error) {
          console.error('Failed to record email usage:', error);
        }
      }, 100);
    }
    
    // Call original res.json
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * Middleware to add license info to responses
 */
export function attachLicenseInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const licenseService = getMainLicenseService();
    const licenseStatus = licenseService.getUsageSummary();

    // Store original res.json to add license info
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Add license info to response if it's a successful API response
      if (typeof body === 'object' && body !== null && res.statusCode >= 200 && res.statusCode < 300) {
        body.licenseInfo = {
          isValid: licenseStatus !== null,
          planType: licenseStatus?.plan,
          emailsRemaining: licenseStatus?.emailsRemaining,
          expiresAt: licenseStatus?.expiresAt,
          features: licenseStatus?.features,
        };
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  } catch (error: any) {
    // Don't block request if license info attachment fails
    console.error('License info attachment error:', error);
    next();
  }
}

// Extended Request interface for TypeScript
declare global {
  namespace Express {
    interface Request {
      recipientCount?: number;
    }
  }
}