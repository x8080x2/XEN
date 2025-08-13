import nodemailer from "nodemailer";
import { createReadStream, readFileSync, existsSync, statSync, readdirSync } from "fs";
import { join, basename } from "path";
import QRCode from "qrcode";
import archiver from "archiver";
import crypto from "crypto";
import axios from "axios";
import { minify } from "html-minifier-terser";
import puppeteer from "puppeteer";
import pLimit from "p-limit";
import { htmlToText } from "html-to-text";

// Exact clone of the original configuration and helper functions
function pickRand(arr: any[]): any {
  return arr[Math.floor(Math.random() * arr.length)];
}

function injectDynamicPlaceholders(text: string, user: string, email: string, dateStr: string, timeStr: string): string {
  const userU = user.toUpperCase();
  const userL = user.toLowerCase();
  const username = email.split('@')[0];
  const domain = email.split('@')[1];
  const domainParts = domain.split('.');
  const domainBase = domainParts.slice(0, -1).join('.');
  
  return text
    .replace(/\{user\}/g, user)
    .replace(/\{username\}/g, username)
    .replace(/\{userupper\}/g, userU)
    .replace(/\{userlower\}/g, userL)
    .replace(/\{domain\}/g, domain)
    .replace(/\{domainbase\}/g, domainBase)
    .replace(/\{email\}/g, email)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{time\}/g, timeStr)
    .replace(/\{initials\}/g, username.slice(0, 2).toUpperCase())
    .replace(/\{userid\}/g, Buffer.from(email).toString('base64').slice(0, 8))
    .replace(/\{hash6\}/g, crypto.createHash('md5').update(email).digest('hex').slice(0, 6))
    .replace(/\{randnum4\}/g, Math.floor(1000 + Math.random() * 9000).toString())
    .replace(/\{randfirst\}/g, pickRand(['John', 'Jane', 'Alex', 'Chris', 'Pat', 'Kim', 'Sam']))
    .replace(/\{randlast\}/g, pickRand(['Smith', 'Doe', 'Johnson', 'Lee', 'Morgan', 'Davis', 'Carter']))
    .replace(/\{randname\}/g, pickRand(['John Smith', 'Jane Doe', 'Alex Johnson', 'Chris Lee', 'Pat Morgan', 'Kim Davis', 'Sam Carter']))
    .replace(/\{randcompany\}/g, pickRand(['TechCorp', 'InnovateLLC', 'FutureSoft', 'DataSys', 'CloudTech', 'NetSolutions']))
    .replace(/\{randdomain\}/g, pickRand(['techcorp.com', 'innovate.io', 'futuresoft.net', 'datasys.co', 'cloudtech.ai']))
    .replace(/\{randtitle\}/g, pickRand(['Manager', 'Director', 'Analyst', 'Coordinator', 'Specialist', 'Executive']));
}

function randomFrom(arr: any[]): any {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomHex(len: number): string {
  return crypto.randomBytes(len).toString('hex');
}

function replacePlaceholders(str: string): string {
  // Same as original - generates random content for various placeholders
  return str
    .replace(/\{senderemail\}/g, '') // This gets filled in later
    .replace(/\{date\}/g, new Date().toISOString().slice(0, 10))
    .replace(/\{time\}/g, new Date().toISOString().slice(11, 19))
    .replace(/\{randomname\}/g, () => {
      const names = ['John Smith', 'Jane Doe', 'Alex Johnson', 'Chris Lee', 'Pat Morgan', 'Kim Davis', 'Sam Carter'];
      return names[Math.floor(Math.random() * names.length)];
    })
    .replace(/\{randchar(\d+)\}/g, (_, n) => {
      return [...Array(Number(n))].map(() => Math.random().toString(36).charAt(2)).join('');
    })
    .replace(/\{randomnum(\d+)\}/g, (_, n) => {
      return [...Array(Number(n))].map(() => Math.floor(Math.random() * 10)).join('');
    });
}

function buildQrOpts(C: any) {
  return {
    width: C.QR_WIDTH || 200,
    margin: C.QR_BORDER_WIDTH || 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  };
}

function decodeHtmlEntities(text: string): string {
  const entityMap: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  };
  return text.replace(/&[#\w]+;/g, entity => entityMap[entity] || entity);
}

function parseIniWithSections(data: string): any {
  const lines = data.split('\n');
  const result: any = {};
  let currentSection: any = {};
  let sectionName = 'default';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (sectionName && Object.keys(currentSection).length > 0) {
        result[sectionName] = currentSection;
      }
      sectionName = trimmed.slice(1, -1);
      currentSection = {};
    } else if (trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      currentSection[key.trim()] = cast(value);
    }
  }

  if (sectionName && Object.keys(currentSection).length > 0) {
    result[sectionName] = currentSection;
  }

  return result;
}

function cast(val: string): any {
  if (!val) return '';
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (!isNaN(Number(val))) return Number(val);
  return val;
}

function isTrue(value: any): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

// Load configuration like the original
function loadConfig() {
  const configPath = join(process.cwd(), 'config', 'config.ini');
  let C: any = {
    // Default values from original
    LETTER: 'files/letter.html',
    RECIPIENTS: 'files/leads.txt',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: '',
    SMTP_PASS: '',
    FROM_EMAIL: '',
    FROM_NAME: '',
    PRIORITY: 2,
    SLEEP: 3,
    EMAILPERSECOND: 5,
    RETRY: 3,
    QR_LINK: 'https://example.com',
    QR_WIDTH: 200,
    QR_BORDER_WIDTH: 2,
    QR_BORDER_COLOR: '#000000',
    BORDER_STYLE: 'solid',
    LINK_PLACEHOLDER: '',
    HTML2IMG_BODY: false,
    RANDOM_METADATA: false,
    MINIFY_HTML: false,
    INCLUDE_HTML_ATTACHMENT: false,
    ZIP_USE: false,
    ZIP_PASSWORD: '',
    FILE_NAME: 'attachment',
    HTML_CONVERT: ['pdf'],
    HIDDEN_TEXT: '',
    HIDDEN_IMAGE_FILE: '',
    HIDDEN_IMAGE_SIZE: 50,
    DOMAIN_LOGO_SIZE: '50%'
  };

  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      const parsed = parseIniWithSections(configContent);
      C = { ...C, ...parsed.config };
    } catch (err) {
      console.warn('Failed to load config:', err);
    }
  }

  return { C };
}

// Browser management for HTML to PDF/Image conversion
let browserInstance: any = null;
let limit = pLimit(5);

async function launchBrowser() {
  if (!browserInstance) {
    const { C } = loadConfig();
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    
    // Add proxy if configured
    if (C.PROXY && C.PROXY.PROXY_USE === 1 && C.PROXY.HOST && C.PROXY.PORT) {
      args.push(`--proxy-server=${C.PROXY.HOST}:${C.PROXY.PORT}`);
    }

    browserInstance = await puppeteer.launch({ 
      headless: true, 
      args,
      timeout: 30000 
    });
    console.log('Puppeteer browser launched.');
    
    // Setup proxy auth if needed
    if (C.PROXY && C.PROXY.PROXY_USE === 1 && C.PROXY.USER && C.PROXY.PASS) {
      const pages = await browserInstance.pages();
      const page = pages.length ? pages[0] : await browserInstance.newPage();
      await page.authenticate({ username: C.PROXY.USER, password: C.PROXY.PASS });
    }
  }
  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log('Puppeteer browser closed.');
    } catch (e) {
      console.error('Error closing Puppeteer browser:', e);
    }
    browserInstance = null;
  }
}

// HTML to PDF conversion - exact clone
async function convertHtmlToPdf(html: string) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('Invalid HTML input for PDF conversion');
  }
  const browser = await launchBrowser();

  return limit(async () => {
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
async function convertHtmlToImage(html: string) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('Invalid HTML input for Image conversion');
  }
  return limit(async () => {
    console.log(`[convertHtmlToImage] Queue pending: ${(limit as any).pendingCount}, active: ${(limit as any).activeCount}`);
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1123, height: 1587 });
      await page.setCacheEnabled(true);
      await page.setContent(html, { waitUntil: 'networkidle2' });
      const pngBuffer = await page.screenshot({ fullPage: true });
      await page.close();
      console.log(`[convertHtmlToImage] Finished image generation, queue pending: ${(limit as any).pendingCount}, active: ${(limit as any).activeCount}`);
      return pngBuffer;
    } catch (e) {
      await page.close();
      console.error('Image generation failed:', e);
      throw e;
    }
  });
}

// HTML to DOCX - simplified version
function htmlToDocxStandalone(html: string) {
  // Simplified DOCX generation - in real implementation you'd use a proper library
  const content = html.replace(/<[^>]+>/g, ''); // Strip HTML tags
  return Buffer.from(content, 'utf-8');
}

// Converter registry
const converters = {
  pdf: convertHtmlToPdf,
  png: convertHtmlToImage,
  docx: htmlToDocxStandalone
};

async function renderHtml(format: string, html: string) {
  const fn = converters[format as keyof typeof converters];
  if (!fn) throw new Error('Unsupported render format: ' + format);
  return await fn(html);
}

export class OriginalEmailService {
  private isPaused = false;

  pauseSend() {
    console.log('[sendMail] Paused by user');
    this.isPaused = true;
  }

  resumeSend() {
    console.log('[sendMail] Resumed by user');
    this.isPaused = false;
  }

  // Main sendMail function - exact clone from original
  async sendMail(args: any = {}, onProgress?: (data: any) => void): Promise<any> {
    console.log('sendMail invoked with args:', args);
    const sendMailStart = Date.now();
    
    // Always reload config fresh for each sendMail call
    const { C } = loadConfig();
    
    // Override batch delay from UI
    if (args.sleep !== undefined && !isNaN(Number(args.sleep))) {
      C.SLEEP = Number(args.sleep);
    }
    
    // Override QR settings from UI if provided
    if (typeof args.qrSize === 'number' && args.qrSize > 0) {
      C.QR_WIDTH = args.qrSize;
    }
    
    C.QR_BORDER_WIDTH = (typeof args.qrBorder === 'number' && args.qrBorder >= 0)
      ? args.qrBorder
      : (C.QR_BORDER_WIDTH || 2);
    C.QR_BORDER_COLOR = args.qrBorderColor || '#000000';

    // Runtime overrides from UI
    if (typeof args.htmlImgBody === 'boolean') {
      C.HTML2IMG_BODY = args.htmlImgBody;
    }
    if (typeof args.qrLink === 'string' && args.qrLink.trim()) {
      C.QR_LINK = args.qrLink.trim();
    }
    if (typeof args.linkPlaceholder === 'string') {
      C.LINK_PLACEHOLDER = args.linkPlaceholder;
    }

    // Additional runtime overrides from UI
    if (typeof args.randomMetadata !== 'undefined') {
      C.RANDOM_METADATA = args.randomMetadata === '1' || args.randomMetadata === true;
    }
    if (typeof args.minifyHtml !== 'undefined') {
      C.MINIFY_HTML = args.minifyHtml === '1' || args.minifyHtml === true;
    }
    if (typeof args.includeHtmlAttachment !== 'undefined') {
      C.INCLUDE_HTML_ATTACHMENT = args.includeHtmlAttachment === '1' || args.includeHtmlAttachment === true;
    }
    if (typeof args.emailPerSecond !== 'undefined' && !isNaN(Number(args.emailPerSecond))) {
      C.EMAILPERSECOND = Math.max(1, Number(args.emailPerSecond));
    }
    if (typeof args.zipUse !== 'undefined') {
      C.ZIP_USE = args.zipUse === '1' || args.zipUse === true;
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

    // Override hidden-text overlay from UI if provided
    C.HIDDEN_TEXT = args.includeHiddenText
      ? (typeof args.hiddenText === 'string' ? args.hiddenText : C.HIDDEN_TEXT)
      : '';
    // Decode any HTML entities so they render correctly
    C.HIDDEN_TEXT = decodeHtmlEntities(C.HIDDEN_TEXT);

    // Accept UI args or fallback to config/disk
    const recipients = Array.isArray(args.recipients) && args.recipients.length
      ? args.recipients
      : [];

    // Load email body HTML from args or file
    let bodyHtml = '';
    if (args.html && typeof args.html === "string") {
      bodyHtml = args.html;
    } else {
      // In web version, we get HTML from UI instead of files
      bodyHtml = args.html || '<p>Default email content</p>';
    }

    // Attachment HTML handling
    let attachmentHtml = (typeof args.attachmentHtml === 'string' && args.attachmentHtml.trim())
      ? args.attachmentHtml
      : bodyHtml;

    // Replace placeholders in bodyHtml
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().slice(0, 10);
    const timeStr = currentDate.toISOString().slice(11, 19);

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
    limit = pLimit(C.EMAILPERSECOND || 5);

    // Use processedBodyHtml as the email html body from now on
    const templateHtmlBase = processedBodyHtml;
    const attachmentHtmlBase = processedAttachmentHtml;

    // Compose attachments array from UI attachments only
    let preAttachmentsBase: any[] = [];
    if (Array.isArray(args.attachments) && args.attachments.length) {
      for (const filePath of args.attachments) {
        if (filePath && !filePath.match(/\.(html?|HTML?)$/)) {
          preAttachmentsBase.push({ path: filePath, filename: basename(filePath) });
        }
      }
    }

    let subject = (typeof args.subject === 'string' && args.subject.trim() !== '')
      ? args.subject.trim()
      : 'No Subject';

    // Get transporter - exact clone from original
    function getTransporter() {
      // In web version, use environment variables or passed SMTP config
      const host = args.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(args.smtpPort || process.env.SMTP_PORT || 587);
      const user = args.smtpUser || process.env.SMTP_USER || '';
      const pass = args.smtpPass || process.env.SMTP_PASS || '';
      const fromEmail = args.senderEmail || process.env.FROM_EMAIL || user;
      const fromName = args.senderName || process.env.FROM_NAME || '';

      if (!host || !port || !user || !pass) {
        throw new Error('Missing SMTP config field: host, port, user, or pass');
      }
      if (!fromEmail || fromEmail.trim() === '') {
        throw new Error('fromEmail is missing in SMTP config.');
      }

      const secure = port === 465;
      // Enhanced logging
      console.log('SMTP Config Loaded:', {
        host, port, user, fromEmail, fromName, secure
      });
      
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        pool: true,
        maxConnections: C.EMAILPERSECOND,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: Math.max(1, Number(C.EMAILPERSECOND) || 1),
        tls: { rejectUnauthorized: false }
      });
      
      console.log('Transporter options:', transporter.options);
      (transporter as any).defaultFrom = fromEmail;
      return { transporter, fromEmail, fromName };
    }

    const { transporter, fromEmail, fromName } = getTransporter();
    console.log('[sendMail] Using sender:', { fromEmail, fromName });
    
    let senderNameRaw = (typeof args.senderName === 'string' && args.senderName.trim())
      ? args.senderName.trim()
      : fromName;
    const senderName = replacePlaceholders(senderNameRaw);
    const fromAddress = fromEmail;

    // sendOneEmail helper - exact clone from original
    const sendOneEmail = async ({
      to, 
      subject, 
      html, 
      text, 
      fromAddress, 
      senderName, 
      preAttachments, 
      C, 
      transporter, 
      attachmentHtml
    }: any) => {
      // Helper: fetch domain logo as buffer
      async function fetchDomainLogo(domain: string) {
        const logoUrl = `https://logo.clearbit.com/${domain}`;
        try {
          const response = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 1200 });
          if (response.status === 200 && response.data) {
            return Buffer.from(response.data);
          }
        } catch (err: any) {
          console.error('Error fetching domain logo:', err && err.message ? err.message : err);
        }
        return null;
      }

      // QR code generator helper
      async function generateQRCode(link: string) {
        try {
          const qrOpts = buildQrOpts(C);
          const qrBuffer = await QRCode.toBuffer(link, qrOpts);
          return qrBuffer;
        } catch (e) {
          console.error('QR code generation failed:', e);
          return null;
        }
      }

      // Extract recipient info for placeholder replacements
      const email = to;
      const username = email.split('@')[0];
      const domainFull = email.split('@')[1] || '';
      const domain = domainFull.replace(/\.[^.]+$/, ''); // remove TLD

      // Get domain logo size from config
      const domainLogoSize = C.DOMAIN_LOGO_SIZE || '50%';
      
      // Per-recipient placeholder replacements for html and attachmentHtml
      function doRecipientPlaceholders(str: string) {
        let out = str;
        // {domain}, {Domain}, {DOMAIN}
        out = out.replace(/\{domain\}/g, domain.toLowerCase());
        out = out.replace(/\{Domain\}/g, domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase());
        out = out.replace(/\{DOMAIN\}/g, domain.toUpperCase());
        // {fulldomain}, {Fulldomain}, {FULLDOMAIN}
        out = out.replace(/\{fulldomain\}/g, domainFull.toLowerCase());
        out = out.replace(/\{Fulldomain\}/g, domainFull.charAt(0).toUpperCase() + domainFull.slice(1).toLowerCase());
        out = out.replace(/\{FULLDOMAIN\}/g, domainFull.toUpperCase());
        // {mename}, {mename3}
        out = out.replace(/\{mename\}/g, username);
        out = out.replace(/\{mename3\}/g, username.slice(0, 3));
        // {email}
        out = out.replace(/\{email\}/g, email);
        // {emailb64}
        out = out.replace(/\{emailb64\}/g, Buffer.from(email).toString('base64'));
        // {xemail}
        out = out.replace(/\{xemail\}/g, username.charAt(0) + '***@' + domainFull);
        // {randomname}
        const names = ['John Smith', 'Jane Doe', 'Alex Johnson', 'Chris Lee', 'Pat Morgan', 'Kim Davis', 'Sam Carter'];
        out = out.replace(/\{randomname\}/g, () => names[Math.floor(Math.random() * names.length)]);
        // {randcharN}
        out = out.replace(/\{randchar(\d+)\}/g, (_, n) => [...Array(Number(n))].map(() => Math.random().toString(36).charAt(2)).join(''));
        // {randomnumN}
        out = out.replace(/\{randomnum(\d+)\}/g, (_, n) => [...Array(Number(n))].map(() => Math.floor(Math.random() * 10)).join(''));
        // Add {link} replacement
        out = out.replace(/\{link\}/g, C.QR_LINK || '');
        return out;
      }

      html = doRecipientPlaceholders(html);

      // Per-recipient HTML attachment generation
      if (C.INCLUDE_HTML_ATTACHMENT && attachmentHtml) {
        let attHtml = doRecipientPlaceholders(attachmentHtml);
        attHtml = replacePlaceholders(attHtml);

        // Embed domain logo for attachments as data URL
        if (attHtml.includes('{domainlogo}')) {
          const buf = await fetchDomainLogo(domainFull);
          if (buf) {
            const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
            attHtml = attHtml.replace(
              /\{domainlogo\}/g,
              `<img src="${dataUrl}" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`
            );
          } else {
            attHtml = attHtml.replace(/\{domainlogo\}/g, `<span>[Logo unavailable]</span>`);
          }
        }

        // Embed QR into attachments (data URL) and optional hidden overlay
        if (attHtml.includes('{qrcode}')) {
          const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
          let hiddenOverlay = '';
          
          if (C.HIDDEN_TEXT) {
            hiddenOverlay = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
          }
          
          // Prepare QR content and render to Data URL
          const qrOpts = buildQrOpts(C);
          let qrContent = C.QR_LINK;
          if (C.RANDOM_METADATA) {
            const rand = crypto.randomBytes(4).toString('hex');
            qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
          }
          const qrDataUrl = await QRCode.toDataURL(qrContent, qrOpts) as string;
          attHtml = attHtml.replace(/\{qrcode\}/g,
            `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
               <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${C.BORDER_STYLE} ${C.QR_BORDER_COLOR}; padding:2px;"/>
               ${hiddenOverlay}
             </div>`
          );
        }

        if (C.MINIFY_HTML) {
          attHtml = minify(attHtml, { collapseWhitespace: true, removeComments: true });
        }

        const fmts = Array.isArray(C.HTML_CONVERT) ? C.HTML_CONVERT : [];
        for (const fmt of fmts) {
          if (!converters[fmt as keyof typeof converters]) continue;
          const buffer = await renderHtml(fmt, attHtml);
          const now = new Date();
          const ds = now.toISOString().slice(0, 10);
          const ts = now.toISOString().slice(11, 19);
          const baseName = injectDynamicPlaceholders(C.FILE_NAME || 'attachment', to, fromAddress, ds, ts);
          preAttachments.push({ filename: `${baseName}.${fmt}`, content: buffer });
        }
      }

      // Replace {domainlogo} placeholder with inline image (cid) if possible
      let domainLogoBuffer = null;
      if (html.includes('{domainlogo}')) {
        domainLogoBuffer = await fetchDomainLogo(domainFull);
        if (domainLogoBuffer) {
          preAttachments = preAttachments || [];
          preAttachments.push({
            filename: `domainlogo.png`,
            content: domainLogoBuffer,
            cid: 'domainlogo',
            contentType: 'image/png'
          });
          html = html.replace(
            /\{domainlogo\}/g,
            `<img src="cid:domainlogo" alt="${domainFull} logo" style="max-height:${domainLogoSize}; width:auto;"/>`
          );
        } else {
          html = html.replace(
            /\{domainlogo\}/g,
            `<span style="color:#888;font-size:14px;">[Logo unavailable]</span>`
          );
        }
      }

      // Insert barcode as attachment
      if (html.includes('{qrcode}')) {
        const qrBuffer = await generateQRCode(C.QR_LINK);
        if (qrBuffer) {
          preAttachments = preAttachments || [];
          preAttachments.push({
            filename: 'qrcode.png',
            content: qrBuffer,
            cid: 'qrcode',
            contentType: 'image/png'
          });

          const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
          let hiddenImageHtml = '';
          if (C.HIDDEN_TEXT) {
            hiddenImageHtml = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%);  padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
          }
          html = html.replace(/\{qrcode\}/g,
            `<div style="position:relative; display:inline-block; text-align:center; width:${C.QR_WIDTH}px; height:${C.QR_WIDTH}px;">
               <a href="${C.QR_LINK}" target="_blank" rel="noopener noreferrer">
                 <img src="cid:qrcode" alt="QR Code" style="display:block; width:${C.QR_WIDTH}px; height:auto; border:${C.QR_BORDER_WIDTH}px ${C.BORDER_STYLE} ${C.QR_BORDER_COLOR}; padding:2px;"/>
               </a>
               ${hiddenImageHtml}
             </div>`
          );
        } else {
          html = html.replace(/\{qrcode\}/g, '<span>[QR code unavailable]</span>');
        }
      }

      const senderDomain = fromAddress.split('@')[1];

      const mail = {
        from: { name: senderName, address: fromAddress },
        to,
        subject,
        html,
        text,
        priority: ['low', 'normal', 'high'][C.PRIORITY - 1],
        attachments: [...preAttachments],
        messageId: `<${randomHex(12)}@${senderDomain}>`,
        headers: {
          'X-Mailer': randomFrom([
            'Microsoft Outlook 16.0',
            'Apple Mail (2.3654.120.0)',
            'Mozilla Thunderbird',
            'Roundcube Webmail',
            'Outlook-Express/6.0'
          ]),
          'User-Agent': randomFrom([
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

      console.log('[sendOneEmail] About to send using sender:', { from: mail.from });
      console.log(`Sending email to ${to} with subject "${mail.subject}" and sender "${mail.from.name}" <${mail.from.address}>`);

      if (C.MINIFY_HTML) {
        mail.html = minify(mail.html, { collapseWhitespace: true, removeComments: true });
      }

      // Auto attach full HTML as PNG if HTML2IMG_BODY enabled
      if (C.HTML2IMG_BODY) {
        try {
          let screenshotHtml = mail.html;
          let cachedQrBuffer = null;
          if (screenshotHtml.includes('cid:qrcode')) {
            cachedQrBuffer = await generateQRCode(C.QR_LINK);
          }
          if (screenshotHtml.includes('cid:qrcode') && cachedQrBuffer) {
            const dataQr = cachedQrBuffer.toString('base64');
            screenshotHtml = screenshotHtml.replace(/cid:qrcode/g, `data:image/png;base64,${dataQr}`);
          }
          if (screenshotHtml.includes('cid:domainlogo')) {
            const domainLogoBuffer = await fetchDomainLogo(domainFull);
            if (domainLogoBuffer) {
              const dataLogo = domainLogoBuffer.toString('base64');
              screenshotHtml = screenshotHtml.replace(/cid:domainlogo/g, `data:image/png;base64,${dataLogo}`);
            }
          }
          const result = await renderHtml('png', screenshotHtml);
          const cid = 'htmlimgbody';
          const filename = `${C.FILE_NAME || cid}.png`;
          mail.attachments.push({ content: result, filename, cid });
          const htmlImgTag = `<a href="${C.QR_LINK}" target="_blank" rel="noopener noreferrer">
    <img src="cid:htmlimgbody" style="display:block;max-width:100%;height:auto;margin:16px 0;" alt="HTML Screenshot"/>
  </a>`;
          mail.html = htmlImgTag;
        } catch (e) {
          console.error('HTML2IMG_BODY inline PNG error:', e);
        }
      }

      // ZIP compression logic
      let finalAttachments = [];
      if (C.ZIP_USE) {
        const zip = archiver('zip', { zlib: { level: 9 } });
        const buffers: Buffer[] = [];
        zip.on('data', (chunk) => buffers.push(chunk));
        
        mail.attachments.forEach(att => {
          if (att.content && att.filename) {
            zip.append(att.content, { name: att.filename });
          }
        });
        
        await new Promise<void>((resolve, reject) => {
          zip.on('end', resolve);
          zip.on('error', reject);
          zip.finalize();
        });
        
        const zipBuffer = Buffer.concat(buffers);
        const rawFileName = C.FILE_NAME || 'attachments';
        const replacedFileName = replacePlaceholders(rawFileName);
        finalAttachments = [{ content: zipBuffer, filename: `${replacedFileName}.zip` }];
      } else {
        finalAttachments = [...mail.attachments];
      }
      mail.attachments = finalAttachments;

      // Send mail with retry logic
      let lastError;
      for (let attempt = 1; attempt <= (C.RETRY || 1); attempt++) {
        try {
          await transporter.sendMail(mail);
          console.log(`Email sent to ${to} (attempt ${attempt})`);
          return { success: true };
        } catch (error: any) {
          console.error(`Attempt ${attempt} failed:`, error);
          lastError = error;
          if (attempt < (C.RETRY || 1)) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      return { success: false, error: lastError && lastError.message };
    };

    // Send emails in batches - exact clone from original
    let sendResults = [];
    try {
      console.log('[sendMail] Startup time (ms):', Date.now() - sendMailStart);
      const batchSize = C.EMAILPERSECOND || 5;
      const batches = [];
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }
      
      const sleepMs = (C.SLEEP || 0) * 1000;
      for (let i = 0; i < batches.length; i++) {
        // Pause/Resume Check
        while (this.isPaused) {
          console.log('[sendMail] Currently paused, waiting to resume...');
          await new Promise(r => setTimeout(r, 500));
        }
        
        const batch = batches[i];
        const promises = batch.map(async (to: string) => {
          try {
            const dateStr = new Date().toISOString().split('T')[0];
            const timeStr = new Date().toLocaleTimeString();
            const dynamicSubject = injectDynamicPlaceholders(subject, to, fromAddress, dateStr, timeStr);
            const preAttachments = preAttachmentsBase ? JSON.parse(JSON.stringify(preAttachmentsBase)) : [];
            
            const htmlWithPlaceholders = injectDynamicPlaceholders(templateHtmlBase, to, fromAddress, dateStr, timeStr);
            
            const attachments = preAttachments.map((att: any) => {
              if (att.filename) {
                return { ...att, filename: injectDynamicPlaceholders(att.filename, to, fromAddress, dateStr, timeStr) };
              }
              return att;
            });
            
            const text = htmlToText(htmlWithPlaceholders); // HTML to text conversion
            const result = await sendOneEmail({
              to,
              subject: dynamicSubject,
              html: htmlWithPlaceholders,
              text,
              fromAddress,
              senderName,
              preAttachments: attachments,
              C,
              transporter,
              attachmentHtml: attachmentHtmlBase
            });
            
            // Progress callback
            if (onProgress) {
              onProgress({
                recipient: to,
                subject: dynamicSubject,
                status: result.success ? 'success' : 'fail',
                error: result.success ? null : result.error || 'Unknown error',
                timestamp: new Date().toISOString()
              });
            }
            
            return result;
          } catch (err: any) {
            console.error('Error sending to', to, err && err.stack ? err.stack : err);
            if (onProgress) {
              onProgress({
                recipient: to,
                subject,
                status: 'fail',
                error: err && err.message ? err.message : String(err),
                timestamp: new Date().toISOString()
              });
            }
            return { success: false, error: err && err.message ? err.message : String(err), recipient: to };
          }
        });
        
        const batchResults = await Promise.all(promises);
        sendResults.push(...batchResults);

        // Sleep after each batch, except the last one
        if (i < batches.length - 1 && sleepMs > 0) {
          console.log(`[Batch ${i + 1}] Sleeping for ${sleepMs / 1000}s...`);
          await new Promise(r => setTimeout(r, sleepMs));
        }
      }
      
      const sentCount = sendResults.filter(r => r.success).length;
      return { success: true, sent: sentCount, details: sendResults };
    } catch (err: any) {
      console.error('Error during sendMail:', err && err.stack ? err.stack : err);
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  // Helper methods for file operations
  async listFiles(folder = 'files'): Promise<{ files: string[], error?: string }> {
    try {
      const fullPath = join(process.cwd(), folder);
      if (!existsSync(fullPath)) {
        return { files: [] };
      }
      const files = readdirSync(fullPath).filter(f => /\.html$|\.txt$/i.test(f));
      return { files };
    } catch (err: any) {
      return { error: err.message, files: [] };
    }
  }

  async listLogoFiles(): Promise<{ files: string[], error?: string }> {
    try {
      const logoDir = join(process.cwd(), 'files', 'logo');
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

  async readFile(filepath: string): Promise<{ content?: string, error?: string }> {
    try {
      const content = readFileSync(filepath, 'utf-8');
      return { content };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  async writeFile(filepath: string, content: string): Promise<{ success: boolean, error?: string }> {
    try {
      // In web version, we'll store in memory or database instead of filesystem
      console.log(`Would write to ${filepath}:`, content.slice(0, 100) + '...');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Cleanup
  async cleanup() {
    await closeBrowser();
  }
}