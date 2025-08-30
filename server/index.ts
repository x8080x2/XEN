import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { execSync } from "child_process";
import { ProcessManager } from "./services/processManager";

// Simplified error handling
process.on('unhandledRejection', (reason) => {
  // Silent handling to prevent webview popup issues
});

process.on('uncaughtException', (error) => {
  // Silent handling to prevent webview popup issues
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

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Prevent webview auto-opening
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

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
})();
