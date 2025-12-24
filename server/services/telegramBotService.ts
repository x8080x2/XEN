import TelegramBot from 'node-telegram-bot-api';
import { licenseService } from './licenseService';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

interface UserState {
  action?: 'awaiting_status_key' | 'awaiting_revoke_key' | 'awaiting_download_key' | 'awaiting_pause_key' | 'awaiting_resume_key';
}

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isInitialized = false;
  private adminChatIds: Set<number> = new Set();
  private userStates: Map<number, UserState> = new Map();
  private webhookUrl: string = '';
  private broadcastMessages: Array<{ id: string; message: string; timestamp: number; adminId: number }> = [];
  private dismissedBroadcasts: Map<string, Set<string>> = new Map(); // Map of userId -> Set of dismissed broadcast IDs

  async initialize(token: string, adminChatIds?: string, webhookUrl?: string): Promise<boolean> {
    try {
      if (this.isInitialized) {
        console.log('Telegram bot already initialized');
        return true;
      }

      // Load last 50 broadcast messages from database
      await this.loadBroadcastsFromDatabase();

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
        { text: '⏸️ Pause License', callback_data: 'menu_pause' },
        { text: '▶️ Resume License', callback_data: 'menu_resume' }
      ]);
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

    this.bot.onText(/\/broadcast (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!userId) return;

      if (!await this.checkAdminAccess(userId, chatId)) {
        return;
      }

      const message = match?.[1];
      if (!message) {
        await this.bot?.sendMessage(
          chatId,
          '❌ Please provide a message to broadcast.\n\nUsage: `/broadcast Your message here`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const broadcastId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const broadcastData = {
        id: broadcastId,
        message,
        timestamp: Date.now(),
        adminId: userId
      };

      this.broadcastMessages.push(broadcastData);

      // Keep only last 50 messages in memory
      if (this.broadcastMessages.length > 50) {
        this.broadcastMessages = this.broadcastMessages.slice(-50);
      }

      // Save to database for persistence
      await this.saveBroadcastToDatabase(broadcastData);

      await this.bot?.sendMessage(
        chatId,
        `✅ *Broadcast sent!*\n\n` +
        `Message: ${message}\n\n` +
        `All Electron app users will receive this notification.`,
        { parse_mode: 'Markdown' }
      );

      console.log(`[Telegram Bot] Admin ${userId} sent broadcast: ${message}`);
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

        case 'menu_pause':
          this.userStates.set(userId, { action: 'awaiting_pause_key' });
          await this.bot?.sendMessage(
            chatId,
            '🔑 Send license key to pause:',
            { 
              parse_mode: 'Markdown',
              reply_markup: this.getBackButton()
            }
          );
          break;

        case 'menu_resume':
          this.userStates.set(userId, { action: 'awaiting_resume_key' });
          await this.bot?.sendMessage(
            chatId,
            '🔑 Send license key to resume:',
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
      } else if (state.action === 'awaiting_pause_key') {
        this.userStates.delete(userId);
        await this.handlePauseLicense(chatId, userId, text);
      } else if (state.action === 'awaiting_resume_key') {
        this.userStates.delete(userId);
        await this.handleResumeLicense(chatId, userId, text);
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

        if (license.status === 'paused') {
          statusIcon = '🟠';
          statusText = 'Paused';
        } else if (license.status === 'expired') {
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

  private async handlePauseLicense(chatId: number, userId: number, licenseKey: string) {
    const isAdmin = this.isAdmin(userId);
    try {
      const license = await licenseService.pauseLicense(licenseKey);

      if (!license) {
        await this.bot?.sendMessage(
          chatId,
          `❌ License not found or not active`,
          { 
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenu(isAdmin)
          }
        );
        return;
      }

      await this.bot?.sendMessage(
        chatId,
        `⏸️ License paused\n\nKey: \`${license.licenseKey}\``,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    } catch (error) {
      console.error('Error pausing license:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Error pausing license',
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    }
  }

  private async handleResumeLicense(chatId: number, userId: number, licenseKey: string) {
    const isAdmin = this.isAdmin(userId);
    try {
      const license = await licenseService.resumeLicense(licenseKey);

      if (!license) {
        await this.bot?.sendMessage(
          chatId,
          `❌ License not found or not paused`,
          { 
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenu(isAdmin)
          }
        );
        return;
      }

      await this.bot?.sendMessage(
        chatId,
        `▶️ License resumed\n\nKey: \`${license.licenseKey}\``,
        { 
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenu(isAdmin)
        }
      );
    } catch (error) {
      console.error('Error resuming license:', error);
      await this.bot?.sendMessage(
        chatId,
        '❌ Error resuming license',
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
      const zipPath = path.join(process.cwd(), 'uploads', `u-p-cls-${timestamp}.zip`);

      await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

      const output = fs.createWriteStream(zipPath);
      // Store only (no compression) for speed
      const archive = archiver('zip', { store: true });

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

      const userPackagePath = path.join(process.cwd(), 'u-p');
      console.log(`[Telegram Bot] Creating ZIP from: ${userPackagePath}`);

      // Simple walk - include ALL files, only skip .env (we inject our own)
      const walkAndAddFiles = async (dir: string, baseDir: string): Promise<number> => {
        let count = 0;
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);

          // Only skip .env files (we inject our own with license)
          if (entry.name === '.env' || entry.name === '.env.example') {
            continue;
          }

          if (entry.isDirectory()) {
            count += await walkAndAddFiles(fullPath, baseDir);
          } else if (entry.isFile()) {
            const content = await fs.promises.readFile(fullPath);
            archive.append(content, { name: relativePath });
            count++;
          }
        }
        return count;
      };

      const fileCount = await walkAndAddFiles(userPackagePath, userPackagePath);
      console.log(`[Telegram Bot] Added ${fileCount} files to ZIP`);

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

  // Get broadcasts newer than a timestamp (excluding those already dismissed by this user)
  getBroadcastsSince(since: number, userId?: string): Array<{ id: string; message: string; timestamp: number; adminId: number }> {
    let messages = this.broadcastMessages;

    // Filter by timestamp if provided
    if (since) {
      messages = messages.filter(msg => msg.timestamp > since);
    }

    // If userId provided, filter out dismissed broadcasts
    if (userId) {
      const dismissedKey = `dismissed_${userId}`;
      const dismissed = this.dismissedBroadcasts.get(dismissedKey) || new Set<string>();
      messages = messages.filter(msg => !dismissed.has(msg.id));
    }

    return messages;
  }

  // Mark a broadcast as dismissed for a specific user - permanently deletes from database
  async dismissBroadcast(broadcastId: string, userId: string): Promise<void> {
    // Remove from in-memory array
    const index = this.broadcastMessages.findIndex(msg => msg.id === broadcastId);
    if (index !== -1) {
      this.broadcastMessages.splice(index, 1);
      console.log(`[Telegram Bot] Removed broadcast ${broadcastId} from memory`);
    }

    // Delete from database permanently
    await storage.deleteBroadcastMessage(broadcastId);
    
    // Also mark as dismissed in case there are any race conditions
    const dismissedKey = `dismissed_${userId}`;
    if (!this.dismissedBroadcasts.has(dismissedKey)) {
      this.dismissedBroadcasts.set(dismissedKey, new Set<string>());
    }
    this.dismissedBroadcasts.get(dismissedKey)!.add(broadcastId);
    console.log(`[Telegram Bot] User ${userId} dismissed broadcast ${broadcastId}`);
  }

  private async loadBroadcastsFromDatabase(): Promise<void> {
    try {
      const broadcasts = await storage.getBroadcastMessages(50);
      this.broadcastMessages = broadcasts.map(b => ({
        id: b.id,
        message: b.message,
        timestamp: new Date(b.timestamp).getTime(),
        adminId: parseInt(b.adminId) || 0
      }));
      console.log(`[Telegram Bot] Loaded ${this.broadcastMessages.length} broadcast messages from database`);
    } catch (error) {
      console.error('[Telegram Bot] Failed to load broadcasts from database:', error);
      this.broadcastMessages = [];
    }
  }

  private async saveBroadcastToDatabase(broadcast: { id: string; message: string; timestamp: number; adminId: number }): Promise<void> {
    try {
      await storage.saveBroadcastMessage({
        id: broadcast.id,
        message: broadcast.message,
        timestamp: new Date(broadcast.timestamp),
        adminId: broadcast.adminId.toString()
      });
    } catch (error) {
      console.error('[Telegram Bot] Failed to save broadcast to database:', error);
    }
  }
}

export const telegramBotService = new TelegramBotService();