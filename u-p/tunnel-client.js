const WebSocket = require('ws');
const nodemailer = require('nodemailer');
const { EventEmitter } = require('events');

class TunnelClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ws = null;
    this.licenseKey = options.licenseKey || process.env.LICENSE_KEY;
    this.serverUrl = options.serverUrl || process.env.REPLIT_SERVER_URL;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 100;
    this.pingIntervalMs = 25000;
    this.reconnectIntervalMs = 5000;
    this.enabled = true;
  }

  getWebSocketUrl() {
    if (!this.serverUrl) return null;
    
    let wsUrl = this.serverUrl
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://');
    
    if (!wsUrl.endsWith('/')) {
      wsUrl += '/';
    }
    wsUrl += 'ws/tunnel';
    
    return wsUrl;
  }

  connect() {
    if (!this.licenseKey) {
      console.log('[Tunnel] No license key available - tunnel disabled');
      this.emit('status', { connected: false, reason: 'no_license' });
      return;
    }

    if (!this.serverUrl) {
      console.log('[Tunnel] No server URL available - tunnel disabled');
      this.emit('status', { connected: false, reason: 'no_server_url' });
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[Tunnel] Already connected or connecting');
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    console.log(`[Tunnel] Connecting to ${wsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('[Tunnel] Connected! Sending authentication...');
        this.reconnectAttempts = 0;
        
        this.ws.send(JSON.stringify({
          type: 'auth',
          licenseKey: this.licenseKey
        }));
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[Tunnel] Disconnected (code: ${code}, reason: ${reason})`);
        this.isConnected = false;
        this.emit('status', { connected: false, reason: 'disconnected' });
        this.cleanup();
        if (this.enabled) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        console.error('[Tunnel] Connection error:', error.message);
        this.emit('error', error);
      });

      this.ws.on('pong', () => {
        // Server responded to ping - connection is alive
      });

    } catch (error) {
      console.error('[Tunnel] Failed to connect:', error.message);
      this.emit('error', error);
      if (this.enabled) {
        this.scheduleReconnect();
      }
    }
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'auth_success':
          console.log('[Tunnel] Authentication successful! Ready for port 25 SMTP.');
          this.isConnected = true;
          this.emit('status', { connected: true, tunnelId: message.tunnelId });
          this.startPing();
          break;

        case 'send_email':
          this.handleSendEmail(message);
          break;

        case 'pong':
          break;

        case 'status_response':
          console.log('[Tunnel] Status:', message);
          break;

        default:
          console.log('[Tunnel] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Tunnel] Failed to parse message:', error.message);
    }
  }

  async handleSendEmail(request) {
    const { requestId, payload } = request;
    const { smtpConfig, mailOptions } = payload;

    console.log(`[Tunnel Email] Request ${requestId.substring(0, 8)}... - Sending to: ${mailOptions.to}`);

    try {
      const transporterConfig = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        ignoreTLS: smtpConfig.port === 25,
        requireTLS: false,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        tls: {
          rejectUnauthorized: false
        }
      };

      if (smtpConfig.user && smtpConfig.pass) {
        transporterConfig.auth = {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        };
      }

      const transporter = nodemailer.createTransport(transporterConfig);
      const result = await transporter.sendMail(mailOptions);

      console.log(`[Tunnel Email] Success - MessageID: ${result.messageId}`);

      this.sendResponse({
        requestId,
        type: 'send_email_result',
        success: true,
        messageId: result.messageId
      });

      transporter.close();

    } catch (error) {
      console.error(`[Tunnel Email] Failed: ${error.message}`);

      this.sendResponse({
        requestId,
        type: 'send_email_result',
        success: false,
        error: error.message
      });
    }
  }

  sendResponse(response) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    } else {
      console.error('[Tunnel] Cannot send response - not connected');
    }
  }

  startPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.pingIntervalMs);
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('[Tunnel] Max reconnect attempts reached.');
      this.emit('status', { connected: false, reason: 'max_attempts' });
      return;
    }

    const delay = Math.min(
      this.reconnectIntervalMs * Math.pow(1.5, this.reconnectAttempts - 1),
      60000
    );

    console.log(`[Tunnel] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      hasLicenseKey: !!this.licenseKey,
      hasServerUrl: !!this.serverUrl,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  disconnect() {
    console.log('[Tunnel] Disconnecting...');
    this.enabled = false;
    this.cleanup();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client shutdown');
      this.ws = null;
    }

    this.isConnected = false;
    this.emit('status', { connected: false, reason: 'shutdown' });
  }

  reconnect() {
    this.enabled = true;
    this.reconnectAttempts = 0;
    this.connect();
  }
}

module.exports = { TunnelClient };
