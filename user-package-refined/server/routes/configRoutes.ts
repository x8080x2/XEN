import express from 'express';
import { configService, type SMTPConfig, type SetupConfig } from '../services/configService';

const router = express.Router();

// Load setup configuration
router.get('/load', async (req, res) => {
  try {
    const config = configService.loadSetupConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('Error loading setup config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load setup configuration',
      details: error.message
    });
  }
});

// Save setup configuration
router.post('/save', async (req, res) => {
  try {
    const config: SetupConfig = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration data is required'
      });
    }
    
    configService.saveSetupConfig(config);
    
    res.json({
      success: true,
      message: 'Configuration saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving setup config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save setup configuration',
      details: error.message
    });
  }
});

// Load leads
router.get('/loadLeads', async (req, res) => {
  try {
    const leads = configService.loadLeads();
    res.json({
      success: true,
      data: leads
    });
  } catch (error: any) {
    console.error('Error loading leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load leads',
      details: error.message
    });
  }
});

// Save leads
router.post('/saveLeads', async (req, res) => {
  try {
    const { leads } = req.body;
    
    if (!Array.isArray(leads)) {
      return res.status(400).json({
        success: false,
        error: 'Leads must be an array of strings'
      });
    }
    
    configService.saveLeads(leads);
    
    res.json({
      success: true,
      message: 'Leads saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save leads',
      details: error.message
    });
  }
});

export default router;