# Windows Distribution Guide

## Creating Customer Packages

### Step 1: Prepare the Package
1. Run `Create-Windows-Package.cmd` to build the complete distribution
2. This creates the `email-sender-windows\` folder with everything customers need

### Step 2: Customize for Each Customer
1. Edit `email-sender-windows\config\setup.ini`:
   - Set `MAIN_BACKEND_URL=https://your-actual-backend.onrender.com`
   - API key is no longer required (now uses JWT authentication)
   - Optionally replace `ENTER-YOUR-LICENSE-KEY-HERE` with their actual license key

**IMPORTANT**: All configuration is now done in setup.ini only. The customer never needs to edit batch files.

### Step 3: Create Distribution ZIP
```cmd
# Zip the entire email-sender-windows folder
powershell Compress-Archive -Path email-sender-windows -DestinationPath EmailSender-v1.0-Windows.zip
```

### Step 4: Customer Instructions
Send customers:
1. The ZIP file
2. Their license key (if not pre-configured)
3. Quick start instructions from README-WINDOWS.txt

## Customer Workflow

### Installation (One-time)
1. Extract ZIP file to desired location (e.g., `C:\EmailSender\`)
2. Double-click `Install-Email-Sender.cmd`
3. Edit `config\setup.ini` with license key
4. Double-click `Start-Email-Sender.cmd`
5. Use the application at http://localhost:5000

### Daily Usage
1. Double-click `Start-Email-Sender.cmd`
2. Use the web interface
3. Close server window when done, or run `Stop-Email-Sender.cmd`

## Technical Details

### What's Protected
- All email sending logic stays on your Render backend
- QR code generation and advanced features
- SMTP management and rate limiting
- License validation and usage tracking

### What Customers Get
- Clean UI interface
- License validation client
- Proxy layer to your backend
- Local file management (templates, leads)
- No access to core business logic

### Security
- Each customer uses their license key for JWT authentication
- License keys are machine-bound
- All communication encrypted via HTTPS
- JWT tokens expire every 24 hours

### Support
Common customer issues:
- **Port 5000 in use**: Set PORT environment variable before running Start-Email-Sender.cmd
- **License validation fails**: Check LICENSE_KEY in config/setup.ini, internet connection, system time
- **Backend connection fails**: Verify MAIN_BACKEND_URL in config/setup.ini and check license key validity
- **Node.js issues**: Install from https://nodejs.org (LTS version)
- **Firewall blocks**: Allow when Windows prompts

## Revenue Model Integration

### License Plans
- **Basic ($19/month)**: 1,000 emails, basic features
- **Professional ($49/month)**: 10,000 emails, QR codes, attachments
- **Enterprise ($99/month)**: 100,000 emails, all features

### Backend Configuration
Set feature limits in your main backend based on customer's plan:
```javascript
const planLimits = {
  basic: { maxEmails: 1000, qrCodes: false, htmlConvert: false },
  professional: { maxEmails: 10000, qrCodes: true, htmlConvert: true },
  enterprise: { maxEmails: 100000, qrCodes: true, htmlConvert: true, apiAccess: true }
};
```

## Updates and Maintenance

### Pushing Updates
1. Update the main backend on Render
2. Customers run `Update-Email-Sender.cmd` to get client updates
3. License validation ensures only current customers get updates

### Monitoring
- Track license usage via your main backend
- Monitor API usage and rate limits
- Customer support via license key lookup