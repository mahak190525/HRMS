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
      // Map old email types to new enum values
      const emailTypeMap: Record<string, string> = {
        'leave_approval': 'leave_approved',
        'leave_submission': 'leave_submitted',
        'leave_rejection': 'leave_rejected',
        'leave_withdrawal': 'leave_withdrawn'
      };
      
      const mappedEmailType = emailTypeMap[emailType] || emailType;

      // Call the database function that queues the email (using new generic function)
      const { data, error } = await supabase.rpc('send_leave_email_notification_generic', {
        p_leave_application_id: leaveApplicationId,
        p_email_type: mappedEmailType
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
   * Send policy assignment emails (collective email to prevent spam)
   */
  async sendPolicyAssignmentEmails(userIds: string[], assignedByName: string, policyCount: number = 1): Promise<void> {
    try {
      // Call the database function that queues the emails
      const { data, error } = await supabase.rpc('notify_policy_assignments_with_email', {
        p_user_ids: userIds,
        p_assigned_by_name: assignedByName,
        p_policy_count: policyCount
      });

      if (error) {
        console.error('Database function error:', error);
        throw new Error(`Failed to queue policy assignment emails: ${error.message}`);
      }

      console.log(`Policy assignment emails queued successfully for ${userIds.length} users`);
      
      // Trigger immediate processing of the queue
      await emailQueueService.triggerProcessing();
      
      console.log('Email queue processing triggered');
    } catch (error) {
      console.error('Policy assignment emails failed:', error);
      throw error;
    }
  },

  /**
   * Send policy acknowledgment email
   */
  async sendPolicyAcknowledgmentEmail(
    employeeId: string, 
    employeeName: string, 
    policyName: string, 
    policyId: string
  ): Promise<void> {
    try {
      // Call the database function that queues the email
      const { data, error } = await supabase.rpc('notify_policy_acknowledgment_with_email', {
        p_employee_id: employeeId,
        p_employee_name: employeeName,
        p_policy_name: policyName,
        p_policy_id: policyId
      });

      if (error) {
        console.error('Database function error:', error);
        throw new Error(`Failed to queue policy acknowledgment email: ${error.message}`);
      }

      console.log('Policy acknowledgment email queued successfully');
      
      // Trigger immediate processing of the queue
      await emailQueueService.triggerProcessing();
      
      console.log('Email queue processing triggered');
    } catch (error) {
      console.error('Policy acknowledgment email failed:', error);
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

