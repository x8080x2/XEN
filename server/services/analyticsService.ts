import type { EmailLog, EmailJob } from '@shared/schema';

export interface EmailMetrics {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  averageResponseTime: number;
  emailsPerMinute: number;
  bounceRate: number;
  uniqueRecipients: number;
}

export interface DomainMetrics {
  domain: string;
  sent: number;
  failed: number;
  successRate: number;
  averageResponseTime: number;
}

export interface CampaignAnalytics {
  jobId: string;
  subject: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metrics: EmailMetrics;
  domainBreakdown: DomainMetrics[];
  hourlyTrends: { hour: string; sent: number; failed: number }[];
  errorAnalysis: { error: string; count: number; percentage: number }[];
}

export interface PerformanceTrend {
  timestamp: Date;
  emailsPerSecond: number;
  successRate: number;
  averageResponseTime: number;
  activeConnections: number;
}

export class AnalyticsService {
  private static performanceBuffer: PerformanceTrend[] = [];
  private static readonly MAX_BUFFER_SIZE = 1000;

  public static async getCampaignAnalytics(jobId: string): Promise<CampaignAnalytics | null> {
    try {
      // Mock implementation for demo - replace with actual storage calls
      const job = { id: jobId, subject: 'Sample Campaign', createdAt: new Date(), updatedAt: new Date() };
      const logs: EmailLog[] = [];
      if (!logs || logs.length === 0) {
        return {
          jobId,
          subject: job.subject,
          startTime: job.createdAt,
          endTime: job.updatedAt,
          duration: job.updatedAt ? job.updatedAt.getTime() - job.createdAt.getTime() : undefined,
          metrics: this.calculateMetrics(logs),
          domainBreakdown: [],
          hourlyTrends: [],
          errorAnalysis: []
        };
      }

      const metrics = this.calculateMetrics(logs);
      const domainBreakdown = this.calculateDomainBreakdown(logs);
      const hourlyTrends = this.calculateHourlyTrends(logs);
      const errorAnalysis = this.calculateErrorAnalysis(logs);

      return {
        jobId,
        subject: job.subject,
        startTime: job.createdAt,
        endTime: job.updatedAt,
        duration: job.updatedAt ? job.updatedAt.getTime() - job.createdAt.getTime() : undefined,
        metrics,
        domainBreakdown,
        hourlyTrends,
        errorAnalysis
      };
    } catch (error) {
      console.error('Error getting campaign analytics:', error);
      return null;
    }
  }

  public static async getAllCampaignsAnalytics(limit: number = 10): Promise<CampaignAnalytics[]> {
    try {
      // Mock implementation for demo - replace with actual storage calls
      const analytics: CampaignAnalytics[] = [];
      return analytics;
    } catch (error) {
      console.error('Error getting all campaigns analytics:', error);
      return [];
    }
  }

  public static calculateMetrics(logs: EmailLog[]): EmailMetrics {
    if (!logs || logs.length === 0) {
      return {
        totalSent: 0,
        totalFailed: 0,
        successRate: 0,
        averageResponseTime: 0,
        emailsPerMinute: 0,
        bounceRate: 0,
        uniqueRecipients: 0
      };
    }

    const totalSent = logs.filter(log => log.status === 'sent').length;
    const totalFailed = logs.filter(log => log.status === 'failed').length;
    const successRate = logs.length > 0 ? (totalSent / logs.length) * 100 : 0;

    // Calculate average response time from successful sends
    const successfulLogs = logs.filter(log => log.status === 'sent' && log.responseTime);
    const averageResponseTime = successfulLogs.length > 0 
      ? successfulLogs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / successfulLogs.length 
      : 0;

    // Calculate emails per minute
    const sortedLogs = [...logs].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];
    const durationMinutes = firstLog && lastLog 
      ? (lastLog.sentAt.getTime() - firstLog.sentAt.getTime()) / (1000 * 60) 
      : 0;
    const emailsPerMinute = durationMinutes > 0 ? logs.length / durationMinutes : 0;

    // Calculate bounce rate (failed emails with bounce-related errors)
    const bounceErrors = ['bounce', '550', '551', '552', '553', 'blocked', 'rejected'];
    const bounces = logs.filter(log => 
      log.status === 'failed' && 
      log.error && 
      bounceErrors.some(be => log.error!.toLowerCase().includes(be))
    ).length;
    const bounceRate = logs.length > 0 ? (bounces / logs.length) * 100 : 0;

    // Count unique recipients
    const uniqueRecipients = new Set(logs.map(log => log.recipient)).size;

    return {
      totalSent,
      totalFailed,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      emailsPerMinute: Math.round(emailsPerMinute * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      uniqueRecipients
    };
  }

  public static calculateDomainBreakdown(logs: EmailLog[]): DomainMetrics[] {
    const domainStats: { [domain: string]: { sent: number; failed: number; responseTimes: number[] } } = {};

    for (const log of logs) {
      const domain = log.recipient.split('@')[1] || 'unknown';
      
      if (!domainStats[domain]) {
        domainStats[domain] = { sent: 0, failed: 0, responseTimes: [] };
      }

      if (log.status === 'sent') {
        domainStats[domain].sent++;
        if (log.responseTime) {
          domainStats[domain].responseTimes.push(log.responseTime);
        }
      } else {
        domainStats[domain].failed++;
      }
    }

    return Object.entries(domainStats).map(([domain, stats]) => {
      const total = stats.sent + stats.failed;
      const successRate = total > 0 ? (stats.sent / total) * 100 : 0;
      const averageResponseTime = stats.responseTimes.length > 0 
        ? stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length 
        : 0;

      return {
        domain,
        sent: stats.sent,
        failed: stats.failed,
        successRate: Math.round(successRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime)
      };
    }).sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed));
  }

  public static calculateHourlyTrends(logs: EmailLog[]): { hour: string; sent: number; failed: number }[] {
    const hourlyStats: { [hour: string]: { sent: number; failed: number } } = {};

    for (const log of logs) {
      const hour = log.sentAt.toISOString().substring(0, 13) + ':00:00'; // Round to hour
      
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { sent: 0, failed: 0 };
      }

      if (log.status === 'sent') {
        hourlyStats[hour].sent++;
      } else {
        hourlyStats[hour].failed++;
      }
    }

    return Object.entries(hourlyStats)
      .map(([hour, stats]) => ({ hour, sent: stats.sent, failed: stats.failed }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  public static calculateErrorAnalysis(logs: EmailLog[]): { error: string; count: number; percentage: number }[] {
    const failedLogs = logs.filter(log => log.status === 'failed' && log.error);
    if (failedLogs.length === 0) return [];

    const errorStats: { [error: string]: number } = {};

    for (const log of failedLogs) {
      const error = log.error || 'Unknown error';
      // Normalize similar errors
      let normalizedError = error;
      if (error.includes('550')) normalizedError = 'Mailbox unavailable (550)';
      else if (error.includes('551')) normalizedError = 'User not local (551)';
      else if (error.includes('552')) normalizedError = 'Storage exceeded (552)';
      else if (error.includes('553')) normalizedError = 'Mailbox name invalid (553)';
      else if (error.includes('timeout')) normalizedError = 'Connection timeout';
      else if (error.includes('DNS')) normalizedError = 'DNS resolution failed';
      
      errorStats[normalizedError] = (errorStats[normalizedError] || 0) + 1;
    }

    return Object.entries(errorStats)
      .map(([error, count]) => ({
        error,
        count,
        percentage: Math.round((count / failedLogs.length) * 10000) / 100
      }))
      .sort((a, b) => b.count - a.count);
  }

  public static recordPerformanceMetric(metric: Omit<PerformanceTrend, 'timestamp'>) {
    this.performanceBuffer.push({
      ...metric,
      timestamp: new Date()
    });

    // Keep buffer size manageable
    if (this.performanceBuffer.length > this.MAX_BUFFER_SIZE) {
      this.performanceBuffer.shift();
    }
  }

  public static getRealtimePerformance(minutes: number = 30): PerformanceTrend[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.performanceBuffer.filter(metric => metric.timestamp >= cutoff);
  }

  public static generateCampaignReport(analytics: CampaignAnalytics): string {
    const report = `
EMAIL CAMPAIGN REPORT
====================

Campaign: ${analytics.subject}
Job ID: ${analytics.jobId}
Start Time: ${analytics.startTime.toLocaleString()}
End Time: ${analytics.endTime?.toLocaleString() || 'In Progress'}
Duration: ${analytics.duration ? Math.round(analytics.duration / 1000) : 0} seconds

PERFORMANCE METRICS
===================
Total Sent: ${analytics.metrics.totalSent}
Total Failed: ${analytics.metrics.totalFailed}
Success Rate: ${analytics.metrics.successRate}%
Average Response Time: ${analytics.metrics.averageResponseTime}ms
Emails per Minute: ${analytics.metrics.emailsPerMinute}
Bounce Rate: ${analytics.metrics.bounceRate}%
Unique Recipients: ${analytics.metrics.uniqueRecipients}

DOMAIN BREAKDOWN
================
${analytics.domainBreakdown.map(d => 
  `${d.domain}: ${d.sent} sent, ${d.failed} failed (${d.successRate}% success)`
).join('\n')}

ERROR ANALYSIS
==============
${analytics.errorAnalysis.map(e => 
  `${e.error}: ${e.count} occurrences (${e.percentage}%)`
).join('\n')}
`;

    return report;
  }
}