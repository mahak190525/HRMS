import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailMessage {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  subject: string;
  body: string;
  isHtml: boolean;
}

// New interface for queue processing
interface QueuedEmail {
  queue_id: string;
  module_type: string;
  reference_id: string;
  email_type: string;
  subject: string;
  priority: string;
  recipients: {
    to: EmailRecipient[];
    cc_static?: EmailRecipient[];
    cc_dynamic_resolved?: EmailRecipient[];
  };
  email_data: any;
  scheduled_at: string;
  retry_count: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Microsoft Graph configuration
const MICROSOFT_CONFIG = {
  clientId: '3e768a01-348d-4d0a-adec-36f245ce841a',
  clientSecret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
  tenantId: '85707f27-830a-4b92-aa8c-3830bfb6c6f5',
  fromEmail: 'hrms@mechlintech.com'
};

class MicrosoftGraphService {
  accessToken = null;
  tokenExpiry = 0;
  
  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    try {
      const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_CONFIG.tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', MICROSOFT_CONFIG.clientId);
      params.append('client_secret', MICROSOFT_CONFIG.clientSecret);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('grant_type', 'client_credentials');
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw new Error('Failed to authenticate with Microsoft Graph API');
    }
  }
  
  async sendEmail(emailMessage: EmailMessage) {
    try {
      const accessToken = await this.getAccessToken();
      const message = {
        subject: emailMessage.subject,
        body: {
          contentType: emailMessage.isHtml ? 'HTML' : 'Text',
          content: emailMessage.body
        },
        toRecipients: emailMessage.to.map((recipient) => ({
          emailAddress: {
            address: recipient.email,
            name: recipient.name
          }
        })),
        ccRecipients: emailMessage.cc ? emailMessage.cc.map((recipient) => ({
          emailAddress: {
            address: recipient.email,
            name: recipient.name
          }
        })) : [],
        from: {
          emailAddress: {
            address: MICROSOFT_CONFIG.fromEmail,
            name: 'HRMS - Mechlin Technologies'
          }
        }
      };
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${MICROSOFT_CONFIG.fromEmail}/sendMail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email send failed: ${response.status} ${errorText}`);
      }
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  // Generic email template generator based on email type
  generateEmailTemplate(emailType: string, emailData: any, recipientType: string = 'employee'): string {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    switch (emailType) {
      case 'leave_approved':
        return this.generateLeaveApprovalEmailTemplate(emailData, recipientType);
      case 'leave_rejected':
        return this.generateLeaveRejectionEmailTemplate(emailData, recipientType);
      case 'leave_submitted':
        return this.generateLeaveSubmissionEmailTemplate(emailData, recipientType);
      case 'leave_withdrawn':
        return this.generateLeaveWithdrawalEmailTemplate(emailData, recipientType);
      case 'policy_assigned':
        return this.generatePolicyAssignedEmailTemplate(emailData, recipientType);
      case 'policy_acknowledged':
        return this.generatePolicyAcknowledgedEmailTemplate(emailData, recipientType);
      case 'kra_assigned':
        return this.generateKRAAssignedEmailTemplate(emailData, recipientType);
      case 'kra_submitted':
        return this.generateKRASubmittedEmailTemplate(emailData, recipientType);
      case 'kra_approved':
        return this.generateKRAEvaluatedEmailTemplate(emailData, recipientType);
      case 'payslip_generated':
        return this.generatePayslipEmailTemplate(emailData, recipientType);
      default:
        return this.generateGenericEmailTemplate(emailType, emailData, recipientType);
    }
  }

  generateLeaveApprovalEmailTemplate(leaveData: any, recipientType: string) {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Create approver_title if missing (combine name and role)
    if (!leaveData.approver_title && leaveData.approver_name && leaveData.approver_role) {
      const roleMap: Record<string, string> = {
        'super_admin': 'Super Admin',
        'admin': 'Admin',
        'hr': 'HR',
        'hrm': 'HR Manager',
        'sdm': 'Software Development Manager',
        'bdm': 'Business Development Manager',
        'qam': 'Quality Assurance Manager',
        'finance': 'Finance',
        'finance_manager': 'Finance Manager'
      };
      const formattedRole = roleMap[leaveData.approver_role] || leaveData.approver_role.replace('_', ' ');
      leaveData.approver_title = `${leaveData.approver_name} (${formattedRole})`;
    }

    let subject = '';
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';

    // Use consistent subject line format for all recipients
    subject = `Leave Request Approved - ${leaveData.employee_name} - Action Required`;
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employee_name},`;
      mainMessage = leaveData.approver_title ? 
        `Your leave request has been approved by ${leaveData.approver_title}.` :
        `Your leave request has been approved.`;
      footerMessage = `You can view your leave details in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = leaveData.approver_title ?
        `${leaveData.employee_name}'s leave request has been approved by ${leaveData.approver_title}.` :
        `${leaveData.employee_name}'s leave request has been approved.`;
      footerMessage = `You can view the complete leave details in the HRMS portal.`;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-approved { color: #28a745; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Leave Request Approved</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Leave Details</h3>
              <p><strong>Status:</strong> <span class="status-approved">Approved</span></p>
              <p><strong>Employee:</strong> ${leaveData.employee_name}</p>
              <p><strong>Leave Type:</strong> ${leaveData.leave_type}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.start_date)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.end_date)}</p>
              <p><strong>Duration:</strong> ${leaveData.days_count} day(s)</p>
              ${leaveData.approver_title ? `<p><strong>Approved By:</strong> ${leaveData.approver_title}</p>` : ''}
              ${leaveData.comments ? `<p><strong>Comments:</strong><br>${leaveData.comments}</p>` : ''}
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateLeaveRejectionEmailTemplate(leaveData: any, recipientType: string) {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Create approver_title if missing (combine name and role)
    if (!leaveData.approver_title && leaveData.approver_name && leaveData.approver_role) {
      const roleMap: Record<string, string> = {
        'super_admin': 'Super Admin',
        'admin': 'Admin',
        'hr': 'HR',
        'hrm': 'HR Manager',
        'sdm': 'Software Development Manager',
        'bdm': 'Business Development Manager',
        'qam': 'Quality Assurance Manager',
        'finance': 'Finance',
        'finance_manager': 'Finance Manager'
      };
      const formattedRole = roleMap[leaveData.approver_role] || leaveData.approver_role.replace('_', ' ');
      leaveData.approver_title = `${leaveData.approver_name} (${formattedRole})`;
    }

    // Use consistent subject line format for all recipients
    const subject = `Leave Request Rejected - ${leaveData.employee_name} - Action Required`;

    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employee_name},`;
      mainMessage = leaveData.approver_title ? 
        `Unfortunately, your leave request has been rejected by ${leaveData.approver_title}.` :
        `Unfortunately, your leave request has been rejected.`;
      footerMessage = `If you have any questions about this decision, please contact your manager or HR. You can view the details in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = leaveData.approver_title ?
        `${leaveData.employee_name}'s leave request has been rejected by ${leaveData.approver_title}.` :
        `${leaveData.employee_name}'s leave request has been rejected.`;
      footerMessage = `You can view the complete details and rejection reason in the HRMS portal.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-rejected { color: #dc3545; font-weight: bold; }
            .rejection-reason { background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Leave Request Rejected</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Leave Details</h3>
              <p><strong>Status:</strong> <span class="status-rejected">Rejected</span></p>
              <p><strong>Employee:</strong> ${leaveData.employee_name}</p>
              <p><strong>Leave Type:</strong> ${leaveData.leave_type}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.start_date)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.end_date)}</p>
              <p><strong>Duration:</strong> ${leaveData.days_count} day(s)</p>
              ${leaveData.approver_title ? `<p><strong>Rejected By:</strong> ${leaveData.approver_title}</p>` : ''}
              ${leaveData.comments ? `
                <div class="rejection-reason">
                  <p><strong>Rejection Reason:</strong><br>${leaveData.comments}</p>
                </div>
              ` : ''}
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateLeaveSubmissionEmailTemplate(leaveData: any, recipientType: string) {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Use consistent subject line format for all recipients
    const subject = `Leave Request Submitted - ${leaveData.employee_name} - Action Required`;

    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employee_name},`;
      mainMessage = `Your leave request has been successfully submitted and is now pending approval.`;
      footerMessage = `You will be notified once your request is reviewed. You can track the status in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${leaveData.employee_name} has submitted a new leave request that requires your attention.`;
      footerMessage = `Please review and approve/reject this request in the HRMS portal.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-pending { color: #007bff; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>New Leave Request Submitted</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Leave Details</h3>
              <p><strong>Status:</strong> <span class="status-pending">Pending Approval</span></p>
              <p><strong>Employee:</strong> ${leaveData.employee_name}</p>
              <p><strong>Leave Type:</strong> ${leaveData.leave_type}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.start_date)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.end_date)}</p>
              <p><strong>Duration:</strong> ${leaveData.days_count} day(s)</p>
              ${leaveData.comments ? `<p><strong>Reason:</strong><br>${leaveData.comments}</p>` : ''}
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateLeaveWithdrawalEmailTemplate(leaveData: any, recipientType: string) {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Use consistent subject line format for all recipients
    const subject = `Leave Request Withdrawn - ${leaveData.employee_name} - Action Required`;

    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employee_name},`;
      mainMessage = `Your leave request has been successfully withdrawn.`;
      footerMessage = `The leave request is now cancelled and will not affect your leave balance. You can view the details in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${leaveData.employee_name} has withdrawn their leave request.`;
      footerMessage = `The leave request has been cancelled and no further action is required. You can view the details in the HRMS portal.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ffc107; color: #212529; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-withdrawn { color: #ffc107; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Leave Request Withdrawn</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Leave Details</h3>
              <p><strong>Status:</strong> <span class="status-withdrawn">Withdrawn</span></p>
              <p><strong>Employee:</strong> ${leaveData.employee_name}</p>
              <p><strong>Leave Type:</strong> ${leaveData.leave_type}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.start_date)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.end_date)}</p>
              <p><strong>Duration:</strong> ${leaveData.days_count} day(s)</p>
              ${leaveData.comments ? `<p><strong>Withdrawal Reason:</strong><br>${leaveData.comments}</p>` : ''}
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generatePolicyAssignedEmailTemplate(policyData: any, recipientType: string) {
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    const policyText = policyData.policy_count === 1 ? '1 policy has' : `${policyData.policy_count} policies have`;
    
    if (recipientType === 'employee') {
      greeting = `Dear ${policyData.employee_name},`;
      mainMessage = `${policyText} been assigned to you by ${policyData.assigned_by_name}. Please review and acknowledge them in your HRMS dashboard.`;
      footerMessage = `You can access your assigned policies in the Policies tab of your HRMS dashboard.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${policyText} been assigned to ${policyData.employee_name} by ${policyData.assigned_by_name}.`;
      footerMessage = `You can monitor policy assignments in the HRMS admin panel.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Policy Assignment</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-assigned { color: #6366f1; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Policy Assignment</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Assignment Details</h3>
              <p><strong>Status:</strong> <span class="status-assigned">Assigned</span></p>
              <p><strong>Employee:</strong> ${policyData.employee_name}</p>
              <p><strong>Number of Policies:</strong> ${policyData.policy_count}</p>
              <p><strong>Assigned By:</strong> ${policyData.assigned_by_name}</p>
              <p><strong>Assigned Date:</strong> ${new Date(policyData.assigned_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generatePolicyAcknowledgedEmailTemplate(policyData: any, recipientType: string) {
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${policyData.assigned_by_name || 'Administrator'},`;
      mainMessage = `${policyData.employee_name} has acknowledged the policy "${policyData.policy_name || 'Policy'}" that you assigned to them.`;
      footerMessage = `Thank you for managing policy assignments. You can view the complete policy acknowledgment history in the HRMS admin panel.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${policyData.employee_name} has acknowledged the policy "${policyData.policy_name || 'Policy'}" assigned by ${policyData.assigned_by_name || 'an administrator'}.`;
      footerMessage = `You can view policy acknowledgment history in the HRMS admin panel.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Policy Acknowledged</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-acknowledged { color: #10b981; font-weight: bold; }
            .policy-name { color: #6366f1; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Policy Acknowledged</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Acknowledgment Details</h3>
              <p><strong>Status:</strong> <span class="status-acknowledged">Acknowledged</span></p>
              <p><strong>Employee:</strong> ${policyData.employee_name}</p>
              <p><strong>Policy:</strong> <span class="policy-name">${policyData.policy_name || 'Policy'}</span></p>
              <p><strong>Assigned By:</strong> ${policyData.assigned_by_name || 'Administrator'}</p>
              <p><strong>Acknowledged Date:</strong> ${new Date(policyData.acknowledged_at || policyData.assigned_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateKRAAssignedEmailTemplate(kraData: any, recipientType: string) {
    // Use consistent subject line format for all recipients
    let subject = `KRA Assignment - ${kraData.employee_name} - Action Required`;
    
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    let headerTitle = 'KRA Assignment';
    let statusColor = '#8b5cf6';
    let statusText = 'Assigned';
    
    // Check if this is a reassignment or quarter enabled scenario
    if (kraData.reassigned_at) {
      subject = `KRA Reassignment - ${kraData.employee_name} - Action Required`;
      headerTitle = 'KRA Reassignment';
      statusText = 'Reassigned';
      statusColor = '#f59e0b';
      
      if (recipientType === 'employee') {
        greeting = `Dear ${kraData.employee_name},`;
        mainMessage = `Your KRA has been reassigned by ${kraData.manager_name || 'your manager'}.`;
        footerMessage = `Please review your updated KRA details and objectives in the HRMS portal.`;
      } else {
        greeting = `Hello,`;
        mainMessage = `${kraData.employee_name}'s KRA has been reassigned.`;
        footerMessage = `You can monitor KRA assignments and progress in the HRMS admin panel.`;
      }
    } else if (kraData.quarter && kraData.enabled_at) {
      subject = `KRA Quarter Enabled - ${kraData.employee_name} - Action Required`;
      headerTitle = 'KRA Quarter Enabled';
      statusText = `${kraData.quarter} Enabled`;
      statusColor = '#10b981';
      
      if (recipientType === 'employee') {
        greeting = `Dear ${kraData.employee_name},`;
        mainMessage = `${kraData.manager_name || 'Your manager'} has enabled ${kraData.quarter} for your KRA. You can now submit evidence for this quarter.`;
        footerMessage = `Please submit your KRA evidence for ${kraData.quarter} in the HRMS portal.`;
      } else {
        greeting = `Hello,`;
        mainMessage = `${kraData.quarter} has been enabled for ${kraData.employee_name}'s KRA.`;
        footerMessage = `You can monitor KRA progress in the HRMS admin panel.`;
      }
    } else {
      // Regular assignment
      if (recipientType === 'employee') {
        greeting = `Dear ${kraData.employee_name},`;
        mainMessage = `A new KRA has been assigned to you by ${kraData.manager_name || 'your manager'}.`;
        footerMessage = `Please review your KRA details and objectives in the HRMS portal.`;
      } else {
        greeting = `Hello,`;
        mainMessage = `A new KRA has been assigned to ${kraData.employee_name}.`;
        footerMessage = `You can monitor KRA assignments and progress in the HRMS admin panel.`;
      }
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-assigned { color: #8b5cf6; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header" style="background: ${statusColor};">
            <h2>${headerTitle}</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>${headerTitle} Details</h3>
              <p><strong>Status:</strong> <span class="status-assigned" style="color: ${statusColor};">${statusText}</span></p>
              <p><strong>Employee:</strong> ${kraData.employee_name}</p>
              <p><strong>Manager:</strong> ${kraData.manager_name || 'Not specified'}</p>
              ${kraData.quarter ? `<p><strong>Quarter:</strong> ${kraData.quarter}</p>` : ''}
              <p><strong>Date:</strong> ${new Date(kraData.assigned_at || kraData.reassigned_at || kraData.enabled_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateKRASubmittedEmailTemplate(kraData: any, recipientType: string) {
    // Use consistent subject line format for all recipients
    const subject = `KRA Submission - ${kraData.employee_name} - Action Required`;
    
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'manager') {
      greeting = `Dear Manager,`;
      mainMessage = `${kraData.employee_name} has submitted their KRA evidence for ${kraData.quarter}. Please review and evaluate the submission.`;
      footerMessage = `Please review the KRA submission in the HRMS portal and provide your evaluation.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${kraData.employee_name} has submitted their KRA evidence for ${kraData.quarter}.`;
      footerMessage = `You can view the KRA submission details in the HRMS admin panel.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-submitted { color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>KRA Submission</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Submission Details</h3>
              <p><strong>Status:</strong> <span class="status-submitted">Submitted</span></p>
              <p><strong>Employee:</strong> ${kraData.employee_name}</p>
              <p><strong>Quarter:</strong> ${kraData.quarter}</p>
              <p><strong>Submitted Date:</strong> ${new Date(kraData.submitted_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateKRAEvaluatedEmailTemplate(kraData: any, recipientType: string) {
    // Use consistent subject line format for all recipients
    const subject = `KRA Evaluation Completed - ${kraData.employee_name} - Action Required`;
    
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${kraData.employee_name},`;
      mainMessage = `Your KRA submission for ${kraData.quarter} has been evaluated by ${kraData.manager_name || 'your manager'}.`;
      footerMessage = `Please check your KRA evaluation results in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${kraData.manager_name} has completed the evaluation for ${kraData.employee_name}'s KRA submission (${kraData.quarter}).`;
      footerMessage = `You can view the evaluation details in the HRMS admin panel.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-evaluated { color: #3b82f6; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>KRA Evaluation Completed</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Evaluation Details</h3>
              <p><strong>Status:</strong> <span class="status-evaluated">Evaluated</span></p>
              <p><strong>Employee:</strong> ${kraData.employee_name}</p>
              <p><strong>Quarter:</strong> ${kraData.quarter}</p>
              <p><strong>Evaluated By:</strong> ${kraData.manager_name || 'Manager'}</p>
              <p><strong>Evaluation Date:</strong> ${new Date(kraData.evaluated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generatePayslipEmailTemplate(payrollData: any, recipientType: string) {
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${payrollData.employee_name},`;
      mainMessage = `Your payslip for ${payrollData.pay_period} is now ready for download.`;
      footerMessage = `You can access your payslip in the HRMS portal under the Payroll section.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `Payslip for ${payrollData.employee_name} (${payrollData.pay_period}) has been generated.`;
      footerMessage = `You can view payroll details in the HRMS admin panel.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payslip Generated</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .status-ready { color: #059669; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Payslip Generated</h2>
            <p>Mechlin Technologies - HRMS</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${mainMessage}</p>
            
            <div class="details">
              <h3>Payslip Details</h3>
              <p><strong>Status:</strong> <span class="status-ready">Ready</span></p>
              <p><strong>Employee:</strong> ${payrollData.employee_name}</p>
              <p><strong>Pay Period:</strong> ${payrollData.pay_period}</p>
              <p><strong>Gross Salary:</strong> ₹${payrollData.gross_salary?.toLocaleString() || 'N/A'}</p>
              <p><strong>Net Salary:</strong> ₹${payrollData.net_salary?.toLocaleString() || 'N/A'}</p>
            </div>
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateGenericEmailTemplate(emailType: string, emailData: any, recipientType: string) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>HRMS Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>HRMS Notification</h2>
            <p>Mechlin Technologies</p>
          </div>
          <div class="content">
            <p>Hello ${emailData.employee_name || 'there'},</p>
            <p>You have received a notification from the HRMS system.</p>
            <p><strong>Type:</strong> ${emailType}</p>
            <p>Please check your HRMS dashboard for more details.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateTestEmailTemplate(recipientName: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>HRMS Email Test</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>HRMS Email Service Test</h2>
            <p>Mechlin Technologies</p>
          </div>
          <div style="padding: 20px;">
            <p>Hello ${recipientName},</p>
            <p>This is a test email to verify that the Microsoft Graph email integration is working correctly.</p>
            <p>If you receive this email, the email service has been successfully configured!</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Sent at: ${new Date().toLocaleString()}</li>
              <li>Service: Microsoft Graph API</li>
              <li>From: ${MICROSOFT_CONFIG.fromEmail}</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const emailService = new MicrosoftGraphService();
    const url = new URL(req.url);
    console.log('🔍 Request URL:', req.url);
    console.log('🔍 Pathname:', url.pathname);
    
    let requestData = {};
    try {
      requestData = await req.json();
    } catch (e) {
      console.log('No JSON body provided, using empty object');
    }

    // NEW: Queue processing endpoint
    if (url.pathname === '/process-queue' || url.pathname.endsWith('/process-queue')) {
      console.log('🔄 Processing email queue...');
      
      // Get emails from queue
      const { data: queuedEmails, error: queueError } = await supabase.rpc('process_email_queue', {
        p_limit: 10,
        p_status: 'pending'
      });

      if (queueError) {
        console.error('Error fetching email queue:', queueError);
        throw new Error(`Queue fetch failed: ${queueError.message}`);
      }

      if (!queuedEmails || queuedEmails.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No emails to process',
          processed: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      console.log(`📧 Processing ${queuedEmails.length} emails from queue`);
      let processedCount = 0;
      let errorCount = 0;

      // Process each email
      for (const queuedEmail of queuedEmails) {
        try {
          console.log(`📨 Processing email: ${queuedEmail.email_type} for ${queuedEmail.module_type}`);

          // Prepare recipients
          const ccRecipients: EmailRecipient[] = [
            ...(queuedEmail.recipients.cc_static || []),
            ...(queuedEmail.recipients.cc_dynamic_resolved || [])
          ];

          // Generate email body based on email type
          const emailBody = emailService.generateEmailTemplate(
            queuedEmail.email_type,
            queuedEmail.email_data,
            'employee' // Default recipient type
          );

          // Send email
          await emailService.sendEmail({
            to: queuedEmail.recipients.to,
            cc: ccRecipients,
            subject: queuedEmail.subject,
            body: emailBody,
            isHtml: true
          });

          // Mark as successfully sent
          await supabase.rpc('mark_email_processed', {
            p_queue_id: queuedEmail.queue_id,
            p_success: true
          });

          processedCount++;
          console.log(`✅ Email sent successfully: ${queuedEmail.queue_id}`);

        } catch (emailError) {
          console.error(`❌ Failed to send email ${queuedEmail.queue_id}:`, emailError);
          
          // Mark as failed
          await supabase.rpc('mark_email_processed', {
            p_queue_id: queuedEmail.queue_id,
            p_success: false,
            p_error_message: emailError.message,
            p_error_details: { stack: emailError.stack }
          });

          errorCount++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${processedCount} emails successfully, ${errorCount} failed`,
        processed: processedCount,
        failed: errorCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // EXISTING: Direct email endpoints (for backward compatibility)
    if (requestData.type === 'test') {
      // Send test email
      if (!requestData.recipient) {
        throw new Error('Recipient is required for test email');
      }
      const emailBody = emailService.generateTestEmailTemplate(requestData.recipient.name);
      await emailService.sendEmail({
        to: [requestData.recipient],
        subject: '🧪 HRMS Email Service Test',
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Test email sent successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Handle other existing email types (leave_approval, policy_assignment, etc.)
    // Keep existing logic for backward compatibility...
    
    // For now, return error for unhandled types
    throw new Error('Invalid email type or use /process-queue endpoint for queue processing');

  } catch (error) {
    console.error('Email service error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send email'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
