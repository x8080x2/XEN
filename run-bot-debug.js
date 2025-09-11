// Set environment variables directly
process.env.TELEGRAM_BOT_TOKEN = '8240138674:AAE5InceD2XkMX2bBC-idSoLOPvqLjIFXx8';
process.env.MAIN_BACKEND_URL = 'https://email-sender-main.onrender.com';
process.env.ADMIN_API_KEY = 'admin-api-key-2024';

console.log('🚀 Starting DEBUG Telegram License Bot...');
console.log('📋 Environment variables set');
console.log('🐛 Debug mode enabled - verbose logging');
console.log('🔄 Loading bot...');

// Import and run the fixed bot
import('./telegram-bot-fixed.js');