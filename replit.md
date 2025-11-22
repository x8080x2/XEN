# Email Sender Application

## Overview

This is a full-stack email sending application built with Express.js backend and React frontend. The application supports both web-based and desktop (Electron) deployments, enabling users to send bulk emails with customizable templates, SMTP configuration management, AI-powered content generation, and license-based access control via Telegram bot integration.

The system includes advanced features like QR code generation with hidden images, email template management, file attachments, SMTP rotation, and real-time progress tracking through Server-Sent Events (SSE).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript
- Vite as build tool and dev server
- TanStack React Query for server state management
- Wouter for routing (hash-based routing in desktop app)
- Radix UI components with shadcn/ui styling system
- Tailwind CSS for styling with custom dark theme

**Dual Deployment Strategy:**
- **Web Application** (`client/`): Standard SPA served by Express
- **Desktop Application** (`user-package/`): Electron wrapper with identical UI, uses hash-based routing and communicates with backend via REST APIs

**Key Design Decisions:**
- Component-based architecture with reusable UI components
- Dark theme as default with custom color palette (red primary accent)
- Real-time progress tracking via SSE for email sending operations
- Desktop app syncs styles from web app using `sync-styles.js` script
- Shared component library between web and desktop versions

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Drizzle ORM with Neon PostgreSQL database
- Node.js native modules for file operations
- Modular service-based architecture

**Core Services:**

1. **Email Service** (`advancedEmailService.ts`): Handles all email operations including template processing, QR code generation with hidden images, file attachments (zip, docx conversion), HTML sanitization, and SMTP communication via nodemailer

2. **AI Service** (`aiService.ts`): Google Gemini AI integration for generating email subjects and sender names based on content analysis

3. **License Service** (`licenseService.ts`): Manages license key generation, validation, activation with hardware fingerprinting, and expiration tracking

4. **File Service** (`fileService.ts`): Manages file uploads, template storage with fallback support between `files/` and `user-package/files/`, and temporary file cleanup

5. **Config Service** (`configService.ts`): Loads configuration from INI files, manages SMTP rotation logic, and provides desktop app compatibility

6. **Telegram Bot Service** (`telegramBotService.ts`): Webhook-based bot for license management, supports admin commands for generating and revoking licenses, and provides desktop app package downloads

**API Design:**
- RESTful endpoints organized by feature (`/api/original/*`, `/api/electron/*`, `/api/ai/*`, `/api/smtp/*`)
- Separate route modules for clean separation of concerns
- Multer middleware for file upload handling with size and file count limits
- Validation using Zod schemas for input sanitization

**Key Architectural Decisions:**

- **Service Layer Pattern**: Business logic isolated in service classes for reusability and testability
- **Dual Client Support**: Routes handle both web and Electron clients with fallback mechanisms
- **Error Handling**: Comprehensive error handling with process-level handlers to prevent crashes
- **File Management**: Smart fallback system that checks multiple directories for templates and assets
- **SMTP Rotation**: Configurable rotation between multiple SMTP servers to distribute load

### Database Architecture

**ORM:** Drizzle with PostgreSQL dialect (Neon serverless)

**Schema Design** (`shared/schema.ts`):

1. **Users Table**: Stores user credentials with bcrypt password hashing
2. **Email Configs Table**: Multiple SMTP configurations per user
3. **App Settings Table**: JSON-based settings storage per user and settings type
4. **Licenses Table**: License key management with hardware binding, Telegram user association, status tracking, and expiration dates

**Migration Strategy:**
- Schema defined in `shared/schema.ts`
- Drizzle Kit for migrations with `npm run db:push`
- Database URL from environment variable

**Key Decisions:**
- Neon serverless PostgreSQL for scalability and ease of deployment
- JSON columns for flexible settings storage
- Hardware ID binding for license enforcement
- Telegram user ID integration for license distribution

### External Dependencies

**Third-Party Services:**

1. **Neon Database**: Serverless PostgreSQL hosting, configured via `DATABASE_URL` environment variable

2. **Google Cloud Storage** (`@google-cloud/storage`): Optional integration for file storage (present in dependencies but usage limited in codebase)

3. **Google Gemini AI** (`@google/generative-ai`): AI content generation for email subjects and sender names, requires API key initialization, uses `gemini-2.0-flash-exp` model

4. **Telegram Bot API** (`node-telegram-bot-api`): Webhook-based bot integration for license distribution and management, requires bot token and admin chat IDs

**Email Infrastructure:**

- **Nodemailer**: Core email sending library with support for multiple SMTP transports
- **SMTP Servers**: User-configured external SMTP providers (Gmail, custom servers, etc.)
- **Email Template Processing**: Supports HTML templates with variable substitution (`{user}`, `{email}`, `{domain}`, `{link}`, etc.)

**File Processing Libraries:**

1. **Puppeteer**: HTML to image conversion for email rendering
2. **QRCode**: QR code generation with custom logo overlay support
3. **Jimp**: Image manipulation for QR code composition with hidden images
4. **Archiver**: ZIP file creation for bulk attachments
5. **AdmZip**: ZIP extraction for processing
6. **html-docx-js**: HTML to DOCX conversion
7. **html-minifier-terser**: HTML minification
8. **html-to-text**: HTML to plain text conversion

**UI Component Libraries:**

- **Radix UI**: Headless accessible component primitives
- **shadcn/ui**: Pre-styled components built on Radix UI
- **Lucide React**: Icon library
- **Tailwind CSS**: Utility-first CSS framework

**Development Tools:**

- **Vite**: Fast build tool and dev server
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Backend bundling for production
- **Drizzle Kit**: Database migrations and introspection

**Electron Desktop App:**

- **Electron**: Desktop application wrapper
- **Electron Builder**: Desktop app packaging and distribution
- **Concurrently**: Runs Vite dev server and Electron simultaneously
- **Dotenv**: Environment variable management for license keys and server URLs

**Key Integration Points:**

- Environment variables for API keys and service credentials
- Webhook endpoint for Telegram bot (`/api/telegram/webhook`)
- File storage in `files/` and `user-package/files/` directories
- License verification on desktop app startup with hardware fingerprinting
- Config files in `config/` directory for SMTP and app settings (INI format)