import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
const { machineIdSync } = require('node-machine-id');
import axios from 'axios';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';
import multer from 'multer';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Read configuration from setup.ini
function readConfig() {
  const configPath = path.join(__dirname, '../config/setup.ini');
  if (!fs.existsSync(configPath)) {
    console.error('❌ ERROR: Configuration file not found at:', configPath);
    console.error('Please ensure config/setup.ini exists with proper configuration.');
    process.exit(1);
  }

  const config = fs.readFileSync(configPath, 'utf8');
  
  const getConfigValue = (key: string) => {
    const match = config.match(new RegExp(`${key}=(.+)`));
    return match ? match[1].trim() : null;
  };

  const backendUrl = getConfigValue('MAIN_BACKEND_URL');
  
  if (!backendUrl || backendUrl === 'https://your-backend.onrender.com') {
    console.error('❌ ERROR: MAIN_BACKEND_URL not configured in setup.ini');
    console.error('Please contact support for proper backend configuration.');
    process.exit(1);
  }
  
  return { backendUrl };
}

const { backendUrl: MAIN_BACKEND_URL } = readConfig();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client/dist')));

// License validation middleware
async function validateLicense(req: any, res: any, next: any) {
  try {
    const configPath = path.join(__dirname, '../config/setup.ini');
    let licenseKey = '';
    
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf8');
      const match = config.match(/LICENSE_KEY=(.+)/);
      if (match) {
        licenseKey = match[1].trim();
      }
    }
    
    if (!licenseKey || licenseKey === 'ENTER-YOUR-LICENSE-KEY-HERE') {
      return res.status(401).json({ 
        error: 'License key not configured. Please edit config/setup.ini with your license key.' 
      });
    }

    const machineFingerprint = machineIdSync();
    
    const response = await axios.post(`${MAIN_BACKEND_URL}/api/license/validate`, {
      licenseKey,
      machineFingerprint,
      clientVersion: process.env.CLIENT_VERSION || '1.0.0'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.success) {
      req.license = response.data.license;
      req.token = response.data.token;
      next();
    } else {
      res.status(401).json({ 
        error: 'Invalid or expired license', 
        details: response.data.error 
      });
    }
  } catch (error: any) {
    console.error('License validation error:', error.message);
    res.status(500).json({ 
      error: 'License validation failed', 
      details: error.message 
    });
  }
}

// Setup multer for file uploads
const upload = multer({ dest: 'temp/' });

// Proxy requests to main backend with proper file upload support
app.use('/api/email', validateLicense, upload.any(), async (req: any, res: any) => {
  try {
    // Prepare request data and headers
    let requestData;
    let requestHeaders = {
      'Authorization': `Bearer ${req.token}`,
    };

    // Handle multipart form data (file uploads)
    if (req.files && req.files.length > 0) {
      const formData = new FormData();
      
      // Add text fields
      Object.keys(req.body).forEach(key => {
        formData.append(key, req.body[key]);
      });
      
      // Add file fields
      req.files.forEach((file: any) => {
        formData.append('files', require('fs').createReadStream(file.path), {
          filename: file.originalname,
          contentType: file.mimetype
        });
      });
      
      requestData = formData;
      requestHeaders = {
        ...requestHeaders,
        ...formData.getHeaders()
      };
    } else {
      // Handle JSON data
      requestData = req.body;
      requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await axios({
      method: req.method,
      url: `${MAIN_BACKEND_URL}/api/email${req.path}`,
      data: requestData,
      headers: requestHeaders,
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      maxBodyLength: 100 * 1024 * 1024,
      timeout: 60000 // 60 seconds for file uploads
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Request failed',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: process.env.CLIENT_VERSION || '1.0.0',
    backend: MAIN_BACKEND_URL 
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\\n🚀 Email Sender Client running on http://localhost:${PORT}`);
  console.log(`📡 Connected to backend: ${MAIN_BACKEND_URL}`);
  console.log(`\\n📂 Configuration: ${path.join(__dirname, '../config/setup.ini')}`);
  console.log(`📁 Templates folder: ${path.join(__dirname, '../files')}`);
  console.log(`\\n✨ Ready to send emails!`);
});

export default app;