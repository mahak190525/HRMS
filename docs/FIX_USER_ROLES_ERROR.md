# 🔧 Fix User Roles Error in KRA Evaluation Notifications

## 🚨 **Error**
When submitting KRA evaluations, the following error occurred:
```
relation "user_roles" does not exist
```

## 🔍 **Root Cause**
The `notify_kra_evaluated()` function was trying to reference a `user_roles` junction table that doesn't exist in the database schema.

### **Incorrect Code (Causing Error)**
```sql
FROM users u
JOIN user_roles ur ON u.id = ur.user_id  -- ❌ user_roles table doesn't exist
JOIN roles r ON ur.role_id = r.id
```

### **Actual Database Schema**
The database uses a direct foreign key relationship:
```sql
-- users table has role_id that directly references roles.id
users.role_id -> roles.id
```

## 🛠️ **The Fix**

### **Migration: `20251128_11_fix_user_roles_error.sql`**

**Corrected Code:**
```sql
FROM users u
JOIN roles r ON u.role_id = r.id  -- ✅ Direct join using role_id
WHERE r.name IN ('HR', 'Admin', 'hr', 'admin', 'super_admin')
AND u.status = 'active'
```

### **Key Changes**
1. **Removed non-existent table**: Eliminated `user_roles` junction table reference
2. **Direct join**: Used `users.role_id` to join directly with `roles.id`
3. **Expanded role names**: Added lowercase variants and `super_admin` for completeness
4. **Fixed both functions**: Updated both the main function and the revert function

## 📁 **Files Fixed**

### **1. `supabase/migrations/20251128_11_fix_user_roles_error.sql`**
- Creates corrected `notify_kra_evaluated()` function
- Uses proper table structure for HR/Admin user lookup

### **2. `supabase/migrations/20251128_10_revert_to_working_evaluation_notifications.sql`**
- Fixed the same error in the revert migration
- Updated to use correct table joins

## 🎯 **Database Schema Reference**

### **Correct Table Structure**
```sql
-- roles table
CREATE TABLE roles (
  id uuid PRIMARY KEY,
  name text UNIQUE NOT NULL,
  ...
);

-- users table  
CREATE TABLE users (
  id uuid PRIMARY KEY,
  role_id uuid REFERENCES roles(id),  -- Direct foreign key
  ...
);
```

### **HR/Admin User Query (Fixed)**
```sql
SELECT u.id, u.full_name as name, u.email
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name IN ('HR', 'Admin', 'hr', 'admin', 'super_admin') 
AND u.status = 'active'
```

## ✅ **Expected Result**

After applying this fix:
- ✅ **No more "user_roles" errors**: Function uses correct table structure
- ✅ **Evaluation notifications work**: Managers can submit evaluations without errors
- ✅ **HR/Admin notifications**: HR and Admin users receive evaluation notifications
- ✅ **All recipients covered**: Employee, Manager, HR, and Admin get notifications

## 🚀 **How to Apply**

```bash
npx supabase db push
```

## 🔍 **Testing**

To verify the fix:
1. Manager completes and submits an evaluation
2. **Should NOT see**: "relation user_roles does not exist" error
3. **Should see**: Success message and notifications sent to all recipients
4. **Should receive**: Notifications for employee, manager, HR, and admin users

This fix resolves the database schema mismatch and ensures that KRA evaluation notifications work correctly with the actual database structure.
