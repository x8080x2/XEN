import { createWriteStream } from 'fs';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { htmlToText } from 'html-to-text';
import * as QRCode from 'qrcode';
import * as archiver from 'archiver';
import * as AdmZip from 'adm-zip';
import axios from 'axios';
import memoize from 'memoizee';
import pLimit from 'p-limit';
import * as puppeteer from 'puppeteer';
import htmlDocx from 'html-docx-js';

// Configuration object
const C: any = {
  EMAIL_PER_SECOND: 5,
  SLEEP: 0,
  RETRY: 3,
  PRIORITY: 'normal',
  RANDOM_LINK: false,
  RANDOM_METADATA: false,
  CONTENT_MINIFY: false,
  QRCODE: false,
  QR_LINK: '',
  LINK_PLACEHOLDER: '{email}',
  QR_WIDTH: 200,
  QR_BORDER_WIDTH: 0,
  QR_BORDER_COLOR: '#000000',
  QR_FOREGROUND_COLOR: '#000000',
  QR_BACKGROUND_COLOR: '#FFFFFF',
  HTML2IMG_BODY: false,
  HTML2IMG_ATTACHMENT: false,
  HTML_CONVERT: [],
  ZIP_USE: false,
  ZIP_PASSWORD: '',
  FILE_NAME: 'attachment',
  DOMAIN_LOGO_SIZE: '70%',
  BORDER_STYLE: 'solid',
  BORDER_COLOR: '#000000',
  PROXY: {
    PROXY_USE: 0,
    TYPE: 'socks5',
    HOST: '',
    PORT: '',
    USER: '',
    PASS: ''
  }
};

// Utility functions
function injectDynamicPlaceholders(content: string, recipient: string, fromEmail: string, dateStr: string, timeStr: string): string {
  return content
    .replace(/\{email\}/g, recipient)
    .replace(/\{senderemail\}/g, fromEmail)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{time\}/g, timeStr);
}

function replacePlaceholders(content: string): string {
  return content
    .replace(/\{timestamp\}/g, Date.now().toString())
    .replace(/\{random\}/g, Math.random().toString(36).substring(7));
}

function buildQrOpts(config: any) {
  return {
    width: config.QR_WIDTH || 200,
    margin: 4,
    errorCorrectionLevel: 'H'
  };
}

export class AdvancedEmailService {
  private isPaused = false;
  private limit = pLimit(5);
  private logger = console;
  private browserPool: puppeteer.Browser[] = [];
  private currentBrowserIndex = 0;
  private maxBrowsers = 3;

  constructor() {
    this.initializeBrowserPool();
  }

  async initializeBrowserPool() {
    try {
      for (let i = 0; i < this.maxBrowsers; i++) {
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.browserPool.push(browser);
      }
      console.log(`[BrowserPool] Initialized ${this.maxBrowsers} browsers`);
    } catch (error) {
      console.error('[BrowserPool] Failed to initialize:', error);
    }
  }

  async getBrowser() {
    if (this.browserPool.length === 0) {
      await this.initializeBrowserPool();
    }
    
    const browser = this.browserPool[this.currentBrowserIndex];
    this.currentBrowserIndex = (this.currentBrowserIndex + 1) % this.browserPool.length;
    return browser;
  }

  async cleanupBrowserPool() {
    for (const browser of this.browserPool) {
      try {
        await browser.close();
      } catch (error) {
        console.error('[BrowserPool] Error closing browser:', error);
      }
    }
    this.browserPool = [];
    this.currentBrowserIndex = 0;
  }

  // Domain logo fetching with memoization
  fetchDomainLogo = memoize(async (domain: string, skipCache = false) => {
    try {
      if (!domain || typeof domain !== 'string') return null;
      
      const cleanDomain = domain.toLowerCase().trim();
      if (!cleanDomain) return null;
      
      // Try multiple logo sources
      const logoUrls = [
        `https://logo.clearbit.com/${cleanDomain}`,
        `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=256`
      ];
      
      for (const url of logoUrls) {
        try {
          const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; EmailService/1.0)'
            }
          });
          
          if (response.data && response.data.byteLength > 100) {
            return Buffer.from(response.data);
          }
        } catch (error) {
          console.log(`[Logo] Failed to fetch from ${url}:`, error.message);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Logo] Error fetching domain logo:', error);
      return null;
    }
  }, { maxAge: 1000 * 60 * 60, max: 1000 }); // Cache for 1 hour, max 1000 entries

  extractDomainFromEmail(email: string): string | null {
    if (!email || typeof email !== 'string') return null;
    const match = email.match(/@([^@]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  async htmlToImage(html: string, options: any = {}) {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const screenshot = await page.screenshot({
        type: options.type || 'png',
        quality: options.quality || 100,
        fullPage: options.fullPage !== false,
        clip: options.clip
      });
      
      await page.close();
      return screenshot;
    } catch (error) {
      console.error('[HTML2IMG] Error:', error);
      return null;
    }
  }

  async htmlToPdf(html: string) {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      await page.close();
      return pdf;
    } catch (error) {
      console.error('[HTML2PDF] Error:', error);
      return null;
    }
  }

  async htmlToDocx(html: string) {
    try {
      const docx = htmlDocx.asBlob(html);
      return Buffer.from(await docx.arrayBuffer());
    } catch (error) {
      console.error('[HTML2DOCX] Error:', error);
      return null;
    }
  }

  async createZipBuffer(files: { name: string; buffer: Buffer }[], password?: string) {
    return new Promise<Buffer>((resolve, reject) => {
      const zip = new AdmZip();
      
      try {
        files.forEach(file => {
          zip.addFile(file.name, file.buffer);
        });
        
        const buffer = zip.toBuffer();
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    });
  }

  async retryWithBackoff(fn: () => Promise<any>, maxRetries = 3, delay = 1000) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const backoffDelay = delay * Math.pow(2, attempt);
        console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  async sendMail(args: any, progressCallback?: (progress: any) => void) {
    const sendMailStart = Date.now();
    
    // Apply settings from UI args
    if (typeof args.emailPerSecond === 'number' && args.emailPerSecond > 0) {
      C.EMAIL_PER_SECOND = args.emailPerSecond;
    }
    if (typeof args.sleep === 'number' && args.sleep >= 0) {
      C.SLEEP = args.sleep;
    }
    if (typeof args.retry === 'number' && args.retry >= 0) {
      C.RETRY = args.retry;
    }
    
    C.PRIORITY = args.priority || C.PRIORITY || 'normal';
    C.RANDOM_LINK = args.randomLink || false;
    C.RANDOM_METADATA = args.randomMetadata || false;
    C.CONTENT_MINIFY = args.contentMinify || false;
    
    // Apply QR settings
    C.QRCODE = args.qrCode || false;
    if (args.qrLink) {
      C.QR_LINK = args.qrLink;
      C.LINK_PLACEHOLDER = '{email}';
    }
    C.QR_WIDTH = args.qrWidth || C.QR_WIDTH || 200;
    C.QR_BORDER_WIDTH = args.qrBorderWidth || C.QR_BORDER_WIDTH || 0;
    C.QR_BORDER_COLOR = args.qrBorderColor || C.QR_BORDER_COLOR;
    C.QR_FOREGROUND_COLOR = args.qrForegroundColor || C.QR_FOREGROUND_COLOR || '#000000';
    C.QR_BACKGROUND_COLOR = args.qrBackgroundColor || C.QR_BACKGROUND_COLOR || '#FFFFFF';
    
    // Apply conversion settings
    C.HTML2IMG_BODY = args.html2imgBody || false;
    C.HTML2IMG_ATTACHMENT = args.html2imgAttachment || false;
    
    if (args.htmlConvert && Array.isArray(args.htmlConvert)) {
      C.HTML_CONVERT = args.htmlConvert;
    }
    
    C.ZIP_USE = args.zipUse || false;
    C.ZIP_PASSWORD = args.zipPassword || '';
    C.FILE_NAME = args.fileName || C.FILE_NAME || 'attachment';
    C.DOMAIN_LOGO_SIZE = args.domainLogoSize || C.DOMAIN_LOGO_SIZE || '70%';
    
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
      // SMTP Configuration
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

      console.log('SMTP Config Loaded:', { host, port, user, fromEmail, fromName, secure });
      
      const transporter = nodemailer.createTransporter({
        host,
        port,
        secure,
        auth: { user, pass },
        pool: true,
        maxConnections: C.EMAIL_PER_SECOND || 5,
        maxMessages: 100,
        rateLimit: C.EMAIL_PER_SECOND || 5
      });

      // Get recipients
      const recipients = Array.isArray(args.recipients) && args.recipients.length
        ? args.recipients
        : (typeof args.recipients === 'string' ? args.recipients.split('\n').filter((r: string) => r.trim()) : []);
      
      if (!recipients.length) {
        throw new Error('No recipients provided');
      }

      // Load email body HTML
      let bodyHtml = '';
      if (args.bodyHtmlFile && typeof args.bodyHtmlFile === "string" && args.bodyHtmlFile.trim() !== "") {
        bodyHtml = readFileSync(join('files', args.bodyHtmlFile), 'utf-8');
      } else if (args.html && typeof args.html === "string") {
        bodyHtml = args.html;
      } else {
        bodyHtml = args.html || args.emailContent || '';
      }

      let attachmentHtml = (typeof args.attachmentHtml === 'string' && args.attachmentHtml.trim())
        ? args.attachmentHtml
        : bodyHtml;

      // Replace placeholders
      const currentDate = new Date();
      const dateStr = currentDate.toISOString().slice(0,10);
      const timeStr = currentDate.toISOString().slice(11,19);

      let processedBodyHtml = bodyHtml
        .replace(/\{senderemail\}/g, args.senderEmail || '')
        .replace(/\{date\}/g, dateStr)
        .replace(/\{time\}/g, timeStr)
        .replace(/\{link\}/g, C.LINK_PLACEHOLDER || C.QR_LINK || '');

      let processedAttachmentHtml = attachmentHtml
        .replace(/\{senderemail\}/g, args.senderEmail || '')
        .replace(/\{date\}/g, dateStr)
        .replace(/\{time\}/g, timeStr)
        .replace(/\{link\}/g, C.LINK_PLACEHOLDER || C.QR_LINK || '');

      processedAttachmentHtml = replacePlaceholders(processedAttachmentHtml);
      processedBodyHtml = replacePlaceholders(processedBodyHtml);

      this.limit = pLimit(C.EMAIL_PER_SECOND || 15);

      const templateHtmlBase = processedBodyHtml;
      const attachmentHtmlBase = processedAttachmentHtml;

      // Batch processing
      console.log('[sendMail] Startup time (ms):', Date.now() - sendMailStart);
      const batchSize = C.EMAIL_PER_SECOND || 15;
      console.log(`[sendMail] Using EMAIL_PER_SECOND: ${batchSize}, SLEEP: ${C.SLEEP}s`);
      
      const batches = [];
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }
      const sleepMs = Math.max(0, (C.SLEEP || 0) * 1000);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        while (this.isPaused) {
          console.log('[sendMail] Currently paused, waiting to resume...');
          await new Promise(r => setTimeout(r, 500));
        }
        
        const batch = batches[batchIndex];
        console.log(`[Batch ${batchIndex + 1}/${batches.length}] Processing ${batch.length} recipients`);
        
        const batchPromises = batch.map(async (recipient: string) => {
          try {
            if (!recipient || !recipient.includes('@')) {
              const error = 'Invalid email format';
              progressCallback?.({
                recipient,
                subject: args.subject,
                status: 'fail',
                error,
                timestamp: new Date().toISOString()
              });
              return { success: false, error, recipient };
            }
            
            let html = injectDynamicPlaceholders(templateHtmlBase, recipient, fromEmail, dateStr, timeStr);
            const dynamicSubject = injectDynamicPlaceholders(args.subject, recipient, fromEmail, dateStr, timeStr);
            
            const emailAttachments: any[] = [];
            
            // QR Code processing
            if (html.includes('{qrcode}') && C.QRCODE) {
              try {
                let qrContent = C.QR_LINK;
                if (C.LINK_PLACEHOLDER && qrContent.includes(C.LINK_PLACEHOLDER)) {
                  qrContent = qrContent.replace(new RegExp(C.LINK_PLACEHOLDER, 'g'), recipient);
                }
                if (C.RANDOM_METADATA) {
                  const rand = crypto.randomBytes(4).toString('hex');
                  qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
                }
                
                const qrBuffer = await QRCode.toBuffer(qrContent, {
                  width: C.QR_WIDTH || 200,
                  margin: 4,
                  errorCorrectionLevel: 'H' as any,
                  color: {
                    dark: C.QR_FOREGROUND_COLOR || '#000000',
                    light: C.QR_BACKGROUND_COLOR || '#FFFFFF'
                  }
                });
                
                const qrCid = 'qrcode-main';
                emailAttachments.push({
                  content: qrBuffer,
                  filename: 'qrcode.png',
                  cid: qrCid
                });
                
                const qrHtml = `<div style="text-align:center; margin: 10px auto;">
                                <a href="${qrContent}" target="_blank">
                                  <img src="cid:${qrCid}" alt="QR Code" style="width:${C.QR_WIDTH || 200}px; height:auto;"/>
                                </a>
                              </div>`;
                
                html = html.replace(/\{qrcode\}/g, qrHtml);
              } catch (qrError) {
                console.error('QR generation failed:', qrError);
                html = html.replace(/\{qrcode\}/g, '<span style="color:red;">[QR code generation failed]</span>');
              }
            } else {
              html = html.replace(/\{qrcode\}/g, '');
            }

            // Domain logo processing
            const domainFull = recipient.split('@')[1] || '';
            if (html.includes('{domainlogo}')) {
              try {
                const domainLogoBuffer = await this.fetchDomainLogo(domainFull, false);
                if (domainLogoBuffer) {
                  const logoId = `domain-logo-${Date.now()}`;
                  emailAttachments.push({
                    content: domainLogoBuffer,
                    filename: `logo-${domainFull}.png`,
                    cid: logoId
                  });
                  
                  const logoHtml = `<img src="cid:${logoId}" alt="${domainFull} logo" style="max-width:70%; height:auto;" />`;
                  html = html.replace(/\{domainlogo\}/g, logoHtml);
                } else {
                  html = html.replace(/\{domainlogo\}/g, '<span style="color:#888;">[Logo unavailable]</span>');
                }
              } catch (logoError) {
                console.error('Domain logo processing failed:', logoError);
                html = html.replace(/\{domainlogo\}/g, '<span style="color:#888;">[Logo unavailable]</span>');
              }
            }

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

            // Send email
            const text = htmlToText(html);
            const result = await this.sendOneEmail({
              to: recipient,
              subject: dynamicSubject,
              html: html,
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
            return result;
          } catch (err: any) {
            console.error('Error sending to', recipient, err);
            progressCallback?.({
              recipient,
              subject: args.subject,
              status: 'fail',
              error: err && err.message ? err.message : String(err),
              timestamp: new Date().toISOString()
            });
            return { success: false, error: err && err.message ? err.message : String(err), recipient };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result: any) => {
          if (result.success) {
            sent++;
          } else {
            failed++;
            errors.push(`${result.recipient || 'unknown'}: ${result.error || 'Unknown error'}`);
          }
        });

        if (batchIndex < batches.length - 1 && sleepMs > 0) {
          console.log(`[Batch ${batchIndex + 1}] Sleeping for ${sleepMs / 1000}s...`);
          await new Promise(r => setTimeout(r, sleepMs));
        }
        
        if (batchIndex % 5 === 0) {
          await this.cleanupBrowserPool();
          if (global.gc) {
            global.gc();
          }
        }
      }
      
      transporter.close();

      const elapsed = Date.now() - sendMailStart;
      console.log(`[sendMail] Completed in ${elapsed}ms. Sent: ${sent}, Failed: ${failed}`);

      return { success: true, sent, failed, errors, details: `Sent: ${sent}, Failed: ${failed}` };
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || 'Unknown sendMail error';
      console.error('Error during sendMail:', errorMessage);
      return { success: false, error: errorMessage, details: `Failed: ${errorMessage}` };
    }
  }

  pauseSend() {
    this.isPaused = true;
  }

  resumeSend() {
    this.isPaused = false;
  }

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
      const files = readdirSync('files/logo').filter(f => /\.(png|jpg|jpeg|gif|svg)$/i.test(f));
      return { files };
    } catch (err: any) {
      return { error: err.message, files: [] };
    }
  }

  async readFile(filepath: string) {
    try {
      if (!existsSync(filepath)) {
        return { error: 'File not found', content: '' };
      }
      const content = readFileSync(filepath, 'utf-8');
      return { content };
    } catch (err: any) {
      return { error: err.message, content: '' };
    }
  }

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
    
    try {
      const result = await this.retryWithBackoff(async () => {
        return await emailData.transporter.sendMail({
          from: `"${emailData.fromName}" <${emailData.from}>`,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          attachments: emailData.attachments,
          priority: emailData.C.PRIORITY || 'normal'
        });
      }, emailData.C.RETRY || 3);

      const elapsed = Date.now() - startTime;
      console.log(`[Email] Sent to ${emailData.to} in ${elapsed}ms`);
      return { success: true };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Email] Failed to send to ${emailData.to} after ${elapsed}ms:`, error.message);
      return { success: false, error: error.message, recipient: emailData.to };
    }
  }

  async cleanup() {
    try {
      await this.cleanupBrowserPool();
      console.log('[Service] Cleanup completed');
    } catch (error) {
      console.error('[Service] Cleanup error:', error);
    }
  }

  async writeFile(filepath: string, content: string) {
    try {
      writeFileSync(filepath, content, 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}

// Export an instance for the routes to use
export const advancedEmailService = new AdvancedEmailService();