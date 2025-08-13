import nodemailer from "nodemailer";
import { storage, type IStorage } from "../storage";
import { PlaceholderService } from "./placeholderService";
import { FileService } from "./fileService";
import type { EmailJob, EmailConfig } from "@shared/schema";

export class EmailService {
  private placeholderService: PlaceholderService;
  private fileService: FileService;

  constructor(private storage: IStorage) {
    this.placeholderService = new PlaceholderService();
    this.fileService = new FileService();
  }

  async processEmailJob(jobId: string): Promise<void> {
    try {
      const job = await this.storage.getEmailJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      await this.storage.updateEmailJob(jobId, { status: "processing" });

      // Get email configuration (for now using default SMTP settings)
      const smtpConfig = {
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASS || "",
        },
      };

      const transporter = nodemailer.createTransporter(smtpConfig);

      // Verify SMTP connection
      await transporter.verify();

      const settings = job.settings || {};
      const emailsPerSecond = settings.emailsPerSecond || 5;
      const sleepBetween = settings.sleepBetween || 3;
      const retryAttempts = settings.retryAttempts || 3;

      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of job.recipients as string[]) {
        try {
          // Process HTML content with placeholders
          const processedHtml = await this.placeholderService.processPlaceholders(
            job.htmlContent,
            recipient,
            settings
          );

          // Process subject with placeholders
          const processedSubject = await this.placeholderService.processPlaceholders(
            job.subject,
            recipient,
            settings
          );

          // Prepare email options
          const mailOptions = {
            from: process.env.SMTP_USER || smtpConfig.auth.user,
            to: recipient,
            subject: processedSubject,
            html: processedHtml,
            attachments: await this.prepareAttachments(job),
          };

          // Send email with retries
          let attempt = 0;
          let sent = false;
          let lastError = null;

          while (attempt < retryAttempts && !sent) {
            try {
              await transporter.sendMail(mailOptions);
              sent = true;
              sentCount++;

              // Log success
              await this.storage.createEmailLog({
                jobId: job.id,
                recipient,
                status: "sent",
              });
            } catch (error) {
              lastError = error;
              attempt++;
              
              if (attempt < retryAttempts) {
                // Wait before retry
                await this.sleep(1000 * attempt);
              }
            }
          }

          if (!sent) {
            failedCount++;
            await this.storage.createEmailLog({
              jobId: job.id,
              recipient,
              status: "failed",
              error: lastError instanceof Error ? lastError.message : "Unknown error",
            });
          }

          // Update job progress
          await this.storage.updateEmailJob(jobId, {
            sentCount,
            failedCount,
          });

          // Rate limiting
          if (sentCount % emailsPerSecond === 0) {
            await this.sleep(sleepBetween * 1000);
          } else {
            await this.sleep(1000 / emailsPerSecond);
          }

        } catch (error) {
          failedCount++;
          await this.storage.createEmailLog({
            jobId: job.id,
            recipient,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          
          await this.storage.updateEmailJob(jobId, {
            sentCount,
            failedCount,
          });
        }
      }

      // Mark job as completed
      await this.storage.updateEmailJob(jobId, {
        status: "completed",
        sentCount,
        failedCount,
      });

    } catch (error) {
      console.error(`Error processing email job ${jobId}:`, error);
      await this.storage.updateEmailJob(jobId, {
        status: "failed",
      });
    }
  }

  private async prepareAttachments(job: EmailJob): Promise<any[]> {
    const attachments = [];
    
    if (job.attachments) {
      for (const attachment of job.attachments as any[]) {
        try {
          const processedAttachment = await this.fileService.processAttachment(attachment);
          attachments.push(processedAttachment);
        } catch (error) {
          console.error("Error processing attachment:", error);
        }
      }
    }

    return attachments;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
