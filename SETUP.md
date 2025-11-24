# Email Sender Application - Complete Setup Guide

This guide will help you set up the Email Sender application with all its features: license management via Telegram bot, AI-powered email generation, and the desktop app.

---

## 🎯 Quick Overview

This application has two parts:
1. **Web Server (Replit)**: Handles email sending, license verification, and Telegram bot
2. **Desktop App (Electron)**: Standalone application for users to send emails

---

## 📋 Prerequisites

- A Telegram account (for license management)
- A Google AI API key (optional, for AI features)
- Your Replit deployment URL

---

## 🚀 Part 1: Server Setup (Administrator)

### Step 1: Set Up Telegram Bot

1. **Create a Telegram Bot**:
   - Open Telegram and message [@BotFather](https://t.me/BotFather)
   - Send `/newbot` command
   - Follow the prompts to name your bot
   - Copy the **bot token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Get Your Telegram User ID**:
   - Message [@userinfobot](https://t.me/userinfobot) on Telegram
   - It will respond with your user ID (example: `123456789`)
   - This makes you an admin who can generate/revoke licenses

3. **Configure Environment Variables**:
   The following secrets are already configured in your Replit:
   - ✅ `TELEGRAM_BOT_TOKEN` - Your bot token from BotFather
   - ✅ `TELEGRAM_ADMIN_CHAT_IDS` - Your Telegram user ID (comma-separated for multiple admins)
   - ✅ `DATABASE_URL` - PostgreSQL database (automatically configured)

### Step 2: Set Up Google AI (Optional but Recommended)

The AI features allow automatic generation of:
- Personalized email subjects
- Sender names that match email content
- Dynamic placeholder values (names, companies, etc.)

1. **Get a Google AI API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/apikey)
   - Create a new API key
   - Copy the key (starts with `AIzaSy...`)

2. **Add to Replit Secrets**:
   - Open Replit Secrets panel (🔒 icon in left sidebar)
   - Add secret: `GEMINI_API_KEY` with your API key value
   - The server will automatically use it when available

### Step 3: Test the Telegram Bot

1. **Find Your Bot**:
   - Search for your bot username in Telegram
   - Send `/start` command

2. **Admin Commands** (only for admin users):
   - `/menu` - Show admin menu
   - `/claimlicenses <count>` - Generate new license keys
   - Check license status
   - Revoke licenses
   - Download desktop app

3. **Regular User Commands**:
   - `/start` - Download desktop app (requires license key)

---

## 📦 Part 2: Desktop App Distribution

### How Users Get the Desktop App

Users can get the desktop app in two ways:

#### Option A: Via Telegram Bot (Recommended)
1. User messages your Telegram bot
2. Sends `/start` command
3. Bot provides download link for their platform (Windows/Mac/Linux)
4. Bot automatically packages the app with server connection pre-configured

#### Option B: Manual Distribution
1. Share the `user-package/` folder with users
2. They need to configure `.env` file manually (see below)

### Desktop App Configuration

Users need to create a `.env` file in the `user-package/` folder:

```env
# License key (get from Telegram bot)
LICENSE_KEY=YOUR_32_CHARACTER_LICENSE_KEY_HERE

# Server URL (your Replit deployment)
REPLIT_SERVER_URL=https://xen-1-cls8080.replit.app
```

**Important Notes**:
- License keys are tied to one computer (IP address)
- If a user needs to transfer their license, they must contact you to revoke and regenerate
- The desktop app verifies the license on startup

---

## 🔧 Part 3: Usage Guide

### For Administrators

#### Generating License Keys

1. Message your Telegram bot
2. Send `/menu`
3. Select "🔑 Generate New Licenses"
4. Enter how many licenses to generate
5. Bot will send the license keys - distribute these to your users

#### Checking License Status

1. Send `/menu`
2. Select "📋 Check License Status"
3. Enter the license key
4. Bot shows: status, expiration, activation details

#### Revoking Licenses

1. Send `/menu`
2. Select "🚫 Revoke License"
3. Enter the license key to revoke
4. Confirmation message

### For End Users

#### Installing Desktop App

1. Get your license key from the admin
2. Download the app via Telegram bot or manual distribution
3. Extract the zip file
4. Create `.env` file with your license key and server URL
5. Run the application
6. Configure SMTP settings in the app

#### Using the Email Sender

1. **Configure SMTP**:
   - Go to SMTP Manager
   - Add your email server details
   - Enable rotation if using multiple servers

2. **Prepare Recipients**:
   - Import email list (one per line or CSV)
   - Supports custom fields: email, name, company, etc.

3. **Compose Email**:
   - Select HTML template or write custom content
   - Add subject line (use AI generation if enabled)
   - Configure sender name and reply-to
   - Add attachments if needed

4. **Send Emails**:
   - Review settings
   - Click "Send Emails"
   - Monitor progress in real-time

---

## 🎨 Features Explained

### License Management
- Hardware-bound activation (one license per computer)
- Expiration dates support
- Telegram bot for easy distribution
- Automatic verification on app startup

### AI-Powered Features
When `GEMINI_API_KEY` is configured:
- **Smart Subjects**: AI analyzes email content and generates matching subject lines
- **Sender Names**: Generates professional sender names that fit the email context
- **Placeholders**: Auto-generates realistic first names, last names, companies, domains

### Email Features
- **QR Codes**: Generate QR codes with optional hidden images
- **Templates**: HTML email templates with dynamic placeholders
- **Attachments**: Support for multiple file attachments
- **SMTP Rotation**: Distribute sending across multiple SMTP servers
- **Progress Tracking**: Real-time progress monitoring
- **Retry Logic**: Automatic retry on temporary failures

### Desktop App Features
- Standalone electron application
- Local file-based configuration
- Direct connection to Replit backend
- No internet browser required
- Platform-specific builds (Windows/Mac/Linux)

---

## 🔍 Troubleshooting

### License Issues

**Problem**: "License verification failed"
- Check that `.env` file exists in `user-package/` folder
- Verify license key is correct (no extra spaces)
- Ensure `REPLIT_SERVER_URL` is correct

**Problem**: "License already activated on another computer"
- License is tied to one IP address
- Contact admin to revoke and get a new license

### Telegram Bot Issues

**Problem**: Bot doesn't respond
- Check `TELEGRAM_BOT_TOKEN` is correct in Replit Secrets
- Verify webhook is set (check server logs)
- Make sure your Telegram ID is in `TELEGRAM_ADMIN_CHAT_IDS`

**Problem**: "Access Denied" when using admin commands
- Only users listed in `TELEGRAM_ADMIN_CHAT_IDS` can use admin features
- Check your Telegram user ID with @userinfobot

### Email Sending Issues

**Problem**: SMTP connection fails
- Verify SMTP credentials are correct
- Check SMTP server allows your IP
- Try using port 587 (TLS) or 465 (SSL)

**Problem**: AI features not working
- Ensure `GEMINI_API_KEY` is set in Replit Secrets
- Check API key is valid and has quota remaining
- Restart the server after adding the key

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review server logs in Replit console
3. Check desktop app logs (shown on error)
4. Contact your system administrator

---

## 🔐 Security Best Practices

1. **Never share**:
   - Your Telegram bot token
   - Database connection string
   - Google AI API key
   - Admin Telegram user IDs

2. **Regularly**:
   - Review active licenses
   - Revoke unused licenses
   - Monitor email sending activity
   - Update SMTP credentials

3. **For Users**:
   - Keep license keys private
   - Don't share desktop app `.env` file
   - Use strong SMTP passwords
   - Enable 2FA on email accounts

---

## 📊 Current Configuration

**Server URL**: `https://xen-1-cls8080.replit.app`

**Configured Services**:
- ✅ PostgreSQL Database
- ✅ Telegram Bot (License Management)
- ⚠️  Google AI (Optional - set `GEMINI_API_KEY` to enable)

**Admin Access**:
- Telegram bot configured with admin user(s)
- Use `/menu` command to access admin features

---

## 🚀 Next Steps

### For Administrators:
1. ✅ Server is running with Telegram bot
2. ✅ Database is configured
3. ⏭️ (Optional) Add `GEMINI_API_KEY` for AI features
4. ⏭️ Generate test license via Telegram bot
5. ⏭️ Test desktop app with test license
6. ⏭️ Distribute license keys to users

### For Users:
1. Get your license key from admin
2. Download desktop app via Telegram bot
3. Configure `.env` file
4. Set up SMTP credentials
5. Start sending emails!

---

**Questions?** Contact your administrator or refer to the detailed sections above.
