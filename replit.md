# Overview
This project is a web-based email marketing platform that replicates and enhances an Electron email sender application. It provides comprehensive email campaign management with advanced personalization, content conversion (HTML to PDF, PNG, DOCX), QR code integration, dynamic domain logo fetching, real-time progress tracking, template management, and INI-based configuration with UI overrides. The platform aims to be an enterprise-grade solution for sophisticated email marketing with a focus on personalization, content generation, and delivery optimization.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend uses React with TypeScript and Vite, styled with Radix UI components and Tailwind CSS, adhering to a shadcn/ui dark theme with a custom professional color palette.

## Technical Implementations
- **Frontend**: React with TypeScript, Vite, Radix UI, Tailwind CSS, shadcn/ui, React Query, Wouter.
- **Backend**: Express.js with TypeScript, PostgreSQL via Drizzle ORM, Nodemailer for SMTP, Multer for file uploads.
- **Data**: PostgreSQL with Drizzle ORM, shared TypeScript schemas validated with Zod.
- **Email Processing**: Job-based campaigns, dynamic placeholder system (user, random, computed, AI-generated), robust attachment processing with personalized content for text-based attachments, real-time progress tracking, HTML conversion to PDF/PNG/DOCX, image overlays, and advanced QR code generation.
- **Configuration**: `setup.ini` and `smtp.ini` based, merged with environment variables and UI settings (UI has highest priority).
- **SMTP Management**: Supports both user-provided SMTP credentials (desktop users via `smtp.ini` and `smtp-rotation.json`) and server SMTP configuration (web users). Desktop users enforce their own SMTP credentials and can utilize SMTP rotation across multiple servers.
- **Core Functionality**: Includes `sendMail()` for comprehensive campaign execution, `processPlaceholders()` for dynamic content, `generateQRCode()` for personalized QR codes, `fetchDomainLogo()` for automatic logo integration, `convertHtmlToAttachment()` for multi-format conversions, and HTML2IMG_BODY processing.
- **Browser Pool**: Manages Puppeteer instances for conversions, optimizing resource usage and preventing exhaustion.
- **License System**: IP-based one-license-per-computer enforcement, binding licenses to a computer's IP address on first activation, with clear error messaging and license key normalization.
- **Telegram Bot Integration**: Automates desktop app distribution and license management, providing user access control for downloads and license status checks, and admin-only functions for license generation and revocation. Uses webhooks for instant message delivery.
- **File Structure**: Monorepo with distinct client, server, and shared codebases, facilitating type-safe data sharing.

## Feature Specifications
- **Attachment Placeholder Processing**: Text-based attachments (HTML, TXT, CSV, JSON, XML, MD) support full placeholder replacement per recipient.
- **QR Code Generation**: Advanced system with multiple rendering modes and comprehensive customization, integrating with the placeholder system.
- **Domain Logo Fetching**: Automatic fetching from prioritized sources (Icons.duckduckgo.com, Logo.dev, Brandfetch, Clearbit API) with caching.
- **HTML2IMG_BODY**: Converts email body to a clickable PNG image.
- **SMTP Rotation**: Desktop users can provide multiple SMTP configurations that are rotated per-email.
- **License System**: IP-based hardware binding for desktop applications, ensuring a license is tied to a single computer.
- **Telegram Bot**: Automates desktop app distribution and license management, providing distinct user and admin functionalities.

## System Design Choices
- **Database Migration**: Full migration from SQLite to PostgreSQL for production readiness, utilizing `@neondatabase/serverless` for database connection.
- **System Dependencies**: Chromium browser and graphics libraries are installed via Nix for server-side HTML conversions, with automatic system Chromium detection and fallback to Puppeteer's bundled Chrome.

# External Dependencies

## Core Frameworks
- **Express.js**: Backend API development.
- **React**: Frontend UI library.
- **Vite**: Frontend build tool.

## Database & ORM
- **@neondatabase/serverless**: PostgreSQL client.
- **Drizzle ORM**: Type-safe ORM.
- **drizzle-kit**: Database schema management.

## Email Services
- **Nodemailer**: SMTP email sending.

## UI & Styling
- **Tailwind CSS**: Utility-first CSS.
- **Radix UI**: Headless UI components.
- **shadcn/ui**: Design system.
- **Lucide React**: Icon library.

## File Processing
- **Multer**: Multipart/form-data handler.

## State Management & Routing
- **@tanstack/react-query**: Server state management.
- **React Hook Form**: Form handling.
- **Wouter**: Lightweight client-side routing.

## Utilities & Conversions
- **Zod**: Schema validation.
- **drizzle-zod**: Drizzle/Zod integration.
- **qrcode**: QR code generation.
- **Puppeteer**: Headless Chrome for HTML to PDF/PNG.
- **html-docx-js**: HTML to DOCX conversion.