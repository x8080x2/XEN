import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsOverlayProps {
  onClose: () => void;
  currentSettings?: any;
  onSettingsChange?: (settings: any) => void;
}

export default function SettingsOverlay({ onClose, currentSettings, onSettingsChange }: SettingsOverlayProps) {
  const [settings, setSettings] = useState({
    emailValidation: {
      enabled: currentSettings?.emailValidation?.enabled ?? true,
      strictMode: currentSettings?.emailValidation?.strictMode ?? false
    },
    delivery: {
      enableTracking: currentSettings?.delivery?.enableTracking ?? false,
      retryFailures: currentSettings?.delivery?.retryFailures ?? true,
      maxRetries: currentSettings?.delivery?.maxRetries || 3
    },
    ui: {
      darkMode: currentSettings?.ui?.darkMode ?? true,
      compactView: currentSettings?.ui?.compactView ?? false
    }
  });

  const handleSave = () => {
    console.log("Saving settings:", settings);
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex">
      <div className="ml-auto w-[840px] bg-[#131316] border-l border-[#26262b] overflow-y-auto p-4">
        {/* Settings Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">General Settings</h2>
          <button 
            className="text-[#a1a1aa] hover:text-white text-2xl transition-colors"
            onClick={onClose}
            data-testid="close-settings"
          >
            ×
          </button>
        </div>

        <div className="space-y-8">
          {/* Email Validation */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-[#ef4444] mb-4 pb-2 border-b border-[#26262b]">
              Email Validation
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="enable-validation"
                  checked={settings.emailValidation.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    emailValidation: { ...prev.emailValidation, enabled: !!checked }
                  }))}
                  data-testid="checkbox-enable-validation"
                />
                <Label htmlFor="enable-validation" className="text-xs font-semibold text-[#a1a1aa]">
                  Enable Email Validation
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="strict-mode"
                  checked={settings.emailValidation.strictMode}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    emailValidation: { ...prev.emailValidation, strictMode: !!checked }
                  }))}
                  data-testid="checkbox-strict-mode"
                />
                <Label htmlFor="strict-mode" className="text-xs font-semibold text-[#a1a1aa]">
                  Strict Validation Mode
                </Label>
              </div>
            </div>
          </div>

          {/* Delivery Options */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-[#ef4444] mb-4 pb-2 border-b border-[#26262b]">
              Delivery Options
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="enable-tracking"
                  checked={settings.delivery.enableTracking}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    delivery: { ...prev.delivery, enableTracking: !!checked }
                  }))}
                  data-testid="checkbox-enable-tracking"
                />
                <Label htmlFor="enable-tracking" className="text-xs font-semibold text-[#a1a1aa]">
                  Enable Delivery Tracking
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="retry-failures"
                  checked={settings.delivery.retryFailures}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    delivery: { ...prev.delivery, retryFailures: !!checked }
                  }))}
                  data-testid="checkbox-retry-failures"
                />
                <Label htmlFor="retry-failures" className="text-xs font-semibold text-[#a1a1aa]">
                  Auto Retry Failures
                </Label>
              </div>
              <div>
                <Label className="block text-xs font-semibold text-[#a1a1aa] mb-1">Max Retries</Label>
                <Input 
                  type="number"
                  min="1"
                  max="10"
                  className="bg-[#0f0f12] border-[#26262b] text-white text-xs"
                  value={settings.delivery.maxRetries}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    delivery: { ...prev.delivery, maxRetries: parseInt(e.target.value) || 3 }
                  }))}
                  data-testid="input-max-retries"
                />
              </div>
            </div>
          </div>

          {/* UI Preferences */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-[#ef4444] mb-4 pb-2 border-b border-[#26262b]">
              UI Preferences
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="dark-mode"
                  checked={settings.ui.darkMode}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    ui: { ...prev.ui, darkMode: !!checked }
                  }))}
                  data-testid="checkbox-dark-mode"
                />
                <Label htmlFor="dark-mode" className="text-xs font-semibold text-[#a1a1aa]">
                  Dark Mode
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="compact-view"
                  checked={settings.ui.compactView}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    ui: { ...prev.ui, compactView: !!checked }
                  }))}
                  data-testid="checkbox-compact-view"
                />
                <Label htmlFor="compact-view" className="text-xs font-semibold text-[#a1a1aa]">
                  Compact View
                </Label>
              </div>
            </div>
          </div>

          {/* Save Settings Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave}
              className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-6 py-2 font-semibold text-sm"
              data-testid="button-save-settings"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}