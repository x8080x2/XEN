# Email Sender User Package

Complete email sending application that connects to a remote licensing backend.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy the environment template and update with your values:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set this optional variable:
   ```bash
   MAIN_BACKEND_URL=https://your-app-name.replit.app
   ```

3. **Start Application**
   ```bash
   npm run dev
   ```

4. **Access Application**
   - Open browser to: http://localhost:3002
   - Application runs on single port (3002) by default
   - All licensing and email functionality is handled by the remote main backend

## Architecture

This user package contains:
- **Frontend**: React application for email composition and management
- **Local Backend**: Minimal Express server for license validation only
- **Remote Connection**: All email sending and core logic handled by main backend

## Configuration

### Environment Variables
- `MAIN_BACKEND_URL`: URL of your main backend server (e.g., https://your-app.replit.app) - Optional
- `PORT`: Application port (default: 3002)
- `NODE_ENV`: Environment mode (production recommended for customer deployments)

### Free Access
This application provides free access to all features with no license required.

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **RAM**: 2GB minimum, 4GB recommended
- **Network**: Internet connection for optimal backend communication (optional)

## Features

All features are available for free:
- Unlimited email sending
- QR code generation
- Domain logo insertion
- SMTP rotation
- HTML conversion
- API access

## Troubleshooting

### Connection Issues
1. Verify `MAIN_BACKEND_URL` is correct
2. Check internet connection to main backend
3. Ensure main backend server is running and accessible
4. Check firewall settings for outbound connections

### Application Issues
1. Check internet connection for backend communication
2. Verify SMTP configuration in `config/smtp.ini`
3. Ensure system date/time is correct
4. Check server logs for detailed error messages

### Application Issues
1. Run `npm install` to update dependencies
2. Check Node.js version (18.0.0+ required)
3. Review console logs for error messages
4. Try `npm run build` to check for build errors

## Security

- No sensitive business logic stored locally
- All core functionality handled by secure remote backend
- License validation through encrypted tokens
- API communications secured with authentication keys

## Support

For technical support or license issues, contact your system administrator or the main backend operator.