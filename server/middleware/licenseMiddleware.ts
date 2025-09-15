import { Request, Response, NextFunction } from 'express';

// Extended Request interface for TypeScript (keeping for compatibility)
declare global {
  namespace Express {
    interface Request {
      recipientCount?: number;
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
 * Placeholder middleware - no license validation (free access)
 */
export async function requireValidLicense(req: Request, res: Response, next: NextFunction) {
  // Set default "valid" license for free access
  req.license = {
    valid: true,
    planType: 'free',
  };
  next();
}

/**
 * Placeholder feature middleware - all features enabled for free
 */
export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // All features are available for free
    next();
  };
}

/**
 * No email limits for free version
 */
export function validateEmailLimits(req: Request, res: Response, next: NextFunction) {
  // Extract recipient count for logging purposes
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

  // Store recipient count for logging
  req.recipientCount = recipientCount;
  next();
}

/**
 * No usage recording needed for free version
 */
export function recordEmailUsage(req: Request, res: Response, next: NextFunction) {
  next();
}

/**
 * Add free license info to responses
 */
export function attachLicenseInfo(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;

  res.json = function(body: any) {
    if (typeof body === 'object' && body !== null && res.statusCode >= 200 && res.statusCode < 300) {
      body.licenseInfo = {
        isValid: true,
        planType: 'free',
        emailsRemaining: 999999,
        features: {
          qrCodes: true,
          attachments: true,
          domainLogos: true,
          htmlConvert: true,
          smtpRotation: true,
          apiAccess: true,
        },
      };
    }

    return originalJson.call(this, body);
  };

  next();
}