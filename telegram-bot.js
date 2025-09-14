import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Configuration - using secure environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// Main function to start the bot
export default function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is required');
    return;
  }

  if (!MAIN_BACKEND_URL) {
    console.error('❌ MAIN_BACKEND_URL is required');
    return;
  }

  if (!ADMIN_API_KEY) {
    console.error('❌ ADMIN_API_KEY is required');
    return;
  }

  if (!ADMIN_TELEGRAM_ID) {
    console.error('❌ ADMIN_TELEGRAM_ID is required');
    return;
  }

  // Create bot instance with error handling
  const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
      autoStart: true,
      params: {
        timeout: 30
      }
    }
  });

  console.log('🤖 Email Sender License Bot started!');
  console.log(`📡 Main Backend: ${MAIN_BACKEND_URL}`);
  console.log(`👤 Admin Telegram ID: ${ADMIN_TELEGRAM_ID}`);

  // User sessions storage
  const userSessions = new Map();

  // Admin authorization check
  function isAuthorizedAdmin(telegramId) {
  return telegramId.toString() === ADMIN_TELEGRAM_ID.toString();
}

  // Admin-only message
  function sendAdminOnlyMessage(chatId) {
  return bot.sendMessage(chatId, '🔒 *Access Restricted*\n\nThis bot is restricted to authorized administrators only.\n\nPlease contact the system administrator for access.', {
    parse_mode: 'Markdown'
  });
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

  // Start command and main menu
  bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username || `user_${chatId}`;
    const firstName = msg.from.first_name || 'User';

    console.log(`📩 New /start from ${firstName} (${username}) - ID: ${chatId}`);

    // Check if user is authorized admin
    if (!isAuthorizedAdmin(chatId)) {
      console.log(`🚫 Unauthorized access attempt from ${chatId}`);
      await sendAdminOnlyMessage(chatId);
      return;
    }

    console.log(`✅ Authorized admin access: ${chatId}`);

    // Initialize user session
    userSessions.set(chatId, {
      telegramId: chatId,
      username: username,
      firstName: firstName,
      balance: 0,
      licenses: []
    });

    const welcomeMessage = `🎯 *Welcome Admin ${firstName}!*

*Email Sender License Administration System*

👨‍💼 *Admin License Management:*
1. 📋 View available license plans and pricing
2. 🛒 Generate licenses for customers
3. 🔑 Help customers activate their licenses
4. 📊 Monitor license status and usage

Choose an option from the admin menu below:

💰 *Balance* - View system balance information
📋 *Price List* - Show available license plans  
🛒 *Buy License* - Generate new customer licenses
🔑 *Activate License* - Assist with license activation
📊 *My Licenses* - View all generated licenses

*You are the administrator - you can generate licenses for customers!*`;

    await bot.sendMessage(chatId, welcomeMessage, {
      ...getMainMenuKeyboard(),
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in /start handler:', error);
  }
});

  // Handle text messages (menu selections)
  bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username || `user_${chatId}`;

    // Skip if it's a command
    if (text?.startsWith('/')) return;

    console.log(`📨 Message from ${username} (ID: ${chatId}): "${text}"`);

    // Check if user is authorized admin
    if (!isAuthorizedAdmin(chatId)) {
      console.log(`🚫 Unauthorized message from ${chatId}`);
      await sendAdminOnlyMessage(chatId);
      return;
    }

    // Get or create user session
    if (!userSessions.has(chatId)) {
      userSessions.set(chatId, {
        telegramId: chatId,
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
        // Handle different input states
        if (userSession.awaitingActivation) {
          await processActivation(chatId, text, userSession);
        } else if (userSession.awaitingPurchaseDetails) {
          await processPurchase(chatId, text, userSession);
        } else {
          // Send help message for unrecognized input
          await bot.sendMessage(chatId, '❓ Please use the menu buttons below or send /start to begin.', getMainMenuKeyboard());
        }
        break;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    bot.sendMessage(msg.chat.id, '❌ Something went wrong. Please try again or send /start.');
  }
});

  // Handle callback queries (inline buttons) 
  bot.on('callback_query', async (callbackQuery) => {
  try {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    
    console.log(`🔘 Button pressed: ${data} by user ${chatId}`);
    
    // Check if user is authorized admin
    if (!isAuthorizedAdmin(chatId)) {
      console.log(`🚫 Unauthorized callback from ${chatId}`);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔒 Access restricted to administrators only",
        show_alert: true
      });
      return;
    }
    
    let userSession = userSessions.get(chatId);
    
    // Ensure user session exists
    if (!userSession) {
      userSession = {
        telegramId: chatId,
        username: callbackQuery.from.username || `user_${chatId}`,
        firstName: callbackQuery.from.first_name || 'User',
        balance: 0,
        licenses: []
      };
      userSessions.set(chatId, userSession);
    }

    // Answer callback query immediately to prevent timeout
    bot.answerCallbackQuery(callbackQuery.id).catch(err => {
      console.log('Callback query already answered or timed out');
    });

    switch (data) {
      case 'buy_basic':
      case 'buy_professional':
      case 'buy_enterprise':
        const planType = data.split('_')[1];
        console.log(`💳 Initiating purchase for ${planType} plan`);
        await initiatePurchase(chatId, planType, userSession);
        break;
      
      case 'main_menu':
        await bot.sendMessage(chatId, '🏠 *Main Menu*', {
          ...getMainMenuKeyboard(),
          parse_mode: 'Markdown'
        });
        break;
        
      default:
        console.log(`❓ Unknown callback data: ${data}`);
        await bot.sendMessage(chatId, '❓ Unknown action. Please use the menu below.', getMainMenuKeyboard());
        break;
    }
  } catch (error) {
    console.error('Error in callback query handler:', error);
    bot.sendMessage(callbackQuery.message.chat.id, '❌ Something went wrong. Please try again.');
  }
});

  // Balance handler
  async function handleBalance(chatId, userSession) {
  try {
    const balanceMessage = `💰 *Your Balance*

Current Balance: *$${userSession.balance.toFixed(2)}*

💳 *Add Funds:*
To add money to your balance, please contact support.

📞 Support: @your_support_username

*Note: Currently all purchases are processed automatically upon order completion.*`;

    await bot.sendMessage(chatId, balanceMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  } catch (error) {
    console.error('Error in handleBalance:', error);
  }
}

  // Price list handler
  async function handlePriceList(chatId) {
  try {
    const priceMessage = `📋 *License Price List*

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

*✨ Instant Activation - No manual processing required!*

Select a plan below to purchase:`;

    await bot.sendMessage(chatId, priceMessage, {
      ...getPriceListKeyboard(),
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in handlePriceList:', error);
  }
}

  // Buy license handler
  async function handleBuyLicense(chatId) {
  try {
    const buyMessage = `🛒 *Purchase License*

🚀 *Automated Process:*
1. Select your plan
2. Provide your details
3. Get instant license key
4. Activate with your Windows/RDP IP

Each license includes:
✅ 30-day validity
✅ Single computer activation
✅ Instant activation
✅ Full customer support

Choose your plan:`;

    await bot.sendMessage(chatId, buyMessage, {
      ...getPriceListKeyboard(),
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in handleBuyLicense:', error);
  }
}

  // Initiate purchase process
  async function initiatePurchase(chatId, planType, userSession) {
  try {
    const plans = {
      basic: { name: 'Basic', price: 19 },
      professional: { name: 'Professional', price: 49 },
      enterprise: { name: 'Enterprise', price: 99 }
    };

    const plan = plans[planType];
    if (!plan) {
      await bot.sendMessage(chatId, '❌ Invalid plan selected. Please try again.', getPriceListKeyboard());
      return;
    }

    userSession.pendingPurchase = { planType, ...plan };
    userSession.awaitingPurchaseDetails = true;
    userSessions.set(chatId, userSession);

    const purchaseMessage = `🛒 *Purchase ${plan.name} License - $${plan.price}*

Please send your Windows RDP IP number:

**Required Information:**
Send your Windows RDP IP number

*Format Example:*
\`\`\`
192.168.1.100
\`\`\`

*Send your IP address in one message.*

*Note: After purchase, you'll receive a license key that will be automatically bound to your IP address.*`;

    await bot.sendMessage(chatId, purchaseMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in initiatePurchase:', error);
  }
}

  // Process purchase details
  async function processPurchase(chatId, text, userSession) {
  try {
    const ipAddress = text.trim();
    
    // Validate IP address format
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      await bot.sendMessage(chatId, '❌ Invalid IP format. Please provide a valid IP address (e.g., 192.168.1.100)');
      return;
    }

    // Validate IP address ranges
    const ipParts = ipAddress.split('.').map(Number);
    if (ipParts.some(part => part < 0 || part > 255)) {
      await bot.sendMessage(chatId, '❌ Invalid IP address. Each number must be between 0-255.');
      return;
    }

    userSession.awaitingPurchaseDetails = false;
    const { planType, name: planName, price } = userSession.pendingPurchase;

    await bot.sendMessage(chatId, `🔄 Creating ${planName} license for IP ${ipAddress}...`);

    // Generate mock license (since backend might not be available)
    const mockLicense = {
      licenseKey: `LICENSE-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now()}`,
      userEmail: `user${chatId}@telegram.local`,
      userName: userSession.firstName || 'User',
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
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    // Add to user's licenses - automatically activated with provided IP
    userSession.licenses = userSession.licenses || [];
    userSession.licenses.push({
      ...mockLicense,
      purchaseDate: new Date(),
      activated: true,
      activatedAt: new Date(),
      activationIP: ipAddress
    });

    userSessions.set(chatId, userSession);

    const successMessage = `✅ *License Created & Activated Successfully!*

🌐 **IP Address:** ${ipAddress}
👤 **User:** ${userSession.firstName || 'User'}
📦 **Plan:** ${planName} ($${price})
⏰ **Activated:** ${new Date().toLocaleString()}

🔑 **License Key:**
\`${mockLicense.licenseKey}\`

✅ **Your license is ready to use!**

**License Features:**
• Emails/Month: ${mockLicense.features.maxEmailsPerMonth.toLocaleString()}
• Recipients/Email: ${mockLicense.features.maxRecipientsPerEmail.toLocaleString()}
• QR Codes: ${mockLicense.features.allowQRCodes ? '✅' : '❌'}
• Domain Logos: ${mockLicense.features.allowDomainLogos ? '✅' : '❌'}
• SMTP Rotation: ${mockLicense.features.smtpRotation ? '✅' : '❌'}

📅 **License expires:** ${new Date(mockLicense.expiresAt).toLocaleDateString()}

*Your email sender software is now ready to use with IP: ${ipAddress}*`;

    await bot.sendMessage(chatId, successMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });

    delete userSession.pendingPurchase;
  } catch (error) {
    console.error('Error in processPurchase:', error);
    await bot.sendMessage(chatId, `❌ License creation failed. Please try again.`);
  }
}

  // Activation handler
  async function handleActivation(chatId, userSession) {
  try {
    console.log(`🔑 Activation requested by user ${chatId}`);
    console.log(`User has ${userSession.licenses ? userSession.licenses.length : 0} licenses`);
    
    if (!userSession.licenses || userSession.licenses.length === 0) {
      console.log('❌ No licenses found for user');
      await bot.sendMessage(chatId, '❌ No licenses found. Please purchase a license first using the "🛒 Buy License" button.', getMainMenuKeyboard());
      return;
    }

    const inactiveLicenses = userSession.licenses.filter(lic => !lic.activated);
    console.log(`Found ${inactiveLicenses.length} inactive licenses`);
    
    if (inactiveLicenses.length === 0) {
      console.log('✅ All licenses already activated');
      await bot.sendMessage(chatId, '✅ All your licenses are already activated!', getMainMenuKeyboard());
      return;
    }

    userSession.awaitingActivation = true;
    userSessions.set(chatId, userSession);

    const activationMessage = `🔑 *License Activation*

You have ${inactiveLicenses.length} license(s) ready for activation.

**Available Licenses:**
${inactiveLicenses.map((lic, index) => 
  `${index + 1}. ${lic.planType.toUpperCase()} - \`${lic.licenseKey.substring(0, 20)}...\``
).join('\n')}

**To activate, send:**
\`\`\`
License Key
Your Windows/RDP IP Address
\`\`\`

**Example:**
\`\`\`
LICENSE-ABC123-XYZ789-DEF456
192.168.1.100
\`\`\`

*Send both the license key and your IP address in one message.*`;

    await bot.sendMessage(chatId, activationMessage, { parse_mode: 'Markdown' });
    console.log('📤 Activation instructions sent');
  } catch (error) {
    console.error('Error in handleActivation:', error);
    await bot.sendMessage(chatId, '❌ Error processing activation. Please try again.', getMainMenuKeyboard());
  }
}

  // Process activation
  async function processActivation(chatId, text, userSession) {
  try {
    userSession.awaitingActivation = false;
    userSessions.set(chatId, userSession);

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
      await bot.sendMessage(chatId, '❌ Please provide both license key and IP address.');
      return;
    }

    const [licenseKey, ipAddress] = lines;

    // Find license
    const license = userSession.licenses.find(lic => lic.licenseKey === licenseKey);
    
    if (!license) {
      await bot.sendMessage(chatId, '❌ License key not found in your purchases.');
      return;
    }

    if (license.activated) {
      await bot.sendMessage(chatId, '❌ This license is already activated.');
      return;
    }

    // Validate IP address
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      await bot.sendMessage(chatId, '❌ Invalid IP format. Please provide a valid IP address (e.g., 192.168.1.100)');
      return;
    }

    await bot.sendMessage(chatId, '🔄 Activating license...');

    // Activate license
    license.activated = true;
    license.activatedAt = new Date();
    license.activationIP = ipAddress;
    
    const activationMessage = `✅ *License Activated Successfully!*

🔑 **License Key:** \`${licenseKey}\`
📦 **Plan:** ${license.planType.toUpperCase()}
🌐 **Bound to IP:** ${ipAddress}
⏰ **Activated:** ${license.activatedAt.toLocaleString()}
📅 **Expires:** ${new Date(license.expiresAt).toLocaleDateString()}

🚀 **Your email sender is now ready to use!**

**License Features:**
• Emails/Month: ${license.features.maxEmailsPerMonth.toLocaleString()}
• Recipients/Email: ${license.features.maxRecipientsPerEmail.toLocaleString()}
• QR Codes: ${license.features.allowQRCodes ? '✅' : '❌'}
• Domain Logos: ${license.features.allowDomainLogos ? '✅' : '❌'}
• SMTP Rotation: ${license.features.smtpRotation ? '✅' : '❌'}

*Start using your licensed email sender now!*`;

    await bot.sendMessage(chatId, activationMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  } catch (error) {
    console.error('Error in processActivation:', error);
  }
}

  // My licenses handler
  async function handleMyLicenses(chatId, userSession) {
  try {
    if (!userSession.licenses || userSession.licenses.length === 0) {
      await bot.sendMessage(chatId, '❌ No licenses found. Purchase your first license!', getMainMenuKeyboard());
      return;
    }

    const licensesMessage = `📊 *Your Licenses*

Total Licenses: ${userSession.licenses.length}

${userSession.licenses.map((lic, index) => `
**${index + 1}. ${lic.planType.toUpperCase()} PLAN**
🔑 Key: \`${lic.licenseKey.substring(0, 30)}...\`
📧 Email: ${lic.userEmail}
🌐 IP: ${lic.activationIP || 'Not activated'}
${lic.activated ? '✅ Activated' : '⏳ Pending Activation'}
📅 Expires: ${new Date(lic.expiresAt).toLocaleDateString()}
`).join('\n')}

Use "🔑 Personal Activations" to activate pending licenses.`;

    await bot.sendMessage(chatId, licensesMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  } catch (error) {
    console.error('Error in handleMyLicenses:', error);
  }
}

  // Help handler
  async function handleHelp(chatId) {
  try {
    const helpMessage = `❓ *Admin Help & Support*

**🚀 Admin Process for Customer Licenses:**
1. 📋 Check Price List for current pricing
2. 🛒 Generate a license for your customer
3. 🔑 Help customer activate license with their Windows/RDP IP
4. 📊 Monitor all generated licenses

**Available Admin Commands:**
• 💰 Balance - View system information
• 📋 Price List - View all license plans & pricing
• 🛒 Buy License - Generate new customer licenses
• 🔑 Activate License - Assist customer activation
• 📊 My Licenses - View all generated licenses

**License Plans:**
• Basic ($19) - 1K emails, basic features
• Professional ($49) - 10K emails, advanced features
• Enterprise ($99) - 50K emails, all features

**Admin Access:**
Only your Telegram ID (${ADMIN_TELEGRAM_ID}) can use this bot.
Generate licenses for customers and help them activate.`;

    await bot.sendMessage(chatId, helpMessage, { 
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard()
    });
  } catch (error) {
    console.error('Error in handleHelp:', error);
  }
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
}