# How to Update Your Edge Function for the New Email Queue System

## Option 1: Replace the Existing Function (Recommended)

1. **Backup your current function:**
   ```bash
   cp supabase/functions/send-email/index.ts supabase/functions/send-email/index-backup.ts
   ```

2. **Replace with the updated version:**
   ```bash
   cp supabase/functions/send-email/index-updated.ts supabase/functions/send-email/index.ts
   ```

3. **Deploy the updated function:**
   ```bash
   supabase functions deploy send-email
   ```

## Option 2: Create a New Function (Alternative)

1. **Create a new function for queue processing:**
   ```bash
   supabase functions new process-email-queue
   ```

2. **Copy the updated code to the new function:**
   ```bash
   cp supabase/functions/send-email/index-updated.ts supabase/functions/process-email-queue/index.ts
   ```

3. **Deploy the new function:**
   ```bash
   supabase functions deploy process-email-queue
   ```

## Key Changes in the Updated Function

### 1. New Queue Processing Endpoint
- **URL**: `https://your-project.supabase.co/functions/v1/send-email/process-queue`
- **Method**: POST
- **Body**: `{}` (empty JSON object)

### 2. Automatic Email Template Generation
The function now automatically generates email templates based on the `email_type`:
- `leave_approved` → Leave approval template
- `leave_rejected` → Leave rejection template  
- `policy_assigned` → Policy assignment template
- `kra_assigned` → KRA assignment template
- `payslip_generated` → Payslip template
- And more...

### 3. Dynamic CC Resolution
The function now handles the resolved dynamic CC recipients from the database:
- Static CC emails from `cc_static`
- Dynamically resolved emails from `cc_dynamic_resolved`

## How to Use the New System

### 1. Automatic Processing (Recommended)
Set up a cron job or scheduled task to call the queue processing endpoint:

```bash
# Call every 5 minutes
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://your-project.supabase.co/functions/v1/send-email/process-queue"
```

### 2. Manual Processing
You can also call the endpoint manually or from your frontend:

```typescript
// From your frontend or backend
const response = await fetch(`${supabaseUrl}/functions/v1/send-email/process-queue`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
});

const result = await response.json();
console.log('Processed emails:', result);
```

### 3. Queue Emails from Your Application
Use the new database functions to queue emails:

```typescript
// Queue a leave approval email
await supabase.rpc('send_leave_email_notification_generic', {
  p_leave_application_id: leaveId,
  p_email_type: 'leave_approved'
});

// Queue a policy assignment email
await supabase.rpc('queue_policy_assignment_email', {
  p_policy_assignment_id: assignmentId,
  p_user_id: userId,
  p_assigned_by: assignerId,
  p_policy_names: ['Policy 1', 'Policy 2']
});
```

## Testing the New System

### 1. Test the Queue Processing
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://your-project.supabase.co/functions/v1/send-email/process-queue"
```

### 2. Test Email Queueing
```sql
-- Queue a test email
SELECT queue_email(
  'leave_management'::module_type_enum,
  gen_random_uuid(),
  'leave_approved'::email_type_enum,
  jsonb_build_object(
    'to', jsonb_build_array(
      jsonb_build_object('email', 'test@example.com', 'name', 'Test User')
    ),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'hr@company.com', 'name', 'HR Team')
    )
  ),
  jsonb_build_object(
    'employee_name', 'Test User',
    'leave_type', 'Annual Leave',
    'start_date', '2024-01-15',
    'end_date', '2024-01-19',
    'days_count', 5
  ),
  'Test Leave Approval Email'
);
```

## Monitoring

### Check Queue Status
```sql
-- View pending emails
SELECT * FROM email_queue WHERE status = 'pending';

-- View processing status
SELECT 
  status, 
  COUNT(*) as count 
FROM email_queue 
GROUP BY status;
```

### Check Function Logs
```bash
supabase functions logs send-email
```

## Backward Compatibility

The updated function maintains backward compatibility with your existing direct email calls. However, it's recommended to migrate to the new queue-based system for better reliability and scalability.

## Next Steps

1. Deploy the updated function
2. Test with a few emails
3. Set up automated queue processing (cron job)
4. Gradually migrate existing email calls to use the queue system
5. Monitor the queue and function logs

The new system provides much better reliability, retry mechanisms, and scalability for your email notifications! 🎉
