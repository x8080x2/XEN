import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, RotateCcw, Settings, Mail, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Electron API types
declare global {
  interface Window {
    electronAPI?: {
      smtpTest: (smtpId?: string) => Promise<{ online: boolean; smtpId?: string; smtp?: any; error?: string }>;
      smtpList: () => Promise<{ success: boolean; smtpConfigs: any[]; currentSmtp: any; rotationEnabled: boolean }>;
      smtpRotate: () => Promise<{ success: boolean; currentSmtp: any; rotationEnabled: boolean }>;
      smtpToggleRotation: (enabled: boolean) => Promise<{ success: boolean; rotationEnabled: boolean; currentSmtp: any }>;
      smtpAdd: (config: any) => Promise<{ success: boolean; smtpConfigs: any[]; smtpId: string }>;
      smtpDelete: (smtpId: string) => Promise<{ success: boolean; smtpConfigs: any[]; currentSmtp: any }>;
    };
  }
}

interface SMTPConfig {
  id: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
}

interface SMTPStatus {
  [smtpId: string]: 'online' | 'offline' | 'testing' | 'unknown';
}

interface SMTPData {
  smtpConfigs: SMTPConfig[];
  currentSmtp: SMTPConfig | null;
  rotationEnabled: boolean;
}

export function SMTPManager() {
  const [smtpData, setSmtpData] = useState<SMTPData>({
    smtpConfigs: [],
    currentSmtp: null,
    rotationEnabled: false
  });
  const [smtpStatus, setSmtpStatus] = useState<SMTPStatus>({});
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSmtp, setNewSmtp] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    fromEmail: "",
    fromName: ""
  });

  const { toast } = useToast();

  const testSmtp = async (smtpId: string) => {
    setSmtpStatus(prev => ({ ...prev, [smtpId]: 'testing' }));
    try {
      let data: { online: boolean; error?: string } | undefined;
      
      if (window.electronAPI?.smtpTest) {
        // Desktop: Pass SMTP ID directly to test that specific config
        data = await window.electronAPI.smtpTest(smtpId);
        console.log(`[Desktop SMTP Test] ${smtpId}:`, data);
      } else {
        // Web version - use backend API
        const response = await fetch(`/api/smtp/test/${smtpId}`);
        data = await response.json();
      }
      
      // Set status based on result
      if (data && data.online) {
        setSmtpStatus(prev => ({ ...prev, [smtpId]: 'online' }));
      } else {
        setSmtpStatus(prev => ({ ...prev, [smtpId]: 'offline' }));
      }
    } catch (error) {
      console.error(`SMTP test failed for ${smtpId}:`, error);
      setSmtpStatus(prev => ({ ...prev, [smtpId]: 'offline' }));
    }
  };

  const testAllSmtps = async () => {
    // Desktop: Test each SMTP by rotating to it
    if (window.electronAPI?.smtpTest) {
      console.log('[Desktop SMTP Test] Testing all SMTPs...');
      for (const smtp of smtpData.smtpConfigs) {
        await testSmtp(smtp.id);
      }
    } else {
      // Web: Test all SMTPs individually
      for (const smtp of smtpData.smtpConfigs) {
        await testSmtp(smtp.id);
      }
    }
  };

  const fetchSmtpData = async () => {
    try {
      let data;
      if (window.electronAPI?.smtpList) {
        // Desktop: Use Electron API
        data = await window.electronAPI.smtpList();
      } else {
        // Web: Use backend API
        const response = await fetch("/api/smtp/list");
        data = await response.json();
      }
      
      if (data && data.success) {
        setSmtpData(data);
        
        // Initialize all SMTPs as unknown
        const initialStatuses: SMTPStatus = {};
        data.smtpConfigs.forEach((smtp: SMTPConfig) => {
          initialStatuses[smtp.id] = 'unknown';
        });
        setSmtpStatus(initialStatuses);
        
        // Auto-test ALL SMTPs on desktop
        if (window.electronAPI?.smtpTest) {
          console.log('[Desktop SMTP] Auto-testing all SMTPs...');
          // Test all SMTPs in background
          for (const smtp of data.smtpConfigs) {
            testSmtp(smtp.id);
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch SMTP configurations",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchSmtpData();
  }, []);

  const toggleRotation = async () => {
    if (!window.electronAPI?.smtpToggleRotation) {
      toast({
        title: "Error",
        description: "SMTP toggle rotation not available",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const data = await window.electronAPI.smtpToggleRotation(!smtpData.rotationEnabled);
      console.log('[Desktop SMTP Toggle Rotation]', data);
      
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          rotationEnabled: data.rotationEnabled,
          currentSmtp: data.currentSmtp
        }));
        toast({
          title: "SMTP Rotation",
          description: `SMTP rotation ${data.rotationEnabled ? 'enabled' : 'disabled'}`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to toggle SMTP rotation",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle SMTP rotation",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const addSmtp = async () => {
    // Only require host, port, and fromEmail - username/password are optional
    if (!newSmtp.host || !newSmtp.port || !newSmtp.fromEmail) {
      toast({
        title: "Error",
        description: "Please fill in Host, Port, and From Email (Username/Password are optional)",
        variant: "destructive"
      });
      return;
    }

    if (!window.electronAPI?.smtpAdd) {
      toast({
        title: "Error",
        description: "SMTP add not available",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const data = await window.electronAPI.smtpAdd(newSmtp);
      console.log('[Desktop SMTP Add]', data);
      
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          smtpConfigs: data.smtpConfigs
        }));
        setNewSmtp({
          host: "",
          port: "587",
          user: "",
          pass: "",
          fromEmail: "",
          fromName: ""
        });
        setDialogOpen(false);
        toast({
          title: "Success",
          description: `SMTP configuration ${data.smtpId} added successfully`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to add SMTP configuration",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add SMTP configuration",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const deleteSmtp = async (smtpId: string) => {
    if (smtpData.smtpConfigs.length <= 1) {
      toast({
        title: "Error",
        description: "Cannot delete the last SMTP configuration",
        variant: "destructive"
      });
      return;
    }

    if (!window.electronAPI?.smtpDelete) {
      toast({
        title: "Error",
        description: "SMTP delete not available",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const data = await window.electronAPI.smtpDelete(smtpId);
      console.log('[Desktop SMTP Delete]', data);
      
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          smtpConfigs: data.smtpConfigs,
          currentSmtp: data.currentSmtp
        }));
        toast({
          title: "Success",
          description: `SMTP configuration ${smtpId} deleted successfully`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete SMTP configuration",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete SMTP configuration",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const rotateSmtp = async () => {
    if (!window.electronAPI?.smtpRotate) {
      toast({
        title: "Error",
        description: "SMTP rotate not available",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const data = await window.electronAPI.smtpRotate();
      console.log('[Desktop SMTP Rotate]', data);
      
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          currentSmtp: data.currentSmtp
        }));
        toast({
          title: "SMTP Rotated",
          description: `Now using: ${data.currentSmtp?.fromEmail}`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to rotate SMTP",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rotate SMTP",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  return (
    <Card data-testid="smtp-manager">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              SMTP Management
            </CardTitle>
            <CardDescription>
              Manage your SMTP servers and enable rotation for better delivery
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="rotation-switch" className="text-sm">Rotation</Label>
            <Switch
              id="rotation-switch"
              data-testid="toggle-rotation"
              checked={smtpData.rotationEnabled}
              onCheckedChange={toggleRotation}
              disabled={loading || smtpData.smtpConfigs.length <= 1}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current SMTP Display */}
        {smtpData.currentSmtp && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">Current SMTP:</span>
                  <span data-testid="current-smtp-email">{smtpData.currentSmtp.fromEmail}</span>
                  <Badge variant="secondary" data-testid="current-smtp-id">{smtpData.currentSmtp.id}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {smtpData.currentSmtp.host}:{smtpData.currentSmtp.port}
                </p>
              </div>
              {smtpData.rotationEnabled && smtpData.smtpConfigs.length > 1 && (
                <Button
                  data-testid="button-rotate"
                  variant="outline" 
                  size="sm" 
                  onClick={rotateSmtp}
                  disabled={loading}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* SMTP List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Available SMTP Servers ({smtpData.smtpConfigs.length})</h4>
            <div className="flex items-center gap-2">
              <Button 
                data-testid="button-test-all-smtp" 
                variant="outline" 
                size="sm"
                onClick={testAllSmtps}
                disabled={smtpData.smtpConfigs.length === 0}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Test All
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-smtp" variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add SMTP
                  </Button>
                </DialogTrigger>
              <DialogContent data-testid="dialog-add-smtp">
                <DialogHeader>
                  <DialogTitle>Add SMTP Server</DialogTitle>
                  <DialogDescription>
                    Add a new SMTP server configuration. Username and password are optional for no-auth SMTP servers.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="host" className="text-right">Host</Label>
                    <Input
                      id="host"
                      data-testid="input-smtp-host"
                      value={newSmtp.host}
                      onChange={(e) => setNewSmtp({...newSmtp, host: e.target.value})}
                      className="col-span-3"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="port" className="text-right">Port</Label>
                    <Input
                      id="port"
                      data-testid="input-smtp-port"
                      value={newSmtp.port}
                      onChange={(e) => setNewSmtp({...newSmtp, port: e.target.value})}
                      className="col-span-3"
                      placeholder="587"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="user" className="text-right">Username (optional)</Label>
                    <Input
                      id="user"
                      data-testid="input-smtp-user"
                      value={newSmtp.user}
                      onChange={(e) => setNewSmtp({...newSmtp, user: e.target.value})}
                      className="col-span-3"
                      placeholder="your@email.com (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="pass" className="text-right">Password (optional)</Label>
                    <Input
                      id="pass"
                      data-testid="input-smtp-pass"
                      type="password"
                      value={newSmtp.pass}
                      onChange={(e) => setNewSmtp({...newSmtp, pass: e.target.value})}
                      className="col-span-3"
                      placeholder="App password (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fromEmail" className="text-right">From Email</Label>
                    <Input
                      id="fromEmail"
                      data-testid="input-smtp-from-email"
                      value={newSmtp.fromEmail}
                      onChange={(e) => setNewSmtp({...newSmtp, fromEmail: e.target.value})}
                      className="col-span-3"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fromName" className="text-right">From Name</Label>
                    <Input
                      id="fromName"
                      data-testid="input-smtp-from-name"
                      value={newSmtp.fromName}
                      onChange={(e) => setNewSmtp({...newSmtp, fromName: e.target.value})}
                      className="col-span-3"
                      placeholder="Your Name (optional)"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    data-testid="button-save-smtp"
                    onClick={addSmtp} 
                    disabled={loading}
                  >
                    Add SMTP Server
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
          
          <div className="grid gap-2">
            {smtpData.smtpConfigs.map((smtp) => {
              const status = smtpStatus[smtp.id];
              return (
                <div
                  key={smtp.id}
                  data-testid={`smtp-config-${smtp.id}`}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    smtpData.currentSmtp?.id === smtp.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        status === 'online' ? 'bg-green-500' :
                        status === 'offline' ? 'bg-red-500' :
                        status === 'testing' ? 'bg-yellow-500 animate-pulse' :
                        'bg-gray-300'
                      }`}
                      title={
                        status === 'online' ? 'Online' :
                        status === 'offline' ? 'Offline' :
                        status === 'testing' ? 'Testing...' :
                        'Not tested'
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid={`badge-${smtp.id}`}>{smtp.id}</Badge>
                        <span className="font-medium" data-testid={`email-${smtp.id}`}>{smtp.fromEmail}</span>
                        {smtpData.currentSmtp?.id === smtp.id && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`host-${smtp.id}`}>
                        {smtp.host}:{smtp.port} ({smtp.user})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      data-testid={`button-test-${smtp.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => testSmtp(smtp.id)}
                      disabled={status === 'testing'}
                      title="Test connection"
                    >
                      <RefreshCw className={`w-4 h-4 ${status === 'testing' ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      data-testid={`button-delete-${smtp.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSmtp(smtp.id)}
                      disabled={loading || smtpData.smtpConfigs.length <= 1}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {smtpData.smtpConfigs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No SMTP servers configured</p>
              <p className="text-sm">Add an SMTP server to start sending emails</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}