# Email Sender User Package Setup Guide

## Overview
This lightweight client connects to your main email sender service remotely. You configure your own settings locally, but the advanced sending logic runs on the main service.

## Quick Setup

1. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Set your `MAIN_BACKEND_URL` (main service URL)

2. **Customize Settings**
   - Edit `config/setup.ini` for email preferences
   - Edit `config/smtp.ini` for your SMTP servers
   - Add your email templates to `files/`
   - Add recipient lists to `files/leads.txt`

3. **Start the Package**
   ```bash
   npm install
   npm run dev
   ```
   The package will run on port 3002 (configurable via PORT environment variable).

## Configuration Files

### `.env` (Environment Variables)
```
MAIN_BACKEND_URL=https://your-main-service.replit.app
PORT=3002
```

### `config/setup.ini` (Email Settings)
- Email sending speed and limits
- QR code and branding settings
- HTML conversion options
- Advanced features

### `config/smtp.ini` (SMTP Servers)
- Your SMTP server configurations
- Multiple servers for rotation
- Authentication settings

## Features Available

✅ **All Advanced Features** - QR codes, HTML conversion, rate limiting  
✅ **Local Configuration** - Your settings, stored locally  
✅ **Direct Connection** - Simple connection to main service  
✅ **Real-time Progress** - Live updates during sending  
✅ **Multiple SMTP** - Use your own SMTP servers  

## Support

If you need help, contact your service administrator.