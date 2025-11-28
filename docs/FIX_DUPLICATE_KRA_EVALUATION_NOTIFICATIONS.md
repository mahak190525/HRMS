# 🔧 Fix Duplicate KRA Evaluation Notifications - Complete Solution

## 🚨 **Problem Identified**

**Multiple notifications were being sent when a KRA is evaluated** because the database trigger fires for **each individual goal evaluation**, not once per quarter completion.

### **Root Cause Analysis**

When a manager evaluates a KRA with multiple goals (e.g., 5 goals):

1. **Frontend loops through each goal** and updates `manager_evaluated_at` individually
2. **Database trigger fires 5 times** - once for each goal update  
3. **Each trigger execution sends notifications** to all recipients (Employee, Manager, HR, Admin)
4. **Result: 5x duplicate notifications** for the same evaluation event

### **Code Evidence**

**Frontend Code (ManagerKRAPage.tsx):**
```typescript
for (const goal of goals) {
  const payload = {
    assignment_id: currentAssignment.id,
    goal_id: goal.id,
    quarter: selectedQuarter,
    // ... other fields ...
    manager_evaluated_at: isDraft ? null : new Date().toISOString(), // ⚠️ Triggers notification for EACH goal
    manager_evaluated_by: isDraft ? null : user.id,
  };
  
  // Update each goal individually
  await updateEvaluationMutation.mutateAsync({ id: existingEvaluation.id, ...payload });
}
```

**Database Trigger Condition:**
```sql
WHEN (OLD.manager_evaluated_at IS NULL AND NEW.manager_evaluated_at IS NOT NULL)
```

This condition is met **every time** a goal's `manager_evaluated_at` field is updated from `NULL` to a timestamp.

## 🛠️ **The Solution - Simplified Approach**

### **Migration: `20251128_12_fix_duplicate_kra_evaluation_notifications.sql`**

The fix implements a **"manual notification"** approach that eliminates the root cause:

#### **1. Remove Goal-Level Trigger**
```sql
-- Drop the existing goal-level trigger that causes duplicates
DROP TRIGGER IF EXISTS trigger_notify_kra_evaluated ON kra_evaluations;
```

#### **2. Create Manual Notification Function**
```sql
-- Create a function that can be called manually from frontend
CREATE OR REPLACE FUNCTION send_kra_evaluation_notifications(
  p_assignment_id UUID,
  p_quarter TEXT,
  p_manager_id UUID
)
RETURNS BOOLEAN AS $$
```

#### **3. Frontend Calls Function Once**
```typescript
// Frontend calls the notification function ONCE after all goals are saved
const { data, error } = await supabase.rpc('send_kra_evaluation_notifications', {
  p_assignment_id: currentAssignment.id,
  p_quarter: selectedQuarter,
  p_manager_id: user.id
});
```

#### **4. Duplicate Prevention Built-In**
```sql
-- Check if notifications already sent for this quarter
SELECT EXISTS(
  SELECT 1 FROM notifications 
  WHERE data->>'assignment_id' = p_assignment_id::text 
  AND data->>'quarter' = p_quarter 
  AND type = 'kra_evaluated'
  AND data->>'notification_batch_key' = notification_sent_key
) INTO notification_already_sent;
```

## 🎯 **How It Works**

### **Before Fix (Broken Flow)**
```
Manager evaluates 5 goals:
Goal 1 updated → Trigger fires → 4 notifications sent
Goal 2 updated → Trigger fires → 4 notifications sent  
Goal 3 updated → Trigger fires → 4 notifications sent
Goal 4 updated → Trigger fires → 4 notifications sent
Goal 5 updated → Trigger fires → 4 notifications sent

Total: 20 duplicate notifications! 😱
```

### **After Fix (Correct Flow)**
```
Manager evaluates 5 goals:
Goal 1 updated → No trigger (trigger removed)
Goal 2 updated → No trigger  
Goal 3 updated → No trigger
Goal 4 updated → No trigger
Goal 5 updated → No trigger
Frontend calls notification function → Send 4 notifications ✅

Total: 4 notifications (1 per recipient) 🎉
```

## ✅ **Expected Results**

### **Notification Recipients (Single Set)**
- ✅ **Employee**: "Your manager has completed the evaluation..."
- ✅ **Manager**: "You have successfully completed the evaluation..."  
- ✅ **HR Users**: "Manager has completed evaluation for Employee..."
- ✅ **Admin Users**: "Manager has completed evaluation for Employee..."

### **Email Flow**
- ✅ **Email notifications**: Continue working as before (1 email per quarter)
- ✅ **In-app notifications**: Now fixed to send only 1 set per quarter

## 🧪 **Testing Scenarios**

### **Test Case 1: Single Goal KRA**
1. Manager evaluates 1 goal
2. **Expected**: 4 notifications (Employee, Manager, HR, Admin)
3. **Verify**: No duplicates

### **Test Case 2: Multiple Goal KRA (5 goals)**
1. Manager evaluates all 5 goals
2. **Expected**: 4 notifications total (not 20)
3. **Verify**: Notifications sent only after last goal is evaluated

### **Test Case 3: Partial Evaluation**
1. Manager evaluates 3 out of 5 goals
2. **Expected**: 0 notifications (evaluation not complete)
3. Manager evaluates remaining 2 goals
4. **Expected**: 4 notifications (evaluation now complete)

## 🔧 **Technical Features**

### **1. Manual Notification Control**
- Frontend explicitly calls notification function once per evaluation
- No automatic triggers that can fire multiple times

### **2. Duplicate Prevention**
- Uses unique batch keys to track sent notifications
- Prevents multiple notification sets for the same quarter evaluation

### **3. Comprehensive Logging**
- Detailed RAISE NOTICE statements for debugging
- Clear indication of notification success or failure

### **4. Error Handling**
- Graceful handling of missing users, templates, or assignments
- Email failures don't break in-app notifications
- Function returns boolean to indicate success/failure

## 🚀 **How to Apply**

```bash
npx supabase db push
```

## 🔍 **Verification**

After applying the fix:

1. **Check logs**: Look for "Single evaluation notification sent" messages
2. **Test evaluation**: Complete a multi-goal KRA evaluation
3. **Verify notifications**: Confirm only 1 notification per recipient
4. **Check email**: Ensure email flow still works (1 email per quarter)

This simplified fix resolves the duplicate notification issue by eliminating the root cause (automatic triggers) and giving the frontend explicit control over when notifications are sent. This ensures reliable, single notifications per quarter evaluation while preserving all existing functionality.
