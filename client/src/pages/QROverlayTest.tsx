
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';

interface QRTestSettings {
  qrContent: string;
  qrSize: number;
  qrBorder: number;
  qrForegroundColor: string;
  qrBackgroundColor: string;
  qrBorderColor: string;
  borderStyle: string;
  hiddenImageFile: string;
  hiddenImageSize: number;
  hiddenText: string;
  showOverlay: boolean;
}

interface QRTestResponse {
  success: boolean;
  qrHtml: string;
  testPageHtml: string;
  settings: any;
  error?: string;
}

export default function QROverlayTest() {
  const [settings, setSettings] = useState<QRTestSettings>({
    qrContent: 'https://example.com?email={email}',
    qrSize: 200,
    qrBorder: 2,
    qrForegroundColor: '#000000',
    qrBackgroundColor: '#FFFFFF',
    qrBorderColor: '#000000',
    borderStyle: 'solid',
    hiddenImageFile: '',
    hiddenImageSize: 50,
    hiddenText: '',
    showOverlay: true
  });

  const [logoFiles, setLogoFiles] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<QRTestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load logo files and config on mount
  useEffect(() => {
    loadLogoFiles();
    loadConfig();
  }, []);

  const loadLogoFiles = async () => {
    try {
      const response = await fetch('/api/test/logo-files');
      const data = await response.json();
      setLogoFiles(data.files || []);
    } catch (error) {
      console.error('Failed to load logo files:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/test/config');
      const data = await response.json();
      if (data.success) {
        setSettings(prev => ({
          ...prev,
          qrSize: data.config.QR_WIDTH || 200,
          qrBorder: data.config.QR_BORDER_WIDTH || 2,
          qrBorderColor: data.config.QR_BORDER_COLOR || '#000000',
          qrForegroundColor: data.config.QR_FOREGROUND_COLOR || '#000000',
          qrBackgroundColor: data.config.QR_BACKGROUND_COLOR || '#FFFFFF',
          borderStyle: data.config.BORDER_STYLE || 'solid',
          hiddenImageFile: data.config.HIDDEN_IMAGE_FILE || '',
          hiddenImageSize: data.config.HIDDEN_IMAGE_SIZE || 50,
          hiddenText: data.config.HIDDEN_TEXT || ''
        }));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const generateQRTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/qr-overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      setTestResult(data);
    } catch (error: any) {
      setTestResult({
        success: false,
        qrHtml: '',
        testPageHtml: '',
        settings: {},
        error: error.message || 'Failed to generate QR test'
      });
    } finally {
      setLoading(false);
    }
  };

  const openTestPage = () => {
    if (testResult?.testPageHtml) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(testResult.testPageHtml);
        newWindow.document.close();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <Card className="bg-[#0f0f17] border-[#26262b] mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-white">🔍 QR Code Overlay Test Tool</CardTitle>
            <p className="text-[#75798b]">
              Test your QR code overlay settings without sending emails. Perfect for fine-tuning your hidden image and text overlays.
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <Card className="bg-[#0f0f17] border-[#26262b]">
            <CardHeader>
              <CardTitle className="text-lg text-white">⚙️ QR Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Content */}
              <div>
                <Label className="text-white">QR Content URL</Label>
                <Input
                  value={settings.qrContent}
                  onChange={(e) => setSettings({...settings, qrContent: e.target.value})}
                  className="bg-[#0a0a0f] border-[#26262b] text-white"
                  placeholder="https://example.com?email={email}"
                />
                <p className="text-xs text-[#75798b] mt-1">Use {'{email}'} as placeholder for recipient email</p>
              </div>

              {/* QR Appearance */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">QR Size (px)</Label>
                  <Input
                    type="number"
                    value={settings.qrSize}
                    onChange={(e) => setSettings({...settings, qrSize: parseInt(e.target.value) || 200})}
                    className="bg-[#0a0a0f] border-[#26262b] text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Border Width (px)</Label>
                  <Input
                    type="number"
                    value={settings.qrBorder}
                    onChange={(e) => setSettings({...settings, qrBorder: parseInt(e.target.value) || 2})}
                    className="bg-[#0a0a0f] border-[#26262b] text-white"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-white">QR Foreground</Label>
                  <Input
                    type="color"
                    value={settings.qrForegroundColor}
                    onChange={(e) => setSettings({...settings, qrForegroundColor: e.target.value})}
                    className="bg-[#0a0a0f] border-[#26262b] h-10"
                  />
                </div>
                <div>
                  <Label className="text-white">QR Background</Label>
                  <Input
                    type="color"
                    value={settings.qrBackgroundColor}
                    onChange={(e) => setSettings({...settings, qrBackgroundColor: e.target.value})}
                    className="bg-[#0a0a0f] border-[#26262b] h-10"
                  />
                </div>
                <div>
                  <Label className="text-white">Border Color</Label>
                  <Input
                    type="color"
                    value={settings.qrBorderColor}
                    onChange={(e) => setSettings({...settings, qrBorderColor: e.target.value})}
                    className="bg-[#0a0a0f] border-[#26262b] h-10"
                  />
                </div>
              </div>

              {/* Border Style */}
              <div>
                <Label className="text-white">Border Style</Label>
                <Select value={settings.borderStyle} onValueChange={(value) => setSettings({...settings, borderStyle: value})}>
                  <SelectTrigger className="bg-[#0a0a0f] border-[#26262b] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0f17] border-[#26262b] text-white">
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Overlay Settings */}
              <div className="border-t border-[#26262b] pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-white">Enable Overlay</Label>
                  <Switch
                    checked={settings.showOverlay}
                    onCheckedChange={(checked) => setSettings({...settings, showOverlay: checked})}
                  />
                </div>

                {settings.showOverlay && (
                  <div className="space-y-4">
                    {/* Hidden Image */}
                    <div>
                      <Label className="text-white">Hidden Image File</Label>
                      <Select value={settings.hiddenImageFile} onValueChange={(value) => setSettings({...settings, hiddenImageFile: value})}>
                        <SelectTrigger className="bg-[#0a0a0f] border-[#26262b] text-white">
                          <SelectValue placeholder="Select image file" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f0f17] border-[#26262b] text-white">
                          <SelectItem value="">None</SelectItem>
                          {logoFiles.map(file => (
                            <SelectItem key={file} value={file}>{file}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-white">Hidden Image Size (px)</Label>
                      <Input
                        type="number"
                        value={settings.hiddenImageSize}
                        onChange={(e) => setSettings({...settings, hiddenImageSize: parseInt(e.target.value) || 50})}
                        className="bg-[#0a0a0f] border-[#26262b] text-white"
                      />
                    </div>

                    <div>
                      <Label className="text-white">Hidden Text (fallback if no image)</Label>
                      <Textarea
                        value={settings.hiddenText}
                        onChange={(e) => setSettings({...settings, hiddenText: e.target.value})}
                        className="bg-[#0a0a0f] border-[#26262b] text-white"
                        placeholder="Optional text overlay"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button 
                onClick={generateQRTest} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Generating...' : '🔍 Generate QR Test'}
              </Button>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="bg-[#0f0f17] border-[#26262b]">
            <CardHeader>
              <CardTitle className="text-lg text-white">👁️ Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {testResult ? (
                <div className="space-y-4">
                  {testResult.success ? (
                    <>
                      <div 
                        className="bg-white p-4 rounded border text-center"
                        dangerouslySetInnerHTML={{ __html: testResult.qrHtml }}
                      />
                      
                      <div className="text-xs text-[#75798b] bg-[#0a0a0f] p-3 rounded">
                        <div className="font-semibold mb-2">Test Results:</div>
                        <div>• Overlay Applied: {testResult.settings.overlayApplied ? '✅ Yes' : '❌ No'}</div>
                        <div>• QR Size: {testResult.settings.qrSize}px</div>
                        <div>• Hidden Image: {testResult.settings.hiddenImageFile || 'None'}</div>
                        <div>• Hidden Text: {testResult.settings.hiddenText || 'None'}</div>
                      </div>

                      <Button 
                        onClick={openTestPage}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        🚀 Open Full Test Page
                      </Button>
                    </>
                  ) : (
                    <div className="text-red-400 p-4 bg-red-900/20 rounded">
                      Error: {testResult.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-[#75798b] py-8">
                  Click "Generate QR Test" to see preview
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#0f0f17] border-[#26262b] mt-6">
          <CardContent className="pt-6">
            <div className="text-xs text-[#75798b] space-y-1">
              <div className="text-yellow-400 font-semibold mb-2">💡 QR Overlay Test Info:</div>
              <div>• This tool replicates the exact overlay positioning used in your email campaigns</div>
              <div>• Image overlay position: <code className="text-cyan-400">top:77px; left:56%</code> (centered)</div>
              <div>• Text overlay position: <code className="text-cyan-400">top:50px; left:50%</code> (centered)</div>
              <div>• Load images from <code className="text-green-400">/files/logo/</code> directory</div>
              <div>• Use the full test page to see how the QR code will appear in emails</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
