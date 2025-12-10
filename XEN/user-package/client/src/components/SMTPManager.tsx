import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, RotateCcw, Settings, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SMTPConfig {
  id: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
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

  const fetchSmtpData = async () => {
    try {
      const response = await fetch("/api/smtp/list");
      const data = await response.json();
      if (data.success) {
        setSmtpData(data);
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
    setLoading(true);
    try {
      const response = await fetch("/api/smtp/toggle-rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !smtpData.rotationEnabled })
      });
      
      const data = await response.json();
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

    setLoading(true);
    try {
      const response = await fetch("/api/smtp/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSmtp)
      });
      
      const data = await response.json();
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

    setLoading(true);
    try {
      const response = await fetch(`/api/smtp/${smtpId}`, {
        method: "DELETE"
      });
      
      const data = await response.json();
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
    setLoading(true);
    try {
      const response = await fetch("/api/smtp/rotate", {
        method: "POST"
      });
      
      const data = await response.json();
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          currentSmtp: data.currentSmtp
        }));
        toast({
          title: "SMTP Rotated",
          description: `Now using: ${data.currentSmtp?.fromEmail}`,
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
          
          <div className="grid gap-2">
            {smtpData.smtpConfigs.map((smtp) => (
              <div
                key={smtp.id}
                data-testid={`smtp-config-${smtp.id}`}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  smtpData.currentSmtp?.id === smtp.id 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                    : 'border-border'
                }`}
              >
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
            ))}
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