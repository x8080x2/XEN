const WebSocket = require('ws');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class TunnelClient {
  constructor() {
    this.ws = null;
    this.config = this.loadConfig();
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 100;
  }

  loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('[Tunnel] ERROR: config.json not found!');
      console.error('[Tunnel] Please create config.json with your license key.');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.licenseKey || config.licenseKey === 'YOUR_LICENSE_KEY_HERE') {
      console.error('[Tunnel] ERROR: Please set your license key in config.json');
      process.exit(1);
    }

    if (!config.serverUrl) {
      console.error('[Tunnel] ERROR: serverUrl not set in config.json');
      process.exit(1);
    }

    return config;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[Tunnel] Already connected or connecting');
      return;
    }

    console.log(`[Tunnel] Connecting to ${this.config.serverUrl}...`);

    try {
      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.on('open', () => {
        console.log('[Tunnel] Connected! Sending authentication...');
        this.reconnectAttempts = 0;
        
        this.ws.send(JSON.stringify({
          type: 'auth',
          licenseKey: this.config.licenseKey
        }));
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[Tunnel] Disconnected (code: ${code}, reason: ${reason})`);
        this.isConnected = false;
        this.cleanup();
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[Tunnel] Connection error:', error.message);
      });

      this.ws.on('pong', () => {
        // Server responded to ping - connection is alive
      });

    } catch (error) {
      console.error('[Tunnel] Failed to connect:', error.message);
      this.scheduleReconnect();
    }
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'auth_success':
          console.log('[Tunnel] Authentication successful!');
          console.log('[Tunnel] Ready to receive email send commands.');
          this.isConnected = true;
          this.startPing();
          break;

        case 'send_email':
          this.handleSendEmail(message);
          break;

        case 'pong':
          // Server ping response
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

    console.log(`[Email] Request ${requestId.substring(0, 8)}... - Sending to: ${mailOptions.to}`);

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

      console.log(`[Email] Success - MessageID: ${result.messageId}`);

      this.sendResponse({
        requestId,
        type: 'send_email_result',
        success: true,
        messageId: result.messageId
      });

      transporter.close();

    } catch (error) {
      console.error(`[Email] Failed: ${error.message}`);

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
    }, this.config.pingInterval || 25000);
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('[Tunnel] Max reconnect attempts reached. Exiting.');
      process.exit(1);
    }

    const delay = Math.min(
      (this.config.reconnectInterval || 5000) * Math.pow(1.5, this.reconnectAttempts - 1),
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

  shutdown() {
    console.log('[Tunnel] Shutting down...');
    this.cleanup();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close(1000, 'Client shutdown');
    }

    process.exit(0);
  }
}

console.log('='.repeat(50));
console.log('  RDP Tunnel Client for Port 25 SMTP');
console.log('='.repeat(50));
console.log('');

const client = new TunnelClient();

process.on('SIGINT', () => client.shutdown());
process.on('SIGTERM', () => client.shutdown());

client.connect();

console.log('[Tunnel] Client started. Press Ctrl+C to stop.');
