import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// Microsoft Graph configuration
const MICROSOFT_CONFIG = {
  clientId: '3e768a01-348d-4d0a-adec-36f245ce841a',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
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
        toRecipients: emailMessage.to.map((recipient)=>({
            emailAddress: {
              address: recipient.email,
              name: recipient.name
            }
          })),
        ccRecipients: emailMessage.cc ? emailMessage.cc.map((recipient)=>({
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
  generateLeaveApprovalEmailTemplate(leaveData, recipientType) {
    const formatDate = (dateString)=>{
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    let subject = '';
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    if (recipientType === 'employee') {
      subject = `Your Leave Request Has Been Approved`;
      greeting = `Dear ${leaveData.employeeName},`;
      mainMessage = leaveData.approverTitle ? 
        `Your leave request has been approved by ${leaveData.approverTitle}.` :
        `Your leave request has been approved.`;
      footerMessage = `You can view your leave details in the HRMS portal.`;
    } else {
      subject = `Leave Request Approved - ${leaveData.employeeName}`;
      greeting = `Hello,`;
      mainMessage = leaveData.approverTitle ?
        `${leaveData.employeeName}'s leave request has been approved by ${leaveData.approverTitle}.` :
        `${leaveData.employeeName}'s leave request has been approved.`;
      footerMessage = `You can view the complete leave details in the HRMS portal.`;
    }
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Leave Request Approved</title>
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
              <p><strong>Employee:</strong> ${leaveData.employeeName}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.startDate)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.endDate)}</p>
              <p><strong>Duration:</strong> ${leaveData.daysDisplay || leaveData.daysCount + ' day(s)'}</p>
              ${leaveData.approverTitle ? `<p><strong>Approved By:</strong> ${leaveData.approverTitle}</p>` : ''}
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

  generateLeaveSubmissionEmailTemplate(leaveData, recipientType) {
    const formatDate = (dateString)=>{
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employeeName},`;
      mainMessage = `Your leave request has been successfully submitted and is now pending approval.`;
      footerMessage = `You will be notified once your request is reviewed. You can track the status in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${leaveData.employeeName} has submitted a new leave request that requires your attention.`;
      footerMessage = `Please review and approve/reject this request in the HRMS portal.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Leave Request Submitted</title>
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
              <p><strong>Employee:</strong> ${leaveData.employeeName}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.startDate)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.endDate)}</p>
              <p><strong>Duration:</strong> ${leaveData.daysDisplay || leaveData.daysCount + ' day(s)'}</p>
              ${leaveData.reason ? `<p><strong>Reason:</strong><br>${leaveData.reason}</p>` : ''}
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

  generateLeaveRejectionEmailTemplate(leaveData, recipientType) {
    const formatDate = (dateString)=>{
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employeeName},`;
      mainMessage = leaveData.approverTitle ? 
        `Unfortunately, your leave request has been rejected by ${leaveData.approverTitle}.` :
        `Unfortunately, your leave request has been rejected.`;
      footerMessage = `If you have any questions about this decision, please contact your manager or HR. You can view the details in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = leaveData.approverTitle ?
        `${leaveData.employeeName}'s leave request has been rejected by ${leaveData.approverTitle}.` :
        `${leaveData.employeeName}'s leave request has been rejected.`;
      footerMessage = `You can view the complete details and rejection reason in the HRMS portal.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Leave Request Rejected</title>
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
              <p><strong>Employee:</strong> ${leaveData.employeeName}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.startDate)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.endDate)}</p>
              <p><strong>Duration:</strong> ${leaveData.daysDisplay || leaveData.daysCount + ' day(s)'}</p>
              ${leaveData.approverTitle ? `<p><strong>Rejected By:</strong> ${leaveData.approverTitle}</p>` : ''}
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

  generatePolicyAssignedEmailTemplate(policyData, recipientType) {
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    const policyText = policyData.policyCount === 1 ? '1 policy has' : `${policyData.policyCount} policies have`;
    
    if (recipientType === 'employee') {
      greeting = `Dear ${policyData.employeeName},`;
      mainMessage = `${policyText} been assigned to you by ${policyData.assignedByName}. Please review and acknowledge them in your HRMS dashboard.`;
      footerMessage = `You can access your assigned policies in the Policies tab of your HRMS dashboard.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${policyText} been assigned to ${policyData.employeeName} by ${policyData.assignedByName}.`;
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
            .cta-button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
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
              <p><strong>Employee:</strong> ${policyData.employeeName}</p>
              <p><strong>Number of Policies:</strong> ${policyData.policyCount}</p>
              <p><strong>Assigned By:</strong> ${policyData.assignedByName}</p>
              <p><strong>Assigned Date:</strong> ${new Date(policyData.assignedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            ${recipientType === 'employee' ? `
              <div style="text-align: center;">
                <a href="https://hrms.mechlintech.com/" class="cta-button">Review Policies in HRMS</a>
              </div>
            ` : ''}
            
            <p>${footerMessage}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
      `;
  }

  generatePolicyAcknowledgedEmailTemplate(policyData, recipientType) {
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      // This is for the assigner (primary recipient)
      greeting = `Dear ${policyData.assigned_by_name || 'Administrator'},`;
      mainMessage = `${policyData.employeeName} has acknowledged the policy "${policyData.policy_name || 'Policy'}" that you assigned to them.`;
      footerMessage = `Thank you for managing policy assignments. You can view the complete policy acknowledgment history in the HRMS admin panel.`;
    } else {
      // This is for CC recipients (other HR/Admin users)
      greeting = `Hello,`;
      mainMessage = `${policyData.employeeName} has acknowledged the policy "${policyData.policy_name || 'Policy'}" assigned by ${policyData.assigned_by_name || 'an administrator'}.`;
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
              <p><strong>Employee:</strong> ${policyData.employeeName}</p>
              <p><strong>Policy:</strong> <span class="policy-name">${policyData.policy_name || 'Policy'}</span></p>
              <p><strong>Assigned By:</strong> ${policyData.assigned_by_name || 'Administrator'}</p>
              <p><strong>Acknowledged Date:</strong> ${new Date(policyData.acknowledged_at || policyData.assignedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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

  generateLeaveWithdrawalEmailTemplate(leaveData, recipientType) {
    const formatDate = (dateString)=>{
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    let greeting = '';
    let mainMessage = '';
    let footerMessage = '';
    
    if (recipientType === 'employee') {
      greeting = `Dear ${leaveData.employeeName},`;
      mainMessage = `Your leave request has been successfully withdrawn.`;
      footerMessage = `The leave request is now cancelled and will not affect your leave balance. You can view the details in the HRMS portal.`;
    } else {
      greeting = `Hello,`;
      mainMessage = `${leaveData.employeeName} has withdrawn their leave request.`;
      footerMessage = `The leave request has been cancelled and no further action is required. You can view the details in the HRMS portal.`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Leave Request Withdrawn</title>
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
              <p><strong>Employee:</strong> ${leaveData.employeeName}</p>
              <p><strong>Start Date:</strong> ${formatDate(leaveData.startDate)}</p>
              <p><strong>End Date:</strong> ${formatDate(leaveData.endDate)}</p>
              <p><strong>Duration:</strong> ${leaveData.daysDisplay || leaveData.daysCount + ' day(s)'}</p>
              ${leaveData.approverTitle ? `<p><strong>Withdrawn By:</strong> ${leaveData.approverTitle}</p>` : `<p><strong>Withdrawn By:</strong> ${leaveData.employeeName}</p>`}
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
  
  generateTestEmailTemplate(recipientName) {
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
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const emailService = new MicrosoftGraphService();
    const requestData = await req.json();
    if (requestData.type === 'test') {
      // Send test email
      if (!requestData.recipient) {
        throw new Error('Recipient is required for test email');
      }
      const emailBody = emailService.generateTestEmailTemplate(requestData.recipient.name);
      await emailService.sendEmail({
        to: [
          requestData.recipient
        ],
        subject: '🧪 HRMS Email Service Test',
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Test email sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (requestData.type === 'leave_approval') {
      // Send leave approval emails with proper TO/CC structure
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Leave data and recipients are required for leave approval email');
      }
      // Prepare CC recipients (admins, HR, and manager)
      const ccRecipients: EmailRecipient[] = [];
      if (requestData.recipients.adminsAndHR && requestData.recipients.adminsAndHR.length > 0) {
        ccRecipients.push(...requestData.recipients.adminsAndHR);
      }
      if (requestData.recipients.manager) {
        ccRecipients.push(requestData.recipients.manager);
      }
      // Generate email body (employee-focused since they're the primary recipient)
      const emailBody = emailService.generateLeaveApprovalEmailTemplate(requestData.leaveData, 'employee');
      // Send single email with employee as TO and others as CC
      await emailService.sendEmail({
        to: [
          requestData.recipients.employee
        ],
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: `Your leave request has been Approved`,
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Leave approval emails sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (requestData.type === 'leave_submission') {
      // Send leave submission emails
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Leave data and recipients are required for leave submission email');
      }
      // Prepare CC recipients (admins, HR, and managers)
      const ccRecipients: EmailRecipient[] = [];
      if (requestData.recipients.adminsAndHR && requestData.recipients.adminsAndHR.length > 0) {
        ccRecipients.push(...requestData.recipients.adminsAndHR);
      }
      if (requestData.recipients.managers && requestData.recipients.managers.length > 0) {
        ccRecipients.push(...requestData.recipients.managers);
      }
      // Generate email body (employee confirmation)
      const employeeEmailBody = emailService.generateLeaveSubmissionEmailTemplate(requestData.leaveData, 'employee');
      // Send confirmation email to employee
      await emailService.sendEmail({
        to: [
          requestData.recipients.employee
        ],
        subject: `Leave Request Submitted Successfully`,
        body: employeeEmailBody,
        isHtml: true
      });
      // Send notification email to managers and HR (if any)
      if (ccRecipients.length > 0) {
        const managerEmailBody = emailService.generateLeaveSubmissionEmailTemplate(requestData.leaveData, 'manager');
        await emailService.sendEmail({
          to: ccRecipients,
          subject: `New Leave Request - ${requestData.leaveData.employeeName}`,
          body: managerEmailBody,
          isHtml: true
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: 'Leave submission emails sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (requestData.type === 'leave_rejection') {
      // Send leave rejection emails
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Leave data and recipients are required for leave rejection email');
      }
      // Prepare CC recipients (admins, HR, and manager)
      const ccRecipients: EmailRecipient[] = [];
      if (requestData.recipients.adminsAndHR && requestData.recipients.adminsAndHR.length > 0) {
        ccRecipients.push(...requestData.recipients.adminsAndHR);
      }
      if (requestData.recipients.manager) {
        ccRecipients.push(requestData.recipients.manager);
      }
      // Generate email body (employee-focused since they're the primary recipient)
      const emailBody = emailService.generateLeaveRejectionEmailTemplate(requestData.leaveData, 'employee');
      // Send single email with employee as TO and others as CC
      await emailService.sendEmail({
        to: [
          requestData.recipients.employee
        ],
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: `Your leave request has been Rejected`,
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Leave rejection emails sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (requestData.type === 'leave_withdrawal') {
      // Send leave withdrawal emails
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Leave data and recipients are required for leave withdrawal email');
      }
      // Prepare CC recipients (admins, HR, and manager)
      const ccRecipients: EmailRecipient[] = [];
      if (requestData.recipients.adminsAndHR && requestData.recipients.adminsAndHR.length > 0) {
        ccRecipients.push(...requestData.recipients.adminsAndHR);
      }
      if (requestData.recipients.manager) {
        ccRecipients.push(requestData.recipients.manager);
      }
      // Generate email body (employee-focused since they're the primary recipient)
      const emailBody = emailService.generateLeaveWithdrawalEmailTemplate(requestData.leaveData, 'employee');
      // Send single email with employee as TO and others as CC
      await emailService.sendEmail({
        to: [
          requestData.recipients.employee
        ],
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: `Leave request withdrawn successfully`,
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Leave withdrawal emails sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (requestData.type === 'policy_assignment') {
      // Send policy assignment emails
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Policy data and recipients are required for policy assignment email');
      }
      // Generate email body (employee-focused since they're the primary recipient)
      const emailBody = emailService.generatePolicyAssignedEmailTemplate(requestData.leaveData, 'employee');
      // Send email to employee with admins/HR as CC
      await emailService.sendEmail({
        to: [
          requestData.recipients.employee
        ] as any,
        cc: requestData.recipients.adminsAndHR && requestData.recipients.adminsAndHR.length > 0 ? requestData.recipients.adminsAndHR : undefined,
        subject: `Policy Assignment - Action Required`,
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Policy assignment email sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (requestData.type === 'policy_acknowledgment') {
      // Send policy acknowledgment email TO the assigner with HR/Admin in CC
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Policy data and recipients are required for policy acknowledgment email');
      }
      
      // Generate email body for the primary recipient (assigner)
      const emailBody = emailService.generatePolicyAcknowledgedEmailTemplate(requestData.leaveData, 'employee');
      
      // Prepare recipients
      const toRecipients = [requestData.recipients.employee]; // Assigner
      const ccRecipients = requestData.recipients.adminsAndHR || []; // Other HR/Admin users
      
      console.log(`📧 Policy acknowledgment email - TO: ${toRecipients[0]?.name} (${toRecipients[0]?.email}), CC: ${ccRecipients.length} recipients`);
      
      // Send email TO the assigner with others in CC
      await emailService.sendEmail({
        to: toRecipients as any,
        cc: ccRecipients.length > 0 ? ccRecipients as any : undefined,
        subject: `Policy Acknowledged - ${requestData.leaveData.employeeName}`,
        body: emailBody,
        isHtml: true
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Policy acknowledgment email sent successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else {
      throw new Error('Invalid email type');
    }
  } catch (error) {
    console.error('Email service error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send email'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
