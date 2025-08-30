# Overview

This is a sophisticated web-based email marketing platform that replicates and enhances the functionality of an Electron email sender application. Built with modern web technologies, it serves as a comprehensive email campaign management tool with advanced features like dynamic content generation, QR code integration, HTML-to-image conversion, and multi-format attachment generation. The platform provides a dark-themed interface optimized for professional email marketing workflows.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite for building and development
- **UI/UX**: Radix UI components integrated with Tailwind CSS, following a shadcn/ui design system with a custom dark theme and professional color palette
- **State Management**: React Query (TanStack Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Build System**: Vite with custom configuration for monorepo structure and alias resolution

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Email Service**: Nodemailer for SMTP email sending with advanced configuration management
- **File Handling**: Multer for processing file uploads and attachment management
- **Storage**: Abstract storage interface (IStorage) with in-memory implementation as default
- **Performance**: Browser pool management for HTML conversions using Puppeteer with resource optimization

## Data Architecture
- **Database**: Uses Drizzle ORM for type-safe database operations (designed for PostgreSQL but currently using in-memory storage)
- **Type Safety**: Shared TypeScript schemas validated with Zod across frontend and backend
- **Configuration**: INI-based configuration system loading from setup.ini and smtp.ini files

## Email Processing System
- **Job-based Architecture**: Email campaigns managed as trackable jobs with progress monitoring
- **Advanced Placeholder System**: Dynamic content replacement supporting user-specific, random, and computed placeholders
- **Multi-format Conversion**: HTML content conversion to PDF, PNG, and DOCX formats with embedded QR codes and domain logos
- **QR Code Generation**: Comprehensive QR code system with multiple rendering modes and visual customization
- **Domain Logo Integration**: Automatic logo fetching from multiple prioritized sources with caching and fallback mechanisms
- **HTML2IMG Processing**: Full email body conversion to clickable PNG images using Puppeteer
- **Browser Resource Management**: Optimized browser pooling (max 2 browsers, 3 pages each) with memory monitoring

## Performance Optimization
- **Caching System**: Domain logo caching with cross-domain detection and performance monitoring
- **Memory Management**: Threshold monitoring and periodic cleanup to prevent resource exhaustion
- **Process Management**: Automatic cleanup of zombie processes with periodic maintenance
- **Performance Analytics**: Timing tracking and recommendation system for optimization insights

# External Dependencies

## Core Framework Dependencies
- **Express.js**: Backend API framework for server-side operations
- **React**: Frontend UI library with TypeScript support
- **Vite**: Build tool and development server with hot module replacement

## Email and Communication
- **Nodemailer**: SMTP email sending with advanced configuration support
- **@neondatabase/serverless**: Database connectivity (prepared for PostgreSQL integration)
- **HTML Processing**: html-to-text, html-minifier-terser for content optimization

## File Processing and Conversion
- **Puppeteer**: Headless browser automation for HTML-to-image conversion and PDF generation
- **QRCode**: QR code generation with customization options
- **Archiver**: File compression and ZIP creation for attachments
- **AdmZip**: ZIP file handling and extraction
- **html-docx-js**: HTML to Microsoft Word document conversion

## Cloud Storage and External APIs
- **@google-cloud/storage**: Google Cloud Storage integration for file management
- **Axios**: HTTP client for external API requests (logo fetching, domain verification)
- **Multiple Logo APIs**: Icons.duckduckgo.com, Logo.dev, Brandfetch, Clearbit API for domain logo fetching

## UI and User Experience
- **Radix UI**: Comprehensive component library (@radix-ui/react-*)
- **Tailwind CSS**: Utility-first CSS framework with custom dark theme
- **Lucide React**: Icon library for user interface elements
- **React Hook Form**: Form handling with validation (@hookform/resolvers)

## Development and Build Tools
- **TypeScript**: Static type checking across the entire stack
- **ESBuild**: Fast JavaScript bundler for production builds
- **Drizzle Kit**: Database schema management and migrations
- **TanStack Query**: Server state management and caching for React

## Performance and Monitoring
- **p-limit**: Concurrency control for resource-intensive operations
- **memoizee**: Function memoization for performance optimization
- **Performance tracking**: Custom timing and recommendation systems for optimization insights