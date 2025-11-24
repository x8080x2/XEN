import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { replitApiService } from "@/services/replitApiService";

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
  const [logCursor, setLogCursor] = useState<number>(0); // Track which logs we've already processed
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
      // Extract SMTP configuration from form data
      const smtpConfig = {
        host: formData.smtpHost,
        port: formData.smtpPort,
        user: formData.smtpUser,
        pass: formData.smtpPassword,
        fromEmail: formData.smtpUser, // Use SMTP user as sender email
        fromName: formData.senderName,
        replyTo: formData.replyTo
      };

      // Use the Replit API service to send emails
      const result = await replitApiService.sendEmailsJob({
        recipients: data.recipients,
        subject: data.subject,
        htmlContent: data.htmlContent,
        attachments: data.attachments,
        settings: data.settings,
        smtpConfig
      });
      
      return {
        success: result.success,
        totalRecipients: data.recipients.length
      };
    },
    onSuccess: (data) => {
      // Start polling progress since there's no jobId
      setCurrentJobId('polling');
      setProgress({ total: data.totalRecipients, sent: 0, failed: 0, percentage: 0 });
      addLog(`Started sending ${data.totalRecipients} emails`);
      toast({
        title: "Email sending started",
        description: `Sending ${data.totalRecipients} emails`,
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

  // Poll progress status
  const { data: progressStatus } = useQuery<any>({
    queryKey: ['replitProgress', currentJobId, logCursor],
    queryFn: async () => {
      if (!currentJobId || currentJobId === 'complete') return null;
      // Use cursor to fetch only new logs
      return await replitApiService.checkJobStatus(logCursor);
    },
    enabled: !!currentJobId && currentJobId !== 'complete',
    refetchInterval: 1000, // Poll every second
  });

  // Update progress when status changes
  useEffect(() => {
    if (progressStatus && progressStatus.logs) {
      const { logs: progressLogs, sendingInProgress, total } = progressStatus;

      // Only process new logs (not duplicates)
      if (progressLogs.length > 0) {
        // Update cursor to reflect processed logs
        setLogCursor(prev => prev + progressLogs.length);
        
        // Track sent and failed counts from progress data
        let latestSent = progress.sent;
        let latestFailed = progress.failed;
        let latestTotal = progress.total || total || 0;
        
        // Process each new log
        progressLogs.forEach((logEntry: any) => {
          // Add log to display
          const message = logEntry.message || `${logEntry.recipient}: ${logEntry.status}`;
          const status = logEntry.status === 'failed' ? 'error' : 'success';
          addLog(message, status);
          
          // Update counters from progress data
          if (logEntry.totalSent !== undefined) latestSent = logEntry.totalSent;
          if (logEntry.totalFailed !== undefined) latestFailed = logEntry.totalFailed;
          if (logEntry.totalRecipients !== undefined) latestTotal = logEntry.totalRecipients;
        });
        
        // Update progress state
        const percentage = latestTotal > 0 ? Math.round((latestSent + latestFailed) / latestTotal * 100) : 0;
        setProgress({ total: latestTotal, sent: latestSent, failed: latestFailed, percentage });
      }

      // Check if sending is complete
      if (sendingInProgress === false && currentJobId === 'polling') {
        setCurrentJobId('complete');
        setLogCursor(0); // Reset for next send
        addLog('Email sending completed', 'success');
        toast({
          title: "Sending complete",
          description: `Sent ${latestSent}, Failed ${latestFailed}`,
        });
      }
    }
  }, [progressStatus, addLog, currentJobId, toast]);

  const startSending = useCallback(async (data: EmailSendRequest) => {
    setLogs([]); // Clear previous logs
    setProgress({ total: 0, sent: 0, failed: 0, percentage: 0 });
    setLogCursor(0); // Reset cursor
    setCurrentJobId(null); // Reset job ID
    await sendEmailsMutation.mutateAsync(data);
  }, [sendEmailsMutation]);

  const statusText = currentJobId ? 'Sending Emails...' : progress.sent > 0 ? 'Sending Complete' : 'Ready to Send';

  return {
    formData,
    updateFormData,
    startSending,
    isLoading: sendEmailsMutation.isPending || !!currentJobId,
    progress,
    logs,
    statusText,
  };
}
