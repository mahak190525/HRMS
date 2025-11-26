# Frontend Email Queue System Updates

## Summary of Changes

The frontend has been updated to work with the new generic email queue system. All references to the old `leave_application_id` column and old recipient structure have been removed.

## Files Updated

### 1. `src/services/emailQueueService.ts`

**Changes:**
- ✅ Updated `QueuedEmail` interface to match new database structure:
  - Removed `leave_application_id` field
  - Updated `recipients` structure to use `to`, `cc_static`, and `cc_dynamic_resolved`
  - Updated `email_data` field names to match database (snake_case)
  
- ✅ Fixed `process_email_queue()` function call:
  - Now explicitly passes `p_limit: 10` and `p_status: 'pending'` to avoid PostgREST overloading issues
  
- ✅ Updated email processing logic:
  - Maps new email types (`leave_approved`, `leave_submitted`, etc.) instead of old ones
  - Converts new recipient structure to format expected by `emailService`
  - Handles both static and dynamic CC recipients

- ✅ Updated `mark_email_processed()` call:
  - Now includes `p_error_details` parameter

### 2. `src/services/emailApi.ts`

**Changes:**
- ✅ Updated `sendLeaveEmail()` function:
  - Changed from `send_leave_email_notification` to `send_leave_email_notification_generic`
  - Added email type mapping for backward compatibility:
    - `leave_approval` → `leave_approved`
    - `leave_submission` → `leave_submitted`
    - `leave_rejection` → `leave_rejected`
    - `leave_withdrawal` → `leave_withdrawn`

## Key Differences: Old vs New

### Old Structure
```typescript
{
  leave_application_id: string;
  recipients: {
    employee: { email, name };
    adminsAndHR: Array<{ email, name }>;
    manager?: { email, name };
  };
  leave_data: {
    employeeName: string;
    // ...
  };
}
```

### New Structure
```typescript
{
  module_type: string;
  reference_id: string;
  recipients: {
    to: Array<{ email, name }>;
    cc_static?: Array<{ email, name }>;
    cc_dynamic_resolved?: Array<{ email, name }>;
  };
  email_data: {
    employee_name: string; // snake_case
    // ...
  };
}
```

## Email Type Mapping

| Old Type | New Type |
|----------|----------|
| `leave_approval` | `leave_approved` |
| `leave_submission` | `leave_submitted` |
| `leave_rejection` | `leave_rejected` |
| `leave_withdrawal` | `leave_withdrawn` |
| `policy_assignment` | `policy_assigned` |
| `policy_acknowledgment` | `policy_acknowledged` |

## Function Calls Updated

### Before
```typescript
await supabase.rpc('process_email_queue');
await supabase.rpc('send_leave_email_notification', {
  p_leave_application_id: id,
  p_email_type: 'leave_approval'
});
```

### After
```typescript
await supabase.rpc('process_email_queue', {
  p_limit: 10,
  p_status: 'pending'
});
await supabase.rpc('send_leave_email_notification_generic', {
  p_leave_application_id: id,
  p_email_type: 'leave_approved'
});
```

## Testing Checklist

- [ ] Test leave application creation (should queue email automatically)
- [ ] Test leave approval (should queue email automatically)
- [ ] Test leave rejection (should queue email automatically)
- [ ] Test leave withdrawal (should queue email automatically)
- [ ] Test email queue processing (should process pending emails)
- [ ] Test policy assignment emails
- [ ] Test policy acknowledgment emails
- [ ] Verify emails are sent with correct recipients (TO, CC static, CC dynamic)

## Notes

- The frontend now works with the new generic email queue system
- All email types are automatically mapped to the new format
- Recipients are properly converted from the new structure to the format expected by `emailService`
- The queue processing now handles multiple modules (leave, policy, performance, etc.)

## Troubleshooting

If you see errors about `leave_application_id`:
- Make sure the database migrations have been run
- Check that old triggers/functions have been replaced
- Verify the `email_queue` table has the new structure

If you see function overloading errors:
- The frontend now explicitly passes all parameters
- Make sure the database function `process_email_queue` accepts the parameters correctly
