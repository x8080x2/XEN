# Email Sender Desktop App - Mode 1: Standalone (Local Processing)

This is the desktop Electron version of the Email Sender application that operates in **Mode 1 - Standalone (Local Processing)** only. It accesses your local files directly and makes API calls only to the hosted Replit server for actual email sending.

## Mode 1 Operation
- ✅ Loads templates from local `files/` folder
- ✅ Reads SMTP configs from local `config/smtp.ini`
- ✅ Reads recipients from local `files/leads.txt`
- ✅ Makes API calls to hosted Replit server for actual email sending
- ❌ No web browser support
- ❌ No backend API fallbacks
- ❌ No sample content fallbacks

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

### 4. Prepare your project files

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

### 5. Run the desktop app

**Development mode** (with dev tools):
```bash
npm run electron-dev
```

**Production mode**:
```bash
npm run build
npm run electron
```

### 6. Build executable (optional)

To create a standalone .exe file:
```bash
npm run dist
```

The executable will be created in the `dist-electron` folder.

## File Access

The desktop app can now access your local files directly:
- Templates from `./files/` directory
- Configuration from `./config/` directory  
- Leads list from `./files/leads.txt`
- Logo files from `./files/logo/` directory

## Mode 1 Requirements

⚠️ **This application ONLY works in Electron desktop environment**
- Requires all files to be present locally (templates, configs, leads)
- No web browser compatibility 
- SMTP configurations must be in local `config/smtp.ini` file
- Will show error messages if Electron API is not available

## Troubleshooting

1. **"Mode 1 requires Electron API"** - This message appears when running outside Electron environment
2. **"electronAPI is not defined"** - Make sure you're running the Electron app, not in a web browser
3. **Files not found** - Ensure your files are in the correct directories relative to the user-package folder
4. **SMTP config errors** - Check that `config/smtp.ini` exists and contains valid SMTP settings
5. **Permission errors** - Run as administrator if needed, or check file permissions

## Logs

The app will log file operations to help you debug:
- Check the console output when running `npm run electron-dev`
- File read/write operations are logged with full paths