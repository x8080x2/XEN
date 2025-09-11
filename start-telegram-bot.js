
#!/usr/bin/env node

console.log('🚀 Starting Telegram License Bot...');
console.log('');

// Check environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'MAIN_BACKEND_URL', 
  'ADMIN_API_KEY',
  'AUTHORIZED_USERS'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  console.log('');
  console.log('💡 Set them in your environment or use the Secrets tab in Replit');
  console.log('');
  console.log('Example:');
  console.log('export TELEGRAM_BOT_TOKEN="your_bot_token"');
  console.log('export AUTHORIZED_USERS="your_username"');
  console.log('export MAIN_BACKEND_URL="https://your-backend.onrender.com"');
  console.log('export ADMIN_API_KEY="your-admin-key"');
  console.log('');
  process.exit(1);
}

// Start the bot
require('./telegram-license-bot.js');
