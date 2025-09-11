import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicenseToken } from '@shared/schema';

// Extend Express Request type to include license info from JWT
declare global {
  namespace Express {
    interface Request {
      licenseInfo?: LicenseToken;
      recipientCount?: number;
    }
  }
}

/**
 * Middleware to validate JWT Bearer tokens for email routes
 * This replaces API key authentication for customer-facing email endpoints
 */
export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header. Expected: Authorization: Bearer <jwt-token>',
        code: 'MISSING_JWT_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing JWT token',
        code: 'MISSING_JWT_TOKEN'
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'main-backend-jwt-secret';
    
    // Warn if using default JWT secret in production
    if (JWT_SECRET === 'main-backend-jwt-secret' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Using default JWT_SECRET in production! Set JWT_SECRET environment variable.');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'email-sender-main-backend',
      audience: 'email-sender-client',
    }) as LicenseToken;
    
    // Check if license is still valid (not expired)
    if (decoded.expiresAt < Date.now()) {
      return res.status(403).json({
        success: false,
        error: 'License has expired',
        code: 'LICENSE_EXPIRED'
      });
    }

    // Attach license info to request for use in route handlers
    req.licenseInfo = decoded;
    
    console.log(`✅ JWT Auth: ${decoded.userEmail} (${decoded.planType}) - ${decoded.emailsUsedThisMonth}/${decoded.features.maxEmailsPerMonth} emails used`);
    
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid JWT token',
        code: 'INVALID_JWT_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'JWT token has expired',
        code: 'JWT_EXPIRED'
      });
    }

    console.error('JWT token validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'JWT token validation error',
      details: error.message,
      code: 'JWT_ERROR'
    });
  }
}

/**
 * Middleware to check if license allows specific feature
 */
export function requireJwtFeature(feature: keyof LicenseToken['features']) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const licenseInfo = req.licenseInfo;
      
      if (!licenseInfo) {
        return res.status(401).json({
          success: false,
          error: 'No license information found. JWT authentication required.',
          code: 'NO_LICENSE_INFO'
        });
      }

      if (!licenseInfo.features[feature]) {
        return res.status(403).json({
          success: false,
          error: `Feature '${feature}' not available in your ${licenseInfo.planType} license plan`,
          code: 'FEATURE_NOT_AVAILABLE'
        });
      }
      
      next();
    } catch (error: any) {
      console.error('JWT feature check error:', error);
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
 * Middleware to validate email sending limits based on JWT license info
 */
export function validateJwtEmailLimits(req: Request, res: Response, next: NextFunction) {
  try {
    const licenseInfo = req.licenseInfo;
    
    if (!licenseInfo) {
      return res.status(401).json({
        success: false,
        error: 'No license information found. JWT authentication required.',
        code: 'NO_LICENSE_INFO'
      });
    }
    
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
        error: `Too many recipients. Maximum ${licenseInfo.features.maxRecipientsPerEmail} allowed per email in your ${licenseInfo.planType} plan.`,
        code: 'RECIPIENT_LIMIT_EXCEEDED'
      });
    }

    // Check monthly email limit
    const remainingEmails = licenseInfo.features.maxEmailsPerMonth - licenseInfo.emailsUsedThisMonth;
    if (remainingEmails < recipientCount) {
      return res.status(403).json({
        success: false,
        error: `Monthly email limit exceeded. ${remainingEmails} emails remaining in your ${licenseInfo.planType} plan.`,
        remaining: remainingEmails,
        code: 'EMAIL_LIMIT_EXCEEDED'
      });
    }

    // Store recipient count for usage tracking
    req.recipientCount = recipientCount;
    
    console.log(`📧 Email Limits Check: ${licenseInfo.userEmail} - ${recipientCount} recipients, ${remainingEmails} emails remaining`);
    
    next();
  } catch (error: any) {
    console.error('JWT email limit validation error:', error);
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
 * This should be called after the response is sent
 */
export function recordJwtEmailUsage(req: Request, res: Response, next: NextFunction) {
  // Store original res.json to capture response
  const originalJson = res.json;
  
  res.json = function(body: any) {
    // Check if request was successful and has recipient count
    if (res.statusCode >= 200 && res.statusCode < 300 && req.recipientCount && req.licenseInfo) {
      // Record usage asynchronously (don't block response)
      setTimeout(async () => {
        try {
          // TODO: Implement usage recording to main backend storage
          // This would increment the license's email usage count
          console.log(`📊 Recording email usage: ${req.licenseInfo?.userEmail} sent ${req.recipientCount} emails`);
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
 * Middleware to add license info to successful responses
 */
export function attachJwtLicenseInfo(req: Request, res: Response, next: NextFunction) {
  try {
    // Store original res.json to add license info
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Add license info to response if it's a successful API response
      if (typeof body === 'object' && body !== null && res.statusCode >= 200 && res.statusCode < 300 && req.licenseInfo) {
        const licenseInfo = req.licenseInfo;
        body.licenseInfo = {
          isValid: true,
          planType: licenseInfo.planType,
          emailsUsed: licenseInfo.emailsUsedThisMonth,
          emailsLimit: licenseInfo.features.maxEmailsPerMonth,
          emailsRemaining: licenseInfo.features.maxEmailsPerMonth - licenseInfo.emailsUsedThisMonth,
          expiresAt: new Date(licenseInfo.expiresAt).toISOString(),
          features: {
            qrCodes: licenseInfo.features.allowQRCodes,
            attachments: licenseInfo.features.allowAttachments,
            domainLogos: licenseInfo.features.allowDomainLogos,
            htmlConvert: licenseInfo.features.allowHTMLConvert,
            smtpRotation: licenseInfo.features.smtpRotation,
            apiAccess: licenseInfo.features.apiAccess,
          },
        };
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  } catch (error: any) {
    // Don't block request if license info attachment fails
    console.error('JWT license info attachment error:', error);
    next();
  }
}