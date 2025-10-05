import TelegramBot from 'node-telegram-bot-api';
import { licenseService } from './licenseService';

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isInitialized = false;
  private adminChatIds: Set<number> = new Set();

  initialize(token: string, adminChatIds?: string): boolean {
    try {
      if (this.isInitialized) {
        console.log('Telegram bot already initialized');
        return true;
      }

      this.bot = new TelegramBot(token, { polling: true });
      
      if (adminChatIds) {
        const ids = adminChatIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        this.adminChatIds = new Set(ids);
        console.log(`✅ Telegram bot admin access configured for ${ids.length} user(s)`);
      } else {
        console.warn('⚠️  WARNING: No admin chat IDs configured! Bot commands will be restricted.');
      }
      
      this.setupCommands();
      this.isInitialized = true;
      console.log('✅ Telegram bot initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      return false;
    }
  }

  private isAdmin(userId: number): boolean {
    if (this.adminChatIds.size === 0) {
      return false;
    }
    return this.adminChatIds.has(userId);
  }

  private async checkAdminAccess(msg: TelegramBot.Message): Promise<boolean> {
    const userId = msg.from?.id;
    
    if (!userId) {
      return false;
    }

    if (!this.isAdmin(userId)) {
      await this.bot?.sendMessage(
        msg.chat.id,
        '❌ Access Denied\n\n' +
        'You are not authorized to use this bot.\n\n' +
        `Your Telegram ID: ${userId}\n\n` +
        'Please contact the administrator to request access.'
      );
      console.log(`[Telegram Bot] Unauthorized access attempt from user ${userId} (@${msg.from?.username || 'unknown'})`);
      return false;
    }

    return true;
  }

  private setupCommands() {
    if (!this.bot) return;

    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username || 'Unknown';
      
      await this.bot?.sendMessage(
        chatId,
        `👋 Welcome to the Email Sender License Bot!\n\n` +
        `Available commands:\n` +
        `/generate <days> - Generate a new license (e.g., /generate 30 for 30 days, or /generate for lifetime)\n` +
        `/status <key> - Check license status\n` +
        `/revoke <key> - Revoke a license\n` +
        `/mykeys - List all your license keys\n` +
        `/help - Show this help message`
      );
    });

    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      
      await this.bot?.sendMessage(
        chatId,
        `📖 Help - Available Commands:\n\n` +
        `🔑 /generate <days> - Generate a new license\n` +
        `   Examples:\n` +
        `   • /generate - Create a lifetime license\n` +
        `   • /generate 7 - Create a 7-day license\n` +
        `   • /generate 30 - Create a 30-day license\n\n` +
        `📊 /status <key> - Check license status\n` +
        `   Example: /status ABC123DEF456\n\n` +
        `❌ /revoke <key> - Revoke a license\n` +
        `   Example: /revoke ABC123DEF456\n\n` +
        `📋 /mykeys - List all your generated licenses`
      );
    });

    this.bot.onText(/\/generate(.*)/, async (msg, match) => {
      if (!await this.checkAdminAccess(msg)) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString() || '';
      const username = msg.from?.username || 'Unknown';
      
      const args = match?.[1]?.trim();
      const durationDays = args ? parseInt(args) : undefined;

      if (args && (isNaN(durationDays!) || durationDays! <= 0)) {
        await this.bot?.sendMessage(
          chatId,
          '❌ Invalid duration. Please provide a positive number of days or leave empty for a lifetime license.\n\n' +
          'Examples:\n' +
          '• /generate - Lifetime license\n' +
          '• /generate 7 - 7 days\n' +
          '• /generate 30 - 30 days'
        );
        return;
      }

      try {
        const license = await licenseService.createLicense(userId, username, durationDays);
        
        const expiryText = license.expiresAt 
          ? `Expires: ${license.expiresAt.toLocaleDateString()}`
          : 'Lifetime license';

        await this.bot?.sendMessage(
          chatId,
          `✅ License Generated Successfully!\n\n` +
          `🔑 License Key: \`${license.licenseKey}\`\n` +
          `👤 User: @${username}\n` +
          `📅 ${expiryText}\n\n` +
          `⚠️ Important:\n` +
          `1. Save this license key securely\n` +
          `2. Add it to your .env file as: LICENSE_KEY=${license.licenseKey}\n` +
          `3. Restart your desktop app after adding the key`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error generating license:', error);
        await this.bot?.sendMessage(
          chatId,
          '❌ Failed to generate license. Please try again later.'
        );
      }
    });

    this.bot.onText(/\/status(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const licenseKey = match?.[1]?.trim();

      if (!licenseKey) {
        await this.bot?.sendMessage(
          chatId,
          '❌ Please provide a license key.\n\nExample: /status ABC123DEF456'
        );
        return;
      }

      try {
        const result = await licenseService.verifyLicense(licenseKey);
        
        if (!result.valid) {
          await this.bot?.sendMessage(
            chatId,
            `❌ License Status: Invalid\n\n` +
            `Reason: ${result.reason}\n\n` +
            `License Key: \`${licenseKey}\``,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const license = result.license!;
        const expiryText = license.expiresAt 
          ? `Expires: ${license.expiresAt.toLocaleDateString()}`
          : 'Lifetime license';

        await this.bot?.sendMessage(
          chatId,
          `✅ License Status: Valid\n\n` +
          `🔑 Key: \`${license.licenseKey}\`\n` +
          `👤 User: @${license.telegramUsername || 'Unknown'}\n` +
          `📅 ${expiryText}\n` +
          `🟢 Status: ${license.status}\n` +
          `📆 Created: ${license.createdAt.toLocaleDateString()}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error checking license status:', error);
        await this.bot?.sendMessage(
          chatId,
          '❌ Failed to check license status. Please try again later.'
        );
      }
    });

    this.bot.onText(/\/revoke(.*)/, async (msg, match) => {
      if (!await this.checkAdminAccess(msg)) return;

      const chatId = msg.chat.id;
      const licenseKey = match?.[1]?.trim();

      if (!licenseKey) {
        await this.bot?.sendMessage(
          chatId,
          '❌ Please provide a license key.\n\nExample: /revoke ABC123DEF456'
        );
        return;
      }

      try {
        const license = await licenseService.revokeLicense(licenseKey);
        
        if (!license) {
          await this.bot?.sendMessage(
            chatId,
            `❌ License not found.\n\nLicense Key: \`${licenseKey}\``,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        await this.bot?.sendMessage(
          chatId,
          `✅ License Revoked Successfully\n\n` +
          `🔑 Key: \`${license.licenseKey}\`\n` +
          `👤 User: @${license.telegramUsername || 'Unknown'}\n\n` +
          `This license can no longer be used.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error revoking license:', error);
        await this.bot?.sendMessage(
          chatId,
          '❌ Failed to revoke license. Please try again later.'
        );
      }
    });

    this.bot.onText(/\/mykeys/, async (msg) => {
      if (!await this.checkAdminAccess(msg)) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString() || '';

      try {
        const allLicenses = await licenseService.getAllLicenses();
        const userLicenses = allLicenses.filter(l => l.telegramUserId === userId);

        if (userLicenses.length === 0) {
          await this.bot?.sendMessage(
            chatId,
            '📋 You have no generated licenses yet.\n\nUse /generate to create a new license.'
          );
          return;
        }

        const licenseList = userLicenses.map((license, index) => {
          const expiryText = license.expiresAt 
            ? `Expires: ${license.expiresAt.toLocaleDateString()}`
            : 'Lifetime';
          const statusIcon = license.status === 'active' ? '🟢' : license.status === 'expired' ? '🟡' : '🔴';
          
          return `${index + 1}. ${statusIcon} \`${license.licenseKey}\`\n   ${expiryText} | Status: ${license.status}`;
        }).join('\n\n');

        await this.bot?.sendMessage(
          chatId,
          `📋 Your Licenses (${userLicenses.length}):\n\n${licenseList}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error fetching user licenses:', error);
        await this.bot?.sendMessage(
          chatId,
          '❌ Failed to fetch your licenses. Please try again later.'
        );
      }
    });

    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });
  }

  isRunning(): boolean {
    return this.isInitialized && this.bot !== null;
  }

  stop() {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
      this.isInitialized = false;
      console.log('Telegram bot stopped');
    }
  }
}

export const telegramBotService = new TelegramBotService();
