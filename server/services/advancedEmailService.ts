import nodemailer from "nodemailer";
import { createReadStream, readFileSync, existsSync, statSync, readdirSync, writeFileSync } from "fs";
import { join, basename } from "path";
import QRCode from "qrcode";
import archiver from "archiver";
import crypto from "crypto";
import axios from "axios";
import { minify } from "html-minifier-terser";
import puppeteer from "puppeteer";
import pLimit from "p-limit";
import { htmlToText } from "html-to-text";
import AdmZip from "adm-zip";
import * as htmlDocx from "html-docx-js";

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
             
  // hashN
  text = text.replace(/\{hash(\d+)\}/gi, (m, n) =>
    Array.from({ length: +n }, () => Math.random().toString(36)[2]).join('')
  );
  
  // randnumN
  text = text.replace(/\{randnum(\d+)\}/gi, (m, n) =>
    Array.from({ length: +n }, () => Math.floor(Math.random() * 10)).join('')
  );
  
  return text;
}

// Decode HTML entities like &#9919; back to characters - exact clone
function decodeHtmlEntities(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

// Replace placeholders like {randnumN} and {hashN} in strings - exact clone from main.js
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
  return str;
}

// Build QR options - exact clone from main.js
function buildQrOpts(C: any) {
  return {
    width: C.QR_WIDTH,
    margin: 4,
    errorCorrectionLevel: 'H'
  };
}

// Configuration object with all settings - exact clone from main.js
const defaultConfig = {
  QR_WIDTH: 200,
  QR_BORDER_WIDTH: 2,
  QR_BORDER_COLOR: '#000000',
  BORDER_STYLE: 'solid',
  QR_LINK: 'https://example.com',
  LINK_PLACEHOLDER: '',
  HTML2IMG_BODY: false,
  RANDOM_METADATA: false,
  MINIFY_HTML: false,
  INCLUDE_HTML_ATTACHMENT: false,
  SLEEP: 3,
  EMAIL_PER_SECOND: 5,
  ZIP_USE: false,
  ZIP_PASSWORD: '',
  FILE_NAME: 'attachment',
  HTML_CONVERT: ['pdf'], // pdf, png, docx
  INCLUDE_HIDDEN_TEXT: false,
  HIDDEN_TEXT: ''
};

export class AdvancedEmailService {
  private globalBrowser: any = null;
  private isPaused = false;
  private limit = pLimit(3); // Concurrency control

  constructor() {}

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

  // QR Code generation - exact clone from main.js lines 713-750
  private async generateQRCode(link: string): Promise<Buffer | null> {
    if (!link || typeof link !== 'string') return null;
    
    try {
      const buffer = await QRCode.toBuffer(link, {
        type: 'png',
        width: 200,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      console.log(`[generateQRCode] Generated QR code for: ${link}`);
      return buffer;
    } catch (error) {
      console.error('[generateQRCode] Error generating QR code:', error);
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

  // Launch browser with exact settings from main.js
  private async launchBrowser() {
    if (!this.globalBrowser) {
      this.globalBrowser = await puppeteer.launch({
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
          '--no-first-run'
        ]
      });
    }
    return this.globalBrowser;
  }

  // HTML to PDF conversion - exact clone
  private async convertHtmlToPdf(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for PDF conversion');
    }
    return this.limit(async () => {
      const browser = await this.launchBrowser();
      const page = await browser.newPage();
      try {
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
        await page.close();
        return pdfBuffer;
      } catch (e) {
        await page.close();
        throw e;
      }
    });
  }

  // HTML to Image conversion - exact clone
  private async convertHtmlToImage(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for Image conversion');
    }
    return this.limit(async () => {
      console.log(`[convertHtmlToImage] Queue pending: ${(this.limit as any).pendingCount}, active: ${(this.limit as any).activeCount}`);
      const browser = await this.launchBrowser();
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1123, height: 1587 });
        await page.setCacheEnabled(true);
        await page.setContent(html, { waitUntil: 'networkidle2' });
        const pngBuffer = await page.screenshot({ fullPage: true });
        await page.close();
        console.log(`[convertHtmlToImage] Finished image generation, queue pending: ${(this.limit as any).pendingCount}, active: ${(this.limit as any).activeCount}`);
        return pngBuffer;
      } catch (e) {
        await page.close();
        console.error('Image generation failed:', e);
        throw e;
      }
    });
  }

  // HTML to DOCX conversion - exact clone
  private htmlToDocxStandalone(html: string) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Cannot convert empty HTML to DOCX');
    }
    return htmlDocx.asBuffer(html);
  }

  // Converter functions registry - exact clone
  private converters = {
    pdf: this.convertHtmlToPdf.bind(this),
    png: this.convertHtmlToImage.bind(this),
    docx: this.htmlToDocxStandalone.bind(this)
  };

  // Unified HTML rendering helper - exact clone
  private async renderHtml(format: string, html: string) {
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
      zip.setPassword(password);
    }
    
    return zip.toBuffer();
  }

  // Send one email - exact clone with all advanced features
  private async sendOneEmail(args: any) {
    const { to, subject, html, text, attachments, transporter } = args;

    const mailOptions: any = {
      from: `"${args.fromName || 'Sender'}" <${args.from}>`,
      to,
      subject,
      html,
      text,
      attachments: attachments || []
    };

    try {
      const result = await transporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      console.error(`Failed to send email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Complete sendMail function with all advanced features - exact clone
  async sendMail(args: any, progressCallback?: (progress: any) => void) {
    console.log('Advanced sendMail invoked with args:', args);
    const sendMailStart = Date.now();
    
    // Load and merge configuration - exact clone from main.js  
    const C = { ...defaultConfig };
    
    console.log('Loaded QR Config:', {
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
    C.QR_BORDER_COLOR = args.qrBorderColor || '#000000';
    
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
    if (typeof args.minifyHtml === 'boolean') {
      C.MINIFY_HTML = args.minifyHtml;
    }
    if (typeof args.includeHtmlAttachment === 'boolean') {
      C.INCLUDE_HTML_ATTACHMENT = args.includeHtmlAttachment;
    }
    if (typeof args.emailPerSecond === 'number' && args.emailPerSecond > 0) {
      C.EMAIL_PER_SECOND = args.emailPerSecond;
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
    
    // Override hidden-text overlay from UI if provided - exact clone
    C.HIDDEN_TEXT = args.includeHiddenText
      ? (typeof args.hiddenText === 'string' ? args.hiddenText : C.HIDDEN_TEXT)
      : '';
    // Decode any HTML entities so they render correctly
    C.HIDDEN_TEXT = decodeHtmlEntities(C.HIDDEN_TEXT);

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
        maxConnections: C.EMAIL_PER_SECOND,
        maxMessages: 100,
        rateLimit: C.EMAIL_PER_SECOND
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
      const batchSize = C.EMAILPERSECOND || 5;
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
        const promises = batch.map(async (recipient: string) => {
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
              return { success: false, error, recipient };
            }
          // Apply placeholders to both HTML content and subject - exact clone
          let html = injectDynamicPlaceholders(templateHtmlBase, recipient, fromEmail, dateStr, timeStr);
          const dynamicSubject = injectDynamicPlaceholders(args.subject, recipient, fromEmail, dateStr, timeStr);
          
          // Process attachment HTML with placeholders
          let attHtml = attachmentHtmlBase ? injectDynamicPlaceholders(attachmentHtmlBase, recipient, fromEmail, dateStr, timeStr) : '';
          
          // QR Code processing - exact clone from main.js
          if (attHtml.includes('{qrcode}')) {
            const qrOpts = this.buildQrOpts(C);
            let qrContent = C.QR_LINK;
            
            // Apply link placeholder replacement
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
              errorCorrectionLevel: 'H' as any
            });
            
            // Hidden text overlay - exact clone
            let hiddenOverlay = '';
            if (C.HIDDEN_TEXT) {
              hiddenOverlay = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
            }
            
            attHtml = attHtml.replace(/\{qrcode\}/g,
              `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
                 <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${C.BORDER_STYLE} ${C.QR_BORDER_COLOR}; padding:2px;"/>
                 ${hiddenOverlay}
               </div>`);
          }

          // HTML minification - exact clone
          let finalHtml = html;
          let finalAttHtml = attHtml;
          
          if (C.MINIFY_HTML) {
            try {
              finalHtml = await minify(finalHtml, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true
              });
              if (finalAttHtml) {
                finalAttHtml = await minify(finalAttHtml, {
                  collapseWhitespace: true,
                  removeComments: true,
                  minifyCSS: true,
                  minifyJS: true
                });
              }
            } catch (minifyError) {
              console.error('HTML minification failed:', minifyError);
            }
          }

          // Prepare email attachments - exact clone logic
          const emailAttachments: any[] = [];
          
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

          // HTML to Image Body conversion - exact clone from main.js
          if (C.HTML2IMG_BODY) {
            try {
              let screenshotHtml = finalHtml;
              // Inline any CID references for screenshot
              let cachedQrBuffer = null;
              if (screenshotHtml.includes('cid:qrcode')) {
                const qrOpts = this.buildQrOpts(C);
                cachedQrBuffer = await QRCode.toBuffer(C.QR_LINK || '', {
                  width: qrOpts.width,
                  margin: qrOpts.margin,
                  errorCorrectionLevel: 'H' as any
                });
              }
              if (screenshotHtml.includes('cid:qrcode') && cachedQrBuffer) {
                const dataQr = cachedQrBuffer.toString('base64');
                screenshotHtml = screenshotHtml.replace(/cid:qrcode/g, `data:image/png;base64,${dataQr}`);
              }
              if (screenshotHtml.includes('cid:domainlogo')) {
                const domainFull = recipient.split('@')[1] || '';
                const domainLogoBuffer = await this.fetchDomainLogo(domainFull);
                if (domainLogoBuffer) {
                  const dataLogo = domainLogoBuffer.toString('base64');
                  screenshotHtml = screenshotHtml.replace(/cid:domainlogo/g, `data:image/png;base64,${dataLogo}`);
                }
              }
              // Convert to PNG
              const result = await this.renderHtml('png', screenshotHtml);
              const cid = 'htmlimgbody';
              const filename = `${C.FILE_NAME || cid}.png`;
              emailAttachments.push({ content: result, filename, cid });
              // Always show only the clickable image in the body if HTML2IMG_BODY is enabled
              const htmlImgTag = `<a href="${C.QR_LINK || ''}" target="_blank" rel="noopener noreferrer">
    <img src="cid:htmlimgbody" style="display:block;max-width:100%;height:auto;margin:16px 0;" alt="HTML Screenshot"/>
  </a>`;
              finalHtml = htmlImgTag;
            } catch (imgError) {
              console.error('HTML2IMG_BODY inline PNG error:', imgError);
            }
          }

          // HTML Convert attachments (PDF, PNG, DOCX) - exact clone
          if (C.HTML_CONVERT && C.HTML_CONVERT.length > 0 && finalAttHtml) {
            const convertFiles: Array<{ name: string; buffer: Buffer }> = [];
            
            for (const format of C.HTML_CONVERT) {
              try {
                const buffer = await this.renderHtml(format, finalAttHtml);
                const filename = `${C.FILE_NAME}.${format}`;
                convertFiles.push({ name: filename, buffer });
              } catch (convertError) {
                console.error(`${format.toUpperCase()} conversion failed:`, convertError);
              }
            }

            // Handle ZIP compression - exact clone from main.js
            if (convertFiles.length > 0) {
              if (C.ZIP_USE) {
                try {
                  const zipBuffer = await this.createZipBuffer(convertFiles, C.ZIP_PASSWORD);
                  const rawFileName = C.FILE_NAME || 'attachments';
                  const replacedFileName = injectDynamicPlaceholders(rawFileName, recipient, fromEmail, dateStr, timeStr);
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

          // Include HTML attachment - exact clone
          if (C.INCLUDE_HTML_ATTACHMENT && finalAttHtml) {
            emailAttachments.push({
              filename: `${C.FILE_NAME}.html`,
              content: finalAttHtml
            });
          }

          // Replace {domainlogo} with domain logo - exact clone from main.js lines 865-887
          const domainFull = recipient.split('@')[1] || '';
          const domainLogoSize = C.DOMAIN_LOGO_SIZE || '50%';
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

          // QR Code replacement with CID - exact clone from main.js lines 917-948
          if (finalHtml.includes('{qrcode}')) {
            const qrBuffer = await this.generateQRCode(C.QR_LINK);
            if (qrBuffer) {
              emailAttachments.push({
                filename: 'qrcode.png',
                content: qrBuffer,
                cid: 'qrcode',
                contentType: 'image/png'
              });

              // Hidden image overlay logic - exact clone from main.js
              const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
              let hiddenImageHtml = '';
              if (C.HIDDEN_TEXT) {
                hiddenImageHtml = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
              }
              
              finalHtml = finalHtml.replace(/\{qrcode\}/g,
                `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
                   <a href="${C.QR_LINK}" target="_blank" rel="noopener noreferrer">
                     <img src="cid:qrcode" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${C.BORDER_STYLE} ${C.QR_BORDER_COLOR}; padding:2px;"/>
                   </a>
                   ${hiddenImageHtml}
                 </div>`
              );
            } else {
              finalHtml = finalHtml.replace(/\{qrcode\}/g, '<span>[QR code unavailable]</span>');
            }
          }

          // Send email - exact clone
          const text = htmlToText(finalHtml);
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
            return result;
          } catch (err: any) {
            console.error('Error sending to', recipient, err && err.stack ? err.stack : err);
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
        
        const batchResults = await Promise.all(promises);
        
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
      const files = readdirSync(folder).filter(f => /\.html$|\.txt$/i.test(f));
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

  async writeFile(filepath: string, content: string) {
    try {
      writeFileSync(filepath, content, 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Send one email with retries and random headers - exact clone from main.js
  private async sendOneEmail({ to, subject, html, text, attachments, from, fromName, transporter, C }: any) {
    const senderDomain = from.split('@')[1];
    
    const mail = {
      from: { name: fromName, address: from },
      to,
      subject,
      html,
      text,
      attachments: attachments || [],
      priority: ['low','normal','high'][C.PRIORITY - 1] || 'normal',
      messageId: `<${this.randomHex(12)}@${senderDomain}>`,
      headers: {
        'X-Mailer': this.randomFrom([
          'Microsoft Outlook 16.0',
          'Apple Mail (2.3654.120.0)',
          'Mozilla Thunderbird',
          'Roundcube Webmail',
          'Outlook-Express/6.0'
        ]),
        'User-Agent': this.randomFrom([
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Mozilla/5.0 (X11; Linux x86_64)',
          'Thunderbird/91.11.0',
          'AppleWebKit/605.1.15 (KHTML, like Gecko)',
          'ElectronMail/5.4',
          'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
          'Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14',
          'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:52.0) Gecko/20100101 Firefox/52.0',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
        ])
      }
    };

    // Send mail with retry logic - exact clone from main.js lines 1057-1072
    let lastError;
    const retryAttempts = (C.RETRY || 0) + 1; // RETRY 0 means 1 attempt total
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        await transporter.sendMail(mail);
        console.log(`Email sent to ${to} (attempt ${attempt})`);
        return { success: true };
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        lastError = error;
        if (attempt < retryAttempts) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    return { success: false, error: lastError instanceof Error ? lastError.message : String(lastError) };
  }

  // Cleanup method
  async cleanup() {
    if (this.globalBrowser) {
      await this.globalBrowser.close();
      this.globalBrowser = null;
    }
  }
}