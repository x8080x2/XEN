/**
 * License Validation Script
 * Validates the LICENSE_KEY from .env before starting Electron
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('\x1b[31m%s\x1b[0m', '\n❌ ERROR: .env file not found!');
    console.log('\x1b[33m%s\x1b[0m', '\nPlease create a .env file with your LICENSE_KEY:');
    console.log('  1. Copy .env.example to .env');
    console.log('  2. Add your license key from Telegram bot');
    console.log('  3. Example: LICENSE_KEY=your-license-key-here\n');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return envVars;
}

// Validate license against server
function validateLicense(licenseKey, serverUrl) {
  return new Promise((resolve, reject) => {
    if (!licenseKey || licenseKey === 'your-license-key-here') {
      console.error('\x1b[31m%s\x1b[0m', '\n❌ ERROR: Invalid LICENSE_KEY in .env file!');
      console.log('\x1b[33m%s\x1b[0m', '\nPlease update your .env file with a valid license key:');
      console.log('  1. Get your license from the Telegram bot');
      console.log('  2. Open .env file');
      console.log('  3. Replace "your-license-key-here" with your actual license key\n');
      return reject(new Error('Invalid license key'));
    }

    const url = new URL('/api/license/verify', serverUrl);
    const protocol = url.protocol === 'https:' ? https : http;

    console.log('🔍 Validating license key...');
    console.log('Server:', serverUrl);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-License-Key': licenseKey
      }
    };

    const req = protocol.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 && response.valid) {
            console.log('\x1b[32m%s\x1b[0m', '✅ License validated successfully!');
            console.log('License expires:', response.expiresAt ? new Date(response.expiresAt).toLocaleString() : 'Never');
            resolve(true);
          } else {
            console.error('\x1b[31m%s\x1b[0m', '\n❌ License validation failed!');
            console.log('Status:', res.statusCode);
            console.log('Message:', response.message || 'Unknown error');
            console.log('\x1b[33m%s\x1b[0m', '\nPlease check:');
            console.log('  1. Your license key is correct in .env');
            console.log('  2. Your license has not expired');
            console.log('  3. The Replit server URL is correct');
            console.log('  4. Contact support if the problem persists\n');
            reject(new Error(response.message || 'License validation failed'));
          }
        } catch (error) {
          console.error('\x1b[31m%s\x1b[0m', '❌ Failed to parse server response');
          console.error('Error:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\x1b[31m%s\x1b[0m', '\n❌ Connection error!');
      console.error('Could not connect to server:', serverUrl);
      console.error('Error:', error.message);
      console.log('\x1b[33m%s\x1b[0m', '\nPlease check:');
      console.log('  1. Your REPLIT_SERVER_URL is correct in .env');
      console.log('  2. The server is running and accessible');
      console.log('  3. Your internet connection is working\n');
      reject(error);
    });

    req.end();
  });
}

// Main execution
async function main() {
  try {
    console.log('\n🔐 Email Sender Desktop - License Validation\n');
    console.log('═'.repeat(50));
    
    const env = loadEnv();
    const licenseKey = env.LICENSE_KEY;
    const serverUrl = env.REPLIT_SERVER_URL || 'http://localhost:5000';

    await validateLicense(licenseKey, serverUrl);

    console.log('═'.repeat(50));
    console.log('🚀 Starting Electron application...\n');
    process.exit(0);

  } catch (error) {
    console.log('═'.repeat(50));
    console.error('\x1b[31m%s\x1b[0m', '❌ Application start blocked due to license validation failure\n');
    process.exit(1);
  }
}

main();
