
# Email Sender User Package

Complete email sending application with licensing system.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm run install-all
   ```

2. **Configure License**
   ```bash
   cp .env.example .env
   # Edit .env and add your license key
   ```

3. **Start Application**
   ```bash
   npm run dev
   ```

4. **Access Application**
   - Open browser to: http://localhost:5000
   - Frontend runs on port 5000
   - Backend API runs on port 3000

## Folder Structure

```
user-package/
├── client/           # React frontend application
├── server/           # Express backend with email services  
├── shared/           # Shared TypeScript types
├── config/           # SMTP and application settings
├── files/            # Email templates and recipient lists
│   └── logo/         # Logo files for emails
├── uploads/          # Temporary file uploads
└── package.json      # Main dependencies
```

## Configuration Files

### SMTP Settings
Edit `config/smtp.json` to add your email providers.

### Application Settings  
Edit `config/settings.json` to customize email sending behavior.

### Email Templates
Add HTML templates to `files/` folder.

### Email Recipients
Add recipients to `files/leads.txt` (one email per line).

### Logos
Add logo images to `files/logo/` folder.

## Features

- **Email Campaigns**: Send bulk emails with templates
- **SMTP Management**: Multiple SMTP provider support
- **Template System**: HTML templates with placeholders
- **File Attachments**: Attach files to emails
- **QR Code Generation**: Dynamic QR codes in emails
- **Progress Tracking**: Real-time sending progress
- **License Protection**: Secure licensing system

## License

This application requires a valid license key to operate. Contact support for licensing information.
