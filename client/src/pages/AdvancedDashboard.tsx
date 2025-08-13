import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, XCircle, TrendingUp, Mail, Server, Shield } from "lucide-react";

interface PlaceholderValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  validPlaceholders: string[];
  invalidPlaceholders: string[];
}

interface PlaceholderInfo {
  name: string;
  description: string;
  example: string;
  category: 'user' | 'random' | 'dynamic' | 'advanced';
}

interface SMTPStatus {
  id: string;
  name: string;
  status: string;
  reputation: string;
  enabled: boolean;
}

interface BounceStats {
  total: number;
  active: number;
  suppressed: number;
  quarantined: number;
  hardBounces: number;
  softBounces: number;
  complaints: number;
  recentBounces: number;
}

interface DomainReputation {
  domain: string;
  reputation: 'excellent' | 'good' | 'warming' | 'poor' | 'blacklisted';
  sendingVolume: number;
  successRate: number;
  bounceRate: number;
  complaintRate: number;
  warmupPhase: boolean;
  warmupDay: number;
  recommendedDailyLimit: number;
}

export default function AdvancedDashboard() {
  const [activeTab, setActiveTab] = useState("validation");
  const [testContent, setTestContent] = useState("{username}, your email {email} is ready! Visit {domain} today. Random ID: {hash6}");
  const [testRecipient, setTestRecipient] = useState("john@example.com");
  const [validation, setValidation] = useState<PlaceholderValidation | null>(null);
  const [highlighted, setHighlighted] = useState("");
  const [preview, setPreview] = useState("");
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);
  
  // Performance metrics state
  const [smtpStatus, setSMTPStatus] = useState<SMTPStatus[]>([]);
  const [bounceStats, setBounceStats] = useState<BounceStats | null>(null);
  const [domainReputations, setDomainReputations] = useState<DomainReputation[]>([]);

  const validatePlaceholders = async () => {
    try {
      const response = await fetch('/api/placeholder/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: testContent, recipient: testRecipient })
      });
      
      const data = await response.json();
      setValidation(data.validation);
      setHighlighted(data.highlighted);
      setPreview(data.preview);
      setPlaceholders(data.placeholders);
    } catch (error) {
      console.error('Error validating placeholders:', error);
    }
  };

  const loadSMTPStatus = async () => {
    try {
      const response = await fetch('/api/smtp/status');
      const data = await response.json();
      setSMTPStatus(data.status);
    } catch (error) {
      console.error('Error loading SMTP status:', error);
    }
  };

  const loadBounceStats = async () => {
    try {
      const response = await fetch('/api/bounce/stats');
      const data = await response.json();
      setBounceStats(data);
    } catch (error) {
      console.error('Error loading bounce stats:', error);
    }
  };

  const loadDomainReputations = async () => {
    try {
      const response = await fetch('/api/reputation/domains');
      const data = await response.json();
      setDomainReputations(data);
    } catch (error) {
      console.error('Error loading domain reputations:', error);
    }
  };

  useEffect(() => {
    validatePlaceholders();
    loadSMTPStatus();
    loadBounceStats();
    loadDomainReputations();
  }, []);

  const getReputationColor = (reputation: string) => {
    switch (reputation) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'warming': return 'bg-yellow-500';
      case 'fair': return 'bg-orange-500';
      case 'poor': return 'bg-red-500';
      case 'blacklisted': return 'bg-black';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'unavailable': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Advanced Email Analytics</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Comprehensive email marketing tools with validation, performance tracking, and reputation monitoring
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Placeholder Validation
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Performance Charts
            </TabsTrigger>
            <TabsTrigger value="smtp" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              SMTP Pool Manager
            </TabsTrigger>
            <TabsTrigger value="reputation" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Reputation Monitor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Built-in Placeholder Validation & Syntax Highlighting
                  </CardTitle>
                  <CardDescription>
                    Real-time validation with syntax highlighting and intelligent suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="test-content">Test Content</Label>
                    <Textarea
                      id="test-content"
                      value={testContent}
                      onChange={(e) => setTestContent(e.target.value)}
                      placeholder="Enter email content with placeholders..."
                      className="min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="test-recipient">Test Recipient</Label>
                    <Input
                      id="test-recipient"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="test@example.com"
                    />
                  </div>
                  
                  <Button onClick={validatePlaceholders} className="w-full">
                    Validate Placeholders
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Validation Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {validation && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        {validation.isValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className={validation.isValid ? "text-green-700" : "text-red-700"}>
                          {validation.isValid ? "All placeholders valid" : "Validation errors found"}
                        </span>
                      </div>

                      {validation.errors.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-red-700">Errors:</h4>
                          {validation.errors.map((error, index) => (
                            <p key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                              {error}
                            </p>
                          ))}
                        </div>
                      )}

                      {validation.warnings.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-yellow-700">Warnings:</h4>
                          {validation.warnings.map((warning, index) => (
                            <p key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}

                      {validation.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-blue-700">Suggestions:</h4>
                          {validation.suggestions.map((suggestion, index) => (
                            <p key={index} className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                              {suggestion}
                            </p>
                          ))}
                        </div>
                      )}

                      {preview && (
                        <div className="space-y-2">
                          <h4 className="font-semibold">Preview:</h4>
                          <div className="bg-gray-50 p-3 rounded text-sm">
                            {preview}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Available Placeholders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['user', 'random', 'dynamic', 'advanced'].map((category) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-semibold capitalize">{category} Placeholders</h4>
                      <div className="space-y-1">
                        {placeholders
                          .filter(p => p.category === category)
                          .map((placeholder, index) => (
                            <div key={index} className="text-sm">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {`{${placeholder.name}}`}
                              </code>
                              <p className="text-gray-600 text-xs mt-1">{placeholder.description}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Bounces</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bounceStats?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Recent: {bounceStats?.recentBounces || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suppressed</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{bounceStats?.suppressed || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Hard bounces and complaints
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quarantined</CardTitle>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{bounceStats?.quarantined || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Multiple soft bounces
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Emails</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{bounceStats?.active || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Clean and deliverable
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance Charts: Real-time Sending Speed & Success/Failure Trends</CardTitle>
                <CardDescription>
                  Monitor your email campaign performance with real-time metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300">
                      Real-time performance charts will appear here during active campaigns
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Start an email campaign to see live performance metrics, sending speed, and success rates
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="smtp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SMTP Pool Management: Automatic Failover Between Multiple SMTP Providers</CardTitle>
                <CardDescription>
                  Monitor and manage multiple SMTP servers with automatic failover and load balancing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {smtpStatus.length > 0 ? (
                    smtpStatus.map((smtp) => (
                      <div key={smtp.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(smtp.status)}
                          <div>
                            <h4 className="font-semibold">{smtp.name}</h4>
                            <p className="text-sm text-gray-600">ID: {smtp.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={getReputationColor(smtp.reputation)}>
                            {smtp.reputation}
                          </Badge>
                          <Badge variant={smtp.enabled ? "default" : "destructive"}>
                            {smtp.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              {smtp.enabled ? "Disable" : "Enable"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        SMTP Pool initialized with primary SMTP server
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Add multiple SMTP providers for automatic failover and improved deliverability
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reputation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bounce Management: Automatic Bounce Processing & List Cleaning</CardTitle>
                  <CardDescription>
                    Automatic bounce detection and email list cleaning
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bounceStats && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{bounceStats.hardBounces}</p>
                          <p className="text-sm text-red-700">Hard Bounces</p>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded-lg">
                          <p className="text-2xl font-bold text-yellow-600">{bounceStats.softBounces}</p>
                          <p className="text-sm text-yellow-700">Soft Bounces</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">{bounceStats.complaints}</p>
                          <p className="text-sm text-purple-700">Complaints</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{bounceStats.active}</p>
                          <p className="text-sm text-green-700">Clean Emails</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Export Bounce List</Button>
                        <Button variant="outline" size="sm">Clean Email List</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reputation Monitoring: Domain Warmup & Sender Reputation Tracking</CardTitle>
                  <CardDescription>
                    Monitor sender reputation and manage domain warmup processes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {domainReputations.length > 0 ? (
                    <div className="space-y-4">
                      {domainReputations.map((domain) => (
                        <div key={domain.domain} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{domain.domain}</h4>
                            <Badge className={getReputationColor(domain.reputation)}>
                              {domain.reputation}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Success Rate</p>
                              <p className="font-semibold">{domain.successRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Bounce Rate</p>
                              <p className="font-semibold">{domain.bounceRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Daily Limit</p>
                              <p className="font-semibold">{domain.recommendedDailyLimit.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Volume</p>
                              <p className="font-semibold">{domain.sendingVolume.toLocaleString()}</p>
                            </div>
                          </div>
                          {domain.warmupPhase && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>Warmup Progress</span>
                                <span>Day {domain.warmupDay}/30</span>
                              </div>
                              <Progress value={(domain.warmupDay / 30) * 100} className="h-2" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        No domains monitored yet
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Send emails to start monitoring domain reputation and warmup progress
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}