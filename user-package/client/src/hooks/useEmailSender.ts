import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  sent: number;
  failed: number;
  logs: Array<{
    recipient: string;
    status: 'success' | 'failed';
    message: string;
    timestamp: string;
  }>;
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
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addLog = useCallback((message: string, status: 'success' | 'error' = 'success') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, status }]);
  }, []);

  const updateFormData = useCallback((updates: Partial<EmailFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Send emails mutation
  const sendEmailsMutation = useMutation({
    mutationFn: async (data: EmailSendRequest) => {
      const formData = new FormData();
      
      // Use the same format as OriginalEmailSender
      formData.append('recipients', JSON.stringify(data.recipients));
      formData.append('subject', data.subject);
      formData.append('html', data.htmlContent);
      formData.append('senderEmail', formData.senderEmail || '');
      formData.append('senderName', formData.senderName || '');
      
      // Add SMTP settings from form data
      formData.append('smtpHost', formData.smtpHost || '');
      formData.append('smtpPort', formData.smtpPort || '587');
      formData.append('smtpUser', formData.smtpUser || '');
      formData.append('smtpPass', formData.smtpPassword || '');
      
      // Add settings
      Object.entries(data.settings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      
      // Append files
      data.attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });

      const response = await fetch('/api/original/sendMail', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to send emails');
      }

      // Handle Server-Sent Events response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        return { success: true, message: 'Email sending started' };
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Since we're using SSE, we don't get jobId back
      addLog(`Email sending initiated`);
      toast({
        title: "Email sending started",
        description: "Emails are being sent",
      });
    },
    onError: (error: Error) => {
      addLog(`Error: ${error.message}`, 'error');
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle real-time progress updates via Server-Sent Events
  useEffect(() => {
    // This will be handled by the SSE implementation in startSending
  }, []);

  const startSending = useCallback(async (data: EmailSendRequest) => {
    setLogs([]); // Clear previous logs
    setProgress({ total: 0, sent: 0, failed: 0, percentage: 0 });
    
    try {
      const formData = new FormData();
      
      // Use the same format as OriginalEmailSender
      formData.append('recipients', JSON.stringify(data.recipients));
      formData.append('subject', data.subject);
      formData.append('html', data.htmlContent);
      formData.append('senderEmail', formData.senderEmail || '');
      formData.append('senderName', formData.senderName || '');
      
      // Add SMTP settings from formData
      formData.append('smtpHost', formData.smtpHost || '');
      formData.append('smtpPort', formData.smtpPort || '587');
      formData.append('smtpUser', formData.smtpUser || '');
      formData.append('smtpPass', formData.smtpPassword || '');
      
      // Add settings
      Object.entries(data.settings).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      
      // Append files
      data.attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });

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
                const eventData = JSON.parse(line.slice(6));

                if (eventData.type === 'progress') {
                  const { sent, failed, totalRecipients, recipient, status, error } = eventData;
                  const percentage = totalRecipients > 0 ? Math.round((sent + failed) / totalRecipients * 100) : 0;
                  
                  setProgress({ total: totalRecipients, sent, failed, percentage });
                  
                  const logMessage = status === 'success' 
                    ? `✓ Successfully sent to ${recipient}`
                    : `✗ Failed to send to ${recipient}: ${error}`;
                    
                  addLog(logMessage, status === 'success' ? 'success' : 'error');
                  
                } else if (eventData.type === 'complete') {
                  addLog(`Email sending completed. Sent: ${eventData.sent} emails`);
                  toast({
                    title: "Email sending completed",
                    description: `Sent ${eventData.sent} emails`,
                  });
                } else if (eventData.type === 'error') {
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
      addLog(`Error: ${error.message}`, 'error');
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [formData, addLog, toast]);

  const statusText = sendEmailsMutation.isPending ? 'Sending Emails...' : progress.sent > 0 ? 'Sending Complete' : 'Ready to Send';

  return {
    formData,
    updateFormData,
    startSending,
    isLoading: sendEmailsMutation.isPending,
    progress,
    logs,
    statusText,
  };
}
