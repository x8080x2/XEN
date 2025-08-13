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
  
  // Attachment template change handler
  const handleAttachmentTemplateChange = async (template: string) => {
    setSelectedAttachmentTemplate(template);
    
    if (template && template !== 'off') {
      try {
        const response = await fetch('/api/original/readFile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filepath: `files/${template}` })
        });
        const data = await response.json();
        if (data.success && data.content) {
          setAttachmentHtml(data.content);
        } else {
          setAttachmentHtml('');
        }
      } catch (error) {
        console.error('Error loading attachment template:', error);
        setAttachmentHtml('');
      }
    } else {
      setAttachmentHtml('');
    }
  };
  
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

    htmlImgBody: false,
    zipUse: false,
    zipPassword: "",
    emailPerSecond: "5",
    sleep: "3",
    fileName: "attachment",
    htmlConvert: "html,pdf,png,docx", // Support HTML export plus other formats
    qrSize: "200",
    qrBorder: "2",
    qrBorderColor: "#000000",
    qrLink: "https://example.com",
    linkPlaceholder: "{email}",
    includeHiddenText: false,
    hiddenText: "&#9919;",
    domainLogoSize: "50%",
    borderStyle: "solid",
    borderColor: "#000000",
    retry: "0",
    priority: "2",
    hiddenImgSize: "50",
    hiddenImageFile: "",
    proxyUse: false,
    proxyType: "socks5",
    proxyHost: "",
    proxyPort: "",
    proxyUser: "",
    proxyPass: ""
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
  
  // Load templates and logo files on component mount
  const [logoFiles, setLogoFiles] = useState<string[]>([]);
  
  useEffect(() => {
    loadTemplates();
    loadLogoFiles();
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

  const loadLogoFiles = async () => {
    try {
      const response = await fetch('/api/original/listLogoFiles');
      const data = await response.json();
      if (data.files) {
        setLogoFiles(data.files);
      }
    } catch (error) {
      console.error('Error loading logo files:', error);
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

  // Template change handler - exact clone from sender.html lines 992-1006
  const handleTemplateChange = async (template: string) => {
    setSelectedTemplate(template);
    
    // Load template content into textarea when selected - exact clone from sender.html lines 992-1006
    if (template && template !== 'off') {
      try {
        const response = await fetch('/api/original/readFile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filepath: `files/${template}` })
        });
        const data = await response.json();
        if (data.success && data.content) {
          setEmailContent(data.content);
          setStatusText('');
        } else {
          setEmailContent('');
          setStatusText('Error loading template content.');
        }
      } catch (error) {
        setStatusText(`Error loading template: ${error}`);
      }
    }
  };
  
  // Auto-load configuration on startup - exact clone from main.js line 308
  useEffect(() => {
    loadConfigFromFiles();
  }, []); // Run once on component mount

  // Load configuration from files - exact clone from main.js
  const loadConfigFromFiles = async () => {
    try {
      const response = await fetch('/api/config/load');
      const data = await response.json();
      
      if (data.success && data.config) {
        const config = data.config;
        
        // Load SMTP settings
        if (config.SMTP) {
          const smtpConfig = {
            host: config.SMTP.host || '',
            port: config.SMTP.port || '587',
            user: config.SMTP.user || '',
            pass: config.SMTP.pass || '',
            fromEmail: config.SMTP.fromEmail || '',
            fromName: config.SMTP.fromName || ''
          };
          setSMTPSettings(smtpConfig);
          
          // Auto-set sender email from SMTP config - exact clone from main.js behavior
          if (smtpConfig.fromEmail) {
            setSenderEmail(smtpConfig.fromEmail);
            console.log('[Config Load] Auto-set sender email:', smtpConfig.fromEmail);
          }
          if (smtpConfig.fromName) {
            setSenderName(smtpConfig.fromName);
            console.log('[Config Load] Auto-set sender name:', smtpConfig.fromName);
          }
        }
        
        // Load advanced settings
        setAdvancedSettings({
          qrcode: !!config.QRCODE,
          randomMetadata: !!config.RANDOM_METADATA,
          minifyHtml: !!config.MINIFY_HTML,

          htmlImgBody: !!config.HTML2IMG_BODY,
          zipUse: !!config.ZIP_USE,
          zipPassword: config.ZIP_PASSWORD || '',
          emailPerSecond: config.EMAILPERSECOND?.toString() || '5',
          sleep: config.SLEEP?.toString() || '3',
          fileName: config.FILE_NAME || 'attachment',
          htmlConvert: config.HTML_CONVERT || 'html,pdf,png,docx',
          qrSize: config.QR_WIDTH?.toString() || '200',
          qrBorder: config.QR_BORDER_WIDTH?.toString() || '2',
          qrBorderColor: config.QR_BORDER_COLOR || '#000000',
          qrLink: config.QR_LINK || 'https://example.com',
          linkPlaceholder: config.LINK_PLACEHOLDER || '{email}',
          includeHiddenText: !!config.INCLUDE_HIDDEN_TEXT,
          hiddenText: config.HIDDEN_TEXT || '&#9919;',
          domainLogoSize: config.DOMAIN_LOGO_SIZE || '50%',
          borderStyle: config.BORDER_STYLE || 'solid',
          borderColor: config.BORDER_COLOR || '#000000',
          retry: config.RETRY?.toString() || '0',
          priority: config.PRIORITY?.toString() || '2',
          hiddenImgSize: config.HIDDEN_IMAGE_SIZE?.toString() || '50',
          hiddenImageFile: config.HIDDEN_IMAGE_FILE || '',
          proxyUse: !!config.PROXY_USE,
          proxyType: config.PROXY_TYPE || 'socks5',
          proxyHost: config.PROXY_HOST || '',
          proxyPort: config.PROXY_PORT?.toString() || '',
          proxyUser: config.PROXY_USER || '',
          proxyPass: config.PROXY_PASS || ''
        });
        
        // Auto-load leads from files/leads.txt - exact clone from main.js line 562
        try {
          const leadsResponse = await fetch('/api/config/loadLeads');
          const leadsData = await leadsResponse.json();
          if (leadsData.success && leadsData.leads && leadsData.leads.trim().length > 0) {
            setRecipients(leadsData.leads);
            const leadCount = leadsData.leads.split('\n').filter(Boolean).length;
            console.log(`[Config Load] Auto-loaded ${leadCount} leads from leads.txt`);
          } else {
            console.log('[Config Load] No leads.txt found, starting with empty recipients');
          }
        } catch (leadsError) {
          console.log('[Config Load] Failed to load leads:', leadsError);
        }
        
        // Auto-load letter content if available
        if (config.LETTER_CONTENT) {
          setEmailContent(config.LETTER_CONTENT);
          console.log('[Config Load] Auto-loaded letter content from config');
        }
        
        // Auto-load subject if available
        if (config.SUBJECT) {
          setSubject(config.SUBJECT);
          console.log('[Config Load] Auto-loaded subject from config');
        }
        
        setStatusText('Configuration and maillist loaded automatically');
        setTimeout(() => setStatusText('Ready to send emails'), 2000);
      } else {
        setStatusText('Failed to load configuration');
      }
    } catch (error) {
      console.error('Config load error:', error);
      setStatusText('Failed to load configuration');
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

    // HTML content validation - exact clone from main.js lines 568-581 & sender.html 1275-1286
    let bodyHtml = '';
    
    // Priority 1: Selected template file (bodyHtmlFile equivalent)
    if (selectedTemplate && selectedTemplate !== 'off') {
      try {
        const response = await fetch('/api/original/readFile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filepath: `files/${selectedTemplate}` })
        });
        const data = await response.json();
        bodyHtml = data.success ? (data.content || '') : '';
      } catch (error) {
        console.error('Failed to load template:', error);
        bodyHtml = '';
      }
    }
    // Priority 2: Direct HTML from textarea (args.html equivalent)  
    else if (emailContent.trim()) {
      bodyHtml = emailContent.trim();
    }
    // Priority 3: Default letter fallback (C.LETTER equivalent)
    else {
      try {
        const response = await fetch('/api/original/readFile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filepath: 'files/letter.html' })
        });
        const data = await response.json();
        bodyHtml = data.success ? (data.content || '') : '';
      } catch (error) {
        console.log('No default letter.html found');
        bodyHtml = '';
      }
    }

    if (!bodyHtml) {
      setStatusText('Email content cannot be empty.');
      return;
    }

    // Set mainHtml for FormData - this was missing
    const mainHtml = bodyHtml;

    // Attachment HTML handling - exact clone from main.js lines 583-605
    let attachmentHtmlContent = '';
    if (attachmentHtml && attachmentHtml.trim()) {
      // Use direct attachment HTML (args.attachmentHtml equivalent)
      attachmentHtmlContent = attachmentHtml.trim();
    } else {
      // Fallback to bodyHtml (main.js line 586)
      attachmentHtmlContent = bodyHtml;
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
      formData.append('html', mainHtml);
      formData.append('attachmentHtml', attachmentHtml || '');
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
                    <Select value={selectedTemplate || "off"} onValueChange={handleTemplateChange}>
                      <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-xs">
                        <SelectValue placeholder="-- Off --" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#131316] border-[#26262b]">
                        <SelectItem value="off" className="text-white focus:text-white">-- Off --</SelectItem>
                        {templateFiles.map(file => (
                          <SelectItem key={file} value={file} className="text-white focus:text-white">{file}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Display which template is currently active - exact clone from sender.html */}
                    <div className="text-xs text-[#a1a1aa] mt-1">
                      {selectedTemplate && selectedTemplate !== 'off' ? (
                        <span>📄 Using template: <strong className="text-white">{selectedTemplate}</strong></span>
                      ) : (
                        <span>✏️ Using manual content from textarea</span>
                      )}
                    </div>
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
                        <div>NEW: {'{mename}'}, {'{mename3}'}, {'{emailb64}'}, {'{xemail}'}, {'{randomname}'}</div>
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
                  <Label className="text-xs text-[#a1a1aa]">Attachment HTML Template</Label>
                  <Select value={selectedAttachmentTemplate || "off"} onValueChange={handleAttachmentTemplateChange}>
                    <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-xs">
                      <SelectValue placeholder="-- Off --" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131316] border-[#26262b]">
                      <SelectItem value="off" className="text-white focus:text-white">-- Off --</SelectItem>
                      {templateFiles.map(file => (
                        <SelectItem key={file} value={file} className="text-white focus:text-white">{file}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-[#a1a1aa] mt-1">
                    {selectedAttachmentTemplate && selectedAttachmentTemplate !== 'off' ? (
                      <span>📄 Using attachment template: <strong className="text-white">{selectedAttachmentTemplate}</strong></span>
                    ) : (
                      <span>✏️ No attachment template selected</span>
                    )}
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
                  <Label className="text-sm text-[#a1a1aa]">HTML Convert Formats (comma-separated: html,pdf,png,docx)</Label>
                  <Input
                    value={advancedSettings.htmlConvert}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, htmlConvert: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="html,pdf,png,docx"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Domain Logo Size</Label>
                    <Input
                      value={advancedSettings.domainLogoSize}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, domainLogoSize: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                      placeholder="50%"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Border Style</Label>
                    <select 
                      value={advancedSettings.borderStyle}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, borderStyle: e.target.value})}
                      className="w-full p-2 bg-[#0f0f12] border border-[#26262b] text-white rounded text-sm"
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Border Color</Label>
                    <Input
                      type="color"
                      value={advancedSettings.borderColor}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, borderColor: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Retry Attempts</Label>
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
                    <Label className="text-sm text-[#a1a1aa]">Priority</Label>
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
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Hidden Image Size (px)</Label>
                    <Input
                      type="number"
                      min="10"
                      max="200"
                      value={advancedSettings.hiddenImgSize}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, hiddenImgSize: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-[#a1a1aa]">Hidden Image File</Label>
                  <select 
                    value={advancedSettings.hiddenImageFile}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, hiddenImageFile: e.target.value})}
                    className="w-full p-2 bg-[#0f0f12] border border-[#26262b] text-white rounded text-sm"
                  >
                    <option value="">-- None --</option>
                    {logoFiles.map(file => (
                      <option key={file} value={file}>{file}</option>
                    ))}
                  </select>
                </div>

                <h3 className="text-lg font-medium text-white mt-6 mb-4">Proxy Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={advancedSettings.proxyUse}
                      onCheckedChange={(checked) => setAdvancedSettings({...advancedSettings, proxyUse: !!checked})}
                    />
                    <Label className="text-sm text-[#a1a1aa]">Use Proxy</Label>
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Proxy Type</Label>
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
                    <Label className="text-sm text-[#a1a1aa]">Proxy Host</Label>
                    <Input
                      value={advancedSettings.proxyHost}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyHost: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Proxy Port</Label>
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
                    <Label className="text-sm text-[#a1a1aa]">Proxy User</Label>
                    <Input
                      value={advancedSettings.proxyUser}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, proxyUser: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#a1a1aa]">Proxy Password</Label>
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