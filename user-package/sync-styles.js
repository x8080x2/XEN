#!/usr/bin/env node

/**
 * Sync Styles Script
 * Copies the latest styles from the web app to the desktop app
 */

const fs = require('fs');
const path = require('path');

const webAppStylesPath = path.join(__dirname, '..', 'client', 'src', 'index.css');
const webAppTailwindPath = path.join(__dirname, '..', 'tailwind.config.ts');
const desktopStylesPath = path.join(__dirname, 'client', 'src', 'web-app-styles.css');
const desktopTailwindPath = path.join(__dirname, 'tailwind.config.ts');

try {
  // Check if web app files exist
  if (!fs.existsSync(webAppStylesPath)) {
    console.error('❌ Web app styles not found at:', webAppStylesPath);
    console.log('💡 Make sure you are running this from the Replit project');
    process.exit(1);
  }

  // Copy the CSS styles
  fs.copyFileSync(webAppStylesPath, desktopStylesPath);
  console.log('✅ CSS synced successfully!');
  console.log('📁 Copied from:', webAppStylesPath);
  console.log('📁 Copied to:', desktopStylesPath);
  
  // Copy the Tailwind config
  if (fs.existsSync(webAppTailwindPath)) {
    const tailwindConfig = fs.readFileSync(webAppTailwindPath, 'utf8');
    // Update the content path for desktop app
    const updatedConfig = tailwindConfig.replace(
      'content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"]',
      'content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"]'
    );
    fs.writeFileSync(desktopTailwindPath, updatedConfig);
    console.log('✅ Tailwind config synced successfully!');
    console.log('📁 Copied from:', webAppTailwindPath);
    console.log('📁 Copied to:', desktopTailwindPath);
  }
  
  console.log('\n💡 Now you can build the desktop app with: npm run build');
  
} catch (error) {
  console.error('❌ Error syncing styles:', error.message);
  process.exit(1);
}
