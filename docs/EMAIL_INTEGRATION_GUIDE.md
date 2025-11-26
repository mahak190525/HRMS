# Microsoft Graph Email Integration for Leave Approvals

## Overview

This integration adds email notifications to your HRMS system using Microsoft Graph API. When an employee's leave request is approved, the system will automatically send professional email notifications to all relevant stakeholders.

## Features

✅ **Automatic Email Notifications**: Emails are sent automatically when leaves are approved  
✅ **Beautiful HTML Templates**: Professional, responsive email templates with company branding  
✅ **Multiple Recipients**: Sends to employee, admins, HR, and managers  
✅ **Secure Authentication**: Uses Azure App Registration with proper permissions  
✅ **Error Handling**: Robust error handling that doesn't break the main approval flow  
✅ **Testing Interface**: Built-in testing tools for administrators  

## How It Works

### 1. Leave Approval Flow
When a leave request is approved through the HRMS interface:
1. The leave status is updated in the database
2. Database triggers create in-app notifications (existing functionality)
3. **NEW**: Email service automatically sends emails to all recipients

### 2. Email Recipients
For **approved leaves only**, emails are sent to:
- **Employee**: The person who requested the leave
- **Admins & HR**: All users with admin, super_admin, or hr roles
- **Manager**: The employee's direct manager (if different from approver)

### 3. Email Content
Each email includes:
- Professional HTML template with company branding
- Leave details (type, dates, duration, approver)
- Approval comments (if any)
- Responsive design that works on all devices

## Configuration

### Azure App Setup
The integration uses these Azure app credentials:
- **Application ID**: `3e768a01-348d-4d0a-adec-36f245ce841a`
- **Tenant ID**: `85707f27-830a-4b92-aa8c-3830bfb6c6f5`
- **Sender Email**: `hrms@mechlintech.com`
- **Permissions**: Mail.Send, User.Read

### Files Added/Modified

#### New Files:
- `src/services/emailService.ts` - Core Microsoft Graph email service
- `src/services/leaveEmailService.ts` - Leave-specific email logic
- `src/services/emailApi.ts` - API endpoints for email functionality
- `src/components/admin/EmailTestComponent.tsx` - Testing interface

#### Modified Files:
- `src/hooks/useLeaveManagement.ts` - Added email sending to approval flow
- `src/pages/dashboard/Settings.tsx` - Added email testing tab for admins
- `src/services/api.ts` - Added email service import

## Testing

### Admin Testing Interface
Administrators can test the email functionality through:
1. Go to **Settings** → **Email Test** tab (admin only)
2. **Test Basic Email**: Send a simple test email to verify connectivity
3. **Test Leave Approval Email**: Send leave approval emails using an existing approved leave application ID

### Manual Testing Steps
1. Create a test leave application
2. Approve the leave application
3. Check that emails are sent to all recipients
4. Verify email content and formatting

## Security & Permissions

### Azure Permissions Required:
- **Mail.Send**: Send emails on behalf of the organization
- **User.Read**: Read user profile information

### Access Control:
- Only admin users can access the email testing interface
- Email sending is automatic and doesn't require user intervention
- All email operations are logged for monitoring

## Error Handling

The email integration is designed to be non-blocking:
- If email sending fails, the leave approval still succeeds
- Errors are logged but don't show to end users
- Failed emails can be retried manually through the admin interface

## Monitoring

### Logs to Monitor:
- Browser console logs for email service operations
- Azure App logs for authentication issues
- Supabase logs for database trigger operations

### Common Issues:
1. **Authentication Errors**: Check Azure app credentials and permissions
2. **Email Not Received**: Verify sender email exists in Microsoft 365 tenant
3. **Missing Recipients**: Check user email addresses in database

## Future Enhancements

Potential improvements for the future:
- Email templates for other notification types (asset requests, complaints)
- Email delivery status tracking
- Customizable email templates through admin interface
- Email scheduling for different time zones
- Bulk email operations for HR announcements

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify Azure app permissions and credentials
3. Test email connectivity using the admin testing interface
4. Contact system administrator for Azure tenant issues

---

**Note**: This integration only sends emails for **approved** leave requests. All other leave statuses (pending, rejected, cancelled) continue to use only in-app notifications.

