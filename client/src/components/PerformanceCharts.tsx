
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, Clock, Mail, AlertCircle } from 'lucide-react';

interface ChartConfig {
  speed: {
    label: string;
    color: string;
  };
  success: {
    label: string;
    color: string;
  };
  failed: {
    label: string;
    color: string;
  };
  responseTime: {
    label: string;
    color: string;
  };
}

const chartConfig: ChartConfig = {
  speed: {
    label: 'Emails/sec',
    color: 'hsl(var(--chart-1))'
  },
  success: {
    label: 'Success Rate',
    color: 'hsl(var(--chart-2))'
  },
  failed: {
    label: 'Failed Rate',
    color: 'hsl(var(--chart-3))'
  },
  responseTime: {
    label: 'Response Time',
    color: 'hsl(var(--chart-4))'
  }
};

export default function PerformanceCharts() {
  const { metrics, realtimeStats, isLoading, isError } = usePerformanceMetrics(2000);
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '4h'>('1h');

  // Filter metrics based on time range
  const getFilteredMetrics = () => {
    if (!metrics.length) return [];
    
    const now = new Date();
    const minutesBack = timeRange === '15m' ? 15 : timeRange === '1h' ? 60 : 240;
    const cutoff = new Date(now.getTime() - minutesBack * 60 * 1000);
    
    return metrics
      .filter(m => m.timestamp >= cutoff)
      .map(m => ({
        time: m.timestamp.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }),
        speed: m.emailsPerSecond,
        successRate: m.successRate,
        failureRate: 100 - m.successRate,
        responseTime: m.averageResponseTime,
        timestamp: m.timestamp
      }))
      .slice(-50); // Limit to last 50 points for performance
  };

  const filteredData = getFilteredMetrics();

  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600">Failed to load performance metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Speed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realtimeStats.currentSpeed.toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground ml-1">emails/sec</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={realtimeStats.isActive ? "default" : "secondary"}>
                {realtimeStats.isActive ? "Active" : "Idle"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {realtimeStats.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {realtimeStats.totalSent} sent, {realtimeStats.totalFailed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realtimeStats.avgResponseTime.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(realtimeStats.totalSent + realtimeStats.totalFailed).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              emails processed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sending Speed Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sending Speed</CardTitle>
                <CardDescription>Real-time emails per second</CardDescription>
              </div>
              <div className="flex gap-2">
                {(['15m', '1h', '4h'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke={chartConfig.speed.color}
                  strokeWidth={2}
                  dot={{ fill: chartConfig.speed.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Success/Failure Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Success vs Failure Trends</CardTitle>
            <CardDescription>Email delivery success and failure rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <AreaChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="successRate"
                  stackId="1"
                  stroke={chartConfig.success.color}
                  fill={chartConfig.success.color}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="failureRate"
                  stackId="1"
                  stroke={chartConfig.failed.color}
                  fill={chartConfig.failed.color}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Response Time Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Average Response Time</CardTitle>
            <CardDescription>SMTP server response times over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <LineChart data={filteredData} height={300}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke={chartConfig.responseTime.color}
                  strokeWidth={2}
                  dot={{ fill: chartConfig.responseTime.color, strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {isLoading && filteredData.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Activity className="w-8 h-8 text-blue-500 mx-auto animate-pulse" />
              <div>
                <p className="text-lg font-medium">Initializing Performance Monitor</p>
                <p className="text-sm text-muted-foreground">
                  Charts will appear when email sending is active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
