# Email Sender Application

## Overview

This is an email sending application that operates in two modes: a web-based interface hosted on Replit and a desktop Electron application. The system enables bulk email sending with advanced features including template management, SMTP rotation, license verification, and AI-powered content generation.

The application uses a client-server architecture where the web interface runs on Replit's infrastructure while the desktop application can communicate with the Replit backend or operate independently with local file storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Dual-Mode React Application**
- **Web Mode**: React SPA using Wouter for routing, served by Vite
- **Desktop Mode**: Electron wrapper around the same React codebase with hash-based routing
- **Shared UI Components**: Radix UI components with Tailwind CSS for consistent dark-themed interface
- **State Management**: TanStack Query for server state, local React state for UI

**Desktop-Specific Features**
- Electron main process handles file system operations, SMTP config management, and license verification
- Preload script exposes secure IPC bridge for renderer process communication
- Local file storage for templates, leads, and configuration in INI format
- Hardware fingerprinting using IP-based identification for license enforcement

**Web-Specific Features**
- Direct API communication with Express backend
- SSE (Server-Sent Events) for real-time email sending progress
- File upload handling through multipart form data

### Backend Architecture

**Express Server with Modular Routing**
- Main routes split into three categories:
  - Original email routes (`/api/original/*`) - streaming-based email sending
  - Electron routes (`/api/electron/*`) - file operations for desktop app
  - AI routes (`/api/ai/*`) - Google Gemini integration

**Email Service Architecture**
- **Advanced Email Service**: Core service handling email composition, template processing, and sending
- **SMTP Management**: Support for single SMTP config or rotation through multiple configs
- **Template System**: HTML templates with dynamic placeholder replacement (`{user}`, `{email}`, `{link}`, `{domain}`, etc.)
- **Attachment Handling**: Support for multiple file types with automatic MIME type detection

**Key Design Decisions**
- **Streaming vs. Polling**: Original implementation uses SSE streaming for live progress updates rather than job-based polling
- **Dual API Support**: Separate endpoints maintain compatibility with both web and desktop clients
- **Graceful AI Degradation**: AI features are optional - system works without Gemini API key

### Data Storage

**PostgreSQL with Drizzle ORM**
- **Database**: Neon serverless PostgreSQL instance
- **Schema Management**: Drizzle Kit for migrations and schema synchronization
- **Tables**:
  - `licenses` - License key management with hardware binding and expiration
  - `users` - User authentication (currently minimal usage)
  - `appSettings` - Per-user configuration storage

**File System Storage**
- Configuration files in INI format (`config/setup.ini`, `config/smtp.ini`)
- Email templates as HTML files in `files/` directory
- Logo files in `files/logo/` for email branding
- Lead lists as text files (`files/leads.txt`)

**File Service with Fallback Strategy**
- Attempts to read from multiple directory locations (main project vs. user-package)
- Validates file paths to prevent directory traversal attacks
- Temporary file tracking for automatic cleanup

### Authentication & Authorization

**License Verification System**
- Hardware-bound licenses using IP address fingerprinting
- One license per computer enforcement
- License states: active, expired, revoked
- Optional expiration date support
- Telegram bot integration for license management by admins

**License Verification Flow**
1. Desktop app generates hardware fingerprint from network interface IP
2. Sends license key + fingerprint to backend
3. Backend checks license status, expiration, and hardware binding
4. On first activation, hardware ID is recorded
5. Subsequent verifications enforce hardware match

**Admin Access Control**
- Telegram bot commands restricted to admin chat IDs
- Environment variable `TELEGRAM_ADMIN_CHAT_IDS` defines authorized users
- Desktop app blocks usage if license verification fails

### Email Processing

**Template Processing Pipeline**
1. Load HTML template from file system
2. Parse and validate template structure
3. Replace dynamic placeholders with recipient-specific data
4. Optional AI enhancement (subject line, sender name)
5. Generate QR codes with optional hidden images
6. Attach files if specified
7. Send via SMTP with retry logic

**SMTP Rotation Strategy**
- Config service loads multiple SMTP configs from `smtp.ini`
- Rotation can be enabled/disabled via API or config file
- Sequential rotation through available configs
- Fallback to single config if rotation disabled

**Progress Tracking**
- In-memory log storage for real-time progress updates
- SSE stream sends events for each email sent
- Logs include recipient, status, timestamp, and error details
- Progress data: total sent, failed, and percentage complete

### External Dependencies

**Google Gemini AI Service**
- **Purpose**: Generate contextual subject lines and sender names
- **API**: Google Generative AI SDK (`@google/generative-ai`)
- **Model**: `gemini-2.0-flash-exp`
- **Graceful Degradation**: Service continues without AI if API key missing
- **Initialization**: Dynamic API key configuration via `/api/ai/initialize`

**Telegram Bot Service**
- **Purpose**: License management and desktop app distribution
- **Library**: `node-telegram-bot-api`
- **Webhook Mode**: Receives updates at `/api/telegram/webhook`
- **Commands**: 
  - `/start` - Welcome message
  - `/generate` - Create new license
  - `/status <key>` - Check license status
  - `/revoke <key>` - Revoke license
  - `/download <key>` - Package and send desktop app with license

**Email Sending**
- **Library**: Nodemailer
- **Transports**: SMTP with TLS/SSL support
- **Features**: HTML emails, attachments, custom headers

**File Processing**
- **Image Manipulation**: Jimp for QR code compositing
- **QR Generation**: qrcode library
- **Archive Creation**: archiver for ZIP packaging
- **HTML Conversion**: html-to-text for plain text fallback

**Database**
- **Provider**: Neon serverless PostgreSQL
- **Driver**: `@neondatabase/serverless`
- **ORM**: Drizzle ORM with HTTP adapter

**Build & Development**
- **Web Bundler**: Vite for React application
- **Desktop Bundler**: Electron Builder
- **Server Bundler**: esbuild for Express backend
- **CSS**: Tailwind CSS with custom dark theme
- **TypeScript**: Shared types across client/server