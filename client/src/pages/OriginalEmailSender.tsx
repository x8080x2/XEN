import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { SMTPManager } from "@/components/SMTPManager";
import { useToast } from "@/hooks/use-toast";

interface EmailProgress {
  recipient: string;
  subject: string;
  status: 'success' | 'fail';
  error?: string;
  timestamp: string;
  totalSent?: number;
  totalFailed?: number;
  totalRecipients?: number;
  type: string; // Added for SSE data type
  message?: string; // Added for error messages
  smtp?: { // Added to store SMTP info
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
  // Form state - exact match to original
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [recipients, setRecipients] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [templateFiles, setTemplateFiles] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedAttachmentTemplate, setSelectedAttachmentTemplate] = useState("");
  const [attachmentHtml, setAttachmentHtml] = useState("");

  // Attachment template change handler - using consolidated template loading
  const handleAttachmentTemplateChange = async (template: string) => {
    setSelectedAttachmentTemplate(template);

    if (template && template !== 'off') {
      try {
        const content = await loadTemplateContent(`files/${template}`);
        if (content) {
          setAttachmentHtml(content);
          setStatusText(`✓ Loaded attachment template: ${template}`);
          setTimeout(() => setStatusText(""), 3000);
        } else {
          setStatusText(`✗ Failed to load template: ${template}`);
          setAttachmentHtml('');
        }
      } catch (error) {
        console.error('Error loading attachment template:', error);
        setStatusText(`✗ Error loading template: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setAttachmentHtml('');
      }
    } else {
      setAttachmentHtml('');
      setStatusText('');
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
  const [failedEmails, setFailedEmails] = useState<string[]>([]);
  const [unsentEmails, setUnsentEmails] = useState<string[]>([]);
  const [originalRecipients, setOriginalRecipients] = useState<string[]>([]);
  const [sentEmails, setSentEmails] = useState<string[]>([]);
  
  // Use refs for immediate access during completion handling (avoid React state batching issues)
  const sentEmailsRef = useRef<string[]>([]);
  const originalRecipientsRef = useRef<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Limit email logs to prevent memory leak (keep last 500 entries)
  const MAX_EMAIL_LOGS = 500;
  const [showSmtpManager, setShowSmtpManager] = useState(false);
  const [templateRotation, setTemplateRotation] = useState(false);
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('google_ai_key') || '');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [useAISubject, setUseAISubject] = useState(false);
  const [useAISenderName, setUseAISenderName] = useState(false);
  const [aiStatus, setAiStatus] = useState({ initialized: false, hasApiKey: false, provider: 'gemini' });
  const [currentEmailStatus, setCurrentEmailStatus] = useState<string>("");
  const [recentlyAddedLogIndex, setRecentlyAddedLogIndex] = useState<number>(-1);
  const [currentSmtpInfo, setCurrentSmtpInfo] = useState<{id: string, fromEmail: string, host: string} | null>(null);

  // Refs for auto-scrolling
  const logContainerRef = useRef<HTMLDivElement>(null);
  const currentStatusRef = useRef<HTMLDivElement>(null);

  // Toast for notifications
  const { toast } = useToast();

  // Copy failed and unsent emails to clipboard
  const copyFailedAndUnsentEmails = async () => {
    // Normalize all emails for deduplication (trim + lowercase)
    const normalizedFailed = failedEmails.map(e => e.trim().toLowerCase());
    const normalizedUnsent = unsentEmails.map(e => e.trim().toLowerCase());
    const allEmailsToRetry = [...new Set([...normalizedFailed, ...normalizedUnsent])];
    if (allEmailsToRetry.length === 0) return;

    const emailText = allEmailsToRetry.join('\n');
    try {
      await navigator.clipboard.writeText(emailText);
      const failedCount = failedEmails.length;
      const unsentCount = unsentEmails.length;
      let description = '';
      if (failedCount > 0 && unsentCount > 0) {
        description = `${failedCount} failed + ${unsentCount} unsent emails copied. Paste into recipients field to retry.`;
      } else if (failedCount > 0) {
        description = `${failedCount} failed email${failedCount > 1 ? 's' : ''} copied. Paste into recipients field to retry.`;
      } else {
        description = `${unsentCount} unsent email${unsentCount > 1 ? 's' : ''} copied. Paste into recipients field to retry.`;
      }
      toast({
        title: "Copied to clipboard!",
        description,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please try again or copy manually from the logs.",
        variant: "destructive"
      });
    }
  };

  // Consolidated progress update function
  const updateProgress = useCallback((progressData: EmailProgress) => {
    console.log(`[TIMING] UI updating at ${Date.now()}, recipient: ${progressData.recipient}`);

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
        // Track sent emails for calculating unsent later (normalize for consistent comparison)
        const normalizedEmail = progressData.recipient.trim().toLowerCase();
        setSentEmails(prev => [...prev, normalizedEmail]);
        sentEmailsRef.current = [...sentEmailsRef.current, normalizedEmail];
      } else {
        setCurrentEmailStatus(`✗ Failed to send to ${progressData.recipient}: ${progressData.error}`);
      }
      
      // Cleanup old logs to prevent memory leak
      setEmailLogs(prev => {
        const newLogs = [...prev];
        if (newLogs.length >= MAX_EMAIL_LOGS) {
          // Remove oldest 100 entries when limit is reached
          newLogs.splice(0, 100);
        }
        return newLogs;
      });
  }, [MAX_EMAIL_LOGS]);
  const [smtpData, setSmtpData] = useState({
    smtpConfigs: [] as any[],
    currentSmtp: null as any,
    rotationEnabled: false
  });
  const [newSmtp, setNewSmtp] = useState({
    host: "", port: "587", user: "", pass: "", fromEmail: "", fromName: ""
  });
  const [smtpOnline, setSmtpOnline] = useState<boolean | null>(null);
  const [smtpChecking, setSmtpChecking] = useState(false);
  const smtpCheckingRef = useRef(false);
  const [smtpStatus, setSmtpStatus] = useState<{[smtpId: string]: 'online' | 'offline' | 'testing' | 'unknown'}>({});

  // Test individual SMTP server
  const testIndividualSmtp = async (smtpId: string) => {
    setSmtpStatus(prev => ({ ...prev, [smtpId]: 'testing' }));
    try {
      const response = await fetch(`/api/smtp/test/${smtpId}`);
      const data = await response.json();
      setSmtpStatus(prev => ({ 
        ...prev, 
        [smtpId]: data.online ? 'online' : 'offline' 
      }));
    } catch (error) {
      setSmtpStatus(prev => ({ ...prev, [smtpId]: 'offline' }));
    }
  };

  // Test all SMTP servers
  const testAllSmtpServers = async () => {
    if (!smtpData.smtpConfigs?.length) return;
    for (const smtp of smtpData.smtpConfigs) {
      testIndividualSmtp(smtp.id);
    }
  };

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

  // Consolidated template loading function
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

  // Template change handler - using consolidated template loading
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

  // Auto-load configuration on startup - exact clone from main.js line 308
  useEffect(() => {
    loadConfigFromFiles();
    fetchSmtpData();
    checkAIStatus();
  }, []); // Run once on component mount

  // Auto-load AI key from config and initialize AI service
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
      // Cleanup polling interval on component unmount
      if ((window as any).pollingInterval) {
        clearInterval((window as any).pollingInterval);
        (window as any).pollingInterval = null;
      }
    };
  }, []);

  const checkAIStatus = async () => {
    try {
      const response = await fetch('/api/ai/status');
      const data = await response.json();
      setAiStatus(data);
      // Don't automatically enable AI, let user control it with checkbox
    } catch (error) {
      console.error('Failed to check AI status:', error);
    }
  };

  const initializeAI = async () => {
    // If AI is already initialized, this button acts as a toggle to turn it OFF
    if (aiStatus.initialized) {
      try {
        // Call backend to deinitialize AI service
        const response = await fetch('/api/ai/deinitialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.success) {
          setAiEnabled(false); // Disable AI features
          setAiStatus({ initialized: false, hasApiKey: false, provider: null }); // Reset status
          setStatusText('AI service turned off successfully');
          localStorage.removeItem('google_ai_key'); // Remove key from local storage

          // Clear from config file but keep the key in the input field for easy re-initialization
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

    // If AI is not initialized, proceed with initialization
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
        // Save to localStorage and config file
        localStorage.setItem('google_ai_key', aiApiKey);

        // Save to setup.ini
        await fetch('/api/config/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ GOOGLE_AI_KEY: aiApiKey })
        });

        // Let user control AI enabled state via checkbox
        setStatusText('AI initialized successfully and saved to config');
        await checkAIStatus();
        setAiEnabled(true); // Enable AI after successful initialization
      } else {
        setStatusText('AI initialization failed');
      }
    } catch (error) {
      setStatusText('Failed to initialize AI');
    }
  };

  // Prevent multiple config loads during development hot reloads
  const [configLoaded, setConfigLoaded] = useState(false);

  // SMTP Management Functions
  const fetchSmtpData = async () => {
    try {
      const response = await fetch("/api/smtp/list");
      const data = await response.json();
      if (data.success) {
        setSmtpData(data);
        
        // Single unified auto-test: test all SMTPs (including current)
        if (data.smtpConfigs?.length) {
          // Set all to 'testing' status
          const initialStatus: {[key: string]: 'testing'} = {};
          data.smtpConfigs.forEach((smtp: any) => {
            initialStatus[smtp.id] = 'testing';
          });
          setSmtpStatus(initialStatus);
          
          // Test each SMTP once
          for (const smtp of data.smtpConfigs) {
            testIndividualSmtp(smtp.id);
          }
        }
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
        checkSmtpStatus();
        // Test the newly added SMTP
        if (data.smtpId) {
          testIndividualSmtp(data.smtpId);
        }
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
      const response = await fetch("/api/smtp/rotate", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success && data.currentSmtp) {
        setSmtpData(prev => ({
          ...prev,
          currentSmtp: data.currentSmtp,
          rotationEnabled: data.rotationEnabled
        }));
        toast({
          title: "SMTP Rotated",
          description: `Now using: ${data.currentSmtp.fromEmail} (${data.currentSmtp.id})`,
        });
        checkSmtpStatus();
      } else {
        throw new Error(data.error || 'Failed to rotate SMTP');
      }
    } catch (error: any) {
      console.error('SMTP rotation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to rotate SMTP",
        variant: "destructive"
      });
    }
  };

  const checkSmtpStatus = async () => {
    if (smtpCheckingRef.current) return;

    smtpCheckingRef.current = true;
    setSmtpChecking(true);
    try {
      const response = await fetch("/api/smtp/test");
      const data = await response.json();
      setSmtpOnline(data.online);

      if (!data.online) {
        console.log('[SMTP Status] OFFLINE:', data.error);
      } else {
        console.log('[SMTP Status] ONLINE:', data.smtp);
      }
    } catch (error) {
      console.error('[SMTP Status] Check failed:', error);
      setSmtpOnline(false);
    } finally {
      setSmtpChecking(false);
      smtpCheckingRef.current = false;
    }
  };

  // Load configuration from files - exact clone from main.js
  const loadConfigFromFiles = async () => {
    if (configLoaded) return; // Prevent multiple loads
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

        // Auto-load leads from files/leads.txt - exact clone from main.js line 562
        try {
          const leadsResponse = await fetch('/api/config/loadLeads');
          const leadsData = await leadsResponse.json();
          if (leadsData.success && leadsData.leads && leadsData.leads.trim().length > 0) {
            setRecipients(leadsData.leads);
          }
        } catch (leadsError) {
          console.log('[Config Load] Failed to load leads:', leadsError);
        }

        // Auto-load letter content if available
        if (config.LETTER_CONTENT) {
          setEmailContent(config.LETTER_CONTENT);
        }

        // Auto-load subject if available
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

  const handleSendEmails = async () => {
    // Validation logic - exact clone from sender.html lines 1307-1321
    const recipientList = recipients.split('\n').map(email => email.trim()).filter(email => email !== '');

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
      bodyHtml = await loadTemplateContent('files/letter.html');
      if (!bodyHtml) {
        console.log('No default letter.html found');
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
    setFailedEmails([]);
    setUnsentEmails([]);
    setSentEmails([]);
    setProgressDetails("");
    setCurrentEmailStatus("");
    setCurrentSmtpInfo(null);
    
    // Store original recipients for calculating unsent emails later (normalize for consistent comparison)
    const normalizedRecipients = recipientList.map(e => e.trim().toLowerCase());
    setOriginalRecipients(normalizedRecipients);
    originalRecipientsRef.current = normalizedRecipients;
    sentEmailsRef.current = [];

    // Clear any existing polling interval
    if ((window as any).pollingInterval) {
      clearInterval((window as any).pollingInterval);
      (window as any).pollingInterval = null;
    }

    try {
      // Prepare and send the email request
      const formData = new FormData();

      // Add all form data - exact match to original args
      formData.append('senderEmail', senderEmail);
      formData.append('senderName', senderName || '');
      formData.append('replyTo', replyTo || '');
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
        formData.append(key, String(value));
      });

      // AI settings - send correct flags to backend
      formData.append('useAIEnabled', String(aiEnabled));
      formData.append('useAISubject', String(aiEnabled && useAISubject));
      formData.append('useAISenderName', String(aiEnabled && useAISenderName));

      // Template rotation setting
      formData.append('templateRotation', String(templateRotation));

      // Add files
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('attachments', selectedFiles[i]);
        }
      }

      setStatusText("Sending emails...");

      // Start email sending
      const response = await fetch('/api/original/sendMail', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start email sending');
      }

      setStatusText("Email sending started. Receiving live updates...");

      // Start polling for progress updates
      let lastLogCount = 0;
      
      const pollProgress = async () => {
        try {
          const progressRes = await fetch(`/api/original/progress?since=${lastLogCount}`, {
            cache: 'no-store'  // Prevent 304 responses
          });
          
          if (!progressRes.ok) {
            console.error('Progress request failed:', progressRes.status);
            return;
          }
          
          const data = await progressRes.json();
          
          if (data.logs && data.logs.length > 0) {
            for (const log of data.logs) {
              if (log.type === 'complete') {
                setIsLoading(false);
                setProgress(100);
                
                // Check for partial completion (indicates a bug or premature exit)
                if (log.isPartialCompletion) {
                  const processed = log.totalProcessed || ((log.sent || 0) + (log.failed || 0));
                  if (log.wasCancelled) {
                    setStatusText(`Cancelled: Sent ${log.sent}, Failed ${log.failed} (${processed}/${log.totalRecipients} processed before cancellation)`);
                  } else if (log.unexpectedExit) {
                    setStatusText(`WARNING: Sending stopped unexpectedly! Only ${processed}/${log.totalRecipients} emails processed. Sent: ${log.sent}, Failed: ${log.failed}`);
                  } else {
                    setStatusText(`Stopped early: Only ${processed}/${log.totalRecipients} emails processed. Sent: ${log.sent}, Failed: ${log.failed}`);
                  }
                  console.warn('[Polling] Partial completion detected:', log);
                } else {
                  setStatusText(`Email sending completed. Sent: ${log.sent} emails${log.failed ? `, Failed: ${log.failed}` : ''}`);
                }
                
                setCurrentEmailStatus("");
                if (log.failedEmails && log.failedEmails.length > 0) {
                  setFailedEmails(log.failedEmails);
                }
                
                // Calculate unsent emails if partial completion detected
                if (log.isPartialCompletion && log.totalRecipients) {
                  // Use refs for immediate access (avoid React state batching issues)
                  const currentSentEmails = sentEmailsRef.current;
                  const currentOriginalRecipients = originalRecipientsRef.current;
                  
                  // Normalize failed emails for comparison
                  const normalizedFailedEmails = (log.failedEmails || []).map((e: string) => e.trim().toLowerCase());
                  
                  // Get all processed emails (sent + failed) - all normalized
                  const processedEmails = new Set([
                    ...normalizedFailedEmails,
                    ...currentSentEmails
                  ]);
                  
                  // Find emails that were never attempted
                  const unsent = currentOriginalRecipients.filter(email => !processedEmails.has(email));
                  setUnsentEmails(unsent);
                  console.log(`[Polling] Calculated ${unsent.length} unsent emails out of ${currentOriginalRecipients.length} original recipients (sent: ${currentSentEmails.length}, failed: ${normalizedFailedEmails.length})`);
                }
                
                // Stop polling
                if ((window as any).pollingInterval) {
                  clearInterval((window as any).pollingInterval);
                  (window as any).pollingInterval = null;
                }
              } else if (log.type === 'cancelled') {
                // Handle cancellation notification immediately
                setIsLoading(false);
                setStatusText(`Cancelling... Sent ${log.totalSent || 0}, Failed ${log.totalFailed || 0}`);
                console.log('[Polling] Cancellation notification received:', log);
              } else if (log.type === 'error') {
                setIsLoading(false);
                setStatusText(`Error: ${log.error}`);
                
                // Stop polling
                if ((window as any).pollingInterval) {
                  clearInterval((window as any).pollingInterval);
                  (window as any).pollingInterval = null;
                }
              } else {
                // Regular progress update
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
            
            lastLogCount = data.total;
          }
          
          // Stop polling when sending is complete
          if (!data.inProgress) {
            if ((window as any).pollingInterval) {
              clearInterval((window as any).pollingInterval);
              (window as any).pollingInterval = null;
            }
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error polling progress:', err);
          console.error('Error details:', {
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            type: typeof err,
            err
          });
        }
      };

      // Poll every 300ms for smooth updates
      (window as any).pollingInterval = setInterval(pollProgress, 300);
      
      // Also poll immediately
      pollProgress();

    } catch (error: any) {
      console.error('Email sending error:', error);
      
      // Clear polling on error
      if ((window as any).pollingInterval) {
        clearInterval((window as any).pollingInterval);
        (window as any).pollingInterval = null;
      }
      
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

      // Stop polling
      if ((window as any).pollingInterval) {
        clearInterval((window as any).pollingInterval);
        (window as any).pollingInterval = null;
      }
    } catch (error) {
      console.error('Failed to cancel sending:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7] font-mono">
      {/* Window Controls */}
      <div className="flex justify-end items-center h-8  border-b border-[#26262b] px-4">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3f3f46] hover:bg-[#52525b] cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#ef4444] hover:bg-[#dc2626] cursor-pointer"></div>
        </div>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="w-36 border-r border-[#26262b] min-h-screen flex flex-col">
          <div className="p-3">
            <div className="flex flex-col items-center mb-4">
              <div className="text-center text-[#a1a1aa] text-xs">
                <div className="text-[#ef4444] font-bold">CLS V1 🚸</div>
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
                CONFIG⚙️
              </div>
            </nav>
          </div>

          {/* Bottom section with status and logo */}
          <div className="mt-auto flex flex-col items-center gap-2 pb-12 px-2">
            {/* ASCII Art Status Display */}
            <div className="text-center">
              <div className="text-[#ef4444] font-mono text-xs whitespace-pre opacity-70">
                ▓ SYSTEM STATUS ▓
              </div>
              <div className="flex items-center justify-center gap-2 px-1 py-2">
                {(() => {
                  const statusValues = Object.values(smtpStatus);
                  const hasOnline = statusValues.some(s => s === 'online');
                  const hasTesting = statusValues.some(s => s === 'testing');
                  const allOffline = statusValues.length > 0 && statusValues.every(s => s === 'offline');
                  
                  const isChecking = hasTesting || smtpChecking;
                  const isOnline = hasOnline;
                  const isOffline = allOffline && !hasTesting;
                  
                  return (
                    <>
                      <div className={`text-xs ${isChecking && !hasOnline ? 'text-yellow-400' : isOnline ? 'text-green-400' : 'text-[#ef4444]'} ${isChecking ? 'animate-pulse' : ''}`}>📡</div>
                      <div className={`text-xs ${isChecking && !hasOnline ? 'text-yellow-400' : isOnline ? 'text-green-400' : 'text-[#ef4444]'}`}>
                        {isChecking && !hasOnline ? 'CHECKING...' : isOnline ? 'ONLINE' : 'OFFLINE'}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            {/* Logo */}
            <img src="/logo.png" alt="Closed" className="w-10 h-auto opacity-70" />
          </div>
        </div>

        {/* Main Content - Fixed width container with scaling */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[900px] w-[900px] mx-auto origin-top-left" style={{ transform: 'scale(max(0.6, min(1, calc((100vw - 80px) / 900))))' }}>

              <div className="text-center mt-1">
                <div className="text-[#ef4444] text-xl font-bold">CLOSED ADVANCED SMART EMAIL SENDER ⚡</div>
                <div className="text-[green] text-xs">
                     <a href="https://t.me/Closedsenderbot" target="_blank" rel="noopener noreferrer">Click to Download: @ClosedSenderBot</a>
                </div>
                <div className="text-[#a1a1aa] text-xs mt-1">═══════════════════════════════════════════════════════════════════════════════════════════════════</div>
              </div>

            <div className="bg-[#131316] rounded-lg border border-[#26262b] p-3">
              {/* Sender Email, Name, Reply-To, Subject Row - Fixed 4 columns */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <Label className="text-xl text-[red] mb-1">SENDER EMAIL</Label>
                  <Input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="sender@example.com"
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    readOnly={!senderEmail}
                  />
                  {senderEmail && (
                    <div className="text-xs mt-1 text-[#00ff5f]">✓ Loaded from SMTP config</div>
                  )}
                </div>
                <div>
                  <Label className="text-xl text-[red] mb-1">SENDER NAME</Label>
                  <Input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your Name"
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                  />
                </div>
                <div>
                  <Label className="text-xl text-[green] mb-1">REPLY TO</Label>
                  <Input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="reply@example.com"
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    data-testid="input-reply-to"
                  />
                </div>
                <div>
                  <Label className="text-xl text-[red] mb-1">SUBJECT</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                  />
                </div>
              </div>


              {/* Main Content Row - Fixed 2 columns */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Letter */}
                <div>
                  <Label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-1 font-bold bg-[#db1818] text-[12px] text-[#00ff00]">LETTER</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Enter your letter content here..."
                    className="bg-[#0f0f12] border-[#26262b] text-white min-h-[200px]"
                  />
                  <div className="mt-2">
                    <Label className="text-xl text-[red]">MAIN LETTER</Label>
                    <Select value={selectedTemplate || "off"} onValueChange={handleTemplateChange}>
                      <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-xs">
                        <SelectValue placeholder="-- Off --" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#131316] border-[#26262b]">
                        <SelectItem value="off" className="text-white focus:text-white">-- Turned Off --</SelectItem>
                        {templateFiles.map(file => (
                          <SelectItem key={file} value={file} className="text-white focus:text-white">{file}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Display which template is currently active - exact clone from sender.html */}
                    <div className="text-xl font-bold text-[red] mt-1">
                      {selectedTemplate && selectedTemplate !== 'off' ? (
                        <span>📄 Using template: <strong className="text-white">{selectedTemplate}</strong></span>
                      ) : (
                        <span>✏️ OFF TO USE TXT </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Maillist */}
                <div>
                  <Label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-1 font-bold bg-[#ff0a0af0] text-[12px] text-[#00ff00]">MAILLIST</Label>
                  <Textarea
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="recipient1@example.com&#10;recipient2@example.com&#10;recipient3@example.com"
                    className="bg-[#0f0f12] border-[#26262b] text-white min-h-[200px]"
                  />
                  <div className="text-xs text-[#75798b] mt-1">
                    {recipientCount} recipients
                  </div>
                  <details className="mt-3 bg-gradient-to-br from-[#1a1a1f] to-[#131316] rounded-xl border border-[#2a2a35] shadow-lg shadow-black/20 group overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 transition-all duration-200">
                      <span className="text-sm font-semibold bg-gradient-to-r from-[#ef4444] to-[#f97316] bg-clip-text text-transparent">📝 SENDER TAGS (Click to Expand)</span>
                      <span className="text-[#ef4444] text-xs group-open:rotate-180 transition-transform duration-300 bg-[#ef4444]/10 w-6 h-6 rounded-full flex items-center justify-center">▼</span>
                    </summary>
                    <div className="text-xs text-[#a1a1aa] space-y-3 p-4 border-t border-[#2a2a35]/50 bg-gradient-to-b from-transparent to-black/10">
                      <div className="space-y-2">
                        <div className="text-yellow-400 font-semibold">📧 Basic Email Placeholders:</div>
                        <div className="font-mono text-[10px] grid grid-cols-2 gap-1 pl-2">
                          <div><span className="text-green-400">{'{name}'}</span> - Full name Title Case</div>
                          <div><span className="text-green-400">{'{Name}'}</span> - First name only</div>
                          <div><span className="text-green-400">{'{NAME}'}</span> - Full name UPPERCASE</div>
                          <div><span className="text-green-400">{'{user}'}</span> - Username lowercase</div>
                          <div><span className="text-green-400">{'{User}'}</span> - Username capitalized</div>
                          <div><span className="text-green-400">{'{USER}'}</span> - Username UPPERCASE</div>
                          <div><span className="text-green-400">{'{username}'}</span> - Same as user</div>
                          <div><span className="text-green-400">{'{email}'}</span> - Email lowercase</div>
                          <div><span className="text-green-400">{'{Email}'}</span> - Email capitalized</div>
                          <div><span className="text-green-400">{'{EMAIL}'}</span> - Email UPPERCASE</div>
                          <div><span className="text-green-400">{'{domain}'}</span> - Domain lowercase</div>
                          <div><span className="text-green-400">{'{Domain}'}</span> - Domain capitalized</div>
                          <div><span className="text-green-400">{'{DOMAIN}'}</span> - Domain UPPERCASE</div>
                          <div><span className="text-green-400">{'{date}'}</span> - Current date</div>
                          <div><span className="text-green-400">{'{time}'}</span> - Current time</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-blue-400 font-semibold">🔧 Advanced Email Placeholders:</div>
                        <div className="font-mono text-[10px] grid grid-cols-2 gap-1 pl-2">
                          <div><span className="text-cyan-400">{'{domainbase}'}</span> - Domain without TLD</div>
                          <div><span className="text-cyan-400">{'{initials}'}</span> - User initials</div>
                          <div><span className="text-cyan-400">{'{userid}'}</span> - Unique user ID</div>
                          <div><span className="text-cyan-400">{'{emailb64}'}</span> - Base64 encoded email</div>
                          <div><span className="text-green-400">{'{host}'}</span> - Host lowercase (gmail)</div>
                          <div><span className="text-green-400">{'{Host}'}</span> - Host capitalized (Gmail)</div>
                          <div><span className="text-green-400">{'{HOST}'}</span> - Host uppercase (GMAIL)</div>
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

                      <div className="mt-3 p-2 bg-[black] rounded border-l-2 border-[#ef4444]">
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



              {/* Second Row - Attachment Files and HTML - Fixed 2 columns */}
              <div className="grid grid-cols-2 gap-3 mb-3">
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
                      <div className="bg-[#0f0f12] border border-[#26262b] rounded px-3 py-2 space-y-1">
                        {Array.from(selectedFiles).map((file, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-xs text-[#a1a1aa] truncate">
                              📎 {file.name}
                            </span>
                            {index === 0 && (
                              <button
                                onClick={removeAttachment}
                                className="text-[#ef4444] hover:text-[#dc2626] text-sm ml-2"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-[#75798b]">Supports various file formats</div>
                  </div>
                </div>

                {/* Attachment HTML Template */}
                <div>
                  <Label className="text-xl text-[red]"> HTML CONVERT LETTER</Label>
                  <Select value={selectedAttachmentTemplate || "off"} onValueChange={handleAttachmentTemplateChange}>
                    <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-xs">
                      <SelectValue placeholder="-- Off --" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131316] border-[#26262b]">
                      <SelectItem value="off" className="text-white focus:text-white">-- Turned Off --</SelectItem>
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
                <div className="mb-3 border-2 border-[#ef4444] rounded-lg overflow-hidden">
                  <div className="bg-[#ef4444] text-white px-3 py-2 text-sm font-semibold flex items-center justify-between">
                    <span>{isLoading ? '  SENDING EMAILS...' : '✅ SENDING COMPLETE'}</span>
                    <span className="text-xs bg-black/20 px-2 py-1 rounded">
                      {emailLogs.filter(log => log.status === 'success').length} / {emailLogs.length} sent
                    </span>
                  </div>
                  <div className="bg-[#1d1d21] p-3">
                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Progress</span>
                        <span className="text-xs text-[#a1a1aa]">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    <div className="text-sm text-[#a1a1aa] mb-3 p-2 bg-[#0f0f12] rounded border border-[#26262b]">
                      {progressDetails || 'Preparing to send...'}
                    </div>

                    {/* Copy Failed & Unsent Emails Button */}
                    {(failedEmails.length > 0 || unsentEmails.length > 0) && !isLoading && (
                      <div className="mb-3">
                        <Button
                          onClick={copyFailedAndUnsentEmails}
                          variant="outline"
                          size="sm"
                          className="w-full border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                          data-testid="button-copy-failed-emails"
                        >
                          📋 Copy {unsentEmails.length > 0 ? 'Failed & Unsent' : 'Failed'} Emails ({failedEmails.length + unsentEmails.length})
                        </Button>
                      </div>
                    )}

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
                                    {log.smtp && (
                                      <div className="text-blue-400 text-[10px] mt-1">
                                        SMTP: {log.smtp.fromEmail} ({log.smtp.id} - {log.smtp.host})
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
              <div className="mt-2">
                <div className="text-[#ef4444] font-mono text-xs text-center mb-2 opacity-60">
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
                  <Button
                    variant="outline"
                    onClick={() => setTemplateRotation(!templateRotation)}
                    className={`min-w-[110px] border-[#ef4444] ${templateRotation ? 'bg-[#ef4444] text-white' : 'text-[#ef4444]'} hover:bg-[#ef4444] hover:text-white`}
                    data-testid="button-template-rotation"
                  >
                    {templateRotation ? '🔄 ROTATE ON' : '🔄 ROTATE OFF'}
                  </Button>
                </div>

              </div>


            {/* SMTP Settings */}
            <div className="mt-1 p-1">
              <div className="flex items-center justify-between">
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

              {/* SMTP Management - Dropdown Design */}
              <details className="mt-4 bg-gradient-to-br from-[#1a1a1f] to-[#131316] rounded-xl border border-[#2a2a35] shadow-lg shadow-black/20 group overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 transition-all duration-200">
                  <h3 className="text-sm font-semibold bg-gradient-to-r from-[#ef4444] to-[#f97316] bg-clip-text text-transparent flex items-center gap-2">
                    ⚙️ SMTP Management
                    {smtpData.currentSmtp && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></span>}
                    {smtpData.smtpConfigs?.length > 0 && <span className="text-xs text-[#a1a1aa] bg-[#26262b] px-2 py-0.5 rounded-full">({smtpData.smtpConfigs?.length || 0})</span>}
                  </h3>
                  <span className="text-[#ef4444] text-xs group-open:rotate-180 transition-transform duration-300 bg-[#ef4444]/10 w-6 h-6 rounded-full flex items-center justify-center">▼</span>
                </summary>
                <div className="p-4 space-y-4 border-t border-[#2a2a35]/50 bg-gradient-to-b from-transparent to-black/10">
                  {/* Current SMTP Display */}
                  {smtpData.currentSmtp && (
                    <div className="p-2 bg-[#0f0f12] rounded border border-[#26262b]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[#a1a1aa]">Current:</span>
                        <span className="text-green-400 text-xs font-medium">{smtpData.currentSmtp.fromEmail}</span>
                        <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px]">{smtpData.currentSmtp.id}</span>
                      </div>
                      <p className="text-[#75798b] text-[10px]">
                        {smtpData.currentSmtp.host}:{smtpData.currentSmtp.port}
                      </p>
                    </div>
                  )}

                  {/* Add New SMTP Form */}
                  <div className="p-3 bg-[#0f0f12] rounded border border-[#26262b]">
                    <h4 className="text-white font-medium mb-2 text-xs">Add New SMTP</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Input
                        placeholder="Host"
                        value={newSmtp.host}
                        onChange={(e) => setNewSmtp({...newSmtp, host: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white h-7 text-xs"
                      />
                      <Input
                        placeholder="Port"
                        value={newSmtp.port}
                        onChange={(e) => setNewSmtp({...newSmtp, port: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white h-7 text-xs"
                      />
                      <Input
                        placeholder="Username"
                        value={newSmtp.user}
                        onChange={(e) => setNewSmtp({...newSmtp, user: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white h-7 text-xs"
                      />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={newSmtp.pass}
                        onChange={(e) => setNewSmtp({...newSmtp, pass: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white h-7 text-xs"
                      />
                      <Input
                        placeholder="From Email"
                        value={newSmtp.fromEmail}
                        onChange={(e) => setNewSmtp({...newSmtp, fromEmail: e.target.value})}
                        className="bg-[#0f0f12] border-[#26262b] text-white h-7 text-xs col-span-2"
                      />
                    </div>
                    <Button
                      onClick={addNewSmtp}
                      className="bg-[#ef4444] text-white hover:bg-[#dc3636] h-7 px-3 text-xs w-full"
                    >
                      Add Server
                    </Button>
                  </div>

                  {/* SMTP List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-medium text-xs">Servers ({smtpData.smtpConfigs?.length || 0})</h4>
                      <Button
                        onClick={testAllSmtpServers}
                        disabled={!smtpData.smtpConfigs?.length}
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 h-6 px-2 text-[10px]"
                      >
                        Test All
                      </Button>
                    </div>
                    {smtpData.smtpConfigs?.map((smtp) => {
                      const status = smtpStatus[smtp.id];
                      return (
                        <div
                          key={smtp.id}
                          className={`flex items-center justify-between p-2 border rounded ${
                            smtpData.currentSmtp?.id === smtp.id
                              ? 'border-blue-500 bg-blue-900/20'
                              : 'border-[#26262b] bg-[#0f0f12]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                status === 'online' ? 'bg-green-500' :
                                status === 'offline' ? 'bg-red-500' :
                                status === 'testing' ? 'bg-yellow-500 animate-pulse' :
                                'bg-gray-500'
                              }`}
                              title={
                                status === 'online' ? 'Online' :
                                status === 'offline' ? 'Offline' :
                                status === 'testing' ? 'Testing...' :
                                'Not tested'
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="px-1.5 py-0.5 bg-gray-600 text-white rounded text-[10px]">{smtp.id}</span>
                                <span className="text-white font-medium text-xs truncate">{smtp.fromEmail}</span>
                                {smtpData.currentSmtp?.id === smtp.id && (
                                  <span className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px]">Active</span>
                                )}
                              </div>
                              <p className="text-[#75798b] text-[10px] truncate">
                                {smtp.host}:{smtp.port}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => testIndividualSmtp(smtp.id)}
                              disabled={status === 'testing'}
                              variant="ghost"
                              size="sm"
                              className="text-blue-400 hover:text-blue-300 h-6 w-6 p-0"
                              title="Test connection"
                            >
                              🔄
                            </Button>
                            <Button
                              onClick={() => deleteSmtp(smtp.id)}
                              disabled={smtpData.smtpConfigs?.length <= 1}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>
                      );
                    }) || <p className="text-[#75798b] text-center py-2 text-xs">No servers configured</p>}
                  </div>
                </div>
              </details>


              
              {/* HTML Convert Settings - Dropdown Design */}
              <details className="mt-4 bg-gradient-to-br from-[#1a1a1f] to-[#131316] rounded-xl border border-[#2a2a35] shadow-lg shadow-black/20 group overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 transition-all duration-200">
                  <h3 className="text-sm font-semibold bg-gradient-to-r from-[#ef4444] to-[#f97316] bg-clip-text text-transparent flex items-center gap-2">
                    🔄 HTML Convert
                    {(advancedSettings.zipUse || advancedSettings.htmlImgBody || advancedSettings.qrcode || advancedSettings.randomMetadata || advancedSettings.calendarMode || advancedSettings.htmlConvert) &&
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></span>
                    }
                  </h3>
                  <span className="text-[#ef4444] text-xs group-open:rotate-180 transition-transform duration-300 bg-[#ef4444]/10 w-6 h-6 rounded-full flex items-center justify-center">▼</span>
                </summary>
                <div className="p-4 space-y-4 border-t border-[#2a2a35]/50 bg-gradient-to-b from-transparent to-black/10">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => setAdvancedSettings({...advancedSettings, zipUse: !advancedSettings.zipUse})}
                      className={`${advancedSettings.zipUse ? 'bg-green-600 hover:bg-green-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                    >
                      ZIP
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
                    <Button
                      type="button"
                      onClick={() => setAdvancedSettings({...advancedSettings, qrcode: !advancedSettings.qrcode})}
                      className={`${advancedSettings.qrcode ? 'bg-red-600 hover:bg-red-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                    >
                      QRCODE
                      {advancedSettings.qrcode && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setAdvancedSettings({...advancedSettings, randomMetadata: !advancedSettings.randomMetadata})}
                      className={`${advancedSettings.randomMetadata ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                    >
                      🍬 Metadata
                      {advancedSettings.randomMetadata && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setAdvancedSettings({...advancedSettings, calendarMode: !advancedSettings.calendarMode})}
                      className={`${advancedSettings.calendarMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#26262b] hover:bg-[#333338]'} text-white text-xs px-3 py-2 rounded-md transition-colors`}
                    >
                      CALENDAR
                      {advancedSettings.calendarMode && <span className="ml-1 text-xs">✓</span>}
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
                  <div>
                    <Label className="text-xs text-[#a1a1aa] mb-1 block">ZIP Password (Optional)</Label>
                    <Input
                      type="password"
                      value={advancedSettings.zipPassword}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, zipPassword: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-sm"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </details>

              {/* AI Content Generation - Compact Dropdown Design */}
              <details className="mt-4 bg-gradient-to-br from-[#1a1a1f] to-[#131316] rounded-xl border border-[#2a2a35] shadow-lg shadow-black/20 group overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 transition-all duration-200">
                  <h3 className="text-sm font-semibold bg-gradient-to-r from-[#ef4444] to-[#f97316] bg-clip-text text-transparent flex items-center gap-2">
                    🤖 AI GEMINI Google
                    {aiStatus.initialized && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></span>}
                  </h3>
                  <span className="text-[#ef4444] text-xs group-open:rotate-180 transition-transform duration-300 bg-[#ef4444]/10 w-6 h-6 rounded-full flex items-center justify-center">▼</span>
                </summary>
                <div className="p-4 space-y-4 border-t border-[#2a2a35]/50 bg-gradient-to-b from-transparent to-black/10">
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder="API Key..."
                      className="bg-[#0f0f12] border-[#26262b] text-white flex-1 h-8 text-xs"
                    />
                    <Button
                      onClick={initializeAI}
                      size="sm"
                      className={`${aiStatus.initialized ? 'bg-green-600 hover:bg-green-700' : 'bg-[#ef4444] hover:bg-[#dc2626]'} text-white h-8 px-3 text-xs`}
                    >
                      {aiStatus.initialized ? 'OFF' : 'ON'}
                    </Button>
                  </div>

                  {aiStatus.initialized && (
                    <>
                      <div className="flex items-center justify-between p-2 bg-[#0f0f12] rounded">
                        <Label className="text-xs text-white">Enable AI</Label>
                        <input
                          type="checkbox"
                          checked={aiEnabled}
                          onChange={(e) => {
                            const isEnabled = e.target.checked;
                            setAiEnabled(isEnabled);
                            if (!isEnabled) {
                              setUseAISubject(false);
                              setUseAISenderName(false);
                            }
                          }}
                          className="w-8 h-4 appearance-none bg-[#26262b] rounded-full relative cursor-pointer transition-colors checked:bg-green-600 before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-4"
                        />
                      </div>

                      {aiEnabled && (
                        <div className="space-y-1.5 pl-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={useAISubject}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) setUseAISenderName(false);
                                setUseAISubject(!!checked);
                              }}
                              data-testid="checkbox-ai-subject"
                              className="h-3 w-3"
                            />
                            <Label className="text-xs text-[#a1a1aa]">AI Subject</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={useAISenderName}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) setUseAISubject(false);
                                setUseAISenderName(!!checked);
                              }}
                              data-testid="checkbox-ai-sendername"
                              className="h-3 w-3"
                            />
                            <Label className="text-xs text-[#a1a1aa]">AI Sender</Label>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </details>
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
                                                  ########################################
                                                  #░█▀▀░█░░░█▀▀░░░█▀▀░█▀█░█▀█░█▀▀░▀█▀░█▀▀#
                                                  #░█░░░█░░░▀▀█░░░█░░░█░█░█░█░█▀▀░░█░░█░█#
                                                  #░▀▀▀░▀▀▀░▀▀▀░░░▀▀▀░▀▀▀░▀░▀░▀░░░▀▀▀░▀▀▀#
                                                  ######################################## `}
              </div>

              </div>
              <div className="text-[#ef4444] font-mono text-xs leading-none text-left mb-1 whitespace-pre overflow-hidden">
              {`
                                                            | _______________ |
                                                            | |XXXXXXXXXXXXX| |
                                                            | |XXXXXXXXXXXXX| |
                                                            | |XXXXXXXXXXXXX| |
                                                            |_________________|
                                                            ___[___________]___
                                                            |         [_____] []|
                                                            |###GET#CONNECTED###|
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
                      <Label className="text-sm text-[red]">QR MIDDLE-IMG SIZE (px)</Label>
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
                    <Label className="text-sm text-[red]">QR MIDDLE TEXT </Label>
                    <Input
                      value={advancedSettings.hiddenText}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, hiddenText: e.target.value})}
                      className="bg-[#0f0f12] border-[#26262b] text-white"
                      placeholder="Optional"
                    />
                  </div>
                </div>


                <div>
                  <Label className="text-sm text-[red]">QRLINK </Label>
                  <Input
                    value={advancedSettings.qrLink}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, qrLink: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="https://example.com?user={email}"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[red]">LINK: USE {"{link}"} placeholder </Label>
                  <Input
                    value={advancedSettings.linkPlaceholder}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, linkPlaceholder: e.target.value})}
                    className="bg-[#0f0f12] border-[#26262b] text-white"
                    placeholder="{email}"
                  />
                </div>



                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <Label className="text-sm text-[red]">FILE NAME</Label>
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
                  <h3 className="text-lg font-medium text-red mb-3">DOMAIN-LOGO </h3>
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
                    <Label className="text-sm text-[red]">RETRY </Label>
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