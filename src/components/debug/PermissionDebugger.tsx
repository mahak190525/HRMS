import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasUserDashboardAccess, hasUserPageAccess } from '@/utils/featureAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Info, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export function PermissionDebugger() {
  const { user } = useAuth();
  const { getAccessibleDashboards } = usePermissions();
  const [isVisible, setIsVisible] = useState(false);

  if (!user) return null;

  const accessibleDashboards = getAccessibleDashboards();

  // Test some specific permissions from the user data you provided
  const testPermissions = [
    { dashboard: 'self', page: 'overview', expected: true },
    { dashboard: 'self', page: 'leave', expected: true },
    { dashboard: 'employee_management', page: 'overview', expected: true },
    { dashboard: 'employee_management', page: 'assets', expected: false },
    { dashboard: 'ats', page: 'overview', expected: false },
    { dashboard: 'finance', page: 'overview', expected: false },
  ];

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          size="sm"
          variant="outline"
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Eye className="h-4 w-4 mr-2" />
          Debug Permisions
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[70vh] overflow-y-auto">
      <Card className="shadow-lg border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Permission Debugger</CardTitle>
            <Button
              onClick={() => setIsVisible(false)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Real-time permission status for current user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Info */}
          <div className="text-xs space-y-1">
            <p><strong>User:</strong> {user.full_name}</p>
            <p><strong>Role:</strong> {user.role?.name || user.role_id || 'Employee'}</p>
            <p><strong>Employee ID:</strong> {user.employee_id || 'Not assigned'}</p>
          </div>

          {/* Dashboard Access Summary */}
          <div>
            <h4 className="font-medium text-sm mb-2">Accessible Dashboards ({accessibleDashboards.length})</h4>
            <div className="space-y-1">
              {accessibleDashboards.map(dashboard => (
                <div key={dashboard.id} className="text-xs">
                  <Badge variant="secondary" className="mr-2">{dashboard.name}</Badge>
                  <span className="text-muted-foreground">
                    {dashboard.pages.length} page{dashboard.pages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Permission Tests */}
          <div>
            <h4 className="font-medium text-sm mb-2">Permission Tests</h4>
            <div className="space-y-2">
              {testPermissions.map((test, index) => {
                const dashboardAccess = hasUserDashboardAccess(user, test.dashboard);
                const pageAccess = hasUserPageAccess(user, test.dashboard, test.page);
                const isWorking = pageAccess === test.expected;

                return (
                  <div key={index} className="flex items-center gap-2 text-xs p-2 rounded border">
                    {isWorking ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {test.dashboard}.{test.page}
                      </div>
                      <div className="text-muted-foreground">
                        Expected: {test.expected ? 'Allow' : 'Deny'} | 
                        Actual: {pageAccess ? 'Allow' : 'Deny'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raw Permissions Data */}
          <div>
            <h4 className="font-medium text-sm mb-2">Raw Permissions</h4>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">View Raw Data</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(user.extra_permissions, null, 2)}
                  </pre>
                </details>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
