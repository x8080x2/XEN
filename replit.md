# Overview

This is a full-stack email sender application with both web and desktop (Electron) versions. The application provides advanced email campaign management with features like SMTP rotation, template management, AI-powered subject/sender generation, license management via Telegram bot, and comprehensive tracking. It's built as a monorepo containing a web application (Express + React) and a packaged desktop application (Electron wrapper) that connects to the web server.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool

**UI Library**: Shadcn UI components built on Radix UI primitives with Tailwind CSS for styling

**Routing**: Wouter for lightweight client-side routing (web app) and hash-based routing (desktop app)

**State Management**: React hooks with localStorage persistence for settings; TanStack Query for server state

**Design System**: 
- Dark theme with custom color palette (red primary accent)
- Consistent 14px base font size
- Custom CSS variables for theming
- Responsive layouts with Tailwind utilities

**Dual Application Mode**:
- Web version: Standard React SPA served from `/client`
- Desktop version: Electron app in `/user-package` that wraps the same UI but connects to remote server
- Both share identical UI components and styling (synced via `sync-styles.js` script)

## Backend Architecture

**Runtime**: Node.js with TypeScript and ESM modules

**Web Framework**: Express.js

**API Design**: RESTful endpoints organized by feature:
- `/api/original/*` - Core email sending functionality (exact clone of original system)
- `/api/electron/*` - File system operations for desktop app
- `/api/ai/*` - AI service integration (Google Gemini)
- `/api/smtp/*` - SMTP configuration management
- `/api/telegram/*` - Telegram bot webhook endpoints

**Email Processing**:
- Nodemailer for SMTP transport
- Support for HTML templates with variable replacement (`{user}`, `{domain}`, `{link}`, etc.)
- File attachments with multiple format support (.msg, .docx, .zip, QR codes)
- HTML-to-text conversion for plain text fallbacks
- Puppeteer for HTML screenshot/PDF generation
- QR code generation with hidden image compositing

**File Management**:
- Template storage in `/files` directory
- Logo storage in `/files/logo`
- Config files in `/config` (INI format for SMTP and setup)
- Multer for file upload handling with size limits (10MB per file, max 10 files)
- Fallback system for desktop vs server file access

**SMTP Rotation System**:
- Multiple SMTP configurations stored in `/config/smtp.ini`
- Rotation toggle stored in JSON config
- Round-robin rotation support for load distribution
- Separate SMTP per email or per batch

**AI Integration**:
- Google Gemini API for subject line and sender name generation
- Context-aware generation based on HTML content
- Initialize/deinitialize pattern for API key management
- Fallback to manual input when AI is not initialized

**License Management**:
- Hardware-based activation using IP address fingerprinting
- License status tracking (active, expired, revoked)
- Telegram bot integration for license distribution and management
- Webhook-based bot updates (no polling)

**Error Handling**:
- Global uncaught exception handlers (log but don't crash)
- Process cleanup on startup (Unix systems only)
- Validation using Zod schemas
- Graceful fallbacks for missing resources

## Data Storage

**Database**: PostgreSQL via Neon serverless driver

**ORM**: Drizzle ORM with schema-first design

**Schema Design**:
- `users` - User authentication and profiles
- `licenses` - License keys with hardware binding and Telegram integration
- `appSettings` - User-specific application settings (JSON blob storage)
- `emailConfigs` - SMTP configurations per user

**Schema Location**: `/shared/schema.ts` (shared between client and server)

**Migration Strategy**: Drizzle Kit with push-based migrations (`npm run db:push`)

## External Dependencies

**Email Services**:
- Nodemailer - SMTP client for email sending
- Custom SMTP configuration system supporting multiple providers
- Support for authenticated SMTP with TLS/SSL

**AI Services**:
- Google Gemini API (`@google/generative-ai`) for content generation
- Model: `gemini-2.0-flash-exp`
- Use cases: Subject line generation, sender name personalization

**Telegram Integration**:
- `node-telegram-bot-api` for bot functionality
- Webhook-based updates to `/api/telegram/webhook`
- Admin-only commands for license management
- Automatic license key generation and distribution

**Cloud Storage**:
- Google Cloud Storage (`@google-cloud/storage`) integration available
- Used for file uploads and template distribution

**Image Processing**:
- Jimp for QR code composition and image manipulation
- QRCode library for QR generation
- Puppeteer for HTML rendering to images

**File Processing**:
- Archiver for ZIP creation
- AdmZip for ZIP extraction
- html-docx-js for DOCX generation from HTML

**Desktop App (Electron)**:
- Electron framework for native desktop wrapper
- IPC communication via preload script (`preload.js`)
- Hardware fingerprinting using OS network interfaces
- Environment-based server URL configuration
- electron-builder for distribution packaging

**Development Tools**:
- Vite with React plugin and Replit-specific plugins
- TypeScript with strict mode
- ESBuild for server bundling
- PostCSS with Tailwind and Autoprefixer

**Configuration Management**:
- INI file parsing for SMTP and setup configs
- JSON for SMTP rotation settings
- Environment variables for sensitive data (DATABASE_URL, LICENSE_KEY, Telegram tokens)
- localStorage for client-side settings persistence