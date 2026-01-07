import nodemailer from "nodemailer";
import { createReadStream, readFileSync, existsSync, statSync, readdirSync, writeFileSync } from "fs";
import { join, basename } from "path";
import QRCode from "qrcode";
import archiver from "archiver";
import crypto from "crypto";
import axios from "axios";
import puppeteer from "puppeteer";
import { htmlToText } from "html-to-text";
import AdmZip from "adm-zip";
// @ts-ignore - html-docx-js doesn't have proper types
import * as htmlDocx from "html-docx-js";
import { Jimp } from "jimp";
import { configService } from "./configService";
import { aiService } from "./aiService";

// Helper function to composite hidden image into QR code for email-safe rendering
async function composeQrWithHiddenImage(qrBuffer: Buffer, hiddenImageBuffer: Buffer, hiddenImageSize: number, qrDisplayWidth?: number): Promise<Buffer> {
  try {
    const qrImage = await Jimp.read(qrBuffer);
    const hiddenImage = await Jimp.read(hiddenImageBuffer);

    // Calculate target width preserving aspect ratio like original CSS (width: Xpx, height: auto)
    const displayWidth = qrDisplayWidth || qrImage.bitmap.width;
    const scale = qrImage.bitmap.width / displayWidth;
    const targetWidth = Math.round(hiddenImageSize * scale);

    // Clamp to max 35% of QR width for scannability
    const maxWidth = Math.round(qrImage.bitmap.width * 0.35);
    const finalWidth = Math.min(targetWidth, maxWidth);

    // Resize by width only to preserve aspect ratio (matches CSS height: auto)
    hiddenImage.resize({ w: finalWidth });

    // Center the hidden image on the QR code (fully visible, transparent background only)
    const xPos = Math.floor((qrImage.bitmap.width - hiddenImage.bitmap.width) / 2);
    const yPos = Math.floor((qrImage.bitmap.height - hiddenImage.bitmap.height) / 2);

    qrImage.composite(hiddenImage, xPos, yPos, {
      opacitySource: 1.0,
      opacityDest: 1.0
    });

    console.log(`[QR Compose] Resized hidden image: ${hiddenImageSize}px -> ${finalWidth}px (scale: ${scale.toFixed(2)}, QR: ${qrImage.bitmap.width}px, display: ${displayWidth}px)`);
    return await qrImage.getBuffer('image/png');
  } catch (error) {
    console.error('[QR Compose] Failed to composite hidden image:', error);
    return qrBuffer; // Return original QR if composition fails
  }
}

// Random helper for array and hex - exact clone from main.js
function randomFrom(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomHex(len: number) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// AI-generated dynamic placeholders - with graceful fallback
async function getAIGeneratedValue(type: 'firstname' | 'lastname' | 'company' | 'domain' | 'title', context?: string): Promise<string> {
  try {
    // Use AI service to generate realistic placeholder values
    if (aiService.isInitialized()) {
      return await aiService.generatePlaceholder(type, context);
    }
    // If AI not initialized, return empty string (skip placeholder)
    console.log(`[Placeholder AI] AI not initialized, skipping ${type} placeholder`);
    return '';
  } catch (error) {
    // If AI fails (quota exceeded, error, etc.), return empty string to allow email to send
    console.log(`[Placeholder AI] Failed to generate ${type}, skipping placeholder:`, error instanceof Error ? error.message : error);
    return '';
  }
}

// Cache for AI-generated values per email session
const aiGeneratedCache = new Map<string, Map<string, string>>();

async function pickRand(type: string, emailKey: string): Promise<string> {
  if (!aiGeneratedCache.has(emailKey)) {
    aiGeneratedCache.set(emailKey, new Map());
  }

  const cache = aiGeneratedCache.get(emailKey)!;

  if (!cache.has(type)) {
    const value = await getAIGeneratedValue(type as any);
    cache.set(type, value);
  }

  return cache.get(type)!;
}

// Complete placeholder replacement with AI-generated content
export async function injectDynamicPlaceholders(text: string, user: string, email: string, dateStr: string, timeStr: string): Promise<string> {
  if (!text) return '';

  // Recipient logic - extract domain from the recipient email (user parameter)
  const username = user?.split('@')[0] || '';
  const domain = user?.split('@')[1] || '';
  const domainBase = domain?.split('.')[0] || '';
  const initials = username.split(/[^a-zA-Z]/).map(p => p[0]?.toUpperCase()).join('');
  const userId = Math.abs(username.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)).toString().slice(0, 6);

  // Extract full name from username (convert dots/underscores to spaces and capitalize)
  const fullName = username
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Extract first name only (first word from full name)
  const firstName = fullName.split(' ')[0] || username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();

  // Uppercase full name
  const fullNameUpper = fullName.toUpperCase();

  // Generate AI-powered random values for placeholders
  const emailKey = `${user}_${Date.now()}`;
  const randfirst = await pickRand('firstname', emailKey);
  const randlast = await pickRand('lastname', emailKey);
  const randname = `${randfirst} ${randlast}`;
  const randcompany = await pickRand('company', emailKey);
  const randdomain = await pickRand('domain', emailKey);
  const randtitle = await pickRand('title', emailKey);

  text = text.replace(/{name}/g, fullName) // {name} = full name from username
             .replace(/{Name}/g, firstName) // {Name} = first name only, capitalized
             .replace(/{NAME}/g, fullNameUpper) // {NAME} = uppercase full name
             .replace(/{user}/g, username)
             .replace(/{User}/g, username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()) // {User} = capitalized
             .replace(/{USER}/g, username.toUpperCase()) // {USER} = uppercase
             .replace(/{email}/g, user.toLowerCase()) // {email} = full lowercase email
             .replace(/{Email}/g, username.charAt(0).toUpperCase() + username.slice(1).toLowerCase() + '@' + domain.toLowerCase()) // {Email} = capitalized username only
             .replace(/{EMAIL}/g, user.toUpperCase()) // {EMAIL} = full uppercase email
             .replace(/{senderemail}/g, email)
             .replace(/{date}/g, dateStr)
             .replace(/{time}/g, timeStr)
             .replace(/{username}/g, username)
             .replace(/{domain}/g, domain.toLowerCase()) // {domain} = lowercase domain
             .replace(/{Domain}/g, domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase()) // {Domain} = capitalized domain
             .replace(/{DOMAIN}/g, domain.toUpperCase()) // {DOMAIN} = uppercase domain
             .replace(/{domainbase}/g, domainBase.toLowerCase())
             .replace(/{host}/g, domainBase.toLowerCase()) // {host} = lowercase
             .replace(/{Host}/g, domainBase.charAt(0).toUpperCase() + domainBase.slice(1).toLowerCase()) // {Host} = capitalized
             .replace(/{HOST}/g, domainBase.toUpperCase()) // {HOST} = uppercase
             .replace(/{initials}/g, initials)
             .replace(/{userid}/g, userId);

  // New random placeholders
  text = text.replace(/{randfirst}/g, randfirst)
             .replace(/{randlast}/g, randlast)
             .replace(/{randname}/g, randname)
             .replace(/{randcompany}/g, randcompany)
             .replace(/{randdomain}/g, randdomain)
             .replace(/{randtitle}/g, randtitle);

  // MISSING ADVANCED PLACEHOLDERS - exact clone from main.js lines 767-783
  // {mename}, {mename3}
  text = text.replace(/\{mename\}/g, username);
  text = text.replace(/\{mename3\}/g, username.slice(0,3));
  // {emailb64}
  text = text.replace(/\{emailb64\}/g, Buffer.from(user).toString('base64'));
  // {xemail}
  text = text.replace(/\{xemail\}/g, username.charAt(0) + '***@' + domain);
  // {randomname} - AI generated
  const aiRandomName = await pickRand('firstname', emailKey) + ' ' + await pickRand('lastname', emailKey);
  text = text.replace(/\{randomname\}/g, aiRandomName);

  // BASE64 ENCODED PLACEHOLDERS - for use in encrypted/obfuscated content
  const datetime = `${dateStr} ${timeStr}`;
  text = text.replace(/\{userb64\}/g, Buffer.from(username).toString('base64'))
             .replace(/\{nameb64\}/g, Buffer.from(fullName).toString('base64'))
             .replace(/\{domainb64\}/g, Buffer.from(domain).toString('base64'))
             .replace(/\{dateb64\}/g, Buffer.from(dateStr).toString('base64'))
             .replace(/\{timeb64\}/g, Buffer.from(timeStr).toString('base64'))
             .replace(/\{datetimeb64\}/g, Buffer.from(datetime).toString('base64'))
             .replace(/\{senderemailb64\}/g, Buffer.from(email).toString('base64'))
             .replace(/\{randfirstb64\}/g, Buffer.from(randfirst).toString('base64'))
             .replace(/\{randlastb64\}/g, Buffer.from(randlast).toString('base64'))
             .replace(/\{randnameb64\}/g, Buffer.from(randname).toString('base64'))
             .replace(/\{randcompanyb64\}/g, Buffer.from(randcompany).toString('base64'))
             .replace(/\{randdomainb64\}/g, Buffer.from(randdomain).toString('base64'))
             .replace(/\{randtitleb64\}/g, Buffer.from(randtitle).toString('base64'));

  // NOTE: hashN and randnumN are handled by replacePlaceholders() function later

  return text;
}



// Replace placeholders like {randnumN}, {hashN}, and {randcharN} in strings - exact clone from main.js
export function replacePlaceholders(str: string): string {
  // Replace {randnumN} with random N-digit numbers
  str = str.replace(/\{randnum(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    let num = '';
    while (num.length < n) num += Math.floor(Math.random()*10);
    return num.slice(0, n);
  });

  // Replace {hashN} with random N-character hex string
  str = str.replace(/\{hash(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    return crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n);
  });

  // Replace {randcharN} with random N-character alphanumeric string
  str = str.replace(/\{randchar(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    let chars = '';
    while (chars.length < n) {
      chars += Math.random().toString(36).charAt(2) || 'x';
    }
    return chars.slice(0, n);
  });

  // Replace {randomnumN} (alternative spelling) with random N-digit numbers  
  str = str.replace(/\{randomnum(\d+)\}/gi, (_, n) => {
    n = parseInt(n, 10);
    let num = '';
    while (num.length < n) num += Math.floor(Math.random()*10);
    return num.slice(0, n);
  });

  return str;
}

// Decode HTML entities - exact clone from main.js lines 120-129
function decodeHtmlEntities(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// Build QR options - exact clone from main.js
function buildQrOpts(C: any) {
  return {
    width: C.QR_WIDTH,
    margin: 4,
    errorCorrectionLevel: 'H' as any
  };
}

// Configuration object with all settings - exact clone from main.js
const defaultConfig = {
  QR_WIDTH: 200,
  QR_BORDER_WIDTH: 2,
  QR_BORDER_COLOR: '#000000',
  QR_FOREGROUND_COLOR: '#000000',
  QR_BACKGROUND_COLOR: '#FFFFFF',
  BORDER_STYLE: 'solid',
  BORDER_COLOR: '#000000',
  QR_LINK: 'https://example.com',
  LINK_PLACEHOLDER: '',
  HTML2IMG_BODY: false,
  RANDOM_METADATA: false,
  HIDDEN_IMAGE_FILE: '',
  HIDDEN_IMAGE_SIZE: 50,
  HIDDEN_TEXT: '',

  QRCODE: false,
  CALENDAR_MODE: false,
  PROCESS_ATTACHMENT_PLACEHOLDERS: true, // Enable placeholder processing in attachments by default

  SLEEP: 3,
  EMAIL_PER_SECOND: 5,
  ZIP_USE: false,
  ZIP_PASSWORD: '',
  FILE_NAME: 'attachment',
  HTML_CONVERT: [], // pdf
  // Hidden text overlay removed - image overlay only
  DOMAIN_LOGO_SIZE: '70%',

  PRIORITY: 'normal', // Fix 1: Add missing PRIORITY
  RETRY: 0, // Fix 1: Add missing RETRY
  TEMPLATE_ROTATION: 0, // Template rotation: 0=disabled, 1=enabled
  PROXY: {
    PROXY_USE: 0,
    TYPE: 'socks5',
    HOST: '',
    PORT: '',
    USER: '',
    PASS: ''
  }
};

// Improvement 1: Browser Pool Management

// Improvement 8: Structured Logging System

export class AdvancedEmailService {
  private static instance: AdvancedEmailService | null = null;
  private browserPool: any[] = [];
  private isPaused = false;
  private concurrencyLimit = 3;

  // Activity Tracking - prevents cleanup during active operations
  private activeOperations = new Set<string>();
  private activeCampaigns = new Map<string, { startTime: number; emailCount: number }>();

  // Improvement 2: Memory monitoring
  private memoryThreshold = 800 * 1024 * 1024; // 800MB
  private lastMemoryCheck = 0;
  private memoryCheckInterval = 30000; // 30 seconds

  // Improvement 3: Gradual Adaptive rate limiting
  private smtpResponseTimes: number[] = [];
  private currentRateLimit = 5;
  private maxRateLimit = 20;
  private minRateLimit = 1;
  private rateChangeStep = 0.5; // Gradual rate changes

  // Improvement 4: Progress tracking
  private progressMetrics = {
    startTime: 0,
    emailsSent: 0,
    emailsFailed: 0,
    totalEmails: 0,
    avgResponseTime: 0,
    estimatedTimeRemaining: 0
  };

  // Improvement 5: Template Management
  private templateCache = new Map<string, { content: string; lastModified: number }>();

  // Progress logging array - to store campaign progress logs
  private progressLogs: any[] = [];

  constructor() {
    if (AdvancedEmailService.instance) {
      console.log('Multiple AdvancedEmailService instances detected! Using existing instance.');
      return AdvancedEmailService.instance;
    }

    console.log('AdvancedEmailService initialized');
    // Start memory monitoring
    this.startMemoryMonitoring();
    AdvancedEmailService.instance = this;
  }

  // Browser pool synchronization
  private browserPoolLock = false;

  // Improvement 1: Browser Pool Management (Thread-safe)
  private async getBrowserFromPool(): Promise<any> {
    // TEMPORARY FIX: Disable browser pooling to prevent timeout issues
    // Always create fresh browser instances
    const operationId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeOperations.add(operationId);

    try {
      console.log('[Browser Pool] Creating fresh browser instance (pooling disabled)');
      const browser = await this.launchBrowser({});
      return { browser, operationId };
    } catch (error) {
      this.activeOperations.delete(operationId);
      console.error('[Browser Pool] Failed to create browser:', {
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async releaseBrowserFromPool(browserInfo: any) {
    let browser, operationId;

    // Handle both old format (direct browser) and new format (browser + operationId)
    if (browserInfo && typeof browserInfo === 'object' && browserInfo.browser) {
      browser = browserInfo.browser;
      operationId = browserInfo.operationId;
    } else {
      browser = browserInfo;
      operationId = null;
    }

    // CRITICAL: Close the browser immediately to prevent memory leaks
    // Since pooling is disabled, every browser must be closed after use
    try {
      if (browser && typeof browser.close === 'function') {
        await browser.close();
        console.log('[Browser Cleanup] Browser closed successfully', { operationId });
      }
    } catch (error) {
      console.error('[Browser Cleanup] Failed to close browser:', {
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Remove operation tracking
    if (operationId) {
      this.activeOperations.delete(operationId);
      console.debug('[Browser Cleanup] Released operation', { operationId, activeOperations: this.activeOperations.size });
    }
  }

  // Improvement 2: Memory Monitoring
  private startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > this.memoryThreshold) {
        console.log('High memory usage detected:', memUsage);
        this.cleanupBrowserPool();
      }

      // Log memory stats every 5 minutes
      if (Date.now() - this.lastMemoryCheck > 300000) {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: 'Memory status', data: { memUsage, browserPoolSize: this.browserPool.length }, memory: memUsage, pid: process.pid }));
        this.lastMemoryCheck = Date.now();
      }
    }, this.memoryCheckInterval);
  }

  private async cleanupBrowserPool() {
    // Thread-safe cleanup with proper synchronization
    while (this.browserPoolLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.browserPoolLock = true;

    try {
      // More aggressive cleanup for better memory management
      const now = Date.now();
      const staleThreshold = 300000; // Reduced to 5 minutes
      let cleaned = 0;

      // Clean up stale browsers even with some active operations
      if (this.activeOperations.size > 3) {
        console.log('High activity detected, performing partial cleanup', { activeCount: this.activeOperations.size });
      }

      for (let i = this.browserPool.length - 1; i >= 0; i--) {
        const pool = this.browserPool[i];
        if (pool.activePages === 0 && (now - pool.lastUsed) > staleThreshold) {
          try {
            await pool.instance.close();
            this.browserPool.splice(i, 1);
            cleaned++;
            console.log('Cleaned up stale browser', { 
              poolIndex: i,
              remaining: this.browserPool.length,
              totalCleaned: cleaned 
            });
          } catch (error) {
            console.error('Error closing browser during cleanup:', {
              poolIndex: i,
              lastUsed: new Date(pool.lastUsed).toISOString(),
              error: error instanceof Error ? error.message : String(error)
            });
            // Remove from pool even if close failed to prevent future issues
            this.browserPool.splice(i, 1);
          }
        }
      }
    } finally {
      this.browserPoolLock = false;
    }
  }

  // Improvement 3: Adaptive Rate Limiting (Queue-based)
  private rateLimitQueue: Array<{ responseTime: number; success: boolean }> = [];
  private rateLimitProcessing = false;

  private updateRateLimit(responseTime: number, success: boolean) {
    // Queue the update to ensure all events are processed
    this.rateLimitQueue.push({ responseTime, success });

    // Process queue if not already processing
    if (!this.rateLimitProcessing) {
      this.processRateLimitQueue();
    }
  }

  private async processRateLimitQueue() {
    if (this.rateLimitProcessing) return;
    this.rateLimitProcessing = true;

    try {
      while (this.rateLimitQueue.length > 0) {
        const updates = this.rateLimitQueue.splice(0); // Process all queued updates

        // Process each update individually to maintain accurate adaptive behavior
        for (const { responseTime, success } of updates) {
          this.smtpResponseTimes.push(responseTime);
          if (this.smtpResponseTimes.length > 10) {
            this.smtpResponseTimes.shift();
          }

          // Calculate new rate based on each individual update
          if (this.smtpResponseTimes.length > 0) {
            const avgResponseTime = this.smtpResponseTimes.reduce((a, b) => a + b, 0) / this.smtpResponseTimes.length;
            const oldRate = this.currentRateLimit;

            // Gradual rate limiting - process each success/failure individually
            if (success && avgResponseTime < 2000) {
              // Fast responses - gradual increase
              this.currentRateLimit = Math.min(this.maxRateLimit, this.currentRateLimit + this.rateChangeStep);
            } else if (!success || avgResponseTime > 5000) {
              // Slow responses or failures - gradual decrease
              this.currentRateLimit = Math.max(this.minRateLimit, this.currentRateLimit - this.rateChangeStep);
            }

            // Only log when rate actually changes significantly
            if (Math.abs(this.currentRateLimit - oldRate) >= 0.5) {
              console.debug('Rate limit updated gradually', { 
                oldRate,
                newRate: this.currentRateLimit, 
                avgResponseTime,
                success,
                change: this.currentRateLimit - oldRate,
                remainingInQueue: this.rateLimitQueue.length
              });
            }
          }
        }
      }
    } finally {
      this.rateLimitProcessing = false;
    }
  }

  // Improvement 4: Enhanced Progress Tracking
  private calculateProgress() {
    const elapsed = Date.now() - this.progressMetrics.startTime;
    const processed = this.progressMetrics.emailsSent + this.progressMetrics.emailsFailed;
    const remaining = this.progressMetrics.totalEmails - processed;

    if (processed > 0) {
      const avgTimePerEmail = elapsed / processed;
      this.progressMetrics.estimatedTimeRemaining = remaining * avgTimePerEmail;
      this.progressMetrics.avgResponseTime = this.smtpResponseTimes.length > 0 
        ? this.smtpResponseTimes.reduce((a, b) => a + b, 0) / this.smtpResponseTimes.length 
        : 0;
    }

    return {
      processed,
      remaining,
      percentage: (processed / this.progressMetrics.totalEmails) * 100,
      emailsPerMinute: processed > 0 ? (processed / (elapsed / 60000)) : 0,
      estimatedTimeRemaining: this.progressMetrics.estimatedTimeRemaining,
      avgResponseTime: this.progressMetrics.avgResponseTime
    };
  }

  // Improvement 6: Error Recovery with Exponential Backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.warn(`Retry attempt ${attempt + 1}/${maxRetries + 1}`, { 
            delay, 
            error: lastError.message 
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // Improvement 7: Configuration Validation
  private validateConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.EMAIL_PER_SECOND || config.EMAIL_PER_SECOND < 1) {
      errors.push('EMAIL_PER_SECOND must be at least 1');
    }

    if (config.QR_WIDTH && (config.QR_WIDTH < 50 || config.QR_WIDTH > 1000)) {
      errors.push('QR_WIDTH must be between 50 and 1000');
    }

    if (config.SLEEP && config.SLEEP < 0) {
      errors.push('SLEEP cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Improvement 9: Smart Batching
  private calculateOptimalBatchSize(totalEmails: number, serverPerformance: number): number {
    const baseSize = this.currentRateLimit;
    const performanceMultiplier = serverPerformance > 2000 ? 0.5 : 1.5;
    const optimal = Math.floor(baseSize * performanceMultiplier);

    // Ensure batch size is reasonable
    return Math.max(1, Math.min(optimal, Math.ceil(totalEmails / 10)));
  }

  // QR caching with cache locking and size limits
  private qrCache = new Map<string, Buffer>();
  private qrCacheLocks = new Set<string>(); // Cache locking mechanism
  private maxCacheSize = 100; // Limit cache size to prevent memory issues

  // Clear all caches with safety check
  public clearCaches() {
    // Conditional cleanup - don't clear if operations in progress
    if (this.qrCacheLocks.size > 0 || this.activeOperations.size > 0) {
      console.log('[Cache] Deferring clear - operations in progress');
      setTimeout(() => this.clearCaches(), 5000); // Retry in 5s
      return;
    }

    const qrCount = this.qrCache.size;
    const logoCount = this.logoCache.size;

    this.qrCache.clear();
    this.logoCache.clear();

    console.log(`[Cache] Safely cleared ${qrCount} QR entries and ${logoCount} logo entries from cache`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('[Cache] Forced garbage collection');
    }
  }

  // Add proper logo cache with cross-domain support
  private logoCache = new Map<string, { buffer: Buffer | null; timestamp: number; domain: string }>();
  private logoCacheTTL = 300000; // 5 minutes cache

  private async fetchDomainLogo(domain: string, skipCache: boolean = false): Promise<Buffer | null> {
    if (!domain || typeof domain !== 'string') return null;

    // Check cache first unless explicitly skipping
    if (!skipCache) {
      const cached = this.logoCache.get(domain);
      if (cached && (Date.now() - cached.timestamp) < this.logoCacheTTL) {
        console.log(`[fetchDomainLogo] Using cached logo for ${domain}`);
        return cached.buffer;
      }
    }

    console.log(`[fetchDomainLogo] Fetching fresh logo for ${domain}`);

    // Optimized logo sources - prioritize sources that return REAL company logos, not generated placeholders
    const logoSources = [
      // Clearbit - highest quality real company logos (13KB+)
      `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=200&format=png&greyscale=false`,
      // Google Favicons - returns actual favicons from websites (NOT generated placeholders)
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      // DuckDuckGo Icons - returns actual website icons (NOT generated placeholders)
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
      // Favicone API - good quality but can timeout
      `https://favicone.com/${encodeURIComponent(domain)}?s=200`,
      // NOTE: Uplead and IconHorse often return GENERATED letter placeholders - deprioritized
      // `https://logo.uplead.com/${encodeURIComponent(domain)}`, // Returns tiny letter placeholders
      // `https://icon.horse/icon/${encodeURIComponent(domain)}`, // Returns generated letter icons
    ];

    for (const url of logoSources) {
      try {
        console.log(`[fetchDomainLogo] Trying ${domain} logo from:`, url);

        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 2000, // Reduced timeout for faster fallback to next source
          headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; EmailClient/1.0)',
            'Accept': 'image/png,image/jpeg,image/webp,image/*,*/*;q=0.8'
          }
        });

        if (response.status === 200 && response.data) {
          const buffer = Buffer.from(response.data);

          // Adjust minimum size based on source quality - reject tiny placeholders
          let minSize = 800; // Default minimum - reject tiny placeholder images
          if (url.includes('clearbit.com')) {
            minSize = 2000; // Clearbit returns larger files, prefer substantial logos
          } else if (url.includes('google.com/s2/favicons') || url.includes('duckduckgo.com')) {
            minSize = 500; // These return actual favicons, accept smaller but real logos
          } else if (url.includes('favicone.com')) {
            minSize = 800; // Moderate threshold for favicone
          }

          if (buffer.length > minSize) {
            console.log(`[fetchDomainLogo] Successfully fetched ${domain} logo (${buffer.length} bytes) from source: ${url}`);

            // Cache the successful result
            this.logoCache.set(domain, {
              buffer,
              timestamp: Date.now(),
              domain
            });

            return buffer;
          } else {
            console.log(`[fetchDomainLogo] Logo too small (${buffer.length} bytes, min: ${minSize}), trying next source`);
          }
        }
      } catch (error) {
        console.log(`[fetchDomainLogo] Failed to fetch from ${url}:`, error instanceof Error ? error.message : error);
        continue; // Try next source
      }
    }

    console.log(`[fetchDomainLogo] All logo sources failed for ${domain}`);

    // Cache null result to prevent repeated attempts
    this.logoCache.set(domain, {
      buffer: null,
      timestamp: Date.now(),
      domain
    });

    return null;
  }

  // QR generation promise queue to prevent race conditions
  private qrGenerationPromises = new Map<string, Promise<Buffer | null>>();

  // QR Code generation with proper synchronization
  private async generateQRCodeInternal(link: string, C: any): Promise<Buffer | null> {
    if (!link || typeof link !== 'string') return null;

    // Create cache key based on link and visual settings
    const cacheKey = `${link}_${C.QR_WIDTH || 200}_${C.QR_FOREGROUND_COLOR || '#000000'}_${C.QR_BACKGROUND_COLOR || '#FFFFFF'}`;

    // Check cache first
    if (this.qrCache.has(cacheKey)) {
      console.log(`[QR Generation] Using cached QR code`);
      return this.qrCache.get(cacheKey)!;
    }

    // Check if generation is already in progress
    if (this.qrGenerationPromises.has(cacheKey)) {
      console.log(`[QR Generation] Waiting for existing generation`);
      return this.qrGenerationPromises.get(cacheKey)!;
    }

    // Start generation and store promise
    const generationPromise = this.generateQRCodeInternalActual(link, C, cacheKey);
    this.qrGenerationPromises.set(cacheKey, generationPromise);

    try {
      return await generationPromise;
    } finally {
      this.qrGenerationPromises.delete(cacheKey);
    }
  }

  private async generateQRCodeInternalActual(link: string, C: any, cacheKey: string): Promise<Buffer | null> {
    // Lock cache key during generation (for compatibility with clearCaches)
    this.qrCacheLocks.add(cacheKey);

    try {
      // Use merged configuration colors
      const foregroundColor = C.QR_FOREGROUND_COLOR || '#000000';
      const backgroundColor = C.QR_BACKGROUND_COLOR || '#FFFFFF';

      console.log(`[QR Generation] Using colors - Foreground: ${foregroundColor}, Background: ${backgroundColor}`);

      const buffer = await QRCode.toBuffer(link, {
        width: C.QR_WIDTH || 200,
        margin: 4,
        errorCorrectionLevel: 'H' as 'L' | 'M' | 'Q' | 'H',
        color: {
          dark: foregroundColor,
          light: backgroundColor
        }
      });

      // Cache the result with size management
      if (this.qrCache.size >= this.maxCacheSize) {
        // Remove oldest entry
        const firstKey = this.qrCache.keys().next().value;
        if (firstKey !== undefined) {
          this.qrCache.delete(firstKey);
        }
      }
      this.qrCache.set(cacheKey, buffer);
      console.log(`[QR Generation] Generated and cached QR code`);

      console.debug('Generated QR code with custom colors', { 
        link: link.substring(0, 50),
        foregroundColor,
        backgroundColor
      });
      return buffer;
    } catch (error) {
      console.error('Error generating QR code', { error, link });
      return null;
    } finally {
      // Always unlock cache key
      this.qrCacheLocks.delete(cacheKey);
    }
  }

  // Extract domain from email address
  private extractDomainFromEmail(email: string): string | null {
    if (!email || typeof email !== 'string') return null;
    const match = email.match(/@([^@]+)$/);
    return match ? match[1] : null;
  }

  // Random helper functions - exact clone from main.js
  private randomFrom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private randomHex(len: number): string {
    return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  // Launch browser with proxy support - IMPROVED VERSION with pooling
  private async launchBrowser(C: any = {}): Promise<any> {
    const launchOptions: any = { 
      headless: true,
      protocolTimeout: 60000, // Increase timeout to 60 seconds
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-gpu',
        '--no-first-run',
        '--disable-web-security',
        '--memory-pressure-off',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--no-zygote' // Disable zygote process
      ]
    };

    // Try to use system Chromium first (installed via Nix on Replit)
    try {
      const { execSync } = await import('child_process');
      const chromiumPath = execSync('which chromium 2>/dev/null || echo ""', { 
        encoding: 'utf-8',
        env: process.env
      }).trim();
      if (chromiumPath && chromiumPath !== '') {
        launchOptions.executablePath = chromiumPath;
        console.log('Using system Chromium:', chromiumPath);
      } else {
        console.log('System Chromium not found, using Puppeteer bundled Chrome');
      }
    } catch (err) {
      console.log('Falling back to Puppeteer bundled Chrome');
    }

    // Add proxy support
    if (C.PROXY && C.PROXY.PROXY_USE === 1) {
      const proxyHost = C.PROXY.HOST || '';
      const proxyPort = C.PROXY.PORT || '';
      if (proxyHost && proxyPort) {
        const scheme = (C.PROXY.TYPE || 'socks5').toLowerCase();
        launchOptions.args.push(`--proxy-server=${scheme}://${proxyHost}:${proxyPort}`);
        console.info('Using proxy', { scheme, host: proxyHost, port: proxyPort });
      }
    }

    let browser;
    try {
      browser = await puppeteer.launch(launchOptions);
      console.log('Browser launched successfully');
    } catch (error) {
      console.error('Browser launch failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Setup proxy authentication if needed
    if (C.PROXY && C.PROXY.PROXY_USE === 1 && C.PROXY.USER && C.PROXY.PASS) {
      const pages = await browser.pages();
      const page = pages.length ? pages[0] : await browser.newPage();
      await page.authenticate({ username: C.PROXY.USER, password: C.PROXY.PASS });
      console.log('Proxy authentication configured');
    }

    return browser;
  }

  // HTML to PDF conversion - IMPROVED with fallback handling
  private async convertHtmlToPdf(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for PDF conversion');
    }

    let browserInfo = await this.getBrowserFromPool();
    let browser, page: any = null;
    let usingPool = true;

    // Handle new browser activity tracking format
    if (!browserInfo) {
      browser = await this.launchBrowser({});
      usingPool = false;
    } else if (typeof browserInfo === 'object' && browserInfo.browser) {
      browser = browserInfo.browser;
    } else {
      browser = browserInfo;
      usingPool = false;
    }

    try {
      // Add timeout to page creation
      page = await Promise.race([
        browser.newPage(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Page creation timeout')), 30000)
        )
      ]) as any;
      
      // Ultra-fast request interception - block ALL external resources
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const url = req.url();
        if (url.startsWith('data:') || url.startsWith('about:')) {
          req.continue();
        } else {
          req.abort(); // Block all external requests for fastest rendering
        }
      });
      await page.setCacheEnabled(true);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Measure actual content dimensions to fit PDF to content
      const contentDimensions = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
        const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
        return { width, height };
      });
      
      // Create PDF with exact content dimensions (no forced A4/Letter sizing)
      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: `${contentDimensions.width + 20}px`,
        height: `${contentDimensions.height + 20}px`,
        margin: {
          top: '10px',
          bottom: '10px',
          left: '10px',
          right: '10px'
        },
        timeout: 15000
      });

      if (page) await page.close();
      // ALWAYS close browser since pooling is disabled
      await this.releaseBrowserFromPool(browserInfo);

      console.debug('PDF conversion completed', { sizeKB: Math.round(pdfBuffer.length / 1024) });
      return pdfBuffer;
    } catch (e) {
      // Enhanced error handling with resource cleanup
      await this.cleanupBrowserResources(page, browser, browserInfo, usingPool, 'PDF conversion');
      console.error('PDF conversion failed:', {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        usingPool,
        hasBrowser: !!browser,
        hasPage: !!page
      });
      throw e;
    }
  }

  // HTML to Image conversion - OPTIMIZED for speed
  private async convertHtmlToImage(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for Image conversion');
    }
    const conversionStart = Date.now();
    console.debug('Image conversion starting', { 
      queuePending: (this.concurrencyLimit as any).pendingCount, 
      active: (this.concurrencyLimit as any).activeCount,
      timestamp: conversionStart
    });

    // Direct browser launch for maximum HTML2IMG_BODY speed
    let browser = await this.launchBrowser({});
    let page: any = null;
    let usingPool = false;

      try {
        page = await browser.newPage();
        await page.setViewport({ width: 1123, height: 1587 });
        await page.setCacheEnabled(true);
        // Optimized page loading - skip unnecessary network wait
        await page.setContent(html, { waitUntil: 'load', timeout: 5000 });
        // Fast screenshot with optimized settings
        const pngBuffer = await page.screenshot({ 
          fullPage: true,
          optimizeForSpeed: true,
          captureBeyondViewport: false
        });

        if (page) await page.close();
        // ALWAYS close browser since pooling is disabled
        await this.releaseBrowserFromPool(browser);

        const conversionEnd = Date.now();
        console.debug('Image conversion completed', { 
          sizeKB: Math.round(pngBuffer.length / 1024),
          queuePending: (this.concurrencyLimit as any).pendingCount, 
          active: (this.concurrencyLimit as any).activeCount,
          duration: conversionEnd - conversionStart
        });
        return pngBuffer;
      } catch (e) {
        if (page) {
          try { 
            await page.close(); 
          } catch (closeError) {
            console.error('Failed to close page during image conversion cleanup:', closeError);
          }
        }
        // ALWAYS close browser since pooling is disabled
        if (browser) {
          await this.releaseBrowserFromPool(browser);
        }
        console.error('Image generation failed:', {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          usingPool,
          hasBrowser: !!browser,
          hasPage: !!page
        });
        throw e;
      }
  }

  // HTML to DOCX conversion - exact clone
  private async htmlToDocxStandalone(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Cannot convert empty HTML to DOCX');
    }
    try {
      console.log('[htmlToDocxStandalone] Starting DOCX conversion...');
      // html-docx-js 0.3.1 uses asBlob() instead of asBuffer()
      const docxBlob = htmlDocx.asBlob(html);
      // Convert blob to buffer for compatibility with original main.js logic
      const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());
      console.log('[htmlToDocxStandalone] DOCX conversion successful');
      return docxBuffer;
    } catch (error) {
      console.error('[htmlToDocxStandalone] Error:', error);
      throw error;
    }
  }

  // HTML to HTML conversion - simple pass-through for attachment
  private async convertHtmlToHtml(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for HTML conversion');
    }
    return Buffer.from(html, 'utf8');
  }

  // Converters registry - exact clone
  private converters = {
    html: this.convertHtmlToHtml.bind(this),
    pdf: this.convertHtmlToPdf.bind(this),
    png: this.convertHtmlToImage.bind(this),
    docx: this.htmlToDocxStandalone.bind(this)
  };

  // Unified HTML rendering helper - exact clone
  private async renderHtml(format: string, html: string, C: any = {}) {
    const fn = this.converters[format as keyof typeof this.converters];
    if (!fn) throw new Error('Unsupported render format: ' + format);
    return await fn(html);
  }

  // Create ZIP buffer - exact clone from main.js
  private async createZipBuffer(files: Array<{ name: string; buffer: Buffer }>, password?: string): Promise<Buffer> {
    const zip = new AdmZip();

    files.forEach(file => {
      zip.addFile(file.name, file.buffer);
    });

    if (password) {
      // Password functionality would require external library like node-7z
      console.log('ZIP password requested but not implemented');
    }

    return zip.toBuffer();
  }



  // Generate QR Code with config colors - standardized to use same settings as generateQRCodeInternal
  private async generateQRCode(link: string, C: any = {}): Promise<Buffer | null> {
    // Use the standardized QR generation function for consistency
    return await this.generateQRCodeInternal(link, C);
  }

  // Helper: Determine if file extension is text-based and supports placeholder processing
  private isTextBasedFile(extension: string): boolean {
    const textExtensions = ['html', 'htm', 'txt', 'csv', 'json', 'xml', 'md', 'text'];
    return textExtensions.includes(extension.toLowerCase());
  }

  // Helper: Read and process attachment file with placeholder replacement
  private async processAttachmentFile(filePath: string, originalFilename: string, recipient: string, senderEmail: string, dateStr: string, timeStr: string, maxFileSizeBytes: number = 1048576): Promise<{ content?: Buffer; path?: string; error?: string }> {
    try {
      const stats = statSync(filePath);
      // FIX: Use originalFilename instead of filePath to detect extension (Multer uploads have no extension in path)
      const ext = originalFilename.split('.').pop()?.toLowerCase() || '';

      // Check if file is text-based and within size limit
      if (this.isTextBasedFile(ext) && stats.size <= maxFileSizeBytes) {
        console.log(`[Attachment Processing] Reading text file for placeholder replacement: ${originalFilename} (${stats.size} bytes, extension: .${ext})`);

        // Read file content as UTF-8
        const rawContent = readFileSync(filePath, 'utf8');

        // Apply placeholder replacements (same as email body)
        let processedContent = await injectDynamicPlaceholders(rawContent, recipient, senderEmail, dateStr, timeStr);
        processedContent = replacePlaceholders(processedContent);

        console.log(`[Attachment Processing] Placeholders processed for ${originalFilename}`);

        // Return as Buffer
        return { content: Buffer.from(processedContent, 'utf8') };
      } else {
        // Binary file or too large - attach from path directly
        if (stats.size > maxFileSizeBytes) {
          console.log(`[Attachment Processing] File too large for placeholder processing: ${originalFilename} (${stats.size} bytes > ${maxFileSizeBytes} limit)`);
        } else {
          console.log(`[Attachment Processing] Binary file, no placeholder processing: ${originalFilename} (extension: .${ext})`);
        }
        return { path: filePath };
      }
    } catch (error) {
      console.error(`[Attachment Processing] Error reading file ${filePath}:`, error);
      // Fallback to path-based attachment on error
      return { path: filePath, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Complete sendMail function with all advanced features - exact clone
  async sendMail(args: any, progressCallback?: (progress: any) => void) {
    // Reset cancel flag for new campaign
    this.isCancelled = false;

    // Log args but redact sensitive information
    const safeArgs = { ...args };
    if (safeArgs.smtpPass) safeArgs.smtpPass = '[REDACTED]';
    if (safeArgs.proxyPass) safeArgs.proxyPass = '[REDACTED]';
    console.log('Advanced sendMail invoked with args:', safeArgs);
    const sendMailStart = Date.now();
    const campaignId = args.campaignId || `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add comprehensive error handling to prevent unhandled rejections
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection in sendMail', { 
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
        campaignId 
      });
      console.error('Unhandled Promise Rejection:', reason);
    });

    // Register campaign activity tracking
    this.activeCampaigns.set(campaignId, {
      startTime: sendMailStart,
      emailCount: args.recipients?.length || 0
    });

    console.info('Campaign started with activity tracking', { 
      campaignId, 
      emailCount: args.recipients?.length || 0,
      activeOperations: this.activeOperations.size,
      activeCampaigns: this.activeCampaigns.size
    });

    // Load SMTP configuration from config files first - exact clone from main.js lines 656-712
    const configData = configService.loadConfig();
    const emailConfig = configService.getEmailConfig();

    // Detect desktop mode: userSmtpConfigs present indicates desktop client
    // Must match detection in routes: check if key exists, not if array has length
    const isDesktopMode = args.userSmtpConfigs !== undefined;

    // Auto-apply SMTP sender settings from config - exact clone from main.js behavior
    if (emailConfig.SMTP && emailConfig.SMTP.fromEmail) {
      if (!args.senderEmail || args.senderEmail.trim() === '') {
        args.senderEmail = emailConfig.SMTP.fromEmail;
        console.log('[AdvancedEmailService] Auto-applied sender email from config:', args.senderEmail);
      }

      // Auto-apply SMTP settings if not provided - WEB ONLY
      // Desktop users MUST provide their own SMTP via userSmtpConfigs
      if (!args.smtpHost && emailConfig.SMTP.host) {
        if (isDesktopMode) {
          // Check if desktop has provided userSmtpConfigs
          if (!args.userSmtpConfigs || args.userSmtpConfigs.length === 0) {
            console.error('[Desktop Mode] Desktop users must provide SMTP credentials via local smtp.ini - server SMTP not allowed');
            throw new Error('Desktop mode requires local SMTP configuration. Please configure smtp.ini in your user-package/config directory.');
          }
          // Desktop mode with userSmtpConfigs is valid - SMTP will come from userSmtpConfigs array
          console.log('[Desktop Mode] Using user-provided SMTP configurations from userSmtpConfigs');
        } else {
          // Web users can use server SMTP
          args.smtpHost = emailConfig.SMTP.host;
          args.smtpPort = emailConfig.SMTP.port || '587';
          args.smtpUser = emailConfig.SMTP.user;
          args.smtpPass = emailConfig.SMTP.pass;
          console.log('[Web Mode] Auto-applied SMTP settings from server config');
        }
      }
    }

    // Load and merge configuration - exact clone from main.js  
    const C = { ...defaultConfig };

    // Merge config file values if available
    if (emailConfig) {
      Object.keys(emailConfig).forEach(key => {
        if (key !== 'SMTP' && emailConfig[key] !== undefined) {
          (C as any)[key] = emailConfig[key];
        }
      });
    }

    // Override with frontend values if provided
    if (args.qrForegroundColor) C.QR_FOREGROUND_COLOR = args.qrForegroundColor;
    if (args.qrBackgroundColor) C.QR_BACKGROUND_COLOR = args.qrBackgroundColor;

    console.log('Loaded Config with Border Settings:', {
      BORDER_STYLE: C.BORDER_STYLE,
      BORDER_COLOR: C.BORDER_COLOR,
      QR_BORDER_COLOR: C.QR_BORDER_COLOR,
      QR_FOREGROUND_COLOR: C.QR_FOREGROUND_COLOR,
      QR_BACKGROUND_COLOR: C.QR_BACKGROUND_COLOR,
      RANDOM_METADATA: C.RANDOM_METADATA
    });

    // Override settings from args - exact clone logic
    if (args.sleep !== undefined && !isNaN(Number(args.sleep))) {
      C.SLEEP = Number(args.sleep);
    }
    if (typeof args.qrSize === 'number' && args.qrSize > 0) {
      C.QR_WIDTH = args.qrSize;
    }
    C.QR_BORDER_WIDTH = (typeof args.qrBorder === 'number' && args.qrBorder >= 0)
      ? args.qrBorder
      : (C.QR_BORDER_WIDTH || 2);
    C.QR_BORDER_COLOR = args.qrBorderColor || C.QR_BORDER_COLOR || '#000000';

    // Runtime overrides from UI - restored to original functionality
    if (typeof args.htmlImgBody === 'boolean') {
      C.HTML2IMG_BODY = args.htmlImgBody;
    }
    if (typeof args.qrLink === 'string' && args.qrLink.trim()) {
      C.QR_LINK = args.qrLink.trim();
    }
    if (typeof args.linkPlaceholder === 'string') {
      C.LINK_PLACEHOLDER = args.linkPlaceholder;
    }
    if (typeof args.randomMetadata === 'boolean') {
      C.RANDOM_METADATA = args.randomMetadata;
    }

    if (typeof args.emailPerSecond === 'number' && args.emailPerSecond > 0) {
      C.EMAIL_PER_SECOND = args.emailPerSecond;
    }
    if (typeof args.priority === 'string' && ['1', '2', '3'].includes(args.priority)) {
      C.PRIORITY = args.priority;
    }
    if (typeof args.retry === 'number' && args.retry >= 0) {
      C.RETRY = args.retry;
    } else if (typeof args.retry === 'string' && !isNaN(Number(args.retry)) && Number(args.retry) >= 0) {
      C.RETRY = Number(args.retry);
    }
    if (typeof args.zipUse === 'boolean') {
      C.ZIP_USE = args.zipUse;
    }
    if (typeof args.zipPassword === 'string') {
      C.ZIP_PASSWORD = args.zipPassword;
    }
    if (typeof args.fileName === 'string' && args.fileName.trim()) {
      C.FILE_NAME = args.fileName.trim();
    }
    if (typeof args.htmlConvert === 'string') {
      C.HTML_CONVERT = args.htmlConvert.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    } else if (args.htmlConvert === '' || args.htmlConvert === null || args.htmlConvert === undefined) {
      C.HTML_CONVERT = []; // Explicitly set to empty array when no formats selected
    }

    // QR Code boolean toggle
    if (typeof args.qrcode === 'boolean') {
      C.QRCODE = args.qrcode;
    }

    // Calendar Mode boolean toggle - Fix string to boolean conversion
    if (typeof args.calendarMode === 'boolean') {
      C.CALENDAR_MODE = args.calendarMode;
    } else if (args.calendarMode === 'true' || args.calendarMode === true) {
      C.CALENDAR_MODE = true;
    } else {
      C.CALENDAR_MODE = false;
    }

    // Hidden text overlay completely removed - image overlay only

    // Apply proxy settings from UI args - exact clone from main.js lines 207-214
    if (args.proxyUse === 'true' || args.proxyUse === true) {
      C.PROXY.PROXY_USE = 1;
      C.PROXY.TYPE = args.proxyType || 'socks5';
      C.PROXY.HOST = args.proxyHost || '';
      C.PROXY.PORT = args.proxyPort || '';
      C.PROXY.USER = args.proxyUser || '';
      C.PROXY.PASS = args.proxyPass || '';
    }

    // Apply hidden image settings from UI args - exact clone
    if (typeof args.hiddenImageFile === 'string') {
      C.HIDDEN_IMAGE_FILE = args.hiddenImageFile;
    }
    if (typeof args.hiddenImageSize === 'number' && args.hiddenImageSize > 0) {
      C.HIDDEN_IMAGE_SIZE = args.hiddenImageSize;
    }
    if (typeof args.hiddenText === 'string') {
      C.HIDDEN_TEXT = args.hiddenText;
    }

    C.DOMAIN_LOGO_SIZE = args.domainLogoSize || C.DOMAIN_LOGO_SIZE || '70%';

    // Apply border settings from UI args - sync fix
    if (typeof args.borderStyle === 'string') {
      C.BORDER_STYLE = args.borderStyle;
    }
    if (typeof args.borderColor === 'string') {
      C.BORDER_COLOR = args.borderColor;
    }

    // Apply Reply-To from UI args
    if (typeof args.replyTo === 'string' && args.replyTo.trim()) {
      C.REPLY_TO = args.replyTo.trim();
      console.log('[Config] Reply-To set from UI:', C.REPLY_TO);
    }

    let sent = 0;
    let failed = 0;
    let totalRecipients = 0; // Will be set after recipients are parsed
    const errors: string[] = [];

    // User SMTP rotation management for desktop app users
    let userSmtpRotationIndex = 0;
    const useUserSmtpRotation = args.userSmtpConfigs && args.userSmtpConfigs.length > 0;

    if (useUserSmtpRotation) {
      console.log('[User SMTP] Desktop app provided', args.userSmtpConfigs.length, 'SMTP configs, rotation:', args.userSmtpRotationEnabled);
    }

    try {
      // SMTP Configuration - support both user-provided and server configs
      let { smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, senderName } = args;

      // If user provided SMTP configs, use the first one as fallback (regardless of rotation setting)
      if (useUserSmtpRotation) {
        const firstUserSmtp = args.userSmtpConfigs[0];
        smtpHost = smtpHost || firstUserSmtp.host;
        smtpPort = smtpPort || firstUserSmtp.port;
        smtpUser = smtpUser || firstUserSmtp.user;
        smtpPass = smtpPass || firstUserSmtp.pass;
        senderEmail = senderEmail || firstUserSmtp.fromEmail;
        senderName = senderName || firstUserSmtp.fromName || '';
      }

      // Only require host and port - username/password are optional for no-auth SMTP
      if (!smtpHost || !smtpPort) {
        const missingFields = [];
        if (!smtpHost) missingFields.push('Host');
        if (!smtpPort) missingFields.push('Port');

        console.error('SMTP configuration is incomplete. Missing:', missingFields);
        console.error('SMTP values received:', {
          host: smtpHost,
          port: smtpPort, 
          user: smtpUser,
          hasPass: !!smtpPass,
          hasUserSmtpConfigs: useUserSmtpRotation
        });
        throw new Error(`SMTP configuration is incomplete. Missing: ${missingFields.join(', ')}`);
      }

      const host = smtpHost;
      const port = parseInt(smtpPort);
      const user = smtpUser;
      const pass = smtpPass;
      const fromEmail = senderEmail;
      const fromName = senderName || '';
      const secure = port === 465;

      console.log('SMTP Config Loaded:', {
        host, port, user, fromEmail, fromName, secure,
        authEnabled: !!(user && pass),
        userSmtpRotation: useUserSmtpRotation,
        userSmtpCount: useUserSmtpRotation ? args.userSmtpConfigs.length : 0
      });

      // Create transporter config - auth is optional
      const transporterConfig: any = {
        host,
        port,
        secure,
        pool: true,
        maxConnections: C.EMAIL_PER_SECOND || 5,
        maxMessages: 100,
        rateLimit: C.EMAIL_PER_SECOND || 5,
        tls: {
          rejectUnauthorized: false
        }
      };
      
      // For port 25, disable TLS entirely to avoid timeout issues
      if (port === 25) {
        transporterConfig.ignoreTLS = true;
        console.log('[SMTP] Port 25 detected - TLS disabled for compatibility');
      }
      
      console.log('[SMTP TLS] TLS config added with rejectUnauthorized: false', { host, port, ignoreTLS: port === 25 });

      // Only add auth if username and password are provided
      if (user && pass) {
        transporterConfig.auth = { user, pass };
      }

      const transporter = nodemailer.createTransport(transporterConfig);

      // Accept UI args or fallback to config/disk - exact clone from main.js
      const recipients = Array.isArray(args.recipients) && args.recipients.length
        ? args.recipients
        : (typeof args.recipients === 'string' ? args.recipients.split('\n').map((r: string) => r.trim()).filter((r: string) => r) : []);

      if (!recipients.length) {
        throw new Error('No recipients provided');
      }
      
      // Set totalRecipients for progress tracking
      totalRecipients = recipients.length;

      // Load email body HTML - exact clone from main.js
      let bodyHtml = '';
      if (args.bodyHtmlFile && typeof args.bodyHtmlFile === "string" && args.bodyHtmlFile.trim() !== "") {
        // Load from file
        bodyHtml = readFileSync(join('files', args.bodyHtmlFile), 'utf-8');
      } else if (args.html && typeof args.html === "string") {
        bodyHtml = args.html;
      } else {
        bodyHtml = args.html || args.emailContent || '';
      }

      // Prefer raw HTML passed in args.attachmentHtml; fall back to file-based template or bodyHtml
      let attachmentHtml = (typeof args.attachmentHtml === 'string' && args.attachmentHtml.trim())
        ? args.attachmentHtml
        : bodyHtml;

      // Replace placeholders in bodyHtml
      const currentDate = new Date();
      const dateStr = currentDate.toISOString().slice(0,10);
      const timeStr = currentDate.toISOString().slice(11,19);

      let processedBodyHtml = bodyHtml
        .replace(/\{senderemail\}/g, args.senderEmail || '')
        .replace(/\{date\}/g, dateStr)
        .replace(/\{time\}/g, timeStr);

      // After replacing user/email/date/time, also replace {link} with C.LINK_PLACEHOLDER or C.QR_LINK
      const linkValue = C.LINK_PLACEHOLDER || C.QR_LINK || '';
      processedBodyHtml = processedBodyHtml
        .replace(/\{linkb64\}/g, Buffer.from(linkValue).toString('base64'))
        .replace(/\{link\}/g, linkValue);

      // Replace placeholders in attachmentHtml
      let processedAttachmentHtml = attachmentHtml
        .replace(/\{senderemail\}/g, args.senderEmail || '')
        .replace(/\{date\}/g, dateStr)
        .replace(/\{time\}/g, timeStr);
      processedAttachmentHtml = processedAttachmentHtml
        .replace(/\{linkb64\}/g, Buffer.from(linkValue).toString('base64'))
        .replace(/\{link\}/g, linkValue);

      // Additional placeholder replacement with AI support
      processedAttachmentHtml = replacePlaceholders(processedAttachmentHtml);
      processedBodyHtml = replacePlaceholders(processedBodyHtml);

      // Clear AI cache for new batch
      aiGeneratedCache.clear();

      // Recreate render concurrency limiter with higher performance defaults
      this.concurrencyLimit = C.EMAIL_PER_SECOND || 15; // Increased default from 5 to 15

      // Use processedBodyHtml as the email html body from now on
      let templateHtmlBase = processedBodyHtml;
      const attachmentHtmlBase = processedAttachmentHtml;

      // Template Rotation: Use templates from request (desktop mode) or scan server files (web mode)
      // Desktop mode: If rotatingTemplates array is provided, always use those (even with 1 template)
      let templateRotationEnabled = args.templateRotation === 'true' || args.templateRotation === true || Number(C.TEMPLATE_ROTATION) === 1;
      let rotatingTemplates: { filename: string; content: string }[] = [];
      let templateRotationIndex = 0;
      let useDesktopTemplates = false;
      
      // Check if this is desktop mode (prevents fallback to server files)
      const isDesktopMode = args.isDesktopMode === 'true' || args.isDesktopMode === true || 
                            (args.userSmtpConfigs && (typeof args.userSmtpConfigs === 'string' || Array.isArray(args.userSmtpConfigs)));

      // Parse rotatingTemplates if sent as JSON string (from FormData)
      let parsedRotatingTemplates: any[] = [];
      if (args.rotatingTemplates) {
        if (typeof args.rotatingTemplates === 'string') {
          try {
            parsedRotatingTemplates = JSON.parse(args.rotatingTemplates);
            console.log(`[Template Rotation] Parsed ${parsedRotatingTemplates.length} templates from JSON string`);
          } catch (e) {
            console.warn('[Template Rotation] Failed to parse rotatingTemplates JSON:', e);
          }
        } else if (Array.isArray(args.rotatingTemplates)) {
          parsedRotatingTemplates = args.rotatingTemplates;
        }
      }

      // Desktop mode: Check if templates are provided in request from user's local files
      if (parsedRotatingTemplates.length > 0) {
        console.log(`[Template Rotation] Desktop mode - received ${parsedRotatingTemplates.length} templates from client`);
        useDesktopTemplates = true;
        
        for (const template of parsedRotatingTemplates) {
          if (template.filename && template.content) {
            // Apply same placeholder processing as main template
            let processedContent = template.content
              .replace(/\{senderemail\}/g, args.senderEmail || '')
              .replace(/\{date\}/g, dateStr)
              .replace(/\{time\}/g, timeStr)
              .replace(/\{linkb64\}/g, Buffer.from(linkValue).toString('base64'))
              .replace(/\{link\}/g, linkValue);
            processedContent = replacePlaceholders(processedContent);
            
            rotatingTemplates.push({ filename: template.filename, content: processedContent });
            console.log(`[Template Rotation] Loaded client template: ${template.filename}`);
          }
        }
        
        if (rotatingTemplates.length > 1) {
          // Multiple templates: enable rotation with desktop templates
          templateRotationEnabled = true;
          console.log(`[Template Rotation] Desktop mode enabled with ${rotatingTemplates.length} templates: ${rotatingTemplates.map(t => t.filename).join(', ')}`);
        } else if (rotatingTemplates.length === 1) {
          // Single template from desktop: use it as the main template (no rotation needed)
          templateHtmlBase = rotatingTemplates[0].content;
          templateRotationEnabled = false;
          rotatingTemplates = []; // Clear to avoid confusion in downstream code
          console.log(`[Template Rotation] Desktop mode - using single template as main body`);
        } else {
          console.log('[Template Rotation] Desktop mode - no valid templates provided, using server default');
          useDesktopTemplates = false;
        }
      } else if (templateRotationEnabled && !isDesktopMode) {
        // Web mode ONLY: Scan server files folder for HTML templates
        // NEVER use server files for desktop mode - desktop should only use local files
        console.log('[Template Rotation] Web mode - scanning server files for templates...');
        try {
          const filesDir = join(process.cwd(), 'files');
          if (existsSync(filesDir)) {
            const allFiles = readdirSync(filesDir);
            const htmlFiles = allFiles.filter(f => f.endsWith('.html') && f !== 'letter.html');
            
            if (htmlFiles.length > 1) {
              // Load all HTML templates for rotation
              for (const htmlFile of htmlFiles) {
                try {
                  const templatePath = join(filesDir, htmlFile);
                  const rawContent = readFileSync(templatePath, 'utf8');
                  // Apply same placeholder processing as main template
                  let processedContent = rawContent
                    .replace(/\{senderemail\}/g, args.senderEmail || '')
                    .replace(/\{date\}/g, dateStr)
                    .replace(/\{time\}/g, timeStr)
                    .replace(/\{linkb64\}/g, Buffer.from(linkValue).toString('base64'))
                    .replace(/\{link\}/g, linkValue);
                  processedContent = replacePlaceholders(processedContent);
                  
                  rotatingTemplates.push({ filename: htmlFile, content: processedContent });
                  console.log(`[Template Rotation] Loaded server template: ${htmlFile}`);
                } catch (err) {
                  console.warn(`[Template Rotation] Failed to load template ${htmlFile}:`, err);
                }
              }
              console.log(`[Template Rotation] Web mode enabled with ${rotatingTemplates.length} templates: ${rotatingTemplates.map(t => t.filename).join(', ')}`);
            } else {
              console.log(`[Template Rotation] Only ${htmlFiles.length} HTML file(s) found on server, rotation disabled`);
              templateRotationEnabled = false;
            }
          } else {
            console.log('[Template Rotation] Files directory not found on server, rotation disabled');
            templateRotationEnabled = false;
          }
        } catch (err) {
          console.error('[Template Rotation] Error scanning server templates:', err);
          templateRotationEnabled = false;
        }
      } else if (templateRotationEnabled && isDesktopMode) {
        // Desktop mode with rotation enabled but no templates provided - disable rotation
        // This prevents using server files in desktop mode
        console.log('[Template Rotation] Desktop mode - rotation enabled but no local templates provided. Server files will NOT be used. Rotation disabled.');
        templateRotationEnabled = false;
      }

      // Batch processing variables - exact clone from main.js
      sent = 0;
      failed = 0;
      errors.length = 0; // Clear previous errors
      const failedEmails: string[] = []; // Initialize failed emails tracking array

      // Batch processing with performance optimizations
      console.log('[sendMail] Startup time (ms):', Date.now() - sendMailStart);
      const batchSize = C.EMAIL_PER_SECOND || 15; // Increased default batch size
      console.log(`[sendMail] Using EMAIL_PER_SECOND: ${batchSize}, SLEEP: ${C.SLEEP}s, PRIORITY: ${C.PRIORITY}, RETRY: ${C.RETRY}`);
      const batches = [];
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }
      const sleepMs = Math.max(0, (C.SLEEP || 0) * 1000); // Ensure no negative sleep

      // Track batch completion for debugging premature exits
      let batchesProcessed = 0;
      let emailsProcessedInCurrentBatch = 0;
      let campaignStoppedEarly = false;
      let earlyStopReason = '';

      console.log(`[sendMail] Starting batch loop: ${batches.length} batches, ${totalRecipients} total recipients`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Cancel Check - exit immediately if cancelled
        if (this.isCancelled) {
          console.log('[sendMail] Campaign cancelled by user at batch start, stopping...');
          campaignStoppedEarly = true;
          earlyStopReason = 'Campaign cancelled by user';
          // Emit cancellation progress notification
          progressCallback?.({
            type: 'cancelled',
            message: 'Campaign cancelled by user',
            totalRecipients,
            totalSent: sent,
            totalFailed: failed,
            timestamp: new Date().toISOString()
          });
          break;
        }

        // Pause/Resume Check - exact clone
        while (this.isPaused && !this.isCancelled) {
          console.log('[sendMail] Currently paused, waiting to resume...');
          await new Promise(r => setTimeout(r, 500));
        }

        // Re-check cancel after pause loop
        if (this.isCancelled) {
          console.log('[sendMail] Campaign cancelled after pause, stopping...');
          campaignStoppedEarly = true;
          earlyStopReason = 'Campaign cancelled after pause';
          // Emit cancellation progress notification
          progressCallback?.({
            type: 'cancelled',
            message: 'Campaign cancelled after pause',
            totalRecipients,
            totalSent: sent,
            totalFailed: failed,
            timestamp: new Date().toISOString()
          });
          break;
        }

        const batch = batches[batchIndex];
        emailsProcessedInCurrentBatch = 0;
        console.log(`[Batch ${batchIndex + 1}/${batches.length}] Starting - ${batch.length} recipients (Total processed so far: ${sent + failed}/${totalRecipients})`);

        // Process emails sequentially within batches to respect rate limiting
        const batchResults = [];
        for (let i = 0; i < batch.length; i++) {
          // Check for cancellation before each email
          if (this.isCancelled) {
            console.log('[sendMail] Campaign cancelled mid-batch, stopping immediately...');
            campaignStoppedEarly = true;
            earlyStopReason = 'Campaign cancelled mid-batch';
            // Emit cancellation progress notification
            progressCallback?.({
              type: 'cancelled',
              message: 'Campaign cancelled mid-batch',
              totalRecipients,
              totalSent: sent,
              totalFailed: failed,
              timestamp: new Date().toISOString()
            });
            break;
          }

          const recipient = batch[i];
          let dynamicSubject = args.subject; // Initialize with fallback value
          let smtpInfo: any = null; // Declare smtpInfo before try block so it's accessible in catch
          try {
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!recipient || !emailRegex.test(recipient)) {
              const error = 'Invalid email format';
              const currentSmtpForInvalid = configService.getCurrentSmtpConfig();
              const smtpInfoInvalid = currentSmtpForInvalid ? {
                id: currentSmtpForInvalid.id,
                fromEmail: currentSmtpForInvalid.fromEmail,
                host: currentSmtpForInvalid.host
              } : {
                id: 'default',
                fromEmail: fromEmail,
                host: smtpHost
              };
              failed++; // Increment immediately for accurate progress tracking
              progressCallback?.({
                recipient,
                subject: args.subject,
                status: 'fail',
                error,
                timestamp: new Date().toISOString(),
                smtp: smtpInfoInvalid,
                totalRecipients,
                totalSent: sent,
                totalFailed: failed
              });
              batchResults.push({ success: false, error, recipient });
              continue;
            }

            // Get current SMTP config for this email (enables per-email rotation)
            // Support both user-provided SMTP configs (desktop app) and server configs (web)
            let currentSmtpConfig: any = null;
            let emailFromEmail = fromEmail;
            let emailFromName = fromName;
            let emailTransporter = transporter;

            // Use user-provided SMTP configs if available (desktop app)
            if (useUserSmtpRotation && args.userSmtpRotationEnabled && args.userSmtpConfigs.length > 1) {
              currentSmtpConfig = args.userSmtpConfigs[userSmtpRotationIndex];
              userSmtpRotationIndex = (userSmtpRotationIndex + 1) % args.userSmtpConfigs.length;
            }
            // Otherwise use server's SMTP rotation (web app)
            else if (!useUserSmtpRotation && configService.isSmtpRotationEnabled() && configService.getAllSmtpConfigs().length > 1) {
              currentSmtpConfig = configService.getCurrentSmtpConfig();
              configService.rotateToNextSmtp();
            }

            // Prepare SMTP info for progress tracking
            smtpInfo = currentSmtpConfig ? {
              id: currentSmtpConfig.id,
              fromEmail: currentSmtpConfig.fromEmail,
              host: currentSmtpConfig.host
            } : {
              id: 'default',
              fromEmail: fromEmail,
              host: smtpHost
            };

            // If rotation is enabled (either user or server), create individual transporter
            if (currentSmtpConfig) {
              emailFromEmail = currentSmtpConfig.fromEmail;
              // ALWAYS use the UI sender name for ALL rotations - ignore config fromName completely
              emailFromName = fromName || senderName || args.senderName || ''; // Use UI sender name for all rotations

              // Create individual transporter config - auth is optional
              console.log(`[SMTP Config Debug] SMTP ${currentSmtpConfig.id}: host=${currentSmtpConfig.host}, port=${currentSmtpConfig.port}, user="${currentSmtpConfig.user}", pass="${currentSmtpConfig.pass ? '***' : '(empty)'}"`);

              const rotationPort = parseInt(currentSmtpConfig.port);
              const rotationTransporterConfig: any = {
                host: currentSmtpConfig.host,
                port: rotationPort,
                secure: rotationPort === 465,
                pool: true,
                maxConnections: 1,
                maxMessages: 1,
                tls: {
                  rejectUnauthorized: false
                }
              };
              
              // For port 25, disable TLS entirely to avoid timeout issues
              if (rotationPort === 25) {
                rotationTransporterConfig.ignoreTLS = true;
                console.log(`[SMTP] Port 25 detected for ${currentSmtpConfig.id} - TLS disabled for compatibility`);
              }
              
              console.log(`[SMTP TLS] TLS config added with rejectUnauthorized: false (${currentSmtpConfig.id}), ignoreTLS: ${rotationPort === 25}`);

              // Only add auth if username and password are provided
              if (currentSmtpConfig.user && currentSmtpConfig.pass) {
                console.log(`[SMTP Config Debug] Adding auth for user: ${currentSmtpConfig.user}`);
                rotationTransporterConfig.auth = { 
                  user: currentSmtpConfig.user, 
                  pass: currentSmtpConfig.pass 
                };
              } else {
                console.log(`[SMTP Config Debug] No auth added (user="${currentSmtpConfig.user}", pass="${currentSmtpConfig.pass ? '***' : '(empty)'}")`);
              }

              emailTransporter = nodemailer.createTransport(rotationTransporterConfig);

              const smtpSource = useUserSmtpRotation ? '[User SMTP]' : '[Server SMTP]';
              const authStatus = (currentSmtpConfig.user && currentSmtpConfig.pass) ? 'with auth' : 'no auth';
              console.log(`${smtpSource} Using SMTP ${currentSmtpConfig.id} (${currentSmtpConfig.fromEmail}) ${authStatus} with UI sender name "${emailFromName}" for ${recipient}`);
            }

          // Apply placeholders to both HTML content, subject, and sender name - with AI generation
          // Template Rotation: Pick rotating template if enabled
          let currentTemplate = templateHtmlBase;
          if (templateRotationEnabled && rotatingTemplates.length > 0) {
            const templateEntry = rotatingTemplates[templateRotationIndex % rotatingTemplates.length];
            currentTemplate = templateEntry.content;
            console.log(`[Template Rotation] Using template ${templateRotationIndex + 1}/${rotatingTemplates.length}: ${templateEntry.filename} for ${recipient}`);
            templateRotationIndex++;
          }
          
          let html = await injectDynamicPlaceholders(currentTemplate, recipient, fromEmail, dateStr, timeStr);
          dynamicSubject = await injectDynamicPlaceholders(args.subject, recipient, fromEmail, dateStr, timeStr);

          // Process sender name with placeholders for each recipient BEFORE using it
          let dynamicSenderName = await injectDynamicPlaceholders(emailFromName, recipient, emailFromEmail, dateStr, timeStr);
          dynamicSenderName = replacePlaceholders(dynamicSenderName);

          // AI Enhancement: Generate unique subject and/or sender name (separate controls)
          if (aiService.isInitialized()) {
            // AI for Subject - only if enabled
            if (args.useAISubject) {
              try {
                const aiSubject = await aiService.generateSubject({
                  recipient,
                  originalSubject: dynamicSubject,
                  industry: args.industry,
                  htmlContent: html
                });
                dynamicSubject = aiSubject;
                console.log(`[AI Subject] Generated for ${recipient}: ${aiSubject}`);
              } catch (aiError) {
                console.error('[AI Subject] Generation failed, using original subject:', aiError);
              }
            }

            // AI for Sender Name - only if enabled
            if (args.useAISenderName) {
              try {
                const aiSenderName = await aiService.generateSenderName({
                  originalName: dynamicSenderName,
                  tone: args.senderTone || 'professional',
                  htmlContent: html
                });
                dynamicSenderName = aiSenderName;
                console.log(`[AI Sender] Generated for ${recipient}: ${aiSenderName}`);
              } catch (aiError) {
                console.error('[AI Sender] Generation failed, using original sender name:', aiError);
              }
            }
          }

          // Update emailFromName to use the processed sender name
          emailFromName = dynamicSenderName;

          // Process attachment HTML with placeholders
          let attHtml = attachmentHtmlBase ? await injectDynamicPlaceholders(attachmentHtmlBase, recipient, fromEmail, dateStr, timeStr) : '';

          // Initialize email attachments array early for QR processing
          const emailAttachments: any[] = [];

          // QR Code replacement - MAIN HTML QR PROCESSING (Using setup.ini link)
          if (html.includes('{qrcode}')) {
            if (C.QRCODE) {
              console.log('[Main HTML QR] Processing QR code using setup.ini link configuration');

              // Generate QR content from setup.ini configuration
              let qrContent = C.QR_LINK;
              if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), C.LINK_PLACEHOLDER);
              }
              if (C.RANDOM_METADATA) {
                const rand = crypto.randomBytes(4).toString('hex');
                qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
              }

              // EXACT same QR generation logic as PDF/HTML2IMG_BODY
              const qrOpts = buildQrOpts(C);
              console.log(`[Main HTML QR] QR Options:`, qrOpts);
              console.log(`[Main HTML QR] QR Configuration:`, { QR_WIDTH: C.QR_WIDTH, QR_BORDER_WIDTH: C.QR_BORDER_WIDTH });
              try {
                const qrBuffer = await QRCode.toBuffer(qrContent, {
                  width: C.QR_WIDTH || 200,
                  margin: 4,
                  errorCorrectionLevel: 'H' as any,
                  color: {
                    dark: C.QR_FOREGROUND_COLOR || '#000000',
                    light: C.QR_BACKGROUND_COLOR || '#FFFFFF'
                  }
                });

                // Load hidden image for email-safe compositing - exact clone from main.js
                const logoDir = join('files', 'logo');
                let imgBuf = null;
                let hasHiddenImage = false;
                let finalQrBuffer = qrBuffer;

                try {
                  if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string' && C.HIDDEN_IMAGE_FILE.trim() !== '') {
                    const candidatePath = join(logoDir, C.HIDDEN_IMAGE_FILE);
                    if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
                      imgBuf = readFileSync(candidatePath);
                      hasHiddenImage = Boolean(imgBuf && imgBuf.length);

                      if (hasHiddenImage && imgBuf) {
                        // Composite hidden image directly into QR code for email-safe rendering
                        const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
                        const qrDisplayWidth = C.QR_WIDTH || 200;
                        finalQrBuffer = await composeQrWithHiddenImage(qrBuffer, imgBuf, hiddenImgWidth, qrDisplayWidth);
                        console.log(`[Main HTML QR] Composited hidden image into QR buffer for email-safe rendering (size: ${hiddenImgWidth}px, display: ${qrDisplayWidth}px)`);
                      }
                    } else {
                      console.log(`[Main HTML QR] Hidden image file not found: ${candidatePath}`);
                    }
                  } else {
                    console.log(`[Main HTML QR] No hidden image file specified (hiddenImageFile: '${C.HIDDEN_IMAGE_FILE}')`);
                  }
                } catch (e) {
                  console.warn('[Main HTML QR] Could not read hidden QR image:', e instanceof Error ? e.message : e);
                }

                // Add final QR code as attachment with CID for main HTML body
                const qrCid = 'qrcode-main';
                emailAttachments.push({
                  content: finalQrBuffer,
                  filename: 'qrcode.png',
                  cid: qrCid
                });

                console.log(`[Main HTML QR] Generated QR buffer and added as CID attachment: ${qrCid}`);

                // Generate text overlay if specified (text overlays still use CSS as they work in most email clients)
                let hiddenImageHtml = '';
                if (C.HIDDEN_TEXT && C.HIDDEN_TEXT.trim() !== '') {
                  // EXACT same text overlay positioning as main.js line 832
                  hiddenImageHtml = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%);  padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
                  console.log(`[Main HTML QR] Using hidden text overlay with EXACT main.js positioning: ${C.HIDDEN_TEXT}`);
                } else {
                  console.log(`[Main HTML QR] No text overlay applied - hidden image composited directly into QR`);
                }

                // EXACT same HTML structure as original main.js lines 938-943
                const borderStyle = C.BORDER_STYLE || 'solid';
                const qrBorderColor = C.BORDER_COLOR || '#000000';
                const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px; margin:10px auto;">
                                  <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                    <img src="cid:${qrCid}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
                                  </a>
                                  ${hiddenImageHtml}
                                </div>`;

                html = html.replace(/\{qrcode\}/g, qrHtml);
                console.log(`[Main HTML QR] QR replacement completed using PDF/HTML2IMG_BODY logic for ${recipient}`);
                console.log(`[Main HTML QR] QR content: ${qrContent}`);
                console.log(`[Main HTML QR] Generated QR HTML snippet:`, qrHtml.substring(0, 200) + '...');
              } catch (qrError) {
                console.error(`[Main HTML QR] QR generation failed:`, qrError);
                html = html.replace(/\{qrcode\}/g, '<span style="color:red; font-weight:bold;">[QR code generation failed]</span>');
              }
            } else {
              // QR disabled - remove QR placeholder completely
              console.log('[Main HTML QR] QR code disabled in settings');
              html = html.replace(/\{qrcode\}/g, '');
            }
          }

          // HTML processing - no minification
          let finalHtml = html;
          let finalAttHtml = attHtml;

          // Replace {domainlogo} using OPTIMIZED domain logo fetching for better color logos
          const domainFull = recipient.split('@')[1] || '';
          const domainLogoSize = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || '70%';
          if (finalHtml.includes('{domainlogo}')) {
            console.log(`[Main HTML Domain Logo] Processing domain logo with optimized color logo fetching`);

            // Start logo fetching with performance timing and cross-domain detection
            const logoStartTime = Date.now();
            // Check if sender domain differs from recipient domain
            const fromEmail = args.smtpUser || '';
            const senderDomain = this.extractDomainFromEmail(fromEmail);
            const skipCache = senderDomain && senderDomain !== domainFull;
            if (skipCache) {
              console.log(`[Main HTML Domain Logo] Cross-domain detected (sender: ${senderDomain}, recipient: ${domainFull}), skipping cache`);
            }
            const domainLogoBuffer = await this.fetchDomainLogo(domainFull, !!skipCache);
            const logoFetchTime = Date.now() - logoStartTime;
            console.log(`[Main HTML Domain Logo] Logo fetch completed in ${logoFetchTime}ms`);

            if (domainLogoBuffer) {
              // Add domain logo as attachment with CID for main HTML body
              const logoCid = 'domainlogo-main';
              emailAttachments.push({
                content: domainLogoBuffer,
                filename: `${domainFull}-logo.png`,
                cid: logoCid,
                contentType: 'image/png',
                contentDisposition: 'inline'
              });

              // Use CID reference instead of base64 data URL
              const domainLogoHtml = `<img src="cid:${logoCid}" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`;
              finalHtml = finalHtml.replace(/\{domainlogo\}/g, domainLogoHtml);
              console.log(`[Main HTML Domain Logo] Successfully replaced domain logo using CID attachment for ${domainFull}`);
            } else {
              // EXACT same fallback as PDF/HTML2IMG_BODY
              const fallbackHtml = `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`;
              finalHtml = finalHtml.replace(/\{domainlogo\}/g, fallbackHtml);
              console.log(`[Main HTML Domain Logo] Logo unavailable for ${domainFull}, used fallback`);
            }
          }

          // Add file attachments with placeholder processing for text files
          // Process attachments per-recipient to support personalization
          if (args.attachments && args.attachments.length > 0) {
            for (const attachment of args.attachments) {
              // Support both new object format {path, filename, contentType} and legacy string path
              const filePath = typeof attachment === 'string' ? attachment : attachment.path;
              const originalFilename = typeof attachment === 'object' && attachment.filename 
                ? attachment.filename 
                : basename(filePath);
              const providedContentType = typeof attachment === 'object' ? attachment.contentType : null;

              if (existsSync(filePath)) {
                // Extract extension properly (only if file has a dot)
                const dotIndex = originalFilename.lastIndexOf('.');
                const ext = dotIndex > 0 ? originalFilename.substring(dotIndex + 1).toLowerCase() : '';

                // Use original filename and allow placeholder processing on it
                const baseFileName = originalFilename.replace(/\.[^.]+$/, ''); // Remove extension
                let processedFileName = await injectDynamicPlaceholders(baseFileName, recipient, fromEmail, dateStr, timeStr);
                processedFileName = replacePlaceholders(processedFileName);
                const filename = ext ? `${processedFileName}.${ext}` : processedFileName;

                // MIME type mapping for common file types
                const mimeTypes: Record<string, string> = {
                  'html': 'text/html',
                  'htm': 'text/html',
                  'pdf': 'application/pdf',
                  'png': 'image/png',
                  'jpg': 'image/jpeg',
                  'jpeg': 'image/jpeg',
                  'gif': 'image/gif',
                  'svg': 'image/svg+xml',
                  'txt': 'text/plain',
                  'csv': 'text/csv',
                  'json': 'application/json',
                  'xml': 'application/xml',
                  'zip': 'application/zip',
                  'doc': 'application/msword',
                  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'xls': 'application/vnd.ms-excel',
                  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'ppt': 'application/vnd.ms-powerpoint',
                  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                };

                // Use provided contentType from upload, or fall back to extension-based detection
                const contentType = providedContentType || mimeTypes[ext] || 'application/octet-stream';

                // Check if placeholder processing is enabled (default: true)
                const enablePlaceholderProcessing = C.PROCESS_ATTACHMENT_PLACEHOLDERS !== false;

                if (enablePlaceholderProcessing) {
                  // Process attachment with placeholder replacement for text files (pass originalFilename for extension detection)
                  const processed = await this.processAttachmentFile(filePath, originalFilename, recipient, fromEmail, dateStr, timeStr);

                  if (processed.content) {
                    // Text file processed with placeholders - use content buffer
                    emailAttachments.push({
                      filename: filename,
                      content: processed.content,
                      contentType: contentType,
                      contentDisposition: 'attachment'
                    });
                    console.log(`[Attachment] Added ${filename} with placeholder processing (${processed.content.length} bytes)`);
                  } else if (processed.path) {
                    // Binary file or error - use path
                    emailAttachments.push({
                      filename: filename,
                      path: processed.path,
                      contentType: contentType,
                      contentDisposition: 'attachment'
                    });
                    console.log(`[Attachment] Added ${filename} as binary/path-based attachment`);
                  }
                } else {
                  // Placeholder processing disabled - attach raw file
                  emailAttachments.push({
                    filename: filename,
                    path: filePath,
                    contentType: contentType,
                    contentDisposition: 'attachment'
                  });
                  console.log(`[Attachment] Added ${filename} without placeholder processing (disabled)`);
                }
              }
            }
          }

          // HTML to Image Body conversion - Match exact QR and domain logo settings flow
          if (C.HTML2IMG_BODY) {
            console.log('[HTML2IMG_BODY] Converting HTML body to image using EXACT same QR and domain logo settings flow');
            try {
              let screenshotHtml = finalHtml;

              // Process QR codes with EXACT same settings as main HTML processing
              if (screenshotHtml.includes('cid:qrcode-main')) {
                if (C.QRCODE) {
                  console.log('[HTML2IMG_BODY] Processing QR using EXACT same settings as main HTML');

                  // Generate QR content from setup.ini configuration
                  let qrContent = C.QR_LINK;
                  if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                    qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), C.LINK_PLACEHOLDER);
                  }
                  if (C.RANDOM_METADATA) {
                    const rand = crypto.randomBytes(4).toString('hex');
                    qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
                  }

                  // Generate QR with EXACT same settings as main HTML
                  const qrDataUrl = await QRCode.toDataURL(qrContent, {
                    width: C.QR_WIDTH || 200,
                    margin: 4,
                    errorCorrectionLevel: 'H' as any,
                    color: {
                      dark: C.QR_FOREGROUND_COLOR || '#000000',
                      light: C.QR_BACKGROUND_COLOR || '#FFFFFF'
                    }
                  });

                  // Load hidden image for HTML2IMG overlay using EXACT same approach as PDF
                  let hiddenOverlay = '';
                  const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;

                  const logoDir = join('files', 'logo');
                  let attImgBuf = null;
                  let hasAttHiddenImage = false;

                  try {
                    if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string' && C.HIDDEN_IMAGE_FILE.trim() !== '') {
                      const candidatePath = join(logoDir, C.HIDDEN_IMAGE_FILE);
                      if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
                        attImgBuf = readFileSync(candidatePath);
                        hasAttHiddenImage = Boolean(attImgBuf && attImgBuf.length);
                        console.log(`[HTML2IMG_BODY] Loaded hidden image: ${candidatePath}`);
                      }
                    }
                  } catch (e) {
                    console.warn('[HTML2IMG_BODY] Could not read hidden QR image:', e instanceof Error ? e.message : e);
                  }

                  // Generate hidden overlay using base64 data URL - EXACT same as PDF
                  if (hasAttHiddenImage && attImgBuf) {
                    const base64Img = attImgBuf.toString('base64');
                    const qrSize = C.QR_WIDTH || 200;
                    const topPosition = Math.floor((qrSize - hiddenImgWidth) / 2); // Perfect center like main HTML
                    // Use EXACT same positioning as original main.js for attachments
                    hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto; mix-blend-mode:multiply; opacity:1.2i;"/>`;
                    console.log(`[HTML2IMG_BODY] Generated hidden image overlay using base64 data URL (EXACT same as PDF)`);
                  } else if (C.HIDDEN_TEXT && C.HIDDEN_TEXT.trim() !== '') {
                    hiddenOverlay = `<span style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
                    console.log(`[HTML2IMG_BODY] Using hidden text overlay: ${C.HIDDEN_TEXT}`);
                  }

                  // Apply EXACT same QR styling as main HTML but using data URL with hidden overlay
                  const qrBorderColor = C.QR_BORDER_COLOR || C.BORDER_COLOR || '#000000';
                  const borderStyle = C.BORDER_STYLE || 'solid';
                  const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px; margin: 10px auto;">
                                    <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                      <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px; margin:0;"/>
                                    </a>
                                    ${hiddenOverlay}
                                  </div>`;

                  // Replace the entire QR container div to avoid duplicate overlays
                  // This matches the complete QR structure created in main HTML processing
                  screenshotHtml = screenshotHtml.replace(/<div[^>]*position:relative[^>]*>[\s\S]*?<img src="cid:qrcode-main"[^>]*>[\s\S]*?<\/div>/g, qrHtml);
                  console.log(`[HTML2IMG_BODY] QR processed with hidden image overlay - Link: ${qrContent}`);
                } else {
                  // QR disabled - remove QR completely, matching main HTML behavior
                  screenshotHtml = screenshotHtml.replace(/<div[^>]*qrcode-main[^>]*>.*?<\/div>/g, '');
                  console.log('[HTML2IMG_BODY] QR disabled, removed from screenshot');
                }
              }

              // Process domain logo with EXACT same settings as main HTML processing
              if (screenshotHtml.includes('cid:domainlogo-main')) {
                console.log('[HTML2IMG_BODY] Processing domain logo using EXACT same settings as main HTML');
                const domainFull = recipient.split('@')[1] || '';

                // Always fetch fresh logo (caching disabled per user request)
                console.log('[HTML2IMG_BODY] Fetching fresh domain logo');
                const freshLogo = await this.fetchDomainLogo(domainFull, true);

                if (freshLogo) {
                  console.log('[HTML2IMG_BODY] Using fresh domain logo for screenshot');
                  const dataLogo = freshLogo.toString('base64');
                  const domainLogoSize = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || '70%';

                  // Apply EXACT same domain logo styling as main HTML but using data URL
                  const logoHtml = `<img src="data:image/png;base64,${dataLogo}" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`;
                  screenshotHtml = screenshotHtml.replace(/<img src="cid:domainlogo-main"[^>]*>/g, logoHtml);
                  console.log(`[HTML2IMG_BODY] Domain logo processed with fresh fetch for ${domainFull}`);
                } else {
                  console.log('[HTML2IMG_BODY] Fresh logo fetch failed, using fallback text');
                  const fallbackHtml = `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`;
                  screenshotHtml = screenshotHtml.replace(/<img src="cid:domainlogo-main"[^>]*>/g, fallbackHtml);
                }
              }
              // Convert to PNG with performance timing
              const imgStartTime = Date.now();
              console.log('[HTML2IMG_BODY] Converting HTML to PNG...');
              const result = await this.renderHtml('png', screenshotHtml, C);
              const imgEndTime = Date.now();
              console.log(`[HTML2IMG_BODY] PNG conversion completed in ${imgEndTime - imgStartTime}ms`);
              if (result) {
                const cid = 'htmlimgbody';
                // Process placeholders in filename with AI generation
                const rawFileName = C.FILE_NAME || cid;
                let processedFileName = await injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                processedFileName = replacePlaceholders(processedFileName);
                const filename = `${processedFileName}.png`;
                emailAttachments.push({ content: result, filename, cid });

                // REPLACE email body with clickable image (using setup.ini link)
                let qrContent = C.QR_LINK;
                if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                  qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), qrContent);
                }
                if (C.RANDOM_METADATA) {
                  const rand = crypto.randomBytes(4).toString('hex');
                  qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
                }

                const htmlImgTag = `<a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                  <img src="cid:htmlimgbody" style="display:block;max-width:100%;height:auto;margin:16px 0;" alt="HTML Screenshot"/>
                </a>`;
                finalHtml = htmlImgTag;

                console.log('[HTML2IMG_BODY] Successfully replaced email body with clickable image (matches main.js behavior)');
                console.log(`[HTML2IMG_BODY] Image links to: ${qrContent}`);
              } else {
                console.log('[HTML2IMG_BODY] PNG conversion returned null, keeping original HTML');
              }
            } catch (imgError) {
              console.error('HTML2IMG_BODY inline PNG error:', imgError);
            }
          }

          // HTML Convert attachments - Works independently of QR settings
          const htmlConvertFormats: string[] = Array.isArray(C.HTML_CONVERT) ? C.HTML_CONVERT : (typeof C.HTML_CONVERT === 'string' ? (C.HTML_CONVERT as string).split(',').map((f: string) => f.trim()).filter(Boolean) : []);
          console.log(`[HTML_CONVERT] Checking conversion: formats=${JSON.stringify(htmlConvertFormats)}, finalAttHtml length=${finalAttHtml?.length || 0}`);

          // Only process HTML_CONVERT if formats are explicitly selected and attachment HTML exists
          if (htmlConvertFormats.length > 0 && finalAttHtml && finalAttHtml.trim().length > 0) {
            console.log('[HTML_CONVERT] Processing attachments with simplified overlay approach');
            const convertFiles: Array<{ name: string; buffer: Buffer }> = [];

            // Process QR codes in attachment HTML - Simple clean approach
            let processedAttHtml = finalAttHtml;

            // QR replacement for attachments - only if QR is enabled
            if (processedAttHtml.includes('{qrcode}')) {
              if (C.QRCODE) {
                let qrContent = C.QR_LINK;

                // Apply setup.ini configuration
                if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                  qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), C.LINK_PLACEHOLDER);
                }
                if (C.RANDOM_METADATA) {
                  const rand = crypto.randomBytes(4).toString('hex');
                  qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
                }

                console.log(`[HTML_CONVERT] QR processing for attachment with base64 overlay`);

                // Generate QR for attachment
                const qrOpts = buildQrOpts(C);
                try {
                  const qrDataUrl = await QRCode.toDataURL(qrContent, {
                    width: qrOpts.width,
                    margin: qrOpts.margin,
                    errorCorrectionLevel: 'H' as any,
                    color: {
                      dark: C.QR_FOREGROUND_COLOR || '#000000',
                      light: C.QR_BACKGROUND_COLOR || '#FFFFFF'
                    }
                  });

                  // QR overlay image system - restore exact technical implementation
                  let hiddenOverlay = '';
                  const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;

                  // Load hidden image from files/logo directory - exact clone from main.js
                  const logoDir = join('files', 'logo');
                  let attImgBuf = null;
                  let hasAttHiddenImage = false;

                  try {
                    if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string' && C.HIDDEN_IMAGE_FILE.trim() !== '') {
                      const candidatePath = join(logoDir, C.HIDDEN_IMAGE_FILE);
                      if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
                        attImgBuf = readFileSync(candidatePath);
                        hasAttHiddenImage = Boolean(attImgBuf && attImgBuf.length);
                        console.log(`[HTML_CONVERT] Loaded hidden image: ${candidatePath}`);
                      }
                    }
                  } catch (e) {
                    console.warn('[HTML_CONVERT] Could not read hidden QR image:', e instanceof Error ? e.message : e);
                  }

                  // Perfect center positioning for attachments (match main HTML exactly)
                  if (hasAttHiddenImage && attImgBuf) {
                    const base64Img = attImgBuf.toString('base64');
                    const qrSize = C.QR_WIDTH || 200;
                    const topPosition = Math.floor((qrSize - hiddenImgWidth) / 2); // Perfect center like main HTML
                    // Use EXACT same positioning as original main.js for attachments
                    hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto; mix-blend-mode:multiply; opacity:1.2i;"/>`;
                    console.log(`[HTML_CONVERT] Generated overlay using original main.js positioning for attachment with transparent white background (top:77px, left:56%, QR:${qrSize}px)`);
                  } else if (C.HIDDEN_TEXT && C.HIDDEN_TEXT.trim() !== '') {
                    hiddenOverlay = `<span style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
                    console.log(`[HTML_CONVERT] Using hidden text overlay with original main.js positioning: ${C.HIDDEN_TEXT}`);
                  }

                  const qrBorderColor = C.QR_BORDER_COLOR || C.BORDER_COLOR || '#000000';
                  const borderStyle = C.BORDER_STYLE || 'solid';

                  const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px; margin:10px auto;">
                                    <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                      <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
                                    </a>
                                    ${hiddenOverlay}
                                  </div>`;

                  processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, qrHtml);
                  console.log(`[HTML_CONVERT] QR applied to attachment`);
                } catch (qrError) {
                  console.error(`[HTML_CONVERT] QR generation failed:`, qrError);
                  processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, '<span>[QR code unavailable]</span>');
                }
              } else {
                // QR disabled - remove QR placeholder completely from attachments
                console.log('[HTML_CONVERT] QR code disabled, removing QR from attachments');
                processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, '');
              }
            }

            // Process domain logo in attachment HTML if present  
            if (processedAttHtml.includes('{domainlogo}')) {
              const domainFull = recipient.split('@')[1] || '';
              // Check for cross-domain scenario
              const fromEmail = args.smtpUser || '';
              const senderDomain = this.extractDomainFromEmail(fromEmail);
              const skipCache = senderDomain && senderDomain !== domainFull;
              const domainLogoBuffer = await this.fetchDomainLogo(domainFull, !!skipCache);
              if (domainLogoBuffer) {
                const dataLogo = domainLogoBuffer!.toString('base64');
                const domainLogoSize = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || '50%';
                processedAttHtml = processedAttHtml.replace(
                  /\{domainlogo\}/g,
                  `<img src="data:image/png;base64,${dataLogo}" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`
                );
              } else {
                processedAttHtml = processedAttHtml.replace(
                  /\{domainlogo\}/g,
                  `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`
                );
              }
            }

            for (const format of htmlConvertFormats) {
              if (!format) continue;
              try {
                console.log(`[HTML_CONVERT] Converting to ${format.toUpperCase()}...`);
                const buffer = await this.renderHtml(format, processedAttHtml, C);
                if (buffer) {
                  // Process placeholders in filename with AI generation
                  const rawFileName = C.FILE_NAME || 'attachment';
                  let processedFileName = await injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                  processedFileName = replacePlaceholders(processedFileName);
                  const filename = `${processedFileName}.${format}`;
                  convertFiles.push({ name: filename, buffer });
                  console.log(`[HTML_CONVERT] Successfully converted to ${format.toUpperCase()}: ${filename} (${buffer.length} bytes)`);
                } else {
                  console.log(`[HTML_CONVERT] ${format.toUpperCase()} conversion returned null`);
                }
              } catch (convertError) {
                console.error(`[HTML_CONVERT] ${format.toUpperCase()} conversion failed:`, convertError);
              }
            }

            // Handle ZIP compression - exact clone from main.js
            if (convertFiles.length > 0) {
              if (C.ZIP_USE) {
                try {
                  const zipBuffer = await this.createZipBuffer(convertFiles, C.ZIP_PASSWORD);
                  const rawFileName = C.FILE_NAME || 'attachments';
                  let replacedFileName = await injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                  replacedFileName = replacePlaceholders(replacedFileName);
                  emailAttachments.push({
                    filename: `${replacedFileName}.zip`,
                    content: zipBuffer,
                    contentDisposition: 'attachment'
                  });
                } catch (zipError) {
                  console.error('ZIP creation failed:', zipError);
                  // Add individual files if ZIP fails
                  convertFiles.forEach(file => {
                    emailAttachments.push({
                      filename: file.name,
                      content: file.buffer,
                      contentDisposition: 'attachment'
                    });
                  });
                }
              } else {
                // Add individual converted files
                console.log(`[HTML_CONVERT] Adding ${convertFiles.length} individual files to email attachments`);
                convertFiles.forEach(file => {
                  emailAttachments.push({
                    filename: file.name,
                    content: file.buffer,
                    contentDisposition: 'attachment'
                  });
                  console.log(`[HTML_CONVERT] Added attachment: ${file.name} (${file.buffer.length} bytes)`);
                });
              }
            }
          }



          // Send email - exact clone
          const text = htmlToText(finalHtml);

          // Calendar Mode - Generate .ics file if enabled
          if (C.CALENDAR_MODE) {
            try {
              const eventStart = new Date();
              eventStart.setHours(eventStart.getHours() + 1); // Event starts 1 hour from now
              const eventEnd = new Date();
              eventEnd.setHours(eventEnd.getHours() + 2); // Event ends 2 hours from now

              const formatDate = (date: Date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
              };

              // Use original HTML content for calendar (not HTML2IMG processed version)
              // Calendar should contain the actual HTML with placeholders replaced, not the image
              let originalHtmlForCalendar = finalAttHtml || html;

              // Convert original HTML to text for calendar description
              let calendarDescription = htmlToText(originalHtmlForCalendar);

              // If QR is enabled and we have QR content, include it in the calendar description
              if (C.QRCODE) {
                let qrContent = C.QR_LINK;
                if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                  qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), recipient); // Use recipient for link placeholder
                }
                if (C.RANDOM_METADATA) {
                  const rand = crypto.randomBytes(4).toString('hex');
                  qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
                }

                // Replace QR placeholder in calendar description with the actual QR link
                calendarDescription = calendarDescription.replace(/QR Code.*?https:\/\/[^\s]*/g, `QR Code: ${qrContent}`);
                calendarDescription = calendarDescription.replace(/\[cid:qrcode\]/g, `${qrContent}`);
              }

              const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Email Marketing//Calendar Event//EN
BEGIN:VEVENT
UID:${crypto.randomBytes(16).toString('hex')}@emailmarketing.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventStart)}
DTEND:${formatDate(eventEnd)}
SUMMARY:${dynamicSubject || 'Calendar Event'}
DESCRIPTION:${calendarDescription.replace(/\n/g, '\\n')}
ORGANIZER;CN=${emailFromName}:MAILTO:${emailFromEmail}
ATTENDEE;CN=${recipient}:MAILTO:${recipient}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

              emailAttachments.push({
                filename: 'event.ics',
                content: Buffer.from(icsContent, 'utf8'),
                contentType: 'text/calendar',
                contentDisposition: 'attachment'
              });

              console.log('[CALENDAR_MODE] Added .ics calendar invitation with processed QR content');
            } catch (calendarError) {
              console.error('[CALENDAR_MODE] Error generating calendar invitation:', calendarError);
            }
          }
          const result = await this.sendOneEmail({
            to: recipient,
            subject: dynamicSubject,
            html: finalHtml,
            text,
            attachments: emailAttachments,
            from: emailFromEmail,
            fromName: emailFromName,
            transporter: emailTransporter,
            C
          });

          console.log(`[TIMING] Email sent at ${Date.now()}, recipient: ${recipient}`);

          // Close individual transporter if we created one for rotation
          if (emailTransporter !== transporter && configService.isSmtpRotationEnabled()) {
            emailTransporter.close();
          }

            // Increment counts immediately for accurate progress tracking
            if (result.success) {
              sent++;
            } else {
              failed++;
            }
            
            console.log(`[TIMING] Progress callback invoked at ${Date.now()}, recipient: ${recipient}`);
            progressCallback?.({
              recipient: recipient || 'Unknown',
              subject: dynamicSubject || args.subject || 'No Subject',
              status: result.success ? 'success' : 'fail',
              error: result.success ? null : (result.error || 'Unknown error'),
              timestamp: new Date().toISOString(),
              smtp: smtpInfo,
              totalRecipients,
              totalSent: sent,
              totalFailed: failed
            });
            batchResults.push(result);
            emailsProcessedInCurrentBatch++;
          } catch (err: any) {
            console.error('Error sending to', recipient, err && err.stack ? err.stack : err);
            const errorMessage = err && err.message ? err.message : String(err);
            failed++; // Increment immediately for accurate progress tracking
            emailsProcessedInCurrentBatch++;
            progressCallback?.({
              recipient: recipient || 'Unknown',
              subject: dynamicSubject || args.subject || 'No Subject',
              status: 'fail',
              error: errorMessage,
              timestamp: new Date().toISOString(),
              smtp: smtpInfo,
              totalRecipients,
              totalSent: sent,
              totalFailed: failed
            });
            batchResults.push({ success: false, error: errorMessage, recipient: recipient || 'Unknown' });
          }

          // Rate limiting: wait between emails within batch (except for last email)
          if (i < batch.length - 1) {
            const delayMs = 1000 / (C.EMAIL_PER_SECOND || 5);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }

        // Log batch completion status
        console.log(`[Batch ${batchIndex + 1}/${batches.length}] Completed - processed ${emailsProcessedInCurrentBatch}/${batch.length} emails in this batch`);
        batchesProcessed++;

        // Check if cancelled mid-batch and exit outer loop
        if (this.isCancelled || campaignStoppedEarly) {
          console.log(`[sendMail] Exiting batch loop - cancelled: ${this.isCancelled}, stoppedEarly: ${campaignStoppedEarly}`);
          break;
        }

        // Track errors and failed emails (counts already incremented immediately above)
        batchResults.forEach((result: any) => {
          if (!result.success) {
            errors.push(`${result.recipient || 'unknown'}: ${result.error || 'Unknown error'}`);
            failedEmails.push(result.recipient || 'unknown');
          }
        });

        // Sleep after each batch, except the last one - exact clone
        if (batchIndex < batches.length - 1 && sleepMs > 0) {
          console.log(`[Batch ${batchIndex + 1}] Sleeping for ${sleepMs / 1000}s...`);
          await new Promise(r => setTimeout(r, sleepMs));
        }
      // Memory cleanup after each batch
        if (batchIndex % 5 === 0) {
          await this.cleanupBrowserPool();
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Close transporter
      transporter.close();

      const elapsed = Date.now() - sendMailStart;
      const totalProcessed = sent + failed;
      const allEmailsProcessed = totalProcessed === totalRecipients;
      
      // Determine if this was a partial completion (any incomplete processing)
      // - Cancelled: user explicitly stopped
      // - Stopped early: some other explicit stop condition
      // - Unexpected: loop exited without processing all emails and no explicit stop
      const wasCancelled = this.isCancelled || campaignStoppedEarly;
      const unexpectedExit = !allEmailsProcessed && !wasCancelled;
      const isPartialCompletion = !allEmailsProcessed; // Any incomplete = partial

      // Comprehensive completion logging
      console.log(`[sendMail] Batch loop finished:`);
      console.log(`  - Batches processed: ${batchesProcessed}/${batches.length}`);
      console.log(`  - Emails processed: ${totalProcessed}/${totalRecipients}`);
      console.log(`  - Sent: ${sent}, Failed: ${failed}`);
      console.log(`  - Was cancelled: ${wasCancelled}, Reason: ${earlyStopReason || 'N/A'}`);
      console.log(`  - All emails processed: ${allEmailsProcessed}`);
      console.log(`  - Is partial completion: ${isPartialCompletion}`);
      console.log(`  - Unexpected exit: ${unexpectedExit}`);
      console.log(`  - Duration: ${elapsed}ms`);

      // Detect unexpected incomplete processing (the bug we're fixing)
      if (unexpectedExit) {
        console.error(`[sendMail] WARNING: Campaign ended prematurely! Only ${totalProcessed}/${totalRecipients} emails were processed without cancellation or explicit stop.`);
        console.error(`[sendMail] This indicates a bug - the loop exited unexpectedly.`);
      }

      // Clean up campaign tracking
      this.activeCampaigns.delete(campaignId);
      console.info('Campaign completed', { 
        campaignId, 
        sent, 
        failed,
        totalRecipients,
        totalProcessed,
        allEmailsProcessed,
        batchesProcessed,
        totalBatches: batches.length,
        wasCancelled,
        earlyStopReason,
        isPartialCompletion,
        unexpectedExit,
        duration: elapsed,
        activeCampaigns: this.activeCampaigns.size 
      });

      const sentCount = sent;
      
      // Build appropriate details message
      let details: string;
      if (wasCancelled) {
        details = `Cancelled: Sent ${sent}, Failed ${failed} (${totalProcessed}/${totalRecipients} processed before cancellation)`;
      } else if (unexpectedExit) {
        details = `WARNING: Unexpected stop! Sent ${sent}, Failed ${failed} (only ${totalProcessed}/${totalRecipients} processed - possible bug)`;
      } else {
        details = `Sent: ${sent}, Failed: ${failed}`;
      }
      
      // success = false if cancelled or unexpected exit, true only if fully completed
      const success = allEmailsProcessed && !wasCancelled;
      
      return { 
        success, 
        sent: sentCount, 
        failed, 
        errors, 
        failedEmails, 
        details, 
        isPartialCompletion, 
        totalProcessed, 
        totalRecipients,
        wasCancelled,
        unexpectedExit
      };
    } catch (err: any) {
      // Enhanced error handling and logging
      const errorMessage = err?.message || err?.toString() || 'Unknown sendMail error';
      const errorDetails = {
        error: errorMessage,
        errorType: err?.constructor?.name || 'UnknownError',
        errorCode: err?.code,
        stack: err?.stack
      };

      const totalProcessed = sent + failed;
      const isPartialCompletion = totalProcessed < totalRecipients;

      console.error('Error during sendMail:', errorDetails);
      console.error('SendMail operation failed', errorDetails);
      console.error(`[sendMail] CRITICAL: Campaign crashed with error. Sent: ${sent}, Failed: ${failed}, Processed: ${totalProcessed}/${totalRecipients}`);

      // Clean up campaign tracking on error
      this.activeCampaigns.delete(campaignId);
      console.info('Campaign failed and cleaned up', { 
        campaignId, 
        error: errorMessage,
        sent,
        failed,
        totalRecipients,
        totalProcessed,
        isPartialCompletion,
        duration: Date.now() - sendMailStart,
        activeCampaigns: this.activeCampaigns.size 
      });

      return { 
        success: false, 
        error: errorMessage, 
        details: `Error: ${errorMessage}. Sent: ${sent}, Failed: ${failed} (${totalProcessed}/${totalRecipients} processed before crash)`,
        sent,
        failed,
        totalRecipients,
        totalProcessed,
        isPartialCompletion,
        wasCancelled: false,
        unexpectedExit: true,
        errors: [],
        failedEmails: []
      };
    }
  }

  // Control methods - exact clone
  private isCancelled = false;

  pauseSend() {
    this.isPaused = true;
  }

  resumeSend() {
    this.isPaused = false;
  }

  cancelSend() {
    this.isCancelled = true;
    this.isPaused = false; // Unpause so it can exit the pause loop
    console.log('[cancelSend] Campaign cancelled by user');
  }

  resetCancelFlag() {
    this.isCancelled = false;
  }

  // File system methods - exact clone
  async listFiles(folder = 'files') {
    try {
      const files = readdirSync(folder).filter(f => /\.html$|\.htm$/i.test(f));
      return { files };
    } catch (err: any) {
      return { error: err.message, files: [] };
    }
  }

  async listLogoFiles() {
    try {
      const logoDir = join('files', 'logo');
      if (!existsSync(logoDir)) return { files: [] };
      const files = readdirSync(logoDir).filter(f => {
        const full = join(logoDir, f);
        return statSync(full).isFile();
      });
      return { files };
    } catch (err: any) {
      return { files: [], error: err.message };
    }
  }

  async readFile(filepath: string) {
    try {
      const content = readFileSync(filepath, 'utf-8');
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Enhanced sendOneEmail method with retry logic and advanced features
  private async sendOneEmail(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments: any[];
    from: string;
    fromName: string;
    transporter: any;
    C: any;
  }): Promise<{ success: boolean; error?: string; recipient?: string }> {
    const startTime = Date.now();

    // Improvement 3: Track response time for rate limiting
    const trackResponse = (success: boolean) => {
      const responseTime = Date.now() - startTime;
      this.updateRateLimit(responseTime, success);
    };

    try {
      // Improvement 6: Use retry mechanism with exponential backoff
      const result = await this.retryWithBackoff(async () => {
        return await this.sendEmailCore(emailData);
      }, emailData.C.RETRY || 0);

      trackResponse(true);
      this.progressMetrics.emailsSent++;

      console.info('Email sent successfully', { 
        to: emailData.to, 
        responseTime: Date.now() - startTime 
      });

      return { success: true, recipient: emailData.to };
    } catch (error: any) {
      trackResponse(false);
      this.progressMetrics.emailsFailed++;

      // Enhanced error logging with more details
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      const errorDetails = {
        to: emailData.to, 
        error: errorMessage,
        errorType: error?.constructor?.name || 'UnknownError',
        errorCode: error?.code,
        responseTime: Date.now() - startTime
      };

      console.error('Email failed to send', errorDetails);
      console.error('Email sending error:', errorDetails);

      return { success: false, error: errorMessage, recipient: emailData.to };
    }
  }

  private async sendEmailCore(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments: any[];
    from: string;
    fromName: string;
    transporter: any;
    C: any;
  }): Promise<any> {
    const mailOptions: any = {
      from: `${emailData.fromName} <${emailData.from}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      attachments: emailData.attachments
    };

    // Add Reply-To header if configured in setup.ini
    if (emailData.C.REPLY_TO && emailData.C.REPLY_TO.trim()) {
      mailOptions.replyTo = emailData.C.REPLY_TO.trim();
      console.log('[REPLY_TO] Set reply-to address:', mailOptions.replyTo);
    }

    // Set priority based on configuration
    if (emailData.C.PRIORITY) {
      const priority = typeof emailData.C.PRIORITY === 'string' ? emailData.C.PRIORITY.toLowerCase() : String(emailData.C.PRIORITY);
      switch (priority) {
        case 'high':
        case '3':
          mailOptions.priority = 'high';
          mailOptions.headers = { 'X-Priority': '1', 'X-MSMail-Priority': 'High' };
          break;
        case 'low':
        case '1':
          mailOptions.priority = 'low';
          mailOptions.headers = { 'X-Priority': '5', 'X-MSMail-Priority': 'Low' };
          break;
        default:
          mailOptions.priority = 'normal';
          mailOptions.headers = { 'X-Priority': '3', 'X-MSMail-Priority': 'Normal' };
          break;
      }
    }

    // Add calendar-specific headers if calendar mode is enabled
    if (emailData.C.CALENDAR_MODE) {
      if (!mailOptions.headers) mailOptions.headers = {};
      mailOptions.headers['Content-Class'] = 'urn:content-classes:calendarmessage';
      mailOptions.headers['X-MS-OLK-FORCEINSPECTOROPEN'] = 'TRUE';
      mailOptions.headers['Method'] = 'REQUEST';
      console.log('[CALENDAR_MODE] Added calendar-specific headers for better client recognition');
    }

    // Add consistent headers for better deliverability (removed randomization)
    if (!mailOptions.headers) mailOptions.headers = {};
    // Use consistent, legitimate mailer identification
    mailOptions.headers['X-Mailer'] = 'Email Marketing System v1.0';

    return await emailData.transporter.sendMail(mailOptions);
  }

  // Enhanced progress method using improvement 4
  getProgress() {
    return this.calculateProgress();
  }

  // Improvement 5: Template Management
  async getTemplate(templateName: string): Promise<string> {
    const templatePath = join('files', templateName);

    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const stat = statSync(templatePath);
    const lastModified = stat.mtime.getTime();

    // Check cache
    const cached = this.templateCache.get(templateName);
    if (cached && cached.lastModified === lastModified) {
      console.debug('Template served from cache', { templateName });
      return cached.content;
    }

    // Load from disk and cache
    const content = readFileSync(templatePath, 'utf-8');
    this.templateCache.set(templateName, { content, lastModified });
    console.debug('Template loaded and cached', { templateName, sizeKB: Math.round(content.length / 1024) });

    return content;
  }

  // Centralized browser resource cleanup helper
  private async cleanupBrowserResources(page: any, browser: any, browserInfo: any, usingPool: boolean, operation: string): Promise<void> {
    try {
      // Close page first
      if (page) {
        try { 
          await page.close(); 
        } catch (closeError) {
          console.error(`Failed to close page during ${operation} cleanup:`, closeError);
        }
      }

      // Always release from pool if browserInfo contains operation tracking
      if (browserInfo && typeof browserInfo === 'object' && browserInfo.operationId) {
        // This handles operation ID cleanup and browser pool management
        this.releaseBrowserFromPool(browserInfo);

        // For non-pooled browsers, we still need to close the browser
        if (!usingPool && browser) {
          try { 
            await browser.close(); 
          } catch (closeError) {
            console.error(`Failed to close temporary browser during ${operation} cleanup:`, closeError);
          }
        }
      } else if (usingPool && browserInfo) {
        // Legacy format - just release from pool
        this.releaseBrowserFromPool(browserInfo);
      } else if (browser) {
        // Direct browser without tracking - just close it
        try { 
          await browser.close(); 
        } catch (closeError) {
          console.error(`Failed to close browser during ${operation} cleanup:`, closeError);
        }
      }
    } catch (error) {
      console.error(`Unexpected error during ${operation} resource cleanup:`, error);
    }
  }

  // Enhanced cleanup method with better resource management
  async cleanup() {
    console.info('Starting comprehensive cleanup');

    // Wait for any active operations to complete (with timeout)
    let waitTime = 0;
    const maxWaitTime = 10000; // 10 seconds
    while (this.activeOperations.size > 0 && waitTime < maxWaitTime) {
      console.log(`Waiting for ${this.activeOperations.size} active operations to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitTime += 1000;
    }

    if (this.activeOperations.size > 0) {
      console.warn(`Forcefully proceeding with cleanup despite ${this.activeOperations.size} active operations`);
    }

    // Stop rate limiting queue processing
    this.rateLimitProcessing = false;
    this.rateLimitQueue = [];

    // Clear QR generation promises and caches
    this.qrGenerationPromises.clear();
    this.qrCacheLocks.clear();
    this.qrCache.clear();

    // Close all browser instances with enhanced error handling
    const browserCleanupPromises = this.browserPool.map(async (pool, index) => {
      try {
        if (pool.instance && typeof pool.instance.close === 'function') {
          // Try to get all pages first to close them individually
          try {
            const pages = await pool.instance.pages();
            for (const page of pages) {
              try {
                await page.close();
              } catch (pageError) {
                console.warn(`Error closing page in browser ${index}:`, pageError);
              }
            }
          } catch (pagesError) {
            console.warn(`Error getting pages for browser ${index}:`, pagesError);
          }

          // Now close the browser
          await Promise.race([
            pool.instance.close(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
          ]);
          console.debug(`Successfully closed browser ${index}`);
        }
      } catch (error) {
        console.warn(`Error closing browser ${index} during cleanup:`, { 
          error: error instanceof Error ? error.message : String(error),
          lastUsed: new Date(pool.lastUsed).toISOString(),
          activePages: pool.activePages
        });
      }
    });

    // Wait for all browser cleanup operations to complete
    try {
      await Promise.allSettled(browserCleanupPromises);
    } catch (error) {
      console.error('Error during browser cleanup operations:', error);
    }

    this.browserPool = [];

    // Clear all caches and tracking data
    this.templateCache.clear();
    this.activeOperations.clear();
    this.smtpResponseTimes = [];

    console.info('Comprehensive cleanup completed');
  }
  async writeFile(filepath: string, content: string) {
    try {
      writeFileSync(filepath, content, 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// Export singleton instance with all improvements 1-9 implemented
export const advancedEmailService = new AdvancedEmailService();