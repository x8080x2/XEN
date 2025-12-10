# Email Sender Application

## Overview

This is a full-stack email sender application with both web and desktop (Electron) versions. The application enables bulk email sending with advanced features including SMTP rotation, AI-powered content generation, template management, QR code generation, and license-based access control. The system is built with a React frontend, Express backend, and uses PostgreSQL (via Neon) for data persistence.

The application supports two deployment modes:
- **Web Mode**: Hosted on Replit with all features accessible via browser
- **Desktop Mode**: Standalone Electron application that connects to the Replit backend server

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling and development server
- TanStack Query (React Query) for server state management
- Wouter for client-side routing
- Shadcn/ui component library (Radix UI primitives)
- Tailwind CSS for styling with custom dark theme

**Design Pattern:**
- Component-based architecture with separation of UI components and page components
- Custom hooks for reusable logic (toast notifications, form handling)
- Shared component library between web and desktop versions
- Hash-based routing in desktop mode, standard routing in web mode

**Key Components:**
- `OriginalEmailSender`: Main email sending interface with form controls, progress tracking, and SMTP management
- `SMTPManager`: Dialog-based SMTP configuration manager with rotation capabilities
- UI component library in `components/ui/`: Reusable form elements, dialogs, progress bars, toasts

### Backend Architecture

**Technology Stack:**
- Node.js with Express
- TypeScript for type safety
- Drizzle ORM for database operations
- Neon serverless PostgreSQL
- Nodemailer for email sending
- Puppeteer for HTML-to-PDF conversion
- Google Generative AI (Gemini) for AI features

**Design Pattern:**
- Service-oriented architecture with separation of concerns
- Route handlers in `server/routes/` for different feature sets
- Business logic encapsulated in services (`server/services/`)
- Singleton pattern for shared services (email service, license service, config service)
- Middleware-based request handling with Vite integration for development

**Core Services:**
- `advancedEmailService`: Handles email composition, SMTP rotation, template rotation, attachment processing, QR code generation, and batch sending
- `licenseService`: Manages license key generation, validation, hardware fingerprinting, and expiration
- `telegramBotService`: Telegram bot integration for license management via webhooks
- `aiService`: Google Gemini integration for generating email subjects and sender names
- `fileService`: File upload/download handling with security validation
- `configService`: INI-based configuration loading for desktop compatibility

**API Routes:**
- `/api/original/*`: Core email sending functionality (exact clone of original implementation)
- `/api/electron/*`: Desktop-compatible endpoints for file operations
- `/api/ai/*`: AI service initialization and content generation
- `/api/smtp/*`: SMTP configuration management
- `/api/telegram/webhook`: Telegram bot webhook handler

### Data Storage

**Database Schema (PostgreSQL via Neon):**
- `users`: User accounts with authentication credentials
- `licenses`: License keys with hardware binding, Telegram integration, expiration tracking
- `appSettings`: Key-value store for user-specific configuration (SMTP configs, AI settings)

**Database Access:**
- Drizzle ORM with Neon serverless driver for connection pooling
- Schema-first design with TypeScript types generated from schema
- Transaction support for atomic operations
- Database URL configured via environment variable

**File Storage:**
- Local file system for templates (`files/`), logos (`files/logo/`), and uploads (`uploads/`)
- Configuration files in INI format (`config/setup.ini`, `config/smtp.ini`)
- Temporary file cleanup with automatic garbage collection
- Desktop mode supports local file access with fallback to server

### Authentication and Authorization

**License-based Access Control:**
- Hardware fingerprinting using IP-based SHA-256 hashing
- License activation binds to specific hardware ID
- Expiration date validation for time-limited licenses
- Status tracking (active, expired, revoked)
- Telegram integration for license distribution and management

**Session Management:**
- Cookie-based sessions for web version
- License key verification for desktop version
- Hardware ID validation on each request in desktop mode

### External Dependencies

**Email Infrastructure:**
- Nodemailer with SMTP transport
- Multi-SMTP configuration with automatic rotation
- Template rotation: cycles through multiple HTML templates per-email
  - Web mode: scans server `files/` folder for HTML templates when rotation toggle enabled
  - Desktop mode: uses templates from user's local `files/` folder (sent via `rotatingTemplates` array in request)
  - Single template: uses the provided template as main body without rotation
  - Multiple templates: rotates through templates for each recipient
- Support for attachments, HTML content, and inline images
- QR code generation with QRCode library
- Image composition with Jimp

**AI Integration:**
- Google Generative AI (Gemini 2.0 Flash)
- Dynamic initialization with API key
- Subject line and sender name generation based on email content
- Context-aware generation with industry and recipient data

**File Processing:**
- Puppeteer for HTML-to-PDF conversion
- Archiver for ZIP file creation
- html-docx-js for HTML-to-Word conversion
- AdmZip for ZIP extraction
- Multer for multipart form data handling

**Telegram Bot:**
- node-telegram-bot-api with webhook mode
- Admin-based access control via chat IDs
- License management commands (/generate, /status, /revoke)
- Desktop app distribution via file uploads

**Development Tools:**
- Vite with HMR for development
- Replit-specific plugins for runtime error overlay and cartographer
- esbuild for production bundling
- Drizzle Kit for database migrations

**Desktop (Electron) Dependencies:**
- Electron for cross-platform desktop app
- IPC (Inter-Process Communication) for main-renderer communication
- Axios for HTTP requests to backend server
- Environment-based configuration for server URL
- Hardware fingerprinting for license validation