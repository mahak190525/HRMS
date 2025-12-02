# Removed Extra Permissions Dependency

## Overview
The permission system has been updated to rely **solely on role-level permissions** from the `roles` table. The `extra_permissions` column in the `users` table is no longer used for dashboard and page access control.

## Changes Made

### 1. Updated Permission Checking Functions
**File**: `src/utils/featureAccess.ts`

All permission checking functions now use only role-level permissions:

- ✅ `hasUserDashboardAccess()` - Checks `roles.dashboard_permissions` only
- ✅ `hasUserPageAccess()` - Checks `roles.page_permissions` only
- ✅ `getUserAccessibleDashboards()` - Filters based on role permissions only
- ✅ `getUserAccessiblePages()` - Filters based on role permissions only
- ✅ `getUserEffectivePermissions()` - Uses role permissions only
- ✅ `hasCrudAccess()` - Uses role-based permissions only
- ✅ `hasFeatureAccess()` - Returns false (feature flags should be in roles table if needed)

### 2. Updated usePermissions Hook
**File**: `src/hooks/usePermissions.ts`

- Removed all `extra_permissions` references for dashboard/page access
- Now uses `useRolePermissions()` hook to get role-level permissions
- Filters dashboards and pages based on role permissions only

### 3. Permission Logic

#### Dashboard Access
A user can access a dashboard if:
1. They are an admin (full access), OR
2. Any of their roles has `view: true` or `read: true` in `roles.dashboard_permissions`, OR
3. Fallback: Dashboard is in `ROLE_DASHBOARD_MAPPING` for their role (legacy)

#### Page Access
A user can access a page if:
1. They are an admin (full access), OR
2. They have dashboard access AND:
   - Any of their roles has `view: true` or `read: true` in `roles.page_permissions` for that page, OR
   - The dashboard has `view: true` or `read: true` (inherits to pages)

## What Was Removed

### From Permission Checking
- ❌ `user.extra_permissions.dashboards` - No longer checked
- ❌ `user.extra_permissions.pages` - No longer checked
- ❌ `user.extra_permissions.crud` - No longer checked
- ❌ `user.extra_permissions.department_dashboards` - No longer checked
- ❌ `user.extra_permissions.department_crud` - No longer checked
- ❌ `user.extra_permissions.features` - No longer checked

### Still Available (for other purposes)
The `extra_permissions` column still exists in the database and may be used for:
- User preferences
- Notification settings
- Other non-access-control features

However, **dashboard and page access is now controlled exclusively through role-level permissions**.

## Migration Path

### For Existing Users
1. **Review role permissions**: Ensure all roles have appropriate `dashboard_permissions` and `page_permissions` configured
2. **Migrate individual permissions**: If users had custom `extra_permissions`, you may need to:
   - Create new roles with those permissions, OR
   - Assign additional roles to users, OR
   - Configure role permissions to match previous individual permissions

### For New Setup
1. Configure role permissions in the Role Permissions Management page
2. Assign roles to users
3. Users will automatically see only dashboards/pages their roles have access to

## Benefits

1. **Centralized Management**: All permissions managed in one place (roles table)
2. **Easier Administration**: Change permissions for all users with a role by updating the role
3. **Better Scalability**: No need to manage individual user permissions
4. **Consistency**: All users with the same role have the same permissions
5. **Simpler Logic**: Permission checking is straightforward and predictable

## Testing

After this change, verify:
1. ✅ Users only see dashboards their roles have access to
2. ✅ Users only see pages their roles have access to
3. ✅ Route protection works correctly
4. ✅ Navigation and sidebar filter correctly
5. ✅ Admin users still have full access

## Notes

- The `extra_permissions` column is not removed from the database schema (for backward compatibility)
- Other parts of the system may still use `extra_permissions` for non-access-control purposes
- The `DashboardAccessManager` component may still allow setting `extra_permissions`, but these won't affect dashboard/page visibility
- Role-level permissions take precedence and are the source of truth for access control

