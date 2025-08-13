import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { configService } from "./configService";

export interface SMTPConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  priority: number; // 1-10, higher is better
  maxPerHour: number;
  currentHourCount: number;
  lastHourReset: Date;
  enabled: boolean;
  failureCount: number;
  lastFailure?: Date;
  reputation: 'excellent' | 'good' | 'fair' | 'poor' | 'blocked';
}

export interface SendResult {
  success: boolean;
  smtpId: string;
  messageId?: string;
  error?: string;
  responseTime: number;
}

export class SMTPPoolManager {
  private static instance: SMTPPoolManager;
  private transporters: Map<string, Transporter> = new Map();
  private smtpConfigs: Map<string, SMTPConfig> = new Map();
  private roundRobinIndex = 0;

  private constructor() {
    this.loadDefaultSMTPConfig();
    this.startHealthMonitoring();
  }

  public static getInstance(): SMTPPoolManager {
    if (!SMTPPoolManager.instance) {
      SMTPPoolManager.instance = new SMTPPoolManager();
    }
    return SMTPPoolManager.instance;
  }

  private async loadDefaultSMTPConfig() {
    try {
      const config = await configService.loadConfig();
      const smtpConfig = await configService.loadSMTPConfig();
      
      if (smtpConfig.host && smtpConfig.user) {
        const defaultConfig: SMTPConfig = {
          id: 'default',
          name: 'Primary SMTP',
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          user: smtpConfig.user,
          pass: smtpConfig.pass,
          fromEmail: smtpConfig.fromEmail || smtpConfig.user,
          fromName: smtpConfig.fromName || 'Sender',
          priority: 10,
          maxPerHour: 100, // Conservative default
          currentHourCount: 0,
          lastHourReset: new Date(),
          enabled: true,
          failureCount: 0,
          reputation: 'good'
        };
        
        await this.addSMTPConfig(defaultConfig);
        console.log('Loaded default SMTP config into pool');
      }
    } catch (error) {
      console.error('Error loading default SMTP config:', error);
    }
  }

  public async addSMTPConfig(config: SMTPConfig): Promise<void> {
    try {
      // Create transporter
      const transporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass
        },
        pool: true, // Enable connection pooling
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: config.maxPerHour / 60 // Convert per hour to per minute
      });

      // Verify connection
      await transporter.verify();
      
      this.transporters.set(config.id, transporter);
      this.smtpConfigs.set(config.id, config);
      
      console.log(`SMTP config ${config.name} added to pool successfully`);
    } catch (error) {
      console.error(`Failed to add SMTP config ${config.name}:`, error);
      config.enabled = false;
      config.failureCount++;
      config.lastFailure = new Date();
      this.smtpConfigs.set(config.id, config);
    }
  }

  public async removeSMTPConfig(configId: string): Promise<void> {
    const transporter = this.transporters.get(configId);
    if (transporter) {
      transporter.close();
      this.transporters.delete(configId);
    }
    this.smtpConfigs.delete(configId);
    console.log(`SMTP config ${configId} removed from pool`);
  }

  public getAvailableSMTPs(): SMTPConfig[] {
    return Array.from(this.smtpConfigs.values())
      .filter(config => config.enabled && this.canSendNow(config))
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
  }

  private canSendNow(config: SMTPConfig): boolean {
    // Reset hourly counter if needed
    const now = new Date();
    if (now.getTime() - config.lastHourReset.getTime() >= 60 * 60 * 1000) {
      config.currentHourCount = 0;
      config.lastHourReset = now;
    }

    // Check rate limits
    if (config.currentHourCount >= config.maxPerHour) {
      return false;
    }

    // Check reputation and recent failures
    if (config.reputation === 'blocked') {
      return false;
    }

    if (config.failureCount > 5 && config.lastFailure) {
      const hoursSinceFailure = (now.getTime() - config.lastFailure.getTime()) / (60 * 60 * 1000);
      if (hoursSinceFailure < 1) { // Wait at least 1 hour after multiple failures
        return false;
      }
    }

    return true;
  }

  public async sendEmail(to: string, subject: string, html: string, attachments?: any[]): Promise<SendResult> {
    const availableSMTPs = this.getAvailableSMTPs();
    
    if (availableSMTPs.length === 0) {
      return {
        success: false,
        smtpId: 'none',
        error: 'No available SMTP servers',
        responseTime: 0
      };
    }

    // Try each SMTP in order (failover)
    for (const config of availableSMTPs) {
      const result = await this.trySendWithSMTP(config, to, subject, html, attachments);
      if (result.success) {
        return result;
      }
      
      // Mark SMTP as having issues and try next one
      this.recordFailure(config.id, result.error || 'Unknown error');
    }

    return {
      success: false,
      smtpId: availableSMTPs[0]?.id || 'none',
      error: 'All SMTP servers failed',
      responseTime: 0
    };
  }

  private async trySendWithSMTP(
    config: SMTPConfig, 
    to: string, 
    subject: string, 
    html: string, 
    attachments?: any[]
  ): Promise<SendResult> {
    const startTime = Date.now();
    const transporter = this.transporters.get(config.id);
    
    if (!transporter) {
      return {
        success: false,
        smtpId: config.id,
        error: 'Transporter not available',
        responseTime: Date.now() - startTime
      };
    }

    try {
      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject,
        html,
        attachments
      };

      const info = await transporter.sendMail(mailOptions);
      
      // Record success
      config.currentHourCount++;
      this.recordSuccess(config.id);
      
      return {
        success: true,
        smtpId: config.id,
        messageId: info.messageId,
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.recordFailure(config.id, errorMessage);
      
      return {
        success: false,
        smtpId: config.id,
        error: errorMessage,
        responseTime: Date.now() - startTime
      };
    }
  }

  private recordSuccess(smtpId: string) {
    const config = this.smtpConfigs.get(smtpId);
    if (config) {
      // Reset failure count on success
      config.failureCount = Math.max(0, config.failureCount - 1);
      
      // Improve reputation
      if (config.reputation === 'poor') config.reputation = 'fair';
      else if (config.reputation === 'fair') config.reputation = 'good';
      else if (config.reputation === 'good') config.reputation = 'excellent';
    }
  }

  private recordFailure(smtpId: string, error: string) {
    const config = this.smtpConfigs.get(smtpId);
    if (config) {
      config.failureCount++;
      config.lastFailure = new Date();
      
      // Analyze error type and adjust reputation
      if (error.includes('550') || error.includes('blocked') || error.includes('blacklist')) {
        config.reputation = 'blocked';
        config.enabled = false;
      } else if (error.includes('rate limit') || error.includes('429')) {
        config.reputation = 'poor';
      } else if (config.failureCount > 10) {
        config.reputation = 'poor';
      } else if (config.failureCount > 5) {
        config.reputation = 'fair';
      }
      
      console.log(`SMTP ${config.name} failure: ${error} (Count: ${config.failureCount})`);
    }
  }

  public getSMTPStatus(): { id: string; name: string; status: string; reputation: string; enabled: boolean }[] {
    return Array.from(this.smtpConfigs.values()).map(config => ({
      id: config.id,
      name: config.name,
      status: this.canSendNow(config) ? 'available' : 'unavailable',
      reputation: config.reputation,
      enabled: config.enabled
    }));
  }

  public async enableSMTP(smtpId: string): Promise<void> {
    const config = this.smtpConfigs.get(smtpId);
    if (config) {
      config.enabled = true;
      config.failureCount = 0;
      config.reputation = 'good';
      console.log(`SMTP ${config.name} re-enabled`);
    }
  }

  public async disableSMTP(smtpId: string): Promise<void> {
    const config = this.smtpConfigs.get(smtpId);
    if (config) {
      config.enabled = false;
      console.log(`SMTP ${config.name} disabled`);
    }
  }

  private startHealthMonitoring() {
    // Run health check every 30 minutes
    setInterval(async () => {
      await this.performHealthCheck();
    }, 30 * 60 * 1000);
  }

  private async performHealthCheck() {
    console.log('Performing SMTP pool health check...');
    
    for (const [id, config] of this.smtpConfigs.entries()) {
      if (!config.enabled) continue;
      
      try {
        const transporter = this.transporters.get(id);
        if (transporter) {
          await transporter.verify();
          
          // Re-enable if it was disabled due to temporary issues
          if (config.reputation === 'blocked') {
            const hoursSinceFailure = config.lastFailure ? 
              (Date.now() - config.lastFailure.getTime()) / (60 * 60 * 1000) : 24;
            
            if (hoursSinceFailure > 24) { // Try to re-enable after 24 hours
              config.reputation = 'fair';
              config.failureCount = 0;
              console.log(`SMTP ${config.name} reputation restored after 24h cooldown`);
            }
          }
        }
      } catch (error) {
        console.log(`SMTP ${config.name} health check failed:`, error);
        this.recordFailure(id, `Health check failed: ${error}`);
      }
    }
  }

  public getPoolStats() {
    const configs = Array.from(this.smtpConfigs.values());
    return {
      total: configs.length,
      enabled: configs.filter(c => c.enabled).length,
      available: configs.filter(c => c.enabled && this.canSendNow(c)).length,
      blocked: configs.filter(c => c.reputation === 'blocked').length,
      excellent: configs.filter(c => c.reputation === 'excellent').length,
      good: configs.filter(c => c.reputation === 'good').length,
      fair: configs.filter(c => c.reputation === 'fair').length,
      poor: configs.filter(c => c.reputation === 'poor').length
    };
  }

  public async close(): Promise<void> {
    for (const transporter of this.transporters.values()) {
      transporter.close();
    }
    this.transporters.clear();
    this.smtpConfigs.clear();
  }
}