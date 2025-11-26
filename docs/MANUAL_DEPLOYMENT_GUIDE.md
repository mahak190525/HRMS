# Manual Edge Function Deployment Guide

## 🚨 **Current Issue**
The error you're seeing is because the `send-email` Edge Function hasn't been deployed to your Supabase project yet. The function exists in your local files but not on the server.

## 🎯 **Quick Fix: Deploy via Supabase Dashboard**

### Step 1: Go to Supabase Dashboard
1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (`xsrnbglsrikxpnhodiew`)
3. Navigate to **Edge Functions** in the left sidebar

### Step 2: Create the Function
1. Click **"Create Function"**
2. Function name: `send-email`
3. Copy the entire contents from `supabase/functions/send-email/index.ts`
4. Paste it into the code editor
5. Click **"Deploy Function"**

### Step 3: Test the Function
After deployment, try the email test again in your HRMS app.

---

## 🔧 **Alternative: CLI Deployment**

If you prefer using CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (replace with your project ref)
supabase link --project-ref xsrnbglsrikxpnhodiew

# Deploy the function
supabase functions deploy send-email
```

---

## 📋 **Function Code to Copy**

Here's the complete code for the `send-email` function:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailRequest {
  type: 'test' | 'leave_approval';
  recipient?: EmailRecipient;
  leaveData?: {
    employeeName: string;
    employeeEmail: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    approverName: string;
    approverTitle: string;
    comments?: string;
  };
  recipients?: {
    employee: EmailRecipient;
    adminsAndHR: EmailRecipient[];
    manager?: EmailRecipient;
  };
}

// Microsoft Graph configuration
const MICROSOFT_CONFIG = {
  clientId: '',
  clientSecret: '',
  tenantId: '',
  fromEmail: '',
};

class MicrosoftGraphService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async getAccessToken(): Promise<string> {
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
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw new Error('Failed to authenticate with Microsoft Graph API');
    }
  }

  async sendEmail(to: EmailRecipient[], subject: string, body: string, isHtml: boolean = true): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      const message = {
        subject,
        body: {
          contentType: isHtml ? 'HTML' : 'Text',
          content: body,
        },
        toRecipients: to.map(recipient => ({
          emailAddress: {
            address: recipient.email,
            name: recipient.name,
          },
        })),
        from: {
          emailAddress: {
            address: MICROSOFT_CONFIG.fromEmail,
            name: 'HRMS - Mechlin Technologies',
          },
        },
      };

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${MICROSOFT_CONFIG.fromEmail}/sendMail`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        }
      );

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

  generateTestEmailTemplate(recipientName: string): string {
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
            <h2>🏢 HRMS Email Service Test</h2>
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

  generateLeaveApprovalEmailTemplate(leaveData: any, recipientType: 'employee' | 'admin_hr' | 'manager'): string {
    const formatDate = (dateString: string) => {
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

    if (recipientType === 'employee') {
      subject = `✅ Your ${leaveData.leaveType} Request has been Approved`;
      greeting = `Dear ${leaveData.employeeName},`;
      mainMessage = `Great news! Your leave request has been approved by ${leaveData.approverTitle}.`;
    } else {
      subject = `✅ Leave Request Approved - ${leaveData.employeeName}`;
      greeting = `Hello,`;
      mainMessage = `${leaveData.employeeName}'s ${leaveData.leaveType} request has been approved by ${leaveData.approverTitle}.`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .status-approved { color: #28a745; font-weight: bold; font-size: 18px; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .detail-item { padding: 10px; background: #f1f3f4; border-radius: 4px; }
          .detail-label { font-weight: bold; color: #5f6368; font-size: 12px; text-transform: uppercase; }
          .detail-value { color: #202124; margin-top: 4px; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 14px; }
          .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .comments { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏢 HRMS</div>
            <div>Mechlin Technologies</div>
          </div>
          
          <div class="content">
            <div class="card">
              <h2 style="margin-top: 0; color: #333;">Leave Request Approved</h2>
              
              <p>${greeting}</p>
              <p>${mainMessage}</p>
              
              <div class="status-approved">✅ APPROVED</div>
              
              <div class="details-grid">
                <div class="detail-item">
                  <div class="detail-label">Employee</div>
                  <div class="detail-value">${leaveData.employeeName}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Leave Type</div>
                  <div class="detail-value">${leaveData.leaveType}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Start Date</div>
                  <div class="detail-value">${formatDate(leaveData.startDate)}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">End Date</div>
                  <div class="detail-value">${formatDate(leaveData.endDate)}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Duration</div>
                  <div class="detail-value">${leaveData.daysCount} day${leaveData.daysCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Approved By</div>
                  <div class="detail-value">${leaveData.approverTitle}</div>
                </div>
              </div>
              
              ${leaveData.comments ? `
                <div class="comments">
                  <div class="detail-label">Comments</div>
                  <div style="margin-top: 8px;">${leaveData.comments}</div>
                </div>
              ` : ''}
              
              <p style="margin-top: 30px;">
                ${recipientType === 'employee' 
                  ? 'You can view your leave details in the HRMS portal.' 
                  : 'You can view the complete leave details in the HRMS portal.'
                }
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Mechlin Technologies - HRMS</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const emailService = new MicrosoftGraphService();
    const requestData: EmailRequest = await req.json();

    if (requestData.type === 'test') {
      if (!requestData.recipient) {
        throw new Error('Recipient is required for test email');
      }

      const emailBody = emailService.generateTestEmailTemplate(requestData.recipient.name);
      
      await emailService.sendEmail(
        [requestData.recipient],
        '🧪 HRMS Email Service Test',
        emailBody,
        true
      );

      return new Response(
        JSON.stringify({ success: true, message: 'Test email sent successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else if (requestData.type === 'leave_approval') {
      if (!requestData.leaveData || !requestData.recipients) {
        throw new Error('Leave data and recipients are required for leave approval email');
      }

      const emailPromises: Promise<void>[] = [];

      // Send email to employee
      const employeeEmailBody = emailService.generateLeaveApprovalEmailTemplate(requestData.leaveData, 'employee');
      emailPromises.push(
        emailService.sendEmail(
          [requestData.recipients.employee],
          `✅ Your ${requestData.leaveData.leaveType} Request has been Approved`,
          employeeEmailBody,
          true
        )
      );

      // Send email to admins and HR
      if (requestData.recipients.adminsAndHR.length > 0) {
        const adminEmailBody = emailService.generateLeaveApprovalEmailTemplate(requestData.leaveData, 'admin_hr');
        emailPromises.push(
          emailService.sendEmail(
            requestData.recipients.adminsAndHR,
            `✅ Leave Request Approved - ${requestData.leaveData.employeeName}`,
            adminEmailBody,
            true
          )
        );
      }

      // Send email to manager if exists
      if (requestData.recipients.manager) {
        const managerEmailBody = emailService.generateLeaveApprovalEmailTemplate(requestData.leaveData, 'manager');
        emailPromises.push(
          emailService.sendEmail(
            [requestData.recipients.manager],
            `✅ Leave Request Approved - ${requestData.leaveData.employeeName}`,
            managerEmailBody,
            true
          )
        );
      }

      await Promise.all(emailPromises);

      return new Response(
        JSON.stringify({ success: true, message: 'Leave approval emails sent successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else {
      throw new Error('Invalid email type');
    }

  } catch (error) {
    console.error('Email service error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send email' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
```

---

## ✅ **After Deployment**

Once the function is deployed:

1. Go back to your HRMS app
2. Navigate to **Settings → Email Test**
3. Try sending a test email
4. The CORS error should be resolved!

---

## 🔍 **Troubleshooting**

If you still get errors after deployment:

1. **Check Function Logs**: In Supabase Dashboard → Edge Functions → send-email → Logs
2. **Verify Function URL**: Should be `https://xsrnbglsrikxpnhodiew.supabase.co/functions/v1/send-email`
3. **Test Function Directly**: Use the test interface in Supabase Dashboard

The key issue was that the function wasn't deployed yet - once it's deployed, everything should work perfectly!

