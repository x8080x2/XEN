
import { Router } from 'express';
import { licenseService } from '../services/licenseService';

const router = Router();

// Verify license key
router.post('/verify', async (req, res) => {
  try {
    const { licenseKey, hardwareId } = req.body;
    
    console.log('[License API] Received verification request:', {
      licenseKey: licenseKey ? licenseKey.substring(0, 8) + '...' : 'missing',
      hardwareId: hardwareId ? hardwareId.substring(0, 16) + '...' : 'missing',
      hardwareIdType: typeof hardwareId,
      bodyKeys: Object.keys(req.body)
    });
    
    if (!licenseKey) {
      return res.status(400).json({ 
        valid: false, 
        error: 'License key is required' 
      });
    }

    if (!hardwareId || typeof hardwareId !== 'string' || hardwareId.trim() === '') {
      console.warn('[License API] Hardware ID validation failed:', { hardwareId, type: typeof hardwareId });
      return res.status(400).json({ 
        valid: false, 
        error: 'Hardware ID is required for license verification' 
      });
    }

    const result = await licenseService.verifyLicense(licenseKey, hardwareId);
    
    res.json(result);
  } catch (error) {
    console.error('License verification error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Failed to verify license' 
    });
  }
});

// Check license status (admin endpoint - no hardware binding required)
router.get('/status/:licenseKey', async (req, res) => {
  try {
    const { licenseKey } = req.params;
    // Use dedicated status check method that doesn't require hardware ID
    const result = await licenseService.checkLicenseStatus(licenseKey);
    res.json(result);
  } catch (error) {
    console.error('License status check error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Failed to check license status' 
    });
  }
});

export default router;
