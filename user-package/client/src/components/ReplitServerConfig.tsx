import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { replitApiService } from "@/services/replitApiService";

export function ReplitServerConfig() {
  const [serverUrl, setServerUrl] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [testStatus, setTestStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<{ message: string; valid: boolean } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('replit_server_url') || '';
    const savedLicense = localStorage.getItem('license_key') || '';
    setServerUrl(savedUrl);
    setLicenseKey(savedLicense);
  }, []);

  const handleSaveServerUrl = () => {
    const trimmedUrl = serverUrl.trim();
    if (trimmedUrl) {
      try {
        replitApiService.setServerUrl(trimmedUrl);
        localStorage.setItem('replit_server_url', trimmedUrl);
        setTestStatus({ message: "Server URL saved successfully", success: true });
        setTimeout(() => setTestStatus(null), 3000);
      } catch (error) {
        setTestStatus({ message: "Failed to save server URL", success: false });
      }
    }
  };

  const handleSaveLicenseKey = () => {
    const trimmedKey = licenseKey.trim();
    if (trimmedKey) {
      localStorage.setItem('license_key', trimmedKey);
      setLicenseStatus({ message: "License key saved successfully", valid: true });
      setTimeout(() => setLicenseStatus(null), 3000);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await replitApiService.testConnection(serverUrl.trim() || undefined);
      setTestStatus({
        message: result.message,
        success: result.success
      });
    } catch (error) {
      setTestStatus({
        message: "Connection test failed",
        success: false
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleVerifyLicense = async () => {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      setLicenseStatus({ message: "Please enter a license key", valid: false });
      return;
    }

    const currentServerUrl = serverUrl.trim() || localStorage.getItem('replit_server_url');
    if (!currentServerUrl) {
      setLicenseStatus({ message: "Please configure server URL first", valid: false });
      return;
    }

    setIsVerifyingLicense(true);
    try {
      const response = await fetch(`${currentServerUrl}/api/license/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-License-Key': trimmedKey
        }
      });

      const result = await response.json();
      
      if (result.valid) {
        localStorage.setItem('license_key', trimmedKey);
        setLicenseStatus({ message: "License key is valid!", valid: true });
      } else {
        setLicenseStatus({ message: result.message || "License key is invalid", valid: false });
      }
    } catch (error) {
      setLicenseStatus({ message: "Failed to verify license key", valid: false });
    } finally {
      setIsVerifyingLicense(false);
    }
  };

  return (
    <div className="settings-section space-y-6">
      <h3 className="text-sm font-semibold text-[#ef4444] mb-4 pb-2 border-b border-[#26262b]">
        Server & License Configuration
      </h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="server-url" className="text-xs font-semibold text-[#a1a1aa] mb-2 block">
            Replit Server URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="server-url"
              type="url"
              placeholder="https://your-replit-server.repl.co"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="flex-1 bg-[#0f0f12] border-[#26262b] text-white text-xs"
              data-testid="input-server-url"
            />
            <Button
              onClick={handleSaveServerUrl}
              size="sm"
              className="bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs"
              data-testid="button-save-server-url"
            >
              Save
            </Button>
            <Button
              onClick={handleTestConnection}
              size="sm"
              disabled={isTestingConnection}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs"
              data-testid="button-test-connection"
            >
              {isTestingConnection ? "Testing..." : "Test"}
            </Button>
          </div>
          {testStatus && (
            <p className={`text-xs mt-2 ${testStatus.success ? 'text-green-500' : 'text-red-500'}`}>
              {testStatus.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="license-key" className="text-xs font-semibold text-[#a1a1aa] mb-2 block">
            License Key
          </Label>
          <div className="flex gap-2">
            <Input
              id="license-key"
              type="password"
              placeholder="Enter your license key from Telegram bot"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="flex-1 bg-[#0f0f12] border-[#26262b] text-white text-xs"
              data-testid="input-license-key"
            />
            <Button
              onClick={handleSaveLicenseKey}
              size="sm"
              className="bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs"
              data-testid="button-save-license-key"
            >
              Save
            </Button>
            <Button
              onClick={handleVerifyLicense}
              size="sm"
              disabled={isVerifyingLicense}
              className="bg-[#10b981] hover:bg-[#059669] text-white text-xs"
              data-testid="button-verify-license"
            >
              {isVerifyingLicense ? "Verifying..." : "Verify"}
            </Button>
          </div>
          {licenseStatus && (
            <p className={`text-xs mt-2 ${licenseStatus.valid ? 'text-green-500' : 'text-red-500'}`}>
              {licenseStatus.message}
            </p>
          )}
          <p className="text-[10px] text-[#71717a] mt-2">
            Get your license key from our Telegram bot. Both server URL and valid license are required for email operations.
          </p>
        </div>
      </div>
    </div>
  );
}
