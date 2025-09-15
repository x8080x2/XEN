import { Router } from 'express';

const router = Router();

/**
 * Mock validate license endpoint - always returns success for free access
 */
router.post('/validate', async (req, res) => {
  res.json({
    success: true,
    license: {
      licenseKey: 'FREE-ACCESS',
      planType: 'free',
      features: {
        maxEmailsPerMonth: 999999,
        maxRecipientsPerEmail: 999999,
        allowQRCodes: true,
        allowAttachments: true,
        allowDomainLogos: true,
        allowHTMLConvert: true,
        smtpRotation: true,
        apiAccess: true,
      },
      emailsUsedThisMonth: 0,
      status: 'active',
      expiresAt: new Date('2099-12-31').toISOString(),
    },
    token: 'free-access-token',
    message: 'Free access granted'
  });
});

/**
 * Mock license status - always returns free access
 */
router.get('/status', async (req, res) => {
  res.json({
    success: true,
    license: {
      licenseKey: 'FREE-ACCESS',
      planType: 'free',
    },
    usage: {
      plan: 'free',
      emailsUsed: 0,
      emailsLimit: 999999,
      emailsRemaining: 999999,
      recipientsPerEmail: 999999,
      features: {
        qrCodes: true,
        attachments: true,
        domainLogos: true,
        htmlConvert: true,
        smtpRotation: true,
        apiAccess: true,
      },
    },
    message: 'Free access status'
  });
});

/**
 * No limits for free version
 */
router.post('/check-limits', async (req, res) => {
  res.json({
    success: true,
    allowed: true,
    message: 'No limits in free version'
  });
});

/**
 * All features available in free version
 */
router.post('/check-feature', async (req, res) => {
  res.json({
    success: true,
    hasFeature: true,
    feature: req.body.feature,
    message: 'All features available in free version'
  });
});

/**
 * Mock refresh endpoint
 */
router.post('/refresh', async (req, res) => {
  res.json({
    success: true,
    license: {
      licenseKey: 'FREE-ACCESS',
      planType: 'free',
    },
    usage: {
      plan: 'free',
      emailsRemaining: 999999,
    },
    message: 'Free access refreshed'
  });
});

export default router;