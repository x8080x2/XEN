import type { Request, Response, NextFunction } from "express";
import { licenseService } from "../services/licenseService";

export async function verifyLicenseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const licenseKey = req.headers['x-license-key'] as string;

    if (!licenseKey) {
      res.status(401).json({
        success: false,
        message: "License key is required. Please provide a valid license key."
      });
      return;
    }

    const result = await licenseService.verifyLicense(licenseKey);

    if (!result.valid) {
      res.status(401).json({
        success: false,
        message: result.message || "Invalid license key"
      });
      return;
    }

    next();
  } catch (error) {
    console.error("[LicenseMiddleware] Error:", error);
    res.status(500).json({
      success: false,
      message: "License verification failed"
    });
  }
}

export function optionalLicenseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const licenseKey = req.headers['x-license-key'] as string;
  
  if (licenseKey) {
    verifyLicenseMiddleware(req, res, next);
  } else {
    next();
  }
}
