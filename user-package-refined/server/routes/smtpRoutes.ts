import express from 'express';
import { configService, type SMTPConfig } from '../services/configService';

const router = express.Router();

// List all SMTP configurations
router.get('/list', async (req, res) => {
  try {
    const configs = configService.loadSMTPConfig();
    res.json({
      success: true,
      data: configs
    });
  } catch (error: any) {
    console.error('Error loading SMTP configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load SMTP configurations',
      details: error.message
    });
  }
});

// Save SMTP configurations
router.post('/save', async (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({
        success: false,
        error: 'Configs must be an array of SMTP configurations'
      });
    }
    
    // Validate each config object
    for (const config of configs) {
      if (!config.host || !config.port || !config.user || !config.pass || !config.fromEmail) {
        return res.status(400).json({
          success: false,
          error: 'Each SMTP config must have host, port, user, pass, and fromEmail'
        });
      }
    }
    
    configService.saveSMTPConfig(configs);
    
    res.json({
      success: true,
      message: 'SMTP configurations saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving SMTP configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save SMTP configurations',
      details: error.message
    });
  }
});

// Add a new SMTP configuration
router.post('/add', async (req, res) => {
  try {
    const newConfig: SMTPConfig = req.body;
    
    if (!newConfig.host || !newConfig.port || !newConfig.user || !newConfig.pass || !newConfig.fromEmail) {
      return res.status(400).json({
        success: false,
        error: 'SMTP config must have host, port, user, pass, and fromEmail'
      });
    }
    
    const existingConfigs = configService.loadSMTPConfig();
    existingConfigs.push(newConfig);
    
    configService.saveSMTPConfig(existingConfigs);
    
    res.json({
      success: true,
      message: 'SMTP configuration added successfully',
      data: newConfig
    });
  } catch (error: any) {
    console.error('Error adding SMTP config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add SMTP configuration',
      details: error.message
    });
  }
});

// Delete SMTP configuration by index
router.delete('/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    
    if (isNaN(index) || index < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid index provided'
      });
    }
    
    const existingConfigs = configService.loadSMTPConfig();
    
    if (index >= existingConfigs.length) {
      return res.status(404).json({
        success: false,
        error: 'SMTP configuration not found'
      });
    }
    
    existingConfigs.splice(index, 1);
    configService.saveSMTPConfig(existingConfigs);
    
    res.json({
      success: true,
      message: 'SMTP configuration deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting SMTP config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete SMTP configuration',
      details: error.message
    });
  }
});

export default router;