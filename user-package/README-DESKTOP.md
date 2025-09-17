# Email Sender Desktop App

This is the desktop Electron version of the Email Sender application that can access your local files directly.

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

## Troubleshooting

1. **"electronAPI is not defined"** - Make sure you're running the Electron app, not the web version
2. **Files not found** - Ensure your files are in the correct directories relative to the user-package folder
3. **Permission errors** - Run as administrator if needed, or check file permissions

## Logs

The app will log file operations to help you debug:
- Check the console output when running `npm run electron-dev`
- File read/write operations are logged with full paths