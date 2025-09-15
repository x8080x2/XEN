import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CapabilityConfig } from "@/components/CapabilityConfig";

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
  // Template functionality removed - frontend-only version

  // Template functionality removed - frontend-only version

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
  // Initialize state from localStorage or defaults
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('emailFormData');
    return saved ? JSON.parse(saved) : {
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPass: '',
      senderEmail: '',
      senderName: '',
      subject: '',
      recipients: '',
      html: '',
      attachments: []
    };
  });

  const [advancedSettings, setAdvancedSettings] = useState(() => {
    const saved = localStorage.getItem('emailAdvancedSettings');
    return saved ? JSON.parse(saved) : {
      qrcode: false,  // ✅ SAFE: Disabled by default to match config
      qrSize: 200,
      qrLink: 'https://example.com',
      qrForegroundColor: '#000000',
      qrBackgroundColor: '#FFFFFF',
      qrBorder: 2,
      qrBorderColor: '#000000',
      linkPlaceholder: '',
      htmlImgBody: false,  // ✅ SAFE: Disabled by default to match config
      randomMetadata: false,

      emailPerSecond: '5',
      sleep: '3',
      priority: 'normal',
      retry: '0',
      zipUse: false,
      zipPassword: '',
      fileName: 'attachment',
      htmlConvert: '',
      calendarMode: false,


      domainLogoSize: '70%',
      borderStyle: 'solid',
      borderColor: '#000000',
      proxyUse: false,
      proxyType: 'socks5',
      proxyHost: '',
      proxyPort: '',
      proxyUser: '',
      proxyPass: '',
      hiddenImageFile: '',
      hiddenImageSize: 50,
      hiddenText: '',
    };
  });

  // Progress tracking
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [progressDetails, setProgressDetails] = useState("");
  const [emailLogs, setEmailLogs] = useState<EmailProgress[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [currentEmailStatus, setCurrentEmailStatus] = useState<string>("");
  const [recentlyAddedLogIndex, setRecentlyAddedLogIndex] = useState<number>(-1);

  // Refs for auto-scrolling
  const logContainerRef = useRef<HTMLDivElement>(null);
  const currentStatusRef = useRef<HTMLDivElement>(null);
  // SMTP data management removed - users provide SMTP settings directly

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update recipient count when recipients change
  useEffect(() => {
    const lines = recipients.split('\n').filter(line => line.trim() && line.includes('@'));
    setRecipientCount(lines.length);
  }, [recipients]);

  // Capability URL configuration
  const [capabilityUrl, setCapabilityUrl] = useState("");

  // Load capability URL from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('CAPABILITY_URL');
    if (saved) {
      setCapabilityUrl(saved);
    }
  }, []);

  // Update capability URL when CapabilityConfig changes it
  const handleCapabilityConfigured = (url: string) => {
    setCapabilityUrl(url);
  };

  // Check if capability URL is configured
  const isCapabilityConfigured = Boolean(capabilityUrl && capabilityUrl.trim());
  const canSendEmails = !isLoading && isCapabilityConfigured && recipientCount > 0 && emailContent.trim();

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current && emailLogs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;

      // Mark the latest log as recently added for highlighting
      setRecentlyAddedLogIndex(emailLogs.length - 1);

      // Clear the highlight after 3 seconds
      const timer = setTimeout(() => {
        setRecentlyAddedLogIndex(-1);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [emailLogs.length]);

  // Auto-scroll current status into view
  useEffect(() => {
    if (currentStatusRef.current && currentEmailStatus) {
      currentStatusRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentEmailStatus]);

  // Auto-load configuration on startup
  const loadConfigFromFiles = async () => {
    try {
      // Load main configuration
      const configResponse = await fetch('/api/config/load');
      const configData = await configResponse.json();

      if (configData.success && configData.config) {
        console.log('[Config Load] Configuration loaded successfully');

        // Load SMTP configuration
        const smtpResponse = await fetch('/api/smtp/list');
        const smtpData = await smtpResponse.json();

        if (smtpData.success && smtpData.currentSmtp) {
          setSenderEmail(smtpData.currentSmtp.fromEmail || '');
          setSenderName(smtpData.currentSmtp.fromName || '');
          console.log('[Config Load] Auto-set sender email:', smtpData.currentSmtp.fromEmail);
        }

        // Load leads
        const leadsResponse = await fetch('/api/config/loadLeads');
        const leadsData = await leadsResponse.json();

        if (leadsData.success && leadsData.leads) {
          setRecipients(leadsData.leads);
          const leadCount = leadsData.leads.split('\n').filter((line: string) => line.trim()).length;
          console.log(`[Config Load] Auto-loaded ${leadCount} leads from leads.txt`);
        }

        setStatusText('✓ Configuration and files loaded successfully');
        setTimeout(() => setStatusText(''), 3000);
      } else {
        console.warn('[Config Load] Failed to load configuration');
        setStatusText('⚠ Configuration not found - using defaults');
      }
    } catch (error) {
      console.error('[Config Load] Error loading configuration:', error);
      setStatusText('⚠ Error loading configuration files');
    }
  };

  // Auto-load configuration on startup
  useEffect(() => {
    loadConfigFromFiles();
  }, []);

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

  // Template functionality removed - users can paste content directly

  // Auto-load configuration removed - frontend-only version

  // SMTP Management Functions removed - frontend-only version
  // Users will provide SMTP settings directly in the form

  // Load configuration removed - frontend-only version

        // Advanced settings loading removed - frontend-only version
  // Configuration loading code removed - frontend-only version

  const saveSMTPSettings = () => {
    // Simplified for frontend-only version - just update local state
    console.log('Saving SMTP settings:', smtpSettings);
    setSenderEmail(smtpSettings.fromEmail);
    setStatusText("✓ SMTP settings saved");
    setTimeout(() => setStatusText(""), 3000);
  };

  const handleSendEmails = async () => {
    // Validation logic - exact clone from sender.html lines 1307-1321
    const recipientList = recipients.split('\n').filter(email => email.trim() !== '');

    if (!recipientList.length) {
      setStatusText('Please enter at least one recipient.');
      return;
    }

    if (!senderEmail.trim()) {
      setStatusText('Sender email is required (from SMTP config).');
      return;
    }

    // HTML content validation - simplified for frontend-only version
    let bodyHtml = '';

    // Use HTML from textarea
    if (emailContent.trim()) {
      bodyHtml = emailContent.trim();
    } else {
      setStatusText('Email content cannot be empty. Please enter your email content in the text area.');
      return;
    }

    // Set mainHtml for FormData
    const mainHtml = bodyHtml;

    setIsLoading(true);
    setProgress(0);
    setStatusText("Preparing to send emails...");
    setEmailLogs([]);
    setProgressDetails("");
    setCurrentEmailStatus("");

    try {
      const formData = new FormData();

      // Add all form data - exact match to original args
      formData.append('senderEmail', senderEmail);
      formData.append('senderName', senderName);
      formData.append('subject', subject);
      formData.append('html', mainHtml);
      formData.append('emailContent', mainHtml);
      formData.append('recipients', JSON.stringify(recipients.split('\n').filter(r => r.trim())));

      // SMTP settings
      formData.append('smtpHost', smtpSettings.host);
      formData.append('smtpPort', smtpSettings.port);
      formData.append('smtpUser', smtpSettings.user);
      formData.append('smtpPass', smtpSettings.pass);

      // Advanced settings
      Object.entries(advancedSettings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      // Add files
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('attachments', selectedFiles[i]);
        }
      }

      // Direct connection to main backend capability URL
      const capabilityUrl = localStorage.getItem('CAPABILITY_URL');

      if (!capabilityUrl) {
        throw new Error('Connection not configured. Please configure your capability URL first.');
      }

      // Use Server-Sent Events for real-time progress
      const response = await fetch(capabilityUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start email sending');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Add new data to buffer
          buffer += decoder.decode(value);

          // Process complete lines
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Process each message individually with immediate rendering
                if (data.type === 'progress') {
                  const progressData: EmailProgress = data;

                  // Use flushSync to force immediate rendering of each email confirmation
                  flushSync(() => {
                    setEmailLogs(prev => [...prev, progressData]);

                    if (progressData.totalRecipients) {
                      const currentProgress = ((progressData.totalSent || 0) + (progressData.totalFailed || 0)) / progressData.totalRecipients * 100;
                      setProgress(currentProgress);
                      setProgressDetails(`Sent: ${progressData.totalSent || 0}, Failed: ${progressData.totalFailed || 0}, Total: ${progressData.totalRecipients}`);
                    }

                    if (data.status === 'success') {
                      setStatusText(`✓ Successfully sent to ${data.recipient}`);
                      setCurrentEmailStatus(`✓ Successfully sent to ${data.recipient}`);
                    } else {
                      setStatusText(`✗ Failed to send to ${data.recipient}: ${data.error}`);
                      setCurrentEmailStatus(`✗ Failed to send to ${data.recipient}: ${data.error}`);
                    }
                  });

                } else if (data.type === 'complete') {
                  setIsLoading(false);
                  setProgress(100);
                  setStatusText(`Email sending completed. Sent: ${data.sent} emails`);
                  setCurrentEmailStatus("");
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
      console.error('Email sending error:', error);
      setIsLoading(false);
      setStatusText(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setEmailLogs(prev => [...prev, {
        type: 'error',
        message: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        recipient: "N/A", // Added for type safety
        subject: "N/A", // Added for type safety
        status: "fail" // Added for type safety
      }]);
    } finally {
      // Always ensure sending state is reset
      setIsLoading(false);
    }
  };

  const cancelSending = () => {
    // Frontend-only version - just reset UI state
    setIsLoading(false);
    setStatusText("Email sending cancelled");
    setCurrentEmailStatus("");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7] font-mono">
      {/* Window Controls */}
      <div className="flex justify-between items-center h-8 bg-[#131316] border-b border-[#26262b] px-4">
        <div className="flex items-center gap-2">
          <CapabilityConfig onConfigured={handleCapabilityConfigured} />
        </div>
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3f3f46] hover:bg-[#52525b] cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#ef4444] hover:bg-[#dc2626] cursor-pointer"></div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#131316] border-r border-[#26262b] min-h-screen">
          <div className="p-4">
            <div className="flex flex-col items-center mb-8">
              {/* Large ASCII Art Logo */}
              <div className="text-[#ef4444] font-mono text-xs leading-none text-center whitespace-pre">
{`
 ██████╗██╗     ███████╗
██╔════╝██║     ██╔════╝
██║     ██║     ███████╗
██║     ██║     ╚════██║
╚██████╗███████╗███████║
 ╚═════╝╚══════╝╚══════╝

`}
              </div>

              {/* Decorative Elements */}
              <div className="text-[#ef4444] font-mono text-xs mb-4 opacity-60">
                ◆ ◇ ◆ ◇ ◆ ◇ ◆ ◇ ◆ ◇ ◆
              </div>

              <div className="text-center text-[#a1a1aa] text-xs">
                <div className="mb-1">EMAIL DELIVERY SYSTEM⚡</div>
                <div className="text-[#ef4444] font-bold"> SHOOTER</div>
              </div>
            </div>

            <nav className="space-y-2">
              <div className="bg-[#ef4444] text-white px-4 py-2 rounded cursor-pointer">
                SENDER
              </div>
              <div
                className="text-[#a1a1aa] px-4 py-2 rounded hover:bg-[#ef4444] hover:text-white cursor-pointer"
                onClick={() => setShowSettings(!showSettings)}
              >
                COMFIG ⚙️
              </div>
            </nav>
          </div>

          {/* ASCII Art Status Display */}
          <div className="absolute bottom-4  right-4">
            <div className="text-[#ef4444] font-mono text-xs text-right whitespace-pre opacity-70 mb-3">
{`
▓ SYSTEM STATUS ▓  
`}
            </div>
            <div className="flex items-center justify-center gap-2 px-1 py-2">
              <div className="text-xs text-[#ef4444] animate-pulse">📡</div>
              <div className="text-xs text-green-400">ONLINE</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto max-h-screen">
          <div className="max-w-1xs mx-auto">
            {/* Large ASCII Banner */}
            <div className="bg-gradient-to-r from-[#131316] via-[#1a1a1f] to-[#131316] rounded-xl border border-[#ef4444]/30 p-6 mb-6">
              <div className="text-[#ef4444] font-mono text-xs leading-none text-center whitespace-pre overflow-hidden">
{`
░█▀▀░█░░░█▀▀░░░█▀▀░█▄█░█▀█░█▀▄░▀█▀░░░█▀▄░█▀▀░█░░░▀█▀░█░█░█▀▀░█▀▄░█░█░░░█▀▀░█░█░█▀▀░▀█▀░█▀▀░█▄█
░█░░░█░░░▀▀█░░░▀▀█░█░█░█▀█░█▀▄░░█░░░░█░█░█▀▀░█░░░░█░░▀▄▀░█▀▀░█▀▄░░█░░░░▀▀█░░█░░▀▀█░░█░░█▀▀░█░█
░▀▀▀░▀▀▀░▀▀▀░░░▀▀▀░▀░▀░▀░▀░▀░▀░░▀░░░░▀▀░░▀▀▀░▀▀▀░▀▀▀░░▀░░▀▀▀░▀░▀░░▀░░░░▀▀▀░░▀░░▀▀▀░░▀░░▀▀▀░▀░▀`}
              </div>
              <div className="text-center mt-4">
                <div className="text-[#a1a1aa] text-sm mb-2">═══════════════════════════════════════════════════════════════════════════════════════════════════</div>
                <div className="text-[#ef4444] text-sm font-bold">⚡ ADVANCED SMART EMAIL SENDER ⚡</div>
                <div className="text-[#a1a1aa] text-sm mt-2">═══════════════════════════════════════════════════════════════════════════════════════════════════</div>
              </div>
            </div>

            <div className="bg-[#131316] rounded-xl border border-[#26262b] p-6">
              {/* Sender Email, Name, Subject Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="text-sm text-[red] mb-2">SENDER EMAIL</Label>
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
                  <Label className="text-sm text-[red] mb-2">SENDER NAME</Label>
                  <Input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your Name"
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                  />
                </div>
                <div>
                  <Label className="text-sm text-[red] mb-2">SUBJECT</Label>
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
                  <Label className="text-sm text-[green] mb-2">LETTER</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Enter your letter content here..."
                    className="bg-[#0f0f12] border-[#26262b] text-white min-h-[200px]"
                  />
                  <div className="mt-2">
                    <div className="text-xs text-[#a1a1aa] mt-1">
                      <span>✏️ Type your email content directly in the text area above</span>
                    </div>
                  </div>
                </div>

                {/* Maillist */}
                <div>
                  <Label className="text-sm text-[green] mb-2">MAILLIST</Label>
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
                    <summary className="text-xs text-[#ef4444] cursor-pointer font-semibold hover:text-red-400">📝 SENDER TAGS (Click to Expand)</summary>
                    <div className="text-xs text-[#a1a1aa] mt-3 space-y-3 bg-[#0a0a0f] p-3 rounded border border-[#26262b]">
                      <div className="space-y-2">
                        <div className="text-yellow-400 font-semibold">📧 Basic Email Placeholders:</div>
                        <div className="font-mono text-[10px] grid grid-cols-2 gap-1 pl-2">
                          <div><span className="text-green-400">{'{user}'}</span> - Username from email</div>
                          <div><span className="text-green-400">{'{username}'}</span> - Same as user</div>
                          <div><span className="text-green-400">{'{email}'}</span> - Full email address</div>
                          <div><span className="text-green-400">{'{domain}'}</span> - Email domain</div>
                          <div><span className="text-green-400">{'{date}'}</span> - Current date</div>
                          <div><span className="text-green-400">{'{time}'}</span> - Current time</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-blue-400 font-semibold">🔧 Advanced Email Placeholders:</div>
                        <div className="font-mono text-[10px] grid grid-cols-2 gap-1 pl-2">
                          <div><span className="text-cyan-400">{'{userupper}'}</span> - Username uppercase</div>
                          <div><span className="text-cyan-400">{'{userlower}'}</span> - Username lowercase</div>
                          <div><span className="text-cyan-400">{'{domainbase}'}</span> - Domain without TLD</div>
                          <div><span className="text-cyan-400">{'{initials}'}</span> - User initials</div>
                          <div><span className="text-cyan-400">{'{userid}'}</span> - Unique user ID</div>
                          <div><span className="text-cyan-400">{'{emailb64}'}</span> - Base64 encoded email</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-purple-400 font-semibold">🎲 Random Content Placeholders:</div>
                        <div className="font-mono text-[10px] grid grid-cols-2 gap-1 pl-2">
                          <div><span className="text-purple-300">{'{randfirst}'}</span> - Random first name</div>
                          <div><span className="text-purple-300">{'{randlast}'}</span> - Random last name</div>
                          <div><span className="text-purple-300">{'{randname}'}</span> - Random full name</div>
                          <div><span className="text-purple-300">{'{randcompany}'}</span> - Random company</div>
                          <div><span className="text-purple-300">{'{randdomain}'}</span> - Random domain</div>
                          <div><span className="text-purple-300">{'{randtitle}'}</span> - Random job title</div>
                          <div><span className="text-purple-300">{'{randomname}'}</span> - Alternative random name</div>
                          <div><span className="text-purple-300">{'{mename}'}</span> - Special name variant</div>
                          <div><span className="text-purple-300">{'{mename3}'}</span> - 3-char name variant</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-orange-400 font-semibold">🔢 Dynamic Generation Placeholders:</div>
                        <div className="font-mono text-[10px] space-y-1 pl-2">
                          <div><span className="text-orange-300">{'{hash6}'}</span> - 6-character hash</div>
                          <div><span className="text-orange-300">{'{randnum4}'}</span> - 4-digit random number</div>
                          <div><span className="text-orange-300">{'{hashN}'}</span> - N-character hash (e.g., {'{hash12}'})</div>
                          <div><span className="text-orange-300">{'{randnumN}'}</span> - N-digit number (e.g., {'{randnum8}'})</div>
                          <div><span className="text-orange-300">{'{randcharN}'}</span> - N random chars (e.g., {'{randchar5}'})</div>
                          <div><span className="text-orange-300">{'{xemail}'}</span> - Processed email variant</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-red-400 font-semibold">📱 QR Code & Media Placeholders:</div>
                        <div className="font-mono text-[10px] space-y-1 pl-2">
                          <div><span className="text-red-300">{'{qrcode}'}</span> - QR code image (requires QR settings)</div>
                          <div><span className="text-red-300">{'{domainlogo}'}</span> - Domain logo from recipient email</div>
                          <div><span className="text-red-300">{'{link}'}</span> - Configured link URL</div>
                        </div>
                      </div>

                      <div className="mt-3 p-2 bg-[#1a1a1f] rounded border-l-2 border-[#ef4444]">
                        <div className="text-[#ef4444] font-semibold text-[10px] mb-1">💡 Pro Tips:</div>
                        <div className="text-[10px] space-y-1">
                          <div>• Use placeholders in both subject and email body</div>
                          <div>• Combine placeholders: "Hi {'{user}'}, your {'{randcompany}'} account..."</div>
                          <div>• Dynamic lengths work: {'{hash5}'}, {'{randnum10}'}, {'{randchar3}'}</div>
                          <div>• File names support placeholders: "report_{'{hash6}'}.pdf"</div>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>



              {/* Second Row - Attachment Files and HTML */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Attachment Files */}
                <div>
                  <Label className="text-sm text-[#a1a1aa] mb-2">Attachment Files</Label>
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

                {/* Attachment HTML Template */}
                <div>
                  <Label className="text-sm text-[red]">HTML CONTENT</Label>
                  <div className="text-xs text-[#a1a1aa] mt-1">
                    <span>HTML content will be generated from your email text above</span>
                  </div>
                </div>
              </div>

              {/* Progress Section - Enhanced Real-time Display */}
              {(isLoading || emailLogs.length > 0) && (
                <div className="mb-6 border-2 border-[#ef4444] rounded-lg overflow-hidden">
                  <div className="bg-[#ef4444] text-white px-4 py-3 text-sm font-semibold flex items-center justify-between">
                    <span>{isLoading ? '📤 SENDING EMAILS...' : '✅ SENDING COMPLETE'}</span>
                    <span className="text-xs bg-black/20 px-2 py-1 rounded">
                      {emailLogs.filter(log => log.status === 'success').length} / {emailLogs.length} sent
                    </span>
                  </div>
                  <div className="bg-[#1d1d21] p-4">
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Progress</span>
                        <span className="text-xs text-[#a1a1aa]">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    <div className="text-sm text-[#a1a1aa] mb-3 p-2 bg-[#0f0f12] rounded border border-[#26262b]">
                      {progressDetails || 'Preparing to send...'}
                    </div>

                    {/* Current Email Status - Prominent Display */}
                    {currentEmailStatus && (
                      <div
                        ref={currentStatusRef}
                        className="mb-3 p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg animate-pulse"
                        data-testid="current-email-status"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                          <span className="text-sm font-medium text-blue-200">Currently Processing:</span>
                        </div>
                        <div className="text-white font-semibold mt-1">{currentEmailStatus}</div>
                      </div>
                    )}

                    <div className="bg-[#0f0f12] border border-[#26262b] rounded-lg overflow-hidden">
                      <div className="bg-[#131316] px-3 py-2 border-b border-[#26262b]">
                        <span className="text-xs font-semibold text-[#a1a1aa]">📋 LIVE EMAIL LOG</span>
                      </div>
                      <div ref={logContainerRef} className="max-h-64 overflow-y-auto" data-testid="email-logs-container">
                        {emailLogs.length === 0 ? (
                          <div className="p-3 text-xs text-[#75798b] text-center">
                            Waiting for email sending to start...
                          </div>
                        ) : (
                          <div className="space-y-1 p-2">
                            {emailLogs.slice(-20).reverse().map((log, index) => {
                              const logIndex = emailLogs.length - 1 - index;
                              const isRecentlyAdded = logIndex === recentlyAddedLogIndex;

                              return (
                                <div
                                  key={index}
                                  className={`text-xs py-2 px-3 rounded flex items-start gap-2 transition-all duration-1000 ${
                                    log.status === 'success'
                                      ? `bg-green-900/20 border-l-2 border-green-500 ${isRecentlyAdded ? 'ring-2 ring-green-400 bg-green-900/40 shadow-lg transform scale-[1.02]' : ''}`
                                      : `bg-red-900/20 border-l-2 border-red-500 ${isRecentlyAdded ? 'ring-2 ring-red-400 bg-red-900/40 shadow-lg transform scale-[1.02]' : ''}`
                                  }`}
                                  data-testid={`email-log-${index}`}
                                >
                                  <span className={`font-bold ${
                                    log.status === 'success' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {log.status === 'success' ? '✓' : '✗'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-white font-medium truncate">{log.recipient}</span>
                                      <span className="text-[#75798b] text-[10px]">
                                        {log.timestamp.slice(11, 19)}
                                      </span>
                                      {isRecentlyAdded && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-semibold bg-blue-500/20 text-blue-200 animate-bounce">
                                          NEW
                                        </span>
                                      )}
                                    </div>
                                    {log.subject && (
                                      <div className="text-[#a1a1aa] text-[10px] truncate">
                                        Subject: {log.subject}
                                      </div>
                                    )}
                                    {log.error && (
                                      <div className="text-red-300 text-[10px] mt-1">
                                        Error: {log.error}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons with ASCII Frame */}
              <div className="mt-6">
                <div className="text-[#ef4444] font-mono text-xs text-center mb-3 opacity-60">
                  ◆◇◆◇◆◇◆◇◆◇◆ MISSION CONTROL ◆◇◆◇◆◇◆◇◆◇◆
                </div>
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={handleSendEmails}
                    disabled={!canSendEmails}
                    className={`min-w-[110px] text-white relative ${
                      canSendEmails
                        ? 'bg-[#ef4444] hover:bg-[#dc2626]'
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                    data-testid="button-send-emails"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        SENDING...
                      </span>
                    ) : !isCapabilityConfigured ? (
                      <span className="flex items-center gap-2">
                        ⚠️ NO CONNECTION
                      </span>
                    ) : recipientCount === 0 ? (
                      <span className="flex items-center gap-2">
                        👥 NO RECIPIENTS
                      </span>
                    ) : !emailContent.trim() ? (
                      <span className="flex items-center gap-2">
                        📝 NO CONTENT
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        🚀 SEND
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelSending}
                    disabled={!isLoading}
                    className="min-w-[110px] border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                  >
                    ⛔ CANCEL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSettings(!showSettings)}
                    className="min-w-[110px] border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                  >
                    ⚙️ SETTINGS
                  </Button>
                </div>
                <div className="text-[#ef4444] font-mono text-xs text-center mt-3 opacity-60 whitespace-pre">
{`
┌───────────────────────┐
│ ▓▓▓ READY SHOOTER ▓▓▓
└───────────────────────┘
`}
                </div>
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
              {/* SMTP rotation controls removed - frontend-only version */}

              {/* SMTP Management removed - frontend-only version */}

                {/* Current SMTP Display removed - frontend-only version */}

                {/* SMTP Management Panel removed - frontend-only version */}
            </div>

            {/* HTML Convert Settings - Moved to Front */}
            <div className="mt-4 bg-[#0a0a0b] rounded-xl p-6 border border-[#26262b]">
              <div className="text-[#ef4444] font-mono text-xs leading-none text-left mb-1 whitespace-pre overflow-hidden">
 {`
╔═╗╔═╗╔╗╔╦  ╦╔═╗╦═╗╔╦╗  ╦ ╦╔╦╗╔╦╗╦  
║  ║ ║║║║╚╗╔╝║╣ ╠╦╝ ║   ╠═╣ ║ ║║║║  
╚═╝╚═╝╝╚╝ ╚╝ ╚═╝╩╚═ ╩   ╩ ╩ ╩ ╩ ╩╩═╝ `}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-sm text-[green] mb-3 block">CONVERSION FORMATS</Label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { format: 'pdf', label: '📄 PDF', color: 'bg-red-600 hover:bg-red-700' },
                      { format: 'png', label: '🖼️ PNG', color: 'bg-blue-600 hover:bg-blue-700' },
                      { format: 'docx', label: '📝 DOCX', color: 'bg-green-600 hover:bg-green-700' },
                      { format: 'html', label: '🌐 HTML', color: 'bg-purple-600 hover:bg-purple-700' }
                    ].map(({ format, label, color }) => {
                      const isActive = advancedSettings.htmlConvert.split(',').map((f: string) => f.trim().toLowerCase()).includes(format);

                      return (
                        <Button
                          key={format}
                          type="button"
                          onClick={() => {
                            const formats = advancedSettings.htmlConvert.split(',').map((f: string) => f.trim().toLowerCase()).filter(Boolean);
                            const newFormats = isActive
                              ? formats.filter((f: string) => f !== format)
                              : [...formats, format];
                            setAdvancedSettings({...advancedSettings, htmlConvert: newFormats.join(',')});
                          }}
                          className={`${isActive ? color : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                        >
                          {label}
                          {isActive && <span className="ml-1 text-xs">✓</span>}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[red] mt-2">
                    Click to generate as attachments.
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-[red] mb-2 block">ZIP PASSWORD FOR ATTACHMENT</Label>
                  <Input
                    type="password"
                    value={advancedSettings.zipPassword}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, zipPassword: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="Optional password for ZIP files"
                  />
                </div>
                <div className="flex items-center gap-6">
                  <Button
                    type="button"
                    onClick={() => setAdvancedSettings({...advancedSettings, zipUse: !advancedSettings.zipUse})}
                    className={`${advancedSettings.zipUse ? 'bg-green-600 hover:bg-green-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                  >
                    📦 ZIP ATTACHMENT
                    {advancedSettings.zipUse && <span className="ml-1 text-xs">✓</span>}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setAdvancedSettings({...advancedSettings, htmlImgBody: !advancedSettings.htmlImgBody})}
                    className={`${advancedSettings.htmlImgBody ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                  >
                    🌫️ HTML-TO-IMG
                    {advancedSettings.htmlImgBody && <span className="ml-1 text-xs">✓</span>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="mt-4 mb-8 bg-black rounded-xl p-4 border border-[#26262b]">
              <div className="flex flex-wrap items-center gap-6">
                <span className="text-sm text-[#a1a1aa] font-semibold">Quick Setup:</span>
                <Button
                  type="button"
                  onClick={() => setAdvancedSettings({...advancedSettings, qrcode: !advancedSettings.qrcode})}
                  className={`${advancedSettings.qrcode ? 'bg-red-600 hover:bg-red-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                >
                  🫐 QR CODE
                  {advancedSettings.qrcode && <span className="ml-1 text-xs">✓</span>}
                </Button>
                <Button
                  type="button"
                  onClick={() => setAdvancedSettings({...advancedSettings, randomMetadata: !advancedSettings.randomMetadata})}
                  className={`${advancedSettings.randomMetadata ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                >
                  🍬 Random Metadata
                  {advancedSettings.randomMetadata && <span className="ml-1 text-xs">✓</span>}
                </Button>
                <Button
                  type="button"
                  onClick={() => setAdvancedSettings({...advancedSettings, calendarMode: !advancedSettings.calendarMode})}
                  className={`${advancedSettings.calendarMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                >
                  📅 CALENDAR MODE
                  {advancedSettings.calendarMode && <span className="ml-1 text-xs">✓</span>}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Overlay */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
            <div className="bg-[#000] border border-[#26262b] rounded-xl p-6 w-[1280px] max-h-[80vh] overflow-y-auto">
              <button
                onClick={() => setShowSettings(false)}
                className="text-[red] hover:text-white text-xl"
              >
                GO BACK ↩️
              </button>
              <div className=" items-center mb-6">
                <div className="text-[#ef4444] font-mono text-xs leading-none text-left mb-1 whitespace-pre overflow-hidden">
                  {`
                    .d8888b.                     .d888 d8b          
                   d88P  Y88b                   d88P"  Y8P          
                   888    888                   888                 
                   888         .d88b.  88888b.  888888 888  .d88b.  
                   888        d88""88b 888 "88b 888    888 d88P"88b 
                   888    888 888  888 888  888 888    888 888  888 
                   Y88b  d88P Y88..88P 888  888 888    888 Y88b 888 
                    "Y8888P"   "Y88P"  888  888 888    888  "Y88888 
                                                                888 
                                                           Y8b d88P 
                                                            "Y88P"  `}
              </div>

              </div>
              <div className="text-[#ef4444] font-mono text-xs leading-none text-left mb-1 whitespace-pre overflow-hidden">
              {`
                  | _______________ |
                   | |XXXXXXXXXXXXX| |
                   | |XXXXXXXXXXXXX| |
                   | |XXXXXXXXXXXXX| |
                   | |XXXXXXXXXXXXX| |
                   | |XXXXXXXXXXXXX| |
                   |_________________|
                       _[_______]_
                   ___[___________]___
                  |         [_____] []|__
                  |         [_____] []|  \__
                  L___________________J     \ \___\/
                   ___________________      /\
                  /###GET#CONNECTED###
              `}
              </div>
              <div className="space-y-6">
                {/* QR Code Settings Section */}
                <div>
                  <h3 className="text-lg font-medium text-red mb-3">QR SETTINGS 🔲</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label className="text-sm text-[red]">QR SIZE (px)</Label>
                      <Input
                        type="number"
                        value={advancedSettings.qrSize}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, qrSize: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-[red]">QR BORDER (px)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={advancedSettings.qrBorder}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, qrBorder: parseInt(e.target.value) || 0})}
                        className="bg-[#0f0f12] border-[#26262b] text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-[red]">QR BORDER COLOR</Label>
                      <Input
                        type="color"
                        value={advancedSettings.qrBorderColor}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, qrBorderColor: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-red h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-[red]">QR COLOR</Label>
                      <Input
                        type="color"
                        value={advancedSettings.qrForegroundColor || '#000000'}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, qrForegroundColor: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-red h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-[red]">QR BACKGROUND </Label>
                      <Input
                        type="color"
                        value={advancedSettings.qrBackgroundColor || '#FFFFFF'}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, qrBackgroundColor: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white h-10"
                      />
                    </div>
                  </div>
                </div>
                {/* Hidden Image Overlay Settings Section */}
                <div>
                  <h3 className="text-lg font-medium text-red mb-3">QR MIDDLE IMG </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-[red]">QR MIDDLE IMG</Label>
                      <Select
                        value={advancedSettings.hiddenImageFile || "off"}
                        onValueChange={(value) => setAdvancedSettings({...advancedSettings, hiddenImageFile: value === "off" ? "" : value})}
                      >
                        <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white">
                          <SelectValue placeholder="-- Off --" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#131316] border-[#26262b]">
                          <SelectItem value="off" className="text-white focus:text-white">-- Off --</SelectItem>
                          {/* Logo files removed in frontend-only version */}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-[#a1a1aa] mt-1">
                        {advancedSettings.hiddenImageFile ? (
                          <span>🖼️ Using Logo: <strong className="text-white">{advancedSettings.hiddenImageFile}</strong></span>
                        ) : (
                          <span>image from logo folder</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-[red]">QR MIDDLE IMG SIZE (px)</Label>
                      <Input
                        type="number"
                        min="10"
                        max="200"
                        value={advancedSettings.hiddenImageSize}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, hiddenImageSize: parseInt(e.target.value) || 50})}
                        className="bg-[#0f0f12] border-[#26262b] text-white"
                        placeholder="50"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label className="text-sm text-[red]">MIDDLE TEXT </Label>
                    <Input
                      value={advancedSettings.hiddenText}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, hiddenText: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                      placeholder="Optional text overlay"
                    />
                  </div>
                </div>


                <div>
                  <Label className="text-sm text-[red]">QR LINK: USE {"{email}"} placeholder</Label>
                  <Input
                    value={advancedSettings.qrLink}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, qrLink: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="https://example.com?user={email}"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[red]">LINK </Label>
                  <Input
                    value={advancedSettings.linkPlaceholder}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, linkPlaceholder: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="{email}"
                  />
                </div>



                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <Label className="text-sm text-[red]">ATTACH FILE NAME</Label>
                    <Input
                      value={advancedSettings.fileName}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, fileName: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                      placeholder="attachment"
                    />
                  </div>
                </div>



                {/* Domain Logo Settings Section */}
                <div>
                  <h3 className="text-lg font-medium text-red mb-3">🏢 DOMAIN LOGO </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label className="text-sm text-[red]">LOGO SIZE</Label>
                      <Input
                        value={advancedSettings.domainLogoSize}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, domainLogoSize: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white"
                        placeholder="50%"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm text-[red]">RETRY ATTEMPT</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={advancedSettings.retry}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, retry: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[red]">PRIORITY</Label>
                    <select
                      value={advancedSettings.priority}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, priority: e.target.value})}
                      className="w-full p-2 bg-[#0f0f12] border border-[#26262b] text-white rounded text-sm"
                    >
                      <option value="1">Low</option>
                      <option value="2">Normal</option>
                      <option value="3">High</option>
                    </select>
                  </div>

                </div>



                <h3 className="text-lg font-medium text-red mt-6 mb-4">PROXY </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={advancedSettings.proxyUse}
                      onCheckedChange={(checked: boolean) => setAdvancedSettings({...advancedSettings, proxyUse: !!checked})}
                    />
                    <Label className="text-sm text-[red]">USE PROXY</Label>
                  </div>
                  <div>
                    <Label className="text-sm text-[red]">PROXY TYPE</Label>
                    <select
                      value={advancedSettings.proxyType}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyType: e.target.value})}
                      className="w-full p-2 bg-[#0f0f12] border border-[#26262b] text-white rounded text-sm"
                    >
                      <option value="socks5">SOCKS5</option>
                      <option value="socks4">SOCKS4</option>
                      <option value="http">HTTP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-[red]">PROXY HOST</Label>
                    <Input
                      value={advancedSettings.proxyHost}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyHost: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[red]">PROXY PORT</Label>
                    <Input
                      type="number"
                      value={advancedSettings.proxyPort}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyPort: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-[red]">PROXY USER</Label>
                    <Input
                      value={advancedSettings.proxyUser}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyUser: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[red]">PROXY PASSWORD</Label>
                    <Input
                      type="password"
                      value={advancedSettings.proxyPass}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyPass: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-[red]">EMAIL PER SECS</Label>
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
                    <Label className="text-sm text-[red]">SLEEP (seconds)</Label>
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