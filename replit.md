# Overview

This is an advanced email marketing platform that enables bulk email sending with sophisticated features including AI-powered content generation, QR code integration, template management, and SMTP rotation. The application exists in two deployment modes:

1. **Web Application**: Full-featured SaaS platform hosted on Replit with user authentication, license management, and Telegram bot integration
2. **Desktop Application**: Electron-based standalone client that connects to the backend server for processing while maintaining local file access

The system is designed for high-volume email campaigns with support for template customization, dynamic content replacement, attachment handling, and real-time progress tracking.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Technology Stack

**Frontend**:
- React 18 with TypeScript
- Vite for build tooling and development server
- TailwindCSS with custom dark theme (shadcn/ui component library)
- Wouter for routing (web), Hash-based routing (desktop)
- TanStack Query for state management
- React Hook Form with Zod validation

**Backend**:
- Node.js with Express
- TypeScript throughout
- Drizzle ORM with PostgreSQL (Neon serverless)
- Nodemailer for email sending
- Puppeteer for HTML rendering
- Multiple file format support (HTML, PDF, DOCX, ZIP)

**Desktop Client**:
- Electron wrapper around React frontend
- IPC communication for file system access
- HTTP API calls to Replit backend for email processing
- Local configuration management (INI files)

## Database Architecture

Uses Drizzle ORM with PostgreSQL schema including:
- **users**: User authentication and profile data
- **licenses**: License key management with hardware fingerprinting
- **appSettings**: User-specific configuration storage (SMTP, templates, etc.)
- **emailConfigs**: Multiple SMTP configuration support

Database connection via Neon serverless PostgreSQL, configured through `DATABASE_URL` environment variable.

## Email Sending Architecture

**Dual-Mode Processing**:
- **Web Mode**: Direct server-side processing with progress tracking
- **Desktop Mode**: Client initiates request to backend API, polls for progress

**SMTP Management**:
- Multiple SMTP configuration support with rotation capability
- Per-email SMTP selection or automatic rotation
- Configuration stored in database (web) or INI files (desktop)
- Fallback mechanisms for SMTP failures

**Template System**:
- HTML-based templates with dynamic placeholders: `{email}`, `{user}`, `{domain}`, `{link}`, `{date}`, `{domainlogo}`
- Logo insertion from file system or URLs
- QR code generation with optional hidden image overlay
- Support for multiple attachment formats (PDF, DOCX, ZIP)

**Progress Tracking**:
- Real-time progress via HTTP polling (desktop) or Server-Sent Events (web)
- Detailed logging of success/failure per recipient
- Automatic retry logic for failed sends
- Rate limiting and delay controls

## AI Integration

Uses Google Gemini 2.0 Flash for:
- Dynamic subject line generation based on email content
- Sender name generation for personalization
- Context-aware suggestions matching email body

AI features are optional and require API key initialization. Service is designed to gracefully degrade if unavailable.

## File Management

**Server-Side**:
- Template storage in `files/` directory
- Logo storage in `files/logo/` directory
- Temporary file cleanup system with automatic garbage collection
- Support for external file references via URLs

**Desktop Client**:
- Local file system access via Electron IPC
- Fallback to backend API if IPC unavailable
- INI-based configuration in `config/` directory
- Leads management in text files

## License Management System

**Hardware Fingerprinting**:
- IP-based hardware ID generation (desktop)
- SHA-256 hashing for privacy
- Stored in database for license validation

**License Types**:
- Active licenses with optional expiration dates
- Revoked license support
- Telegram user association for remote management

**Validation Flow**:
- License key normalization (uppercase, trim, remove backticks)
- Hardware ID verification on activation
- Expiration date checking
- Status validation (active/expired/revoked)

## Telegram Bot Integration

Optional Telegram bot for license management:
- License generation and distribution
- Status checking and revocation
- User-package distribution as ZIP files
- Admin-only access control via chat ID whitelist
- Webhook-based updates (no polling)

## External Dependencies

**Third-Party Services**:
- **Neon Database**: Serverless PostgreSQL hosting
- **Google Cloud Storage**: Optional file storage (SDK integrated but not actively used)
- **Google Gemini AI**: Content generation (optional, API key required)
- **Telegram Bot API**: License management automation (optional)

**Email Infrastructure**:
- Customer-provided SMTP servers (no built-in email service)
- Support for standard SMTP protocols (TLS/SSL)
- No vendor lock-in for email delivery

**Development Tools**:
- Replit for hosting and development
- Vite plugin for runtime error overlay
- Cartographer plugin for Replit integration (dev only)

## Security Considerations

**Authentication**:
- Password hashing with bcryptjs
- Session-based authentication (web mode)
- License key validation (desktop mode)

**Input Validation**:
- Zod schemas for all user inputs
- Path traversal prevention in file operations
- Email format validation
- File size limits (10MB per file, 10 files max)

**Error Handling**:
- Global error handlers prevent crashes
- Detailed logging without exposing sensitive data
- Graceful degradation for optional features
- Process cleanup on startup to prevent resource leaks

## Deployment Architecture

**Web Deployment**:
- Single server deployment on Replit
- Static assets served from `dist/public`
- API routes under `/api` prefix
- Environment variables for configuration

**Desktop Distribution**:
- Electron builder for packaging
- Requires `.env` file with `LICENSE_KEY` and `REPLIT_SERVER_URL`
- Auto-update capability (configured but not implemented)
- Cross-platform support (Windows, macOS, Linux)