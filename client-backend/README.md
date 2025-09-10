# Email Sender Client

This is the client application for the Email Sender system. It requires a valid license to connect to the main backend service.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file and configure:
```bash
cp .env.example .env
```

3. Set your license key and main backend URL in `.env`:
```env
MAIN_BACKEND_URL=https://email-sender-main.onrender.com
MAIN_BACKEND_API_KEY=your-api-key-here
CLIENT_VERSION=1.0.0
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## License Activation

1. Start the application
2. Go to the license activation page
3. Enter your license key
4. The application will validate with the main backend and activate your license

## Features Available by License Plan

### Basic Plan
- Up to 1,000 emails per month
- Maximum 100 recipients per email
- Basic email sending
- Standard templates

### Professional Plan
- Up to 10,000 emails per month
- Maximum 500 recipients per email
- QR code generation
- File attachments
- Domain logos
- HTML to PDF conversion

### Enterprise Plan
- Up to 100,000 emails per month
- Maximum 1,000 recipients per email
- All Professional features
- SMTP rotation
- API access
- Priority support

## API Endpoints

### License Management
- `POST /api/license/activate` - Activate license
- `GET /api/license/status` - Get license status
- `POST /api/license/refresh` - Refresh license
- `POST /api/license/deactivate` - Deactivate license

### Email Operations (Proxied to Main Backend)
- `POST /api/emails/send` - Send emails
- `GET /api/emails/status/:jobId` - Get email job status
- `POST /api/original/sendMail` - Send emails (legacy API)

### Configuration (Proxied to Main Backend)
- `GET /api/config/load` - Load configuration
- `GET /api/config/smtp` - Get SMTP config
- `GET /api/config/loadLeads` - Load mailing list

## Security

- All email operations require valid license validation
- Communication with main backend is encrypted
- License tokens are JWT-based with expiration
- API key authentication protects backend access

## Support

Contact support@yourcompany.com for license issues or technical support.