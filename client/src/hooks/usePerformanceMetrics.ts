
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface PerformanceMetric {
  timestamp: Date;
  emailsPerSecond: number;
  successRate: number;
  averageResponseTime: number;
  activeConnections: number;
}

export interface RealtimeStats {
  currentSpeed: number;
  totalSent: number;
  totalFailed: number;
  successRate: number;
  avgResponseTime: number;
  isActive: boolean;
}

export function usePerformanceMetrics(intervalMs: number = 5000) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats>({
    currentSpeed: 0,
    totalSent: 0,
    totalFailed: 0,
    successRate: 0,
    avgResponseTime: 0,
    isActive: false
  });

  // Query real-time performance data
  const { data: performanceData, isError } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/performance?minutes=60');
      if (!response.ok) throw new Error('Failed to fetch performance data');
      return response.json();
    },
    refetchInterval: intervalMs,
    enabled: true
  });

  // Update metrics when data changes
  useEffect(() => {
    if (performanceData && Array.isArray(performanceData)) {
      const formattedMetrics = performanceData.map((metric: any) => ({
        ...metric,
        timestamp: new Date(metric.timestamp)
      }));
      
      setMetrics(formattedMetrics);

      // Calculate current stats
      if (formattedMetrics.length > 0) {
        const latest = formattedMetrics[formattedMetrics.length - 1];
        const recent = formattedMetrics.slice(-5); // Last 5 data points
        
        setRealtimeStats({
          currentSpeed: latest.emailsPerSecond || 0,
          totalSent: recent.reduce((sum, m) => sum + (m.totalSent || 0), 0),
          totalFailed: recent.reduce((sum, m) => sum + (m.totalFailed || 0), 0),
          successRate: latest.successRate || 0,
          avgResponseTime: latest.averageResponseTime || 0,
          isActive: Date.now() - latest.timestamp.getTime() < 30000 // Active if last update within 30s
        });
      }
    }
  }, [performanceData]);

  return {
    metrics,
    realtimeStats,
    isLoading: !performanceData && !isError,
    isError
  };
}
