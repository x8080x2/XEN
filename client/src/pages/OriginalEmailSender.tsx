
import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [recipients, setRecipients] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [templateFiles, setTemplateFiles] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const [smtpSettings, setSMTPSettings] = useState<SMTPSettings>({
    host: "",
    port: "587",
    user: "",
    pass: "",
    fromEmail: "",
    fromName: ""
  });

  const [advancedSettings, setAdvancedSettings] = useState(() => {
    const saved = localStorage.getItem('emailAdvancedSettings');
    return saved ? JSON.parse(saved) : {
      emailPerSecond: '5',
      sleep: '3',
      priority: 'normal',
      retry: '0',
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [progressDetails, setProgressDetails] = useState("");
  const [emailLogs, setEmailLogs] = useState<EmailProgress[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const lines = recipients.split('\n').filter(line => line.trim() && line.includes('@'));
    setRecipientCount(lines.length);
  }, [recipients]);

  useEffect(() => {
    loadTemplates();
    loadConfigFromFiles();
  }, []);

  useEffect(() => {
    if (logContainerRef.current && emailLogs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [emailLogs.length]);

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
            console.log('[Config Load] Auto-set sender email:', smtpConfig.fromEmail);
          }
          if (smtpConfig.fromName) {
            setSenderName(smtpConfig.fromName);
            console.log('[Config Load] Auto-set sender name:', smtpConfig.fromName);
          }
        }

        try {
          const leadsResponse = await fetch('/api/config/loadLeads');
          const leadsData = await leadsResponse.json();
          if (leadsData.success && leadsData.leads && leadsData.leads.trim().length > 0) {
            setRecipients(leadsData.leads);
            const leadCount = leadsData.leads.split('\n').filter(Boolean).length;
            console.log(`[Config Load] Auto-loaded ${leadCount} leads from leads.txt`);
          }
        } catch (leadsError) {
          console.log('[Config Load] Failed to load leads:', leadsError);
        }

        if (config.LETTER_CONTENT) {
          setEmailContent(config.LETTER_CONTENT);
          console.log('[Config Load] Auto-loaded letter content from config');
        }

        if (config.SUBJECT) {
          setSubject(config.SUBJECT);
          console.log('[Config Load] Auto-loaded subject from config');
        }

        setStatusText('Configuration loaded automatically');
        setTimeout(() => setStatusText("Ready"), 2000);
        setConfigLoaded(true);
      }
    } catch (error) {
      console.error('Config load error:', error);
      setStatusText('Failed to load configuration');
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };

  const handleTemplateChange = async (template: string) => {
    setSelectedTemplate(template);

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
        }
      } catch (error) {
        setStatusText(`Error loading template: ${error}`);
      }
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
    }

    if (!bodyHtml) {
      setStatusText('Email content cannot be empty.');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setStatusText("Sending emails...");
    setEmailLogs([]);
    setProgressDetails("");

    try {
      const formData = new FormData();

      formData.append('senderEmail', senderEmail);
      formData.append('senderName', senderName);
      formData.append('subject', subject);
      formData.append('html', bodyHtml);
      formData.append('recipients', JSON.stringify(recipients.split('\n').filter(r => r.trim())));

      formData.append('smtpHost', smtpSettings.host);
      formData.append('smtpPort', smtpSettings.port);
      formData.append('smtpUser', smtpSettings.user);
      formData.append('smtpPass', smtpSettings.pass);

      Object.entries(advancedSettings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('attachments', selectedFiles[i]);
        }
      }

      const response = await fetch('/api/original/sendMail', {
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

          buffer += decoder.decode(value);
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  const progressData: EmailProgress = data;
                  
                  flushSync(() => {
                    setEmailLogs(prev => [...prev, progressData]);

                    if (progressData.totalRecipients) {
                      const currentProgress = ((progressData.totalSent || 0) + (progressData.totalFailed || 0)) / progressData.totalRecipients * 100;
                      setProgress(currentProgress);
                      setProgressDetails(`Sent: ${progressData.totalSent || 0}, Failed: ${progressData.totalFailed || 0}, Total: ${progressData.totalRecipients}`);
                    }

                    if (data.status === 'success') {
                      setStatusText(`✓ Sent to ${data.recipient}`);
                    } else {
                      setStatusText(`✗ Failed: ${data.recipient}`);
                    }
                  });
                  
                } else if (data.type === 'complete') {
                  setIsLoading(false);
                  setProgress(100);
                  setStatusText(`Complete. Sent: ${data.sent} emails`);
                } else if (data.type === 'error') {
                  setIsLoading(false);
                  setStatusText(`Error: ${data.error}`);
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
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSending = async () => {
    try {
      await fetch('/api/original/pause', { method: 'POST' });
      setIsLoading(false);
      setStatusText("Cancelled");
    } catch (error) {
      console.error('Failed to cancel sending:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7] font-mono">
      <div className="flex justify-end items-center h-8 bg-[#131316] border-b border-[#26262b] px-4">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444] hover:bg-[#dc2626] cursor-pointer"></div>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Compact Header */}
        <div className="text-center mb-4">
          <div className="text-[#ef4444] font-mono text-sm font-bold">
            ██████╗██╗     ███████╗
          </div>
          <div className="text-[#ef4444] font-mono text-sm font-bold">
            ██╔════╝██║     ██╔════╝
          </div>
          <div className="text-[#ef4444] font-mono text-sm font-bold">
            ██║     ██║     ███████╗
          </div>
          <div className="text-[#ef4444] font-mono text-sm font-bold">
            ██║     ██║     ╚════██║
          </div>
          <div className="text-[#ef4444] font-mono text-sm font-bold">
            ╚██████╗███████╗███████║
          </div>
          <div className="text-[#ef4444] font-mono text-sm font-bold">
             ╚═════╝╚══════╝╚══════╝
          </div>
          <div className="text-[#a1a1aa] text-xs mt-2">EMAIL SENDER</div>
        </div>
        
        <div className="bg-[#131316] rounded-lg border border-[#26262b] p-4">
          {/* Main Form - Compact Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label className="text-xs text-[#a1a1aa]">Sender Email</Label>
              <Input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-sm"
                placeholder="sender@example.com"
              />
            </div>
            <div>
              <Label className="text-xs text-[#a1a1aa]">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-[#0f0f12] border-[#26262b] text-white h-8 text-sm"
                placeholder="Subject"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label className="text-xs text-[#a1a1aa]">Letter</Label>
              <Textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                className="bg-[#0f0f12] border-[#26262b] text-white h-24 text-sm"
                placeholder="Email content..."
              />
              <Select value={selectedTemplate || "off"} onValueChange={handleTemplateChange}>
                <SelectTrigger className="bg-[#0f0f12] border-[#26262b] text-white h-7 text-xs mt-1">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent className="bg-[#131316] border-[#26262b]">
                  <SelectItem value="off" className="text-white">-- Off --</SelectItem>
                  {templateFiles.map(file => (
                    <SelectItem key={file} value={file} className="text-white">{file}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#a1a1aa]">Recipients ({recipientCount})</Label>
              <Textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                className="bg-[#0f0f12] border-[#26262b] text-white h-24 text-sm"
                placeholder="email@example.com"
              />
              <Button
                variant="outline"
                onClick={handleFileSelect}
                size="sm"
                className="w-full mt-1 h-7 text-xs bg-[#ef4444] hover:bg-[#dc2626] border-[#ef4444] text-white"
              >
                📎 Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFiles && selectedFiles.length > 0 && (
                <div className="text-xs text-green-400 mt-1">
                  {selectedFiles.length} file(s) selected
                </div>
              )}
            </div>
          </div>

          {/* Progress Section */}
          {(isLoading || emailLogs.length > 0) && (
            <div className="mb-4 border border-[#ef4444] rounded-lg overflow-hidden">
              <div className="bg-[#ef4444] text-white px-3 py-2 text-sm font-semibold">
                {isLoading ? 'SENDING...' : 'COMPLETE'}
              </div>
              <div className="bg-[#1d1d21] p-3">
                <Progress value={progress} className="h-2 mb-2" />
                <div className="text-xs text-[#a1a1aa] mb-2">
                  {progressDetails || 'Preparing...'}
                </div>
                <div ref={logContainerRef} className="max-h-32 overflow-y-auto bg-[#0f0f12] border border-[#26262b] rounded p-2">
                  {emailLogs.slice(-10).reverse().map((log, index) => (
                    <div
                      key={index}
                      className={`text-xs py-1 ${
                        log.status === 'success' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {log.status === 'success' ? '✓' : '✗'} {log.recipient}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-3 mb-4">
            <Button
              onClick={handleSendEmails}
              disabled={isLoading}
              className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
            >
              {isLoading ? 'SENDING...' : '🚀 SEND'}
            </Button>
            <Button
              variant="outline"
              onClick={cancelSending}
              disabled={!isLoading}
              className="border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
            >
              ⛔ CANCEL
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className="border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white"
            >
              ⚙️ SMTP
            </Button>
          </div>

          {/* SMTP Settings */}
          {showSettings && (
            <div className="bg-[#0a0a0b] rounded-lg p-3 border border-[#26262b]">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Input
                  placeholder="Host"
                  value={smtpSettings.host}
                  onChange={(e) => setSMTPSettings({...smtpSettings, host: e.target.value})}
                  className="h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  placeholder="Port"
                  value={smtpSettings.port}
                  onChange={(e) => setSMTPSettings({...smtpSettings, port: e.target.value})}
                  className="h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  placeholder="User"
                  value={smtpSettings.user}
                  onChange={(e) => setSMTPSettings({...smtpSettings, user: e.target.value})}
                  className="h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Input
                  type="password"
                  placeholder="Password"
                  value={smtpSettings.pass}
                  onChange={(e) => setSMTPSettings({...smtpSettings, pass: e.target.value})}
                  className="h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Input
                  placeholder="From Email"
                  value={smtpSettings.fromEmail}
                  onChange={(e) => setSMTPSettings({...smtpSettings, fromEmail: e.target.value})}
                  className="h-8 bg-[#0f0f12] border-[#26262b] text-white text-xs"
                />
                <Button
                  onClick={saveSMTPSettings}
                  className="h-8 bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs"
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="text-center text-xs text-[#a1a1aa] border-t border-[#26262b] pt-2">
            {statusText || "Ready"}
          </div>
        </div>
      </div>
    </div>
  );
}
