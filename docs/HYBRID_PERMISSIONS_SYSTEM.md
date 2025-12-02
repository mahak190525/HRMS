# Hybrid Permissions System

## Overview
The permission system uses a **combination of role-level permissions AND individual user permissions**. This allows for:
- **Role-based access**: Most users get permissions through their role(s)
- **Individual overrides**: Specific users can be granted or denied access to dashboards/pages that their role doesn't normally have

## Permission Priority

The system checks permissions in this order:

1. **Admin Check**: Admin users have full access (bypasses all checks)
2. **Individual User Permissions** (`extra_permissions`): Explicit user-level overrides
3. **Role-Level Permissions** (`roles.dashboard_permissions` / `roles.page_permissions`): Permissions from user's role(s)
4. **Legacy Fallback** (`ROLE_DASHBOARD_MAPPING`): For backward compatibility

## How It Works

### Dashboard Access

```typescript
hasUserDashboardAccess(user, dashboardId, rolePermissions)
```

**Logic:**
1. If user is admin → ✅ Allow
2. If `user.extra_permissions.dashboards[dashboardId]` is explicitly set:
   - `true` → ✅ Allow
   - `false` → ❌ Deny
3. If role has `view: true` or `read: true` for dashboard → ✅ Allow
4. If dashboard is in `ROLE_DASHBOARD_MAPPING` for user's role → ✅ Allow
5. Otherwise → ❌ Deny

### Page Access

```typescript
hasUserPageAccess(user, dashboardId, pageId, rolePermissions)
```

**Logic:**
1. If user doesn't have dashboard access → ❌ Deny
2. If user is admin → ✅ Allow
3. If `user.extra_permissions.pages[dashboardId][pageId]` is explicitly set:
   - `true` → ✅ Allow
   - `false` → ❌ Deny
4. If role has `view: true` or `read: true` for page → ✅ Allow
5. If dashboard has `view: true` or `read: true` → ✅ Allow (inherit)
6. If dashboard is accessible via `ROLE_DASHBOARD_MAPPING` → ✅ Allow
7. Otherwise → ❌ Deny

## Use Cases

### Case 1: Role-Based Access (Default)
- **Scenario**: All HR users should have access to Employee Management dashboard
- **Solution**: Configure role permissions in `roles.dashboard_permissions` for HR role
- **Result**: All users with HR role automatically get access

### Case 2: Individual User Override (Grant)
- **Scenario**: A specific employee needs access to Finance dashboard, but their role doesn't normally have it
- **Solution**: Set `user.extra_permissions.dashboards.finance = true` for that user
- **Result**: Only that specific user gets access, others with the same role don't

### Case 3: Individual User Override (Deny)
- **Scenario**: A user with HR role should NOT have access to a specific page
- **Solution**: Set `user.extra_permissions.pages[dashboardId][pageId] = false` for that user
- **Result**: That user is denied access even though their role normally allows it

### Case 4: Combination
- **Scenario**: User has role-based access to Employee Management, but needs additional access to Finance
- **Solution**: 
  - Role permissions grant Employee Management access
  - Individual permission grants Finance access: `user.extra_permissions.dashboards.finance = true`
- **Result**: User has access to both dashboards

## Permission Structure

### Individual User Permissions (`extra_permissions`)

```json
{
  "dashboards": {
    "finance": true,           // Grant access
    "employee_management": false // Deny access (overrides role)
  },
  "pages": {
    "employee_management": {
      "assets": true,          // Grant page access
      "overview": false        // Deny page access (overrides role)
    }
  },
  "crud": {
    "employee_management": {
      "read": true,
      "write": false
    }
  }
}
```

### Role-Level Permissions (`roles.dashboard_permissions` / `roles.page_permissions`)

```json
{
  "dashboard_permissions": {
    "employee_management": {
      "read": true,
      "write": true,
      "view": true,
      "delete": false
    }
  },
  "page_permissions": {
    "employee_management": {
      "overview": {
        "read": true,
        "write": true,
        "view": true,
        "delete": false
      }
    }
  }
}
```

## Implementation Details

### Updated Functions

All permission checking functions now support both sources:

- ✅ `hasUserDashboardAccess()` - Checks both role and individual permissions
- ✅ `hasUserPageAccess()` - Checks both role and individual permissions
- ✅ `getUserAccessibleDashboards()` - Combines both sources
- ✅ `getUserAccessiblePages()` - Combines both sources
- ✅ `getUserEffectivePermissions()` - Aggregates both sources
- ✅ `hasCrudAccess()` - Checks both role and individual CRUD permissions

### Permission Aggregation

When a user has multiple roles:
- **Role permissions**: Combined with OR logic (if any role has permission, user has it)
- **Individual permissions**: Override role permissions (explicit true/false takes precedence)

## Best Practices

1. **Use Role Permissions for Defaults**: Configure role permissions for standard access patterns
2. **Use Individual Permissions Sparingly**: Only for exceptions and special cases
3. **Document Overrides**: Keep track of why individual permissions were granted
4. **Regular Audits**: Review individual permissions periodically to ensure they're still needed
5. **Clear Naming**: Use descriptive role names that indicate their access level

## Examples

### Example 1: Granting Special Access

```typescript
// User: john@example.com
// Role: employee (normally only has 'self' dashboard)

// Grant access to Finance dashboard
user.extra_permissions = {
  dashboards: {
    finance: true
  }
}

// Result: John can now see Finance dashboard even though his role doesn't normally allow it
```

### Case 2: Denying Access

```typescript
// User: jane@example.com
// Role: hr (normally has access to Employee Management)

// Deny access to Asset Management page
user.extra_permissions = {
  pages: {
    employee_management: {
      assets: false
    }
  }
}

// Result: Jane cannot see Asset Management page even though her HR role normally allows it
```

## Migration Notes

- Existing `extra_permissions` data will continue to work
- Role-level permissions take precedence when individual permissions are not set
- Individual permissions can override role permissions when explicitly set
- The system gracefully handles missing permissions (defaults to role-based access)

## Testing

To test the hybrid system:

1. **Test Role Permissions**: Verify users with a role see appropriate dashboards/pages
2. **Test Individual Override (Grant)**: Grant a user access to something their role doesn't have
3. **Test Individual Override (Deny)**: Deny a user access to something their role normally has
4. **Test Combination**: Verify users with both role and individual permissions see the union of both

