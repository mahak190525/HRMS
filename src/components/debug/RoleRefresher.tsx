import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleDisplay, RoleList } from '@/components/ui/role-display';
import { RefreshCw } from 'lucide-react';

/**
 * Debug component to manually refresh user roles and display current role data
 * Useful for testing multiple role functionality
 */
export function RoleRefresher() {
  const { user, refreshUserRoles } = useAuth();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUserRoles();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Role Refresher</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No user logged in</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Role Refresher
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">Current User</h4>
          <p className="text-sm">{user.full_name} ({user.email})</p>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Role Overview</h4>
          <RoleDisplay user={user} variant="detailed" />
        </div>

        <div>
          <h4 className="font-semibold mb-2">Complete Role List</h4>
          <RoleList user={user} />
        </div>

        <div>
          <h4 className="font-semibold mb-2">Raw Role IDs</h4>
          <div className="text-xs space-y-1">
            <div>Primary: <code>{user.role_id || 'none'}</code></div>
            <div>Additional: <code>{JSON.stringify(user.additional_role_ids || [])}</code></div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Click "Refresh" to fetch the latest role data from the database.
          This is useful when roles have been updated but the UI hasn't reflected the changes.
        </div>
      </CardContent>
    </Card>
  );
}
