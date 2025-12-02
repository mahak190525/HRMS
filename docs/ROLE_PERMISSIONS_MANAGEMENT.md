# Role Permissions Management Feature

## Overview
This feature allows Administrators to configure granular dashboard and page access permissions for each role in the system. Permissions include CRUD operations (Read, Write, View, Delete) for both dashboards and pages.

## Features

### 1. Role-Level Dashboard Permissions
- Configure which dashboards each role can access
- Set CRUD permissions (Read, Write, View, Delete) for each dashboard
- Permissions are stored in the `roles.dashboard_permissions` JSONB column

### 2. Role-Level Page Permissions
- Configure which pages within each dashboard each role can access
- Set CRUD permissions (Read, Write, View, Delete) for each page
- Permissions are stored in the `roles.page_permissions` JSONB column

### 3. Permission Structure

#### Dashboard Permissions
```json
{
  "dashboard_id": {
    "read": boolean,
    "write": boolean,
    "view": boolean,
    "delete": boolean
  }
}
```

#### Page Permissions
```json
{
  "dashboard_id": {
    "page_id": {
      "read": boolean,
      "write": boolean,
      "view": boolean,
      "delete": boolean
    }
  }
}
```

## Database Schema

### Migration
The feature adds two new columns to the `roles` table:
- `dashboard_permissions` (jsonb): Stores dashboard-level CRUD permissions
- `page_permissions` (jsonb): Stores page-level CRUD permissions

### Database Functions
- `get_role_dashboard_permissions(role_id, dashboard_id)`: Get dashboard permissions for a role
- `get_role_page_permissions(role_id, dashboard_id, page_id)`: Get page permissions for a role
- `get_user_role_dashboard_permissions(user_id, dashboard_id)`: Aggregate dashboard permissions from all user roles
- `get_user_role_page_permissions(user_id, dashboard_id, page_id)`: Aggregate page permissions from all user roles

## Usage

### Accessing the Feature
1. Navigate to **Employee Management** dashboard
2. Click on **Role Permissions** in the sidebar
3. Or directly navigate to `/admin/role-permissions`

### Configuring Permissions
1. **Select a Role**: Choose the role you want to configure from the dropdown
2. **Configure Dashboard Permissions**: 
   - Toggle Read, Write, View, Delete permissions for each dashboard
   - Dashboards with permissions are highlighted in blue
3. **Configure Page Permissions**:
   - Click the chevron to expand a dashboard
   - Toggle Read, Write, View, Delete permissions for each page
   - Pages with permissions are highlighted in green
4. **Save Changes**: Click "Save Permissions" to persist changes

### Permission Hierarchy
- **Admin users**: Always have full access to all dashboards and pages (bypasses role permissions)
- **Role permissions**: Applied to all users with that role
- **Individual user permissions**: Can override role permissions (via `extra_permissions`)

## Permission Checking

### Utility Functions

#### Check Dashboard CRUD Permission (Async)
```typescript
import { hasDashboardCrudPermission } from '@/utils/featureAccess';

const canRead = await hasDashboardCrudPermission(user, 'employee_management', 'read');
const canWrite = await hasDashboardCrudPermission(user, 'employee_management', 'write');
```

#### Check Page CRUD Permission (Async)
```typescript
import { hasPageCrudPermission } from '@/utils/featureAccess';

const canRead = await hasPageCrudPermission(user, 'employee_management', 'overview', 'read');
const canDelete = await hasPageCrudPermission(user, 'employee_management', 'overview', 'delete');
```

#### Check Dashboard CRUD Permission (Sync - Fallback)
```typescript
import { hasDashboardCrudPermissionSync } from '@/utils/featureAccess';

const canView = hasDashboardCrudPermissionSync(user, 'employee_management', 'view');
```

#### Check Page CRUD Permission (Sync - Fallback)
```typescript
import { hasPageCrudPermissionSync } from '@/utils/featureAccess';

const canView = hasPageCrudPermissionSync(user, 'employee_management', 'overview', 'view');
```

## Implementation Details

### Components
- **RolePermissionsManager** (`src/components/admin/RolePermissionsManager.tsx`): Main component for managing role permissions
- **RolePermissionsPage** (`src/pages/admin/RolePermissionsPage.tsx`): Page wrapper for the manager component

### Types
- **DashboardPermissions**: Interface for dashboard CRUD permissions
- **PagePermissions**: Interface for page CRUD permissions
- **Role**: Extended with `dashboard_permissions` and `page_permissions` fields

### Routes
- `/admin/role-permissions`: Role permissions management page
- Added to Employee Management dashboard navigation

## Migration Instructions

1. **Run the Migration**:
   ```sql
   -- Run: supabase/migrations/20251202000000_add_role_dashboard_page_permissions.sql
   ```

2. **Verify Migration**:
   - Check that `dashboard_permissions` and `page_permissions` columns exist in `roles` table
   - Verify database functions are created

3. **Configure Initial Permissions**:
   - Navigate to Role Permissions page
   - Configure permissions for each role as needed

## Best Practices

1. **Start with View/Read**: Grant view and read permissions first, then add write/delete as needed
2. **Test Permissions**: After configuring, test with users having those roles to ensure correct access
3. **Document Changes**: Keep track of permission changes for audit purposes
4. **Use Role Permissions First**: Configure role-level permissions before individual user overrides

## Notes

- Permissions are aggregated across all user roles (OR logic - if any role has permission, user has it)
- Admin users bypass all permission checks
- Individual user permissions (via `extra_permissions`) can override role permissions
- The system falls back to legacy role-based access if no explicit CRUD permissions are set

