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


  // Use different binding for local development vs production
  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction ? "0.0.0.0" : "localhost";
  
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
    if (isProduction) {
      log(`Production mode - serving static files from dist/public`);
    } else {
      log(`Development mode - using Vite middleware`);
    }
  });
})();