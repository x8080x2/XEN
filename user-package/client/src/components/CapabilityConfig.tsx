import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CapabilityConfigProps {
  onConfigured?: (capabilityUrl: string) => void;
}

export function CapabilityConfig({ onConfigured }: CapabilityConfigProps) {
  const [capabilityUrl, setCapabilityUrl] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  // Load saved configuration on mount
  useEffect(() => {
    const saved = localStorage.getItem('CAPABILITY_URL');
    if (saved) {
      setCapabilityUrl(saved);
      setIsConfigured(true);
      onConfigured?.(saved);
    }
  }, [onConfigured]);

  const handleSave = () => {
    if (!capabilityUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid capability URL",
        variant: "destructive"
      });
      return;
    }

    try {
      new URL(capabilityUrl); // Validate URL format
      localStorage.setItem('CAPABILITY_URL', capabilityUrl);
      setIsConfigured(true);
      setIsDialogOpen(false);
      onConfigured?.(capabilityUrl);
      
      toast({
        title: "Success",
        description: "Capability URL configured successfully"
      });
    } catch {
      toast({
        title: "Error", 
        description: "Please enter a valid URL format",
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    localStorage.removeItem('CAPABILITY_URL');
    setCapabilityUrl("");
    setIsConfigured(false);
    onConfigured?.("");
    
    toast({
      title: "Configuration Reset",
      description: "Capability URL has been cleared"
    });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={isConfigured ? "outline" : "default"}
          size="sm"
          data-testid="button-capability-config"
        >
          {isConfigured ? "📡 Connected" : "⚠️ Configure Connection"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Direct Backend Connection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="capability-url">Capability URL</Label>
            <Input
              id="capability-url"
              placeholder="https://your-backend.com/api/cap/YOUR_TOKEN/send"
              value={capabilityUrl}
              onChange={(e) => setCapabilityUrl(e.target.value)}
              data-testid="input-capability-url"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter the capability URL provided by your email service administrator
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleSave} 
              className="flex-1"
              data-testid="button-save-config"
            >
              Save Configuration
            </Button>
            {isConfigured && (
              <Button 
                onClick={handleReset} 
                variant="outline"
                data-testid="button-reset-config"
              >
                Reset
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <h4 className="font-medium mb-2">How to get your capability URL:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Contact your email service administrator</li>
              <li>Request a capability URL for email sending</li>
              <li>Copy and paste the provided URL here</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}