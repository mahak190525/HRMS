# Static Email Configuration Guide

## 📧 Where to Update Static CC Emails

Static CC emails are now centralized in **one function** for easy management. Here's where to update them:

### Location: `get_static_cc_emails()` Function

The static emails are defined in the database function `get_static_cc_emails()` in the migration file:
- **File**: `supabase/migrations/20251126_02_add_static_email_config.sql`
- **Function**: `get_static_cc_emails(context text)`

## 🔧 How to Update Static Emails

### Option 1: Update via SQL (Recommended)

Run this SQL to update the function:

```sql
CREATE OR REPLACE FUNCTION get_static_cc_emails(context text DEFAULT 'default')
RETURNS jsonb AS $$
DECLARE
  static_emails jsonb;
BEGIN
  CASE context
    WHEN 'leave' THEN
      -- UPDATE THESE EMAILS FOR LEAVE NOTIFICATIONS
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'your-email@mechlintech.com', 'name', 'Your Name'),
        jsonb_build_object('email', 'another-email@mechlintech.com', 'name', 'Another Name'),
        jsonb_build_object('email', 'third-email@mechlintech.com', 'name', 'Third Name')
      );
    
    WHEN 'policy' THEN
      -- UPDATE THESE EMAILS FOR POLICY NOTIFICATIONS
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'policy-email@mechlintech.com', 'name', 'Policy Team')
      );
    
    WHEN 'payroll' THEN
      -- UPDATE THESE EMAILS FOR PAYROLL NOTIFICATIONS
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'payroll-email@mechlintech.com', 'name', 'Payroll Team')
      );
    
    WHEN 'performance' THEN
      -- UPDATE THESE EMAILS FOR PERFORMANCE NOTIFICATIONS
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'performance-email@mechlintech.com', 'name', 'Performance Team')
      );
    
    ELSE
      -- DEFAULT EMAILS (used when no specific context)
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'default-email@mechlintech.com', 'name', 'Default Team')
      );
  END CASE;
  
  RETURN static_emails;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Option 2: Update via Migration File

1. Open: `supabase/migrations/20251126_02_add_static_email_config.sql`
2. Find the `get_static_cc_emails()` function
3. Update the email addresses in the `jsonb_build_array()` calls
4. Run the migration: `supabase migration up`

## 📋 Current Static Email Configuration

### Leave Management Emails
- `awasthy.mukesh@mechlintech.com` - Mukesh Kumar
- `mechlinpeopleworkplace@mechlintech.com` - Mechlin People & Workplace
- `mechlinpayroll@mechlintech.com` - Mechlin Payroll

### Policy Management Emails
- `mechlinpeopleworkplace@mechlintech.com` - Mechlin People & Workplace

### Performance Management Emails
- `mechlinpeopleworkplace@mechlintech.com` - Mechlin People & Workplace

## 🎯 Email Contexts

Different contexts are used for different types of notifications:

| Context | Used For | Current Emails |
|---------|----------|----------------|
| `leave` | Leave approvals, rejections, submissions | 3 emails (Mukesh, People & Workplace, Payroll) |
| `policy` | Policy assignments, acknowledgments | 1 email (People & Workplace) |
| `payroll` | Payslip generation, salary processing | 2 emails (Payroll, Mukesh) |
| `performance` | KRA assignments, reviews | 1 email (People & Workplace) |
| `hr` | General HR notifications | 1 email (People & Workplace) |
| `default` | Fallback for unspecified contexts | 1 email (People & Workplace) |

## ➕ Adding New Static Emails

To add a new static email, simply add another `jsonb_build_object()` to the array:

```sql
static_emails := jsonb_build_array(
  jsonb_build_object('email', 'existing@mechlintech.com', 'name', 'Existing Name'),
  jsonb_build_object('email', 'new@mechlintech.com', 'name', 'New Name')  -- Add this line
);
```

## ➖ Removing Static Emails

To remove a static email, simply delete its `jsonb_build_object()` line from the array.

## 🔄 Adding New Contexts

To add a new context (e.g., for a new module):

```sql
WHEN 'new_module' THEN
  static_emails := jsonb_build_array(
    jsonb_build_object('email', 'new-module@mechlintech.com', 'name', 'New Module Team')
  );
```

Then use it in your email queueing function:

```sql
'cc_static', get_static_cc_emails('new_module')
```

## ✅ Testing Changes

After updating static emails, test by:

1. **Queue a test email:**
```sql
SELECT send_leave_email_notification_generic(
  'your-leave-application-id'::uuid,
  'leave_approved'::email_type_enum
);
```

2. **Check the queue:**
```sql
SELECT recipients->'cc_static' 
FROM email_queue 
WHERE id = 'your-email-id';
```

3. **Process the queue** (via Edge Function or manually)

## 📝 Notes

- ✅ All static emails are now centralized in one function
- ✅ Easy to update - change in one place, applies everywhere
- ✅ Context-based - different emails for different modules
- ✅ No code changes needed - just update the database function
- ✅ Changes take effect immediately after updating the function

## 🚀 Quick Update Example

To quickly update leave management static emails:

```sql
-- Update leave static emails
CREATE OR REPLACE FUNCTION get_static_cc_emails(context text DEFAULT 'default')
RETURNS jsonb AS $$
BEGIN
  CASE context
    WHEN 'leave' THEN
      RETURN jsonb_build_array(
        jsonb_build_object('email', 'new-email@mechlintech.com', 'name', 'New Name')
        -- Add or remove emails here
      );
    -- ... other contexts remain the same
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

That's it! All leave emails will now use the new static CC configuration. 🎉
