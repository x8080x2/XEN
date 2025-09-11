// Load environment variables from .env.telegram
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

try {
  const envConfig = dotenv.parse(readFileSync('.env.telegram'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (error) {
  console.error('Could not load .env.telegram file:', error.message);
}

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
import './telegram-license-bot.js';