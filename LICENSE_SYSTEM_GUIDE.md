# Email Sender Licensing System - Complete Implementation Guide

## 🎯 Overview

This licensing system splits the email application into two parts:
1. **Client Backend** - What users receive (validates licenses, proxies requests)
2. **Main Backend** - Your hosted service (handles licensing, core email logic)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User's App    │    │  Client Backend │    │  Main Backend   │
│   (Frontend)    │────│   (Licensing)   │────│  (Core Logic)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              │ License Validation      │ API Key Auth
                              │ Proxy Requests          │ JWT Tokens
                              │ Feature Checking        │ Email Sending
```

## 📁 Directory Structure

```
email-sender-licensing/
├── shared/
│   └── schema.ts              # Shared types and schemas
├── client-backend/            # What users receive
│   ├── src/
│   │   ├── index.ts
│   │   ├── services/
│   │   │   └── licenseService.ts
│   │   └── routes/
│   │       ├── clientRoutes.ts
│   │       └── proxyRoutes.ts
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── main-backend/              # Your hosted service
│   ├── src/
│   │   ├── index.ts
│   │   ├── storage/
│   │   │   └── memoryStorage.ts
│   │   ├── middleware/
│   │   │   └── apiKeyAuth.ts
│   │   └── routes/
│   │       ├── licenseRoutes.ts
│   │       ├── emailRoutes.ts
│   │       └── configRoutes.ts
│   ├── package.json
│   ├── .env.example
│   ├── render.yaml
│   └── README.md
└── server/                    # Existing application
    └── middleware/
        └── licenseMiddleware.ts # Added license validation
```

## 🔐 Security Features

### 1. JWT-Based License Tokens
- Licenses are validated and converted to JWT tokens
- Tokens contain user info and feature permissions
- Automatic expiration handling

### 2. API Key Authentication
- All client-to-main backend communication requires API keys
- Keys are hashed and stored securely
- Permission-based access control

### 3. Feature-Based Restrictions
- Different license plans enable different features
- QR codes, attachments, domain logos based on plan
- Email volume limits enforced

### 4. Machine Binding
- Licenses can be bound to specific machines
- Prevents unauthorized license sharing
- Configurable activation limits

## 📋 License Plans

### Basic Plan ($19/month)
- 1,000 emails/month
- 100 recipients/email
- Basic templates only

### Professional Plan ($49/month)
- 10,000 emails/month
- 500 recipients/email
- QR codes
- File attachments
- Domain logos
- HTML to PDF conversion

### Enterprise Plan ($99/month)
- 100,000 emails/month
- 1,000 recipients/email
- All Professional features
- SMTP rotation
- API access
- Priority support

## 🚀 Deployment Steps

### 1. Deploy Main Backend on Render

1. Create new repository for main backend
2. Copy `main-backend/` contents to repository
3. Connect repository to Render
4. Use provided `render.yaml` for automatic deployment
5. Set environment variables in Render dashboard

Required environment variables:
```env
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-here
DEFAULT_API_KEY=your-admin-api-key-here
ALLOWED_ORIGINS=*
```

### 2. Prepare Client Backend for Distribution

1. Copy `client-backend/` directory
2. Update `.env.example` with your main backend URL
3. Build the application: `npm run build`
4. Create distribution package

### 3. Configure License Creation

Use the admin API to create licenses:

```bash
curl -X POST https://your-backend.onrender.com/api/license/create \
  -H "Authorization: Bearer your-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "customer123",
    "userEmail": "customer@example.com", 
    "userName": "Customer Name",
    "planType": "professional",
    "features": {
      "maxEmailsPerMonth": 10000,
      "maxRecipientsPerEmail": 500,
      "allowQRCodes": true,
      "allowAttachments": true,
      "allowDomainLogos": true,
      "allowHTMLConvert": true,
      "smtpRotation": false,
      "apiAccess": false
    },
    "expiresAt": "2025-12-31T23:59:59.999Z"
  }'
```

## 🧪 Testing the System

Use the provided test script:

```bash
# Install dependencies
npm install axios crypto

# Set environment variables
export MAIN_BACKEND_URL=https://your-backend.onrender.com
export CLIENT_BACKEND_URL=http://localhost:3000
export ADMIN_API_KEY=your-admin-api-key

# Run tests
node test-licensing-system.js
```

The test script verifies:
- Backend health checks
- License creation and activation
- Email sending with license validation
- Security restrictions
- Feature access control

## 🔧 Integration with Existing Code

### 1. Add License Middleware to Routes

```javascript
import { requireValidLicense, validateEmailLimits, recordEmailUsage } from './middleware/licenseMiddleware';

// Protect email sending routes
app.post('/api/emails/send', 
  requireValidLicense,
  validateEmailLimits,
  recordEmailUsage,
  yourEmailHandler
);
```

### 2. Initialize License Service

```javascript
import { initializeLicenseService } from './services/licenseService';

const licenseConfig = {
  jwtSecret: process.env.JWT_SECRET,
  mainBackendUrl: process.env.MAIN_BACKEND_URL,
  apiKey: process.env.MAIN_BACKEND_API_KEY,
  clientVersion: '1.0.0'
};

initializeLicenseService(licenseConfig);
```

## 💰 Revenue Model

### Subscription Tiers
- **Basic**: $19/month - For small businesses
- **Professional**: $49/month - For growing companies  
- **Enterprise**: $99/month - For large organizations

### License Key Generation
```javascript
// Generate unique license keys
const licenseKey = crypto.randomBytes(32).toString('hex');
```

### Usage Tracking
- Monthly email counts per license
- Feature usage analytics
- License activation tracking

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit secrets
2. **API Key Rotation**: Regularly rotate API keys
3. **JWT Expiration**: Short-lived tokens (24 hours)
4. **HTTPS Only**: All communication over HTTPS
5. **Input Validation**: All inputs validated with Zod
6. **Rate Limiting**: Implement rate limiting (recommended)

## 📊 Monitoring & Analytics

### Key Metrics to Track
- License activations
- Email volume per license
- Feature usage by plan
- Failed authentication attempts
- Revenue per license tier

### Render Monitoring
- Use Render's built-in monitoring
- Set up alerts for downtime
- Monitor memory and CPU usage

## 🆘 Support & Troubleshooting

### Common Issues

1. **License Activation Fails**
   - Check main backend connectivity
   - Verify API key is correct
   - Confirm license exists and is active

2. **Email Sending Blocked**
   - Check license status
   - Verify monthly limits not exceeded
   - Confirm features are enabled for plan

3. **Authentication Errors**
   - Verify JWT secret matches between client/main backend
   - Check token expiration
   - Confirm API key is valid

### Debug Commands

```bash
# Check license status
curl -X GET http://localhost:3000/api/license/status

# Check main backend health
curl -X GET https://your-backend.onrender.com/health

# List all licenses (admin)
curl -X GET https://your-backend.onrender.com/api/license/list \
  -H "Authorization: Bearer your-admin-api-key"
```

## 🎯 Next Steps

1. **Deploy main backend** to Render
2. **Create test licenses** using admin API
3. **Distribute client backend** to customers
4. **Set up monitoring** and alerts
5. **Implement payment integration** (Stripe recommended)
6. **Add license renewal** automation
7. **Create admin dashboard** for license management

## 📞 Support

For technical support or license issues:
- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com
- Status Page: https://status.yourcompany.com

---

This licensing system provides complete protection of your core email sending logic while giving customers a fully functional application. The architecture ensures scalability, security, and easy management of customer licenses.