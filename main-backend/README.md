# Email Sender Main Backend

This is the main backend service for the Email Sender system. It handles license management and core email sending functionality.

## Deployment on Render

### Automatic Deployment

1. Connect your GitHub repository to Render
2. Use the `render.yaml` configuration for automatic deployment
3. Set required environment variables in Render dashboard

### Manual Deployment

1. Create a new Web Service on Render
2. Connect your repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Set root directory: `main-backend`
6. Configure environment variables

## Environment Variables

Required environment variables:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-secure-jwt-secret
DEFAULT_API_KEY=your-secure-api-key
ALLOWED_ORIGINS=https://your-client-domain.com
MAIN_BACKEND_VERSION=1.0.0
```

Optional email service configuration:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## API Endpoints

### License Management
- `POST /api/license/validate` - Validate license and return JWT token
- `POST /api/license/usage` - Record license usage
- `POST /api/license/create` - Create new license (admin only)
- `GET /api/license/list` - List all licenses (admin only)
- `PUT /api/license/:licenseKey` - Update license (admin only)
- `DELETE /api/license/:licenseKey` - Delete license (admin only)
- `GET /api/license/stats` - Get license statistics (admin only)

### Email Operations
- `POST /api/emails/send` - Send emails (requires license token)
- `GET /api/emails/status/:jobId` - Get email job status
- `POST /api/original/sendMail` - Send emails (legacy API)
- `GET /api/placeholders` - Get available placeholders
- `POST /api/html/process` - Process HTML with placeholders

### Configuration
- `GET /api/config/load` - Load configuration
- `GET /api/config/smtp` - Get SMTP configuration
- `GET /api/config/loadLeads` - Load mailing list

### File Management
- `GET /api/original/listFiles` - List files
- `GET /api/original/listLogoFiles` - List logo files
- `GET /api/original/getFileContent/:filename` - Get file content
- `POST /api/original/saveFile` - Save file

## Authentication

All API endpoints require API key authentication via Bearer token:

```
Authorization: Bearer your-api-key
```

Email operations also require license token validation:

```
X-License-Token: jwt-license-token
```

## License Plans

### Basic Plan Features
- maxEmailsPerMonth: 1000
- maxRecipientsPerEmail: 100
- allowQRCodes: false
- allowAttachments: false
- allowDomainLogos: false
- allowHTMLConvert: false
- smtpRotation: false
- apiAccess: false

### Professional Plan Features
- maxEmailsPerMonth: 10000
- maxRecipientsPerEmail: 500
- allowQRCodes: true
- allowAttachments: true
- allowDomainLogos: true
- allowHTMLConvert: true
- smtpRotation: false
- apiAccess: false

### Enterprise Plan Features
- maxEmailsPerMonth: 100000
- maxRecipientsPerEmail: 1000
- allowQRCodes: true
- allowAttachments: true
- allowDomainLogos: true
- allowHTMLConvert: true
- smtpRotation: true
- apiAccess: true

## Creating Licenses

Use the admin API to create licenses:

```bash
curl -X POST https://your-backend.onrender.com/api/license/create \
  -H "Authorization: Bearer your-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "userEmail": "user@example.com",
    "userName": "John Doe",
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
    "expiresAt": "2025-12-31T23:59:59.999Z",
    "maxActivations": 1
  }'
```

## Monitoring

- Health check endpoint: `GET /health`
- License statistics: `GET /api/license/stats` (admin only)

## Security

- API key authentication for all endpoints
- JWT tokens for license validation
- CORS protection
- Input validation with Zod schemas
- Rate limiting (recommended to add)

## Support

For technical issues, contact the development team.