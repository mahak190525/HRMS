# Asset Request Notification System

## Overview

The Asset Request Notification System automatically sends notifications to the appropriate users when asset requests are submitted, approved, rejected, or fulfilled. This ensures all stakeholders are informed of asset request status changes and can take appropriate actions.

## Notification Flow

### 1. Asset Request Submission
When a user submits an asset request:

**Recipients:**
- **Manager**: User's direct manager (if assigned)
- **HR Team**: All users with 'hr' role
- **Admin**: All users with 'admin' or 'super_admin' roles

**Notification Content:**
- **For Managers**: "Asset Request Requires Approval" - includes approval/rejection actions
- **For HR/Admin**: "New Asset Request Submitted" - informational with monitoring actions

### 2. Asset Request Approval
When a manager or admin approves an asset request:

**Recipients:**
- **Original Requester**: User who submitted the request
- **HR Team**: For fulfillment purposes (excluding the approver)
- **Admin Team**: For visibility (excluding the approver)

**Notification Content:**
- **For Requester**: "Asset Request Approved" with approver details
- **For HR/Admin**: "Asset Request Approved - Ready for Fulfillment"

### 3. Asset Request Rejection
When a manager or admin rejects an asset request:

**Recipients:**
- **Original Requester**: User who submitted the request

**Notification Content:**
- "Asset Request Rejected" with rejector details and reason (if provided)

### 4. Asset Request Fulfillment
When HR fulfills an approved asset request:

**Recipients:**
- **Original Requester**: User who submitted the request

**Notification Content:**
- "Asset Request Fulfilled" confirming asset has been assigned

## Technical Implementation

### Database Components

#### 1. Migration: `20250911_12_asset_request_notifications.sql`
- Adds asset notification types to the notifications constraint
- Creates functions for notification recipient resolution
- Implements database triggers for automatic notifications

#### 2. Key Functions
- `get_asset_request_notification_recipients()`: Identifies who should receive notifications
- `notify_asset_request_submitted()`: Handles new request notifications  
- `notify_asset_request_status_change()`: Handles status change notifications

#### 3. Database Triggers
- `trigger_asset_request_submitted`: Fires on INSERT to asset_requests
- `trigger_asset_request_status_change`: Fires on UPDATE to asset_requests

### API Updates

#### 1. Asset API (`src/services/api.ts`)
- **createAssetRequest()**: Enhanced to include manager_id in user selection
- **updateAssetRequest()**: Automatically adds timestamps for status changes
- Notifications are handled by database triggers (no additional API calls needed)

#### 2. Notification API (`src/services/notificationApi.ts`)
- **createAssetRequestNotification()**: Helper for creating bulk notifications
- **createAssetStatusNotification()**: Helper for status change notifications

### Frontend Components

#### 1. Notification URL Routing (`src/supabase/functions/send-push-notification/index.ts`)
- `asset_request_submitted`: Routes to `/employees/asset-management`
- `asset_request_approved|rejected|fulfilled`: Routes to `/dashboard/assets`

#### 2. Debug Component (`src/components/debug/AssetNotificationTest.tsx`)
- Complete testing interface for asset notification workflow
- Allows testing of all notification scenarios
- Phase-by-phase workflow visualization

## Permission System

### Who Can Approve Asset Requests?
- **Managers**: Direct managers of the requesting user
- **Admin/Super Admin**: Users with admin or super_admin roles

### Who Receives Notifications?
- **Request Submission**: Manager, HR, Admin
- **Approval**: Requester, HR, Admin (excluding approver)
- **Rejection**: Requester only
- **Fulfillment**: Requester only

## Notification Types

| Type | Description | Recipients | Actions |
|------|-------------|------------|---------|
| `asset_request_submitted` | New request submitted | Manager, HR, Admin | Approve/Reject (Manager/Admin), Monitor (HR) |
| `asset_request_approved` | Request approved | Requester, HR, Admin | View details, Fulfill (HR) |
| `asset_request_rejected` | Request rejected | Requester | View details, Resubmit |
| `asset_request_fulfilled` | Request fulfilled | Requester | View assigned asset |

## Testing the System

### Using the Debug Component
1. Navigate to Asset Management page (the debug component is temporarily added)
2. Use the "Asset Request Notification System Test" component
3. Follow the 4-phase workflow:
   - **Phase 1**: Create asset request
   - **Phase 2**: Approve or reject request  
   - **Phase 3**: Fulfill approved request
   - **Phase 4**: Reset for new test

### Manual Testing Steps
1. **Create Request**: Submit asset request as regular user
2. **Check Notifications**: Verify manager, HR, and admin receive notifications
3. **Approve/Reject**: Have manager approve or reject the request
4. **Check Status Notifications**: Verify requester receives status notification
5. **Fulfill Request**: Have HR fulfill approved request
6. **Final Notification**: Verify requester receives fulfillment notification

## Database Schema Updates

### Notification Types Added
```sql
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'general', 'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
  'complaint_submitted', 'complaint_assigned', 'complaint_resolved',
  'asset_request_submitted', 'asset_request_approved', 'asset_request_rejected', 'asset_request_fulfilled'
));
```

### Asset Request Table
The existing asset_requests table already includes notification tracking columns:
- `manager_notified`, `hr_notified`, `admin_notified`
- `approval_notification_sent`

These can be used for additional notification state tracking if needed.

## Security Considerations

### Row Level Security (RLS)
- Notifications use existing RLS policies
- Users can only see their own notifications
- HR/Admin/Managers can create notifications through the system functions

### Data Privacy
- Notification content includes minimal sensitive information
- Full request details are accessible only through proper UI permissions
- Manager isolation ensures managers only see their team's requests

## Performance Considerations

### Database Triggers
- Triggers are lightweight and execute asynchronously
- Failed notifications don't block the main request operation
- Push notifications are handled by separate edge functions

### Notification Batching
- Multiple recipients are handled efficiently in single function calls
- Database functions minimize round trips
- Push notifications are sent asynchronously

## Monitoring and Troubleshooting

### Logs to Monitor
- Database trigger execution logs
- Notification creation success/failure
- Push notification delivery status

### Common Issues
1. **Missing Manager**: If user has no manager_id, only HR/Admin get notifications
2. **Role Permissions**: Ensure users have correct roles for notification policies
3. **Push Subscriptions**: Users need active push subscriptions for browser notifications

### Debug Queries
```sql
-- Check recent asset request notifications
SELECT n.*, u.full_name as recipient_name
FROM notifications n
JOIN users u ON n.user_id = u.id  
WHERE n.type LIKE 'asset_request_%'
ORDER BY n.created_at DESC;

-- Check asset request notification recipients for a user
SELECT * FROM get_asset_request_notification_recipients('user-id-here');
```

## Future Enhancements

### Potential Improvements
1. **Email Notifications**: Add email notifications for critical asset requests
2. **Escalation**: Auto-escalate requests that remain pending too long
3. **Batch Processing**: Group multiple requests in digest notifications
4. **Custom Rules**: Allow departments to configure custom notification rules
5. **Analytics**: Track notification effectiveness and response times

### Integration Points
- Integration with external asset management systems
- LDAP/AD integration for manager hierarchy
- SMS notifications for urgent requests
- Slack/Teams integration for team notifications

## Conclusion

The Asset Request Notification System provides comprehensive coverage of the asset request lifecycle, ensuring all stakeholders are informed at the right time with the appropriate level of detail and action capabilities. The system is built on robust database triggers for reliability and includes comprehensive testing tools for validation.
