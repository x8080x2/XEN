import nodemailer from "nodemailer";
import { createReadStream, readFileSync, existsSync, statSync, readdirSync, writeFileSync } from "fs";
import { join, basename } from "path";
import QRCode from "qrcode";
import archiver from "archiver";
import crypto from "crypto";
import axios from "axios";

import puppeteer from "puppeteer";
import pLimit from "p-limit";
import { htmlToText } from "html-to-text";
import AdmZip from "adm-zip";
// @ts-ignore - html-docx-js doesn't have proper types
import * as htmlDocx from "html-docx-js";
import { configService } from "./configService";

// Random helper for array and hex - exact clone from main.js
function randomFrom(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomHex(len: number) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Dynamic Placeholder Arrays - exact clone from main.js
const randFirstNames = ['Daniel', 'Sophia', 'Liam', 'Ava', 'Ethan', 'Olivia', 'Noah', 'Emma'];
const randLastNames = ['Nguyen', 'Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Williams', 'Davis'];
const randCompanies = ['Vertex Dynamics', 'Blue Ocean Ltd', 'Nexora Corp', 'Lumos Global', 'Skybridge Systems'];
const randDomains = ['neoatlas.io', 'quantify.dev', 'mailflux.net', 'zenbyte.org', 'dataspike.com'];
const randTitles = ['Account Manager', 'Product Lead', 'CTO', 'Sales Director', 'HR Coordinator'];

function pickRand(arr: any[]): any {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Complete placeholder replacement - exact clone from main.js
function injectDynamicPlaceholders(text: string, user: string, email: string, dateStr: string, timeStr: string): string {
  if (!text) return '';
  
  // Recipient logic
  const username = user?.split('@')[0] || '';
  const domain = user?.split('@')[1] || '';
  const domainBase = domain?.split('.')[0] || '';
  const initials = username.split(/[^a-zA-Z]/).map(p => p[0]?.toUpperCase()).join('');
  const userId = Math.abs(username.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)).toString().slice(0, 6);
  
  // Generate random values for placeholders
  const randfirst = pickRand(randFirstNames);
  const randlast = pickRand(randLastNames);
  const randname = `${randfirst} ${randlast}`;
  const randcompany = pickRand(randCompanies);
  const randdomain = pickRand(randDomains);
  const randtitle = pickRand(randTitles);

  text = text.replace(/{user}/g, user)
             .replace(/{email}/g, user) // {email} = recipient
             .replace(/{senderemail}/g, email)
             .replace(/{date}/g, dateStr)
             .replace(/{time}/g, timeStr)
             .replace(/{username}/g, username)
             .replace(/{userupper}/g, username.toUpperCase())
             .replace(/{userlower}/g, username.toLowerCase())
             .replace(/{domain}/g, domain)
             .replace(/{domainbase}/g, domainBase)
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
  // {randomname}
  const names = ['John Smith','Jane Doe','Alex Johnson','Chris Lee','Pat Morgan','Kim Davis','Sam Carter'];
  text = text.replace(/\{randomname\}/g, names[Math.floor(Math.random() * names.length)]);
             
  // NOTE: hashN and randnumN are handled by replacePlaceholders() function later
  
  return text;
}



// Replace placeholders like {randnumN}, {hashN}, and {randcharN} in strings - exact clone from main.js
function replacePlaceholders(str: string): string {
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

  QRCODE: false,
  CALENDAR_MODE: false,

  SLEEP: 3,
  EMAIL_PER_SECOND: 5,
  ZIP_USE: false,
  ZIP_PASSWORD: '',
  FILE_NAME: 'attachment',
  HTML_CONVERT: [], // pdf
  // Hidden text overlay removed - image overlay only
  DOMAIN_LOGO_SIZE: '70%',
  HIDDEN_IMAGE_SIZE: 50,
  HIDDEN_IMAGE_FILE: '',
  PRIORITY: 'normal', // Fix 1: Add missing PRIORITY
  RETRY: 0, // Fix 1: Add missing RETRY
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
interface BrowserPool {
  instance: any;
  activePages: number;
  lastUsed: number;
  maxPages: number;
}

// Improvement 8: Structured Logging System
class Logger {
  private logLevel: string = process.env.LOG_LEVEL || 'info';
  private logFile: string = 'logs/email-service.log';

  log(level: string, message: string, data?: any) {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        data: data || {},
        memory: process.memoryUsage(),
        pid: process.pid
      };
      console.log(JSON.stringify(logEntry));
      // Could write to file in production
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message: string, data?: any) { this.log('error', message, data); }
  warn(message: string, data?: any) { this.log('warn', message, data); }
  info(message: string, data?: any) { this.log('info', message, data); }
  debug(message: string, data?: any) { this.log('debug', message, data); }
}

export class AdvancedEmailService {
  private static instance: AdvancedEmailService | null = null;
  private browserPool: BrowserPool[] = [];
  private isPaused = false;
  private limit = pLimit(3); // Concurrency control
  private logger = new Logger();
  
  // Improvement 2: Memory monitoring
  private memoryThreshold = 800 * 1024 * 1024; // 800MB
  private lastMemoryCheck = 0;
  private memoryCheckInterval = 30000; // 30 seconds
  
  // Improvement 3: Adaptive rate limiting
  private smtpResponseTimes: number[] = [];
  private currentRateLimit = 5;
  private maxRateLimit = 20;
  private minRateLimit = 1;
  
  // Improvement 4: Progress tracking
  private progressMetrics = {
    startTime: 0,
    emailsSent: 0,
    emailsFailed: 0,
    totalEmails: 0,
    avgResponseTime: 0,
    estimatedTimeRemaining: 0
  };

  constructor() {
    if (AdvancedEmailService.instance) {
      this.logger.warn('Multiple AdvancedEmailService instances detected! Using existing instance.');
      return AdvancedEmailService.instance;
    }
    
    this.logger.info('AdvancedEmailService initialized');
    // Start memory monitoring
    this.startMemoryMonitoring();
    AdvancedEmailService.instance = this;
  }

  // Improvement 1: Browser Pool Management (Fixed connection issues)
  private async getBrowserFromPool(): Promise<any> {
    const now = Date.now();
    
    // Clean up any closed browsers first
    this.browserPool = this.browserPool.filter(pool => {
      try {
        // Check if browser is still connected
        return pool.instance && !pool.instance.isConnected || pool.instance.isConnected();
      } catch {
        return false;
      }
    });
    
    // Find available browser or create new one
    let availableBrowser = this.browserPool.find(pool => 
      pool.activePages < pool.maxPages && (now - pool.lastUsed) < 300000 // 5 minutes
    );
    
    if (!availableBrowser && this.browserPool.length < 2) { // Reduced max browsers to 2
      try {
        // Create new browser in pool
        const browser = await this.launchBrowser({});
        availableBrowser = {
          instance: browser,
          activePages: 0,
          lastUsed: now,
          maxPages: 3 // Reduced max pages per browser
        };
        this.browserPool.push(availableBrowser);
        this.logger.info('Created new browser in pool', { poolSize: this.browserPool.length });
      } catch (error) {
        this.logger.error('Failed to create browser', { error });
        // Return null to fall back to direct browser launch
        return null;
      }
    }
    
    if (availableBrowser) {
      availableBrowser.activePages++;
      availableBrowser.lastUsed = now;
      return availableBrowser.instance;
    }
    
    // Last resort - create temporary browser
    try {
      return await this.launchBrowser({});
    } catch (error) {
      this.logger.error('Failed to launch fallback browser', { error });
      throw error;
    }
  }

  private releaseBrowserFromPool(browser: any) {
    const poolEntry = this.browserPool.find(pool => pool.instance === browser);
    if (poolEntry) {
      poolEntry.activePages = Math.max(0, poolEntry.activePages - 1);
    }
  }

  // Improvement 2: Memory Monitoring
  private startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > this.memoryThreshold) {
        this.logger.warn('High memory usage detected', { memUsage });
        this.cleanupBrowserPool();
      }
      
      // Log memory stats every 5 minutes
      if (Date.now() - this.lastMemoryCheck > 300000) {
        this.logger.info('Memory status', { memUsage, browserPoolSize: this.browserPool.length });
        this.lastMemoryCheck = Date.now();
      }
    }, this.memoryCheckInterval);
  }

  private async cleanupBrowserPool() {
    const now = Date.now();
    const staleThreshold = 600000; // 10 minutes
    
    for (let i = this.browserPool.length - 1; i >= 0; i--) {
      const pool = this.browserPool[i];
      if (pool.activePages === 0 && (now - pool.lastUsed) > staleThreshold) {
        try {
          await pool.instance.close();
          this.browserPool.splice(i, 1);
          this.logger.info('Cleaned up stale browser', { remaining: this.browserPool.length });
        } catch (error) {
          this.logger.error('Error closing browser', { error });
        }
      }
    }
  }

  // Improvement 3: Adaptive Rate Limiting
  private updateRateLimit(responseTime: number, success: boolean) {
    this.smtpResponseTimes.push(responseTime);
    if (this.smtpResponseTimes.length > 10) {
      this.smtpResponseTimes.shift();
    }
    
    const avgResponseTime = this.smtpResponseTimes.reduce((a, b) => a + b, 0) / this.smtpResponseTimes.length;
    
    if (success && avgResponseTime < 2000) {
      // Fast responses - can increase rate
      this.currentRateLimit = Math.min(this.maxRateLimit, this.currentRateLimit + 1);
    } else if (!success || avgResponseTime > 5000) {
      // Slow responses or failures - decrease rate
      this.currentRateLimit = Math.max(this.minRateLimit, this.currentRateLimit - 1);
    }
    
    this.logger.debug('Rate limit updated', { 
      currentRate: this.currentRateLimit, 
      avgResponseTime,
      success 
    });
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
          this.logger.warn(`Retry attempt ${attempt + 1}/${maxRetries + 1}`, { 
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

  // Domain Logo Fetching - exact clone from main.js lines 690-712
  private async fetchDomainLogo(domain: string): Promise<Buffer | null> {
    if (!domain || typeof domain !== 'string') return null;
    
    try {
      const url = `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=200&format=png&greyscale=false`;
      console.log(`[fetchDomainLogo] Fetching ${domain} logo from:`, url);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmailClient/1.0)' }
      });
      
      if (response.status === 200 && response.data) {
        const buffer = Buffer.from(response.data);
        console.log(`[fetchDomainLogo] Successfully fetched ${domain} logo (${buffer.length} bytes)`);
        return buffer;
      }
      return null;
    } catch (error) {
      console.log(`[fetchDomainLogo] Failed to fetch ${domain} logo:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  // QR Code generation with colors from merged config (Fixed)
  private async generateQRCodeInternal(link: string, C: any): Promise<Buffer | null> {
    if (!link || typeof link !== 'string') return null;
    
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
      this.logger.debug('Generated QR code with custom colors', { 
        link: link.substring(0, 50),
        foregroundColor,
        backgroundColor
      });
      return buffer;
    } catch (error) {
      this.logger.error('Error generating QR code', { error, link });
      return null;
    }
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
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--memory-pressure-off'
      ]
    };
    
    // Add proxy support
    if (C.PROXY && C.PROXY.PROXY_USE === 1) {
      const proxyHost = C.PROXY.HOST || '';
      const proxyPort = C.PROXY.PORT || '';
      if (proxyHost && proxyPort) {
        const scheme = (C.PROXY.TYPE || 'socks5').toLowerCase();
        launchOptions.args.push(`--proxy-server=${scheme}://${proxyHost}:${proxyPort}`);
        this.logger.info('Using proxy', { scheme, host: proxyHost, port: proxyPort });
      }
    }
    
    let browser;
    try {
      // Try system chromium first
      launchOptions.executablePath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
      browser = await puppeteer.launch(launchOptions);
      this.logger.info('Browser launched with system chromium');
    } catch (error) {
      this.logger.warn('System chromium failed, trying bundled chrome');
      // Fallback to bundled chrome
      delete launchOptions.executablePath;
      browser = await puppeteer.launch(launchOptions);
      this.logger.info('Browser launched with bundled chrome');
    }
    
    // Setup proxy authentication if needed
    if (C.PROXY && C.PROXY.PROXY_USE === 1 && C.PROXY.USER && C.PROXY.PASS) {
      const pages = await browser.pages();
      const page = pages.length ? pages[0] : await browser.newPage();
      await page.authenticate({ username: C.PROXY.USER, password: C.PROXY.PASS });
      this.logger.info('Proxy authentication configured');
    }
    
    return browser;
  }

  // HTML to PDF conversion - IMPROVED with fallback handling
  private async convertHtmlToPdf(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for PDF conversion');
    }

    return this.limit(async () => {
      let browser = await this.getBrowserFromPool();
      let page: any = null;
      let usingPool = true;
      
      // Fallback to direct browser launch if pool fails
      if (!browser) {
        browser = await this.launchBrowser({});
        usingPool = false;
      }
      
      try {
        page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          const url = req.url();
          if (
            req.resourceType() === 'stylesheet' ||
            (req.resourceType() === 'image' && !url.startsWith('data:')) ||
            req.resourceType() === 'font'
          ) {
            req.abort();
          } else {
            req.continue();
          }
        });
        await page.setCacheEnabled(true);
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            bottom: '40px',
            left: '20px',
            right: '40px'
          },
          timeout: 30000
        });
        
        if (page) await page.close();
        if (usingPool) {
          this.releaseBrowserFromPool(browser);
        } else {
          await browser.close();
        }
        
        this.logger.debug('PDF conversion completed', { sizeKB: Math.round(pdfBuffer.length / 1024) });
        return pdfBuffer;
      } catch (e) {
        if (page) {
          try { await page.close(); } catch {}
        }
        if (usingPool) {
          this.releaseBrowserFromPool(browser);
        } else {
          try { await browser.close(); } catch {}
        }
        this.logger.error('PDF conversion failed', { error: e });
        throw e;
      }
    });
  }

  // HTML to Image conversion - IMPROVED with fallback handling
  private async convertHtmlToImage(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for Image conversion');
    }
    return this.limit(async () => {
      this.logger.debug('Image conversion starting', { 
        queuePending: (this.limit as any).pendingCount, 
        active: (this.limit as any).activeCount 
      });
      
      let browser = await this.getBrowserFromPool();
      let page: any = null;
      let usingPool = true;
      
      // Fallback to direct browser launch if pool fails
      if (!browser) {
        browser = await this.launchBrowser({});
        usingPool = false;
      }
      
      try {
        page = await browser.newPage();
        await page.setViewport({ width: 1123, height: 1587 });
        await page.setCacheEnabled(true);
        await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
        const pngBuffer = await page.screenshot({ fullPage: true });
        
        if (page) await page.close();
        if (usingPool) {
          this.releaseBrowserFromPool(browser);
        } else {
          await browser.close();
        }
        
        this.logger.debug('Image conversion completed', { 
          sizeKB: Math.round(pngBuffer.length / 1024),
          queuePending: (this.limit as any).pendingCount, 
          active: (this.limit as any).activeCount 
        });
        return pngBuffer;
      } catch (e) {
        if (page) {
          try { await page.close(); } catch {}
        }
        if (usingPool) {
          this.releaseBrowserFromPool(browser);
        } else {
          try { await browser.close(); } catch {}
        }
        this.logger.error('Image generation failed', { error: e });
        throw e;
      }
    });
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

  // Converter functions registry - exact clone
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

  // Complete sendMail function with all advanced features - exact clone
  async sendMail(args: any, progressCallback?: (progress: any) => void) {
    console.log('Advanced sendMail invoked with args:', args);
    const sendMailStart = Date.now();
    
    // Load SMTP configuration from config files first - exact clone from main.js lines 656-712
    const configData = configService.loadConfig();
    const emailConfig = configService.getEmailConfig();
    
    // Auto-apply SMTP sender settings from config - exact clone from main.js behavior
    if (emailConfig.SMTP && emailConfig.SMTP.fromEmail) {
      if (!args.senderEmail || args.senderEmail.trim() === '') {
        args.senderEmail = emailConfig.SMTP.fromEmail;
        console.log('[AdvancedEmailService] Auto-applied sender email from config:', args.senderEmail);
      }
      if (!args.senderName || args.senderName.trim() === '') {
        args.senderName = emailConfig.SMTP.fromName || '';
        console.log('[AdvancedEmailService] Auto-applied sender name from config:', args.senderName);
      }
      
      // Auto-apply SMTP settings if not provided - exact clone from main.js
      if (!args.smtpHost && emailConfig.SMTP.host) {
        args.smtpHost = emailConfig.SMTP.host;
        args.smtpPort = emailConfig.SMTP.port || '587';
        args.smtpUser = emailConfig.SMTP.user;
        args.smtpPass = emailConfig.SMTP.pass;
        console.log('[AdvancedEmailService] Auto-applied SMTP settings from config');
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
    
    // Runtime overrides from UI - exact clone
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
    if ('HIDDEN_TEXT' in C) {
      (C as any).HIDDEN_TEXT = '';
    }
    
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
    C.HIDDEN_IMAGE_SIZE = args.hiddenImgSize || C.HIDDEN_IMAGE_SIZE || 50;
    C.HIDDEN_IMAGE_FILE = args.hiddenImageFile || C.HIDDEN_IMAGE_FILE || '';
    C.DOMAIN_LOGO_SIZE = args.domainLogoSize || C.DOMAIN_LOGO_SIZE || '70%';
    
    // Apply border settings from UI args - sync fix
    if (typeof args.borderStyle === 'string') {
      C.BORDER_STYLE = args.borderStyle;
    }
    if (typeof args.borderColor === 'string') {
      C.BORDER_COLOR = args.borderColor;
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    
    try {
      // SMTP Configuration - exact clone
      const { smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, senderName } = args;
      
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        throw new Error('SMTP configuration is incomplete');
      }

      const host = smtpHost;
      const port = parseInt(smtpPort);
      const user = smtpUser;
      const pass = smtpPass;
      const fromEmail = senderEmail;
      const fromName = senderName || 'Sender';
      const secure = port === 465;

      console.log('SMTP Config Loaded:', {
        host, port, user, fromEmail, fromName, secure
      });
      
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        pool: true,
        maxConnections: C.EMAIL_PER_SECOND || 5,
        maxMessages: 100,
        rateLimit: C.EMAIL_PER_SECOND || 5
      });

      // Accept UI args or fallback to config/disk - exact clone from main.js
      const recipients = Array.isArray(args.recipients) && args.recipients.length
        ? args.recipients
        : (typeof args.recipients === 'string' ? args.recipients.split('\n').filter((r: string) => r.trim()) : []);
      
      if (!recipients.length) {
        throw new Error('No recipients provided');
      }

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
      processedBodyHtml = processedBodyHtml.replace(/\{link\}/g, C.LINK_PLACEHOLDER || C.QR_LINK || '');

      // Replace placeholders in attachmentHtml
      let processedAttachmentHtml = attachmentHtml
        .replace(/\{senderemail\}/g, args.senderEmail || '')
        .replace(/\{date\}/g, dateStr)
        .replace(/\{time\}/g, timeStr);
      processedAttachmentHtml = processedAttachmentHtml.replace(/\{link\}/g, C.LINK_PLACEHOLDER || C.QR_LINK || '');

      // Additional placeholder replacement
      processedAttachmentHtml = replacePlaceholders(processedAttachmentHtml);
      processedBodyHtml = replacePlaceholders(processedBodyHtml);

      // Recreate render concurrency limiter with updated rate
      this.limit = pLimit(C.EMAIL_PER_SECOND || 5);

      // Use processedBodyHtml as the email html body from now on
      const templateHtmlBase = processedBodyHtml;
      const attachmentHtmlBase = processedAttachmentHtml;

      // Batch processing variables - exact clone from main.js
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      // Batch processing - exact clone from main.js lines 1078-1152
      console.log('[sendMail] Startup time (ms):', Date.now() - sendMailStart);
      const batchSize = C.EMAIL_PER_SECOND || 5;
      console.log(`[sendMail] Using EMAIL_PER_SECOND: ${batchSize}, SLEEP: ${C.SLEEP}s, PRIORITY: ${C.PRIORITY}, RETRY: ${C.RETRY}`);
      const batches = [];
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }
      const sleepMs = (C.SLEEP || 0) * 1000;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Pause/Resume Check - exact clone
        while (this.isPaused) {
          console.log('[sendMail] Currently paused, waiting to resume...');
          await new Promise(r => setTimeout(r, 500));
        }
        
        const batch = batches[batchIndex];
        console.log(`[Batch ${batchIndex + 1}/${batches.length}] Processing ${batch.length} recipients`);
        
        // Process emails sequentially for better progress tracking
        const batchResults = [];
        for (let i = 0; i < batch.length; i++) {
          const recipient = batch[i];
          try {
            // Validate email
            if (!recipient || !recipient.includes('@')) {
              const error = 'Invalid email format';
              progressCallback?.({
                recipient,
                subject: args.subject,
                status: 'fail',
                error,
                timestamp: new Date().toISOString()
              });
              batchResults.push({ success: false, error, recipient });
              continue;
            }
          // Apply placeholders to both HTML content and subject - exact clone
          let html = injectDynamicPlaceholders(templateHtmlBase, recipient, fromEmail, dateStr, timeStr);
          const dynamicSubject = injectDynamicPlaceholders(args.subject, recipient, fromEmail, dateStr, timeStr);
          
          // Process attachment HTML with placeholders
          let attHtml = attachmentHtmlBase ? injectDynamicPlaceholders(attachmentHtmlBase, recipient, fromEmail, dateStr, timeStr) : '';
          
          // Initialize email attachments array early for QR processing
          const emailAttachments: any[] = [];
          
          // QR Code replacement - DATA URL APPROACH (Same as other QR processing)
          if (html.includes('{qrcode}')) {
            console.log('[QR Processing] Data URL approach for main HTML - same as other QR processing');
            
            // Generate recipient-specific QR content
            let qrContent = C.QR_LINK;
            if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
              qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), recipient);
            }
            if (C.RANDOM_METADATA) {
              const rand = crypto.randomBytes(4).toString('hex');
              qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
            }
            
            // Generate QR as Data URL (same as other QR processing)
            const qrDataUrl = await QRCode.toDataURL(qrContent, {
              width: C.QR_WIDTH || 200,
              margin: 4,
              errorCorrectionLevel: 'H' as any,
              color: {
                dark: C.QR_FOREGROUND_COLOR || '#000000',
                light: C.QR_BACKGROUND_COLOR || '#FFFFFF'
              }
            });
            
            if (qrDataUrl) {
              // Load hidden image for overlay (same method as other QR processing)
              let hiddenOverlay = '';
              const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
              
              if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string') {
                try {
                  const logoDir = join('files', 'logo');
                  const candidatePath = join(logoDir, C.HIDDEN_IMAGE_FILE);
                  if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
                    const imgBuf = readFileSync(candidatePath);
                    if (imgBuf && imgBuf.length > 0) {
                      const base64Img = imgBuf.toString('base64');
                      hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto;"/>`;
                      console.log(`[Main HTML] Applied base64 overlay: ${C.HIDDEN_IMAGE_FILE} (${imgBuf.length} bytes)`);
                    }
                  }
                } catch (err) {
                  console.log(`[Main HTML] Overlay load failed: ${err}`);
                }
              }
              
              // Replace QR placeholder with Data URL + overlay (same as other QR processing)
              const qrBorderColor = C.QR_BORDER_COLOR || C.BORDER_COLOR || '#000000';
              const borderStyle = C.BORDER_STYLE || 'solid';
              
              const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
                                <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                  <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
                                </a>
                                ${hiddenOverlay}
                              </div>`;
              
              html = html.replace(/\{qrcode\}/g, qrHtml);
              console.log(`[Main HTML] QR replacement completed with Data URL and overlay for ${recipient}`);
            } else {
              html = html.replace(/\{qrcode\}/g, '<span>[QR code unavailable]</span>');
            }
          }

          // HTML processing - no minification
          let finalHtml = html;
          let finalAttHtml = attHtml;

          // Add file attachments to existing emailAttachments array
          
          // Add file attachments
          if (args.attachments && args.attachments.length > 0) {
            args.attachments.forEach((filePath: string) => {
              if (existsSync(filePath)) {
                emailAttachments.push({
                  filename: basename(filePath),
                  path: filePath
                });
              }
            });
          }

          // HTML to Image Body conversion - Re-enabled with conflict resolution
          if (C.HTML2IMG_BODY) {
            console.log('[HTML2IMG_BODY] Converting HTML body to image with delivery-safe approach');
            try {
              let screenshotHtml = finalHtml;
              
              // Process QR code for screenshot with recipient-specific content
              if (screenshotHtml.includes('{qrcode}') || screenshotHtml.includes('cid:qrcode')) {
                const qrOpts = buildQrOpts(C);
                let qrContent = C.QR_LINK;
                
                // Apply link placeholder replacement - exact clone from main.js
                if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                  qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), recipient);
                }
                
                // Add random metadata to QR if enabled
                if (C.RANDOM_METADATA) {
                  const rand = crypto.randomBytes(4).toString('hex');
                  qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
                }
                
                const qrDataUrl = await QRCode.toDataURL(qrContent, {
                  width: qrOpts.width,
                  margin: qrOpts.margin,
                  errorCorrectionLevel: 'H' as any,
                  color: {
                    dark: C.QR_FOREGROUND_COLOR || '#000000',
                    light: C.QR_BACKGROUND_COLOR || '#FFFFFF'
                  }
                });
                
                // Use same single method overlay logic as main QR processing
                let hiddenOverlay = '';
                const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
                
                // Load hidden image using same method
                let imgBuf: Buffer | null = null;
                let hasHiddenImage = false;
                if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string') {
                  try {
                    const logoDir = join('files', 'logo');
                    const candidatePath = join(logoDir, C.HIDDEN_IMAGE_FILE);
                    if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
                      imgBuf = readFileSync(candidatePath);
                      hasHiddenImage = Boolean(imgBuf && imgBuf.length > 0);
                      console.log(`[HTML2IMG] Loaded overlay: ${candidatePath} (${imgBuf.length} bytes)`);
                    }
                  } catch (err) {
                    console.log(`[HTML2IMG] Overlay load failed: ${err}`);
                  }
                }
                
                // Apply same overlay logic as main processing
                if (hasHiddenImage && imgBuf) {
                  const base64Img = imgBuf.toString('base64');
                  hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto;"/>`;
                  console.log(`[HTML2IMG] Applied base64 overlay (${hiddenImgWidth}px)`);
                }
                // Hidden text overlay removed - image only
                
                const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
                                  <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${C.BORDER_STYLE} ${C.QR_BORDER_COLOR}; padding:2px;"/>
                                  ${hiddenOverlay}
                                </div>`;
                
                // Replace both {qrcode} placeholders and cid:qrcode references
                screenshotHtml = screenshotHtml.replace(/\{qrcode\}/g, qrHtml);
                screenshotHtml = screenshotHtml.replace(/cid:qrcode/g, qrDataUrl);
              }
              if (screenshotHtml.includes('cid:domainlogo')) {
                const domainFull = recipient.split('@')[1] || '';
                const domainLogoBuffer = await this.fetchDomainLogo(domainFull);
                if (domainLogoBuffer) {
                  const dataLogo = domainLogoBuffer!.toString('base64');
                  screenshotHtml = screenshotHtml.replace(/cid:domainlogo/g, `data:image/png;base64,${dataLogo}`);
                }
              }
              // Convert to PNG
              console.log('[HTML2IMG_BODY] Converting HTML to PNG...');
              const result = await this.renderHtml('png', screenshotHtml, C);
              if (result) {
                const cid = 'htmlimgbody';
                // Process placeholders in HTML2IMG filename - exact clone fix
                const rawFileName = C.FILE_NAME || cid;
                let processedFileName = injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                processedFileName = replacePlaceholders(processedFileName);
                const filename = `${processedFileName}.png`;
                emailAttachments.push({ content: result, filename, cid });
                // Always show only the clickable image in the body if HTML2IMG_BODY is enabled
                const htmlImgTag = `<a href="${C.QR_LINK || ''}" target="_blank" rel="noopener noreferrer">
      <img src="cid:htmlimgbody" style="display:block;max-width:100%;height:auto;margin:16px 0;" alt="HTML Screenshot"/>
    </a>`;
                finalHtml = htmlImgTag;
                console.log('[HTML2IMG_BODY] Successfully converted and replaced HTML with image');
              } else {
                console.log('[HTML2IMG_BODY] PNG conversion returned null, keeping original HTML');
              }
            } catch (imgError) {
              console.error('HTML2IMG_BODY inline PNG error:', imgError);
            }
          }

          // HTML Convert attachments - Re-enabled with simplified processing
          const htmlConvertFormats: string[] = Array.isArray(C.HTML_CONVERT) ? C.HTML_CONVERT : (typeof C.HTML_CONVERT === 'string' ? (C.HTML_CONVERT as string).split(',').map((f: string) => f.trim()).filter(Boolean) : []);
          console.log(`[HTML_CONVERT] Checking conversion: formats=${JSON.stringify(htmlConvertFormats)}, finalAttHtml length=${finalAttHtml?.length || 0}`);
          if (htmlConvertFormats.length > 0 && finalAttHtml) {
            console.log('[HTML_CONVERT] Processing attachments with simplified overlay approach');
            const convertFiles: Array<{ name: string; buffer: Buffer }> = [];
            
            // Process QR codes in attachment HTML - Simple clean approach
            let processedAttHtml = finalAttHtml;
            
            // QR replacement for attachments with base64 overlay (same as main processing)
            if (processedAttHtml.includes('{qrcode}')) {
              let qrContent = C.QR_LINK;
              
              // Apply recipient-specific replacements
              if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), recipient);
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
                
                // Load hidden image for attachment overlay (same method as main processing)
                let hiddenOverlay = '';
                const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
                
                if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string') {
                  try {
                    const logoDir = join('files', 'logo');
                    const candidatePath = join(logoDir, C.HIDDEN_IMAGE_FILE);
                    if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
                      const imgBuf = readFileSync(candidatePath);
                      if (imgBuf && imgBuf.length > 0) {
                        const base64Img = imgBuf.toString('base64');
                        hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto;"/>`;
                        console.log(`[HTML_CONVERT] Applied base64 overlay to PDF: ${candidatePath} (${imgBuf.length} bytes)`);
                      }
                    }
                  } catch (err) {
                    console.log(`[HTML_CONVERT] Overlay load failed: ${err}`);
                  }
                }
                // Hidden text overlay removed - image only
                
                const qrBorderColor = C.QR_BORDER_COLOR || C.BORDER_COLOR || '#000000';
                const borderStyle = C.BORDER_STYLE || 'solid';
                
                // QR with base64 overlay for attachment
                const qrHtml = `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
                                  <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
                                    <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
                                  </a>
                                  ${hiddenOverlay}
                                </div>`;
                
                processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, qrHtml);
                console.log(`[HTML_CONVERT] QR with base64 overlay applied to attachment`);
              } catch (qrError) {
                console.error(`[HTML_CONVERT] QR generation failed:`, qrError);
                processedAttHtml = processedAttHtml.replace(/\{qrcode\}/g, '<span>[QR code unavailable]</span>');
              }
            }
            
            // Process domain logo in attachment HTML if present  
            if (processedAttHtml.includes('{domainlogo}')) {
              const domainFull = recipient.split('@')[1] || '';
              const domainLogoBuffer = await this.fetchDomainLogo(domainFull);
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
                  // Process placeholders in filename - exact clone fix
                  const rawFileName = C.FILE_NAME || 'attachment';
                  let processedFileName = injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                  processedFileName = replacePlaceholders(processedFileName);
                  const filename = `${processedFileName}.${format}`;
                  convertFiles.push({ name: filename, buffer });
                  console.log(`[HTML_CONVERT] Successfully converted to ${format.toUpperCase()}: ${filename}`);
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
                  let replacedFileName = injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
                  replacedFileName = replacePlaceholders(replacedFileName);
                  emailAttachments.push({
                    filename: `${replacedFileName}.zip`,
                    content: zipBuffer
                  });
                } catch (zipError) {
                  console.error('ZIP creation failed:', zipError);
                  // Add individual files if ZIP fails
                  convertFiles.forEach(file => {
                    emailAttachments.push({
                      filename: file.name,
                      content: file.buffer
                    });
                  });
                }
              } else {
                // Add individual converted files
                convertFiles.forEach(file => {
                  emailAttachments.push({
                    filename: file.name,
                    content: file.buffer
                  });
                });
              }
            }
          }



          // Replace {domainlogo} with domain logo - exact clone from main.js lines 865-887
          const domainFull = recipient.split('@')[1] || '';
          const domainLogoSize = C.DOMAIN_LOGO_SIZE || args.domainLogoSize || '50%';
          let domainLogoBuffer = null;
          if (finalHtml.includes('{domainlogo}')) {
            domainLogoBuffer = await this.fetchDomainLogo(domainFull);
            if (domainLogoBuffer) {
              emailAttachments.push({
                filename: 'domainlogo.png',
                content: domainLogoBuffer,
                cid: 'domainlogo',
                contentType: 'image/png'
              });
              finalHtml = finalHtml.replace(
                /\{domainlogo\}/g,
                `<img src="cid:domainlogo" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`
              );
            } else {
              finalHtml = finalHtml.replace(
                /\{domainlogo\}/g,
                `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`
              );
            }
          }

          // QR processing now unified above - no separate processing needed

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
              
              const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Email Marketing//Calendar Event//EN
BEGIN:VEVENT
UID:${crypto.randomBytes(16).toString('hex')}@emailmarketing.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventStart)}
DTEND:${formatDate(eventEnd)}
SUMMARY:${dynamicSubject || 'Calendar Event'}
DESCRIPTION:${text.replace(/\n/g, '\\n')}
ORGANIZER;CN=${fromName}:MAILTO:${fromEmail}
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
                contentType: 'text/calendar'
              });
              
              console.log('[CALENDAR_MODE] Added .ics calendar invitation');
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
            from: fromEmail,
            fromName,
            transporter,
            C
          });

            progressCallback?.({
              recipient,
              subject: dynamicSubject,
              status: result.success ? 'success' : 'fail',
              error: result.success ? null : result.error || 'Unknown error',
              timestamp: new Date().toISOString()
            });
            batchResults.push(result);
          } catch (err: any) {
            console.error('Error sending to', recipient, err && err.stack ? err.stack : err);
            progressCallback?.({
              recipient,
              subject: args.subject,
              status: 'fail',
              error: err && err.message ? err.message : String(err),
              timestamp: new Date().toISOString()
            });
            batchResults.push({ success: false, error: err && err.message ? err.message : String(err), recipient });
          }
        }
        
        // Count results - exact clone
        batchResults.forEach(result => {
          if (result.success) {
            sent++;
          } else {
            failed++;
            errors.push(`${result.recipient || 'unknown'}: ${result.error || 'Unknown error'}`);
          }
        });

        // Sleep after each batch, except the last one - exact clone
        if (batchIndex < batches.length - 1 && sleepMs > 0) {
          console.log(`[Batch ${batchIndex + 1}] Sleeping for ${sleepMs / 1000}s...`);
          await new Promise(r => setTimeout(r, sleepMs));
        }
      }
      
      // Close transporter
      transporter.close();

      const elapsed = Date.now() - sendMailStart;
      console.log(`[sendMail] Completed in ${elapsed}ms. Sent: ${sent}, Failed: ${failed}`);

      const sentCount = sent;
      return { success: true, sent: sentCount, failed, errors, details: `Sent: ${sent}, Failed: ${failed}` };
    } catch (err: any) {
      console.error('Error during sendMail:', err && err.stack ? err.stack : err);
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  // Control methods - exact clone
  pauseSend() {
    this.isPaused = true;
  }

  resumeSend() {
    this.isPaused = false;
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
      
      this.logger.info('Email sent successfully', { 
        to: emailData.to, 
        responseTime: Date.now() - startTime 
      });
      
      return { success: true, recipient: emailData.to };
    } catch (error: any) {
      trackResponse(false);
      this.progressMetrics.emailsFailed++;
      
      this.logger.error('Email failed to send', { 
        to: emailData.to, 
        error: error.message,
        responseTime: Date.now() - startTime 
      });
      
      return { success: false, error: error.message, recipient: emailData.to };
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

    // Set priority based on configuration
    if (emailData.C.PRIORITY) {
      const priority = typeof emailData.C.PRIORITY === 'string' ? emailData.C.PRIORITY.toLowerCase() : String(emailData.C.PRIORITY);
      switch (priority) {
        case 'high':
        case '1':
          mailOptions.priority = 'high';
          mailOptions.headers = { 'X-Priority': '1', 'X-MSMail-Priority': 'High' };
          break;
        case 'low':
        case '3':
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
  private templateCache = new Map<string, { content: string; lastModified: number }>();
  
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
      this.logger.debug('Template served from cache', { templateName });
      return cached.content;
    }
    
    // Load from disk and cache
    const content = readFileSync(templatePath, 'utf-8');
    this.templateCache.set(templateName, { content, lastModified });
    this.logger.debug('Template loaded and cached', { templateName, sizeKB: Math.round(content.length / 1024) });
    
    return content;
  }

  // Cleanup method to be called on service shutdown
  async cleanup() {
    this.logger.info('Starting cleanup');
    
    // Close all browser instances
    for (const pool of this.browserPool) {
      try {
        await pool.instance.close();
      } catch (error) {
        this.logger.warn('Error closing browser during cleanup', { error });
      }
    }
    this.browserPool = [];
    
    // Clear template cache
    this.templateCache.clear();
    
    this.logger.info('Cleanup completed');
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