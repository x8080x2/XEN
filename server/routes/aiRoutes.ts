
import type { Express } from "express";
import { aiService } from "../services/aiService";

export function setupAIRoutes(app: Express) {
  // Initialize AI with API key
  app.post("/api/ai/initialize", (req, res) => {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
    }

    const success = aiService.initialize(apiKey);
    res.json({ success, message: success ? 'AI initialized' : 'Initialization failed' });
  });

  // Deinitialize AI
  app.post("/api/ai/deinitialize", (req, res) => {
    const success = aiService.deinitialize();
    res.json({ success, message: 'AI deinitialized' });
  });

  // Get AI status
  app.get("/api/ai/status", (req, res) => {
    const status = aiService.getStatus();
    res.json(status);
  });

  // Test AI generation
  app.post("/api/ai/test", async (req, res) => {
    const { type, context } = req.body;

    if (!aiService.isInitialized()) {
      return res.status(400).json({ success: false, error: 'AI not initialized' });
    }

    try {
      let result;
      if (type === 'subject') {
        result = await aiService.generateSubject(context);
      } else if (type === 'senderName') {
        result = await aiService.generateSenderName(context);
      } else {
        return res.status(400).json({ success: false, error: 'Invalid type' });
      }

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
