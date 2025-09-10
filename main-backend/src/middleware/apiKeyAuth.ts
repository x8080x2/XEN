import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getStorage } from '../storage/memoryStorage';

// Extend Express Request type to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        keyName: string;
        permissions: string[];
      };
    }
  }
}

/**
 * Middleware to validate API key for main backend access
 */
export function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'MISSING_API_KEY'
      });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key',
        code: 'MISSING_API_KEY'
      });
    }

    // Hash the provided API key
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Look up the API key in storage
    const storage = getStorage();
    const keyRecord = storage.getApiKeyByHash(hashedKey);

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    if (!keyRecord.isActive) {
      return res.status(401).json({
        success: false,
        error: 'API key is deactivated',
        code: 'DEACTIVATED_API_KEY'
      });
    }

    // Update last used timestamp
    storage.updateApiKeyLastUsed(hashedKey);

    // Attach API key info to request
    req.apiKey = {
      id: keyRecord.id,
      keyName: keyRecord.keyName,
      permissions: keyRecord.permissions,
    };

    next();
  } catch (error: any) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'API key validation error',
      details: error.message,
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware to check specific permissions
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.apiKey) {
        return res.status(401).json({
          success: false,
          error: 'No API key validated',
          code: 'NO_API_KEY'
        });
      }

      const { permissions } = req.apiKey;
      
      // Check for wildcard permission or specific permission
      if (permissions.includes('*') || permissions.includes(permission)) {
        next();
      } else {
        return res.status(403).json({
          success: false,
          error: `Permission '${permission}' required`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
    } catch (error: any) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check error',
        details: error.message,
        code: 'PERMISSION_ERROR'
      });
    }
  };
}