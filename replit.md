# Email Sender Application

## Overview

This is a full-stack email sending application with both web and desktop (Electron) versions. The application allows users to send bulk emails with customizable templates, SMTP rotation, QR code generation, AI-powered content generation, and comprehensive progress tracking. The system includes a Telegram bot for license management and supports both web-based and standalone desktop deployment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Web Application (React + Vite)**
- **UI Framework**: React with TypeScript using Vite as the build tool
- **Component Library**: Shadcn UI components built on Radix UI primitives with Tailwind CSS
- **State Management**: React hooks for local state, TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom dark theme design system
- **Design Pattern**: Single-page application with component-based architecture

**Desktop Application (Electron)**
- **Packaging**: Electron wrapper around the React web application
- **Architecture**: Separate `user-package` directory containing desktop-specific code
- **IPC Communication**: Electron IPC for file system operations and local configuration
- **Hybrid Mode**: Desktop app connects to Replit backend server for email processing and AI features
- **Configuration**: Uses local INI files (`setup.ini`, `smtp.ini`) for SMTP and settings management

### Backend Architecture

**Server Framework**
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ES modules
- **Build Tool**: esbuild for production bundling
- **Development**: tsx for TypeScript execution in development mode

**Service Layer Pattern**
- **advancedEmailService**: Core email sending functionality with template processing, QR code generation, attachment handling, and SMTP management
- **aiService**: Google Gemini integration for AI-powered subject line and sender name generation
- **fileService**: File upload, validation, and temporary file cleanup with security controls
- **configService**: INI file parsing and configuration loading for desktop compatibility
- **licenseService**: License key generation, validation, and hardware fingerprint verification
- **telegramBotService**: Telegram bot integration for license management and user notifications

**API Design**
- RESTful endpoints organized by feature (original email, Electron compatibility, AI)
- Dual-mode support: web routes (`/api/original/*`) and desktop routes (`/api/electron/*`)
- HTTP polling for email progress tracking
- Webhook support for Telegram bot integration

### Data Storage Solutions

**Database**
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Provider**: Neon Database serverless PostgreSQL via `@neondatabase/serverless`
- **Schema Location**: `shared/schema.ts` for type-safe database operations
- **Migration**: Drizzle Kit for schema management and migrations

**Database Schema**
- **users**: User authentication (id, username, email, passwordHash, createdAt)
- **appSettings**: Per-user configuration storage (userId, settingsType, settingsData)
- **licenses**: License key management (licenseKey, status, telegramUserId, hardwareId, expiresAt)
- **emailConfigs**: SMTP configuration storage (userId, name, smtp credentials)

**File Storage**
- **Local Files**: Template HTML files and logo images stored in `files/` directory
- **Uploads**: Temporary file storage in `uploads/` directory with automatic cleanup
- **Desktop Config**: INI-based configuration files in `config/` directory for Electron app

### Authentication and Authorization

**License-Based Access Control**
- Hardware fingerprint generation using IP address hashing
- License key validation with status tracking (active, expired, revoked)
- Telegram user linking for license distribution
- No traditional user authentication for desktop app (license-based)

**Desktop App Security**
- Environment variable-based license key and server URL configuration
- Hardware ID verification on license activation
- Secure IPC communication between Electron main and renderer processes

### External Dependencies

**Third-Party Services**

1. **Google AI (Gemini)**
   - Purpose: AI-powered email content generation
   - Integration: `@google/generative-ai` SDK
   - Features: Subject line generation, sender name suggestions
   - Model: gemini-2.0-flash-exp

2. **Neon Database**
   - Purpose: Serverless PostgreSQL hosting
   - Integration: `@neondatabase/serverless` driver
   - Connection: HTTP-based connection pooling via Drizzle ORM

3. **Telegram Bot API**
   - Purpose: License management and distribution
   - Integration: `node-telegram-bot-api`
   - Features: Webhook-based message processing, admin-only commands, license generation

4. **Google Cloud Storage** (Optional)
   - Package: `@google-cloud/storage`
   - Purpose: Potential cloud file storage (currently unused in active codebase)

**Email Services**
- **SMTP**: Direct SMTP connection via `nodemailer`
- **SMTP Rotation**: Multiple SMTP server support with automatic rotation
- **Features**: HTML email, attachments, embedded images, QR codes

**UI Component Libraries**
- **Radix UI**: Headless accessible components (@radix-ui/react-*)
- **Shadcn UI**: Pre-built component patterns using Radix primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide Icons**: Icon library for UI elements

**Development Tools**
- **Vite**: Frontend build tool with HMR
- **Drizzle Kit**: Database schema management and migrations
- **TypeScript**: Type-safe development
- **Replit**: Deployment platform with development environment integration

**Email Processing Libraries**
- **Puppeteer**: HTML to PDF conversion
- **QRCode**: QR code generation for tracking
- **Jimp**: Image manipulation for QR code composition
- **html-to-text**: Plain text email fallback generation
- **html-docx-js**: HTML to DOCX conversion for attachments
- **archiver**: ZIP file creation for bulk attachments