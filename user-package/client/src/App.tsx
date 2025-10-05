import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import OriginalEmailSender from "@/pages/OriginalEmailSender";
import { useEffect, useState } from "react";
import { licenseService } from "@/services/licenseService";

function RouterComponent() {
  return (
    <Switch>
      <Route path="/" component={OriginalEmailSender} />
    </Switch>
  );
}

function App() {
  const [licenseStatus, setLicenseStatus] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    const verifyLicenseOnStartup = async () => {
      // Debug: log what we're seeing
      console.log('[App] Starting license check...');
      console.log('[App] window.LICENSE_KEY:', (window as any).LICENSE_KEY ? 'SET' : 'NOT SET');
      console.log('[App] window.REPLIT_SERVER_URL:', (window as any).REPLIT_SERVER_URL || 'NOT SET');
      console.log('[App] localStorage license_key:', localStorage.getItem('license_key') || 'NOT SET');
      console.log('[App] localStorage replit_server_url:', localStorage.getItem('replit_server_url') || 'NOT SET');
      
      if (licenseService.isConfigured()) {
        console.log('[App] License configured, verifying...');
        const result = await licenseService.verifyLicense();
        setLicenseStatus(result);
        
        if (!result.valid) {
          console.warn('[App] License verification failed:', result.message);
        } else {
          console.log('[App] License verified successfully');
        }
      } else {
        console.log('[App] License NOT configured');
        setLicenseStatus({
          valid: false,
          message: "License key or server URL not configured"
        });
      }
    };

    // Wait a bit for Electron to inject environment variables
    setTimeout(verifyLicenseOnStartup, 500);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {licenseStatus && !licenseStatus.valid && (
          <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 px-4 z-50 text-sm" data-testid="license-warning-banner">
            ⚠️ {licenseStatus.message} - Email sending disabled. Configure in Settings.
          </div>
        )}
        <Router hook={useHashLocation}>
          <RouterComponent />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
