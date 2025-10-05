import type { Express } from "express";
import { licenseService } from "../services/licenseService";
import { licenseVerifyRequestSchema, insertLicenseSchema } from "@shared/schema";

export function setupLicenseRoutes(app: Express) {
  app.post("/api/license/verify", async (req, res) => {
    try {
      const { licenseKey } = licenseVerifyRequestSchema.parse(req.body);

      const result = await licenseService.verifyLicense(licenseKey);

      if (result.valid) {
        res.json({
          valid: true,
          message: result.message,
          license: {
            expiresAt: result.license?.expiresAt,
            isActive: result.license?.isActive,
            metadata: result.license?.metadata
          }
        });
      } else {
        res.status(401).json({
          valid: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("[LicenseAPI] Verification error:", error);
      res.status(400).json({
        valid: false,
        message: "Invalid request"
      });
    }
  });

  app.post("/api/license/create", async (req, res) => {
    try {
      const licenseData = insertLicenseSchema.parse(req.body);

      const existingLicense = await licenseService.getLicenseByKey(licenseData.licenseKey);
      if (existingLicense) {
        return res.status(409).json({
          success: false,
          message: "License key already exists"
        });
      }

      const license = await licenseService.createLicense(licenseData);

      res.json({
        success: true,
        license: {
          id: license.id,
          licenseKey: license.licenseKey,
          isActive: license.isActive,
          expiresAt: license.expiresAt,
          createdAt: license.createdAt
        }
      });
    } catch (error) {
      console.error("[LicenseAPI] Create error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create license"
      });
    }
  });

  app.post("/api/license/deactivate", async (req, res) => {
    try {
      const { licenseKey } = licenseVerifyRequestSchema.parse(req.body);

      const success = await licenseService.deactivateLicense(licenseKey);

      if (success) {
        res.json({
          success: true,
          message: "License deactivated successfully"
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to deactivate license"
        });
      }
    } catch (error) {
      console.error("[LicenseAPI] Deactivate error:", error);
      res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }
  });

  app.get("/api/license/list", async (req, res) => {
    try {
      const licenses = await licenseService.getAllLicenses();

      res.json({
        success: true,
        licenses: licenses.map(license => ({
          id: license.id,
          licenseKey: license.licenseKey,
          isActive: license.isActive,
          expiresAt: license.expiresAt,
          createdAt: license.createdAt,
          lastValidated: license.lastValidated,
          metadata: license.metadata
        }))
      });
    } catch (error) {
      console.error("[LicenseAPI] List error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve licenses"
      });
    }
  });

  console.log("[LicenseAPI] License routes registered");
}
