# Overview

This is a complete web-based clone of the original Electron email sender application built with Express.js, React, and TypeScript. The application provides a sophisticated email marketing tool with features like bulk email sending, dynamic placeholders, file attachments, progress tracking, and configurable settings. It uses a modern monorepo structure with shared types and schemas, and implements a clean architecture with separate frontend, backend, and shared layers.

## Recent Changes (January 2025)
- ✅ **Complete Feature Parity Achieved** - All missing features from original main.js and sender.html implemented
- ✅ **Domain Logo Fetching** - fetchDomainLogo() with Clearbit API integration
- ✅ **QR Code Generation** - generateQRCode() with full PNG processing and CID attachment
- ✅ **Hidden Image Overlay Logic** - Complete positioning and HTML entity support
- ✅ **Random Header Generation** - UserAgent and X-Mailer randomization arrays
- ✅ **Retry Logic** - Full retry attempts with proper error handling and delays
- ✅ **Priority Settings** - Low/Normal/High priority support in email headers
- ✅ **Config File System** - setup.ini and smtp.ini loading with ConfigService
- ✅ **Complete UI Coverage** - All missing form fields added (proxy, retry, borders, etc.)
- ✅ **100% Logic Preservation** - Exact cloning of original Electron app functionality

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with Tailwind CSS for styling (shadcn/ui design system)
- **State Management**: React Query (@tanstack/react-query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with a dark theme and custom color palette matching a professional email client design

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL
- **Email Service**: Nodemailer for SMTP email sending
- **File Handling**: Multer for file upload processing
- **Storage**: Abstract storage interface with in-memory implementation (IStorage)

## Data Architecture
- **Database Schema**: Well-defined tables for users, email configurations, email jobs, email logs, and app settings
- **Type Safety**: Shared TypeScript schemas using Drizzle and Zod for validation
- **Data Models**: Comprehensive entities for user management, email campaigns, and activity tracking

## Email Processing System
- **Job-based Processing**: Email campaigns are processed as jobs with status tracking
- **Placeholder System**: Dynamic content replacement with user-specific, random, and computed placeholders
- **Attachment Support**: File upload and attachment processing for email campaigns
- **Progress Tracking**: Real-time progress updates and logging for email send operations

## File Structure
- **Monorepo Layout**: Clear separation between client, server, and shared code
- **Shared Types**: Common schemas and types shared between frontend and backend
- **Asset Management**: Dedicated folder for attached assets and static files

# External Dependencies

## Core Framework Dependencies
- **Express.js**: Web application framework for the backend API
- **React**: Frontend UI library with TypeScript support
- **Vite**: Build tool and development server for the frontend

## Database and ORM
- **@neondatabase/serverless**: Serverless PostgreSQL database client
- **Drizzle ORM**: Type-safe ORM for PostgreSQL with migration support
- **drizzle-kit**: CLI tool for database schema management and migrations

## Email Services
- **Nodemailer**: SMTP email sending library
- **@types/nodemailer**: TypeScript definitions for Nodemailer

## UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components (@radix-ui/* packages)
- **shadcn/ui**: Design system built on Radix UI components
- **Lucide React**: Icon library for UI components

## File Processing
- **Multer**: Middleware for handling multipart/form-data (file uploads)
- **@types/multer**: TypeScript definitions for Multer

## State Management and HTTP
- **@tanstack/react-query**: Server state management and caching
- **React Hook Form**: Form handling with @hookform/resolvers for validation
- **Wouter**: Lightweight routing library for React

## Development and Build Tools
- **TypeScript**: Type-safe JavaScript development
- **ESBuild**: Fast JavaScript bundler for production builds
- **tsx**: TypeScript execution engine for development

## Validation and Utilities
- **Zod**: TypeScript-first schema validation library
- **drizzle-zod**: Integration between Drizzle ORM and Zod for schema validation

## Cloud Services (Optional)
- **@google-cloud/storage**: Google Cloud Storage integration for file storage
- **@uppy/aws-s3**: AWS S3 file upload integration

## Development Environment
- **Replit Integration**: Custom Vite plugins for Replit development environment
- **Error Handling**: Runtime error overlay for development debugging