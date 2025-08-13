import type { Express } from "express";
import { AnalyticsService } from "../services/analyticsService";
import { PlaceholderValidator } from "../services/placeholderValidator";
import { SMTPPoolManager } from "../services/smtpPoolManager";
import { BounceManager } from "../services/bounceManager";
import { ReputationMonitor } from "../services/reputationMonitor";

export function setupAnalyticsRoutes(app: Express) {
  // Placeholder validation and syntax highlighting
  app.post("/api/placeholder/validate", async (req, res) => {
    try {
      const { content, recipient } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const validation = PlaceholderValidator.validateContent(content, recipient);
      const highlighted = PlaceholderValidator.highlightSyntax(content);
      const preview = recipient ? PlaceholderValidator.generatePreview(content, recipient) : null;

      res.json({
        validation,
        highlighted,
        preview,
        placeholders: PlaceholderValidator.getAllPlaceholders()
      });
    } catch (error) {
      console.error("Error validating placeholders:", error);
      res.status(500).json({ error: "Failed to validate placeholders" });
    }
  });

  // Get all available placeholders
  app.get("/api/placeholder/list", (req, res) => {
    try {
      const placeholders = PlaceholderValidator.getAllPlaceholders();
      const byCategory = {
        user: PlaceholderValidator.getPlaceholdersByCategory('user'),
        random: PlaceholderValidator.getPlaceholdersByCategory('random'),
        dynamic: PlaceholderValidator.getPlaceholdersByCategory('dynamic'),
        advanced: PlaceholderValidator.getPlaceholdersByCategory('advanced')
      };

      res.json({
        all: placeholders,
        byCategory
      });
    } catch (error) {
      console.error("Error getting placeholders:", error);
      res.status(500).json({ error: "Failed to get placeholders" });
    }
  });

  // Campaign analytics
  app.get("/api/analytics/campaign/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const analytics = await AnalyticsService.getCampaignAnalytics(jobId);
      
      if (!analytics) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json(analytics);
    } catch (error) {
      console.error("Error getting campaign analytics:", error);
      res.status(500).json({ error: "Failed to get campaign analytics" });
    }
  });

  // All campaigns analytics
  app.get("/api/analytics/campaigns", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const analytics = await AnalyticsService.getAllCampaignsAnalytics(limit);
      
      res.json(analytics);
    } catch (error) {
      console.error("Error getting campaigns analytics:", error);
      res.status(500).json({ error: "Failed to get campaigns analytics" });
    }
  });

  // Real-time performance metrics
  app.get("/api/analytics/performance", (req, res) => {
    try {
      const minutes = parseInt(req.query.minutes as string) || 30;
      const performance = AnalyticsService.getRealtimePerformance(minutes);
      
      res.json(performance);
    } catch (error) {
      console.error("Error getting performance metrics:", error);
      res.status(500).json({ error: "Failed to get performance metrics" });
    }
  });

  // SMTP Pool Management
  app.get("/api/smtp/status", (req, res) => {
    try {
      const poolManager = SMTPPoolManager.getInstance();
      const status = poolManager.getSMTPStatus();
      const stats = poolManager.getPoolStats();
      
      res.json({ status, stats });
    } catch (error) {
      console.error("Error getting SMTP status:", error);
      res.status(500).json({ error: "Failed to get SMTP status" });
    }
  });

  app.post("/api/smtp/enable/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const poolManager = SMTPPoolManager.getInstance();
      await poolManager.enableSMTP(id);
      
      res.json({ success: true, message: `SMTP ${id} enabled` });
    } catch (error) {
      console.error("Error enabling SMTP:", error);
      res.status(500).json({ error: "Failed to enable SMTP" });
    }
  });

  app.post("/api/smtp/disable/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const poolManager = SMTPPoolManager.getInstance();
      await poolManager.disableSMTP(id);
      
      res.json({ success: true, message: `SMTP ${id} disabled` });
    } catch (error) {
      console.error("Error disabling SMTP:", error);
      res.status(500).json({ error: "Failed to disable SMTP" });
    }
  });

  // Bounce Management
  app.get("/api/bounce/stats", (req, res) => {
    try {
      const stats = BounceManager.getBounceStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error getting bounce statistics:", error);
      res.status(500).json({ error: "Failed to get bounce statistics" });
    }
  });

  app.get("/api/bounce/list", (req, res) => {
    try {
      const bounces = BounceManager.getAllBounces();
      res.json(bounces);
    } catch (error) {
      console.error("Error getting bounce list:", error);
      res.status(500).json({ error: "Failed to get bounce list" });
    }
  });

  app.post("/api/bounce/clean", (req, res) => {
    try {
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ error: "Emails array is required" });
      }

      const result = BounceManager.cleanEmailList(emails);
      res.json(result);
    } catch (error) {
      console.error("Error cleaning email list:", error);
      res.status(500).json({ error: "Failed to clean email list" });
    }
  });

  app.post("/api/bounce/reactivate/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const success = await BounceManager.reactivateEmail(email);
      
      if (success) {
        res.json({ success: true, message: `Email ${email} reactivated` });
      } else {
        res.status(400).json({ error: "Cannot reactivate this email" });
      }
    } catch (error) {
      console.error("Error reactivating email:", error);
      res.status(500).json({ error: "Failed to reactivate email" });
    }
  });

  app.get("/api/bounce/export", (req, res) => {
    try {
      const csv = BounceManager.exportBounceList();
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bounce-list.csv');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting bounce list:", error);
      res.status(500).json({ error: "Failed to export bounce list" });
    }
  });

  // Reputation Monitoring
  app.get("/api/reputation/domains", (req, res) => {
    try {
      const reputations = ReputationMonitor.getAllDomainReputations();
      res.json(reputations);
    } catch (error) {
      console.error("Error getting domain reputations:", error);
      res.status(500).json({ error: "Failed to get domain reputations" });
    }
  });

  app.get("/api/reputation/domain/:domain", (req, res) => {
    try {
      const { domain } = req.params;
      const reputation = ReputationMonitor.getDomainReputation(domain);
      const warmup = ReputationMonitor.getWarmupStatus(domain);
      
      if (!reputation) {
        return res.status(404).json({ error: "Domain not found" });
      }

      res.json({ reputation, warmup });
    } catch (error) {
      console.error("Error getting domain reputation:", error);
      res.status(500).json({ error: "Failed to get domain reputation" });
    }
  });

  app.post("/api/reputation/warmup/:domain/start", async (req, res) => {
    try {
      const { domain } = req.params;
      await ReputationMonitor.startWarmup(domain);
      
      res.json({ success: true, message: `Warmup started for ${domain}` });
    } catch (error) {
      console.error("Error starting warmup:", error);
      res.status(500).json({ error: "Failed to start warmup" });
    }
  });

  app.post("/api/reputation/warmup/:domain/pause", async (req, res) => {
    try {
      const { domain } = req.params;
      await ReputationMonitor.pauseWarmup(domain);
      
      res.json({ success: true, message: `Warmup paused for ${domain}` });
    } catch (error) {
      console.error("Error pausing warmup:", error);
      res.status(500).json({ error: "Failed to pause warmup" });
    }
  });

  app.post("/api/reputation/warmup/:domain/reset", async (req, res) => {
    try {
      const { domain } = req.params;
      await ReputationMonitor.resetWarmup(domain);
      
      res.json({ success: true, message: `Warmup reset for ${domain}` });
    } catch (error) {
      console.error("Error resetting warmup:", error);
      res.status(500).json({ error: "Failed to reset warmup" });
    }
  });

  app.get("/api/reputation/report", (req, res) => {
    try {
      const report = ReputationMonitor.generateReputationReport();
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=reputation-report.txt');
      res.send(report);
    } catch (error) {
      console.error("Error generating reputation report:", error);
      res.status(500).json({ error: "Failed to generate reputation report" });
    }
  });
}