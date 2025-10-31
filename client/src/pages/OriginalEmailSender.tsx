import React, { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { SMTPManager } from "@/components/SMTPManager";

interface EmailProgress {
  recipient: string;
  subject: string;
  status: 'success' | 'fail';
  error?: string;
  timestamp: string;
  totalSent?: number;
  totalFailed?: number;
  totalRecipients?: number;
  type: string;
  message?: string;
  smtp?: {
    id: string;
    fromEmail: string;
    host: string;
  };
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
  // Form state
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

  const handleAttachmentTemplateChange = async (template: string) => {
    setSelectedAttachmentTemplate(template);
    if (template && template !== 'off') {
      const content = await loadTemplateContent(`files/${template}`);
      setAttachmentHtml(content);
    } else {
      setAttachmentHtml('');
    }
  };

  const [smtpSettings, setSMTPSettings] = useState<SMTPSettings>({
    host: "",
    port: "587",
    user: "",
    pass: "",
    fromEmail: "",
    fromName: ""
  });

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
      qrcode: false,
      qrSize: 200,
      qrLink: 'https://example.com',
      qrForegroundColor: '#000000',
      qrBackgroundColor: '#FFFFFF',
      qrBorder: 2,
      qrBorderColor: '#000000',
      linkPlaceholder: '',
      htmlImgBody: false,
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

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [progressDetails, setProgressDetails] = useState("");
  const [emailLogs, setEmailLogs] = useState<EmailProgress[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSmtpManager, setShowSmtpManager] = useState(false);
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('google_ai_key') || '');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [useAISubject, setUseAISubject] = useState(false);
  const [useAISenderName, setUseAISenderName] = useState(false);
  const [aiStatus, setAiStatus] = useState({ initialized: false, hasApiKey: false, provider: 'gemini' });
  const [currentEmailStatus, setCurrentEmailStatus] = useState<string>("");
  const [recentlyAddedLogIndex, setRecentlyAddedLogIndex] = useState<number>(-1);
  const [currentSmtpInfo, setCurrentSmtpInfo] = useState<{id: string, fromEmail: string, host: string} | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const currentStatusRef = useRef<HTMLDivElement>(null);

  const updateProgress = useCallback((progressData: EmailProgress) => {
    flushSync(() => {
      setEmailLogs(prev => [...prev, progressData]);
      if (progressData.totalRecipients) {
        const currentProgress = ((progressData.totalSent || 0) + (progressData.totalFailed || 0)) / progressData.totalRecipients * 100;
        setProgress(currentProgress);
        setProgressDetails(`Sent: ${progressData.totalSent || 0}, Failed: ${progressData.totalFailed || 0}, Total: ${progressData.totalRecipients}`);
      }
      if (progressData.smtp) {
        setCurrentSmtpInfo(progressData.smtp);
      }
      if (progressData.status === 'success') {
        setCurrentEmailStatus(`✓ Successfully sent to ${progressData.recipient}`);
      } else {
        setCurrentEmailStatus(`✗ Failed to send to ${progressData.recipient}: ${progressData.error}`);
      }
    });
  }, []);

  const [smtpData, setSmtpData] = useState({
    smtpConfigs: [] as any[],
    currentSmtp: null as any,
    rotationEnabled: false
  });
  const [newSmtp, setNewSmtp] = useState({
    host: "", port: "587", user: "", pass: "", fromEmail: "", fromName: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lines = recipients.split('\n').filter(line => line.trim() && line.includes('@'));
    setRecipientCount(lines.length);
  }, [recipients]);

  const [logoFiles, setLogoFiles] = useState<string[]>([]);

  useEffect(() => {
    loadTemplates();
    loadLogoFiles();
  }, []);

  useEffect(() => {
    if (logContainerRef.current && emailLogs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setRecentlyAddedLogIndex(emailLogs.length - 1);
      const timer = setTimeout(() => {
        setRecentlyAddedLogIndex(-1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [emailLogs.length]);

  useEffect(() => {
    if (currentStatusRef.current && currentEmailStatus) {
      currentStatusRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentEmailStatus]);

  const loadTemplateContent = useCallback(async (templatePath: string): Promise<string> => {
    try {
      const response = await fetch('/api/original/readFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: templatePath })
      });
      const data = await response.json();
      return data.success ? (data.content || '') : '';
    } catch (error) {
      console.error('Failed to load template:', error);
      return '';
    }
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

  const handleTemplateChange = async (template: string) => {
    setSelectedTemplate(template);
    if (template && template !== 'off') {
      const content = await loadTemplateContent(`files/${template}`);
      if (content) {
        setEmailContent(content);
        setStatusText('');
      } else {
        setEmailContent('');
        setStatusText('Error loading template content.');
      }
    }
  };

  useEffect(() => {
    loadConfigFromFiles();
    fetchSmtpData();
    checkAIStatus();
  }, []);

  useEffect(() => {
    let mounted = true;
    const initializeAI = async () => {
      try {
        const configResponse = await fetch('/api/config/load');
        const configData = await configResponse.json();
        if (!mounted) return;
        if (configData.success && configData.config?.GOOGLE_AI_KEY) {
          const aiResponse = await fetch('/api/ai/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: configData.config.GOOGLE_AI_KEY })
          });
          const aiData = await aiResponse.json();
          if (mounted && aiData.success) {
            setAiEnabled(true);
          }
        }
      } catch (error) {
        console.error('Failed to auto-initialize AI:', error);
      }
    };
    initializeAI();
    return () => {
      mounted = false;
    };
  }, []);

  const checkAIStatus = async () => {
    try {
      const response = await fetch('/api/ai/status');
      const data = await response.json();
      setAiStatus(data);
    } catch (error) {
      console.error('Failed to check AI status:', error);
    }
  };

  const initializeAI = async () => {
    if (aiStatus.initialized) {
      try {
        const response = await fetch('/api/ai/deinitialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
          setAiEnabled(false);
          setAiStatus({ initialized: false, hasApiKey: false, provider: null });
          setStatusText('AI service turned off successfully');
          localStorage.removeItem('google_ai_key');
          await fetch('/api/config/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ GOOGLE_AI_KEY: '' })
          });
        } else {
          setStatusText('Failed to turn off AI service');
        }
      } catch (error) {
        setStatusText('Error turning off AI service');
      }
      return;
    }
    if (!aiApiKey) {
      setStatusText('Please enter Google AI API key');
      return;
    }
    try {
      const response = await fetch('/api/ai/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: aiApiKey })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('google_ai_key', aiApiKey);
        await fetch('/api/config/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ GOOGLE_AI_KEY: aiApiKey })
        });
        setStatusText('AI initialized successfully and saved to config');
        await checkAIStatus();
        setAiEnabled(true);
      } else {
        setStatusText('AI initialization failed');
      }
    } catch (error) {
      setStatusText('Failed to initialize AI');
    }
  };

  const [configLoaded, setConfigLoaded] = useState(false);

  const fetchSmtpData = async () => {
    try {
      const response = await fetch("/api/smtp/list");
      const data = await response.json();
      if (data.success) {
        setSmtpData(data);
      }
    } catch (error) {
      console.error('Failed to fetch SMTP data:', error);
    }
  };

  const toggleSmtpRotation = async () => {
    try {
      const response = await fetch("/api/smtp/toggle-rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !smtpData.rotationEnabled })
      });
      const data = await response.json();
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          rotationEnabled: data.rotationEnabled,
          currentSmtp: data.currentSmtp
        }));
        setStatusText(`SMTP rotation ${data.rotationEnabled ? 'enabled' : 'disabled'}`);
        setTimeout(() => setStatusText(""), 3000);
      }
    } catch (error) {
      setStatusText('Failed to toggle SMTP rotation');
    }
  };

  const addNewSmtp = async () => {
    if (!newSmtp.host || !newSmtp.port || !newSmtp.user || !newSmtp.pass || !newSmtp.fromEmail) {
      setStatusText('All SMTP fields are required');
      return;
    }
    try {
      const response = await fetch("/api/smtp/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSmtp)
      });
      const data = await response.json();
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          smtpConfigs: data.smtpConfigs
        }));
        setNewSmtp({
          host: "", port: "587", user: "", pass: "", fromEmail: "", fromName: ""
        });
        setStatusText(`SMTP ${data.smtpId} added successfully`);
        fetchSmtpData();
      }
    } catch (error) {
      setStatusText('Failed to add SMTP configuration');
    }
  };

  const deleteSmtp = async (smtpId: string) => {
    if (smtpData.smtpConfigs.length <= 1) {
      setStatusText('Cannot delete the last SMTP configuration');
      return;
    }
    try {
      const response = await fetch(`/api/smtp/${smtpId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          smtpConfigs: data.smtpConfigs,
          currentSmtp: data.currentSmtp
        }));
        setStatusText(`SMTP ${smtpId} deleted successfully`);
      }
    } catch (error) {
      setStatusText('Failed to delete SMTP configuration');
    }
  };

  const rotateSmtp = async () => {
    try {
      const response = await fetch("/api/smtp/rotate", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setSmtpData(prev => ({
          ...prev,
          currentSmtp: data.currentSmtp
        }));
        setStatusText(`Rotated to: ${data.currentSmtp?.fromEmail}`);
        setTimeout(() => setStatusText(""), 3000);
      }
    } catch (error) {
      setStatusText('Failed to rotate SMTP');
    }
  };

  const loadConfigFromFiles = async () => {
    if (configLoaded) return;
    try {
      const response = await fetch('/api/config/load');
      const data = await response.json();
      if (data.success && data.config) {
        const config = data.config;
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
          if (smtpConfig.fromEmail) {
            setSenderEmail(smtpConfig.fromEmail);
          }
        }
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
          htmlConvert: config.HTML_CONVERT || '',
          qrSize: config.QR_WIDTH?.toString() || '200',
          qrBorder: config.QR_BORDER_WIDTH?.toString() || '2',
          qrBorderColor: config.QR_BORDER_COLOR || '#000000',
          qrLink: config.QR_LINK || 'https://example.com',
          linkPlaceholder: config.LINK_PLACEHOLDER || '{email}',
          domainLogoSize: config.DOMAIN_LOGO_SIZE || '50%',
          borderStyle: config.BORDER_STYLE || 'solid',
          borderColor: config.BORDER_COLOR || '#000000',
          retry: config.RETRY?.toString() || '0',
          priority: config.PRIORITY?.toString() || '2',
          proxyUse: !!config.PROXY_USE,
          proxyType: config.PROXY_TYPE || 'socks5',
          proxyHost: config.PROXY_HOST || '',
          proxyPort: config.PROXY_PORT?.toString() || '',
          proxyUser: config.PROXY_USER || '',
          proxyPass: config.PROXY_PASS || '',
          qrForegroundColor: config.QR_FOREGROUND_COLOR || '#000000',
          qrBackgroundColor: config.QR_BACKGROUND_COLOR || '#FFFFFF',
          calendarMode: !!config.CALENDAR_MODE,
          hiddenImageFile: config.HIDDEN_IMAGE_FILE || '',
          hiddenImageSize: config.HIDDEN_IMAGE_SIZE?.toString() || '50',
          hiddenText: config.HIDDEN_TEXT || ''
        });
        try {
          const leadsResponse = await fetch('/api/config/loadLeads');
          const leadsData = await leadsResponse.json();
          if (leadsData.success && leadsData.leads && leadsData.leads.trim().length > 0) {
            setRecipients(leadsData.leads);
          }
        } catch (leadsError) {
          console.log('[Config Load] Failed to load leads:', leadsError);
        }
        if (config.LETTER_CONTENT) {
          setEmailContent(config.LETTER_CONTENT);
        }
        if (config.SUBJECT) {
          setSubject(config.SUBJECT);
        }
        setStatusText('Configuration and maillist loaded automatically');
        setTimeout(() => setStatusText("Ready to send emails"), 2000);
        setConfigLoaded(true);
      } else {
        setStatusText('Failed to load configuration');
      }
    } catch (error) {
      console.error('Config load error:', error);
      setStatusText('Failed to load configuration');
    }
  };

  const saveSMTPSettings = async () => {
    console.log('Saving SMTP settings:', smtpSettings);
    setSenderEmail(smtpSettings.fromEmail);
    setStatusText("✓ SMTP settings saved");
    setTimeout(() => setStatusText(""), 3000);
  };

  const handleSendEmails = async () => {
    const recipientList = recipients.split('\n').filter(email => email.trim() !== '');
    if (!recipientList.length) {
      setStatusText('Please enter at least one recipient.');
      return;
    }
    if (!senderEmail.trim()) {
      setStatusText('Sender email is required (from SMTP config).');
      return;
    }
    let bodyHtml = '';
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
    } else if (emailContent.trim()) {
      bodyHtml = emailContent.trim();
    } else {
      bodyHtml = await loadTemplateContent('files/letter.html');
      if (!bodyHtml) {
        console.log('No default letter.html found');
      }
    }
    if (!bodyHtml) {
      setStatusText('Email content cannot be empty.');
      return;
    }
    const mainHtml = bodyHtml;
    let attachmentHtmlContent = '';
    if (attachmentHtml && attachmentHtml.trim()) {
      attachmentHtmlContent = attachmentHtml.trim();
    } else {
      attachmentHtmlContent = bodyHtml;
    }
    setIsLoading(true);
    setProgress(0);
    setStatusText("Preparing to send emails...");
    setEmailLogs([]);
    setProgressDetails("");
    setCurrentEmailStatus("");
    setCurrentSmtpInfo(null);
    try {
      const formData = new FormData();
      formData.append('senderEmail', senderEmail);
      formData.append('senderName', senderName || '');
      formData.append('subject', subject);
      formData.append('html', mainHtml);
      formData.append('attachmentHtml', attachmentHtml || '');
      formData.append('recipients', JSON.stringify(recipients.split('\n').filter(r => r.trim())));
      formData.append('smtpHost', smtpSettings.host);
      formData.append('smtpPort', smtpSettings.port);
      formData.append('smtpUser', smtpSettings.user);
      formData.append('smtpPass', smtpSettings.pass);
      Object.entries(advancedSettings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      formData.append('useAIEnabled', String(aiEnabled));
      formData.append('useAISubject', String(aiEnabled && useAISubject));
      formData.append('useAISenderName', String(aiEnabled && useAISenderName));
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('attachments', selectedFiles[i]);
        }
      }
      const response = await fetch('/api/original/sendMail', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start email sending');
      }
      setStatusText("Email sending started. Checking for updates...");
      let logIndex = 0;
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/original/progress?since=${logIndex}`);
          const progressData = await progressResponse.json();
          if (progressData.logs && progressData.logs.length > 0) {
            for (const log of progressData.logs) {
              if (log.type === 'complete') {
                flushSync(() => {
                  setIsLoading(false);
                  setProgress(100);
                  setStatusText(`Email sending completed. Sent: ${log.sent} emails`);
                  setCurrentEmailStatus("");
                });
                clearInterval(pollInterval);
              } else if (log.type === 'error') {
                flushSync(() => {
                  setIsLoading(false);
                  setStatusText(`Error: ${log.error}`);
                });
                clearInterval(pollInterval);
              } else {
                const progressData: EmailProgress = {
                  recipient: log.recipient || 'Unknown',
                  subject: log.subject || subject || 'No Subject',
                  status: log.status || 'fail',
                  error: log.error || undefined,
                  timestamp: log.timestamp || new Date().toISOString(),
                  totalSent: log.totalSent,
                  totalFailed: log.totalFailed,
                  totalRecipients: log.totalRecipients,
                  smtp: log.smtp,
                  type: 'progress'
                };
                updateProgress(progressData);
              }
            }
            logIndex = progressData.total;
          }
          if (!progressData.inProgress && progressData.logs.length === 0) {
            clearInterval(pollInterval);
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error polling progress:', err);
        }
      }, 500);
    } catch (error: any) {
      console.error('Email sending error:', error);
      setIsLoading(false);
      setStatusText(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setEmailLogs(prev => [...prev, {
        type: 'error',
        message: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        recipient: "N/A",
        subject: "N/A",
        status: "fail"
      }]);
    }
  };

  const cancelSending = async () => {
    try {
      await fetch('/api/original/cancel', { method: 'POST' });
      setIsLoading(false);
      setStatusText("Email sending cancelled");
      setCurrentEmailStatus("Campaign cancelled");
      setProgress(0);
      setProgressDetails("");
      if ((window as any).currentEventSource) {
        (window as any).currentEventSource.close();
        (window as any).currentEventSource = null;
      }
    } catch (error) {
      console.error('Failed to cancel sending:', error);
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0f] text-[#e4e4e7] font-mono flex flex-col overflow-hidden">
      {/* Window Controls */}
      <div className="flex justify-end items-center h-6 bg-[#131316] border-b border-[#26262b] px-4 flex-shrink-0">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#3f3f46] hover:bg-[#52525b] cursor-pointer"></div>
          <div className="w-2 h-2 rounded-full bg-[#ef4444] hover:bg-[#dc2626] cursor-pointer"></div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Compact Sidebar */}
        <div className="w-40 bg-[#131316] border-r border-[#26262b] flex-shrink-0 flex flex-col">
          <div className="p-2">
            <div className="text-[#ef4444] font-mono text-[8px] leading-none mb-2 text-center">
              CLS SENDER
            </div>
            <nav className="space-y-1">
              <div className="bg-[#ef4444] text-white px-2 py-1 rounded text-[10px] text-center cursor-pointer">
                SENDER
              </div>
              <div
                className="text-[#a1a1aa] px-2 py-1 rounded hover:bg-[#ef4444] hover:text-white text-[10px] text-center cursor-pointer"
                onClick={() => setShowSettings(!showSettings)}
              >
                CONFIG
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content - 3 Column Grid */}
        <div className="flex-1 p-2 overflow-hidden">
          <div className="h-full grid grid-cols-3 gap-2">

            {/* LEFT COLUMN - Email Form */}
            <div className="bg-[#131316] rounded border border-[#26262b] p-2 overflow-y-auto">
              <h3 className="text-[10px] font-bold text-[#ef4444] mb-2">EMAIL FORM</h3>

              <div className="space-y-2">
                <div>
                  <Label className="text-[8px] text-[#a1a1aa]">Sender Email</Label>
                  <Input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[10px]"
                    readOnly={!senderEmail}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label className="text-[8px] text-[#a1a1aa]">Name</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[10px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[8px] text-[#a1a1aa]">Subject</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[10px]"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[8px] text-[#a1a1aa]">Letter Template</Label>
                  <Select value={selectedTemplate || "off"} onValueChange={handleTemplateChange}>
                    <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[10px]">
                      <SelectValue placeholder="-- Off --" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131316] border-[#26262b]">
                      <SelectItem value="off" className="text-white text-[10px]">-- Off --</SelectItem>
                      {templateFiles.map(file => (
                        <SelectItem key={file} value={file} className="text-white text-[10px]">{file}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[8px] text-[#a1a1aa]">HTML Content</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="bg-[#0f0f12] border-[#26262b] text-white h-20 resize-none text-[9px]"
                  />
                </div>

                <div>
                  <Label className="text-[8px] text-[#a1a1aa]">Recipients ({recipientCount})</Label>
                  <Textarea
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    className="bg-[#0f0f12] border-[#26262b] text-white h-20 resize-none text-[9px]"
                  />
                </div>

                <div>
                  <Label className="text-[8px] text-[#a1a1aa]">Attachments</Label>
                  <Button
                    variant="outline"
                    onClick={handleFileSelect}
                    className="w-full bg-[#0f0f12] border-[#26262b] text-white h-6 text-[10px]"
                  >
                    📎 Choose File
                  </Button>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
                  {selectedFiles && selectedFiles.length > 0 && (
                    <div className="flex items-center justify-between bg-[#0f0f12] border border-[#26262b] rounded px-2 py-1 mt-1">
                      <span className="text-[8px] text-[#a1a1aa]">{selectedFiles.length} file(s)</span>
                      <button onClick={removeAttachment} className="text-[#ef4444] text-xs">×</button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSendEmails}
                    disabled={isLoading}
                    className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white h-7 text-[10px]"
                  >
                    {isLoading ? 'SENDING...' : '🚀 SEND'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelSending}
                    disabled={!isLoading}
                    className="flex-1 border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white h-7 text-[10px]"
                  >
                    ⏹️ STOP
                  </Button>
                </div>
              </div>
            </div>

            {/* MIDDLE COLUMN - Settings & SMTP */}
            <div className="space-y-2 overflow-y-auto">

              {/* HTML Convert Settings */}
              <div className="bg-[#131316] rounded border border-[#26262b] p-2">
                <h3 className="text-[10px] font-bold text-[#ef4444] mb-2">HTML CONVERT</h3>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Button
                    type="button"
                    onClick={() => setAdvancedSettings({...advancedSettings, zipUse: !advancedSettings.zipUse})}
                    className={`${advancedSettings.zipUse ? 'bg-green-600' : 'bg-[#26262b]'} text-white text-[8px] px-2 py-1 h-5`}
                  >
                    ZIP {advancedSettings.zipUse && '✓'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setAdvancedSettings({...advancedSettings, htmlImgBody: !advancedSettings.htmlImgBody})}
                    className={`${advancedSettings.htmlImgBody ? 'bg-orange-600' : 'bg-[#26262b]'} text-white text-[8px] px-2 py-1 h-5`}
                  >
                    IMG {advancedSettings.htmlImgBody && '✓'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setAdvancedSettings({...advancedSettings, qrcode: !advancedSettings.qrcode})}
                    className={`${advancedSettings.qrcode ? 'bg-red-600' : 'bg-[#26262b]'} text-white text-[8px] px-2 py-1 h-5`}
                  >
                    QR {advancedSettings.qrcode && '✓'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setAdvancedSettings({...advancedSettings, randomMetadata: !advancedSettings.randomMetadata})}
                    className={`${advancedSettings.randomMetadata ? 'bg-blue-600' : 'bg-[#26262b]'} text-white text-[8px] px-2 py-1 h-5`}
                  >
                    META {advancedSettings.randomMetadata && '✓'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { format: 'pdf', label: 'PDF' },
                    { format: 'png', label: 'PNG' },
                    { format: 'docx', label: 'DOCX' },
                    { format: 'html', label: 'HTML' }
                  ].map(({ format, label }) => {
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
                        className={`${isActive ? 'bg-purple-600' : 'bg-[#26262b]'} text-white text-[8px] px-2 py-1 h-5`}
                      >
                        {label} {isActive && '✓'}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* SMTP Management */}
              <div className="bg-[#131316] rounded border border-[#26262b] p-2">
                <h3 className="text-[10px] font-bold text-[#ef4444] mb-2">SMTP</h3>
                {smtpData.currentSmtp && (
                  <div className="p-2 bg-blue-900/20 rounded border border-blue-500/30 mb-2">
                    <div className="text-[8px] text-white">
                      <div className="font-semibold">{smtpData.currentSmtp.fromEmail}</div>
                      <div className="text-[7px] text-[#a1a1aa]">{smtpData.currentSmtp.host}:{smtpData.currentSmtp.port}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    checked={smtpData.rotationEnabled}
                    onCheckedChange={toggleSmtpRotation}
                    disabled={smtpData.smtpConfigs?.length <= 1}
                  />
                  <Label className="text-[8px] text-[#a1a1aa]">Rotation</Label>
                  {smtpData.rotationEnabled && (
                    <Button onClick={rotateSmtp} className="ml-auto bg-[#26262b] text-white text-[8px] px-2 py-1 h-5">
                      🔄
                    </Button>
                  )}
                </div>
                <Button
                  onClick={() => setShowSmtpManager(!showSmtpManager)}
                  className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white h-6 text-[8px]"
                >
                  {showSmtpManager ? 'Hide Manager' : 'Manage SMTP'}
                </Button>

                {showSmtpManager && (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {smtpData.smtpConfigs?.map((smtp) => (
                      <div key={smtp.id} className="flex items-center justify-between p-1 border rounded text-[8px] border-[#26262b]">
                        <div className="flex-1 truncate">
                          <div className="text-white">{smtp.fromEmail}</div>
                        </div>
                        <Button
                          onClick={() => deleteSmtp(smtp.id)}
                          disabled={smtpData.smtpConfigs?.length <= 1}
                          className="bg-transparent text-red-400 text-[8px] px-1 py-0 h-4"
                        >
                          🗑️
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Settings */}
              <div className="bg-[#131316] rounded border border-[#26262b] p-2">
                <h3 className="text-[10px] font-bold text-[#ef4444] mb-2">AI</h3>
                <div className="space-y-1">
                  <Input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder="API Key"
                    className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[9px]"
                  />
                  <Button
                    onClick={initializeAI}
                    className={`w-full ${aiStatus.initialized ? 'bg-green-600' : 'bg-[#ef4444]'} text-white h-6 text-[8px]`}
                  >
                    {aiStatus.initialized ? 'Turn Off' : 'Initialize'}
                  </Button>
                  {aiEnabled && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Checkbox checked={useAISubject} onCheckedChange={(c) => setUseAISubject(!!c)} />
                        <Label className="text-[8px] text-[#a1a1aa]">AI Subject</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <Checkbox checked={useAISenderName} onCheckedChange={(c) => setUseAISenderName(!!c)} />
                        <Label className="text-[8px] text-[#a1a1aa]">AI Sender</Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Settings */}
              <div className="bg-[#131316] rounded border border-[#26262b] p-2">
                <h3 className="text-[10px] font-bold text-[#ef4444] mb-2">QR CONFIG</h3>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label className="text-[8px] text-[#a1a1aa]">Size</Label>
                    <Input
                      type="number"
                      value={advancedSettings.qrSize}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, qrSize: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[9px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[8px] text-[#a1a1aa]">Border</Label>
                    <Input
                      type="number"
                      value={advancedSettings.qrBorder}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, qrBorder: parseInt(e.target.value) || 0})}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[9px]"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[8px] text-[#a1a1aa]">Link</Label>
                  <Input
                    value={advancedSettings.qrLink}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, qrLink: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white h-6 text-[9px]"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Progress & Logs */}
            <div className="bg-[#131316] rounded border border-[#26262b] p-2 overflow-hidden flex flex-col">
              <h3 className="text-[10px] font-bold text-[#ef4444] mb-2">PROGRESS</h3>

              {statusText && (
                <div className="bg-[#ef4444] text-white px-2 py-1 rounded mb-2 text-[8px]">
                  {statusText}
                </div>
              )}

              {(isLoading || emailLogs.length > 0) && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="mb-2">
                    <Progress value={progress} className="h-2" />
                    <div className="text-[8px] text-[#a1a1aa] mt-1">{progressDetails}</div>
                  </div>

                  {currentEmailStatus && (
                    <div ref={currentStatusRef} className="mb-2 p-2 bg-blue-600/20 border border-blue-500/30 rounded">
                      <div className="text-[8px] text-blue-200">Currently Processing:</div>
                      <div className="text-[9px] text-white font-semibold">{currentEmailStatus}</div>
                    </div>
                  )}

                  <div className="flex-1 overflow-hidden border border-[#26262b] rounded">
                    <div className="bg-[#1a1a1f] px-2 py-1 border-b border-[#26262b]">
                      <span className="text-[8px] text-[#a1a1aa]">LOGS</span>
                    </div>
                    <div ref={logContainerRef} className="h-full overflow-y-auto p-1">
                      {emailLogs.length === 0 ? (
                        <div className="text-[8px] text-[#75798b] text-center py-4">
                          Waiting for emails...
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {emailLogs.slice(-50).reverse().map((log, index) => {
                            const logIndex = emailLogs.length - 1 - index;
                            const isRecentlyAdded = logIndex === recentlyAddedLogIndex;
                            return (
                              <div
                                key={index}
                                className={`text-[7px] py-1 px-2 rounded ${
                                  log.status === 'success'
                                    ? `bg-green-900/20 border-l-2 border-green-500 ${isRecentlyAdded ? 'ring-1 ring-green-400' : ''}`
                                    : `bg-red-900/20 border-l-2 border-red-500 ${isRecentlyAdded ? 'ring-1 ring-red-400' : ''}`
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className={log.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                                    {log.status === 'success' ? '✓' : '✗'}
                                  </span>
                                  <span className="text-white truncate flex-1">{log.recipient}</span>
                                  <span className="text-[#75798b] text-[6px]">
                                    {log.timestamp.slice(11, 19)}
                                  </span>
                                </div>
                                {log.error && (
                                  <div className="text-red-300 text-[6px] mt-0.5 truncate">
                                    {log.error}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-[#131316] border border-[#26262b] rounded-xl p-6 w-[800px] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSettings(false)}
              className="text-[#ef4444] hover:text-white text-xl float-right"
            >
              ×
            </button>
            <h2 className="text-lg font-semibold text-white mb-4">Advanced Settings</h2>
            <div className="text-[#a1a1aa] text-sm">Full settings panel content...</div>
          </div>
        </div>
      )}
    </div>
  );
}