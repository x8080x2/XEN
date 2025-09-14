
# Email Sender User Package

Complete email sending application that connects to a remote licensing backend.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Set up your environment variables in Replit Secrets or create a `.env` file:
   ```bash
   MAIN_BACKEND_URL=your_main_backend_url
   ```

3. **Start Application**
   ```bash
   npm run dev
   ```

4. **Access Application**
   - Open browser to: http://localhost:5000
   - Application runs on single port (5000) with Vite dev server
   - All licensing and email functionality is handled by the remote main backend

## Architecture

This user package contains:
- **Frontend**: React application for email composition and management
- **Local Backend**: Minimal Express server for license validation only
- **Remote Connection**: All email sending and core logic handled by main backend

## Configuration

### Environment Variables
- `MAIN_BACKEND_URL`: URL of your main backend server
- `JWT_SECRET`: Optional JWT secret for token validation

### License Configuration
The application requires a valid license key. Configure in `config/setup.ini`:
```ini
[LICENSE]
LICENSE_KEY=your_license_key_here
```

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **RAM**: 2GB minimum, 4GB recommended
- **Network**: Internet connection for remote backend communication

## Licensing

This application requires a valid license key and connects to a remote backend for:
- License validation and activation
- Email sending functionality
- Usage tracking and limits
- Feature access control

Features are unlocked based on your license plan:
- **Basic ($19/month)**: 1,000 emails, basic features
- **Professional ($49/month)**: 10,000 emails, QR codes, domain logos  
- **Enterprise ($99/month)**: 50,000 emails, SMTP rotation, API access

Contact your administrator for license generation and support.

## Troubleshooting

### Connection Issues
1. Verify `MAIN_BACKEND_URL` is correct
2. Check internet connection to main backend
3. Ensure main backend server is running and accessible
4. Check firewall settings for outbound connections

### License Issues
1. Verify your license key in `config/setup.ini`
2. Check license expiration date
3. Ensure system date/time is correct
4. Contact support with your license key if issues persist

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
