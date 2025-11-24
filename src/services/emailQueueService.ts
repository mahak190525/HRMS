import { supabase } from './supabase';
import { emailService } from './emailService';

interface QueuedEmail {
  queue_id: string;
  leave_application_id: string;
  email_type: string;
  recipients: {
    employee: { email: string; name: string };
    adminsAndHR: Array<{ email: string; name: string }>;
    manager?: { email: string; name: string };
    managers?: Array<{ email: string; name: string }>;
  };
  leave_data: {
    employeeName: string;
    employeeEmail: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    daysDisplay?: string;
    isHalfDay?: boolean;
    halfDayPeriod?: string;
    approverName?: string;
    approverTitle?: string;
    comments?: string;
    reason?: string;
  };
}

class EmailQueueService {
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;

  /**
   * Start processing the email queue periodically
   */
  startQueueProcessor(intervalMs: number = 10000) { // Check every 10 seconds
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    // Process immediately
    this.processQueue();
  }

  /**
   * Stop the queue processor
   */
  stopQueueProcessor() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Process pending emails in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;

    try {
      // Get pending emails from the queue
      const { data: queuedEmails, error } = await supabase.rpc('process_email_queue');

      if (error) {
        console.error('Failed to fetch email queue:', error);
        return;
      }

      if (!queuedEmails || queuedEmails.length === 0) {
        return; // No emails to process
      }

      console.log(`Processing ${queuedEmails.length} queued emails...`);

      // Process each email
      for (const email of queuedEmails as QueuedEmail[]) {
        await this.processQueuedEmail(email);
      }

    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queued email
   */
  private async processQueuedEmail(queuedEmail: QueuedEmail): Promise<void> {
    try {
      console.log(`Processing ${queuedEmail.email_type} email for leave application: ${queuedEmail.leave_application_id}`);

      switch (queuedEmail.email_type) {
        case 'leave_approval':
          await emailService.sendLeaveApprovalEmails(
            queuedEmail.leave_data,
            {
              employee: queuedEmail.recipients.employee,
              adminsAndHR: queuedEmail.recipients.adminsAndHR,
              manager: queuedEmail.recipients.manager
            }
          );
          console.log(`✅ Leave approval email sent for application: ${queuedEmail.leave_application_id}`);
          break;

        case 'leave_submission':
          await emailService.sendLeaveSubmissionEmails(
            queuedEmail.leave_data,
            {
              employee: queuedEmail.recipients.employee,
              adminsAndHR: queuedEmail.recipients.adminsAndHR,
              managers: queuedEmail.recipients.managers
            }
          );
          console.log(`✅ Leave submission email sent for application: ${queuedEmail.leave_application_id}`);
          break;

        case 'leave_rejection':
          await emailService.sendLeaveRejectionEmails(
            queuedEmail.leave_data,
            {
              employee: queuedEmail.recipients.employee,
              adminsAndHR: queuedEmail.recipients.adminsAndHR,
              manager: queuedEmail.recipients.manager
            }
          );
          console.log(`✅ Leave rejection email sent for application: ${queuedEmail.leave_application_id}`);
          break;

        case 'leave_withdrawal':
          await emailService.sendLeaveWithdrawalEmails(
            queuedEmail.leave_data,
            {
              employee: queuedEmail.recipients.employee,
              adminsAndHR: queuedEmail.recipients.adminsAndHR,
              manager: queuedEmail.recipients.manager
            }
          );
          console.log(`✅ Leave withdrawal email sent for application: ${queuedEmail.leave_application_id}`);
          break;

        default:
          throw new Error(`Unknown email type: ${queuedEmail.email_type}`);
      }

      // Mark as processed successfully
      await this.markEmailProcessed(queuedEmail.queue_id, true);

    } catch (error: any) {
      console.error(`❌ Failed to send ${queuedEmail.email_type} email for application ${queuedEmail.leave_application_id}:`, error);
      
      // Mark as failed
      await this.markEmailProcessed(queuedEmail.queue_id, false, error.message);
    }
  }

  /**
   * Mark an email as processed in the database
   */
  private async markEmailProcessed(
    queueId: string, 
    success: boolean, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_email_processed', {
        p_queue_id: queueId,
        p_success: success,
        p_error_message: errorMessage || null
      });

      if (error) {
        console.error('Failed to mark email as processed:', error);
      }
    } catch (error) {
      console.error('Error marking email as processed:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('status');

      if (error) throw error;

      const stats = { pending: 0, sent: 0, failed: 0 };
      
      data?.forEach((item: any) => {
        if (item.status === 'pending') stats.pending++;
        else if (item.status === 'sent') stats.sent++;
        else if (item.status === 'failed') stats.failed++;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return { pending: 0, sent: 0, failed: 0 };
    }
  }

  /**
   * Manually trigger queue processing (for testing)
   */
  async triggerProcessing(): Promise<void> {
    await this.processQueue();
  }
}

export const emailQueueService = new EmailQueueService();
