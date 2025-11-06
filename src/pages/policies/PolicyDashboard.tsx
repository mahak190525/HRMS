import React from 'react';
import { useLocation } from 'react-router-dom';
import { 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePolicyDashboardPermissions } from '@/hooks/usePolicyDashboardPermissions';
import { AllPoliciesPage } from './AllPoliciesPage';
import { PolicyLogsPage } from './PolicyLogsPage';
import { PolicyPermissionsPage } from './PolicyPermissionsPage';
import { AssignPoliciesPage } from './AssignPoliciesPage';
import { PolicyHistoryPage } from './PolicyHistoryPage';

export const PolicyDashboard: React.FC = () => {
  const location = useLocation();
  
  const {
    canViewPolicies,
    canManagePermissions,
    canViewAnalytics,
    loading: permissionsLoading
  } = usePolicyDashboardPermissions();

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show access denied if user cannot view policies
  if (!canViewPolicies) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <Lock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to access the policies dashboard. Contact your administrator for access.
          </p>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              If you believe this is an error, please contact your system administrator.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Render content based on current path
  const renderContent = () => {
    const path = location.pathname;
    
    if (path === '/policies/logs') {
      if (!canViewAnalytics) {
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Access Restricted
              </h3>
              <p className="text-gray-600">
                You need analytics permissions to view policy activity logs.
              </p>
            </div>
          </div>
        );
      }
      return <PolicyLogsPage />;
    }
    
    if (path === '/policies/permissions') {
      if (!canManagePermissions) {
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Access Restricted
              </h3>
              <p className="text-gray-600">
                You need permission management access to configure policy permissions.
              </p>
            </div>
          </div>
        );
      }
      return <PolicyPermissionsPage />;
    }
    
    if (path === '/policies/assign') {
      return <AssignPoliciesPage />;
    }
    
    if (path === '/policies/history') {
      return <PolicyHistoryPage />;
    }
    
    // Default to All Policies page for /policies
    return <AllPoliciesPage />;
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default PolicyDashboard;
