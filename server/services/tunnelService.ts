import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import crypto from 'crypto';

// Helper to generate tunnel ID from license key
function generateTunnelId(licenseKey: string): string {
  return crypto.createHash('sha256').update(licenseKey).digest('hex').substring(0, 16);
}

interface TunnelClient {
  ws: WebSocket;
  licenseKey: string;
  tunnelId: string; // First 16 chars of SHA256(licenseKey) for secure routing
  connectedAt: Date;
  lastPing: Date;
  pendingRequests: Map<string, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>;
}

interface EmailSendRequest {
  requestId: string;
  type: 'send_email';
  payload: {
    smtpConfig: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
      secure: boolean;
    };
    mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
      attachments?: any[];
      headers?: Record<string, string>;
    };
  };
}

interface EmailSendResponse {
  requestId: string;
  type: 'send_email_result';
  success: boolean;
  messageId?: string;
  error?: string;
}

class TunnelService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, TunnelClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private REQUEST_TIMEOUT = 60000; // 60 seconds for email send

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/tunnel'
    });

    console.log('[Tunnel] WebSocket server initialized on /ws/tunnel');

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('[Tunnel] New connection attempt');
      
      // Wait for authentication message
      const authTimeout = setTimeout(() => {
        console.log('[Tunnel] Auth timeout - closing connection');
        ws.close(4001, 'Authentication timeout');
      }, 10000);

      ws.once('message', (data) => {
        clearTimeout(authTimeout);
        
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type !== 'auth' || !message.licenseKey) {
            console.log('[Tunnel] Invalid auth message');
            ws.close(4002, 'Invalid authentication');
            return;
          }

          const licenseKey = message.licenseKey;
          
          // Check if this license already has an active tunnel
          if (this.clients.has(licenseKey)) {
            const existingClient = this.clients.get(licenseKey)!;
            console.log(`[Tunnel] Replacing existing connection for license ${licenseKey.substring(0, 8)}...`);
            existingClient.ws.close(4003, 'Replaced by new connection');
            this.clients.delete(licenseKey);
          }

          // Generate tunnel ID for secure routing
          const tunnelId = generateTunnelId(licenseKey);

          // Register the new client
          const client: TunnelClient = {
            ws,
            licenseKey,
            tunnelId,
            connectedAt: new Date(),
            lastPing: new Date(),
            pendingRequests: new Map()
          };
          
          this.clients.set(licenseKey, client);
          console.log(`[Tunnel] ✅ Client authenticated: ${licenseKey.substring(0, 8)}... tunnelId: ${tunnelId} (Total: ${this.clients.size})`);

          // Send auth success with tunnelId so client knows its routing identifier
          ws.send(JSON.stringify({ type: 'auth_success', message: 'Connected to tunnel server', tunnelId }));

          // Handle subsequent messages
          ws.on('message', (data) => this.handleMessage(licenseKey, data.toString()));
          
          ws.on('close', (code, reason) => {
            console.log(`[Tunnel] Client disconnected: ${licenseKey.substring(0, 8)}... (code: ${code})`);
            
            // Only clean up if the map still points to THIS client instance
            // (handles race condition when new connection replaces old one before close fires)
            const currentClient = this.clients.get(licenseKey);
            if (currentClient === client) {
              // Immediately reject all pending requests instead of waiting for timeout
              if (client.pendingRequests.size > 0) {
                console.log(`[Tunnel] Rejecting ${client.pendingRequests.size} pending requests for disconnected client`);
                client.pendingRequests.forEach((pending, requestId) => {
                  clearTimeout(pending.timeout);
                  pending.reject(new Error('Tunnel connection lost - RDP client disconnected. Please reconnect and retry.'));
                });
                client.pendingRequests.clear();
              }
              this.clients.delete(licenseKey);
            } else {
              // Old socket closed but new connection already replaced it - just log, don't touch new client
              console.log(`[Tunnel] Stale socket closed for ${licenseKey.substring(0, 8)}... (replaced by new connection)`);
              // Still reject pending requests on the old client object if any
              if (client.pendingRequests.size > 0) {
                console.log(`[Tunnel] Rejecting ${client.pendingRequests.size} pending requests from stale connection`);
                client.pendingRequests.forEach((pending) => {
                  clearTimeout(pending.timeout);
                  pending.reject(new Error('Tunnel connection replaced - using new connection'));
                });
                client.pendingRequests.clear();
              }
            }
          });

          ws.on('error', (error) => {
            console.error(`[Tunnel] Client error: ${licenseKey.substring(0, 8)}...`, error.message);
          });

          ws.on('pong', () => {
            client.lastPing = new Date();
          });

        } catch (error) {
          console.error('[Tunnel] Auth parse error:', error);
          ws.close(4002, 'Invalid authentication');
        }
      });
    });

    // Start ping interval to keep connections alive and clean up stale ones
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, licenseKey) => {
        // Check for stale connections (no pong in 60 seconds)
        if (now - client.lastPing.getTime() > 60000) {
          console.log(`[Tunnel] Cleaning up stale connection: ${licenseKey.substring(0, 8)}...`);
          client.ws.terminate();
          this.clients.delete(licenseKey);
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000);

    console.log('[Tunnel] Service ready - waiting for RDP clients');
  }

  private handleMessage(licenseKey: string, data: string): void {
    const client = this.clients.get(licenseKey);
    if (!client) return;

    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'send_email_result':
          this.handleEmailResult(client, message as EmailSendResponse);
          break;

        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'status':
          client.ws.send(JSON.stringify({ 
            type: 'status_response',
            connected: true,
            uptime: Date.now() - client.connectedAt.getTime()
          }));
          break;

        default:
          console.log(`[Tunnel] Unknown message type from ${licenseKey.substring(0, 8)}...:`, message.type);
      }
    } catch (error) {
      console.error(`[Tunnel] Message parse error from ${licenseKey.substring(0, 8)}...:`, error);
    }
  }

  private handleEmailResult(client: TunnelClient, response: EmailSendResponse): void {
    const pending = client.pendingRequests.get(response.requestId);
    if (!pending) {
      console.log(`[Tunnel] Received result for unknown request: ${response.requestId}`);
      return;
    }

    clearTimeout(pending.timeout);
    client.pendingRequests.delete(response.requestId);

    if (response.success) {
      pending.resolve({ messageId: response.messageId });
    } else {
      pending.reject(new Error(response.error || 'Unknown tunnel error'));
    }
  }

  isClientConnected(licenseKey: string): boolean {
    const client = this.clients.get(licenseKey);
    return client !== undefined && client.ws.readyState === WebSocket.OPEN;
  }

  getClientStatus(licenseKey: string): { connected: boolean; connectedAt?: Date; uptime?: number } {
    const client = this.clients.get(licenseKey);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return { connected: false };
    }
    return {
      connected: true,
      connectedAt: client.connectedAt,
      uptime: Date.now() - client.connectedAt.getTime()
    };
  }

  getAllConnectedClients(): string[] {
    return Array.from(this.clients.keys()).filter(key => 
      this.clients.get(key)?.ws.readyState === WebSocket.OPEN
    );
  }

  // Find client by tunnel ID (hash of license key)
  findClientByTunnelId(tunnelId: string): TunnelClient | null {
    for (const client of this.clients.values()) {
      if (client.tunnelId === tunnelId && client.ws.readyState === WebSocket.OPEN) {
        return client;
      }
    }
    return null;
  }

  // Check if tunnel is connected by tunnel ID
  isTunnelConnectedById(tunnelId: string): boolean {
    return this.findClientByTunnelId(tunnelId) !== null;
  }

  // Get tunnel status by tunnel ID
  getTunnelStatusById(tunnelId: string): { connected: boolean; connectedAt?: Date; uptime?: number } {
    const client = this.findClientByTunnelId(tunnelId);
    if (!client) {
      return { connected: false };
    }
    return {
      connected: true,
      connectedAt: client.connectedAt,
      uptime: Date.now() - client.connectedAt.getTime()
    };
  }

  // Send email via tunnel using tunnel ID (preferred, more secure)
  async sendEmailViaTunnelById(
    tunnelId: string,
    smtpConfig: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
      secure: boolean;
    },
    mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
      attachments?: any[];
      headers?: Record<string, string>;
    }
  ): Promise<{ messageId: string }> {
    const client = this.findClientByTunnelId(tunnelId);
    
    if (!client) {
      throw new Error(`Tunnel not connected for tunnelId ${tunnelId} - RDP client must be running`);
    }

    return this.sendEmailViaClient(client, smtpConfig, mailOptions);
  }

  async sendEmailViaTunnel(
    licenseKey: string,
    smtpConfig: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
      secure: boolean;
    },
    mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
      attachments?: any[];
      headers?: Record<string, string>;
    }
  ): Promise<{ messageId: string }> {
    const client = this.clients.get(licenseKey);
    
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Tunnel not connected for license ${licenseKey.substring(0, 8)}... - RDP client must be running`);
    }

    return this.sendEmailViaClient(client, smtpConfig, mailOptions);
  }

  private async sendEmailViaClient(
    client: TunnelClient,
    smtpConfig: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
      secure: boolean;
    },
    mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
      attachments?: any[];
      headers?: Record<string, string>;
    }
  ): Promise<{ messageId: string }> {
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Tunnel client not connected');
    }

    const requestId = crypto.randomUUID();

    // Serialize attachments for JSON transport - convert Buffers to base64
    const serializedMailOptions = {
      ...mailOptions,
      attachments: mailOptions.attachments?.map(att => {
        if (att.content && Buffer.isBuffer(att.content)) {
          return {
            ...att,
            content: att.content.toString('base64'),
            encoding: 'base64'
          };
        }
        return att;
      })
    };

    const request: EmailSendRequest = {
      requestId,
      type: 'send_email',
      payload: {
        smtpConfig,
        mailOptions: serializedMailOptions
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.pendingRequests.delete(requestId);
        reject(new Error('Tunnel email send timeout (60s)'));
      }, this.REQUEST_TIMEOUT);

      client.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        client.ws.send(JSON.stringify(request));
        console.log(`[Tunnel] Sent email request ${requestId.substring(0, 8)}... to tunnel ${client.tunnelId}`);
      } catch (error) {
        clearTimeout(timeout);
        client.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.clients.forEach((client, licenseKey) => {
      client.pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Tunnel service shutting down'));
      });
      client.ws.close(1001, 'Server shutting down');
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[Tunnel] Service cleaned up');
  }
}

export const tunnelService = new TunnelService();
