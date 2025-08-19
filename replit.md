# Overview

This project is a web-based clone of the Electron email sender application, re-engineered with Express.js, React, and TypeScript. Its primary purpose is to serve as a sophisticated email marketing tool. Key capabilities include bulk email sending, dynamic content personalization through placeholders, file attachments, and real-time progress tracking. The application supports various configurable settings, ensuring a flexible and powerful email dispatch system. It aims to provide a robust and intuitive platform for managing email campaigns, leveraging modern web technologies for a seamless user experience.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite for building.
- **UI/UX**: Radix UI components integrated with Tailwind CSS, following a shadcn/ui design system. The styling incorporates a dark theme and a custom professional color palette.
- **State Management**: React Query is used for server state management.
- **Routing**: Wouter provides lightweight client-side routing.

## Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL, accessed via Drizzle ORM for type-safe operations.
- **Email Service**: Nodemailer is used for SMTP email sending.
- **File Handling**: Multer processes file uploads.
- **Storage**: An abstract storage interface (IStorage) is implemented, with an in-memory default.

## Data Architecture
- **Database Schema**: Structured with tables for users, email configurations, jobs, logs, and application settings.
- **Type Safety**: Shared TypeScript schemas, validated with Drizzle and Zod.

## Email Processing System
- **Job-based**: Email campaigns are managed as trackable jobs.
- **Placeholder System**: Supports dynamic content replacement using user-specific, random, and computed placeholders.
- **Attachments**: Includes robust file upload and attachment processing.
- **Progress Tracking**: Provides real-time updates and logging for email sending operations.
- **Conversion**: Supports HTML content conversion to HTML, PDF, PNG, and DOCX formats.
- **Image Overlays**: Integrates hidden image overlay system for precise positioning.
- **QR Code Generation**: Advanced QR code system with multiple rendering modes and comprehensive customization options.
- **Configuration**: Loads settings from setup.ini and smtp.ini, with automatic application on startup.

## QR Code System Architecture

### QR Code Processing Modes
The application supports three distinct QR code rendering contexts, each optimized for different delivery methods:

#### 1. Main HTML Body QR Processing
- **Purpose**: Displays QR codes directly in the email body for maximum visibility and interaction
- **Implementation**: Uses CID (Content-ID) attachments for email client compatibility
- **Process Flow**:
  1. Detects `{qrcode}` placeholder in HTML template
  2. Generates recipient-specific QR content with link placeholder replacement
  3. Creates QR code as PNG buffer using configured colors and dimensions
  4. Attaches QR as email attachment with CID `qrcode-main`
  5. Replaces `{qrcode}` with `<img src="cid:qrcode-main">`
- **Configuration**: Uses QR_WIDTH, QR_BORDER_WIDTH, QR_FOREGROUND_COLOR, QR_BACKGROUND_COLOR
- **Email Client Support**: Compatible with all major email clients (Gmail, Outlook, Apple Mail)

#### 2. HTML2IMG_BODY QR Processing  
- **Purpose**: Converts entire HTML body to PNG screenshot while preserving QR functionality
- **Implementation**: Renders QR codes within full-page screenshots for delivery bypass
- **Process Flow**:
  1. Takes final HTML with embedded QR codes
  2. Processes any remaining `cid:qrcode` references for screenshot rendering
  3. Converts complete HTML to PNG using Puppeteer
  4. Attaches screenshot as email attachment
  5. Preserves original HTML body with QR codes (fixed bug: previously replaced entire body)
- **Use Case**: Bypasses email filtering by delivering content as image attachment
- **Integration**: Works with existing QR codes from main HTML processing

#### 3. HTML_CONVERT Attachment QR Processing
- **Purpose**: Generates QR codes within PDF, PNG, and DOCX attachments
- **Implementation**: Embeds QR codes directly in document attachments
- **Process Flow**:
  1. Processes attachment HTML templates with `{qrcode}` placeholders
  2. Generates recipient-specific QR codes with same configuration as main HTML
  3. Embeds QR codes using data URLs (safe within document context)
  4. Converts to specified formats (PDF, PNG, DOCX) using Puppeteer/html-docx-js
  5. Attaches converted documents to email
- **Document Types**: PDF (most common), PNG images, DOCX documents
- **Styling**: Supports borders, custom colors, and positioning within documents

### QR Code Configuration System
- **Link Generation**: Base QR_LINK with LINK_PLACEHOLDER replacement per recipient
- **Randomization**: Optional RANDOM_METADATA adds unique parameters to prevent caching
- **Visual Customization**: 
  - QR_FOREGROUND_COLOR (default: #000000)
  - QR_BACKGROUND_COLOR (default: #FFFFFF) 
  - QR_WIDTH (default: 150px)
  - QR_BORDER_WIDTH (default: 2px)
  - BORDER_STYLE (solid, dotted, dashed)
  - QR_BORDER_COLOR (default: #000000)
- **Error Correction**: Uses 'H' level for maximum reliability

### Technical Implementation Details
- **Library**: Uses `qrcode` npm package for generation
- **Format Support**: PNG buffers for attachments, data URLs for documents
- **Performance**: Concurrent generation with pLimit for rate limiting
- **Error Handling**: Graceful fallback to error messages if QR generation fails
- **Memory Management**: Efficient buffer handling for large campaigns

### Placeholder System Integration
QR codes integrate with the comprehensive placeholder system:
- **Recipient Personalization**: `{user}`, `{email}`, `{domain}` in QR links
- **Dynamic Content**: `{hash6}`, `{randnum4}` for unique tracking
- **Date/Time Stamps**: `{date}`, `{time}` for temporal tracking
- **Link Replacement**: LINK_PLACEHOLDER enables per-recipient URL customization

## Recent Bug Fixes and Performance Improvements (August 2025)
- **QR Code Display Bug**: Fixed main HTML body QR code display issue where QR codes showed as text instead of images. Root cause was using data URLs (data:image/png;base64,...) which email clients block for security. Solution: Changed to use CID (Content-ID) attachments like `src="cid:qrcode-main"` for proper email client compatibility.
- **Domain Logo Display**: Fixed domain logo display in main HTML body using same CID attachment approach as QR codes.
- **Domain Logo Color Enhancement**: Implemented multiple logo sources including Logo.dev, Brandfetch, and improved Clearbit integration. Added caching system and better headers for higher quality color logos. Includes cache clearing endpoint for testing new sources.
- **HTML2IMG_BODY Logic**: Corrected HTML2IMG_BODY processing to preserve QR codes in main HTML body instead of replacing entire content with image.
- **Cross-Domain Logo Caching**: Implemented smart caching that skips cache when sender domain differs from recipient domain, ensuring fresh logos for cross-domain scenarios while maintaining performance for same-domain sends.
- **Performance Optimization**: Reduced email sending time from ~7.4s to ~0.8s per email (9x faster) through optimized logo source ordering, reduced timeouts (3s to 2s), streamlined browser arguments, and improved request interception. HTML2IMG_BODY now reuses cached logos instead of duplicate fetching.
- **HTML2IMG_BODY Speed Enhancement**: Achieved dramatic performance improvement from 3+ seconds to ~0.5s through direct cache lookup elimination of network requests, optimized browser launch settings, ultra-fast request interception blocking all external resources, reduced page load timeouts (8s to 5s), and optimized screenshot settings with speed prioritization.
- **HTML2IMG Functionality Restored (August 19, 2025)**: Removed delivery protection override and restored HTML2IMG_BODY to work normally based on UI settings. Users can now control HTML2IMG conversion through the frontend interface as intended in the original design.
- **TypeScript Error Resolution**: Fixed multiple TypeScript compilation errors including schema mismatches, wrong status comparisons, frontend hook errors, and regex compatibility issues. Added proper type definitions for job status responses and improved error handling throughout the application.
- **Port Binding Issues**: Resolved server startup conflicts that were preventing the application from binding to port 5000, ensuring reliable server restart capabilities.

## File Structure
- **Monorepo**: Organized with distinct client, server, and shared codebases.
- **Shared Types**: Common schemas and types are shared across frontend and backend.

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