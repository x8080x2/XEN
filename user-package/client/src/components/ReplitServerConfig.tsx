import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { replitApiService } from "@/services/replitApiService";
import { useToast } from "@/hooks/use-toast";

export function ReplitServerConfig() {
  const [serverUrl, setServerUrl] = useState(() => {
    try {
      return replitApiService.getServerUrl();
    } catch {
      return "";
    }
  });
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const handleTest = async () => {
    if (!serverUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a server URL",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const result = await replitApiService.testConnection(serverUrl);
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!serverUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a server URL",
        variant: "destructive",
      });
      return;
    }

    try {
      replitApiService.setServerUrl(serverUrl);
      toast({
        title: "Saved",
        description: "Server URL has been saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="settings-section">
      <h3 className="text-sm font-semibold text-[#ef4444] mb-4 pb-2 border-b border-[#26262b]">
        Replit Server Configuration
      </h3>
      <div className="space-y-3">
        <div>
          <Label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
            Server URL
          </Label>
          <Input
            type="url"
            placeholder="https://your-replit-app.replit.app"
            className="bg-[#0f0f12] border-[#26262b] text-white text-xs"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            data-testid="input-server-url"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleTest}
            disabled={isTesting}
            variant="outline"
            className="bg-[#0f0f12] border-[#26262b] text-[#a1a1aa] hover:bg-[#1a1a1f] hover:text-white text-xs"
            data-testid="button-test-connection"
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs"
            data-testid="button-save-server-url"
          >
            Save URL
          </Button>
        </div>
      </div>
    </div>
  );
}
