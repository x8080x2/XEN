import { execSync } from "child_process";

export class ProcessManager {
  private static instance: ProcessManager;
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  startPeriodicCleanup() {
    // Clean up every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 10 * 60 * 1000);

    console.log("🔧 Periodic process cleanup started (every 10 minutes)");
  }

  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("🛑 Periodic cleanup stopped");
    }
  }

  async performCleanup(): Promise<void> {
    try {
      console.log("🔧 Performing periodic cleanup...");
      
      // Count current processes
      const beforeCount = this.getProcessCount();
      
      if (beforeCount > 15) {
        console.log(`⚠️  High process count detected: ${beforeCount}`);
        
        // Kill zombie tsx processes (except current)
        const currentPid = process.pid;
        try {
          const psOutput = execSync('ps aux | grep "tsx server/index.ts" | grep -v grep', { encoding: 'utf8' });
          const lines = psOutput.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[1]);
            
            // Don't kill current process
            if (pid && pid !== currentPid) {
              try {
                process.kill(pid, 'SIGTERM');
                console.log(`Terminated zombie process: ${pid}`);
              } catch (e) {
                // Process might already be dead
              }
            }
          }
        } catch (e) {
          // No zombie processes found
        }

        // Wait and recount
        setTimeout(() => {
          const afterCount = this.getProcessCount();
          console.log(`Cleanup result: ${beforeCount} → ${afterCount} processes`);
        }, 2000);
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }

  private getProcessCount(): number {
    try {
      const count = execSync('ps aux | grep -E "(tsx|node)" | grep -v grep | wc -l', { encoding: 'utf8' }).trim();
      return parseInt(count);
    } catch {
      return 0;
    }
  }

  // Graceful shutdown cleanup
  setupGracefulShutdown() {
    const cleanup = () => {
      console.log("🛑 Shutting down gracefully...");
      this.stopPeriodicCleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
      this.stopPeriodicCleanup();
    });
  }
}