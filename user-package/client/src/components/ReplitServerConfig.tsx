import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { replitApiService } from "@/services/replitApiService";
import { CheckCircle, XCircle, Settings } from "lucide-react";

export function ReplitServerConfig() {
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load current server URL
    setServerUrl(replitApiService.getServerUrlForDisplay());
    // Test initial connection
    testConnection();
  }, []);

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const connected = await replitApiService.testConnection();
      setIsConnected(connected);
      
      if (connected) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to Replit server",
        });
      } else {
        toast({
          title: "Connection failed",
          description: "Could not connect to Replit server",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsConnected(false);
      toast({
        title: "Connection error",
        description: "Error testing connection to Replit server",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveServerUrl = () => {
    if (!serverUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid server URL",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate URL format
      new URL(serverUrl);
      replitApiService.setServerUrl(serverUrl);
      toast({
        title: "Server URL saved",
        description: "Replit server URL has been updated",
      });
      testConnection(); // Test new connection
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL format",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Replit Server Configuration
        </CardTitle>
        <CardDescription>
          Configure the connection to your hosted Replit email server
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="serverUrl">Replit Server URL</Label>
          <Input
            id="serverUrl"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://your-repl-name.your-username.repl.co"
            type="url"
          />
          <p className="text-sm text-muted-foreground">
            Enter the URL of your hosted Replit email server. You can find this in your Replit project.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={saveServerUrl} variant="outline">
            Save URL
          </Button>
          <Button 
            onClick={testConnection} 
            disabled={isTestingConnection}
            variant="outline"
          >
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Label>Connection Status:</Label>
          {isConnected === null ? (
            <Badge variant="secondary">Unknown</Badge>
          ) : isConnected ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </div>

        {isConnected === false && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Connection failed.</strong> Please check:
            </p>
            <ul className="text-sm text-yellow-700 mt-1 ml-4 list-disc">
              <li>The Replit server URL is correct</li>
              <li>Your Replit project is running</li>
              <li>You have an internet connection</li>
            </ul>
          </div>
        )}

        {isConnected && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              <strong>Connected successfully!</strong> Your electron app can now send emails through your Replit server.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}