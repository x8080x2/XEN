
import type { Express } from "express";
import QRCode from "qrcode";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { join, basename } from "path";
import { configService } from "../services/configService";

export function setupTestRoutes(app: Express) {
  // QR overlay test endpoint
  app.post("/api/test/qr-overlay", async (req, res) => {
    try {
      const {
        qrContent = "https://example.com",
        qrSize = 200,
        qrBorder = 2,
        qrForegroundColor = "#000000",
        qrBackgroundColor = "#FFFFFF",
        qrBorderColor = "#000000",
        borderStyle = "solid",
        hiddenImageFile = "",
        hiddenImageSize = 50,
        hiddenText = "",
        showOverlay = true
      } = req.body;

      console.log('[QR Test] Generating QR with overlay settings:', {
        qrSize, qrBorder, qrForegroundColor, qrBackgroundColor,
        hiddenImageFile, hiddenImageSize, hiddenText, showOverlay
      });

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: qrSize,
        margin: 4,
        errorCorrectionLevel: 'H' as any,
        color: {
          dark: qrForegroundColor,
          light: qrBackgroundColor
        }
      });

      let overlayHtml = '';
      
      if (showOverlay) {
        // Load hidden image from files/logo directory
        const logoDir = join('files', 'logo');
        let imgBase64 = null;
        let hasHiddenImage = false;

        if (hiddenImageFile && typeof hiddenImageFile === 'string' && hiddenImageFile.trim() !== '' && hiddenImageFile !== 'none') {
          try {
            const candidatePath = join(logoDir, hiddenImageFile);
            if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
              const imgBuf = readFileSync(candidatePath);
              imgBase64 = imgBuf.toString('base64');
              hasHiddenImage = true;
              console.log(`[QR Test] Loaded hidden image: ${candidatePath}`);
            }
          } catch (e) {
            console.warn('[QR Test] Could not read hidden image:', e);
          }
        }

        // Generate overlay HTML
        if (hasHiddenImage && imgBase64) {
          // Use exact same positioning as main application
          overlayHtml = `<img src="data:image/png;base64,${imgBase64}" style="position:absolute; z-index:10; top:77px; left:56%; transform:translateX(-50%); width:${hiddenImageSize}px; height:auto;"/>`;
          console.log(`[QR Test] Generated image overlay (size: ${hiddenImageSize}px)`);
        } else if (hiddenText && hiddenText.trim() !== '') {
          // Use exact same text overlay positioning
          overlayHtml = `<span style="position:absolute; z-index:10; top:50px; left:50%; transform:translateX(-50%); padding:2px 4px; font-size:32px; color:red;">${hiddenText}</span>`;
          console.log(`[QR Test] Generated text overlay: ${hiddenText}`);
        }
      }

      // Generate complete QR HTML with overlay
      const qrHtml = `
        <div style="position:relative; display:inline-block; text-align:center; width:${qrSize}px; height:${qrSize}px; margin:10px auto;">
          <a href="${qrContent}" target="_blank" rel="noopener noreferrer">
            <img src="${qrDataUrl}" alt="QR Code" style="display:block; width:${qrSize}px; height:auto; border:${qrBorder}px ${borderStyle} ${qrBorderColor}; padding:2px;"/>
          </a>
          ${overlayHtml}
        </div>
      `;

      // Create a complete HTML page for testing
      const testPageHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Overlay Test</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: #f5f5f5; 
            }
            .test-container { 
              background: white; 
              padding: 20px; 
              border-radius: 8px; 
              max-width: 600px; 
              margin: 0 auto; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .settings { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 5px; 
              margin-bottom: 20px; 
              font-size: 14px;
            }
            .qr-preview { 
              text-align: center; 
              background: white; 
              padding: 20px; 
              border: 1px solid #ddd; 
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="test-container">
            <h1>🔍 QR Code Overlay Test</h1>
            
            <div class="settings">
              <h3>Current Settings:</h3>
              <ul>
                <li><strong>QR Content:</strong> ${qrContent}</li>
                <li><strong>QR Size:</strong> ${qrSize}px</li>
                <li><strong>QR Border:</strong> ${qrBorder}px ${borderStyle} ${qrBorderColor}</li>
                <li><strong>QR Colors:</strong> Foreground: ${qrForegroundColor}, Background: ${qrBackgroundColor}</li>
                <li><strong>Hidden Image:</strong> ${hiddenImageFile || 'None'}</li>
                <li><strong>Hidden Image Size:</strong> ${hiddenImageSize}px</li>
                <li><strong>Hidden Text:</strong> ${hiddenText || 'None'}</li>
                <li><strong>Overlay Enabled:</strong> ${showOverlay ? 'Yes' : 'No'}</li>
              </ul>
            </div>

            <div class="qr-preview">
              <h3>QR Code Preview:</h3>
              ${qrHtml}
              <p style="margin-top: 20px; color: #666; font-size: 12px;">
                Click the QR code to test the link. The overlay should appear centered on the QR code.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      res.json({
        success: true,
        qrHtml,
        testPageHtml,
        settings: {
          qrContent, qrSize, qrBorder, qrForegroundColor, qrBackgroundColor,
          qrBorderColor, borderStyle, hiddenImageFile, hiddenImageSize,
          hiddenText, showOverlay, overlayApplied: overlayHtml.length > 0
        }
      });

    } catch (error: any) {
      console.error('[QR Test] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate QR test'
      });
    }
  });

  // List available logo files for testing
  app.get("/api/test/logo-files", async (req, res) => {
    try {
      const logoDir = join('files', 'logo');
      if (!existsSync(logoDir)) {
        return res.json({ files: [] });
      }
      
      const files = readdirSync(logoDir).filter(f => {
        const full = join(logoDir, f);
        return statSync(full).isFile();
      });
      
      res.json({ files });
    } catch (err: any) {
      res.json({ files: [], error: err.message });
    }
  });

  // Get current config for testing
  app.get("/api/test/config", async (req, res) => {
    try {
      const configData = configService.loadConfig();
      const emailConfig = configService.getEmailConfig();
      
      res.json({
        success: true,
        config: {


  // Test email sending endpoint - sends only to safe test addresses
  app.post("/api/test/send-email", async (req, res) => {
    try {
      const { subject, htmlContent, testType = "basic" } = req.body;
      
      // Safe test recipients only
      const testRecipients = [
        "juliastina1203842@icloud.com", // Your own email
        "jaco@smei.co.za" // Test email from leads
      ];

      console.log('[Test Email] Starting test email send');

      // Load configuration
      const config = configService.getEmailConfig();
      
      if (!config.SMTP) {
        return res.status(400).json({ 
          success: false, 
          error: "SMTP configuration not found in config files" 
        });
      }

      // Prepare test email arguments
      const args = {
        senderEmail: config.SMTP.fromEmail,
        senderName: config.SMTP.fromName || "Test Sender",
        subject: subject || "Test Email from Your Email System",
        html: htmlContent || `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Test Email Successful</h2>
            <p>This is a test email from your email system.</p>
            <p><strong>Test Type:</strong> ${testType}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p>If you receive this email, your email system is working correctly!</p>
            {qrcode}
            {domainlogo}
          </div>
        `,
        recipients: testRecipients,
        smtpHost: config.SMTP.host,
        smtpPort: config.SMTP.port,
        smtpUser: config.SMTP.user,
        smtpPass: config.SMTP.pass,
        // Test settings
        qrcode: testType === "qr" || testType === "full",
        qrLink: "https://example.com/test?email={email}",
        linkPlaceholder: "{email}",
        randomMetadata: testType === "full",
        htmlImgBody: testType === "html2img" || testType === "full",
        htmlConvert: testType === "convert" || testType === "full" ? "pdf,png" : "",
        zipUse: false,
        calendarMode: testType === "calendar",
        emailPerSecond: 2,
        sleep: 1,
        retry: 1
      };

      let progress = [];
      const result = await advancedEmailService.sendMail(args, (progressUpdate) => {
        progress.push(progressUpdate);
        console.log('[Test Email Progress]', progressUpdate);
      });

      res.json({
        success: result.success,
        message: result.success 
          ? `Test email sent successfully to ${testRecipients.length} recipients`
          : `Test email failed: ${result.error}`,
        result,
        progress,
        testRecipients,
        testType
      });

    } catch (error) {
      console.error('[Test Email] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

          QR_WIDTH: emailConfig.QR_WIDTH || 200,
          QR_BORDER_WIDTH: emailConfig.QR_BORDER_WIDTH || 2,
          QR_BORDER_COLOR: emailConfig.QR_BORDER_COLOR || '#000000',
          QR_FOREGROUND_COLOR: emailConfig.QR_FOREGROUND_COLOR || '#000000',
          QR_BACKGROUND_COLOR: emailConfig.QR_BACKGROUND_COLOR || '#FFFFFF',
          BORDER_STYLE: emailConfig.BORDER_STYLE || 'solid',
          BORDER_COLOR: emailConfig.BORDER_COLOR || '#000000',
          HIDDEN_IMAGE_FILE: emailConfig.HIDDEN_IMAGE_FILE || '',
          HIDDEN_IMAGE_SIZE: emailConfig.HIDDEN_IMAGE_SIZE || 50,
          HIDDEN_TEXT: emailConfig.HIDDEN_TEXT || ''
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}
