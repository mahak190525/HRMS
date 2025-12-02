# Role-Based Dashboard and Page Filtering Implementation

## Overview
This implementation ensures that users only see dashboards and pages they have access to based on their role(s) permissions stored in the `roles` table. The system filters navigation, sidebar, and route access based on role-level CRUD permissions.

## Key Changes

### 1. New Hook: `useRolePermissions`
**File**: `src/hooks/useRolePermissions.ts`

- Fetches role-level permissions from the database for the current user
- Aggregates permissions from all user roles (primary + additional roles)
- Uses OR logic: if any role has a permission, the user has it
- Caches permissions for 5 minutes to reduce database queries

### 2. Updated Permission Checking Functions
**File**: `src/utils/featureAccess.ts`

All permission checking functions now accept optional `rolePermissions` parameter:

- `hasUserDashboardAccess()`: Checks if user has view/read permission for a dashboard
- `hasUserPageAccess()`: Checks if user has view/read permission for a page
- `getUserAccessibleDashboards()`: Returns only dashboards with view/read permission
- `getUserAccessiblePages()`: Returns only pages with view/read permission
- `isPathAccessible()`: Checks route access using role permissions

### 3. Updated `usePermissions` Hook
**File**: `src/hooks/usePermissions.ts`

- Integrates `useRolePermissions` hook
- All permission checks now use role-level permissions
- Returns `rolePermissionsLoading` state for loading indicators

### 4. Updated Components

#### RouteGuard
**File**: `src/components/auth/RouteGuard.tsx`
- Uses role permissions to check path access
- Shows loading state while role permissions are being fetched
- Blocks access to routes the user doesn't have permission for

#### AppLayout
**File**: `src/components/layout/AppLayout.tsx`
- Waits for role permissions to load before rendering
- Only shows accessible dashboards and pages

#### AppSidebar
- Already uses `getAccessibleDashboards()` which now filters based on role permissions
- Only displays pages the user has access to

#### DashboardSwitcher
- Only shows dashboards the user has access to

## Permission Logic

### Dashboard Access
A user can see a dashboard if:
1. They are an admin (full access)
2. Any of their roles has `view: true` or `read: true` for that dashboard
3. They have explicit user-level permission (legacy fallback)
4. They have role-based access from `ROLE_DASHBOARD_MAPPING` (legacy fallback)

### Page Access
A user can see a page if:
1. They are an admin (full access)
2. They have dashboard access AND:
   - Any of their roles has `view: true` or `read: true` for that page, OR
   - The dashboard has `view: true` or `read: true` (inherits to pages)

## How It Works

1. **On User Login**:
   - `useRolePermissions` hook fetches all roles for the user
   - Aggregates `dashboard_permissions` and `page_permissions` from all roles
   - Caches the result for 5 minutes

2. **Navigation Filtering**:
   - `getAccessibleDashboards()` filters dashboards based on role permissions
   - Only dashboards with `view: true` or `read: true` are returned
   - Pages are filtered similarly

3. **Route Protection**:
   - `RouteGuard` checks `isPathAccessible()` with role permissions
   - Blocks access and shows "Access Denied" if user lacks permission

4. **Sidebar Display**:
   - Only shows dashboards and pages the user has access to
   - Automatically updates when role permissions change

## Example

If a role has these permissions:
```json
{
  "dashboard_permissions": {
    "employee_management": {
      "read": true,
      "view": true,
      "write": false,
      "delete": false
    }
  },
  "page_permissions": {
    "employee_management": {
      "overview": {
        "read": true,
        "view": true,
        "write": true,
        "delete": false
      },
      "assets": {
        "read": false,
        "view": false,
        "write": false,
        "delete": false
      }
    }
  }
}
```

Then users with this role will:
- ✅ See "Employee Management" dashboard
- ✅ See "All Employees" page (overview)
- ❌ NOT see "Asset Management" page (assets)
- ❌ NOT see other dashboards without permissions

## Migration Notes

1. **Run the migration** first:
   ```sql
   -- Run: supabase/migrations/20251202000000_add_role_dashboard_page_permissions.sql
   ```

2. **Configure role permissions**:
   - Navigate to Role Permissions page
   - Set `view` or `read` permissions for dashboards and pages
   - Users will automatically see only what they have access to

3. **Legacy Support**:
   - System still supports `ROLE_DASHBOARD_MAPPING` as fallback
   - Individual user permissions (`extra_permissions`) still work
   - Role-level permissions take precedence

## Performance Considerations

- Role permissions are cached for 5 minutes
- Permissions are fetched once per user session
- Database queries are optimized with indexes on JSONB fields
- Loading states prevent UI flicker during permission checks

## Testing

To test the implementation:

1. **Configure a role** with limited permissions
2. **Assign the role** to a test user
3. **Login as that user** and verify:
   - Only permitted dashboards appear in navigation
   - Only permitted pages appear in sidebar
   - Direct URL access to restricted pages shows "Access Denied"
   - Dashboard switcher only shows accessible dashboards

## Troubleshooting

**Issue**: User sees all dashboards/pages
- **Solution**: Check if user is admin (admins bypass all checks)
- **Solution**: Verify role permissions are set in database
- **Solution**: Check if user has explicit permissions overriding role permissions

**Issue**: User can't see anything
- **Solution**: Ensure at least one role has `view: true` or `read: true` for a dashboard
- **Solution**: Check if role permissions are being fetched (check browser console)
- **Solution**: Verify user has at least one role assigned

**Issue**: Permissions not updating
- **Solution**: Clear browser cache
- **Solution**: Wait for cache to expire (5 minutes) or refresh page
- **Solution**: Check if role permissions were saved correctly in database

