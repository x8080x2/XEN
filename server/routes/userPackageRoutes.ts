import { Router } from 'express';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { advancedEmailService } from '../services/advancedEmailService';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// User Package Authentication System  
const userPackageTokens = new Map<string, {
  packageId: string;
  userId: string;
  createdAt: Date;
  lastUsed: Date;
  emailLimit: number;
  emailCount: number;
  isActive: boolean;
}>();

// Generate user package token (SECURED admin endpoint)
router.post('/admin/generate-user-package-token', (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ 
        success: false, 
        error: 'ADMIN_SECRET environment variable must be configured' 
      });
    }
    if (req.headers['x-admin-secret'] !== adminSecret) {
      return res.status(403).json({ success: false, error: 'Invalid admin secret' });
    }

    const { packageId, userId, emailLimit = 1000 } = req.body;
    const token = randomBytes(32).toString('hex');
    
    userPackageTokens.set(token, {
      packageId: packageId || `pkg_${randomBytes(4).toString('hex')}`,
      userId: userId || `user_${randomBytes(4).toString('hex')}`,
      createdAt: new Date(),
      lastUsed: new Date(),
      emailLimit,
      emailCount: 0,
      isActive: true,
    });

    console.log(`Generated user package token for ${packageId || 'anonymous'}`);
    res.json({
      success: true,
      token,
      packageId: userPackageTokens.get(token)!.packageId,
      emailLimit,
    });
  } catch (error: any) {
    console.error('Token generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// User Package Email Sending Endpoint
router.post('/sendMail', upload.any(), async (req, res) => {
  try {
    // Authenticate user package
    const token = req.headers['x-package-token'] as string;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Package token required' });
    }

    const packageAuth = userPackageTokens.get(token);
    if (!packageAuth || !packageAuth.isActive) {
      return res.status(401).json({ success: false, error: 'Invalid or inactive package token' });
    }

    // Parse recipients first, then check email limits
    let recipients = req.body.recipients;
    if (typeof recipients === 'string') {
      try {
        recipients = JSON.parse(recipients);
      } catch {
        recipients = recipients.split('\n').filter((r: string) => r.trim());
      }
    }

    // Validate recipients and check limits
    if (!recipients || (!Array.isArray(recipients) && typeof recipients !== 'string')) {
      return res.status(400).json({ success: false, error: 'Recipients required' });
    }
    
    const recipientCount = Array.isArray(recipients) ? recipients.length : 1;
    if (packageAuth.emailCount + recipientCount > packageAuth.emailLimit) {
      return res.status(429).json({ 
        success: false, 
        error: `Email limit exceeded. Remaining: ${packageAuth.emailLimit - packageAuth.emailCount}, Requested: ${recipientCount}` 
      });
    }

    // Update last used time
    packageAuth.lastUsed = new Date();

    console.log(`User package sendMail request from ${packageAuth.packageId}:`, req.body);

    // Forward to the same logic as main service
    const files = req.files as Express.Multer.File[];
    const attachments = files?.map(file => file.path) || [];

    let settings = req.body.settings;
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }

    const args = {
      ...req.body,
      ...settings,
      recipients,
      attachments,
      senderEmail: req.body.senderEmail,
      senderName: req.body.senderName,
      subject: req.body.subject,
      html: req.body.html || req.body.emailContent,
      attachmentHtml: req.body.attachmentHtml,
      // SMTP settings
      smtpHost: req.body.smtpHost,
      smtpPort: req.body.smtpPort,
      smtpUser: req.body.smtpUser,
      smtpPass: req.body.smtpPass,
      // Advanced settings - all available to user packages
      sleep: req.body.sleep,
      qrSize: parseInt(req.body.qrSize) || 200,
      qrBorder: parseInt(req.body.qrBorder) || 2,
      qrForegroundColor: req.body.qrForegroundColor || '#000000',
      qrBackgroundColor: req.body.qrBackgroundColor || '#FFFFFF',
      hiddenImageFile: req.body.hiddenImageFile || '',
      hiddenImageSize: parseInt(req.body.hiddenImageSize) || 50,
      hiddenText: req.body.hiddenText || '',
      qrcode: req.body.qrcode === 'true' || req.body.qrcode === true,
      linkPlaceholder: req.body.linkPlaceholder,
      htmlImgBody: req.body.htmlImgBody === 'true' || req.body.htmlImgBody === true,
      randomMetadata: req.body.randomMetadata === 'true' || req.body.randomMetadata === true,
      minifyHtml: req.body.minifyHtml === 'true' || req.body.minifyHtml === true,
      emailPerSecond: parseInt(req.body.emailPerSecond) || 5,
      zipUse: req.body.zipUse === 'true' || req.body.zipUse === true,
      zipPassword: req.body.zipPassword,
      fileName: req.body.fileName,
      htmlConvert: req.body.htmlConvert,
      // Package identification for logging
      packageId: packageAuth.packageId,
      packageUserId: packageAuth.userId,
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Use existing sendMail without any modifications
    const result = await advancedEmailService.sendMail(args, (message: string) => {
      res.write(`data: ${JSON.stringify({ status: 'progress', message })}\n\n`);
    });

    if (result.success) {
      // Update email count only on success
      const successCount = result.details?.successCount || recipientCount;
      packageAuth.emailCount += successCount;
      
      res.write(`data: ${JSON.stringify({
        status: 'completed',
        success: true,
        result,
        packageStats: {
          emailsSent: successCount,
          remaining: packageAuth.emailLimit - packageAuth.emailCount
        }
      })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({
        status: 'error',
        success: false,
        error: result.error
      })}\n\n`);
    }

    res.end();

  } catch (error: any) {
    console.error('User package sendMail error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to process user package email request'
    });
  }
});

export default router;