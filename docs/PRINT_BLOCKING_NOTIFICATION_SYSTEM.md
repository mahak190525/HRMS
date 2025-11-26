# Print Blocking Notification System

## Overview

The HRMS application includes a comprehensive print blocking and notification system that automatically sends alerts to relevant personnel whenever an employee attempts to perform blocked actions (printing, screenshots, developer tools access, etc.).

## How It Works

### 1. Frontend Detection
When a user attempts a blocked action:
- JavaScript event listeners in `src/utils/printBlocker.ts` detect the action
- The action is prevented from executing
- A toast notification is shown to the user
- The attempt is logged to the database via the `log_print_blocking_attempt` RPC function

### 2. Database Logging
The `log_print_blocking_attempt` function:
- Inserts a record into the `print_blocking_logs` table
- Captures user details, action type, timestamp, and context
- Triggers the notification system automatically

### 3. Automatic Notifications
A PostgreSQL trigger (`trigger_notify_print_blocking`) automatically:
- Sends a notification to the employee who attempted the action
- Sends security alerts to all HR users
- Sends security alerts to all admin and super admin users  
- Sends an alert to the employee's direct manager (if assigned)

## Notification Recipients

### Employee Notification
- **Title:** "Action Blocked"
- **Message:** "Your attempt to [action] was blocked for security reasons."
- **Type:** `security`
- **Purpose:** Inform the user that their action was blocked

### Manager Notification  
- **Title:** "Security Alert: Print Blocking Attempt"
- **Message:** "[Employee Name] attempted to [action] on [date/time] IST (Your Team Member)"
- **Type:** `security`
- **Purpose:** Alert managers about their team members' security-related activities

### HR/Admin Notifications
- **Title:** "Security Alert: Print Blocking Attempt"  
- **Message:** "[Employee Name] attempted to [action] on [date/time] IST"
- **Type:** `security`
- **Purpose:** Alert security personnel about potential policy violations

## Blocked Actions

The system blocks and logs the following actions:

### Keyboard Shortcuts
- **Ctrl+P / Cmd+P** - Print dialog
- **Ctrl+S / Cmd+S** - Save page  
- **Print Screen** - Screenshot
- **F12** - Developer Tools
- **Ctrl+Shift+I / Cmd+Shift+I** - Developer Tools
- **Ctrl+Shift+J / Cmd+Shift+J** - Console
- **Ctrl+U / Cmd+U** - View Source
- **Ctrl+C/V/A/X** - Copy/Paste (outside input fields)
- **Windows+Shift+S** - Windows Snipping Tool
- **Cmd+Shift+3/4** - Mac Screenshots

### Other Actions
- **Right-click context menu** - Disabled
- **Text selection** - Disabled (except in input fields)
- **Browser print events** - Blocked

## Database Schema

### print_blocking_logs Table
```sql
CREATE TABLE print_blocking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  user_name TEXT,
  action_type TEXT NOT NULL, -- 'print', 'save', 'screenshot', etc.
  action_description TEXT NOT NULL,
  key_combination TEXT,
  user_agent TEXT,
  ip_address INET,
  page_url TEXT,
  session_id TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  additional_data JSONB
);
```

### notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);
```

## Configuration

### Environment Variables
- `VITE_ENABLE_PRINT_BLOCKING=true` - Enable print blocking (default: enabled)
- `VITE_ENABLE_PRINT_BLOCKING=false` - Disable print blocking for development

### Database Functions

#### log_print_blocking_attempt()
```sql
SELECT log_print_blocking_attempt(
  p_user_id UUID,
  p_action_type TEXT,
  p_action_description TEXT,
  p_key_combination TEXT DEFAULT NULL,
  p_page_url TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_additional_data JSONB DEFAULT NULL
);
```

#### notify_print_blocking_attempt()
Trigger function that automatically creates notifications for:
- The employee who attempted the action
- All HR users (`role.name = 'hr'`)
- All admin users (`role.name IN ('admin', 'super_admin')`)
- The employee's manager (`users.manager_id`)

## Testing

### Frontend Testing
Access the print blocking test suite:
1. Navigate to **Settings → Security**
2. Use the "Print Blocking Test Suite" to test various blocked actions
3. Verify that toast notifications appear for each blocked action
4. Check that database logs are created

### Database Testing
Run the test script:
```sql
-- Execute the test script
\i test_print_blocking_notifications.sql
```

This will:
- Create test print blocking log entries
- Verify notifications are sent to all recipients
- Test different action types
- Provide detailed logging output

### Manual Testing
1. **Enable print blocking** (ensure `VITE_ENABLE_PRINT_BLOCKING` is not set to `false`)
2. **Attempt blocked actions:**
   - Press Ctrl+P to try printing
   - Press F12 to try opening DevTools
   - Right-click to try accessing context menu
   - Press Ctrl+C to try copying (outside input fields)
3. **Verify notifications:**
   - Check the notifications page for security alerts
   - Verify HR/Admin users receive notifications
   - Verify managers receive notifications for their team members

## Monitoring

### Print Blocking Logs Dashboard
Access via **Employee Management → Security Logs** (admin/HR only):
- View all print blocking attempts
- Filter by action type, user, or date range
- Export logs to CSV
- Monitor security metrics and trends

### Notification Monitoring
- Check the notifications table for `type = 'security'`
- Monitor notification delivery rates
- Track which users are attempting blocked actions most frequently

## Security Considerations

### Client-Side Limitations
This is a client-side implementation and should not be the sole security measure:
- Users can disable JavaScript
- Browser extensions can bypass restrictions
- External screenshot tools still work
- Determined users can find workarounds

### Recommended Additional Measures
- Server-side access controls
- Session monitoring
- Watermarking sensitive content
- Network-level restrictions
- Regular security audits

## Troubleshooting

### Notifications Not Being Sent

1. **Check notification type constraint:**
   ```sql
   -- Verify 'security' type is allowed
   SELECT constraint_name, check_clause 
   FROM information_schema.check_constraints 
   WHERE table_name = 'notifications';
   ```

2. **Check trigger exists:**
   ```sql
   SELECT tgname, tgenabled 
   FROM pg_trigger 
   WHERE tgrelid = 'print_blocking_logs'::regclass;
   ```

3. **Check RLS policies:**
   ```sql
   SELECT policyname, cmd, permissive 
   FROM pg_policies 
   WHERE tablename = 'notifications';
   ```

4. **Test trigger manually:**
   ```sql
   -- Insert test log entry
   INSERT INTO print_blocking_logs (user_id, action_type, action_description)
   VALUES ('your-user-id', 'print', 'Test print attempt');
   ```

### Print Blocking Not Working

1. **Check environment variable:**
   ```javascript
   console.log('Print blocking enabled:', import.meta.env.VITE_ENABLE_PRINT_BLOCKING !== 'false');
   ```

2. **Verify event listeners:**
   - Open browser DevTools (if not blocked)
   - Check console for print blocker initialization messages
   - Verify no JavaScript errors

3. **Test individual functions:**
   - Use the Print Blocking Test Suite in Settings → Security
   - Check each action type individually

## Migration Files

The system is implemented through these migration files:
1. `20251027_01_create_print_blocking_logs.sql` - Core tables and functions
2. `20251027_02_add_security_notification_type.sql` - Add 'security' notification type
3. `20251027_03_fix_print_blocking_notifications.sql` - Fix RLS policies and trigger

## API Integration

### Frontend Usage
```typescript
import { blockPrinting, initializePrintBlocking } from '@/utils/printBlocker';

// Initialize print blocking
useEffect(() => {
  const cleanup = blockPrinting();
  initializePrintBlocking();
  
  return cleanup;
}, []);
```

### Database Integration
The system automatically integrates with your existing user management:
- Uses `users` table for employee data
- Uses `roles` table to identify HR/Admin users
- Uses `manager_id` field for manager notifications
- Respects user `status = 'active'` for notification recipients

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review database logs for error messages
3. Test with the provided test scripts
4. Verify environment configuration
5. Check browser console for JavaScript errors
