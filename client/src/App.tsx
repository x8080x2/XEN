import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import OriginalEmailSender from "@/pages/OriginalEmailSender";
import WindowControls from "@/components/WindowControls";
import Sidebar from "@/components/Sidebar";
import SettingsOverlay from "@/components/SettingsOverlay";

function Router() {
  return (
    <Switch>
      <Route path="/" component={OriginalEmailSender} />
    </Switch>
  );
}

function App() {
  const [activeSection, setActiveSection] = useState("email-sender");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    // Hydrate settings from localStorage on initial load
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
    // Return default settings if no saved settings exist
    return {
      emailValidation: {
        enabled: true,
        strictMode: false
      },
      delivery: {
        enableTracking: false,
        retryFailures: true,
        maxRetries: 3
      },
      ui: {
        darkMode: true,
        compactView: false
      }
    };
  });

  const handleSettingsChange = (newSettings: any) => {
    setSettings(newSettings);
    // Optionally save to localStorage
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen">
          <WindowControls />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar 
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onSettingsOpen={() => setIsSettingsOpen(true)}
            />
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
        {isSettingsOpen && (
          <SettingsOverlay 
            onClose={() => setIsSettingsOpen(false)}
            currentSettings={settings}
            onSettingsChange={handleSettingsChange}
          />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
