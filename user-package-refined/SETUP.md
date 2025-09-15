# Email Sender User Package Setup Guide

## Overview
This lightweight client connects to your main email sender service remotely. You configure your own settings locally, but the advanced sending logic runs on the main service.

## Quick Setup

1. **Get Your Package Token**
   - Contact your service administrator to get a `PACKAGE_TOKEN`
   - This token authenticates your package with the main service

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Set your `MAIN_BACKEND_URL` (main service URL)
   - Set your `PACKAGE_TOKEN`

3. **Customize Settings**
   - Edit `config/setup.ini` for email preferences
   - Edit `config/smtp.ini` for your SMTP servers
   - Add your email templates to `files/`
   - Add recipient lists to `files/leads.txt`

4. **Start the Package**
   ```bash
   npm install
   npm run dev
   ```
   The package will run on port 3002 (configurable via PORT environment variable).

## Configuration Files

### `.env` (Environment Variables)
```
MAIN_BACKEND_URL=https://your-main-service.replit.app
PACKAGE_TOKEN=your-token-here
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
✅ **Secure Connection** - Encrypted communication with main service  
✅ **Real-time Progress** - Live updates during sending  
✅ **Multiple SMTP** - Use your own SMTP servers  

## Support

If you need help or a package token, contact your service administrator.