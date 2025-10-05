
# Email Sender Desktop App - Electron Only (No Web Fallbacks)

This is the **desktop-only** Electron version of the Email Sender application that operates purely with local file access. All web fallback mechanisms have been removed for a lighter, desktop-focused experience.

## Pure Electron Operation
- ✅ Loads templates from local `files/` folder via Electron API only
- ✅ Reads SMTP configs from local `config/smtp.ini` via Electron API only
- ✅ Reads recipients from local `files/leads.txt` via Electron API only
- ✅ Makes API calls to configured Replit server for email sending
- ❌ No web browser support
- ❌ No web API fallbacks
- ❌ No server-side file proxying

## Setup Instructions

### 1. Copy this user-package folder to your laptop

Download or copy the entire `user-package` folder to your Windows laptop.

### 2. Install Node.js

Make sure you have Node.js installed on your laptop:
- Download from: https://nodejs.org/ 
- Install the LTS version (recommended)

### 3. Install dependencies

Open Command Prompt or PowerShell in the user-package folder and run:

```bash
npm install
```

### 4. Configure server URL

You must configure the Replit server URL in one of these ways:
- Set environment variable: `REPLIT_SERVER_URL=https://your-replit-url`
- The app will prompt you to enter the URL on first run

### 5. Prepare your project files

Create the following folder structure in the user-package directory:

```
user-package/
├── files/                  # Your email templates
│   ├── template1.html
│   ├── template2.html
│   ├── leads.txt          # Your email list
│   └── logo/              # Logo files
│       ├── logo1.png
│       └── logo2.jpg
├── config/                # Configuration files
│   ├── setup.ini         # Main settings
│   └── smtp.ini          # SMTP configurations
└── ...
```

### 6. Run the desktop app

**Development mode** (with dev tools):
```bash
npm run electron-dev
```

**Production mode**:
```bash
npm run build
npm run electron
```

### 7. Build executable (optional)

To create a standalone .exe file:
```bash
npm run dist
```

The executable will be created in the `dist-electron` folder.

## Electron-Only Requirements

⚠️ **This application ONLY works in Electron desktop environment**
- Requires all files to be present locally (templates, configs, leads)
- Must have a configured Replit server URL for email sending
- No web browser compatibility whatsoever
- All file operations go through Electron APIs only

## File Access

All file operations use Electron's native file system APIs:
- Templates: `./files/` directory
- Configuration: `./config/` directory  
- Leads list: `./files/leads.txt`
- Logo files: `./files/logo/` directory

## Server Configuration

The app requires a Replit server URL to be configured for email sending. Set this via:
1. Environment variable: `REPLIT_SERVER_URL`
2. The settings interface in the app
3. The URL will be saved to localStorage for persistence

## Troubleshooting

1. **"No Replit server URL configured"** - Set your server URL in the app settings
2. **"Electron API not available"** - Make sure you're running via `npm run electron`, not in a web browser
3. **Files not found** - Ensure your files are in the correct directories relative to user-package folder
4. **SMTP config errors** - Check that `config/smtp.ini` exists and contains valid SMTP settings
5. **Permission errors** - Run as administrator if needed, or check file permissions

## Logs

The app logs all file operations to the console for debugging. Check the Electron developer console if you encounter issues.
