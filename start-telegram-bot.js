
#!/usr/bin/env node

// Load environment variables from .env.telegram
require('dotenv').config({ path: '.env.telegram' });

console.log('🚀 Starting Telegram License Bot...');
console.log('');

// Check environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'MAIN_BACKEND_URL', 
  'ADMIN_API_KEY'
];

console.log('📋 Environment check:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   • ${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
});

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('');
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  console.log('');
  console.log('💡 Check your .env.telegram file');
  process.exit(1);
}

console.log('');
console.log('✅ All environment variables loaded successfully');

// Start the bot
require('./telegram-license-bot.js');
