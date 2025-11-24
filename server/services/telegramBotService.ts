import TelegramBot from 'node-telegram-bot-api';
import { licenseService } from './licenseService';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

interface UserState {
  action?: 'awaiting_status_key' | 'awaiting_revoke_key' | 'awaiting_download_key';
}

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isInitialized = false;
  private adminChatIds: Set<number> = new Set();
  private userStates: Map<number, UserState> = new Map();
  private webhookUrl: string = '';

  async initialize(token: string, adminChatIds?: string, webhookUrl?: string): Promise<boolean> {
    try {
      if (this.isInitialized) {
        console.log('Telegram bot already initialized');
        return true;
      }

      // Initialize bot without polling (we'll use webhooks)
      this.bot = new TelegramBot(token, { polling: false });
      
      if (adminChatIds) {
        const ids = adminChatIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        this.adminChatIds = new Set(ids);
        console.log(`✅ Telegram bot admin access configured for ${ids.length} user(s)`);
      } else {
        console.warn('⚠️  WARNING: No admin chat IDs configured! Bot commands will be restricted.');
      }
      
      this.setupCommands();
      
      // Set up webhook if URL provided
      if (webhookUrl) {
        this.webhookUrl = webhookUrl;
        await this.setWebhook(webhookUrl);
      }
      
      this.isInitialized = true;
      console.log('✅ Telegram bot initialized successfully with webhooks');
      return true;
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      return false;
    }
  }

  private async setWebhook(url: string): Promise<void> {
    try {
      await this.bot?.setWebHook(url);
      console.log(`✅ Telegram webhook set to: ${url}`);
    } catch (error) {
      console.error('Failed to set Telegram webhook:', error);
      throw error;
    }
  }

  async processUpdate(update: any): Promise<void> {
    if (!this.bot) {
      console.error('Bot not initialized');
      return;
    }

    // Process the update through the bot's internal handler
    this.bot.processUpdate(update);
  }

  private isAdmin(userId: number): boolean {
    if (this.adminChatIds.size === 0) {
      return false;
    }
    return this.adminChatIds.has(userId);
  }

  private async checkAdminAccess(userId: number, chatId: number): Promise<boolean> {
    if (!userId) {
      return false;
    }

    if (!this.isAdmin(userId)) {
      await this.bot?.sendMessage(
        chatId,
        '❌ *Access Denied*\n\n' +
        'You are not authorized to use this bot.\n\n' +
        `Your Telegram ID: \`${userId}\`\n\n` +
        'Please contact the administrator to request access.',
        { parse_mode: 'Markdown' }
      );
      console.log(`[Telegram Bot] Unauthorized access attempt from user ${userId}`);
      return false;
    }

    return true;
  }

  private getMainMenu(isAdmin: boolean = true): TelegramBot.InlineKeyboardMarkup {
    const buttons = [];
    
    if (isAdmin) {
      buttons.push([
        { text: '🆕 Generate License', callback_data: 'menu_generate' }
      ]);
      buttons.push([
        { text: '📋 My Licenses', callback_data: 'menu_mykeys' }
      ]);
    }
    
    buttons.push([
      { text: '💾 Download Desktop App', callback_data: 'menu_download' }
    ]);
    
    // All users can check license status
    buttons.push([
      { text: '🔍 Check Status', callback_data: 'menu_status' }
    ]);
    
    if (isAdmin) {
      buttons.push([
        { text: '❌ Revoke License', callback_data: 'menu_revoke' }
      ]);
    }
    
    buttons.push([
      { text: '❓ Help', callback_data: 'menu_help' }
    ]);
    
    return { inline_keyboard: buttons };
  }

  private getGenerateDurationMenu(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '7 Days', callback_data: 'gen_7' },
          { text: '30 Days', callback_data: 'gen_30' }
        ],
        [
          { text: '90 Days', callback_data: 'gen_90' },
          { text: '365 Days (1 Year)', callback_data: 'gen_365' }
        ],
        [
          { text: '♾️ Lifetime', callback_data: 'gen_lifetime' }
        ],
        [
          { text: '« Back to Menu', callback_data: 'menu_main' }
        ]
      ]
    };
  }

  private getBackButton(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '« Back to Menu', callback_data: 'menu_main' }]
      ]
    };
  }

  private setupCommands() {
    if (!this.bot) return;

    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const username = msg.from?.username || msg.from?.first_name || 'User';

      if (!userId) return;

      const isAdmin = this.isAdmin(userId);
      
      await this.bot?.sendMessage(
        chatId,
        `👋 Welcome ${username}!`,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    });

    this.bot.onText(/\/menu/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!userId) return;

      const isAdmin = this.isAdmin(userId);
      
      await this.bot?.sendMessage(
        chatId,
        '📋 Select an option:',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    });

    this.bot.onText(/\/myid/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const username = msg.from?.username || msg.from?.first_name || 'User';

      if (!userId) return;

      await this.bot?.sendMessage(
        chatId,
        `👤 *Your Telegram Info*\n\n` +
        `User ID: \`${userId}\`\n` +
        `Username: ${username}\n\n` +
        `Copy your User ID to update licenses.`,
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.onText(/\/claimlicenses/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!userId) return;

      if (!await this.checkAdminAccess(userId, chatId)) {
        return;
      }

      try {
        const allLicenses = await licenseService.getAllLicenses();
        const unknownLicenses = allLicenses.filter(l => !l.telegramUserId || l.telegramUserId === 'Unknown');

        if (unknownLicenses.length === 0) {
          await this.bot?.sendMessage(
            chatId,
            '✅ No unclaimed licenses found.',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        for (const license of unknownLicenses) {
          await licenseService.updateLicense(license.id, {
            telegramUserId: userId.toString(),
            telegramUsername: msg.from?.username || msg.from?.first_name || 'Admin'
          });
        }

        await this.bot?.sendMessage(
          chatId,
          `✅ *Claimed ${unknownLicenses.length} license(s)*\n\n` +
          `All unclaimed licenses are now assigned to you.\n` +
          `Use /mykeys to view them.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error claiming licenses:', error);
        await this.bot?.sendMessage(
          chatId,
          '❌ Error claiming licenses',
          { parse_mode: 'Markdown' }
        );
      }
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const userId = query.from.id;
      const messageId = query.message?.message_id;
      const data = query.data;

      if (!chatId || !userId || !data) return;

      // Allow these actions for all users
      const publicActions = ['menu_download', 'menu_status', 'menu_help', 'menu_main'];
      
      // Check admin access only for admin-only actions
      if (!publicActions.includes(data) && !await this.checkAdminAccess(userId, chatId)) {
        await this.bot?.answerCallbackQuery(query.id, {
          text: '❌ Access denied',
          show_alert: true
        });
        return;
      }

      await this.bot?.answerCallbackQuery(query.id);

      switch (data) {
        case 'menu_main':
          const isAdmin = this.isAdmin(userId);
          try {
            await this.bot?.editMessageText(
              '📋 Select an option:',
              {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: this.getMainMenu(isAdmin)
              }
            );
          } catch (error) {
            // If edit fails, send new message
            await this.bot?.sendMessage(
              chatId,
              '📋 Select an option:',
              {
                parse_mode: 'Markdown',
                reply_markup: this.getMainMenu(isAdmin)
              }
            );
          }
          break;

        case 'menu_generate':
          await this.bot?.editMessageText(
            '⏱️ Select duration:',
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: this.getGenerateDurationMenu()
            }
          );
          break;

        case 'gen_7':
        case 'gen_30':
        case 'gen_90':
        case 'gen_365':
        case 'gen_lifetime':
          await this.handleGenerateLicense(chatId, userId, query.from.username || 'Unknown', data);
          break;

        case 'menu_mykeys':
          await this.handleMyKeys(chatId, userId);
          break;

        case 'menu_status':
          this.userStates.set(userId, { action: 'awaiting_status_key' });
          await this.bot?.sendMessage(
            chatId,
            '🔑 Send license key:',
            { 
              parse_mode: 'Markdown',
              reply_markup: this.getBackButton()
            }
          );
          break;

        case 'menu_revoke':
          this.userStates.set(userId, { action: 'awaiting_revoke_key' });
          await this.bot?.sendMessage(
            chatId,
            '🔑 Send license key to revoke:',
            { 
              parse_mode: 'Markdown',
              reply_markup: this.getBackButton()
            }
          );
          break;

        case 'menu_download':
          this.userStates.set(userId, { action: 'awaiting_download_key' });
          await this.bot?.sendMessage(
            chatId,
            '🔑 Send your license key:',
            { 
              parse_mode: 'Markdown',
              reply_markup: this.getBackButton()
            }
          );
          break;

        case 'menu_help':
          try {
            await this.bot?.editMessageText(
              '📖 Use buttons to generate, check, or download with license key.',
              {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: this.getBackButton()
              }
            );
          } catch (error) {
            // If edit fails, send new message instead
            await this.bot?.sendMessage(
              chatId,
              '📖 Use buttons to generate, check, or download with license key.',
              {
                parse_mode: 'Markdown',
                reply_markup: this.getBackButton()
              }
            );
          }
          break;
      }
    });

    this.bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const text = msg.text?.trim();

      if (!userId || !text) return;

      const state = this.userStates.get(userId);

      // If user has no state, direct them to use /start
      if (!state?.action) {
        await this.bot?.sendMessage(
          chatId,
          '👋 Welcome! Please use /start to begin.',
          { reply_markup: { remove_keyboard: true } }
        );
        return;
      }

      // Allow non-admin users to complete public actions (download and status check)
      const publicStates = ['awaiting_status_key', 'awaiting_download_key'];
      const isPublicAction = state.action && publicStates.includes(state.action);

      // Only check admin access if this is NOT a public action
      if (!isPublicAction && !await this.checkAdminAccess(userId, chatId)) {
        return;
      }

      if (state.action === 'awaiting_status_key') {
        this.userStates.delete(userId);
        await this.handleCheckStatus(chatId, userId, text);
      } else if (state.action === 'awaiting_revoke_key') {
        this.userStates.delete(userId);
        await this.handleRevokeLicense(chatId, userId, text);
      } else if (state.action === 'awaiting_download_key') {
        this.userStates.delete(userId);
        await this.handleDownloadApp(chatId, userId, text);
      }
    });

    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });
  }

  private async handleGenerateLicense(
    chatId: number,
    userId: number,
    username: string,
    action: string
  ) {
    const isAdmin = this.isAdmin(userId);
    try {
      let durationDays: number | undefined;

      switch (action) {
        case 'gen_7': durationDays = 7; break;
        case 'gen_30': durationDays = 30; break;
        case 'gen_90': durationDays = 90; break;
        case 'gen_365': durationDays = 365; break;
        case 'gen_lifetime': durationDays = undefined; break;
      }

      const license = await licenseService.createLicense(
        userId.toString(),
        username,
        durationDays
      );

      const durationText = durationDays 
        ? `${durationDays} days`
        : 'Lifetime';

      const expiryText = license.expiresAt
        ? `📅 Expires: ${license.expiresAt.toLocaleDateString()}`
        : '♾️ Never expires';

      await this.bot?.sendMessage(
        chatId,
        `✅ \`${license.licenseKey}\` (${durationText})`,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    } catch (error) {
      console.error('Error generating license:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Failed to generate license',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    }
  }

  private async handleMyKeys(chatId: number, userId: number) {
    const isAdmin = this.isAdmin(userId);
    try {
      const allLicenses = await licenseService.getAllLicenses();
      let userLicenses = allLicenses.filter(l => l.telegramUserId === userId.toString());

      // Auto-claim unknown licenses for admins if they have no licenses
      if (userLicenses.length === 0 && isAdmin) {
        const unknownLicenses = allLicenses.filter(l => !l.telegramUserId || l.telegramUserId === 'Unknown');
        
        if (unknownLicenses.length > 0) {
          // Claim all unknown licenses
          for (const license of unknownLicenses) {
            await licenseService.updateLicense(license.id, {
              telegramUserId: userId.toString(),
              telegramUsername: 'Admin'
            });
          }
          
          // Refresh the user's licenses
          const updatedLicenses = await licenseService.getAllLicenses();
          userLicenses = updatedLicenses.filter(l => l.telegramUserId === userId.toString());
          
          console.log(`[Telegram Bot] Auto-claimed ${unknownLicenses.length} unknown licenses for admin ${userId}`);
        }
      }

      if (userLicenses.length === 0) {
        await this.bot?.sendMessage(
          chatId,
          '📋 No licenses found',
          { 
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenu(isAdmin)
          }
        );
        return;
      }

      const licenseList = userLicenses.map((license, index) => {
        const expiryText = license.expiresAt 
          ? `Expires: ${license.expiresAt.toLocaleDateString()}`
          : 'Lifetime';
        
        let statusIcon = '🟢';
        let statusText = 'Active';
        
        if (license.status === 'expired') {
          statusIcon = '🟡';
          statusText = 'Expired';
        } else if (license.status === 'revoked') {
          statusIcon = '🔴';
          statusText = 'Revoked';
        }
        
        return `${index + 1}. ${statusIcon} *${statusText}*\n` +
               `   Key: \`${license.licenseKey}\`\n` +
               `   ${expiryText}`;
      }).join('\n\n');

      const activeLicenses = userLicenses.filter(l => l.status === 'active').length;

      await this.bot?.sendMessage(
        chatId,
        `📋 *My Licenses* (${userLicenses.length} total, ${activeLicenses} active)\n\n` +
        licenseList,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    } catch (error) {
      console.error('Error fetching licenses:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Error loading licenses',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    }
  }

  private async handleCheckStatus(chatId: number, userId: number, licenseKey: string) {
    const isAdmin = this.isAdmin(userId);
    try {
      const result = await licenseService.verifyLicense(licenseKey);
      
      if (!result.valid) {
        await this.bot?.sendMessage(
          chatId,
          `❌ Invalid: ${result.reason}`,
          { 
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenu(isAdmin)
          }
        );
        return;
      }

      const license = result.license!;
      const expiryText = license.expiresAt 
        ? `Expires ${license.expiresAt.toLocaleDateString()}`
        : 'Lifetime';

      await this.bot?.sendMessage(
        chatId,
        `✅ Valid - ${license.status} (${expiryText})`,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    } catch (error) {
      console.error('Error checking license status:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Error checking status',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    }
  }

  private async handleRevokeLicense(chatId: number, userId: number, licenseKey: string) {
    const isAdmin = this.isAdmin(userId);
    try {
      const license = await licenseService.revokeLicense(licenseKey);
      
      if (!license) {
        await this.bot?.sendMessage(
          chatId,
          `❌ License not found`,
          { 
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenu(isAdmin)
          }
        );
        return;
      }

      await this.bot?.sendMessage(
        chatId,
        `✅ License revoked`,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    } catch (error) {
      console.error('Error revoking license:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Error revoking license',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    }
  }

  private async handleDownloadApp(chatId: number, userId: number, licenseKey: string) {
    const isAdmin = this.isAdmin(userId);
    try {
      const result = await licenseService.verifyLicense(licenseKey);
      
      if (!result.valid) {
        await this.bot?.sendMessage(
          chatId,
          `❌ ${result.reason}`,
          { 
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenu(isAdmin)
          }
        );
        return;
      }

      // License is valid and active - allow download for any user
      await this.bot?.sendMessage(
        chatId,
        `⏳ Preparing package...`,
        { parse_mode: 'Markdown' }
      );

      const timestamp = Date.now();
      const zipPath = path.join(process.cwd(), 'uploads', `email-sender-${timestamp}.zip`);
      
      await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        try {
          await this.bot?.sendDocument(
            chatId,
            zipPath,
            {
              caption: `📦 Extract and run - license pre-configured`,
              parse_mode: 'Markdown',
              reply_markup: this.getMainMenu(isAdmin)
            }
          );

          await fs.promises.unlink(zipPath);
          console.log(`[Telegram Bot] Sent desktop app to user, cleaned up ${zipPath}`);
        } catch (error) {
          console.error('[Telegram Bot] Error sending file:', error);
          await this.bot?.sendMessage(
            chatId,
            '❌ Failed to send package',
            { 
              parse_mode: 'Markdown',
              reply_markup: this.getMainMenu(isAdmin)
            }
          );
        }
      });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(output);

      const userPackagePath = path.join(process.cwd(), 'user-package');
      
      archive.directory(userPackagePath, false, (entry) => {
        if (entry.name === '.env.example') {
          return false;
        }
        if (entry.name === 'node_modules' || entry.prefix?.includes('node_modules')) {
          return false;
        }
        if (entry.name === 'dist' || entry.prefix?.includes('dist')) {
          return false;
        }
        if (entry.name === 'dist-electron' || entry.prefix?.includes('dist-electron')) {
          return false;
        }
        return entry;
      });

      const serverUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'https://your-replit-app.replit.app';

      const envContent = `# Email Sender Desktop App Configuration

# Your license key (Pre-configured by Telegram bot)
LICENSE_KEY=${licenseKey}

# Replit server URL
REPLIT_SERVER_URL=${serverUrl}

# Development mode
NODE_ENV=production
`;

      archive.append(envContent, { name: '.env' });

      await archive.finalize();
      
    } catch (error) {
      console.error('[Telegram Bot] Error preparing download:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Error preparing package',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    }
  }

  isRunning(): boolean {
    return this.isInitialized && this.bot !== null;
  }

  stop() {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
      this.isInitialized = false;
      this.userStates.clear();
      console.log('Telegram bot stopped');
    }
  }
}

export const telegramBotService = new TelegramBotService();
