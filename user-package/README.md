# Email Sender User Package

Complete email sending application with advanced features and licensing system.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Set up your environment variables in Replit Secrets or create a `.env` file:
   ```bash
   MAIN_BACKEND_URL=your_license_server_url  
   MAIN_BACKEND_API_KEY=your_license_api_key
   ```

3. **Start Application**
   ```bash
   npm run dev
   ```

4. **Access Application**
   - Open browser to: http://localhost:5000
   - Application runs on single port (5000) with Vite dev server
   - License management is handled by the main backend

## Folder Structure

```
user-package/
├── client/           # React frontend with modern UI components
│   ├── src/
│   │   ├── components/   # UI components (shadcn/ui)
│   │   ├── hooks/        # React hooks
│   │   ├── lib/          # Utilities and React Query setup
│   │   └── pages/        # Application pages
│   └── index.html
├── server/           # Express backend with email services  
│   ├── middleware/       # License validation middleware
│   ├── routes/           # API routes
│   └── services/         # Email and license services
├── shared/           # Shared TypeScript schemas and types
├── config/           # SMTP and application settings
├── files/            # Email templates and recipient lists
│   ├── logo/             # Logo files for emails  
│   ├── leads.txt         # Email recipient list
│   └── *.html            # Email templates
└── package.json      # Modern dependencies and build scripts
```

## Configuration Files

### SMTP Settings
Edit `config/smtp.ini` to add your email providers.

### Application Settings  
Edit `config/setup.ini` to customize email sending behavior and licensing.

### Email Templates
Add HTML templates to `files/` folder with placeholder support.

### Email Recipients
Add recipients to `files/leads.txt` (one email per line).

### Logo Files
Add logo images to `files/logo/` folder for branded emails.

## Modern Features

### Email Campaign Management
- **Bulk Email Sending**: Send to thousands of recipients
- **Template System**: HTML templates with dynamic placeholders
- **SMTP Rotation**: Multiple SMTP provider support with automatic failover
- **File Attachments**: Attach documents and images
- **Progress Tracking**: Real-time sending progress with detailed statistics

### Advanced Email Features  
- **QR Code Generation**: Dynamic QR codes with customizable styling
- **Domain Logos**: Automatic logo insertion based on domains
- **HTML to Image**: Convert HTML content to images
- **Email Minification**: Optimize HTML for better delivery
- **Random Metadata**: Anti-spam randomization features

### Modern UI/UX
- **React + TypeScript**: Modern frontend with type safety
- **shadcn/ui Components**: Beautiful, accessible UI components
- **Dark Mode Support**: Automatic light/dark theme switching
- **Real-time Updates**: Live progress tracking with React Query
- **Responsive Design**: Works on desktop and mobile devices

### License Management
- **Telegram Bot Integration**: Generate customer licenses via Telegram
- **Hardware Fingerprinting**: License binding to specific machines
- **Usage Tracking**: Monitor email sending quotas and limits
- **Plan-based Features**: Basic, Professional, and Enterprise tiers
- **Secure Validation**: JWT-based license verification

### Advanced Configuration
- **Environment Variables**: Secure configuration management
- **Performance Optimization**: Automatic process cleanup and memory management
- **Error Handling**: Comprehensive error logging and recovery
- **Build System**: Modern Vite-based build with TypeScript compilation

## Build & Deployment

### Development
```bash
npm run dev          # Start development server with hot reload
npm run check        # Type check TypeScript code
```

### Production Build
```bash
npm run build        # Build for production
npm run start        # Start production server
npm run package      # Create distribution package
```

### Package Structure
The user package includes everything needed to run independently:
- All modern dependencies and React components
- Complete server with licensing and email services
- Telegram bot for license management
- Configuration files and templates
- Build tools and TypeScript compilation

## System Requirements

- **Node.js**: 18.0.0 or higher
- **NPM**: Latest version
- **Operating System**: Windows, macOS, or Linux
- **RAM**: 2GB minimum, 4GB recommended
- **Network**: Internet connection for license validation

## Licensing

This application requires a valid license key to operate. Features are unlocked based on your license plan:

- **Basic ($19/month)**: 1,000 emails, basic features
- **Professional ($49/month)**: 10,000 emails, QR codes, domain logos
- **Enterprise ($99/month)**: 50,000 emails, SMTP rotation, API access

Contact your administrator for license generation and support through the main backend system.

## Troubleshooting

### License Issues
1. Verify your license key in `config/setup.ini`
2. Check internet connection for license server validation
3. Ensure system date/time is correct
4. Verify MAIN_BACKEND_API_KEY environment variable is set correctly
5. Contact support with your license key if issues persist

### Email Sending Issues
1. Verify SMTP settings in `config/smtp.ini`
2. Check firewall settings for outbound SMTP ports
3. Test SMTP credentials with a single email first
4. Review email logs for delivery status

### Application Issues
1. Run `npm install` to update dependencies
2. Check Node.js version (18.0.0+ required)
3. Review console logs for error messages
4. Try `npm run check` for TypeScript issues

For technical support, contact your license provider with your license key and a detailed description of the issue.