# Email Sender Desktop Application

Standalone desktop version of the Email Sender application built with Electron.

## Features
- Real-time email sending progress with HTTP polling
- SMTP configuration management
- Template management
- License verification
- Hardware fingerprinting
- Connects to Replit server for backend operations

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env` file with:
```
LICENSE_KEY=your-license-key
REPLIT_SERVER_URL=https://your-server.replit.app
```

## Development

Run in development mode:
```bash
npm run electron-dev
```

## Build

Build the React app:
```bash
npm run build
```

Build distributable Electron app:
```bash
npm run build-electron
```

## Distribution

The built application will be in the `dist-electron` folder.

## Architecture

This is a standalone package that includes all necessary source files:
- React frontend components
- Shadcn UI library
- Email sending interface
- SMTP management
- Progress tracking with HTTP polling

The app connects to a remote Replit server for backend operations while maintaining local file system access for templates and configurations.
