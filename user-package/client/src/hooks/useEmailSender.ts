
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface EmailFormData {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderName: string;
  replyTo: string;
  subject: string;
  htmlContent: string;
  recipients: string;
  settings: {
    emailsPerSecond: number;
    sleepBetween: number;
    retryAttempts: number;
    minifyHtml: boolean;
    includeHtmlAttachment: boolean;
    htmlToBodyOnly: boolean;
    qrCode: {
      enabled: boolean;
      link: string;
      width: number;
    };
  };
}

interface EmailSendRequest {
  recipients: string[];
  subject: string;
  htmlContent: string;
  attachments: File[];
  settings: EmailFormData['settings'];
}

interface Progress {
  total: number;
  sent: number;
  failed: number;
  percentage: number;
}

interface LogEntry {
  timestamp: string;
  message: string;
  status: 'success' | 'error';
}

const defaultFormData: EmailFormData = {
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  senderName: "",
  replyTo: "",
  subject: "",
  htmlContent: "",
  recipients: "",
  settings: {
    emailsPerSecond: 5,
    sleepBetween: 3,
    retryAttempts: 3,
    minifyHtml: true,
    includeHtmlAttachment: false,
    htmlToBodyOnly: false,
    qrCode: {
      enabled: false,
      link: "",
      width: 200,
    },
  },
};

export function useEmailSender() {
  const [formData, setFormData] = useState<EmailFormData>(defaultFormData);
  const [progress, setProgress] = useState<Progress>({ total: 0, sent: 0, failed: 0, percentage: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addLog = useCallback((message: string, status: 'success' | 'error' = 'success') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, status }]);
  }, []);

  const updateFormData = useCallback((updates: Partial<EmailFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const startSending = useCallback(async (data: EmailSendRequest) => {
    setLogs([]); // Clear previous logs
    setProgress({ total: 0, sent: 0, failed: 0, percentage: 0 });
    setIsLoading(true);
    
    try {
      const formDataToSend = new FormData();
      
      // Use the same format as your working backend
      formDataToSend.append('recipients', JSON.stringify(data.recipients));
      formDataToSend.append('subject', data.subject);
      formDataToSend.append('html', data.htmlContent);
      formDataToSend.append('senderEmail', formData.smtpUser || '');
      formDataToSend.append('senderName', formData.senderName || '');
      
      // Add SMTP settings from formData
      formDataToSend.append('smtpHost', formData.smtpHost || '');
      formDataToSend.append('smtpPort', formData.smtpPort.toString() || '587');
      formDataToSend.append('smtpUser', formData.smtpUser || '');
      formDataToSend.append('smtpPass', formData.smtpPassword || '');
      
      // Add settings
      formDataToSend.append('emailPerSecond', data.settings.emailsPerSecond.toString());
      formDataToSend.append('sleep', data.settings.sleepBetween.toString());
      formDataToSend.append('retry', data.settings.retryAttempts.toString());
      formDataToSend.append('minifyHtml', data.settings.minifyHtml.toString());
      
      // Append files
      data.attachments.forEach((file, index) => {
        formDataToSend.append('attachments', file);
      });

      // Use relative path for API endpoint
      const response = await fetch('/api/original/sendMail', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error(`Failed to start email sending: ${response.status} ${response.statusText}`);
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
                const eventData = JSON.parse(line.slice(6));

                if (eventData.type === 'progress') {
                  const { totalSent, totalFailed, totalRecipients, recipient, status, error } = eventData;
                  const sent = totalSent || 0;
                  const failed = totalFailed || 0;
                  const percentage = totalRecipients > 0 ? Math.round((sent + failed) / totalRecipients * 100) : 0;
                  
                  setProgress({ total: totalRecipients, sent, failed, percentage });
                  
                  const logMessage = status === 'success' 
                    ? `✓ Successfully sent to ${recipient}`
                    : `✗ Failed to send to ${recipient}: ${error}`;
                    
                  addLog(logMessage, status === 'success' ? 'success' : 'error');
                  
                } else if (eventData.type === 'complete') {
                  setIsLoading(false);
                  addLog(`Email sending completed. Sent: ${eventData.sent} emails`);
                  toast({
                    title: "Email sending completed",
                    description: `Sent ${eventData.sent} emails`,
                  });
                } else if (eventData.type === 'error') {
                  setIsLoading(false);
                  addLog(`Error: ${eventData.error}`, 'error');
                  toast({
                    title: "Error",
                    description: eventData.error,
                    variant: "destructive",
                  });
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
      
      toast({
        title: "Email sending started",
        description: `Sending ${data.recipients.length} emails`,
      });
      
    } catch (error: any) {
      setIsLoading(false);
      const errorMessage = error.message || 'Network error occurred';
      addLog(`Error: ${errorMessage}`, 'error');
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error('Send error:', error);
    }
  }, [formData, addLog, toast]);

  const statusText = isLoading ? 'Sending Emails...' : progress.sent > 0 ? 'Sending Complete' : 'Ready to Send';

  return {
    formData,
    updateFormData,
    startSending,
    isLoading,
    progress,
    logs,
    statusText,
  };
}
