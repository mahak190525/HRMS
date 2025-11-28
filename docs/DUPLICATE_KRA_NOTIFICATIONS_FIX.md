# 🔧 Fix for Duplicate KRA Notifications

## 🚨 **Problem Identified**

Multiple identical in-app notifications were being sent for both KRA submissions and evaluations when documents were uploaded or evaluations were completed.

### **Root Cause**
The KRA notification triggers were firing **once for each goal** instead of **once per quarter**:

1. **KRA Submission**: When employee submits evidence for multiple goals, each goal's `kra_evaluations` record gets updated with `employee_submitted_at`
2. **KRA Evaluation**: When manager evaluates multiple goals, each goal's `kra_evaluations` record gets updated with `manager_evaluated_at`
3. **Trigger Fires Multiple Times**: The database trigger fires for EACH individual goal update
4. **Multiple Notifications**: Results in 5 identical notifications if there are 5 goals

### **Evidence from Screenshots**
- **Submission**: 5 identical "KRA Quarter 2 (Q2) Submitted Successfully" notifications
- **Evaluation**: 5 identical "KRA Quarter 2 (Q2) Evaluation Completed" notifications

## 🛠️ **The Fix**

### **Migration: `20251128_06_fix_duplicate_submission_notifications.sql`**

The fix implements **duplicate prevention logic** in both notification functions:

#### **1. Duplicate Detection**
```sql
-- Check if we already sent a notification for this quarter in the last 5 minutes
SELECT COUNT(*) INTO existing_notification_count
FROM notifications
WHERE type = 'kra_submitted'  -- or 'kra_evaluated'
AND data->>'assignment_id' = NEW.assignment_id::text
AND data->>'quarter' = NEW.quarter
AND created_at > NOW() - INTERVAL '5 minutes';

-- If notification already exists, skip
IF existing_notification_count > 0 THEN
  RAISE NOTICE 'Notification already exists, skipping';
  RETURN NEW;
END IF;
```

#### **2. Complete Quarter Validation**
```sql
-- Only send notifications when ALL goals for the quarter are submitted/evaluated
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN employee_submitted_at IS NOT NULL THEN 1 END) as submitted
INTO total_goals, submitted_goals
FROM kra_evaluations e
WHERE e.assignment_id = NEW.assignment_id 
AND e.quarter = NEW.quarter;

-- Exit early if not all goals are completed yet
IF NOT all_goals_submitted THEN
  RETURN NEW;
END IF;
```

#### **3. Enhanced Logging**
```sql
RAISE NOTICE '✅ KRA Submission notifications sent for assignment % quarter % (% goals completed)', 
  NEW.assignment_id, NEW.quarter, total_goals;
```

## 🎯 **What Was Fixed**

### **Before (Broken)**
```
Employee submits 5 goals → 5 trigger fires → 5 identical notifications
Manager evaluates 5 goals → 5 trigger fires → 5 identical notifications
```

### **After (Fixed)**
```
Employee submits 5 goals → 5 trigger fires → 1st checks: no existing notification → sends notification
                                          → 2nd-5th check: notification exists → skip
Manager evaluates 5 goals → Same logic → Only 1 notification sent
```

## 📧 **Email Flow Preserved**

**IMPORTANT**: The email notification flow was **NOT TOUCHED** as requested. Only in-app notifications were fixed.

- ✅ **Email notifications**: Continue working perfectly (1 email per quarter)
- ✅ **In-app notifications**: Now fixed to send only 1 per quarter

## 🔍 **Functions Updated**

1. **`notify_kra_submitted()`**: Prevents duplicate submission notifications
2. **`notify_kra_evaluated()`**: Prevents duplicate evaluation notifications

Both functions now include:
- Duplicate detection logic
- Complete quarter validation
- Enhanced error handling and logging
- Preserved email notification calls

## 🚀 **How to Apply**

Run the migration:
```bash
npx supabase db push
```

## ✅ **Expected Result**

After applying this fix:
- **Submissions**: Only 1 "KRA Quarter X Submitted Successfully" notification per quarter
- **Evaluations**: Only 1 "KRA Quarter X Evaluation Completed" notification per quarter
- **Email flow**: Continues working perfectly (unchanged)
- **All recipients**: Employee, Manager, HR, and Admin users still receive notifications as configured

The fix ensures a clean, professional notification experience without overwhelming users with duplicate messages.
