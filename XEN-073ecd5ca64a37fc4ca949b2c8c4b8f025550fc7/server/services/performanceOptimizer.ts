export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private timings: Map<string, number[]> = new Map();
  
  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Track timing for performance analysis
  trackTiming(operation: string, duration: number) {
    if (!this.timings.has(operation)) {
      this.timings.set(operation, []);
    }
    const times = this.timings.get(operation)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  // Get performance recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const htmlImgTimes = this.timings.get('html2img');
    if (htmlImgTimes && htmlImgTimes.length > 0) {
      const avgTime = htmlImgTimes.reduce((a, b) => a + b, 0) / htmlImgTimes.length;
      if (avgTime > 500) {
        recommendations.push(`HTML2IMG averaging ${Math.round(avgTime)}ms - consider disabling for faster delivery`);
      }
    }

    const logoTimes = this.timings.get('logo_fetch');
    if (logoTimes && logoTimes.length > 0) {
      const avgTime = logoTimes.reduce((a, b) => a + b, 0) / logoTimes.length;
      if (avgTime > 100) {
        recommendations.push(`Domain logo fetch averaging ${Math.round(avgTime)}ms - caching has been enabled to improve performance`);
      }
      if (avgTime > 2000) {
        recommendations.push(`CRITICAL: Logo fetch time over 2000ms - check network connectivity or disable logo fetching`);
      }
    }

    const smtpTimes = this.timings.get('smtp_response');
    if (smtpTimes && smtpTimes.length > 0) {
      const avgTime = smtpTimes.reduce((a, b) => a + b, 0) / smtpTimes.length;
      if (avgTime > 600) {
        recommendations.push(`SMTP response averaging ${Math.round(avgTime)}ms - check email server connection`);
      }
    }

    return recommendations;
  }

  // Performance summary
  getPerformanceSummary(): any {
    const summary: any = {};
    
    for (const [operation, times] of Array.from(this.timings.entries())) {
      if (times.length > 0) {
        const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        summary[operation] = {
          count: times.length,
          avg: Math.round(avg),
          min,
          max,
          recent: times.slice(-5) // Last 5 measurements
        };
      }
    }
    
    return summary;
  }
}