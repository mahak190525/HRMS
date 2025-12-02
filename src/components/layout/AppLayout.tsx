import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AppSidebar } from './AppSidebar';
import { DashboardSwitcher } from './DashboardSwitcher';
import { PermissionDebugger } from '@/components/debug/PermissionDebugger';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { loading } = useAuth();
  const { getAccessibleDashboards, rolePermissionsLoading } = usePermissions();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine current dashboard based on URL
  const getCurrentDashboard = () => {
    const path = location.pathname;
    const dashboards = getAccessibleDashboards();
    
    if (path.startsWith('/dashboard')) return dashboards.find(d => d.id === 'self');
    if (path.startsWith('/employees')) return dashboards.find(d => d.id === 'employee_management');
    if (path.startsWith('/performance')) return dashboards.find(d => d.id === 'performance');
    if (path.startsWith('/grievance')) return dashboards.find(d => d.id === 'grievance');
    if (path.startsWith('/bd')) return dashboards.find(d => d.id === 'bd_team');
    if (path.startsWith('/finance')) return dashboards.find(d => d.id === 'finance');
    if (path.startsWith('/ats')) return dashboards.find(d => d.id === 'ats');
    if (path.startsWith('/lms')) return dashboards.find(d => d.id === 'lms');
    if (path.startsWith('/exit')) return dashboards.find(d => d.id === 'exit');
    if (path.startsWith('/policies')) return dashboards.find(d => d.id === 'policies');
    return dashboards[0];
  };

  const currentDashboard = getCurrentDashboard();
  if (loading || rolePermissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-100 relative overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-yellow-200/40 rounded-full blur-lg"></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-amber-200/25 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-orange-300/20 rounded-full blur-xl"></div>
      </div>
      <AppSidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        currentDashboard={currentDashboard}
      />
      <main className={cn(
        "transition-all duration-300 ease-in-out relative z-10 h-screen",
        sidebarCollapsed ? "ml-20" : "ml-68"
      )}>
        <div className="p-6 pr-4 h-full max-w-8xl mx-auto relative flex flex-col">
          <DashboardSwitcher />
          <div className="mt-6 flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </div>
      </main>
      
      {/* Permission Debugger - only in development */}
      {/* {process.env.NODE_ENV === 'development' && <PermissionDebugger />} */}
    </div>
  );
}