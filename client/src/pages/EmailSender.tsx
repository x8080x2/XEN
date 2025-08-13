import { useState } from "react";
import WindowControls from "@/components/WindowControls";
import Sidebar from "@/components/Sidebar";
import EmailForm from "@/components/EmailForm";
import ProgressSection from "@/components/ProgressSection";
import SettingsOverlay from "@/components/SettingsOverlay";

export default function EmailSender() {
  const [activeSection, setActiveSection] = useState("email-sender");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-dark-bg text-dark-text font-mono">
      <WindowControls />
      
      <div className="flex h-[calc(100vh-28px)]">
        <Sidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onSettingsOpen={() => setShowSettings(true)}
        />
        
        <div className="flex-1 p-1 overflow-y-auto bg-dark-bg">
          <div className="max-w-4xl mx-auto">
            <div className="bg-dark-surface p-3 shadow-lg">
              <EmailForm />
              <ProgressSection />
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsOverlay onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
