
#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || 'https://your-main-backend.onrender.com';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-api-key-2024';
const AUTHORIZED_USERS = process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : ['your_telegram_username'];

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Email Sender License Bot started!');
console.log(`📡 Main Backend: ${MAIN_BACKEND_URL}`);
console.log(`👥 Authorized Users: ${AUTHORIZED_USERS.join(', ')}`);

// User sessions storage
const userSessions = new Map();

// Helper function to check if user is authorized
function isAuthorized(username) {
  return AUTHORIZED_USERS.includes(username);
}

// Create main menu keyboard
function getMainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '💰 Balance / Add $' }, { text: '📋 Price List $' }],
        [{ text: '🛒 Buy License / Increase Limit' }],
        [{ text: '🔑 Personal Activations / Activate License' }],
        [{ text: '📊 My Licenses' }, { text: '❓ Help' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Create price list keyboard
function getPriceListKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 Basic - $19/month', callback_data: 'buy_basic' }],
        [{ text: '🟡 Professional - $49/month', callback_data: 'buy_professional' }],
        [{ text: '🔴 Enterprise - $99/month', callback_data: 'buy_enterprise' }],
        [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
      ]
    }
  };
}

// Helper function to generate license
async function generateLicense(userEmail, userName, planType = 'professional', userId) {
  try {
    const licenseData = {
      userId: userId || `user-${Date.now()}`,
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
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

// Helper function to get user's IP
async function getUserIP(chatId) {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    return 'Unknown';
  }
}

// Start command and main menu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const firstName = msg.from.first_name || 'User';

  // Initialize user session
  userSessions.set(chatId, {
    username: username,
    firstName: firstName,
    balance: 0,
    licenses: []
  });

  const welcomeMessage = `
🎯 *Welcome ${firstName}!*

*Email Sender License System*

Choose an option from the menu below to get started:

💰 *Balance* - Check your current balance
📋 *Price List* - View available license plans  
🛒 *Buy License* - Purchase a new license
🔑 *Activate License* - Bind license to your computer
📊 *My Licenses* - View your active licenses

Need help? Just select Help from the menu!
  `;

  bot.sendMessage(chatId, welcomeMessage, {
    ...getMainMenuKeyboard(),
    parse_mode: 'Markdown'
  });
});

// Handle text messages (menu selections)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username;

  // Skip if it's a command
  if (text?.startsWith('/')) return;

  // Get or create user session
  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, {
      username: username,
      firstName: msg.from.first_name || 'User',
      balance: 0,
      licenses: []
    });
  }

  const userSession = userSessions.get(chatId);

  switch (text) {
    case '💰 Balance / Add $':
      await handleBalance(chatId, userSession);
      break;
    
    case '📋 Price List $':
      await handlePriceList(chatId);
      break;
    
    case '🛒 Buy License / Increase Limit':
      await handleBuyLicense(chatId);
      break;
    
    case '🔑 Personal Activations / Activate License':
      await handleActivation(chatId, userSession);
      break;
    
    case '📊 My Licenses':
      await handleMyLicenses(chatId, userSession);
      break;
    
    case '❓ Help':
      await handleHelp(chatId);
      break;
    
    default:
      // Handle activation states
      if (userSession.awaitingActivation) {
        await processActivation(chatId, text, userSession);
      } else if (userSession.awaitingPurchaseDetails) {
        await processPurchase(chatId, text, userSession);
      }
      break;
  }
});

// Handle callback queries (inline buttons)
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;
  const userSession = userSessions.get(chatId);

  bot.answerCallbackQuery(callbackQuery.id);

  switch (data) {
    case 'buy_basic':
    case 'buy_professional':
    case 'buy_enterprise':
      const planType = data.split('_')[1];
      await initiatePurchase(chatId, planType, userSession);
      break;
    
    case 'main_menu':
      bot.sendMessage(chatId, 'Main Menu', getMainMenuKeyboard());
      break;
  }
});

// Balance handler
async function handleBalance(chatId, userSession) {
  const balanceMessage = `
💰 *Your Balance*

Current Balance: *$${userSession.balance.toFixed(2)}*

💳 *Add Funds:*
To add money to your balance, please contact support with your payment details.

📞 Support: @your_support_username
  `;

  bot.sendMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
}

// Price list handler
async function handlePriceList(chatId) {
  const priceMessage = `
📋 *License Price List*

🟢 *BASIC PLAN - $19/month*
• 1,000 emails per month
• 100 recipients per email
• Basic features
• Email attachments

🟡 *PROFESSIONAL PLAN - $49/month*
• 10,000 emails per month
• 500 recipients per email
• QR code generation
• Domain logos
• All basic features

🔴 *ENTERPRISE PLAN - $99/month*
• 50,000 emails per month
• 2,000 recipients per email
• SMTP rotation
• API access
• All professional features

Select a plan below to purchase:
  `;

  bot.sendMessage(chatId, priceMessage, {
    ...getPriceListKeyboard(),
    parse_mode: 'Markdown'
  });
}

// Buy license handler
async function handleBuyLicense(chatId) {
  const buyMessage = `
🛒 *Purchase License*

Please select a plan to purchase:

Each license includes:
✅ 30-day validity
✅ Single computer activation
✅ Full customer support
✅ Instant activation

Choose your plan:
  `;

  bot.sendMessage(chatId, buyMessage, {
    ...getPriceListKeyboard(),
    parse_mode: 'Markdown'
  });
}

// Initiate purchase process
async function initiatePurchase(chatId, planType, userSession) {
  const plans = {
    basic: { name: 'Basic', price: 19 },
    professional: { name: 'Professional', price: 49 },
    enterprise: { name: 'Enterprise', price: 99 }
  };

  const plan = plans[planType];
  userSession.pendingPurchase = { planType, ...plan };
  userSession.awaitingPurchaseDetails = true;

  const purchaseMessage = `
🛒 *Purchase ${plan.name} License - $${plan.price}*

Please provide the following details:
1. Your full name
2. Your email address
3. Company name (optional)
4. Windows/RDP IP address for activation

*Format:*
Full Name
email@domain.com
Company Name (optional)
192.168.1.100

Send all details in one message:
  `;

  bot.sendMessage(chatId, purchaseMessage, { parse_mode: 'Markdown' });
}

// Process purchase details
async function processPurchase(chatId, text, userSession) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 3) {
    bot.sendMessage(chatId, '❌ Please provide at least: Full Name, Email, and IP Address');
    return;
  }

  const [fullName, email, companyOrIP, ip] = lines;
  const actualIP = ip || companyOrIP; // Handle optional company name
  const company = ip ? companyOrIP : 'Not specified';

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    bot.sendMessage(chatId, '❌ Invalid email format. Please try again.');
    return;
  }

  // Validate IP (basic check)
  const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(actualIP)) {
    bot.sendMessage(chatId, '❌ Invalid IP format. Please provide a valid IP address (e.g., 192.168.1.100)');
    return;
  }

  userSession.awaitingPurchaseDetails = false;
  const { planType, name: planName, price } = userSession.pendingPurchase;

  bot.sendMessage(chatId, `🔄 Creating ${planName} license for ${fullName}...`);

  try {
    // Create license
    const license = await generateLicense(
      email, 
      fullName, 
      planType, 
      `tg-${chatId}-${Date.now()}`
    );

    // Add to user's licenses
    userSession.licenses.push({
      ...license,
      purchaseDate: new Date(),
      activationIP: actualIP,
      company: company,
      activated: false
    });

    const successMessage = `
✅ *License Created Successfully!*

👤 **Customer:** ${fullName}
🏢 **Company:** ${company}
📧 **Email:** ${email}
🌐 **Activation IP:** ${actualIP}
📦 **Plan:** ${planName} ($${price})

🔑 **License Key:**
\`${license.licenseKey}\`

📋 **Next Steps:**
1. Save this license key
2. Use "Activate License" to bind it to your computer
3. Your license expires on: ${new Date(license.expiresAt).toLocaleDateString()}

💡 *Tip: Use the activation menu to complete the setup process!*
    `;

    bot.sendMessage(chatId, successMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });

  } catch (error) {
    bot.sendMessage(chatId, `❌ License creation failed: ${error.message}`);
  }

  delete userSession.pendingPurchase;
}

// Activation handler
async function handleActivation(chatId, userSession) {
  if (userSession.licenses.length === 0) {
    bot.sendMessage(chatId, '❌ No licenses found. Please purchase a license first.');
    return;
  }

  const inactiveLicenses = userSession.licenses.filter(lic => !lic.activated);
  
  if (inactiveLicenses.length === 0) {
    bot.sendMessage(chatId, '✅ All your licenses are already activated!');
    return;
  }

  userSession.awaitingActivation = true;

  const activationMessage = `
🔑 *License Activation*

You have ${inactiveLicenses.length} license(s) ready for activation.

Please send your license key to activate:

*Available Licenses:*
${inactiveLicenses.map((lic, index) => 
  `${index + 1}. ${lic.planType.toUpperCase()} - ${lic.licenseKey.substring(0, 20)}...`
).join('\n')}

Send the complete license key:
  `;

  bot.sendMessage(chatId, activationMessage, { parse_mode: 'Markdown' });
}

// Process activation
async function processActivation(chatId, licenseKey, userSession) {
  userSession.awaitingActivation = false;

  const license = userSession.licenses.find(lic => lic.licenseKey === licenseKey);
  
  if (!license) {
    bot.sendMessage(chatId, '❌ License key not found in your purchases.');
    return;
  }

  if (license.activated) {
    bot.sendMessage(chatId, '❌ This license is already activated.');
    return;
  }

  bot.sendMessage(chatId, '🔄 Activating license...');

  try {
    // Here you would normally validate with your backend
    // For now, we'll simulate activation
    license.activated = true;
    license.activatedAt = new Date();
    
    const activationMessage = `
✅ *License Activated Successfully!*

🔑 **License Key:** ${licenseKey}
📦 **Plan:** ${license.planType.toUpperCase()}
🌐 **Bound to IP:** ${license.activationIP}
⏰ **Activated:** ${license.activatedAt.toLocaleString()}
📅 **Expires:** ${new Date(license.expiresAt).toLocaleDateString()}

🚀 *Your email sender is now ready to use!*

**Email Limits:**
• Emails/Month: ${license.features.maxEmailsPerMonth.toLocaleString()}
• Recipients/Email: ${license.features.maxRecipientsPerEmail.toLocaleString()}
• QR Codes: ${license.features.allowQRCodes ? '✅' : '❌'}
• Domain Logos: ${license.features.allowDomainLogos ? '✅' : '❌'}

Start using your licensed email sender now!
    `;

    bot.sendMessage(chatId, activationMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });

  } catch (error) {
    bot.sendMessage(chatId, `❌ Activation failed: ${error.message}`);
  }
}

// My licenses handler
async function handleMyLicenses(chatId, userSession) {
  if (userSession.licenses.length === 0) {
    bot.sendMessage(chatId, '❌ No licenses found. Purchase your first license!');
    return;
  }

  const licensesMessage = `
📊 *Your Licenses*

Total Licenses: ${userSession.licenses.length}

${userSession.licenses.map((lic, index) => `
**${index + 1}. ${lic.planType.toUpperCase()} PLAN**
🔑 Key: \`${lic.licenseKey.substring(0, 30)}...\`
📧 Email: ${lic.userEmail}
🌐 IP: ${lic.activationIP}
${lic.activated ? '✅ Activated' : '⏳ Pending Activation'}
📅 Expires: ${new Date(lic.expiresAt).toLocaleDateString()}
`).join('\n')}

Use "Activate License" to activate pending licenses.
  `;

  bot.sendMessage(chatId, licensesMessage, { parse_mode: 'Markdown' });
}

// Help handler
async function handleHelp(chatId) {
  const helpMessage = `
❓ *Help & Support*

**Available Commands:**
• 💰 Balance - Check your account balance
• 📋 Price List - View all license plans
• 🛒 Buy License - Purchase new licenses
• 🔑 Activate License - Bind licenses to your computer
• 📊 My Licenses - View your license status

**License Plans:**
• Basic ($19) - 1K emails, basic features
• Professional ($49) - 10K emails, advanced features
• Enterprise ($99) - 50K emails, all features

**Activation Process:**
1. Purchase a license with your details
2. Provide your Windows/RDP IP address
3. Use "Activate License" to bind to your computer
4. Each license works on one computer only

**Support:**
For technical support or billing questions, contact:
📧 support@yourdomain.com
💬 @your_support_username

**Payment:**
Contact support for payment processing and balance top-ups.
  `;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
}

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
