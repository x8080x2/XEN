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
- **QR Code Generation**: Capable of generating QR codes with configurable colors and borders, attaching them as CIDs.
- **Configuration**: Loads settings from setup.ini and smtp.ini, with automatic application on startup.

## Recent Bug Fixes (August 2025)
- **QR Code Display Bug**: Fixed main HTML body QR code display issue where QR codes showed as text instead of images. Root cause was using data URLs (data:image/png;base64,...) which email clients block for security. Solution: Changed to use CID (Content-ID) attachments like `src="cid:qrcode-main"` for proper email client compatibility.
- **Domain Logo Display**: Fixed domain logo display in main HTML body using same CID attachment approach as QR codes.
- **HTML2IMG_BODY Logic**: Corrected HTML2IMG_BODY processing to preserve QR codes in main HTML body instead of replacing entire content with image.

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