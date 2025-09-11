import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { execSync } from "child_process";
import { ProcessManager } from "./services/processManager";
import { initializeMainLicenseService } from "./services/mainLicenseService";

// Start Telegram Bot
async function startTelegramBot() {
  try {
    log("🤖 Starting Telegram License Bot...");
    const { disabled, start } = await import("../telegram-bot.js");
    
    if (disabled) {
      log("⚠️  Telegram bot is disabled (missing environment variables)");
      return;
    }
    
    start();
    log("✅ Telegram bot initialized");
  } catch (error) {
    log(`⚠️  Telegram bot failed to start: ${error}`);
    log("✅ Server will continue without Telegram bot functionality");
  }
}

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
      
      // Count processes first
      const processCount = execSync('ps aux | grep -E "(tsx|node)" | grep -v grep | wc -l', { encoding: 'utf8' }).trim();
      log(`Current process count: ${processCount}`);
      
      // Only cleanup if high process count
      if (parseInt(processCount) > 15) {
        log("⚠️  High process count - performing cleanup");
        // Note: Don't kill current process, just log for now
      }
      
      log("✅ Background cleanup check completed");
    } catch (error) {
      // Ignore cleanup errors to avoid blocking startup
    }
  }, 2000);
}

// Perform cleanup on startup (non-blocking)
performStartupCleanup();

// Initialize license service
try {
  const licenseConfig = {
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-key',
    mainBackendUrl: process.env.MAIN_BACKEND_URL || 'https://email-sender-main.onrender.com',
    apiKey: process.env.MAIN_BACKEND_API_KEY || 'default-api-key',
    clientVersion: process.env.CLIENT_VERSION || '1.0.0',
  };
  
  initializeMainLicenseService(licenseConfig);
  log("🔐 License service initialized");
} catch (error: any) {
  log(`⚠️  License service initialization failed: ${error.message}`);
}

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
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Initialize process manager for automatic cleanup
  const processManager = ProcessManager.getInstance();
  processManager.startPeriodicCleanup();
  processManager.setupGracefulShutdown();
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log(`🔧 Automatic process cleanup enabled`);
  });
  
  // Start Telegram Bot alongside the server
  startTelegramBot();
})();
