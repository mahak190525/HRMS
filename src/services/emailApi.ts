import { emailService, type EmailRecipient } from './emailService';
import { supabase } from './supabase';
import { emailQueueService } from './emailQueueService';

export const emailApi = {
  /**
   * Test email functionality
   */
  async testEmail(recipient: EmailRecipient): Promise<void> {
    try {
      await emailService.testEmail(recipient);
    } catch (error) {
      console.error('Test email failed:', error);
      throw error;
    }
  },

  /**
   * Send leave approval emails manually (for testing or manual triggers)
   * This calls the database function to queue the email, then processes the queue
   */
  async sendLeaveApprovalEmails(leaveApplicationId: string): Promise<void> {
    return this.sendLeaveEmail(leaveApplicationId, 'leave_approval');
  },

  /**
   * Send leave submission emails manually
   */
  async sendLeaveSubmissionEmails(leaveApplicationId: string): Promise<void> {
    return this.sendLeaveEmail(leaveApplicationId, 'leave_submission');
  },

  /**
   * Send leave rejection emails manually
   */
  async sendLeaveRejectionEmails(leaveApplicationId: string): Promise<void> {
    return this.sendLeaveEmail(leaveApplicationId, 'leave_rejection');
  },

  /**
   * Send leave withdrawal emails manually
   */
  async sendLeaveWithdrawalEmails(leaveApplicationId: string): Promise<void> {
    return this.sendLeaveEmail(leaveApplicationId, 'leave_withdrawal');
  },

  /**
   * Generic function to send any type of leave email
   */
  async sendLeaveEmail(leaveApplicationId: string, emailType: string): Promise<void> {
    try {
      // Call the database function that queues the email
      const { data, error } = await supabase.rpc('send_leave_email_notification', {
        p_leave_application_id: leaveApplicationId,
        p_email_type: emailType
      });

      if (error) {
        console.error('Database function error:', error);
        throw new Error(`Failed to queue ${emailType} email: ${error.message}`);
      }

      console.log(`${emailType} email queued successfully via database function`);
      
      // Trigger immediate processing of the queue
      await emailQueueService.triggerProcessing();
      
      console.log('Email queue processing triggered');
    } catch (error) {
      console.error(`${emailType} email failed:`, error);
      throw error;
    }
  },

  /**
   * Get email queue statistics
   */
  async getEmailQueueStats() {
    return await emailQueueService.getQueueStats();
  },

  /**
   * Manually trigger email queue processing
   */
  async processEmailQueue() {
    await emailQueueService.triggerProcessing();
  },
};

