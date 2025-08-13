import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface EmailProgress {
  recipient: string;
  subject: string;
  status: 'success' | 'fail';
  error?: string;
  timestamp: string;
  totalSent?: number;
  totalFailed?: number;
  totalRecipients?: number;
}

interface SMTPSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export default function OriginalEmailSender() {
  // Form state - exact match to original
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [recipients, setRecipients] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [templateFiles, setTemplateFiles] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedAttachmentTemplate, setSelectedAttachmentTemplate] = useState("");
  const [attachmentHtml, setAttachmentHtml] = useState("");
  
  // SMTP Settings
  const [smtpSettings, setSMTPSettings] = useState<SMTPSettings>({
    host: "",
    port: "587",
    user: "",
    pass: "",
    fromEmail: "",
    fromName: ""
  });
  
  // Advanced settings - exact match to original main.js
  const [advancedSettings, setAdvancedSettings] = useState({
    qrcode: false,
    randomMetadata: false,
    minifyHtml: false,
    includeHtmlAttachment: false,
    htmlImgBody: false,
    zipUse: false,
    zipPassword: "",
    emailPerSecond: "5",
    sleep: "3",
    fileName: "attachment",
    htmlConvert: "pdf,png,docx", // Support multiple formats like main.js
    qrSize: "200",
    qrBorder: "2",
    qrBorderColor: "#000000",
    qrLink: "https://example.com",
    linkPlaceholder: "{email}",
    includeHiddenText: false,
    hiddenText: "&#9919;"
  });
  
  // Progress tracking
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [progressDetails, setProgressDetails] = useState("");
  const [emailLogs, setEmailLogs] = useState<EmailProgress[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update recipient count when recipients change
  useEffect(() => {
    const lines = recipients.split('\n').filter(line => line.trim() && line.includes('@'));
    setRecipientCount(lines.length);
  }, [recipients]);
  
  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, []);
  
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/original/listFiles');
      const data = await response.json();
      if (data.files) {
        setTemplateFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };
  
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };
  
  const removeAttachment = () => {
    setSelectedFiles(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const saveSMTPSettings = async () => {
    // In the original, this saves to config file
    console.log('Saving SMTP settings:', smtpSettings);
    setSenderEmail(smtpSettings.fromEmail);
    setStatusText("✓ SMTP settings saved");
    setTimeout(() => setStatusText(""), 3000);
  };
  
  const handleSendEmails = async () => {
    if (!recipients.trim() || !emailContent.trim() || !senderEmail.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    setProgress(0);
    setStatusText("Preparing to send emails...");
    setEmailLogs([]);
    setProgressDetails("");
    
    try {
      const formData = new FormData();
      
      // Add all form data - exact match to original args
      formData.append('senderEmail', senderEmail);
      formData.append('senderName', senderName);
      formData.append('subject', subject);
      formData.append('html', emailContent);
      formData.append('attachmentHtml', attachmentHtml);
      formData.append('recipients', JSON.stringify(recipients.split('\n').filter(r => r.trim())));
      
      // SMTP settings
      formData.append('smtpHost', smtpSettings.host);
      formData.append('smtpPort', smtpSettings.port);
      formData.append('smtpUser', smtpSettings.user);
      formData.append('smtpPass', smtpSettings.pass);
      
      // Advanced settings
      Object.entries(advancedSettings).forEach(([key, value]) => {
        formData.append(key, value.toString());
      });
      
      // Add files
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('attachments', selectedFiles[i]);
        }
      }
      
      // Use Server-Sent Events for real-time progress
      const response = await fetch('/api/original/sendMail', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to start email sending');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  const progressData: EmailProgress = data;
                  setEmailLogs(prev => [...prev, progressData]);
                  
                  if (progressData.totalRecipients) {
                    const currentProgress = ((progressData.totalSent || 0) + (progressData.totalFailed || 0)) / progressData.totalRecipients * 100;
                    setProgress(currentProgress);
                    setProgressDetails(`Sent: ${progressData.totalSent || 0}, Failed: ${progressData.totalFailed || 0}, Total: ${progressData.totalRecipients}`);
                  }
                  
                  if (data.status === 'success') {
                    setStatusText(`✓ Email sent to ${data.recipient}`);
                  } else {
                    setStatusText(`✗ Failed to send to ${data.recipient}: ${data.error}`);
                  }
                } else if (data.type === 'complete') {
                  setIsLoading(false);
                  setProgress(100);
                  setStatusText(`Email sending completed. Sent: ${data.sent} emails`);
                  if (!data.success && data.error) {
                    console.error('Email sending error:', data.error);
                  }
                } else if (data.type === 'error') {
                  setIsLoading(false);
                  setStatusText(`Error: ${data.error}`);
                  console.error('Email sending error:', data.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
      
    } catch (error: any) {
      setIsLoading(false);
      setStatusText(`Error: ${error.message}`);
      console.error('Email sending error:', error);
    }
  };
  
  const cancelSending = async () => {
    try {
      await fetch('/api/original/pause', { method: 'POST' });
      setIsLoading(false);
      setStatusText("Email sending cancelled");
    } catch (error) {
      console.error('Failed to cancel sending:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7] font-mono">
      {/* Window Controls */}
      <div className="flex justify-end items-center h-8 bg-[#131316] border-b border-[#26262b] px-4">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3f3f46] hover:bg-[#52525b] cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#ef4444] hover:bg-[#dc2626] cursor-pointer"></div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#131316] border-r border-[#26262b] min-h-screen">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[#ef4444] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                SM
              </div>
              <div>
                <div className="font-semibold text-white">Closed V6</div>
              </div>
            </div>
            
            <nav className="space-y-2">
              <div className="bg-[#ef4444] text-white px-4 py-2 rounded cursor-pointer">
                Mailer
              </div>
              <div 
                className="text-[#a1a1aa] px-4 py-2 rounded hover:bg-[#ef4444] hover:text-white cursor-pointer"
                onClick={() => setShowSettings(!showSettings)}
              >
                Settings
              </div>
            </nav>
          </div>
          
          {/* User Profile */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-[#131316] border border-[#26262b] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#ef4444] rounded-full"></div>
                <div>
                  <div className="font-semibold text-sm text-white">User</div>
                  <div className="text-xs text-[#ef4444]">Administrator</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#131316] rounded-xl border border-[#26262b] p-6">
              {/* Sender Email, Name, Subject Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Sender Email</Label>
                  <Input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="sender@example.com"
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    readOnly={!senderEmail}
                  />
                  {senderEmail && (
                    <div className="text-xs text-green-500 mt-1">✓ Loaded from SMTP config</div>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Sender Name</Label>
                  <Input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your Name"
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                  />
                </div>
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                  />
                </div>
              </div>

              {/* Main Content Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Letter */}
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Letter</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Enter your letter content here..."
                    className="bg-[#0f0f12] border-[#26262b] text-white min-h-[200px]"
                  />
                  <div className="mt-2">
                    <Label className="text-xs text-[#a1a1aa]">Main Letter</Label>
                    <Select value={selectedTemplate || "off"} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-xs">
                        <SelectValue placeholder="-- Off --" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#131316] border-[#26262b]">
                        <SelectItem value="off">-- Off --</SelectItem>
                        {templateFiles.map(file => (
                          <SelectItem key={file} value={file}>{file}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Maillist */}
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Maillist</Label>
                  <Textarea
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="recipient1@example.com&#10;recipient2@example.com&#10;recipient3@example.com"
                    className="bg-[#0f0f12] border-[#26262b] text-white min-h-[200px]"
                  />
                  <div className="text-xs text-[#75798b] mt-1">
                    {recipientCount} recipients
                  </div>
                  <details className="mt-2">
                    <summary className="text-xs text-[#ef4444] cursor-pointer font-semibold">Placeholders</summary>
                    <div className="text-xs text-[#a1a1aa] mt-2 space-y-1">
                      <div>Available placeholders:</div>
                      <div className="font-mono text-[10px] space-y-1">
                        <div>Basic: {'{user}'}, {'{username}'}, {'{email}'}, {'{domain}'}, {'{date}'}, {'{time}'}</div>
                        <div>Advanced: {'{userupper}'}, {'{userlower}'}, {'{domainbase}'}, {'{initials}'}, {'{userid}'}</div>
                        <div>Random: {'{randfirst}'}, {'{randlast}'}, {'{randname}'}, {'{randcompany}'}, {'{randdomain}'}, {'{randtitle}'}</div>
                        <div>Dynamic: {'{hash6}'}, {'{randnum4}'}, {'{hashN}'}, {'{randnumN}'}</div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Second Row - Attachment HTML Template */}
              <div className="mb-6">
                <Label className="text-sm text-[#a1a1aa] mb-2">Attachment HTML Template</Label>
                <Textarea
                  value={attachmentHtml}
                  onChange={(e) => setAttachmentHtml(e.target.value)}
                  placeholder="Enter HTML template for attachments (will be converted to PDF/PNG/DOCX)..."
                  className="bg-[#0f0f12] border-[#26262b] text-white min-h-[150px]"
                />
                <div className="mt-2">
                  <Label className="text-xs text-[#a1a1aa]">Attach Template File</Label>
                  <Select value={selectedAttachmentTemplate || "off"} onValueChange={setSelectedAttachmentTemplate}>
                    <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-xs">
                      <SelectValue placeholder="-- Off --" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131316] border-[#26262b]">
                      <SelectItem value="off">-- Off --</SelectItem>
                      {templateFiles.map(file => (
                        <SelectItem key={file} value={file}>{file}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Third Row - Attachment Files */}
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">
                {/* Attachment */}
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Attachment</Label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={handleFileSelect}
                      className="w-full bg-[#ef4444] hover:bg-[#dc2626] border-[#ef4444] text-white"
                    >
                      📎 Choose File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {selectedFiles && selectedFiles.length > 0 && (
                      <div className="flex items-center justify-between bg-[#0f0f12] border border-[#26262b] rounded px-3 py-2">
                        <span className="text-xs text-[#a1a1aa]">
                          {selectedFiles.length} file(s) selected
                        </span>
                        <button
                          onClick={removeAttachment}
                          className="text-[#ef4444] hover:text-[#dc2626] text-sm"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <div className="text-xs text-[#75798b]">Supports various file formats</div>
                  </div>
                </div>
              </div>

              {/* Progress Section */}
              {isLoading && (
                <div className="mb-6">
                  <div className="bg-[#ef4444] text-white px-4 py-2 rounded-t text-sm">
                    {statusText}
                  </div>
                  <div className="bg-[#1d1d21] p-2 rounded-b">
                    <Progress value={progress} className="mb-2" />
                    <div className="text-xs text-[#75798b] mb-2">{progressDetails}</div>
                    <div className="max-h-80 overflow-y-auto bg-[#0f0f12] border border-[#26262b] rounded p-2">
                      {emailLogs.map((log, index) => (
                        <div
                          key={index}
                          className={`text-xs py-1 ${
                            log.status === 'success' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          [{log.timestamp.slice(11, 19)}] {log.status === 'success' ? '✓' : '✗'} {log.recipient} - {log.subject}
                          {log.error && <span className="text-red-300"> ({log.error})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 sticky bottom-0 bg-[#131316] pt-4">
                <Button
                  onClick={handleSendEmails}
                  disabled={isLoading}
                  className="min-w-[110px] bg-[#ef4444] hover:bg-[#dc2626] text-white"
                >
                  {isLoading ? 'SENDING...' : 'SEND'}
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelSending}
                  disabled={!isLoading}
                  className="min-w-[110px] border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                >
                  CANCEL
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(!showSettings)}
                  className="min-w-[110px] border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                >
                  Settings
                </Button>
              </div>
            </div>

            {/* SMTP Settings */}
            <div className="mt-6 bg-black rounded-xl p-4 border border-[#26262b]">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm text-[#a1a1aa]">SMTP:</span>
                <Input
                  placeholder="Host"
                  value={smtpSettings.host}
                  onChange={(e) => setSMTPSettings({...smtpSettings, host: e.target.value})}
                  className="w-32 h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  type="number"
                  placeholder="Port"
                  value={smtpSettings.port}
                  onChange={(e) => setSMTPSettings({...smtpSettings, port: e.target.value})}
                  className="w-20 h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  placeholder="User"
                  value={smtpSettings.user}
                  onChange={(e) => setSMTPSettings({...smtpSettings, user: e.target.value})}
                  className="w-28 h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  type="password"
                  placeholder="Pass"
                  value={smtpSettings.pass}
                  onChange={(e) => setSMTPSettings({...smtpSettings, pass: e.target.value})}
                  className="w-24 h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  type="email"
                  placeholder="Sender Email"
                  value={smtpSettings.fromEmail}
                  onChange={(e) => setSMTPSettings({...smtpSettings, fromEmail: e.target.value})}
                  className="w-40 h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Button
                  onClick={saveSMTPSettings}
                  className="h-8 px-4 bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="mt-4 bg-black rounded-xl p-4 border border-[#26262b]">
              <div className="flex flex-wrap items-center gap-6">
                <span className="text-sm text-[#a1a1aa] font-semibold">Checkbox Settings:</span>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.qrcode}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, qrcode: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">QR Code</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.randomMetadata}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, randomMetadata: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">Randomize Metadata</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.minifyHtml}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, minifyHtml: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">Minify HTML</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.zipUse}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, zipUse: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">ZIP Attachments</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.includeHtmlAttachment}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, includeHtmlAttachment: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">Include HTML Attachment</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.htmlImgBody}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, htmlImgBody: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">HTML as Image Body</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={advancedSettings.includeHiddenText}
                    onCheckedChange={(checked) => 
                      setAdvancedSettings({...advancedSettings, includeHiddenText: !!checked})
                    }
                  />
                  <Label className="text-xs text-[#a1a1aa]">Include Hidden Text Overlay</Label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Overlay */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
            <div className="bg-[#131316] border border-[#26262b] rounded-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Advanced Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-[#a1a1aa] hover:text-white text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">QR Size</Label>
                    <Input
                      type="number"
                      value={advancedSettings.qrSize}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, qrSize: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">QR Border Width</Label>
                    <Input
                      type="number"
                      value={advancedSettings.qrBorder}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, qrBorder: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">QR Border Color</Label>
                    <Input
                      type="color"
                      value={advancedSettings.qrBorderColor}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, qrBorderColor: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm text-[#a1a1aa]">QR Link (use {"{email}"} placeholder)</Label>
                  <Input
                    value={advancedSettings.qrLink}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, qrLink: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="https://example.com?user={email}"
                  />
                </div>
                
                <div>
                  <Label className="text-sm text-[#a1a1aa]">Link Placeholder</Label>
                  <Input
                    value={advancedSettings.linkPlaceholder}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, linkPlaceholder: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="{email}"
                  />
                </div>
                
                <div>
                  <Label className="text-sm text-[#a1a1aa]">Hidden Text Overlay (HTML entities supported)</Label>
                  <Input
                    value={advancedSettings.hiddenText}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, hiddenText: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="&#9919; or custom text"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">ZIP Password (for attachments)</Label>
                    <Input
                      type="password"
                      value={advancedSettings.zipPassword}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, zipPassword: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Attachment File Name</Label>
                    <Input
                      value={advancedSettings.fileName}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, fileName: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                      placeholder="attachment"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm text-[#a1a1aa]">HTML Convert Formats (comma-separated: pdf,png,docx)</Label>
                  <Input
                    value={advancedSettings.htmlConvert}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, htmlConvert: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="pdf,png,docx"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Emails per Second</Label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={advancedSettings.emailPerSecond}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, emailPerSecond: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Sleep Between Batches (seconds)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={advancedSettings.sleep}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, sleep: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowSettings(false)}
                    className="border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}