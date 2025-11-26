# Generic Email Queue System - Usage Guide

## Overview

The new generic email queue system provides a comprehensive, future-proof solution for handling email notifications across all HRMS modules. It supports:

- ✅ **Universal Module Support**: Any module can use the system (leave, performance, policy, payroll, etc.)
- ✅ **Multiple Recipients**: TO, static CC, and dynamic CC recipients
- ✅ **Dynamic CC Resolution**: Automatically resolves manager emails, role-based emails, team members
- ✅ **Priority-based Processing**: Urgent, high, normal, low priority emails
- ✅ **Retry Mechanism**: Automatic retry with exponential backoff for failed emails
- ✅ **Audit Trail**: Complete tracking of email processing

## Table Structure

### Core Email Queue Table

```sql
email_queue (
  id uuid PRIMARY KEY,
  module_type module_type_enum NOT NULL,     -- Which module (leave_management, policy_management, etc.)
  reference_id uuid NOT NULL,               -- ID of the record in that module
  email_type email_type_enum NOT NULL,      -- Type of email (leave_approved, policy_assigned, etc.)
  subject text,                             -- Email subject
  priority email_priority_enum DEFAULT 'normal',
  recipients jsonb NOT NULL,                -- Recipient structure (see below)
  email_data jsonb NOT NULL,                -- Data for email template
  status email_status_enum DEFAULT 'pending',
  scheduled_at timestamptz DEFAULT now(),
  retry_count integer DEFAULT 0,
  error_message text,
  created_by uuid
)
```

### Recipients Structure

The `recipients` JSONB field supports multiple recipient types:

```json
{
  "to": [
    {"email": "employee@company.com", "name": "Employee Name"}
  ],
  "cc_static": [
    {"email": "hr@company.com", "name": "HR Team"},
    {"email": "payroll@company.com", "name": "Payroll Team"}
  ],
  "cc_dynamic": ["manager", "hr", "admin", "team_members"]
}
```

**Dynamic CC Types:**
- `manager` - Employee's direct manager
- `hr` - All HR role users
- `admin` - All admin/super_admin users  
- `finance` - All finance role users
- `team_members` - All team members under a manager

## Usage Examples

### 1. Leave Management

#### Queue Leave Approval Email
```sql
-- When a leave is approved
SELECT queue_email(
  'leave_management'::module_type_enum,
  '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- leave_application_id
  'leave_approved'::email_type_enum,
  jsonb_build_object(
    'to', jsonb_build_array(
      jsonb_build_object('email', 'john.doe@company.com', 'name', 'John Doe')
    ),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
      jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace'),
      jsonb_build_object('email', 'mechlinpayroll@mechlintech.com', 'name', 'Mechlin Payroll')
    ),
    'cc_dynamic', jsonb_build_array('manager')
  ),
  jsonb_build_object(
    'user_id', '123e4567-e89b-12d3-a456-426614174000',
    'employee_name', 'John Doe',
    'employee_email', 'john.doe@company.com',
    'leave_type', 'Annual Leave',
    'start_date', '2024-01-15',
    'end_date', '2024-01-19',
    'days_count', 5,
    'approver_name', 'Jane Manager',
    'approver_title', 'Jane Manager (HR Manager)',
    'comments', 'Approved for vacation'
  ),
  'Your leave request has been Approved',
  'normal'::email_priority_enum
);
```

#### Using the Helper Function
```sql
-- Simplified leave email queueing
SELECT send_leave_email_notification_generic(
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  'leave_approved'::email_type_enum
);
```

### 2. Policy Management

#### Queue Policy Assignment Email
```sql
SELECT queue_policy_assignment_email(
  '456e7890-e89b-12d3-a456-426614174000'::uuid,  -- policy_assignment_id
  '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- user_id
  '789e0123-e89b-12d3-a456-426614174000'::uuid,  -- assigned_by
  ARRAY['Code of Conduct', 'Data Privacy Policy']  -- policy_names
);
```

#### Manual Policy Email Queue
```sql
SELECT queue_email(
  'policy_management'::module_type_enum,
  '456e7890-e89b-12d3-a456-426614174000'::uuid,
  'policy_assigned'::email_type_enum,
  jsonb_build_object(
    'to', jsonb_build_array(
      jsonb_build_object('email', 'employee@company.com', 'name', 'Employee Name')
    ),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
    ),
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  ),
  jsonb_build_object(
    'user_id', '123e4567-e89b-12d3-a456-426614174000',
    'employee_name', 'Employee Name',
    'employee_email', 'employee@company.com',
    'assigned_by_name', 'HR Manager',
    'policy_names', jsonb_build_array('Code of Conduct', 'Data Privacy Policy'),
    'policy_count', 2,
    'assigned_at', now()
  ),
  'Policy Assignment - Action Required'
);
```

### 3. Performance Management

#### Queue KRA Assignment Email
```sql
SELECT queue_kra_assignment_email(
  '789e0123-e89b-12d3-a456-426614174000'::uuid,  -- kra_id
  '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- employee_id
  '456e7890-e89b-12d3-a456-426614174000'::uuid   -- manager_id
);
```

### 4. Payroll Module Example

```sql
-- Queue payslip generation email
SELECT queue_email(
  'payroll'::module_type_enum,
  '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- payslip_id
  'payslip_generated'::email_type_enum,
  jsonb_build_object(
    'to', jsonb_build_array(
      jsonb_build_object('email', 'employee@company.com', 'name', 'Employee Name')
    ),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'mechlinpayroll@mechlintech.com', 'name', 'Mechlin Payroll')
    ),
    'cc_dynamic', jsonb_build_array('finance')
  ),
  jsonb_build_object(
    'user_id', '123e4567-e89b-12d3-a456-426614174000',
    'employee_name', 'Employee Name',
    'employee_email', 'employee@company.com',
    'pay_period', 'November 2024',
    'gross_salary', 50000,
    'net_salary', 42000,
    'payslip_url', 'https://hrms.company.com/payslips/123'
  ),
  'Your payslip for November 2024 is ready',
  'high'::email_priority_enum
);
```

### 5. Training Module Example

```sql
-- Queue training assignment email
SELECT queue_email(
  'training'::module_type_enum,
  '456e7890-e89b-12d3-a456-426614174000'::uuid,  -- training_assignment_id
  'training_assigned'::email_type_enum,
  jsonb_build_object(
    'to', jsonb_build_array(
      jsonb_build_object('email', 'employee@company.com', 'name', 'Employee Name')
    ),
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  ),
  jsonb_build_object(
    'user_id', '123e4567-e89b-12d3-a456-426614174000',
    'employee_name', 'Employee Name',
    'training_title', 'Cybersecurity Awareness',
    'training_duration', '2 hours',
    'deadline', '2024-12-31',
    'training_url', 'https://training.company.com/cyber-security'
  ),
  'New Training Assignment - Cybersecurity Awareness',
  'normal'::email_priority_enum
);
```

## Processing Emails

### Frontend/Edge Function Processing

```typescript
// In your Edge Function or frontend processing
const { data: emailsToProcess } = await supabase.rpc('process_email_queue', {
  p_limit: 10,
  p_status: 'pending'
});

for (const email of emailsToProcess) {
  try {
    // Send email using your email service (Microsoft Graph, etc.)
    await sendEmail({
      to: email.recipients.to,
      cc: [
        ...(email.recipients.cc_static || []),
        ...(email.recipients.cc_dynamic_resolved || [])
      ],
      subject: email.subject,
      body: generateEmailTemplate(email.email_type, email.email_data),
      isHtml: true
    });
    
    // Mark as successfully sent
    await supabase.rpc('mark_email_processed', {
      p_queue_id: email.queue_id,
      p_success: true
    });
    
  } catch (error) {
    // Mark as failed (will retry automatically if retries available)
    await supabase.rpc('mark_email_processed', {
      p_queue_id: email.queue_id,
      p_success: false,
      p_error_message: error.message,
      p_error_details: { stack: error.stack }
    });
  }
}
```

### Manual Processing Query

```sql
-- Get pending emails to process
SELECT * FROM process_email_queue(10, 'pending');

-- Mark an email as successfully sent
SELECT mark_email_processed(
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  true
);

-- Mark an email as failed
SELECT mark_email_processed(
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  false,
  'SMTP connection failed',
  '{"error_code": "SMTP_ERROR", "details": "Connection timeout"}'::jsonb
);
```

## Monitoring and Management

### Queue Status Overview

```sql
-- View email queue summary
SELECT * FROM email_queue_summary;

-- Check failed emails
SELECT * FROM failed_emails;

-- Get emails by status
SELECT module_type, email_type, COUNT(*) 
FROM email_queue 
WHERE status = 'pending' 
GROUP BY module_type, email_type;
```

### Retry Failed Emails

```sql
-- Reset failed emails for retry (manual intervention)
UPDATE email_queue 
SET 
  status = 'pending',
  retry_count = 0,
  scheduled_at = now(),
  error_message = NULL,
  error_details = NULL
WHERE status = 'failed' 
  AND created_at > now() - INTERVAL '1 day';
```

### Cancel Emails

```sql
-- Cancel pending emails for a specific reference
UPDATE email_queue 
SET status = 'cancelled', updated_at = now()
WHERE module_type = 'leave_management' 
  AND reference_id = '123e4567-e89b-12d3-a456-426614174000'
  AND status = 'pending';
```

## Adding New Modules

### 1. Add Module Type

```sql
-- Add new module to enum
ALTER TYPE module_type_enum ADD VALUE 'new_module_name';
```

### 2. Add Email Types

```sql
-- Add new email types for the module
ALTER TYPE email_type_enum ADD VALUE 'new_email_type';
```

### 3. Create Helper Function

```sql
CREATE OR REPLACE FUNCTION queue_new_module_email(
  p_record_id uuid,
  p_user_id uuid,
  -- other parameters
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  email_id uuid;
BEGIN
  -- Prepare email data
  email_data := jsonb_build_object(
    'user_id', p_user_id,
    -- other data fields
  );

  -- Prepare recipients
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(/* employee data */),
    'cc_static', jsonb_build_array(/* static emails */),
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  );

  -- Queue the email
  email_id := queue_email(
    'new_module_name'::module_type_enum,
    p_record_id,
    'new_email_type'::email_type_enum,
    recipients_data,
    email_data,
    'Email Subject',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Best Practices

### 1. Email Data Structure

Always include these fields in `email_data`:
- `user_id` - For dynamic CC resolution
- `employee_name` and `employee_email` - For templates
- Module-specific data for email templates

### 2. Recipients Structure

- Use `to` for primary recipients
- Use `cc_static` for fixed CC emails (HR, payroll, etc.)
- Use `cc_dynamic` for computed CC emails (manager, roles)

### 3. Error Handling

- The system automatically retries failed emails
- Use meaningful error messages for debugging
- Monitor the `failed_emails` view regularly

### 4. Performance

- Process emails in batches using `process_email_queue()`
- Use appropriate priority levels
- Clean up old processed emails periodically

### 5. Security

- All functions use `SECURITY DEFINER`
- RLS policies protect email data
- Only service role can process and mark emails

## Migration from Old System

The new system maintains backward compatibility with the existing leave management system. The old `email_queue` table structure is replaced, but the trigger functions are updated to use the new generic system.

### Key Changes:
1. `leave_application_id` → `reference_id` with `module_type = 'leave_management'`
2. Recipients structure enhanced with dynamic CC support
3. New retry mechanism with exponential backoff
4. Enhanced error handling and logging

The migration automatically updates the leave management triggers to use the new system while maintaining all existing functionality.
