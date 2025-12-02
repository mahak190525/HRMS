# Asset Management Roles Implementation

## Overview
This document outlines the implementation of two new specialized roles for asset management: **Office Admin** and **IT Helpdesk**. These roles provide granular access control to asset management functionality with specific restrictions.

## New Roles Created

### 1. Office Admin (`office_admin`)
- **Access**: Can CRUD and assign everything in Asset Management **EXCEPT VMs**
- **Dashboard Access**: Self + Employee Management (Asset Management tab only)
- **Restrictions**: Cannot manage Virtual Machines

### 2. IT Helpdesk (`it_helpdesk`)
- **Access**: Can **ONLY** CRUD and assign VMs
- **Dashboard Access**: Self + Employee Management (Asset Management tab only)
- **Restrictions**: Cannot manage regular assets (only VMs)

## Key Implementation Rules

### Access Control Logic
1. **HR/HRM users**: NO access to Asset Management by default
2. **Only specific roles** can access Asset Management:
   - Admin (full access)
   - Office Admin (all assets except VMs)
   - IT Helpdesk (VMs only)
3. **HR/HRM exception**: Only if they have Office Admin or IT Helpdesk as additional roles

## Files Modified

### 1. Database Migration
**File**: `supabase/migrations/20251201130000_create_asset_management_roles.sql`
- Created new roles in `roles` table
- Created `asset_management_permissions` table with granular permissions
- Added `get_user_asset_permissions(uuid)` function for permission aggregation
- Set HR/HRM roles to have NO asset management access

### 2. Constants and Role Mappings
**File**: `src/constants/index.ts`
- Added `OFFICE_ADMIN` and `IT_HELPDESK` to `ROLES` constant
- Added role display names to `roleNameMap`
- Updated `ROLE_DASHBOARD_MAPPING` to grant Employee Management dashboard access

### 3. Permission Hooks
**File**: `src/hooks/useAssetManagementPermissions.ts` (NEW)
- Comprehensive hook for asset management permissions
- Separate permissions for regular assets vs VMs
- Helper functions for operation-specific checks

**File**: `src/hooks/useEmployeePermissions.ts`
- Added `canAccessAssetManagement` property
- Updated logic to respect new asset management rules

### 4. Utility Functions
**File**: `src/utils/multipleRoles.ts`
- Added `isUserOfficeAdmin()` function
- Added `isUserITHelpdesk()` function

### 5. UI Components
**File**: `src/pages/employees/EmployeeManagement.tsx`
- Updated to use `canAccessAssetManagement` instead of `canManageAssets`
- Asset Management tab now respects new permission rules

**File**: `src/components/admin/AssetManagementRoleTest.tsx` (NEW)
- Test component to verify role permissions
- Visual display of current user's asset management permissions
- Available in development mode or for admin users

## Permission Matrix

| Role | View Assets | Create Assets | Edit Assets | Delete Assets | Assign Assets | View VMs | Create VMs | Edit VMs | Delete VMs | Assign VMs |
|------|-------------|---------------|-------------|---------------|---------------|----------|------------|----------|------------|------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Office Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **IT Helpdesk** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **HR/HRM** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **HR + Office Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **HR + IT Helpdesk** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Usage Instructions

### 1. Run the Migration
Execute the migration in Supabase:
```sql
-- Run: supabase/migrations/20251201130000_create_asset_management_roles.sql
```

### 2. Assign Roles
Use the existing employee management interface to assign additional roles:
- Navigate to Employee Management
- Edit an employee
- In the "Additional Roles" field, select "Office Admin" or "IT Helpdesk"

### 3. Test Permissions
- Visit the dashboard (development mode or as admin)
- Use the "Asset Management Role Test" component to verify permissions
- Navigate to Employee Management → Asset Management tab to test access

## Testing Component

The `AssetManagementRoleTest` component provides:
- Visual display of current user's roles
- Real-time permission checking
- Expected behavior documentation
- Navigation buttons to test actual access

## Database Functions

### `get_user_asset_permissions(user_id uuid)`
Returns aggregated asset management permissions for a user based on all their roles (primary + additional).

**Returns:**
- `can_view_assets`, `can_create_assets`, `can_edit_assets`, `can_delete_assets`, `can_assign_assets`
- `can_manage_vms`, `can_view_vm_details`, `can_create_vms`, `can_edit_vms`, `can_delete_vms`, `can_assign_vms`

## Security Considerations

1. **Principle of Least Privilege**: Users only get the minimum permissions needed for their role
2. **Role Separation**: Clear separation between regular asset management and VM management
3. **HR Restriction**: HR roles explicitly denied asset management access unless they have specialized roles
4. **Permission Aggregation**: Multiple roles combine using OR logic (any role with permission grants access)

## Filtering Implementation

### Role-Centered vs User-Centered Access

**IMPORTANT**: Asset management access is **ROLE-CENTERED**, not user-centered. This means:

- **Office Admin** and **IT Helpdesk** see **ALL** assets/assignments of their allowed type across the entire organization
- They do **NOT** see only assets assigned to their team or themselves
- Access is based on **asset type** (VM vs regular), not on user relationships

### Asset Viewing Filters

1. **Office Admin**:
   - ✅ Can view **ALL** regular asset assignments (organization-wide)
   - ❌ Cannot view VM assignments
   - ✅ Can view **ALL** regular assets in the assets list (organization-wide)
   - ❌ Cannot view VMs in the assets list
   - ✅ Can view **ALL** regular asset requests and complaints

2. **IT Helpdesk**:
   - ✅ Can view **ALL** VM assignments (organization-wide)
   - ❌ Cannot view regular asset assignments
   - ✅ Can view **ALL** VMs in the VM table (organization-wide)
   - ❌ Cannot view regular assets in the assets list
   - ✅ Can view **ALL** VM-related requests and complaints

3. **Admin**:
   - ✅ Can view all asset assignments (regular + VMs)
   - ✅ Can view all assets and VMs

4. **Managers** (without Office Admin/IT Helpdesk roles):
   - ✅ Can view assets/assignments for their team members only (user-centered)
   - This is the exception - managers use user-centered filtering

### Implementation Details
- **Asset Filtering**: `roleBasedFilteredAssets` shows ALL assets of appropriate type for Office Admin/IT Helpdesk
- **Assignment Filtering**: `assignmentsData` shows ALL assignments of appropriate type for Office Admin/IT Helpdesk
- **VM Data Filtering**: `filteredVMData` ensures only users with VM permissions can see VM data
- **Complaints/Requests Filtering**: Shows ALL complaints/requests of appropriate asset type for Office Admin/IT Helpdesk
- **Helper Function**: `isVMAsset()` identifies VMs by checking category name or asset_tag prefix

### User's Own Assets (Dashboard)
The dashboard "My Assets" page shows the user's own assigned assets regardless of role. This is intentional as users should always see assets assigned to them personally.

## Future Enhancements

1. **Audit Logging**: Track asset management operations by role
2. **Department-based Restrictions**: Limit asset visibility by department
3. **Approval Workflows**: Require approval for certain asset operations
4. **Time-based Access**: Temporary role assignments with expiration dates
