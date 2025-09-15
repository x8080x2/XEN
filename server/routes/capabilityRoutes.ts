import { Router } from 'express';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { advancedEmailService } from '../services/advancedEmailService';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Capability URL System - Direct email sending for users
const capabilityTokens = new Map<string, {
  userId: string;
  createdAt: Date;
  lastUsed: Date;
  emailLimit: number;
  emailCount: number;
}>();

// Generate capability token for a user (SECURED admin endpoint)
router.post('/admin/generate-capability-token', (req, res) => {
  try {
    // Additional security: Require admin secret (no default fallback)
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

    const { userId, emailLimit = 1000 } = req.body;
    const token = randomBytes(32).toString('hex'); // Generate secure random token
    
    capabilityTokens.set(token, {
      userId: userId || 'user_' + randomBytes(4).toString('hex'),
      createdAt: new Date(),
      lastUsed: new Date(),
      emailLimit,
      emailCount: 0
    });

    res.json({
      success: true,
      token,
      sendUrl: `/api/cap/${token}/send`,
      fullUrl: `${req.protocol}://${req.get('host')}/api/cap/${token}/send`,
      emailLimit
    });
  } catch (error: any) {
    console.error('Token generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate capability token' });
  }
});

// Capability URL endpoint - Direct email sending with just URL
router.post('/cap/:token/send', upload.any(), async (req, res) => {
  try {
    const { token } = req.params;
    const capability = capabilityTokens.get(token);

    // Validate capability token
    if (!capability) {
      return res.status(401).json({ success: false, error: 'Invalid capability token' });
    }

    // Check email limit
    if (capability.emailCount >= capability.emailLimit) {
      return res.status(429).json({ 
        success: false, 
        error: `Email limit reached (${capability.emailLimit})`,
        emailCount: capability.emailCount,
        emailLimit: capability.emailLimit
      });
    }

    // Update last used
    capability.lastUsed = new Date();

    const files = req.files as Express.Multer.File[];
    const attachments = files?.map(file => file.path) || [];

    let recipients = req.body.recipients;
    if (typeof recipients === 'string') {
      try {
        recipients = JSON.parse(recipients);
      } catch {
        recipients = recipients.split('\n').filter((r: string) => r.trim());
      }
    }

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
      // User identification
      userId: capability.userId,
    };

    // Use existing sendMail without any modifications
    const result = await advancedEmailService.sendMail(args, (message: string) => {
      // For capability URLs, we don't stream - just complete when done
    });

    if (result.success) {
      capability.emailCount++;
      res.json({
        success: true,
        result,
        usage: {
          emailsSent: capability.emailCount,
          remaining: capability.emailLimit - capability.emailCount
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Capability send error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;