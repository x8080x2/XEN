
#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Get from @BotFather
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || 'https://your-main-backend.onrender.com';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-api-key-2024';
const AUTHORIZED_USERS = process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : ['your_telegram_username'];

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram License Bot started!');
console.log(`📡 Main Backend: ${MAIN_BACKEND_URL}`);
console.log(`👥 Authorized Users: ${AUTHORIZED_USERS.join(', ')}`);

// Helper function to check if user is authorized
function isAuthorized(username) {
  return AUTHORIZED_USERS.includes(username);
}

// Helper function to generate license
async function generateLicense(userEmail, userName, planType = 'professional') {
  try {
    const licenseData = {
      userId: `user-${Date.now()}`,
      userEmail: userEmail,
      userName: userName,
      planType: planType,
      features: {
        maxEmailsPerMonth: planType === 'basic' ? 1000 : planType === 'professional' ? 10000 : 50000,
        maxRecipientsPerEmail: planType === 'basic' ? 100 : planType === 'professional' ? 500 : 2000,
        allowQRCodes: planType !== 'basic',
        allowAttachments: true,
        allowDomainLogos: planType !== 'basic',
        allowHTMLConvert: true,
        smtpRotation: planType === 'enterprise',
        apiAccess: planType === 'enterprise',
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      maxActivations: 1
    };

    const response = await axios.post(
      `${MAIN_BACKEND_URL}/api/license/create`,
      licenseData,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return response.data.license;
  } catch (error) {
    console.error('License creation error:', error.response?.data || error.message);
    throw error;
  }
}

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!isAuthorized(username)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
    return;
  }

  const welcomeMessage = `
🤖 *Email Sender License Bot*

Welcome! You can use this bot to generate license keys for the Email Sender application.

*Available Commands:*
/create - Create a new license
/help - Show this help message
/status - Check bot status

*Usage:*
\`/create user@example.com "John Doe" professional\`

*Available Plans:*
• basic - $19/month (1K emails, 100 recipients)
• professional - $49/month (10K emails, 500 recipients) 
• enterprise - $99/month (50K emails, 2K recipients)
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!isAuthorized(username)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
    return;
  }

  const helpMessage = `
📖 *Help - License Generation*

*Create License Command:*
\`/create <email> "<name>" [plan]\`

*Examples:*
\`/create john@company.com "John Smith" professional\`
\`/create jane@startup.com "Jane Doe" basic\`
\`/create admin@corp.com "Admin User" enterprise\`

*Plans Available:*
• \`basic\` - 1,000 emails/month, 100 recipients/email
• \`professional\` - 10,000 emails/month, 500 recipients/email
• \`enterprise\` - 50,000 emails/month, 2,000 recipients/email

*Notes:*
• Default plan is 'professional' if not specified
• Each license expires in 30 days
• Each license can only be activated on 1 computer
• Quotes around name are required if it contains spaces
  `;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Status command
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!isAuthorized(username)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
    return;
  }

  bot.sendMessage(chatId, '🔄 Checking backend status...');

  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/health`, {
      timeout: 5000
    });

    const statusMessage = `
✅ *Backend Status: Online*

🌐 Backend URL: \`${MAIN_BACKEND_URL}\`
📊 Status: ${response.data.status || 'OK'}
⏰ Response Time: ${response.data.timestamp ? new Date(response.data.timestamp).toLocaleString() : 'N/A'}
🔧 Bot Version: 1.0.0
    `;

    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Backend is offline or unreachable\n\`${error.message}\``, { parse_mode: 'Markdown' });
  }
});

// Create license command
bot.onText(/\/create (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!isAuthorized(username)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
    return;
  }

  const params = match[1].trim();
  
  // Parse parameters: email "name" [plan]
  const regex = /^([^\s]+)\s+"([^"]+)"(?:\s+(\w+))?$/;
  const paramMatch = params.match(regex);

  if (!paramMatch) {
    bot.sendMessage(chatId, `
❌ *Invalid format!*

*Correct usage:*
\`/create email "Full Name" [plan]\`

*Example:*
\`/create john@company.com "John Smith" professional\`
    `, { parse_mode: 'Markdown' });
    return;
  }

  const [, email, name, plan = 'professional'] = paramMatch;

  // Validate plan
  if (!['basic', 'professional', 'enterprise'].includes(plan)) {
    bot.sendMessage(chatId, '❌ Invalid plan! Use: basic, professional, or enterprise');
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    bot.sendMessage(chatId, '❌ Invalid email format!');
    return;
  }

  bot.sendMessage(chatId, `🔄 Creating ${plan} license for *${name}* (${email})...`, { parse_mode: 'Markdown' });

  try {
    const license = await generateLicense(email, name, plan);

    const successMessage = `
✅ *License Created Successfully!*

👤 **Customer:** ${name}
📧 **Email:** ${email}
📦 **Plan:** ${plan.charAt(0).toUpperCase() + plan.slice(1)}
🔑 **License Key:**
\`${license.licenseKey}\`

📊 **Plan Details:**
• Emails/Month: ${license.features.maxEmailsPerMonth.toLocaleString()}
• Recipients/Email: ${license.features.maxRecipientsPerEmail.toLocaleString()}
• QR Codes: ${license.features.allowQRCodes ? '✅' : '❌'}
• Domain Logos: ${license.features.allowDomainLogos ? '✅' : '❌'}
• SMTP Rotation: ${license.features.smtpRotation ? '✅' : '❌'}
• API Access: ${license.features.apiAccess ? '✅' : '❌'}

📅 **Expires:** ${new Date(license.expiresAt).toLocaleDateString()}
🖥️ **Max Activations:** ${license.maxActivations}

*Send this license key to your customer!*
    `;

    bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });

    // Log the creation
    console.log(`✅ License created: ${license.licenseKey} for ${email} (${plan})`);

  } catch (error) {
    console.error('License creation failed:', error.message);
    bot.sendMessage(chatId, `❌ *License creation failed!*\n\n\`${error.message}\``, { parse_mode: 'Markdown' });
  }
});

// Handle unknown commands
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const text = msg.text;

  // Skip if it's a known command or not a command
  if (!text || !text.startsWith('/') || text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/status') || text.startsWith('/create')) {
    return;
  }

  if (!isAuthorized(username)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
    return;
  }

  bot.sendMessage(chatId, `
❓ *Unknown command: ${text}*

Use /help to see available commands.
  `, { parse_mode: 'Markdown' });
});

// Error handling
bot.on('error', (error) => {
  console.error('❌ Telegram Bot Error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling Error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Telegram bot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('✅ Bot is ready! Send /start to begin.');
