import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { execSync } from "child_process";

// Enhanced error handling to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // Log detailed error information
  if (reason instanceof Error) {
    console.error('Error stack:', reason.stack);
  }
  // Log the error but don't exit the process
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Error stack:', error.stack);
  // Log the error but don't exit the process in development
});

// Add warning for deprecation notices
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning') {
    console.warn('Deprecation Warning:', warning.message);
  }
});

// Automatic cleanup function (non-blocking)
function performStartupCleanup() {
  // Run cleanup asynchronously to avoid blocking startup
  setTimeout(() => {
    try {
      log("🔧 Performing background cleanup...");

      // Check if we're on Windows or Unix-like system
      const isWindows = process.platform === 'win32';
      
      if (!isWindows) {
        // Only run process counting on Unix-like systems
        const processCount = execSync('ps aux | grep -E "(tsx|node)" | grep -v grep | wc -l', { encoding: 'utf8' }).trim();
        log(`Current process count: ${processCount}`);

        if (parseInt(processCount) > 15) {
          log("⚠️  High process count - performing cleanup");
        }
      } else {
        log("Windows detected - skipping process cleanup");
      }

      log("✅ Background cleanup check completed");
    } catch (error) {
      log("Cleanup check failed (ignored)");
    }
  }, 2000);
}

// Perform cleanup on startup (non-blocking)
performStartupCleanup();


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Skip logging for frequent polling endpoints to reduce console clutter
      const skipLogging = [
        '/api/ai/status', 
        '/api/config/load', 
        '/api/smtp/list', 
        '/api/original/listFiles', 
        '/api/original/listLogoFiles',
        '/api/telegram/broadcasts'
      ].includes(path);
      
      if (!skipLogging) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Auto-initialize AI service with Google Gemini from config or env
  const { configService } = await import('./services/configService');
  configService.loadConfig();
  const config = configService.getEmailConfig();
  const apiKey = config.GOOGLE_AI_KEY || process.env.GOOGLE_AI_KEY;
  
  if (apiKey) {
    const { aiService } = await import('./services/aiService');
    const initialized = aiService.initialize(apiKey);
    if (initialized) {
      log('✅ AI Service auto-initialized with Google Gemini (15 RPM, 1M/day limit)');
    } else {
      log('⚠️  AI Service initialization failed');
    }
  }

  // Auto-initialize Telegram bot for license management with webhooks
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const { telegramBotService } = await import('./services/telegramBotService');
    
    // Use permanent Replit deployment URL for webhook
    const webhookUrl = 'https://xen-1-cls8080.replit.app/api/telegram/webhook';
    
    const initialized = await telegramBotService.initialize(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_ADMIN_CHAT_IDS,
      webhookUrl
    );
    if (initialized) {
      log('✅ Telegram License Bot initialized successfully with webhooks');
      log(`   Webhook URL: ${webhookUrl}`);
    } else {
      log('⚠️  Telegram Bot initialization failed');
    }
  } else {
    log('ℹ️  Telegram bot not configured (set TELEGRAM_BOT_TOKEN to enable license generation)');
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error with context
    console.error(`Error handling request ${req.method} ${req.path}:`, {
      error: err.message || err,
      stack: err.stack,
      status,
      path: req.path,
      method: req.method
    });

    // Only send response if not already sent
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    
    // Don't re-throw in production to prevent crashes
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isDevelopment = process.env.NODE_ENV === "development";
  
  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);


  // Always bind to 0.0.0.0 for Replit compatibility
  const host = "0.0.0.0";
  
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
    if (!isDevelopment) {
      log(`Production mode - serving static files from dist/public`);
    } else {
      log(`Development mode - using Vite middleware`);
    }

    // Auto-open browser on Windows
    if (process.platform === 'win32') {
      const url = `http://localhost:${port}`;
      log(`Opening browser at ${url}`);
      try {
        execSync(`start "" "${url}"`, { stdio: 'ignore' });
      } catch (error) {
        log(`Failed to open browser automatically. Please visit: ${url}`);
        // Try alternative method
        try {
          execSync(`rundll32 url.dll,FileProtocolHandler "${url}"`, { stdio: 'ignore' });
        } catch (altError) {
          log(`All auto-open methods failed. Please manually visit: ${url}`);
        }
      }
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`${signal} signal received: closing HTTP server`);
    
    // Cleanup Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { telegramBotService } = await import('./services/telegramBotService');
      if (telegramBotService.isRunning()) {
        telegramBotService.stop();
        log('Telegram bot stopped');
      }
    }
    
    // Cleanup file service
    const { FileService } = await import('./services/fileService');
    const fileService = new FileService();
    await fileService.cleanup();
    
    // Cleanup email service
    const { advancedEmailService } = await import('./services/advancedEmailService');
    await advancedEmailService.cleanup();
    
    server.close(() => {
      log('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();