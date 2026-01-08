# RDP Tunnel Client for Port 25 SMTP

This client creates a secure WebSocket tunnel from your RDP/server to the Replit backend, allowing emails to be sent via your server's port 25 SMTP.

## Why This is Needed

Replit's infrastructure blocks outbound connections to port 25 (standard SMTP). This tunnel client:
1. Connects FROM your RDP TO the Replit server (outbound from RDP is not blocked)
2. Receives email send commands through the tunnel
3. Sends emails locally using port 25 SMTP
4. Reports results back through the tunnel

## Setup

1. Install Node.js on your RDP/server (if not already installed)
   - Download from: https://nodejs.org/

2. Copy this folder to your RDP/server

3. Install dependencies:
   ```bash
   npm install
   ```

4. Edit `config.json`:
   - Set your license key
   - (Optional) Adjust reconnect settings

5. Run the client:
   ```bash
   npm start
   ```

## Configuration

Edit `config.json`:

```json
{
  "serverUrl": "wss://xen-1-cls8080.replit.app/ws/tunnel",
  "licenseKey": "YOUR_LICENSE_KEY_HERE",
  "reconnectInterval": 5000,
  "pingInterval": 25000
}
```

- `serverUrl` - WebSocket URL to the Replit tunnel server
- `licenseKey` - Your license key from the desktop app
- `reconnectInterval` - Initial delay between reconnect attempts (ms)
- `pingInterval` - How often to ping the server to keep connection alive (ms)

## Running as a Service (Windows)

To keep the tunnel running in the background:

1. Install pm2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start with pm2:
   ```bash
   pm2 start tunnel-client.js --name "email-tunnel"
   ```

3. Save the process list:
   ```bash
   pm2 save
   ```

4. Set up auto-start on boot:
   ```bash
   pm2 startup
   ```

## Troubleshooting

### Connection keeps dropping
- Check your firewall allows outbound WebSocket connections
- Ensure your license key is valid

### Emails not sending
- Verify your SMTP server is accessible on port 25
- Check if authentication is required for your SMTP server
- Look at the client logs for specific error messages

### License key issues
- Make sure you're using the same license key as in the desktop app
- Only one tunnel connection per license key is allowed
