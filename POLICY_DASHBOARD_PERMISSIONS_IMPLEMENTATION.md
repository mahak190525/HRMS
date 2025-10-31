# Policy Dashboard Permissions Implementation

## Overview
This implementation provides customizable read/write access control for employees across the entire policies dashboard, allowing administrators to control who can create, edit, delete policies, and manage permissions.

## Features Implemented

### 1. Database Schema
- **Table**: `policy_dashboard_permissions`
- **Permissions**: 
  - `can_view_policies`: Access to view policies
  - `can_create_policies`: Create new policies
  - `can_edit_policies`: Edit existing policies
  - `can_delete_policies`: Delete policies
  - `can_manage_permissions`: Manage other users' policy permissions
  - `can_view_analytics`: View policy analytics and statistics

### 2. Permission Levels
- **Role-based**: Default permissions based on user role
- **Individual**: Custom permissions for specific users (overrides role-based)
- **Default**: Fallback permissions (view-only)

### 3. Default Role Permissions
- **Admin/Super Admin/HR/HRM**: Full access (all permissions)
- **Managers (SDM/BDM/QAM/Finance Manager)**: View + Analytics only
- **Finance/Employee/Intern/Contractor**: View only

### 4. Components Created

#### `usePolicyDashboardPermissions` Hook
- Fetches current user's policy dashboard permissions
- Provides permission checks and loading states
- Auto-refreshes when permissions change

#### `PolicyDashboardPermissions` Component
- Admin interface for managing individual user permissions
- Visual permission toggles with dependency handling
- Permission source indicators (role-based vs individual)
- Reset to role defaults functionality

#### Updated `DashboardAccessManager`
- Added new "Policy Dashboard" tab
- Integrated with existing permission management system

#### Updated `PoliciesPage`
- Permission-based UI rendering
- Access denied screen for unauthorized users
- Conditional action buttons based on permissions
- Toast notifications for permission violations

#### Updated `PolicySidebar`
- Optional action handlers based on permissions
- Conditional display of create/edit/delete options

### 5. Database Functions
- `get_user_policy_dashboard_permissions()`: Get effective permissions for a user
- `set_user_policy_dashboard_permissions()`: Set individual user permissions
- `set_role_policy_dashboard_permissions()`: Set role-based permissions

## Usage

### For Administrators
1. Navigate to Employee Management
2. Select an employee
3. Click "Manage Access"
4. Go to "Policy Dashboard" tab
5. Configure permissions as needed

**Note**: The "Policy Access" tab has been removed since all users can view policies by default. Only dashboard-level permissions (create, edit, delete) are managed through the "Policy Dashboard" tab.

### Permission Dependencies
- All permissions require `can_view_policies`
- Disabling view access automatically disables all other permissions
- Enabling dependent permissions automatically enables view access

### Permission Sources
- **Role-based**: Inherited from user's role
- **Individual**: Custom permissions set for specific user
- **Default**: Fallback when no specific permissions exist

## Security Features
- Permission checks on both frontend and backend
- Graceful degradation for unauthorized access
- Clear visual indicators of permission levels
- Audit trail support (can be extended)

## Files Modified/Created

### Database
- `supabase/migrations/20251031_01_create_policy_dashboard_permissions.sql`

### Hooks
- `src/hooks/usePolicyDashboardPermissions.ts`

### Components
- `src/components/policies/PolicyDashboardPermissions.tsx`
- `src/components/dashboard/DashboardAccessManager.tsx` (updated)
- `src/pages/policies/PoliciesPage.tsx` (updated)
- `src/components/policies/PolicySidebar.tsx` (updated)

## Testing
To test the implementation:
1. Run the database migration
2. Access the policies dashboard with different user roles
3. Use the admin interface to modify permissions
4. Verify that UI elements appear/disappear based on permissions
5. Test permission violations show appropriate error messages

## Future Enhancements
- Bulk permission management for multiple users
- Permission templates for common role configurations
- Advanced analytics and reporting on policy access
- Time-based permissions (temporary access)
- Integration with audit logging system
