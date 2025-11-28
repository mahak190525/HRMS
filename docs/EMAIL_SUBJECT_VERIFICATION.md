# 📧 Email Subject Verification Guide

## ✅ **Correct Understanding**

You are absolutely right! The email subject is controlled by:

1. **Database Queue**: `email_queue.subject` field
2. **Email Sending Function**: `queuedEmail.subject` parameter
3. **NOT the HTML `<title>` tag**

## 🔍 **How Email Subjects Work**

### **Email Flow:**
```
1. KRA Event Occurs (Assignment/Submission/Evaluation)
   ↓
2. Database Trigger Fires
   ↓
3. queue_kra_*_email() Function Called
   ↓
4. Subject Generated: 'KRA Assignment - ' || employee_name || ' - Action Required'
   ↓
5. Email Queued with Dynamic Subject
   ↓
6. Edge Function Processes Queue
   ↓
7. sendEmail() Called with queuedEmail.subject
   ↓
8. Email Sent with Correct Subject
```

### **Database Subject Generation (FIXED):**
```sql
-- KRA Assignment
'KRA Assignment - ' || email_data->>'employee_name' || ' - Action Required'

-- KRA Submission  
'KRA Submission - ' || email_data->>'employee_name' || ' - Action Required'

-- KRA Evaluation
'KRA Evaluation Completed - ' || email_data->>'employee_name' || ' - Action Required'
```

### **HTML Title Tags (IRRELEVANT):**
```html
<title>${subject}</title>  <!-- ❌ This does NOT control email subject -->
<title>KRA Assignment</title>  <!-- ✅ This is fine, only affects HTML rendering -->
```

## 🧪 **Testing the Fix**

### **1. Check Database Queue**
```sql
SELECT subject, email_data->>'employee_name' as employee_name
FROM email_queue 
WHERE module_type = 'performance_management'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
```
subject                                          | employee_name
KRA Assignment - John Doe - Action Required     | John Doe
KRA Submission - Jane Smith - Action Required   | Jane Smith
```

### **2. Verify Email Processing**
The edge function should use the dynamic subject from the database:
```typescript
await emailService.sendEmail({
  to: queuedEmail.recipients.to,
  cc: ccRecipients,
  subject: queuedEmail.subject,  // <-- This comes from database
  body: emailBody,
  isHtml: true
});
```

### **3. Check Email Client**
The received email should show:
- **Subject Line**: "KRA Assignment - John Doe - Action Required"
- **HTML Title**: Irrelevant (most email clients ignore it)

## ✅ **Status**

- ✅ **Database Functions**: Fixed to generate dynamic subjects
- ✅ **Email Queue**: Stores correct subject with employee names
- ✅ **Edge Function**: Uses database subject correctly
- ❌ **HTML Titles**: Don't matter for email subjects (can be ignored)

## 🎯 **Key Takeaway**

The email subject is controlled by the **database queue functions**, not the HTML templates. The migration file `20251127_02_fix_kra_notification_issues.sql` already contains the correct fix for dynamic email subjects.

If emails still show static subjects, the issue is likely:
1. **Migration not applied** - Run the migration
2. **Old emails in queue** - Process/clear old queue entries
3. **Caching issues** - Restart edge function

The HTML template changes were unnecessary since `<title>` tags don't affect email subjects.
