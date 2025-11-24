import { supabase } from './supabase';

interface EmailRecipient {
  email: string;
  name: string;
}

interface LeaveEmailData {
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
}

interface PolicyEmailData {
  employeeName: string;
  employeeEmail: string;
  policyCount: number;
  assignedByName: string;
  assignedAt: string;
}

class EmailService {
  /**
   * Call Supabase Edge Function to send email
   */
  private async callEmailFunction(payload: any): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: payload,
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to call email function');
      }

      if (!data.success) {
        throw new Error(data.error || 'Email function returned error');
      }

      console.log('Email sent successfully via Supabase function');
    } catch (error: any) {
      console.error('Failed to send email via function:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }


  /**
   * Send leave approval email notifications
   * Now uses TO/CC structure: Employee in TO, others in CC
   */
  async sendLeaveApprovalEmails(
    leaveData: LeaveEmailData,
    recipients: {
      employee: EmailRecipient;
      adminsAndHR: EmailRecipient[];
      manager?: EmailRecipient;
    }
  ): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'leave_approval',
        leaveData,
        recipients,
      });
      console.log('Leave approval email sent successfully (TO: employee, CC: admins/HR/manager)');
    } catch (error) {
      console.error('Failed to send leave approval emails:', error);
      throw error;
    }
  }

  /**
   * Send leave submission email notifications
   */
  async sendLeaveSubmissionEmails(
    leaveData: LeaveEmailData,
    recipients: {
      employee: EmailRecipient;
      adminsAndHR: EmailRecipient[];
      managers?: EmailRecipient[];
    }
  ): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'leave_submission',
        leaveData,
        recipients,
      });
      console.log('Leave submission email sent successfully');
    } catch (error) {
      console.error('Failed to send leave submission emails:', error);
      throw error;
    }
  }

  /**
   * Send leave rejection email notifications
   */
  async sendLeaveRejectionEmails(
    leaveData: LeaveEmailData,
    recipients: {
      employee: EmailRecipient;
      adminsAndHR: EmailRecipient[];
      manager?: EmailRecipient;
    }
  ): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'leave_rejection',
        leaveData,
        recipients,
      });
      console.log('Leave rejection email sent successfully');
    } catch (error) {
      console.error('Failed to send leave rejection emails:', error);
      throw error;
    }
  }

  /**
   * Send leave withdrawal email notifications
   */
  async sendLeaveWithdrawalEmails(
    leaveData: LeaveEmailData,
    recipients: {
      employee: EmailRecipient;
      adminsAndHR: EmailRecipient[];
      manager?: EmailRecipient;
    }
  ): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'leave_withdrawal',
        leaveData,
        recipients,
      });
      console.log('Leave withdrawal email sent successfully');
    } catch (error) {
      console.error('Failed to send leave withdrawal emails:', error);
      throw error;
    }
  }

  /**
   * Send policy assignment email notifications
   */
  async sendPolicyAssignedEmails(
    policyData: PolicyEmailData,
    recipients: {
      employee: EmailRecipient;
      adminsAndHR: EmailRecipient[];
    }
  ): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'policy_assignment',
        leaveData: policyData, // Reusing leaveData field for policy data
        recipients,
      });
      console.log('Policy assignment email sent successfully');
    } catch (error) {
      console.error('Failed to send policy assignment emails:', error);
      throw error;
    }
  }

  /**
   * Send policy acknowledgment email notifications
   */
  async sendPolicyAcknowledgedEmails(
    policyData: PolicyEmailData,
    recipients: {
      employee: EmailRecipient;
      adminsAndHR: EmailRecipient[];
    }
  ): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'policy_acknowledgment',
        leaveData: policyData, // Reusing leaveData field for policy data
        recipients,
      });
      console.log('Policy acknowledgment email sent successfully');
    } catch (error) {
      console.error('Failed to send policy acknowledgment emails:', error);
      throw error;
    }
  }

  /**
   * Test email functionality
   */
  async testEmail(testRecipient: EmailRecipient): Promise<void> {
    try {
      await this.callEmailFunction({
        type: 'test',
        recipient: testRecipient,
      });
      console.log('Test email sent successfully');
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
export type { EmailRecipient, LeaveEmailData, PolicyEmailData };
