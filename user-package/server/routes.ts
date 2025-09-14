
import type { Express } from "express";
import { createServer, type Server } from "http";
import licenseRoutes from "./routes/licenseRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // License management routes only
  app.use('/api/license', licenseRoutes);

  // Proxy all other API requests to main backend
  app.use('/api/*', async (req, res) => {
    try {
      const axios = require('axios');
      const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;

      if (!MAIN_BACKEND_URL) {
        return res.status(500).json({
          success: false,
          error: 'Backend configuration missing'
        });
      }

      const response = await axios({
        method: req.method,
        url: `${MAIN_BACKEND_URL}${req.originalUrl}`,
        headers: {
          ...req.headers,
          'host': undefined,
        },
        data: req.body,
        timeout: 30000,
      });
      
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error('Proxy error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to connect to main backend',
        details: error.response?.data || error.message,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
