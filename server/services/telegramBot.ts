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

    // /start - Welcome message
    this.bot.onText(/\/start/, async (msg: Message) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🔐 *Email Sender License Bot*

Welcome! I can help you generate license keys.

*Available Commands:*
/generate - Generate a new license key
/generate30 - Generate a 30-day license
/generate90 - Generate a 90-day license
/generate365 - Generate a 1-year license
/generatepermanent - Generate a permanent license
/status <key> - Check license status
/deactivate <key> - Deactivate a license
/help - Show this message
      `;

      this.bot?.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // /help - Show commands
    this.bot.onText(/\/help/, async (msg: Message) => {
      const chatId = msg.chat.id;
      const helpMessage = `
*License Generation Commands:*

/generate - Generate permanent license
/generate30 - 30 days expiration
/generate90 - 90 days expiration  
/generate365 - 1 year expiration
/generatepermanent - Never expires

*License Management:*

/status <key> - Check if license is valid
/deactivate <key> - Deactivate a license

*Examples:*
\`/generate\` - Creates permanent license
\`/generate30\` - Creates 30-day license
\`/status abc123-xyz789\` - Checks license status
      `;

      this.bot?.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // /generate - Generate permanent license
    this.bot.onText(/\/generate$/, async (msg: Message) => {
      await this.generateLicense(msg.chat.id);
    });

    // /generatepermanent - Generate permanent license
    this.bot.onText(/\/generatepermanent/, async (msg: Message) => {
      await this.generateLicense(msg.chat.id);
    });

    // /generate30 - Generate 30-day license
    this.bot.onText(/\/generate30/, async (msg: Message) => {
      await this.generateLicense(msg.chat.id, 30);
    });

    // /generate90 - Generate 90-day license
    this.bot.onText(/\/generate90/, async (msg: Message) => {
      await this.generateLicense(msg.chat.id, 90);
    });

    // /generate365 - Generate 1-year license
    this.bot.onText(/\/generate365/, async (msg: Message) => {
      await this.generateLicense(msg.chat.id, 365);
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

    console.log('[TelegramBot] Commands registered');
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
