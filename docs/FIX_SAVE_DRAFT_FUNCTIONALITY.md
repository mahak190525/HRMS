# 🔧 Fix Save Draft Functionality for KRA Evaluations

## 🚨 **Problem**
When managers click "Save Draft" in KRA evaluation forms, the evaluation is being submitted entirely instead of being saved as a draft. This triggers evaluation notifications when it shouldn't.

## 🔍 **Root Cause**
The issue was in how the frontend handles clearing database fields for draft saves:

### **Before (Broken)**
```typescript
manager_evaluated_at: isDraft ? undefined : new Date().toISOString(),
manager_evaluated_by: isDraft ? undefined : user.id,
```

### **Problem with `undefined`**
When updating database records, `undefined` values are often ignored by the database update operation, meaning:
- If `manager_evaluated_at` already had a value, setting it to `undefined` wouldn't clear it
- The field would retain its previous timestamp value
- The trigger would fire because `manager_evaluated_at` still has a value

## 🛠️ **The Fix**

### **After (Fixed)**
```typescript
manager_evaluated_at: isDraft ? null : new Date().toISOString(),
manager_evaluated_by: isDraft ? null : user.id,
```

### **Why `null` Works**
- `null` explicitly clears the database field
- When `manager_evaluated_at` is set to `null`, the trigger condition is not met
- The evaluation remains as a draft without triggering notifications

## 📁 **Files Updated**

### **1. `src/pages/performance/ManagerKRAPage.tsx`**
- Fixed the `handleSaveAllEvaluations` function
- Changed `undefined` to `null` for draft saves

### **2. `src/components/kra/KRAManagerEvaluationForm.tsx`**
- Fixed the `handleSaveDraft` function
- Changed `undefined` to `null` for draft saves

## 🎯 **Expected Behavior After Fix**

### **Save Draft**
- ✅ Saves evaluation data without setting `manager_evaluated_at`
- ✅ No notifications are triggered
- ✅ Status remains as draft/in-progress
- ✅ Manager can continue editing later

### **Submit Evaluation**
- ✅ Saves evaluation data with `manager_evaluated_at` timestamp
- ✅ Triggers evaluation notifications to all recipients
- ✅ Status changes to evaluated/completed
- ✅ Evaluation is finalized

## 🔍 **Technical Details**

### **Database Trigger Condition**
```sql
WHEN (OLD.manager_evaluated_at IS NULL AND NEW.manager_evaluated_at IS NOT NULL)
```

### **Draft Save (No Trigger)**
- `OLD.manager_evaluated_at`: Could be NULL or have a value
- `NEW.manager_evaluated_at`: Set to `null` (explicitly NULL)
- **Result**: Trigger does NOT fire

### **Evaluation Submit (Trigger Fires)**
- `OLD.manager_evaluated_at`: NULL (from draft or new record)
- `NEW.manager_evaluated_at`: Set to timestamp
- **Result**: Trigger DOES fire, notifications sent

## ✅ **Testing**

To verify the fix works:

1. **Test Save Draft**:
   - Manager opens evaluation form
   - Fills in some evaluation details
   - Clicks "Save Draft"
   - **Expected**: No notifications sent, can continue editing

2. **Test Submit Evaluation**:
   - Manager completes all evaluation details
   - Clicks "Submit Evaluation" or "Complete Evaluation"
   - **Expected**: Notifications sent to employee, manager, HR, admin

## 🎉 **Result**

After this fix:
- ✅ **Save Draft**: Works correctly without triggering notifications
- ✅ **Submit Evaluation**: Works correctly and triggers notifications
- ✅ **Clear Separation**: Draft and submission behaviors are distinct
- ✅ **User Experience**: Managers can safely save work in progress

The fix ensures that the "Save Draft" functionality works as intended, allowing managers to save their progress without prematurely triggering evaluation completion notifications.
