import TelegramBot, { type Message } from 'node-telegram-bot-api';
import { licenseService } from './licenseService';
import { randomBytes } from 'crypto';

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isInitialized = false;

  initialize(token: string) {
    if (!token) {
      console.log('[TelegramBot] No token provided, bot will not start');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      this.setupCommands();
      this.isInitialized = true;
      console.log('[TelegramBot] ✅ Bot initialized and polling started');
    } catch (error) {
      console.error('[TelegramBot] Failed to initialize:', error);
    }
  }

  private setupCommands() {
    if (!this.bot) return;

    // /start - Welcome message with buttons
    this.bot.onText(/\/start/, async (msg: Message) => {
      await this.showMainMenu(msg.chat.id);
    });

    // /help - Show main menu
    this.bot.onText(/\/help/, async (msg: Message) => {
      await this.showMainMenu(msg.chat.id);
    });

    // /menu - Show main menu
    this.bot.onText(/\/menu/, async (msg: Message) => {
      await this.showMainMenu(msg.chat.id);
    });

    // Handle callback queries from inline buttons
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId || !data) return;

      // Answer callback query to remove loading state
      await this.bot?.answerCallbackQuery(query.id);

      // Handle different callback actions
      if (data === 'generate_menu') {
        await this.showGenerateMenu(chatId);
      } else if (data === 'manage_menu') {
        await this.showManageMenu(chatId);
      } else if (data === 'back_main') {
        await this.showMainMenu(chatId);
      } else if (data.startsWith('gen_')) {
        // Generate license based on duration
        const duration = data.replace('gen_', '');
        if (duration === 'permanent') {
          await this.generateLicense(chatId);
        } else {
          await this.generateLicense(chatId, parseInt(duration));
        }
        // Show main menu again after generation
        setTimeout(() => this.showMainMenu(chatId), 2000);
      } else if (data === 'check_status') {
        await this.bot?.sendMessage(chatId, '📋 To check a license status, send:\n\n`/status YOUR-LICENSE-KEY`\n\nExample:\n`/status ABC123-XYZ789-DEF456`', { parse_mode: 'Markdown' });
      } else if (data === 'deactivate_license') {
        await this.bot?.sendMessage(chatId, '🔒 To deactivate a license, send:\n\n`/deactivate YOUR-LICENSE-KEY`\n\nExample:\n`/deactivate ABC123-XYZ789-DEF456`', { parse_mode: 'Markdown' });
      } else if (data === 'help_info') {
        await this.showHelpInfo(chatId);
      }
    });

    // /status <key> - Check license status
    this.bot.onText(/\/status (.+)/, async (msg: Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const licenseKey = match?.[1]?.trim();

      if (!licenseKey) {
        this.bot?.sendMessage(chatId, '❌ Please provide a license key.\n\nUsage: /status <license-key>');
        return;
      }

      try {
        const result = await licenseService.verifyLicense(licenseKey);
        
        if (result.valid) {
          const expiryText = result.license?.expiresAt 
            ? `Expires: ${new Date(result.license.expiresAt).toLocaleDateString()}`
            : 'Never expires';
          
          const lastValidatedText = result.license?.lastValidated
            ? `Last used: ${new Date(result.license.lastValidated).toLocaleDateString()}`
            : 'Never used';

          const statusMessage = `
✅ *License Valid*

Key: \`${licenseKey}\`
Status: Active
${expiryText}
${lastValidatedText}
          `;

          this.bot?.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
        } else {
          this.bot?.sendMessage(chatId, `❌ *License Invalid*\n\n${result.message}`, { parse_mode: 'Markdown' });
        }
      } catch (error) {
        console.error('[TelegramBot] Status check error:', error);
        this.bot?.sendMessage(chatId, '❌ Error checking license status');
      }
    });

    // /deactivate <key> - Deactivate a license
    this.bot.onText(/\/deactivate (.+)/, async (msg: Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const licenseKey = match?.[1]?.trim();

      if (!licenseKey) {
        this.bot?.sendMessage(chatId, '❌ Please provide a license key.\n\nUsage: /deactivate <license-key>');
        return;
      }

      try {
        const success = await licenseService.deactivateLicense(licenseKey);
        
        if (success) {
          this.bot?.sendMessage(chatId, `✅ License \`${licenseKey}\` has been deactivated.`, { parse_mode: 'Markdown' });
        } else {
          this.bot?.sendMessage(chatId, '❌ Failed to deactivate license. License not found.');
        }
      } catch (error) {
        console.error('[TelegramBot] Deactivation error:', error);
        this.bot?.sendMessage(chatId, '❌ Error deactivating license');
      }
    });

    console.log('[TelegramBot] Commands and callback handlers registered');
  }

  private async showMainMenu(chatId: number) {
    const message = `
🔐 *Email Sender License Bot*

Welcome! Choose an option below to get started.

*What would you like to do?*
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✨ Generate New License', callback_data: 'generate_menu' }
        ],
        [
          { text: '📋 Manage Licenses', callback_data: 'manage_menu' }
        ],
        [
          { text: '❓ Help & Info', callback_data: 'help_info' }
        ]
      ]
    };

    await this.bot?.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async showGenerateMenu(chatId: number) {
    const message = `
✨ *Generate New License*

Select the duration for your license key:
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔹 7 Days', callback_data: 'gen_7' },
          { text: '🔸 30 Days', callback_data: 'gen_30' }
        ],
        [
          { text: '🔶 90 Days', callback_data: 'gen_90' },
          { text: '🔷 180 Days', callback_data: 'gen_180' }
        ],
        [
          { text: '💎 1 Year', callback_data: 'gen_365' },
          { text: '♾️ Permanent', callback_data: 'gen_permanent' }
        ],
        [
          { text: '⬅️ Back to Main Menu', callback_data: 'back_main' }
        ]
      ]
    };

    await this.bot?.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async showManageMenu(chatId: number) {
    const message = `
📋 *Manage Licenses*

What would you like to do?
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Check License Status', callback_data: 'check_status' }
        ],
        [
          { text: '🔒 Deactivate License', callback_data: 'deactivate_license' }
        ],
        [
          { text: '⬅️ Back to Main Menu', callback_data: 'back_main' }
        ]
      ]
    };

    await this.bot?.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async showHelpInfo(chatId: number) {
    const message = `
❓ *Help & Information*

*📝 How to Use:*

1️⃣ Click "Generate New License" to create a new license key
2️⃣ Select the duration you need (7 days to permanent)
3️⃣ Copy the license key you receive
4️⃣ Add it to your desktop app's .env file

*🔧 Setup Instructions:*

In your Email Sender Desktop app:
• Create/edit \`.env\` file
• Add: \`LICENSE_KEY=YOUR-KEY-HERE\`
• Run \`start-build.bat\`

*📱 Available Commands:*

\`/start\` - Main menu
\`/menu\` - Show main menu
\`/status <key>\` - Check license
\`/deactivate <key>\` - Deactivate license

*🎯 License Types:*

🔹 7 Days - Trial/Testing
🔸 30 Days - Monthly subscription
🔶 90 Days - Quarterly
🔷 180 Days - Semi-annual
💎 1 Year - Annual subscription
♾️ Permanent - Lifetime access

Need help? Contact support! 💬
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⬅️ Back to Main Menu', callback_data: 'back_main' }
        ]
      ]
    };

    await this.bot?.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async generateLicense(chatId: number, expirationDays?: number) {
    try {
      // Generate a unique license key
      const licenseKey = this.generateLicenseKey();

      // Calculate expiration date if provided
      const expiresAt = expirationDays 
        ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
        : undefined;

      // Create license in database
      const license = await licenseService.createLicense({
        licenseKey,
        isActive: true,
        expiresAt,
        metadata: {
          generatedBy: 'telegram_bot',
          chatId: chatId.toString(),
          generatedAt: new Date().toISOString()
        }
      });

      const expiryText = expiresAt 
        ? `Valid until: ${expiresAt.toLocaleDateString()}`
        : 'Never expires (Permanent)';

      const message = `
✅ *License Generated Successfully!*

🔑 License Key:
\`${licenseKey}\`

📋 Details:
${expiryText}
Status: Active

*Instructions:*
1. Copy the license key above
2. In your desktop app, create \`.env\` file
3. Add: \`LICENSE_KEY=${licenseKey}\`
4. Run \`start-build.bat\` to launch the app

Keep this key secure! ⚠️
      `;

      this.bot?.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      console.log(`[TelegramBot] License generated: ${licenseKey} (${expirationDays ? expirationDays + ' days' : 'permanent'})`);
    } catch (error) {
      console.error('[TelegramBot] License generation error:', error);
      this.bot?.sendMessage(chatId, '❌ Failed to generate license. Please try again.');
    }
  }

  private generateLicenseKey(): string {
    // Generate format: ABC123-XYZ789-DEF456-GHI012
    const segments = 4;
    const segmentLength = 6;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    const keySegments = [];
    for (let i = 0; i < segments; i++) {
      const bytes = randomBytes(segmentLength);
      let segment = '';
      for (let j = 0; j < segmentLength; j++) {
        segment += chars[bytes[j] % chars.length];
      }
      keySegments.push(segment);
    }
    
    return keySegments.join('-');
  }

  stop() {
    if (this.bot) {
      this.bot.stopPolling();
      console.log('[TelegramBot] Bot stopped');
    }
  }

  isRunning(): boolean {
    return this.isInitialized;
  }
}

export const telegramBotService = new TelegramBotService();
