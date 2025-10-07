#!/usr/bin/env node

/**
 * Sync Styles Script
 * Copies the latest styles from the web app to the desktop app
 */

const fs = require('fs');
const path = require('path');

const webAppStylesPath = path.join(__dirname, '..', 'client', 'src', 'index.css');
const desktopStylesPath = path.join(__dirname, 'client', 'src', 'web-app-styles.css');

try {
  // Check if web app styles exist
  if (!fs.existsSync(webAppStylesPath)) {
    console.error('❌ Web app styles not found at:', webAppStylesPath);
    console.log('💡 Make sure you are running this from the Replit project');
    process.exit(1);
  }

  // Copy the styles
  fs.copyFileSync(webAppStylesPath, desktopStylesPath);
  
  console.log('✅ Styles synced successfully!');
  console.log('📁 Copied from:', webAppStylesPath);
  console.log('📁 Copied to:', desktopStylesPath);
  console.log('\n💡 Now you can build the desktop app with: npm run build');
  
} catch (error) {
  console.error('❌ Error syncing styles:', error.message);
  process.exit(1);
}
