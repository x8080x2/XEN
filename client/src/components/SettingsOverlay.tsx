import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SettingsOverlayProps {
  onClose: () => void;
}

export default function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const [settings, setSettings] = useState({
    smtp: {
      host: "smtp.gmail.com",
      port: 587,
      security: "tls",
      username: "",
      password: "",
      priority: 2
    },
    html: {
      minify: true,
      includeAttachment: false,
      bodyOnly: false,
      hiddenText: "",
      convertTo: "",
      logoSize: "50%"
    },
    qr: {
      enabled: true,
      link: "https://fb.com",
      width: 200,
      borderStyle: "solid",
      borderColor: "#000000",
      randomMetadata: false
    },
    zip: {
      enabled: false,
      password: "",
      filenameTemplate: "{user}_{date}"
    },
    proxy: {
      enabled: false,
      type: "socks5",
      host: "127.0.0.1",
      port: 1080,
      username: "",
      password: ""
    }
  });

  const handleSave = () => {
    // Save settings logic here
    console.log("Saving settings:", settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex">
      <div className="ml-auto w-[840px] bg-dark-surface border-l border-dark-border overflow-y-auto p-4">
        {/* Settings Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-dark-text">Settings</h2>
          <button 
            className="text-red-400 text-2xl hover:text-red-300 transition-colors"
            onClick={onClose}
            data-testid="close-settings"
          >
            ×
          </button>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          {/* SMTP Configuration */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-red-primary mb-4 pb-2 border-b border-dark-border">
              SMTP Configuration
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">SMTP Host</Label>
                <Input 
                  className="dark-input text-xs"
                  value={settings.smtp.host}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    smtp: { ...prev.smtp, host: e.target.value }
                  }))}
                  data-testid="settings-smtp-host"
                />
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">Port</Label>
                <Input 
                  type="number"
                  className="dark-input text-xs"
                  value={settings.smtp.port}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    smtp: { ...prev.smtp, port: parseInt(e.target.value) || 587 }
                  }))}
                  data-testid="settings-smtp-port"
                />
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">Security</Label>
                <Select 
                  value={settings.smtp.security}
                  onValueChange={(value) => setSettings(prev => ({
                    ...prev,
                    smtp: { ...prev.smtp, security: value }
                  }))}
                >
                  <SelectTrigger className="dark-input text-xs" data-testid="settings-smtp-security">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* HTML Processing */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-red-primary mb-4 pb-2 border-b border-dark-border">
              HTML Processing
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="minify-html"
                  checked={settings.html.minify}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    html: { ...prev.html, minify: !!checked }
                  }))}
                  data-testid="checkbox-minify-html"
                />
                <Label htmlFor="minify-html" className="text-xs font-semibold text-dark-text">
                  Minify HTML
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="include-attachment"
                  checked={settings.html.includeAttachment}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    html: { ...prev.html, includeAttachment: !!checked }
                  }))}
                  data-testid="checkbox-include-attachment"
                />
                <Label htmlFor="include-attachment" className="text-xs font-semibold text-dark-text">
                  Include HTML Attachment
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="body-only"
                  checked={settings.html.bodyOnly}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    html: { ...prev.html, bodyOnly: !!checked }
                  }))}
                  data-testid="checkbox-body-only"
                />
                <Label htmlFor="body-only" className="text-xs font-semibold text-dark-text">
                  HTML to Body Only
                </Label>
              </div>
            </div>
          </div>

          {/* QR Code Settings */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-red-primary mb-4 pb-2 border-b border-dark-border">
              QR Code Settings
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="enable-qr"
                  checked={settings.qr.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    qr: { ...prev.qr, enabled: !!checked }
                  }))}
                  data-testid="checkbox-enable-qr"
                />
                <Label htmlFor="enable-qr" className="text-xs font-semibold text-dark-text">
                  Enable QR Code
                </Label>
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">QR Link</Label>
                <Input 
                  type="url"
                  className="dark-input text-xs"
                  value={settings.qr.link}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    qr: { ...prev.qr, link: e.target.value }
                  }))}
                  data-testid="input-qr-link"
                />
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">QR Width</Label>
                <Input 
                  type="number"
                  className="dark-input text-xs"
                  value={settings.qr.width}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    qr: { ...prev.qr, width: parseInt(e.target.value) || 200 }
                  }))}
                  data-testid="input-qr-width"
                />
              </div>
            </div>
          </div>

          {/* ZIP Settings */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-red-primary mb-4 pb-2 border-b border-dark-border">
              ZIP Settings
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="enable-zip"
                  checked={settings.zip.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    zip: { ...prev.zip, enabled: !!checked }
                  }))}
                  data-testid="checkbox-enable-zip"
                />
                <Label htmlFor="enable-zip" className="text-xs font-semibold text-dark-text">
                  Use ZIP Compression
                </Label>
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">ZIP Password</Label>
                <Input 
                  type="password"
                  className="dark-input text-xs"
                  placeholder="Optional password"
                  value={settings.zip.password}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    zip: { ...prev.zip, password: e.target.value }
                  }))}
                  data-testid="input-zip-password"
                />
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">File Name Template</Label>
                <Input 
                  className="dark-input text-xs"
                  placeholder="{user}_{date}"
                  value={settings.zip.filenameTemplate}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    zip: { ...prev.zip, filenameTemplate: e.target.value }
                  }))}
                  data-testid="input-zip-filename"
                />
              </div>
            </div>
          </div>

          {/* Proxy Settings */}
          <div className="settings-section">
            <h3 className="text-sm font-semibold text-red-primary mb-4 pb-2 border-b border-dark-border">
              Proxy Settings
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="enable-proxy"
                  checked={settings.proxy.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    proxy: { ...prev.proxy, enabled: !!checked }
                  }))}
                  data-testid="checkbox-enable-proxy"
                />
                <Label htmlFor="enable-proxy" className="text-xs font-semibold text-dark-text">
                  Use Proxy
                </Label>
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">Proxy Type</Label>
                <Select 
                  value={settings.proxy.type}
                  onValueChange={(value) => setSettings(prev => ({
                    ...prev,
                    proxy: { ...prev.proxy, type: value }
                  }))}
                >
                  <SelectTrigger className="dark-input text-xs" data-testid="settings-proxy-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block text-xs font-semibold text-dark-text mb-1">Proxy Host</Label>
                <Input 
                  className="dark-input text-xs"
                  placeholder="127.0.0.1"
                  value={settings.proxy.host}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    proxy: { ...prev.proxy, host: e.target.value }
                  }))}
                  data-testid="input-proxy-host"
                />
              </div>
            </div>
          </div>

          {/* Save Settings Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave}
              className="btn-primary px-6 py-2 font-semibold text-sm"
              data-testid="button-save-settings"
            >
              💾 Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
