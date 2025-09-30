import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  hasUserDashboardAccess, 
  hasUserPageAccess, 
  getUserNavigationItems,
  createPermissionChecker,
  FEATURE_FLAGS,
  hasFeatureAccess
} from '@/utils/featureAccess';
import { Info, CheckCircle, XCircle, Users, Shield } from 'lucide-react';
import type { User } from '@/types';

interface FeatureAccessExampleProps {
  user: User;
}

export function FeatureAccessExample({ user }: FeatureAccessExampleProps) {
  const permissionChecker = createPermissionChecker(user);
  const navigationItems = getUserNavigationItems(user);

  // Example checks
  const canAccessEmployeeManagement = hasUserDashboardAccess(user, 'employee_management');
  const canAccessAssetsPage = hasUserPageAccess(user, 'employee_management', 'assets');
  const canAccessFinanceDashboard = hasUserDashboardAccess(user, 'finance');
  const canManageAssets = hasFeatureAccess(user, FEATURE_FLAGS.ASSET_MANAGEMENT);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Feature-Level Access Control Demo</h2>
        <p className="text-muted-foreground">
          Demonstrating how the new feature-level access system works for {user.full_name}
        </p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Name:</p>
              <p className="text-muted-foreground">{user.full_name}</p>
            </div>
            <div>
              <p className="font-medium">Role:</p>
              <p className="text-muted-foreground capitalize">{user.role?.name || 'No role'}</p>
            </div>
            <div>
              <p className="font-medium">Employee ID:</p>
              <p className="text-muted-foreground">{user.employee_id || 'Not assigned'}</p>
            </div>
            <div>
              <p className="font-medium">Department:</p>
              <p className="text-muted-foreground">{user.department?.name || 'Not assigned'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Checks
          </CardTitle>
          <CardDescription>
            Examples of how feature-level access control works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {canAccessEmployeeManagement ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Employee Management Dashboard</p>
                  <p className="text-xs text-muted-foreground">
                    {canAccessEmployeeManagement ? 'Access granted' : 'Access denied'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {canAccessAssetsPage ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Asset Management Page</p>
                  <p className="text-xs text-muted-foreground">
                    {canAccessAssetsPage ? 'Page accessible' : 'Page restricted'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {canAccessFinanceDashboard ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Finance Dashboard</p>
                  <p className="text-xs text-muted-foreground">
                    {canAccessFinanceDashboard ? 'Access granted' : 'Access denied'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {canManageAssets ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Asset Management Feature</p>
                  <p className="text-xs text-muted-foreground">
                    {canManageAssets ? 'Feature enabled' : 'Feature disabled'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Items */}
      <Card>
        <CardHeader>
          <CardTitle>Accessible Navigation</CardTitle>
          <CardDescription>
            Dashboards and pages this user can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {navigationItems.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No accessible dashboards found for this user.
                </AlertDescription>
              </Alert>
            ) : (
              navigationItems.map(({ dashboard, pages }) => (
                <div key={dashboard.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-medium">
                      {dashboard.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {pages.length} page{pages.length !== 1 ? 's' : ''} accessible
                    </span>
                  </div>
                  <div className="pl-4 space-y-1">
                    {pages.map(page => (
                      <div key={page.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>{page.name}</span>
                        <span className="text-xs text-muted-foreground">({page.path})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Helper Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Helper Usage</CardTitle>
          <CardDescription>
            How to use the permission checker in your components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Example usage in components:</strong>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
{`// In your component
const permissions = createPermissionChecker(user);

// Check dashboard access
if (permissions.canAccessDashboard('employee_management')) {
  // Show Employee Management link
}

// Check page access  
if (permissions.canAccessPage('employee_management', 'assets')) {
  // Show Asset Management page
}

// Check path access
if (permissions.canAccessPath('/employees/assets')) {
  // Allow navigation to this path
}`}
                </pre>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Available Feature Flags</CardTitle>
          <CardDescription>
            System-wide feature flags that can be enabled for users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(FEATURE_FLAGS).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 p-2 rounded border">
                {hasFeatureAccess(user, value) ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm font-mono">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
