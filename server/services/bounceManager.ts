import type { EmailLog } from '@shared/schema';

export interface BounceInfo {
  email: string;
  bounceType: 'hard' | 'soft' | 'complaint';
  reason: string;
  timestamp: Date;
  bounceCount: number;
  lastBounce: Date;
  status: 'active' | 'suppressed' | 'quarantined';
}

export interface ListCleaningResult {
  originalCount: number;
  cleanedCount: number;
  suppressedEmails: string[];
  quarantinedEmails: string[];
  removedCount: number;
  cleaningReport: string;
}

export class BounceManager {
  private static bounceDatabase: Map<string, BounceInfo> = new Map();
  private static readonly HARD_BOUNCE_THRESHOLD = 1; // Suppress after 1 hard bounce
  private static readonly SOFT_BOUNCE_THRESHOLD = 3; // Quarantine after 3 soft bounces
  private static readonly COMPLAINT_THRESHOLD = 1; // Suppress immediately on complaint

  public static initializeFromLogs(logs: EmailLog[]) {
    for (const log of logs) {
      if (log.status === 'failed' && log.error) {
        this.processBounce(log.recipient, log.error, log.sentAt);
      }
    }
  }

  public static processBounce(email: string, error: string, timestamp: Date = new Date()): BounceInfo {
    const bounceType = this.classifyBounce(error);
    const existingBounce = this.bounceDatabase.get(email);

    let bounceInfo: BounceInfo;

    if (existingBounce) {
      bounceInfo = {
        ...existingBounce,
        bounceCount: existingBounce.bounceCount + 1,
        lastBounce: timestamp,
        reason: error // Update with latest reason
      };
    } else {
      bounceInfo = {
        email,
        bounceType,
        reason: error,
        timestamp,
        bounceCount: 1,
        lastBounce: timestamp,
        status: 'active'
      };
    }

    // Update status based on bounce type and count
    bounceInfo.status = this.determineStatus(bounceInfo);

    this.bounceDatabase.set(email, bounceInfo);
    
    console.log(`Processed bounce for ${email}: ${bounceType} bounce (count: ${bounceInfo.bounceCount}, status: ${bounceInfo.status})`);
    
    return bounceInfo;
  }

  private static classifyBounce(error: string): 'hard' | 'soft' | 'complaint' {
    const errorLower = error.toLowerCase();

    // Hard bounces - permanent failures
    if (
      errorLower.includes('550') ||           // Mailbox unavailable
      errorLower.includes('551') ||           // User not local  
      errorLower.includes('553') ||           // Mailbox name invalid
      errorLower.includes('no such user') ||
      errorLower.includes('user unknown') ||
      errorLower.includes('invalid recipient') ||
      errorLower.includes('recipient rejected') ||
      errorLower.includes('mailbox does not exist') ||
      errorLower.includes('invalid address')
    ) {
      return 'hard';
    }

    // Complaints - spam/abuse reports
    if (
      errorLower.includes('spam') ||
      errorLower.includes('abuse') ||
      errorLower.includes('complaint') ||
      errorLower.includes('blocked') ||
      errorLower.includes('blacklist') ||
      errorLower.includes('reputation')
    ) {
      return 'complaint';
    }

    // Soft bounces - temporary failures
    return 'soft';
  }

  private static determineStatus(bounceInfo: BounceInfo): 'active' | 'suppressed' | 'quarantined' {
    switch (bounceInfo.bounceType) {
      case 'hard':
        return bounceInfo.bounceCount >= this.HARD_BOUNCE_THRESHOLD ? 'suppressed' : 'active';
      
      case 'complaint':
        return bounceInfo.bounceCount >= this.COMPLAINT_THRESHOLD ? 'suppressed' : 'active';
      
      case 'soft':
        if (bounceInfo.bounceCount >= this.SOFT_BOUNCE_THRESHOLD) {
          return 'quarantined';
        }
        return 'active';
      
      default:
        return 'active';
    }
  }

  public static shouldSuppressEmail(email: string): boolean {
    const bounceInfo = this.bounceDatabase.get(email);
    return bounceInfo?.status === 'suppressed' || bounceInfo?.status === 'quarantined';
  }

  public static getBounceInfo(email: string): BounceInfo | null {
    return this.bounceDatabase.get(email) || null;
  }

  public static getAllBounces(): BounceInfo[] {
    return Array.from(this.bounceDatabase.values());
  }

  public static getSuppressedEmails(): string[] {
    return Array.from(this.bounceDatabase.values())
      .filter(info => info.status === 'suppressed')
      .map(info => info.email);
  }

  public static getQuarantinedEmails(): string[] {
    return Array.from(this.bounceDatabase.values())
      .filter(info => info.status === 'quarantined')
      .map(info => info.email);
  }

  public static cleanEmailList(emails: string[]): ListCleaningResult {
    const originalCount = emails.length;
    const suppressedEmails: string[] = [];
    const quarantinedEmails: string[] = [];
    const cleanedEmails: string[] = [];

    for (const email of emails) {
      const bounceInfo = this.bounceDatabase.get(email.trim().toLowerCase());
      
      if (bounceInfo?.status === 'suppressed') {
        suppressedEmails.push(email);
      } else if (bounceInfo?.status === 'quarantined') {
        quarantinedEmails.push(email);
      } else {
        cleanedEmails.push(email);
      }
    }

    const removedCount = suppressedEmails.length + quarantinedEmails.length;
    
    const cleaningReport = `
EMAIL LIST CLEANING REPORT
==========================
Original count: ${originalCount}
Cleaned count: ${cleanedEmails.length}
Removed count: ${removedCount} (${Math.round((removedCount / originalCount) * 100)}%)

Suppressed (hard bounces/complaints): ${suppressedEmails.length}
Quarantined (multiple soft bounces): ${quarantinedEmails.length}

SUPPRESSED EMAILS:
${suppressedEmails.map(email => `- ${email} (${this.getBounceInfo(email)?.reason || 'Unknown'})`).join('\n')}

QUARANTINED EMAILS:
${quarantinedEmails.map(email => `- ${email} (${this.getBounceInfo(email)?.bounceCount} bounces)`).join('\n')}
`;

    return {
      originalCount,
      cleanedCount: cleanedEmails.length,
      suppressedEmails,
      quarantinedEmails,
      removedCount,
      cleaningReport
    };
  }

  public static async reactivateEmail(email: string): Promise<boolean> {
    const bounceInfo = this.bounceDatabase.get(email);
    if (!bounceInfo) return false;

    // Only allow reactivation of soft bounces or old hard bounces
    if (bounceInfo.bounceType === 'soft' || 
        (bounceInfo.bounceType === 'hard' && this.daysSinceLastBounce(bounceInfo) > 30)) {
      
      bounceInfo.status = 'active';
      bounceInfo.bounceCount = 0; // Reset count
      this.bounceDatabase.set(email, bounceInfo);
      
      console.log(`Reactivated email: ${email}`);
      return true;
    }

    return false;
  }

  private static daysSinceLastBounce(bounceInfo: BounceInfo): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - bounceInfo.lastBounce.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public static getBounceStatistics() {
    const bounces = this.getAllBounces();
    
    return {
      total: bounces.length,
      active: bounces.filter(b => b.status === 'active').length,
      suppressed: bounces.filter(b => b.status === 'suppressed').length,
      quarantined: bounces.filter(b => b.status === 'quarantined').length,
      hardBounces: bounces.filter(b => b.bounceType === 'hard').length,
      softBounces: bounces.filter(b => b.bounceType === 'soft').length,
      complaints: bounces.filter(b => b.bounceType === 'complaint').length,
      recentBounces: bounces.filter(b => this.daysSinceLastBounce(b) <= 7).length
    };
  }

  public static exportBounceList(): string {
    const bounces = this.getAllBounces();
    
    let csv = 'Email,BounceType,Status,BounceCount,LastBounce,Reason\n';
    
    for (const bounce of bounces) {
      csv += `"${bounce.email}","${bounce.bounceType}","${bounce.status}",${bounce.bounceCount},"${bounce.lastBounce.toISOString()}","${bounce.reason.replace(/"/g, '""')}"\n`;
    }
    
    return csv;
  }

  public static async synchronizeWithLogs(): Promise<void> {
    try {
      // Mock implementation for demo - replace with actual storage calls
      const failedLogs: EmailLog[] = [];
      
      console.log(`Synchronizing bounce manager with ${failedLogs.length} failed logs`);
      
      for (const log of failedLogs) {
        this.processBounce(log.recipient, log.error!, log.sentAt);
      }
      
      console.log(`Bounce synchronization complete. Tracking ${this.bounceDatabase.size} bounced emails`);
    } catch (error) {
      console.error('Error synchronizing bounce manager with logs:', error);
    }
  }

  public static clearBounceHistory(): void {
    this.bounceDatabase.clear();
    console.log('Bounce history cleared');
  }

  public static removeBounce(email: string): boolean {
    return this.bounceDatabase.delete(email);
  }
}