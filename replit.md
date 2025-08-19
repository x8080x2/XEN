# Overview
This project is a sophisticated web-based email marketing platform that replicates and enhances the functionality of an Electron email sender application. Built with modern web technologies, it serves as a comprehensive email campaign management tool with advanced personalization, content conversion, and delivery optimization capabilities. The platform enables users to execute sophisticated email marketing campaigns, offering features such as bulk email sending with rate limiting, dynamic content personalization, multi-format content conversion (HTML to PDF, PNG, DOCX), QR code integration, automatic domain logo fetching, real-time progress tracking, template-based file management, and INI-based configuration with UI overrides. The business vision is to provide an enterprise-grade email marketing solution with advanced personalization, content generation, and delivery optimization features.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite for building.
- **UI/UX**: Radix UI components integrated with Tailwind CSS, following a shadcn/ui design system with a dark theme and a custom professional color palette.
- **State Management**: React Query for server state management.
- **Routing**: Wouter for lightweight client-side routing.

## Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL, accessed via Drizzle ORM for type-safe operations.
- **Email Service**: Nodemailer for SMTP email sending.
- **File Handling**: Multer for processing file uploads.
- **Storage**: An abstract storage interface (IStorage) with an in-memory default.

## Data Architecture
- **Database Schema**: Structured with tables for users, email configurations, jobs, logs, and application settings.
- **Type Safety**: Shared TypeScript schemas, validated with Drizzle and Zod.

## Email Processing System
- **Job-based**: Email campaigns are managed as trackable jobs.
- **Placeholder System**: Supports dynamic content replacement using user-specific, random, and computed placeholders.
- **Attachments**: Robust file upload and attachment processing.
- **Progress Tracking**: Provides real-time updates and logging for email sending operations.
- **Conversion**: Supports HTML content conversion to HTML, PDF, PNG, and DOCX formats.
- **Image Overlays**: Integrates a hidden image overlay system for precise positioning.
- **QR Code Generation**: Advanced QR code system with multiple rendering modes and comprehensive customization options (Main HTML Body, HTML2IMG_BODY, HTML_CONVERT Attachment). QR codes integrate with the comprehensive placeholder system for recipient personalization and dynamic content.
- **Configuration**: Loads settings from `setup.ini` and `smtp.ini`, with automatic application on startup, merging with environment variables and UI settings (UI settings having the highest priority).

## Core Functionality Decisions
- **`sendMail()`**: Executes complete email campaigns with advanced processing, including configuration loading, recipient processing, template loading, batch processing, content processing (placeholders, QR codes, domain logos), optional HTML2IMG conversion, attachment generation, SMTP sending, and real-time progress reporting.
- **`processPlaceholders()`**: Replaces placeholder variables with dynamic content (e.g., recipient info, random data, generated values, date/time, sender info).
- **`generateQRCode()`**: Creates dynamic QR codes supporting link personalization, random metadata, visual customization, multiple formats (PNG buffers, data URLs), and high error correction.
- **`fetchDomainLogo()`**: Automatically fetches and integrates domain logos from prioritized sources (Icons.duckduckgo.com, Logo.dev, Brandfetch, Clearbit API) with cross-domain detection and performance caching.
- **`convertHtmlToAttachment()`**: Converts HTML templates to PDF, PNG, and DOCX formats, embedding QR codes and domain logos while preserving styling.
- **HTML2IMG_BODY Processing**: Converts the entire email body to a clickable PNG image using Puppeteer, replacing the email body with the image and linking it to a specified URL.
- **Browser Pool Management**: Optimizes browser resource usage for conversions (max 2 browsers, 3 pages each) with lifecycle management and memory optimization.
- **Memory Monitoring**: Prevents system resource exhaustion with threshold monitoring and periodic checks.
- **File Structure**: Monorepo organized with distinct client, server, and shared codebases, with common schemas and types shared across frontend and backend.

# External Dependencies

## Core Framework Dependencies
- **Express.js**: Backend API framework.
- **React**: Frontend UI library.
- **Vite**: Frontend build tool.

## Database and ORM
- **@neondatabase/serverless**: Serverless PostgreSQL client.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **drizzle-kit**: Database schema management.

## Email Services
- **Nodemailer**: SMTP email sending.

## UI and Styling
- **Tailwind CSS**: Utility-first CSS framework.
- **Radix UI**: Headless UI components.
- **shadcn/ui**: Design system.
- **Lucide React**: Icon library.

## File Processing
- **Multer**: Multipart/form-data handler.

## State Management and HTTP
- **@tanstack/react-query**: Server state management.
- **React Hook Form**: Form handling.
- **Wouter**: Lightweight routing for React.

## Validation and Utilities
- **Zod**: TypeScript-first schema validation.
- **drizzle-zod**: Drizzle ORM and Zod integration.
- **qrcode**: QR code generation library.
- **Puppeteer**: Headless Chrome for HTML to PDF/PNG conversions.
- **html-docx-js**: HTML to DOCX conversion.