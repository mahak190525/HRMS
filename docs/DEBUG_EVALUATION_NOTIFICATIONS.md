# 🔍 Debug KRA Evaluation Notifications

## 🚨 **Issue**
No notifications are being sent when managers complete evaluations.

## 🛠️ **Debug Migration Applied**

I've created `20251128_08_debug_evaluation_notifications.sql` which adds comprehensive logging to the `notify_kra_evaluated()` function.

## 🔍 **What the Debug Version Does**

The debug function will log detailed information about:

1. **Trigger Firing**: Confirms if the trigger is firing at all
2. **Trigger Conditions**: Shows OLD vs NEW values for `manager_evaluated_at`
3. **Assignment Details**: Verifies assignment data is found
4. **Goal Completion**: Shows how many goals are evaluated vs total
5. **User Details**: Confirms employee and manager data is retrieved
6. **Notification Creation**: Shows success/failure for each notification
7. **Email Queueing**: Shows if emails are being queued

## 📋 **How to Use**

### **Step 1: Apply the Migration**
```bash
npx supabase db push
```

### **Step 2: Test Manager Evaluation**
1. Have a manager complete an evaluation for all goals in a quarter
2. Check the PostgreSQL logs for detailed output

### **Step 3: Check Logs**
Look for log messages like:
- `🔥 KRA EVALUATION TRIGGER FIRED`
- `✅ TRIGGER CONDITION MET`
- `📊 Goals status: X evaluated out of Y total`
- `✅ Employee notification created`
- `✅ Manager confirmation notification created`
- `✅ HR/ADMIN notification created`

## 🎯 **Expected Log Flow**

### **Successful Case**
```
🔥 KRA EVALUATION TRIGGER FIRED for assignment abc123 quarter Q2
📊 OLD.manager_evaluated_at: NULL, NEW.manager_evaluated_at: 2024-11-28T10:30:00Z
✅ TRIGGER CONDITION MET - Proceeding with notifications
📋 Assignment details found: employee_id=emp123, assigned_by=mgr456, template_id=tpl789
📊 Goals status: 5 evaluated out of 5 total for quarter Q2
✅ ALL GOALS EVALUATED - Proceeding with notifications
👤 Employee details: John Doe (ID: emp123)
👨‍💼 Manager details: Jane Smith (ID: mgr456)
📝 Template: 2024 KRA Template
🎯 Starting notification creation for Quarter 2 (Q2)
📧 Creating notification for EMPLOYEE: John Doe
✅ Employee notification created: notif123 for John Doe
📧 Creating confirmation notification for MANAGER: Jane Smith
✅ Manager confirmation notification created: notif124 for Jane Smith
📧 Creating notifications for HR and ADMIN users
📧 Creating notification for HR/ADMIN: HR User
✅ HR/ADMIN notification created: notif125 for HR User
📧 Attempting to queue evaluation email
✅ KRA Evaluation email queued successfully
🎉 KRA Evaluation notifications completed for assignment abc123 quarter Q2 (5 goals)
```

### **Problem Cases**
- `❌ TRIGGER CONDITION NOT MET` - Trigger not firing properly
- `⏳ NOT ALL GOALS EVALUATED YET` - Only some goals completed
- `❌ Employee/Manager not found` - User data issues
- `❌ Failed to create notification` - Notification system issues

## 🔧 **Common Issues to Look For**

1. **Trigger Not Firing**: No log messages at all
2. **Condition Not Met**: `manager_evaluated_at` not changing from NULL
3. **Partial Goal Completion**: Not all goals evaluated in the quarter
4. **User Not Found**: Employee or manager inactive/missing
5. **Notification Creation Failed**: Issues with `create_notification` function

## 🚀 **Next Steps**

After testing:
1. Share the log output to identify the exact issue
2. Apply targeted fix based on the root cause found
3. Replace debug version with optimized production version

This debug migration will help us pinpoint exactly where the evaluation notification process is failing.
