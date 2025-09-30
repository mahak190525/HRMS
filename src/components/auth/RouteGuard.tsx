import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isPathAccessible } from '@/utils/featureAccess';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredDashboard?: string;
  requiredPage?: string;
}

export function RouteGuard({ 
  children, 
  requiredDashboard, 
  requiredPage 
}: RouteGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has access to the current path
  const hasAccess = isPathAccessible(user, location.pathname);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-100 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="mt-20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <Shield className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Insufficient Permissions:</strong> Your current role doesn't include access to this feature. 
                  Contact your administrator if you believe this is an error.
                </AlertDescription>
              </Alert>
              
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>Current Path:</strong> {location.pathname}</p>
                <p><strong>Your Role:</strong> {user.role?.name || user.role_id || 'Employee'}</p>
                <p><strong>Employee ID:</strong> {user.employee_id || 'Not assigned'}</p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => window.history.back()}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
                <Button
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Higher-order component for easy route protection
export function withRouteGuard<T extends object>(
  Component: React.ComponentType<T>,
  requiredDashboard?: string,
  requiredPage?: string
) {
  return function GuardedComponent(props: T) {
    return (
      <RouteGuard 
        requiredDashboard={requiredDashboard} 
        requiredPage={requiredPage}
      >
        <Component {...props} />
      </RouteGuard>
    );
  };
}
