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
  smtp?: { id: string, fromEmail: string, host: string }; // Added SMTP info
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

  // AbortController for proper email sending cancellation (Mode 1)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Attachment template change handler - local file reading only (Mode 1)
  const handleAttachmentTemplateChange = async (template: string) => {
    setSelectedAttachmentTemplate(template);

    if (template && template !== 'off') {
      try {
        if (window.electronAPI?.readFile) {
          // Read actual file content from local file system
          const content = await window.electronAPI.readFile(`./files/${template}`);
          setAttachmentHtml(content);
          console.log('[Mode 1] Attachment template loaded from local file:', template);
        } else {
          console.error('Electron API not available - Mode 1 requires local file system access');
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

  // Auto-save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('emailFormData', JSON.stringify(formData));
  }, [formData]);

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
  const [showSmtpManager, setShowSmtpManager] = useState(false);
  // AI Feature States
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiSubject, setAiSubject] = useState(false);
  const [aiSenderName, setAiSenderName] = useState(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [currentEmailStatus, setCurrentEmailStatus] = useState<string>("");
  const [recentlyAddedLogIndex, setRecentlyAddedLogIndex] = useState<number>(-1);
  const [currentSmtpInfo, setCurrentSmtpInfo] = useState<{id: string, fromEmail: string, host: string} | null>(null);

  // Refs for auto-scrolling
  const logContainerRef = useRef<HTMLDivElement>(null);
  const currentStatusRef = useRef<HTMLDivElement>(null);
  const [smtpData, setSmtpData] = useState({
    smtpConfigs: [] as any[],
    currentSmtp: null as any,
    rotationEnabled: false
  });
  const [newSmtp, setNewSmtp] = useState({
    host: "", port: "587", user: "", pass: "", fromEmail: "", fromName: ""
  });

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

  const loadTemplates = async () => {
    try {
      if (window.electronAPI?.listFiles) {
        // Mode 1 - use local files only
        const files = await window.electronAPI.listFiles('files');
        const htmlFiles = files.filter((file: string) => file.endsWith('.html'));
        setTemplateFiles(htmlFiles);
        console.log('[Mode 1] Loaded templates from local files:', htmlFiles);
      } else {
        console.error('Mode 1 requires Electron API for local file access');
        setTemplateFiles([]);
      }
    } catch (error) {
      console.error('Failed to load local templates:', error);
      setTemplateFiles([]);
    }
  };

  const loadLogoFiles = async () => {
    try {
      if (window.electronAPI?.listFiles) {
        // Mode 1 - use local files only
        const files = await window.electronAPI.listFiles('files/logo');
        const imageFiles = files.filter((file: string) =>
          /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file)
        );
        setLogoFiles(imageFiles);
        console.log('[Mode 1] Loaded logos from local files:', imageFiles);
      } else {
        console.error('Mode 1 requires Electron API for local file access');
        setLogoFiles([]);
      }
    } catch (error) {
      console.error('Failed to load local logos:', error);
      setLogoFiles([]);
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

  // Template change handler - local file reading only (Mode 1)
  const handleTemplateChange = async (template: string) => {
    setSelectedTemplate(template);

    // Load template content from local files only
    if (template && template !== 'off') {
      try {
        if (window.electronAPI?.readFile) {
          // Read actual file content from local file system
          const content = await window.electronAPI.readFile(`./files/${template}`);
          setEmailContent(content);
          setStatusText(`✓ Loaded template: ${template}`);
          console.log('[Mode 1] Template loaded from local file:', template);
        } else {
          setStatusText('Error: Mode 1 requires local file system access');
          console.error('Electron API not available - Mode 1 requires local file system access');
          setEmailContent('');
        }

        setTimeout(() => setStatusText(''), 3000);
      } catch (error) {
        setStatusText(`Error loading template: ${error}`);
        console.error('Template loading error:', error);
        setEmailContent('');
      }
    }
  };

  // Auto-load configuration on startup
  useEffect(() => {
    loadConfigFromFiles();
    loadLeadsFromFile(); // Load leads separately to avoid duplication
    fetchSmtpData(); // Add SMTP data loading
    checkAIStatus(); // Check AI status
  }, []); // Run once on component mount

  // Check AI status from Replit server
  const checkAIStatus = async () => {
    try {
      const { replitApiService } = await import('../services/replitApiService');
      const response = await fetch(replitApiService.getApiEndpoint('/api/ai/status'));
      if (response.ok) {
        const data = await response.json();
        setAiInitialized(data.initialized);
        if (data.initialized) {
          setAiEnabled(true);
        }
      }
    } catch (error) {
      console.error('[AI] Failed to check status:', error);
    }
  };

  // Initialize AI with API key
  const initializeAI = async () => {
    if (!aiApiKey) {
      setStatusText('Please enter AI API key'); // Use statusText for feedback
      return;
    }

    try {
      const { replitApiService } = await import('../services/replitApiService');
      const response = await fetch(replitApiService.getApiEndpoint('/api/ai/initialize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: aiApiKey })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAiInitialized(true);
          setStatusText('AI initialized successfully'); // Use statusText for feedback
          await checkAIStatus(); // Re-check status to ensure aiEnabled is set correctly
        } else {
          setStatusText('AI initialization failed'); // Use statusText for feedback
        }
      } else {
        setStatusText('AI initialization failed: Server error'); // Use statusText for feedback
      }
    } catch (error) {
      console.error('[AI] Initialization failed:', error);
      setStatusText('Failed to initialize AI'); // Use statusText for feedback
    }
  };


  // Prevent multiple config loads during development hot reloads
  const [configLoaded, setConfigLoaded] = useState(false);

  // SMTP Management Functions - Mode 1 local access only
  const fetchSmtpData = async () => {
    try {
      if (window.electronAPI?.smtpList) {
        // Use Electron API for SMTP data
        const data = await window.electronAPI.smtpList();
        if (data.success) {
          setSmtpData(data);
          console.log('[Mode 1] SMTP data loaded from local config:', data);
        }
      } else {
        console.error('Mode 1 requires Electron API for local SMTP config access');
      }
    } catch (error) {
      console.error('Failed to fetch SMTP data:', error);
    }
  };

  const toggleSmtpRotation = async () => {
    try {
      const newRotationState = !smtpData.rotationEnabled;

      if (window.electronAPI?.smtpToggleRotation) {
        const result = await window.electronAPI.smtpToggleRotation(newRotationState);
        if (result.success) {
          setSmtpData(prev => ({
            ...prev,
            rotationEnabled: newRotationState,
            currentSmtp: newRotationState && prev.smtpConfigs.length > 0
              ? prev.smtpConfigs[0]
              : prev.currentSmtp
          }));
          setStatusText(`SMTP rotation ${newRotationState ? 'enabled' : 'disabled'}`);
          setTimeout(() => setStatusText(""), 3000);
        } else {
          throw new Error('Failed to save rotation state');
        }
      } else {
        console.error('Electron API not available for SMTP rotation');
        setStatusText('Error: Electron API not available');
        setTimeout(() => setStatusText(""), 3000);
      }
    } catch (error) {
      console.error('Failed to toggle SMTP rotation:', error);
      setStatusText('Failed to toggle SMTP rotation');
      setTimeout(() => setStatusText(""), 3000);
    }
  };

  const addNewSmtp = async () => {
    // Mode 1 - SMTP configs managed via local config/smtp.ini file only
    setStatusText('Mode 1: Please add SMTP configs to your local config/smtp.ini file');
    setTimeout(() => setStatusText(""), 3000);
  };

  const deleteSmtp = async (smtpId: string) => {
    // Mode 1 - SMTP configs managed via local config/smtp.ini file only
    setStatusText('Mode 1: Please modify SMTP configs in your local config/smtp.ini file');
    setTimeout(() => setStatusText(""), 3000);
  };

  const rotateSmtp = async () => {
    // Mode 1 - SMTP configs managed via local config/smtp.ini file only
    setStatusText('Mode 1: SMTP rotation managed via local config/smtp.ini file');
    setTimeout(() => setStatusText(""), 3000);
  };

  // Load configuration from files - Mode 1 local access only
  const loadConfigFromFiles = async () => {
    if (configLoaded) return; // Prevent multiple loads
    try {
      let data;
      if (window.electronAPI?.loadConfig) {
        // Mode 1 - use Electron API for config loading only
        data = await window.electronAPI.loadConfig();
        console.log('[Mode 1] Config loaded from local config files');
      } else {
        console.error('Mode 1 requires Electron API for local config access');
        return;
      }

      if (data.success && data.config) {
        const config = data.config;

        // Load SMTP settings - check both SMTP object and direct config properties
        if (config.SMTP) {
          const smtpConfig = {
            host: config.SMTP.host || config.HOST || '',
            port: config.SMTP.port || config.PORT || '587',
            user: config.SMTP.user || config.USER || '',
            pass: config.SMTP.pass || config.PASS || '',
            fromEmail: config.SMTP.fromEmail || config.SMTP || '',
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
        } else if (config.HOST && config.USER && config.PASS && config.SMTP) {
          // Direct config properties (from setup.ini)
          const smtpConfig = {
            host: config.HOST,
            port: config.PORT || '587',
            user: config.USER,
            pass: config.PASS,
            fromEmail: config.SMTP,
            fromName: ''
          };
          setSMTPSettings(smtpConfig);

          // Auto-set sender email from SMTP config
          if (smtpConfig.fromEmail) {
            setSenderEmail(smtpConfig.fromEmail);
            console.log('[Config Load] Auto-set sender email from setup.ini:', smtpConfig.fromEmail);
          }
        }

        // Load advanced settings with delivery protection
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
          calendarMode: !!config.CALENDAR_MODE, // Load calendar mode
          hiddenImageFile: config.HIDDEN_IMAGE_FILE || '',
          hiddenImageSize: config.HIDDEN_IMAGE_SIZE?.toString() || '50',
          hiddenText: config.HIDDEN_TEXT || ''
        });

        // Note: Leads loading is handled by separate loadLeadsFromFile() call

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

  // Load leads from file - Mode 1 local access only
  const loadLeadsFromFile = async () => {
    try {
      let leadsData;
      if (window.electronAPI?.loadLeads) {
        // Mode 1 - use Electron API for leads.txt only
        leadsData = await window.electronAPI.loadLeads();
        console.log('[Mode 1] Leads loaded from local leads.txt file');
      } else {
        console.error('Mode 1 requires Electron API for local file access');
        return;
      }

      if (leadsData && leadsData.success && leadsData.leads && leadsData.leads.trim().length > 0) {
        setRecipients(leadsData.leads);
        const leadCount = leadsData.leads.split('\n').filter(Boolean).length;
        console.log(`[Mode 1] Auto-loaded ${leadCount} leads from local leads.txt`);
      } else {
        console.log('[Mode 1] No leads.txt found locally or it\'s empty, starting with empty recipients');
      }
    } catch (error) {
      console.error('[Mode 1] Error loading leads from local file:', error);
      setStatusText('Failed to load leads from local file');
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
    // Validate SMTP configuration before sending
    if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass) {
      setStatusText('SMTP configuration incomplete. Please check config files.');
      console.error('[Desktop] SMTP validation failed:', {
        hasHost: !!smtpSettings.host,
        hasUser: !!smtpSettings.user,
        hasPass: !!smtpSettings.pass
      });
      return;
    }

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

    // Priority 1: Selected template file (Mode 1 - local only)
    if (selectedTemplate && selectedTemplate !== 'off') {
      try {
        if (window.electronAPI?.readFile) {
          // Mode 1 - read from local file system only
          bodyHtml = await window.electronAPI.readFile(`./files/${selectedTemplate}`);
          console.log('[Mode 1] Template loaded for sending:', selectedTemplate);
        } else {
          console.error('Mode 1 requires Electron API for local file system access');
          bodyHtml = '';
        }
      } catch (error) {
        console.error('Failed to load template:', error);
        bodyHtml = '';
      }
    }
    // Priority 2: Direct HTML from textarea (args.html equivalent)
    else if (emailContent.trim()) {
      bodyHtml = emailContent.trim();
    }
    // Priority 3: Default letter fallback (Mode 1 - local only)
    else {
      try {
        if (window.electronAPI?.readFile) {
          // Mode 1 - read from local file system only
          bodyHtml = await window.electronAPI.readFile('./files/letter.html');
          console.log('[Mode 1] Default letter loaded for sending');
        } else {
          console.error('Mode 1 requires Electron API for local file system access');
          bodyHtml = '';
        }
      } catch (error) {
        console.log('No default letter.html found locally');
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
    setCurrentEmailStatus("");
    setCurrentSmtpInfo(null);

    try {
      const formData = new FormData();

      // Add all form data - exact match to original args
      formData.append('senderEmail', senderEmail);
      formData.append('senderName', senderName);
      formData.append('subject', subject);
      formData.append('html', mainHtml);
      formData.append('attachmentHtml', attachmentHtml || '');
      formData.append('recipients', JSON.stringify(recipients.split('\n').filter(r => r.trim())));

      // SMTP settings - ensure they're properly set from auto-loaded config
      const finalSmtpHost = smtpSettings.host || '';
      const finalSmtpPort = smtpSettings.port || '587';
      const finalSmtpUser = smtpSettings.user || '';
      const finalSmtpPass = smtpSettings.pass || '';

      console.log('[Desktop] SMTP Settings being sent:', {
        host: finalSmtpHost,
        port: finalSmtpPort,
        user: finalSmtpUser,
        hasPassword: !!finalSmtpPass
      });

      // Ensure all SMTP parameters are properly formatted strings
      formData.append('smtpHost', String(finalSmtpHost));
      formData.append('smtpPort', String(finalSmtpPort));
      formData.append('smtpUser', String(finalSmtpUser));
      formData.append('smtpPass', String(finalSmtpPass));

      // Advanced settings
      Object.entries(advancedSettings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      // AI settings
      formData.append('useAI', String(aiEnabled));

      // Add files
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('attachments', selectedFiles[i]);
        }
      }

      // Use Server-Sent Events for real-time progress
      // Mode 1 - Always use hosted Replit server for email sending
      if (!window.electronAPI) {
        setStatusText('Mode 1 requires Electron API for local file system access');
        return;
      }

      // Import and use the configurable Replit API service
      const { replitApiService } = await import('../services/replitApiService');
      const apiEndpoint = replitApiService.getEmailSendEndpoint();

      // Create AbortController for cancellation (Mode 1)
      abortControllerRef.current = new AbortController();

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
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
                  const progressData: EmailProgress = {
                    recipient: data.recipient || 'Unknown',
                    subject: data.subject || subject || 'No Subject',
                    status: data.status || 'fail',
                    error: data.error ?? undefined,
                    timestamp: data.timestamp || new Date().toISOString(),
                    totalSent: data.totalSent,
                    totalFailed: data.totalFailed,
                    totalRecipients: data.totalRecipients,
                    smtp: data.smtp // Include SMTP info
                  };

                  // Use flushSync to force immediate rendering of each email confirmation
                  flushSync(() => {
                    setEmailLogs(prev => [...prev, progressData]);

                    if (progressData.totalRecipients) {
                      const currentProgress = ((progressData.totalSent || 0) + (progressData.totalFailed || 0)) / progressData.totalRecipients * 100;
                      setProgress(currentProgress);
                      setProgressDetails(`Sent: ${progressData.totalSent || 0}, Failed: ${progressData.totalFailed || 0}, Total: ${progressData.totalRecipients}`);
                    }

                    // Update current SMTP info
                    if (progressData.smtp) {
                      setCurrentSmtpInfo(progressData.smtp);
                    }

                    if (progressData.status === 'success') {
                      setStatusText(`✓ Successfully sent to ${progressData.recipient}`);
                      setCurrentEmailStatus(`✓ Successfully sent to ${progressData.recipient}`);
                    } else {
                      setStatusText(`✗ Failed to send to ${progressData.recipient}: ${progressData.error || 'Unknown error'}`);
                      setCurrentEmailStatus(`✗ Failed to send to ${progressData.recipient}: ${progressData.error || 'Unknown error'}`);
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
        recipient: "N/A",
        subject: "N/A",
        status: "fail" as const,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }]);
    } finally {
      // Always ensure sending state is reset
      setIsLoading(false);
    }
  };

  const cancelSending = async () => {
    // Mode 1 - Use AbortController for proper cancellation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsLoading(false);
    setStatusText("Email sending cancelled (Mode 1)");
    setCurrentEmailStatus("");
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
                    <Label className="text-xs text-[red]">MAIN LETTER</Label>
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
                    <div className="text-xl text-[purple] mt-1">
                      {selectedTemplate && selectedTemplate !== 'off' ? (
                        <span>📄 Using template: <strong className="text-white">{selectedTemplate}</strong></span>
                      ) : (
                        <span>✏️ OFF TO USE TXT</span>
                      )}
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
                          <div><span className="text-cyan-400">{'{host}'}</span> - Host lowercase (gmail)</div>
                          <div><span className="text-cyan-400">{'{Host}'}</span> - Host capitalized (Gmail)</div>
                          <div><span className="text-cyan-400">{'{HOST}'}</span> - Host uppercase (GMAIL)</div>
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
                  <Label className="text-xs text-[red]"> HTML CONVERT LETTER</Label>
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
                      <span>Select One</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Section - Enhanced Real-time Display */}
              {(isLoading || emailLogs.length > 0) && (
                <div className="mb-6 border-2 border-[#ef4444] rounded-lg overflow-hidden">
                  <div className="bg-[#ef4444] text-white px-4 py-3 text-sm font-semibold flex items-center justify-between">
                    <span>{isLoading ? '🚀 SENDING EMAILS...' : '✅ SENDING COMPLETE'}</span>
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
                            {emailLogs.slice(-20).reverse().map((item, i) => (
                              <div key={i} className="text-xs font-mono">
                                <span className={item.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                                  [{item.timestamp.slice(11, 19)}]
                                </span>{' '}
                                <span className="text-[#a1a1aa]">
                                  {item.recipient} - {item.subject} - {item.status === 'success' ? 'SUCCESS' : 'FAILED'}
                                  {item.smtp && (
                                    <span className="text-blue-400"> [SMTP: {item.smtp.fromEmail} ({item.smtp.id})]</span>
                                  )}
                                  {item.error && ` (${item.error})`}
                                </span>
                              </div>
                            ))}
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
                    disabled={isLoading}
                    className="min-w-[110px] bg-[#ef4444] hover:bg-[#dc2626] text-white relative"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        SENDING...
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
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#26262b]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={smtpData.rotationEnabled}
                    onChange={toggleSmtpRotation}
                    disabled={smtpData.smtpConfigs?.length <= 1}
                    className="w-4 h-4"
                  />
                  <span className="text-[#a1a1aa] text-sm">ENABLE SMTP ROTATION</span>
                </label>
                {smtpData.rotationEnabled && smtpData.smtpConfigs?.length > 1 && (
                  <Button
                    onClick={rotateSmtp}
                    variant="outline"
                    size="sm"
                    className="border-[#26262b] text-white hover:bg-[#26262b] h-8 text-xs"
                  >
                    🔄 ROTATE
                  </Button>
                )}
              </div>

              {/* SMTP Management - Moved to SMTP Settings Area */}
              <div className="mt-4 bg-[#131316] rounded-xl border border-[#26262b] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    ⚙️ SMTP MANAGMENT
                  </h3>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => setShowSmtpManager(!showSmtpManager)}
                      variant="outline"
                      size="sm"
                      className="border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                    >
                      {showSmtpManager ? "Hide" : "Manage"}
                    </Button>
                  </div>
                </div>

                {/* SMTP Management Panel */}
                {showSmtpManager && (
                  <div className="border-t border-[#26262b] pt-4">
                    {/* Add New SMTP Form */}
                    <div className="mb-4 p-3 bg-[#0f0f12] rounded border border-[#26262b]">
                      <h4 className="text-white font-medium mb-3">Add New SMTP Server</h4>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <Input
                          placeholder="SMTP Host"
                          value={newSmtp.host}
                          onChange={(e) => setNewSmtp({...newSmtp, host: e.target.value})}
                          className="bg-[#0f0f12] border-[#26262b] text-white"
                        />
                        <Input
                          placeholder="Port (587)"
                          value={newSmtp.port}
                          onChange={(e) => setNewSmtp({...newSmtp, port: e.target.value})}
                          className="bg-[#0f0f12] border-[#26262b] text-white"
                        />
                        <Input
                          placeholder="Username"
                          value={newSmtp.user}
                          onChange={(e) => setNewSmtp({...newSmtp, user: e.target.value})}
                          className="bg-[#0f0f12] border-[#26262b] text-white"
                        />
                        <Input
                          type="password"
                          placeholder="Password"
                          value={newSmtp.pass}
                          onChange={(e) => setNewSmtp({...newSmtp, pass: e.target.value})}
                          className="bg-[#0f0f12] border-[#26262b] text-white"
                        />
                        <Input
                          placeholder="From Email"
                          value={newSmtp.fromEmail}
                          onChange={(e) => setNewSmtp({...newSmtp, fromEmail: e.target.value})}
                          className="bg-[#0f0f12] border-[#26262b] text-white"
                        />
                        <Input
                          placeholder="From Name (optional)"
                          value={newSmtp.fromName}
                          onChange={(e) => setNewSmtp({...newSmtp, fromName: e.target.value})}
                          className="bg-[#0f0f12] border-[#26262b] text-white"
                        />
                      </div>
                      <Button
                        onClick={addNewSmtp}
                        className="bg-[#ef4444] text-white hover:bg-[#dc3636]"
                        size="sm"
                      >
                        Add SMTP Server
                      </Button>
                    </div>

                    {/* SMTP List */}
                    <div>
                      <h4 className="text-white font-medium mb-3">Available SMTP Servers ({smtpData.smtpConfigs?.length || 0})</h4>
                      {smtpData.smtpConfigs?.map((smtp) => (
                        <div
                          key={smtp.id}
                          className={`flex items-center justify-between p-3 mb-2 border rounded ${
                            smtpData.currentSmtp?.id === smtp.id
                              ? 'border-blue-500 bg-blue-900/20'
                              : 'border-[#26262b] bg-[#0f0f12]'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-gray-600 text-white rounded text-xs">{smtp.id}</span>
                              <span className="text-white font-medium">{smtp.fromEmail}</span>
                              {smtpData.currentSmtp?.id === smtp.id && (
                                <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">Active</span>
                              )}
                            </div>
                            <p className="text-[#a1a1aa] text-sm mt-1">
                              {smtp.host}:{smtp.port} ({smtp.user})
                            </p>
                          </div>
                          <Button
                            onClick={() => deleteSmtp(smtp.id)}
                            disabled={smtpData.smtpConfigs?.length <= 1}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                          >
                            🗑️
                          </Button>
                        </div>
                      )) || <p className="text-[#a1a1aa] text-center py-4">No SMTP servers configured</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* AI Settings Section */}
            <div className="border-t border-[#26262b] pt-6">
              <h3 className="text-lg font-medium text-red mb-4">🤖 AI SENDER NAME- SUBJECT GENERATION</h3>
              <div className="bg-[#0a0a0f] p-4 rounded-lg border border-[#26262b] mb-4">


                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-[red]">Google AI API Key </Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="bg-[#0f0f12] border-[#26262b] text-white flex-1"
                      />
                      <Button
                        onClick={initializeAI}
                        className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
                      >
                        {aiInitialized ? 'Update' : 'Initialize'}
                      </Button>
                    </div>
                    {aiInitialized && (
                      <div className="text-xs text-green-500 mt-1">✓ AI is active</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={aiEnabled}
                      onCheckedChange={(checked: boolean) => setAiEnabled(!!checked)}
                      disabled={!aiInitialized}
                    />
                    <Label className="text-sm text-[#a1a1aa]">
                      Enable AI  
                    </Label>
                  </div>              
                </div>
              </div>
            </div>


            {/* HTML Convert Settings - Moved to Front */}
            <div className="mt-4 bg-[#0a0a0b] rounded-xl p-6 border border-[#26262b]">
              <div className="text-[#ef4444] font-mono text-xs leading-none text-left mb-1 whitespace-pre overflow-hidden">
 {`
╔═╗╔═╗╔═╗╔╗╔╦  ╦╔═╗╦═╗╔╦╗  ╦ ╦╔╦╗╔╦╗╦
║  ║ ║║║║║╚╗╔╝║╣ ╠╦╝ ║   ╠═╣ ║ ║║║║
╚═╝╚═╝╝╚╝ ╚╝ ╚═╝╩╚═ ╩   ╩ ╩ ╩ ╩ ╩╩═╝ `}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-sm text-[green] mb-3 block">CONVERSION FORMATS | Click to generate as attachments.</Label>
                  <div className="flex flex-wrap gap-3">
                    {/* Feature Toggle Buttons - All 5 Together */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button
                        type="button"
                        onClick={() => setAdvancedSettings({...advancedSettings, zipUse: !advancedSettings.zipUse})}
                        className={`${advancedSettings.zipUse ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500' : 'bg-[#1e1e22] hover:bg-[#2a2a2f] border-[#3a3a3f]'} text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all border-2`}
                        data-testid="toggle-zip-attachment"
                      >
                        📦 ZIP ATTACHMENT
                        {advancedSettings.zipUse && <span className="ml-2 text-xs">✓</span>}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setAdvancedSettings({...advancedSettings, htmlImgBody: !advancedSettings.htmlImgBody})}
                        className={`${advancedSettings.htmlImgBody ? 'bg-slate-600 hover:bg-slate-700 border-slate-500' : 'bg-[#1e1e22] hover:bg-[#2a2a2f] border-[#3a3a3f]'} text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all border-2`}
                        data-testid="toggle-html-to-img"
                      >
                        🖼️ HTML-TO-IMG
                        {advancedSettings.htmlImgBody && <span className="ml-2 text-xs">✓</span>}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setAdvancedSettings({...advancedSettings, qrcode: !advancedSettings.qrcode})}
                        className={`${advancedSettings.qrcode ? 'bg-red-600 hover:bg-red-700 border-red-500' : 'bg-[#1e1e22] hover:bg-[#2a2a2f] border-[#3a3a3f]'} text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all border-2`}
                        data-testid="toggle-qr-code"
                      >
                        🔲 QR CODE
                        {advancedSettings.qrcode && <span className="ml-2 text-xs">✓</span>}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setAdvancedSettings({...advancedSettings, randomMetadata: !advancedSettings.randomMetadata})}
                        className={`${advancedSettings.randomMetadata ? 'bg-cyan-600 hover:bg-cyan-700 border-cyan-500' : 'bg-[#1e1e22] hover:bg-[#2a2a2f] border-[#3a3a3f]'} text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all border-2`}
                        data-testid="toggle-random-metadata"
                      >
                        🎲 Random Metadata
                        {advancedSettings.randomMetadata && <span className="ml-2 text-xs">✓</span>}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setAdvancedSettings({...advancedSettings, calendarMode: !advancedSettings.calendarMode})}
                        className={`${advancedSettings.calendarMode ? 'bg-purple-600 hover:bg-purple-700 border-purple-500' : 'bg-[#1e1e22] hover:bg-[#2a2a2f] border-[#3a3a3f]'} text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all border-2`}
                        data-testid="toggle-calendar-mode"
                      >
                        📅 CALENDAR MODE
                        {advancedSettings.calendarMode && <span className="ml-2 text-xs">✓</span>}
                      </Button>
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

                </div>
                <div>
                  <Label className="text-sm text-[red] mb-2 mt-4 block">ZIP PASSWORD FOR ATTACHMENT</Label>
                  <Input
                    type="password"
                    value={advancedSettings.zipPassword}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, zipPassword: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="Optional"
                  />
                </div>
               
                </div>
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
                   |_________________|
                       _[_______]_
                   ___[___________]___
                  |         [_____] []|__
                  |         [_____] []|  \__
                  L___________________J     \ \___\/  /###GET#CONNECTED###
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
                          {logoFiles.map(file => (
                            <SelectItem key={file} value={file} className="text-white focus:text-white">{file}</SelectItem>
                          ))}
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
                      placeholder="Optional"
                    />
                  </div>
                </div>


                <div>
                  <Label className="text-sm text-[red]">QR LINK</Label>
                  <Input
                    value={advancedSettings.qrLink}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, qrLink: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="https://example.com?user={email}"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[red]">LINK : USE {"{link}"} placeholder </Label>
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
                  <h3 className="text-lg font-medium text-red mt-6 mb-4">🏢 DOMAIN LOGO </h3>
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