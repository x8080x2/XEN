import { SMTPConfig, SMTPPoolManager } from './smtpPoolManager';
import { AnalyticsService } from './analyticsService';
import { BounceManager } from './bounceManager';

export interface DomainReputation {
  domain: string;
  reputation: 'excellent' | 'good' | 'warming' | 'poor' | 'blacklisted';
  sendingVolume: number;
  successRate: number;
  bounceRate: number;
  complaintRate: number;
  lastChecked: Date;
  warmupPhase: boolean;
  warmupDay: number;
  recommendedDailyLimit: number;
}

export interface WarmupPlan {
  domain: string;
  currentDay: number;
  totalDays: number;
  dailyTargets: number[];
  currentDailyLimit: number;
  emailsSentToday: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'paused';
}

export class ReputationMonitor {
  private static domainReputations: Map<string, DomainReputation> = new Map();
  private static warmupPlans: Map<string, WarmupPlan> = new Map();
  private static readonly WARMUP_DURATION_DAYS = 30;
  private static readonly WARMUP_TARGETS = [
    10, 20, 35, 50, 75, 100, 150, 200, 275, 350,  // Days 1-10
    450, 550, 675, 800, 950, 1100, 1275, 1450, 1650, 1850,  // Days 11-20
    2075, 2300, 2550, 2800, 3075, 3350, 3650, 3950, 4275, 4600  // Days 21-30
  ];

  public static async initializeDomainMonitoring(fromEmail: string): Promise<void> {
    const domain = fromEmail.split('@')[1];
    if (!domain) return;

    let reputation = this.domainReputations.get(domain);
    
    if (!reputation) {
      // New domain - needs warmup
      reputation = {
        domain,
        reputation: 'warming',
        sendingVolume: 0,
        successRate: 0,
        bounceRate: 0,
        complaintRate: 0,
        lastChecked: new Date(),
        warmupPhase: true,
        warmupDay: 1,
        recommendedDailyLimit: this.WARMUP_TARGETS[0]
      };

      // Create warmup plan
      const warmupPlan: WarmupPlan = {
        domain,
        currentDay: 1,
        totalDays: this.WARMUP_DURATION_DAYS,
        dailyTargets: this.WARMUP_TARGETS,
        currentDailyLimit: this.WARMUP_TARGETS[0],
        emailsSentToday: 0,
        status: 'not-started'
      };

      this.domainReputations.set(domain, reputation);
      this.warmupPlans.set(domain, warmupPlan);

      console.log(`Initialized domain monitoring for ${domain} - Warmup required`);
    } else {
      console.log(`Domain monitoring already active for ${domain} - Reputation: ${reputation.reputation}`);
    }
  }

  public static async updateReputationMetrics(domain: string): Promise<void> {
    try {
      // Get recent campaign analytics to calculate metrics
      const recentCampaigns = await AnalyticsService.getAllCampaignsAnalytics(10);
      
      let totalSent = 0;
      let totalFailed = 0;
      let totalBounces = 0;
      let totalComplaints = 0;

      for (const campaign of recentCampaigns) {
        // Filter metrics by domain
        const domainMetrics = campaign.domainBreakdown.find(d => d.domain === domain);
        if (domainMetrics) {
          totalSent += domainMetrics.sent;
          totalFailed += domainMetrics.failed;
        }
      }

      // Get bounce statistics for this domain
      const bounceStats = BounceManager.getAllBounces().filter(b => b.email.endsWith(`@${domain}`));
      totalBounces = bounceStats.filter(b => b.bounceType === 'hard').length;
      totalComplaints = bounceStats.filter(b => b.bounceType === 'complaint').length;

      const totalEmails = totalSent + totalFailed;
      const successRate = totalEmails > 0 ? (totalSent / totalEmails) * 100 : 0;
      const bounceRate = totalEmails > 0 ? (totalBounces / totalEmails) * 100 : 0;
      const complaintRate = totalEmails > 0 ? (totalComplaints / totalEmails) * 100 : 0;

      let reputation = this.domainReputations.get(domain);
      if (reputation) {
        reputation.sendingVolume = totalEmails;
        reputation.successRate = successRate;
        reputation.bounceRate = bounceRate;
        reputation.complaintRate = complaintRate;
        reputation.lastChecked = new Date();
        
        // Update reputation based on metrics
        reputation.reputation = this.calculateReputationScore(reputation);
        
        this.domainReputations.set(domain, reputation);
        
        console.log(`Updated reputation for ${domain}: ${reputation.reputation} (Success: ${successRate.toFixed(1)}%, Bounce: ${bounceRate.toFixed(1)}%)`);
      }
    } catch (error) {
      console.error(`Error updating reputation metrics for ${domain}:`, error);
    }
  }

  private static calculateReputationScore(reputation: DomainReputation): 'excellent' | 'good' | 'warming' | 'poor' | 'blacklisted' {
    // If in warmup phase, keep as warming
    if (reputation.warmupPhase) {
      const warmupPlan = this.warmupPlans.get(reputation.domain);
      if (warmupPlan && warmupPlan.currentDay < warmupPlan.totalDays) {
        return 'warming';
      }
    }

    // Blacklisted if complaint rate is too high or bounce rate is extreme
    if (reputation.complaintRate > 0.5 || reputation.bounceRate > 10) {
      return 'blacklisted';
    }

    // Poor if success rate is low or bounce rate is high
    if (reputation.successRate < 85 || reputation.bounceRate > 5) {
      return 'poor';
    }

    // Good if success rate is decent and bounce rate is acceptable
    if (reputation.successRate >= 90 && reputation.bounceRate <= 2) {
      return 'excellent';
    }

    return 'good';
  }

  public static getDailyLimit(domain: string): number {
    const reputation = this.domainReputations.get(domain);
    
    if (!reputation) {
      // Default limit for unknown domains
      return 50;
    }

    if (reputation.warmupPhase) {
      const warmupPlan = this.warmupPlans.get(domain);
      return warmupPlan?.currentDailyLimit || 10;
    }

    // Production limits based on reputation
    switch (reputation.reputation) {
      case 'excellent': return 10000;
      case 'good': return 5000;
      case 'warming': return reputation.recommendedDailyLimit;
      case 'poor': return 100;
      case 'blacklisted': return 0;
      default: return 50;
    }
  }

  public static async recordEmailSent(fromEmail: string): Promise<boolean> {
    const domain = fromEmail.split('@')[1];
    if (!domain) return true;

    await this.initializeDomainMonitoring(fromEmail);
    
    const warmupPlan = this.warmupPlans.get(domain);
    const reputation = this.domainReputations.get(domain);
    
    if (!reputation) return true;

    // Check daily limit
    const dailyLimit = this.getDailyLimit(domain);
    
    if (warmupPlan && warmupPlan.status === 'in-progress') {
      if (warmupPlan.emailsSentToday >= warmupPlan.currentDailyLimit) {
        console.log(`Daily warmup limit reached for ${domain}: ${warmupPlan.emailsSentToday}/${warmupPlan.currentDailyLimit}`);
        return false;
      }
      
      warmupPlan.emailsSentToday++;
      
      // Check if we should advance to next warmup day
      if (warmupPlan.emailsSentToday >= warmupPlan.currentDailyLimit) {
        await this.advanceWarmupDay(domain);
      }
    }

    return true;
  }

  private static async advanceWarmupDay(domain: string): Promise<void> {
    const warmupPlan = this.warmupPlans.get(domain);
    const reputation = this.domainReputations.get(domain);
    
    if (!warmupPlan || !reputation) return;

    warmupPlan.currentDay++;
    warmupPlan.emailsSentToday = 0;
    
    if (warmupPlan.currentDay <= warmupPlan.totalDays) {
      warmupPlan.currentDailyLimit = warmupPlan.dailyTargets[warmupPlan.currentDay - 1];
      reputation.warmupDay = warmupPlan.currentDay;
      reputation.recommendedDailyLimit = warmupPlan.currentDailyLimit;
      
      console.log(`Advanced ${domain} to warmup day ${warmupPlan.currentDay} (limit: ${warmupPlan.currentDailyLimit})`);
    } else {
      // Warmup completed
      warmupPlan.status = 'completed';
      reputation.warmupPhase = false;
      reputation.reputation = 'good'; // Graduate to good reputation
      
      console.log(`Domain warmup completed for ${domain} - Graduated to full sending`);
    }

    this.warmupPlans.set(domain, warmupPlan);
    this.domainReputations.set(domain, reputation);
  }

  public static getWarmupStatus(domain: string): WarmupPlan | null {
    return this.warmupPlans.get(domain) || null;
  }

  public static getDomainReputation(domain: string): DomainReputation | null {
    return this.domainReputations.get(domain) || null;
  }

  public static getAllDomainReputations(): DomainReputation[] {
    return Array.from(this.domainReputations.values());
  }

  public static async startWarmup(domain: string): Promise<void> {
    const warmupPlan = this.warmupPlans.get(domain);
    if (warmupPlan) {
      warmupPlan.status = 'in-progress';
      warmupPlan.emailsSentToday = 0;
      this.warmupPlans.set(domain, warmupPlan);
      
      console.log(`Started warmup for domain ${domain}`);
    }
  }

  public static async pauseWarmup(domain: string): Promise<void> {
    const warmupPlan = this.warmupPlans.get(domain);
    if (warmupPlan) {
      warmupPlan.status = 'paused';
      this.warmupPlans.set(domain, warmupPlan);
      
      console.log(`Paused warmup for domain ${domain}`);
    }
  }

  public static async resetWarmup(domain: string): Promise<void> {
    const warmupPlan: WarmupPlan = {
      domain,
      currentDay: 1,
      totalDays: this.WARMUP_DURATION_DAYS,
      dailyTargets: this.WARMUP_TARGETS,
      currentDailyLimit: this.WARMUP_TARGETS[0],
      emailsSentToday: 0,
      status: 'not-started'
    };

    const reputation = this.domainReputations.get(domain);
    if (reputation) {
      reputation.warmupPhase = true;
      reputation.warmupDay = 1;
      reputation.recommendedDailyLimit = this.WARMUP_TARGETS[0];
      reputation.reputation = 'warming';
      this.domainReputations.set(domain, reputation);
    }

    this.warmupPlans.set(domain, warmupPlan);
    console.log(`Reset warmup for domain ${domain}`);
  }

  public static generateReputationReport(): string {
    const reputations = this.getAllDomainReputations();
    
    let report = `
DOMAIN REPUTATION REPORT
========================
Generated: ${new Date().toLocaleString()}

`;

    for (const rep of reputations) {
      const warmup = this.warmupPlans.get(rep.domain);
      
      report += `Domain: ${rep.domain}
Reputation: ${rep.reputation.toUpperCase()}
Success Rate: ${rep.successRate.toFixed(1)}%
Bounce Rate: ${rep.bounceRate.toFixed(1)}%
Complaint Rate: ${rep.complaintRate.toFixed(1)}%
Sending Volume: ${rep.sendingVolume}
Daily Limit: ${this.getDailyLimit(rep.domain)}
`;

      if (rep.warmupPhase && warmup) {
        report += `Warmup Status: Day ${warmup.currentDay}/${warmup.totalDays} (${warmup.status})
Today's Progress: ${warmup.emailsSentToday}/${warmup.currentDailyLimit}
`;
      }

      report += `Last Checked: ${rep.lastChecked.toLocaleString()}

---

`;
    }

    return report;
  }

  public static async performDailyReset(): Promise<void> {
    // Reset daily counters for all warmup plans
    for (const [domain, warmupPlan] of this.warmupPlans.entries()) {
      if (warmupPlan.status === 'in-progress') {
        warmupPlan.emailsSentToday = 0;
        this.warmupPlans.set(domain, warmupPlan);
      }
    }

    // Update reputation metrics for all domains
    for (const domain of this.domainReputations.keys()) {
      await this.updateReputationMetrics(domain);
    }

    console.log('Performed daily reputation reset and update');
  }
}