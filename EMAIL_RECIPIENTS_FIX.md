# Email Recipients Fix - Proper TO/CC Implementation

## 🚨 **Issues Fixed**

### 1. **Wrong Recipients**
- **Before**: Emails were being sent to EVERY employee
- **After**: Emails only sent to correct recipients (following notification logic exactly)

### 2. **No TO/CC Structure**
- **Before**: Multiple separate emails to different recipients
- **After**: Single email with proper TO and CC fields

## ✅ **New Email Structure**

### **TO Field (Primary Recipient)**
- **Employee who requested leave** - Gets the main email

### **CC Field (Secondary Recipients)**
- **Admins & HR** - Users with roles: `admin`, `super_admin`, `hr`
- **Manager** - Employee's direct manager (only if different from approver)

## 🎯 **Recipient Logic (Matches Notifications Exactly)**

### **Who Gets Emails for Approved Leaves:**

1. **Employee** (TO field)
   - The person who requested the leave
   - Gets personalized approval message

2. **Admins & HR** (CC field)
   - Users with roles: `admin`, `super_admin`, `hr`
   - Must be active status
   - Must have valid email address
   - **Excludes**: The employee who applied for leave

3. **Manager** (CC field)
   - Employee's direct manager (`manager_id`)
   - **Only if**: Manager is different from the person who approved
   - Must be active status
   - Must have valid email address

### **Who Does NOT Get Emails:**
- ❌ The employee who applied (they're in TO, not CC)
- ❌ The approver (if they're the manager)
- ❌ Inactive users
- ❌ Users without email addresses
- ❌ Users for rejected/pending/cancelled leaves

## 🔧 **Technical Implementation**

### **Database Function Changes**
```sql
-- New logic follows notification system exactly:
-- 1. Get admins/HR (excluding employee who applied)
-- 2. Get manager (only if different from approver)
-- 3. Send single email with TO/CC structure
```

### **Edge Function Changes**
```typescript
// New email structure:
{
  to: [employee],           // Primary recipient
  cc: [admins, hr, manager], // Secondary recipients
  subject: "Leave Approved",
  body: "HTML email content"
}
```

## 📋 **Deployment Steps**

### Step 1: Update Edge Function
The Edge Function has been updated to support TO/CC fields. **Redeploy it** with the updated code.

### Step 2: Apply Database Migration
Run this migration in Supabase SQL editor:
```sql
-- Copy contents of: 
-- supabase/migrations/20251122_03_fix_email_recipients_and_add_cc_support.sql
```

### Step 3: Test the Fix
1. **Approve a leave request**
2. **Check email recipients**:
   - Employee should be in TO field
   - Admins/HR/Manager should be in CC field
   - No other employees should receive the email

## 🧪 **Testing Scenarios**

### ✅ **Scenario 1: Normal Approval**
- Employee: John applies for leave
- Manager: Sarah approves leave
- **Expected Email**:
  - TO: John
  - CC: All admins/HR + Sarah (manager)

### ✅ **Scenario 2: HR Approves (Manager Different)**
- Employee: John applies for leave
- HR: Mike approves leave
- Manager: Sarah (different from approver)
- **Expected Email**:
  - TO: John
  - CC: All admins/HR + Sarah (manager)

### ✅ **Scenario 3: Manager Approves (Same Person)**
- Employee: John applies for leave
- Manager: Sarah approves leave (same as manager)
- **Expected Email**:
  - TO: John
  - CC: All admins/HR (Sarah not in CC since she's the approver)

## 🎉 **Benefits of This Fix**

### **Proper Email Etiquette**
- ✅ Employee gets personal email (TO field)
- ✅ Others get FYI copy (CC field)
- ✅ Clear who the email is primarily for

### **Reduced Email Volume**
- ✅ Single email instead of multiple separate emails
- ✅ Only relevant people get emails
- ✅ No spam to entire organization

### **Consistent with Notifications**
- ✅ Exact same recipient logic as in-app notifications
- ✅ Maintains consistency across communication channels
- ✅ Easy to maintain and understand

## 🔍 **Verification**

After deployment, verify:
1. **Only correct recipients** get emails
2. **Employee is in TO field**
3. **Others are in CC field**
4. **No emails to wrong people**

The fix ensures emails follow proper business etiquette and only go to people who should be informed about the leave approval!

