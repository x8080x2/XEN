// ─── Dynamic Placeholder Arrays and Helper ──────────────────────────────
const randFirstNames = ['Daniel', 'Sophia', 'Liam', 'Ava', 'Ethan', 'Olivia', 'Noah', 'Emma'];
const randLastNames = ['Nguyen', 'Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Williams', 'Davis'];
const randCompanies = ['Vertex Dynamics', 'Blue Ocean Ltd', 'Nexora Corp', 'Lumos Global', 'Skybridge Systems'];
const randDomains = ['neoatlas.io', 'quantify.dev', 'mailflux.net', 'zenbyte.org', 'dataspike.com'];
const randTitles = ['Account Manager', 'Product Lead', 'CTO', 'Sales Director', 'HR Coordinator'];

function pickRand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function injectDynamicPlaceholders(text, user, email, dateStr, timeStr) {
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
// Random helper for array and hex
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomHex(len) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}
// Replace placeholders like {randnumN} and {hashN} in strings
function replacePlaceholders(str) {
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
const crypto = require('crypto');
const axios = require('axios');
const { app, BrowserWindow, ipcMain } = require('electron');
// Disable hardware acceleration to suppress GPU warnings
app.disableHardwareAcceleration();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const puppeteer = require('puppeteer');
const os = require('os');
const pLimit = require('p-limit').default;
const QRCode = require('qrcode');
const { minify } = require('html-minifier');
const AdmZip = require('adm-zip');
const htmlDocx = require('html-docx-js');

/**
 * Standalone HTML-to-DOCX conversion helper.
 * @param {string} html — HTML content to convert.
 * @returns {Buffer} DOCX buffer.
 */
function htmlToDocxStandalone(html) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('Cannot convert empty HTML to DOCX');
  }
  return htmlDocx.asBuffer(html);
}

// Build QR options the same way everywhere (no color options)
function buildQrOpts(C) {
  return {
    width: C.QR_WIDTH,
    margin: 4,
    errorCorrectionLevel: 'H'
  };
}

// Decode HTML entities like &#9919; back to characters
function decodeHtmlEntities(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}



let browserInstance = null;
// let pdfPage = null;

let cachedConfig = null;
let configMTime = 0;


// INI parser matching frontend and Notes (strips inline comments)
// SETTINGS_FIELDS map for UI settings synchronization
function parseIniWithSections(data) {
  const lines = data.split(/\r?\n/);
  const result = {};
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      current = line.slice(1, -1);
      result[current] = {}

      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1);
    const value = rawValue.split(/[#;]/)[0].trim();
    if (current) result[current][key] = value;
    else result[key] = value;
  }
  return result;
}

function cast(val) {
  const v = val.trim();
  if (/^[01]$/.test(v)) return v === '1';
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
  return v.replace(/^['"]|['"]$/g, '');
}

// Helper to interpret boolean config flags
function isTrue(value) {
  return value === true || value === '1' || value === 1 || value === 'true';
}

function loadConfig() {
  const setupPath = path.join(app.getAppPath(), 'config', 'setup.ini');
  try {
    const stat = fs.statSync(setupPath);
    if (cachedConfig && configMTime === stat.mtimeMs) {
      return { C: cachedConfig };
    }
    const setupRaw  = fs.readFileSync(setupPath, 'utf-8');
    const setupIni  = parseIniWithSections(setupRaw);
    const C = setupIni.CONFIG || {};
    Object.keys(C).forEach(k => C[k] = cast(C[k]));

    C.PRIORITY = [1,2,3].includes(C.PRIORITY) ? C.PRIORITY : 1;
    C.SLEEP = (typeof C.SLEEP === 'number' && C.SLEEP > 0) ? C.SLEEP : 3;
    C.EMAILPERSECOND = (typeof C.EMAILPERSECOND === 'number' && C.EMAILPERSECOND > 0) ? C.EMAILPERSECOND : 5;
    C.RETRY = (typeof C.RETRY === 'number' && C.RETRY >= 0) ? C.RETRY : 0;
    C.FILE_NAME = C.FILE_NAME || '';
    C.HTML_CONVERT = typeof C.HTML_CONVERT === 'string'
      ? C.HTML_CONVERT.split(',').map(s => s.trim().toLowerCase())
      : [];
    C.HTML2IMG_BODY = isTrue(C.HTML2IMG_BODY);
    C.ZIP_USE = isTrue(C.ZIP_USE);
    C.ZIP_PASSWORD = C.ZIP_PASSWORD || '';
    C.INCLUDE_HTML_ATTACHMENT = isTrue(C.INCLUDE_HTML_ATTACHMENT);
    C.QRCODE = isTrue(C.QRCODE);
    C.QR_WIDTH = (typeof C.QR_WIDTH === 'number' && C.QR_WIDTH > 0) ? C.QR_WIDTH : 200;
    C.QR_LINK = C.QR_LINK || 'https://fb.com';
    C.RANDOM_METADATA = isTrue(C.RANDOM_METADATA);
    const proxy = setupIni.PROXY || {};
    proxy.PROXY_USE = isTrue(proxy.PROXY_USE) ? 1 : 0;
    proxy.TYPE = proxy.TYPE || 'socks5';
    proxy.HOST = proxy.HOST || '';
    proxy.PORT = proxy.PORT || '';
    proxy.USER = proxy.USER || '';
    proxy.PASS = proxy.PASS || '';
    C.PROXY = proxy;
    C.MINIFY_HTML = isTrue(C.MINIFY_HTML);
    C.HIDDEN_TEXT = C.HIDDEN_TEXT || '';
    C.DOMAIN_LOGO_SIZE = C.DOMAIN_LOGO_SIZE || '50%';
    // Safe defaults for QR border style/color
    C.BORDER_STYLE = C.BORDER_STYLE || 'solid';
    C.BORDER_COLOR = C.BORDER_COLOR || '#000000';

    cachedConfig = C;
    configMTime = stat.mtimeMs;
    return { C };
  } catch (err) {
    console.error('Failed to load config:', err && err.message ? err.message : err);
    cachedConfig = null;
    configMTime = 0;
    return { C: {} };
  }
}


function createWindow() {
  const win = new BrowserWindow({
    title: 'V6 Sender',
    width: 900,
    height: 900,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile('sender.html');
}

// Clean up old Puppeteer profiles in the OS temp directory
async function cleanOldPuppeteerProfiles() {
  const tempDir = os.tmpdir();
  const prefix = 'puppeteer_dev_chrome_profile-';
  const now = Date.now();
  const cutoff = now - 2 * 60 * 60 * 1000; // 2 hours in ms
  let deleted = 0;
  try {
    const files = await fs.promises.readdir(tempDir);
    for (const file of files) {
      if (file.startsWith(prefix)) {
        const fullPath = path.join(tempDir, file);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory() && stat.mtimeMs < cutoff) {
            await fs.promises.rm(fullPath, { recursive: true, force: true });
            console.log(`[Puppeteer Cleanup] Deleted old profile: ${fullPath}`);
            deleted++;
          }
        } catch (err) {
          console.warn(`[Puppeteer Cleanup] Error processing ${fullPath}:`, err && err.message ? err.message : err);
        }
      }
    }
    if (deleted > 0) {
      console.log(`[Puppeteer Cleanup] Deleted ${deleted} old puppeteer_dev_chrome_profile-* folders from ${tempDir}`);
    }
  } catch (err) {
    console.warn('[Puppeteer Cleanup] Error during Puppeteer profile cleanup:', err && err.message ? err.message : err);
  }
}

app.whenReady().then(async () => {
  // Clean up old Puppeteer profiles before anything else
  try {
    await cleanOldPuppeteerProfiles();
  } catch (err) {
    console.warn('[Puppeteer Cleanup] Uncaught error:', err && err.message ? err.message : err);
  }
  // Add handlers for readFile/writeFile first (needed for early UI)
  ipcMain.handle('readFile', async (event, filepath) => {
    try {
      const fullPath = path.resolve(__dirname, filepath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('writeFile', async (event, filepath, content) => {
    try {
      const fullPath = path.resolve(__dirname, filepath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });


  // Load config and set up all variables that depend on config
  const { C } = loadConfig();
  // Debug: Log loaded QR config
  console.log('Loaded QR Config:', {
    RANDOM_METADATA: C.RANDOM_METADATA
  });

  // Ensure only missing letter default; other defaults come from loadConfig()
  C.LETTER = C.LETTER || 'letter.html';




  // Puppeteer launch and helpers
  // Puppeteer launch with proxy support
  async function launchBrowser() {
    if (!browserInstance) {
      const launchOptions = { headless: true };
      if (C.PROXY && C.PROXY.PROXY_USE === 1) {
        const proxyHost = C.PROXY.HOST || '';
        const proxyPort = C.PROXY.PORT || '';
        if (proxyHost && proxyPort) {
          const scheme = (C.PROXY && C.PROXY.TYPE ? String(C.PROXY.TYPE).toLowerCase() : 'socks5');
          launchOptions.args = [`--proxy-server=${scheme}://${proxyHost}:${proxyPort}`];
        }
      }
      browserInstance = await puppeteer.launch(launchOptions);
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



  // Improved HTML to PDF with concurrency control, no global pdfPage reuse

  let limit = pLimit(C.EMAILPERSECOND || 5);

  async function convertHtmlToPdf(html) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for PDF conversion');
    }
    const browser = await launchBrowser();

    return limit(async () => {
      const page = await browser.newPage();
      try {
        await page.setRequestInterception(true);
        page.on('request', req => {
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


  // Convert HTML to Image (PNG) using Puppeteer with concurrency control, returns Buffer directly
  async function convertHtmlToImage(html) {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid HTML input for Image conversion');
    }
    return limit(async () => {
      console.log(`[convertHtmlToImage] Queue pending: ${limit.pendingCount}, active: ${limit.activeCount}`);
      const browser = await launchBrowser();
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1123, height: 1587 });
        await page.setCacheEnabled(true);
        await page.setContent(html, { waitUntil: 'networkidle2' });
        const pngBuffer = await page.screenshot({ fullPage: true });
        await page.close();
        console.log(`[convertHtmlToImage] Finished image generation, queue pending: ${limit.pendingCount}, active: ${limit.activeCount}`);
        return pngBuffer;
      } catch (e) {
        await page.close();
        console.error('Image generation failed:', e);
        throw e;
      }
    });
  }


 

  // Converter functions registry
  const converters = {
    pdf: convertHtmlToPdf,
    png: convertHtmlToImage,
    docx: htmlToDocxStandalone
  };

  // Unified HTML rendering helper
  async function renderHtml(format, html) {
    const fn = converters[format];
    if (!fn) throw new Error('Unsupported render format: ' + format);
    return await fn(html);
  }



  createWindow();

 
  ipcMain.handle('listFiles', async (event, folder = 'files') => {
  try {
    const abs = path.join(app.getAppPath(), folder);
    const files = fs.readdirSync(abs).filter(f => /\.html$|\.txt$/i.test(f));
    return { files };
  } catch (err) {
    return { error: err.message, files: [] };
  }
});


  // IPC handler to list files in files/logo directory
  ipcMain.handle('listLogoFiles', async () => {
    try {
      const logoDir = path.join(app.getAppPath(), 'files', 'logo');
      if (!fs.existsSync(logoDir)) return { files: [] };
      const files = fs.readdirSync(logoDir).filter(f => {
        const full = path.join(logoDir, f);
        return fs.statSync(full).isFile();
      });
      return { files };
    } catch (err) {
      return { files: [], error: err.message };
    }
  });

 

  // ─── Pause/Resume Global State ───────────────────────────────
  let isPaused = false;
  // Listen for pause/resume events from renderer
  ipcMain.on('pause-send', () => {
    console.log('[sendMail] Paused by user');
    isPaused = true;
  });
  ipcMain.on('resume-send', () => {
    console.log('[sendMail] Resumed by user');
    isPaused = false;
  });

  // Email sending with batching, retries, attachments
  ipcMain.handle('sendMail', async (event, args = {}) => {
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
    // Remove QR_FOREGROUND_COLOR and QR_BACKGROUND_COLOR assignment from UI args
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
      C.HTML_CONVERT = args.htmlConvert.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
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
      : Array.from(new Set(
          fs.readFileSync(path.join(app.getAppPath(), 'files', 'leads.txt'), 'utf-8')
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean)
        ));

    // Load email body HTML from bodyHtmlFile, fallback to default letter or args.html
    let bodyHtml;
    if (args.bodyHtmlFile && typeof args.bodyHtmlFile === "string" && args.bodyHtmlFile.trim() !== "") {
      const bodyHtmlPath = path.join(app.getAppPath(), 'files', args.bodyHtmlFile);
      bodyHtml = fs.readFileSync(bodyHtmlPath, 'utf-8');
    } else if (args.html && typeof args.html === "string") {
      bodyHtml = args.html;
    } else {
      const letterRoot = path.join(app.getAppPath(), C.LETTER);
      const letterPath = fs.existsSync(letterRoot)
        ? letterRoot
        : path.join(app.getAppPath(), 'files', C.LETTER);
      bodyHtml = fs.readFileSync(letterPath, 'utf-8');
    }

    // Prefer raw HTML passed in args.attachmentHtml; fall back to file-based template or bodyHtml
    let attachmentHtml = (typeof args.attachmentHtml === 'string' && args.attachmentHtml.trim())
      ? args.attachmentHtml
      : bodyHtml;

    if (!attachmentHtml && args.attachmentHtmlFile && typeof args.attachmentHtmlFile === "string" && args.attachmentHtmlFile.trim()) {
      // Load attachment HTML from specified file if no raw HTML provided
      let attachHtmlPath = null;
      const tryPaths = [
        path.join(app.getAppPath(), args.attachmentHtmlFile),
        path.join(app.getAppPath(), 'files', args.attachmentHtmlFile),
        path.join(app.getAppPath(), 'temp', args.attachmentHtmlFile)
      ];
      for (const p of tryPaths) {
        if (fs.existsSync(p)) { attachHtmlPath = p; break; }
      }
      if (attachHtmlPath) {
        attachmentHtml = fs.readFileSync(attachHtmlPath, 'utf-8');
        if (C.MINIFY_HTML) {
          attachmentHtml = minify(attachmentHtml, { collapseWhitespace: true, removeComments: true });
        }
      }
    }


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
    limit = pLimit(C.EMAILPERSECOND || 5);

    // Use processedBodyHtml as the email html body from now on
    // Only use processedBodyHtml for email body, and processedAttachmentHtml for per-recipient attachments
    const templateHtmlBase = processedBodyHtml;
    const attachmentHtmlBase = processedAttachmentHtml;

    // Compose attachments array from UI attachments only (PDF/PNG/DOCX now generated per-recipient)
    // UI attachments (non-html)
    let preAttachmentsBase = [];
    if (Array.isArray(args.attachments) && args.attachments.length) {
      for (const filePath of args.attachments) {
        if (filePath && !filePath.match(/\.(html?|HTML?)$/)) {
          preAttachmentsBase.push({ path: filePath, filename: path.basename(filePath) });
        }
      }
    }

    let subject = (typeof args.subject === 'string' && args.subject.trim() !== '')
      ? args.subject.trim()
      : 'No Subject';

    // Improved getTransporter: validation and enhanced logging, always reload smtp.ini
    function getTransporter() {
      const smtpIniPath = path.join(app.getAppPath(), 'config', 'smtp.ini');
      if (!fs.existsSync(smtpIniPath)) {
        throw new Error('SMTP config file not found: ' + smtpIniPath);
      }
      const smtpRaw = fs.readFileSync(smtpIniPath, 'utf-8');
      const smtpIni = parseIniWithSections(smtpRaw);
      const section = smtpIni.smtp0 || smtpIni[Object.keys(smtpIni)[0]];
      if (!section) throw new Error('No SMTP section in config/smtp.ini');
      const host = section.host;
      const port = Number(section.port) || 587;
      const user = section.user;
      const pass = section.pass;
      const fromEmail = section.fromEmail;
      const fromName = section.fromName || section.fromDisplayName || '';

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
      // Log the sender email and name that will be used
      console.log('[SMTP] Will use sender:', { fromEmail, fromName });
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
      transporter.defaultFrom = fromEmail;
      return { transporter, fromEmail, fromName };
    }

    const { transporter, fromEmail, fromName } = getTransporter();
    // Log again for double-confirmation
    console.log('[sendMail] Using sender:', { fromEmail, fromName });
    let senderNameRaw = (typeof args.senderName === 'string' && args.senderName.trim())
      ? args.senderName.trim()
      : fromName;
    const senderName = replacePlaceholders(senderNameRaw);
    const fromAddress = fromEmail;
    const senderEmail = fromAddress;






    // New: sendOneEmail helper with robust logic
    async function sendOneEmail({to, subject, html, text, fromAddress, senderName, preAttachments, C, transporter, attachmentHtml}) {
      // Helper: fetch domain logo as buffer
      async function fetchDomainLogo(domain) {
        const logoUrl = `https://logo.clearbit.com/${domain}`;
        try {
          const response = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 1200 });
          if (response.status === 200 && response.data) {
            return Buffer.from(response.data);
          }
        } catch (err) {
          console.error('Error fetching domain logo:', err && err.message ? err.message : err);
        }
        return null;
      }

      // QR code generator helper
      async function generateQRCode(link) {
        try {
          const qrOpts = buildQrOpts(C);
          // Generate base QR code buffer
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
      function doRecipientPlaceholders(str) {
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
        out = out.replace(/\{mename3\}/g, username.slice(0,3));
        // {email}
        out = out.replace(/\{email\}/g, email);
        // {emailb64}
        out = out.replace(/\{emailb64\}/g, Buffer.from(email).toString('base64'));
        // {xemail}
        out = out.replace(/\{xemail\}/g, username.charAt(0) + '***@' + domainFull);
        // {randomname}
        const names = ['John Smith','Jane Doe','Alex Johnson','Chris Lee','Pat Morgan','Kim Davis','Sam Carter'];
        out = out.replace(/\{randomname\}/g, () => names[Math.floor(Math.random()*names.length)]);
        // {randcharN}
        out = out.replace(/\{randchar(\d+)\}/g, (_, n) => [...Array(Number(n))].map(()=>Math.random().toString(36).charAt(2)).join(''));
        // {randomnumN}
        out = out.replace(/\{randomnum(\d+)\}/g, (_, n) => [...Array(Number(n))].map(()=>Math.floor(Math.random()*10)).join(''));
        // Add {link} replacement
        out = out.replace(/\{link\}/g, C.QR_LINK || '');
        return out;
      }

      html = doRecipientPlaceholders(html);

      // Per-recipient HTML attachment generation (replaces global pre-generation)
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
          // Load hidden image locally for attachment rendering
          let attImgBuf = null;
          try {
            if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string') {
              const logoDirAtt = path.join(app.getAppPath(), 'files', 'logo');
              const candidatePathAtt = path.join(logoDirAtt, C.HIDDEN_IMAGE_FILE);
              if (fs.existsSync(candidatePathAtt) && fs.statSync(candidatePathAtt).isFile()) {
                attImgBuf = fs.readFileSync(candidatePathAtt);
              }
            }
          } catch (e) {
            // ignore
          }
          const hasAttHiddenImage = Boolean(attImgBuf && attImgBuf.length);
          if (hasAttHiddenImage) {
            const base64Img = attImgBuf.toString('base64');
            hiddenOverlay = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:70px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto;"/>`;
          } else if (C.HIDDEN_TEXT) {
            hiddenOverlay = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${C.HIDDEN_TEXT}</span>`;
          }
          // Prepare QR content and render to Data URL
          const qrOpts = buildQrOpts(C);
          let qrContent = C.QR_LINK;
          if (C.RANDOM_METADATA) {
            const rand = crypto.randomBytes(4).toString('hex');
            qrContent += (qrContent.includes('?') ? '&' : '?') + `_${rand}`;
          }
          const qrDataUrl = await QRCode.toDataURL(qrContent, qrOpts);
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
          if (!converters[fmt]) continue;
          const buffer = await renderHtml(fmt, attHtml);
          const now = new Date();
          const ds = now.toISOString().slice(0,10);
          const ts = now.toISOString().slice(11,19);
          const baseName = injectDynamicPlaceholders(C.FILE_NAME || 'attachment', to, fromAddress, ds, ts);
          preAttachments.push({ filename: `${baseName}.${fmt}`, content: buffer });
        }
      }

      // Replace {domainlogo} placeholder with inline image (cid) if possible, else fallback to text
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

      // Only use hidden QR image overlay if HIDDEN_IMAGE_FILE is set
      const logoDir = path.join(app.getAppPath(), 'files', 'logo');
      let hiddenImagePath = '';
      let imgBuf = null;
      try {
        if (C.HIDDEN_IMAGE_FILE && typeof C.HIDDEN_IMAGE_FILE === 'string') {
          const candidatePath = path.join(logoDir, C.HIDDEN_IMAGE_FILE);
          if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
            hiddenImagePath = candidatePath;
            imgBuf = fs.readFileSync(hiddenImagePath);
          }
        }
      } catch (e) {
        console.warn('Could not read hidden QR image:', e && e.message ? e.message : e);
      }
      const hasHiddenImage = Boolean(imgBuf && imgBuf.length);
      if (hasHiddenImage) {
        preAttachments = preAttachments || [];
        preAttachments.push({
          filename: path.basename(hiddenImagePath),
          content: imgBuf,
          cid: 'hiddenImage',
          contentType: 'image/png'
        });
        console.log('[QR hidden image] Attached:', hiddenImagePath);
      }

      // Insert barcode as attachment (no overlay/middle image)
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

          // Find hidden image buffer if present (already loaded above)
          const hiddenImgWidth = C.HIDDEN_IMAGE_SIZE || 50;
          let hiddenImageHtml = '';
          if (hasHiddenImage) {
            const base64Img = imgBuf.toString('base64');
            hiddenImageHtml = `<img src="data:image/png;base64,${base64Img}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImgWidth}px; height:auto;"/>`;
          } else if (C.HIDDEN_TEXT) {
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

      const senderDomain = senderEmail.split('@')[1];

      const mail = {
        from: { name: senderName, address: fromAddress },
        to,
        subject,
        html,
        text,
        priority: ['low','normal','high'][C.PRIORITY - 1],
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


      // Log actual sender before sending
      console.log('[sendOneEmail] About to send using sender:', { from: mail.from });

      // Log sending attempt
      console.log(`Sending email to ${to} with subject "${mail.subject}" and sender "${mail.from.name}" <${mail.from.address}>`);





      if (C.MINIFY_HTML) {
        mail.html = minify(mail.html, { collapseWhitespace: true, removeComments: true });
      }

      // Preserve original body HTML for body-inline PNG conversion
      const originalBodyHtml = mail.html;
      // Auto attach full HTML as PNG if HTML2IMG_BODY enabled and show only image
      if (C.HTML2IMG_BODY) {
        try {
          let screenshotHtml = originalBodyHtml;
          // (existing logic to inline image data URIs for screenshot as needed...)
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
          // Remove overlay/middleimg logic for screenshotHtml
          const result = await renderHtml('png', screenshotHtml);
          const cid = 'htmlimgbody';
          const filename = `${C.FILE_NAME || cid}.png`;
          mail.attachments.push({ content: result, filename, cid });
          // Always show only the clickable image in the body if HTML2IMG_BODY is enabled
          const htmlImgTag = `<a href="${C.QR_LINK}" target="_blank" rel="noopener noreferrer">
    <img src="cid:htmlimgbody" style="display:block;max-width:100%;height:auto;margin:16px 0;" alt="HTML Screenshot"/>
  </a>`;
          mail.html = htmlImgTag;
        } catch (e) {
          console.error('HTML2IMG_BODY inline PNG error:', e);
        }
      }




      // ZIP_COMPRESS & ZIP_PASSWORD logic for attachments
      let finalAttachments = [];
      if (C.ZIP_USE) {
        const zip = new AdmZip();
        mail.attachments.forEach(att => {
          if (att.content && att.filename) zip.addFile(att.filename, att.content);
        });
        if (C.ZIP_PASSWORD) zip.setPassword(C.ZIP_PASSWORD);
        const rawFileName = C.FILE_NAME || 'attachments';
        const replacedFileName = replacePlaceholders(rawFileName);
        const zipBuffer = zip.toBuffer();
        finalAttachments = [{ content: zipBuffer, filename: `${replacedFileName}.zip` }];
      } else {
        finalAttachments = [...mail.attachments];
      }
      mail.attachments = finalAttachments;

      // Send mail with retry logic for RETRY_ATTEMPTS
      let lastError;
      for (let attempt = 1; attempt <= (C.RETRY || 1); attempt++) {
        try {
          await transporter.sendMail(mail);
          console.log(`Email sent to ${to} (attempt ${attempt})`);
          return { success: true };
        } catch (error) {
          console.error(`Attempt ${attempt} failed:`, error);
          lastError = error;
          if (attempt < (C.RETRY || 1)) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      return { success: false, error: lastError && lastError.message };
    }

    // Send emails in batches, with delay after each batch (not per email)
    let sendResults = [];
    try {
      console.log('[sendMail] Startup time (ms):', Date.now() - sendMailStart);
      // Fix: Declare batchSize before using it
      const batchSize = C.EMAILPERSECOND || 5;
      const batches = [];
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }
      // Derive sleepMs from UI-configured SLEEP value (seconds) times 1000
      const sleepMs = (C.SLEEP || 0) * 1000;
      for (let i = 0; i < batches.length; i++) {
        // ─── Pause/Resume Check ───────────────────────────────
        while (isPaused) {
          console.log('[sendMail] Currently paused, waiting to resume...');
          await new Promise(r => setTimeout(r, 500));
        }
        const batch = batches[i];
        const promises = batch.map(async (to) => {
          try {
            // Move placeholder injection logic here for per-recipient subject
            const dateStr = new Date().toISOString().split('T')[0];
            const timeStr = new Date().toLocaleTimeString();
            const dynamicSubject = injectDynamicPlaceholders(subject, to, fromAddress, dateStr, timeStr);
            const preAttachments = preAttachmentsBase ? JSON.parse(JSON.stringify(preAttachmentsBase)) : [];
            // Inject dynamic placeholders into HTML body
            const htmlWithPlaceholders = injectDynamicPlaceholders(templateHtmlBase, to, fromAddress, dateStr, timeStr);
            // Inject dynamic placeholders into attachment filenames
            const attachments = preAttachments.map(att => {
              if (att.filename) {
                return { ...att, filename: injectDynamicPlaceholders(att.filename, to, fromAddress, dateStr, timeStr) };
              }
              return att;
            });
            const text = htmlToText(htmlWithPlaceholders);
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
            // Emit send-progress event for each email sent (success or fail)
            event.sender.send('send-progress', {
              recipient: to,
              subject: dynamicSubject,
              status: result.success ? 'success' : 'fail',
              error: result.success ? null : result.error || 'Unknown error',
              timestamp: new Date().toISOString()
            });
            return result;
          } catch (err) {
            console.error('Error sending to', to, err && err.stack ? err.stack : err);
            event.sender.send('send-progress', {
              recipient: to,
              subject,
              status: 'fail',
              error: err && err.message ? err.message : String(err),
              timestamp: new Date().toISOString()
            });
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
    } catch (err) {
      console.error('Error during sendMail:', err && err.stack ? err.stack : err);
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  });



}); // End of app.whenReady

// ─── Helper for browser instance shutdown ───────────────────────────────
app.on('will-quit', async () => {
  await closeBrowser();
});

// ─── Cross-platform: Quit or recreate window logic ──────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
