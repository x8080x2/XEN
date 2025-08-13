import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import FileUpload from "./FileUpload";
import { useEmailSender } from "@/hooks/useEmailSender";

export default function EmailForm() {
  const {
    formData,
    updateFormData,
    startSending,
    isLoading,
    statusText
  } = useEmailSender();

  const [htmlFiles, setHtmlFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const handleSend = async () => {
    const recipients = formData.recipients
      .split('\n')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (recipients.length === 0) {
      alert('Please add recipients');
      return;
    }

    if (!formData.subject.trim()) {
      alert('Please add a subject');
      return;
    }

    if (!formData.htmlContent.trim()) {
      alert('Please add email content');
      return;
    }

    await startSending({
      recipients,
      subject: formData.subject,
      htmlContent: formData.htmlContent,
      attachments: attachmentFiles,
      settings: formData.settings
    });
  };

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="bg-red-primary text-white px-3 py-1.5 rounded mb-3 font-semibold text-sm inline-block" data-testid="status-indicator">
        {statusText}
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        {/* SMTP Configuration Section */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">SMTP Server</Label>
            <Input 
              type="text" 
              className="dark-input" 
              placeholder="smtp.gmail.com"
              value={formData.smtpHost}
              onChange={(e) => updateFormData({ smtpHost: e.target.value })}
              data-testid="input-smtp-host"
            />
          </div>
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Port</Label>
            <Input 
              type="number" 
              className="dark-input" 
              placeholder="587"
              value={formData.smtpPort}
              onChange={(e) => updateFormData({ smtpPort: parseInt(e.target.value) || 587 })}
              data-testid="input-smtp-port"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Email Address</Label>
            <Input 
              type="email" 
              className="dark-input" 
              placeholder="your.email@gmail.com"
              value={formData.smtpUser}
              onChange={(e) => updateFormData({ smtpUser: e.target.value })}
              data-testid="input-smtp-email"
            />
          </div>
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Password</Label>
            <Input 
              type="password" 
              className="dark-input" 
              placeholder="App Password"
              value={formData.smtpPassword}
              onChange={(e) => updateFormData({ smtpPassword: e.target.value })}
              data-testid="input-smtp-password"
            />
          </div>
        </div>

        {/* Sender Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Sender Name</Label>
            <Input 
              type="text" 
              className="dark-input" 
              placeholder="John Doe"
              value={formData.senderName}
              onChange={(e) => updateFormData({ senderName: e.target.value })}
              data-testid="input-sender-name"
            />
          </div>
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Reply To</Label>
            <Input 
              type="email" 
              className="dark-input" 
              placeholder="noreply@example.com"
              value={formData.replyTo}
              onChange={(e) => updateFormData({ replyTo: e.target.value })}
              data-testid="input-reply-to"
            />
          </div>
        </div>

        {/* Email Content */}
        <div>
          <Label className="block text-xs font-semibold text-dark-text mb-1">Subject Line</Label>
          <Input 
            type="text" 
            className="dark-input" 
            placeholder="Hello {user}, Important Update from {randcompany}"
            value={formData.subject}
            onChange={(e) => updateFormData({ subject: e.target.value })}
            data-testid="input-subject"
          />
          <button 
            type="button"
            className="mt-1 text-xs text-red-primary hover:text-red-300 transition-colors"
            onClick={() => alert('Placeholders: {user}, {email}, {username}, {domain}, {randfirst}, {randlast}, {randcompany}, {date}, {time}, {hash6}, {randnum4}')}
            data-testid="button-show-placeholders"
          >
            ℹ️ View Available Placeholders
          </button>
        </div>

        {/* HTML Template */}
        <div>
          <Label className="block text-xs font-semibold text-dark-text mb-1">HTML Template</Label>
          <div className="mb-2">
            <FileUpload
              onFileSelect={setHtmlFiles}
              accept=".html"
              selectedFiles={htmlFiles}
              onRemoveFile={(index) => setHtmlFiles(files => files.filter((_, i) => i !== index))}
            >
              📎 Upload HTML
            </FileUpload>
          </div>
          <Textarea 
            className="dark-input h-24 resize-y font-mono"
            placeholder="<html><body>Hello {user}...</body></html>"
            value={formData.htmlContent}
            onChange={(e) => updateFormData({ htmlContent: e.target.value })}
            data-testid="textarea-html-content"
          />
        </div>

        {/* Recipients */}
        <div>
          <Label className="block text-xs font-semibold text-dark-text mb-1">Recipients (One per line)</Label>
          <Textarea 
            className="dark-input h-25 resize-y font-mono"
            placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
            value={formData.recipients}
            onChange={(e) => updateFormData({ recipients: e.target.value })}
            data-testid="textarea-recipients"
          />
        </div>

        {/* Attachments */}
        <div>
          <Label className="block text-xs font-semibold text-dark-text mb-1">Attachments</Label>
          <FileUpload
            onFileSelect={setAttachmentFiles}
            multiple
            selectedFiles={attachmentFiles}
            onRemoveFile={(index) => setAttachmentFiles(files => files.filter((_, i) => i !== index))}
          >
            📎 Add Attachment
          </FileUpload>
        </div>

        {/* Sending Options */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Emails Per Second</Label>
            <Input 
              type="number" 
              className="dark-input"
              min="1"
              max="50"
              value={formData.settings.emailsPerSecond}
              onChange={(e) => updateFormData({ 
                settings: { 
                  ...formData.settings, 
                  emailsPerSecond: parseInt(e.target.value) || 5 
                } 
              })}
              data-testid="input-emails-per-second"
            />
          </div>
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Sleep Between (sec)</Label>
            <Input 
              type="number" 
              className="dark-input"
              min="0"
              max="60"
              value={formData.settings.sleepBetween}
              onChange={(e) => updateFormData({ 
                settings: { 
                  ...formData.settings, 
                  sleepBetween: parseInt(e.target.value) || 3 
                } 
              })}
              data-testid="input-sleep-between"
            />
          </div>
          <div>
            <Label className="block text-xs font-semibold text-dark-text mb-1">Retry Attempts</Label>
            <Input 
              type="number" 
              className="dark-input"
              min="0"
              max="10"
              value={formData.settings.retryAttempts}
              onChange={(e) => updateFormData({ 
                settings: { 
                  ...formData.settings, 
                  retryAttempts: parseInt(e.target.value) || 3 
                } 
              })}
              data-testid="input-retry-attempts"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="btn-primary px-6 py-2.5 font-semibold text-sm"
            data-testid="button-start-sending"
          >
            ✈️ {isLoading ? 'Sending...' : 'Start Sending'}
          </Button>
          <Button 
            type="button"
            className="btn-secondary px-6 py-2.5 font-semibold text-sm"
            disabled={!isLoading}
            data-testid="button-pause"
          >
            ⏸️ Pause
          </Button>
          <Button 
            type="button"
            className="btn-secondary px-6 py-2.5 font-semibold text-sm"
            disabled={!isLoading}
            data-testid="button-stop"
          >
            ⏹️ Stop
          </Button>
        </div>
      </form>
    </div>
  );
}
