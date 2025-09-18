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
        password: formData.smtpPassword,
        senderName: formData.senderName,
        replyTo: formData.replyTo
      };

      // Use the Replit API service to send emails
      return await replitApiService.sendEmails({
        recipients: data.recipients,
        subject: data.subject,
        htmlContent: data.htmlContent,
        attachments: data.attachments,
        settings: data.settings,
        smtpConfig
      });
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
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

  // Poll job status
  const { data: jobStatus } = useQuery<JobStatus>({
    queryKey: ['replitJobStatus', currentJobId],
    queryFn: async () => {
      if (!currentJobId) return null;
      return await replitApiService.getJobStatus(currentJobId);
    },
    enabled: !!currentJobId,
    refetchInterval: 1000, // Poll every second
  });

  // Update progress when job status changes
  useEffect(() => {
    if (jobStatus) {
      const { sent, failed, total, status, logs: jobLogs } = jobStatus;
      const percentage = total > 0 ? Math.round((sent + failed) / total * 100) : 0;

      setProgress({ total, sent, failed, percentage });

      // Add new logs
      if (jobLogs && jobLogs.length > logs.length) {
        const newLogs = jobLogs.slice(logs.length);
        newLogs.forEach((log: any) => {
          addLog(log.message, log.status);
        });
      }

      // Check if job is complete
      if (status === 'completed' || status === 'failed') {
        setCurrentJobId(null);
        queryClient.invalidateQueries({ queryKey: ['/api/emails/status'] });
      }
    }
  }, [jobStatus, logs.length, addLog, queryClient]);

  const startSending = useCallback(async (data: EmailSendRequest) => {
    setLogs([]); // Clear previous logs
    setProgress({ total: 0, sent: 0, failed: 0, percentage: 0 });
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