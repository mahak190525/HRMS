import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as Icons from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function DashboardSwitcher() {
  const { user } = useAuth();
  const { getAccessibleDashboards } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const dashboards = getAccessibleDashboards();
  
  // Determine current dashboard based on URL
  const getCurrentDashboard = () => {
    const path = location.pathname;
    // Use exact path matching to avoid conflicts
    if (path === '/dashboard' || path.startsWith('/dashboard/')) return dashboards.find(d => d.id === 'self');
    if (path === '/employees' || path.startsWith('/employees/')) return dashboards.find(d => d.id === 'employee_management');
    if (path === '/performance' || path.startsWith('/performance/')) return dashboards.find(d => d.id === 'performance');
    if (path === '/grievance' || path.startsWith('/grievance/')) return dashboards.find(d => d.id === 'grievance');
    if (path === '/bd' || path.startsWith('/bd/')) return dashboards.find(d => d.id === 'bd_team');
    if (path === '/finance' || path.startsWith('/finance/')) return dashboards.find(d => d.id === 'finance');
    if (path === '/ats' || path.startsWith('/ats/')) return dashboards.find(d => d.id === 'ats');
    if (path === '/lms' || path.startsWith('/lms/')) return dashboards.find(d => d.id === 'lms');
    if (path === '/exit' || path.startsWith('/exit/')) return dashboards.find(d => d.id === 'exit');
    if (path === '/policies' || path.startsWith('/policies/')) return dashboards.find(d => d.id === 'policies');
    return dashboards[0];
  };

  const currentDashboard = getCurrentDashboard();

  const handleDashboardSwitch = (dashboard: any) => {
    // Ensure we have a valid path and navigate properly
    const targetPath = dashboard.pages[0]?.path || `/${dashboard.slug}`;
    
    // Only navigate if we're not already on the target path
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: false });
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-orange-200/40 rounded-2xl shadow-xl shadow-orange-200/20 mb-6 p-2">
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:thin]">
        {dashboards.map((dashboard) => {
          const IconComponent = Icons[dashboard.icon as keyof typeof Icons] as React.ComponentType<any>;
          const isActive = currentDashboard?.id === dashboard.id;
          
          return (
            <Button
              variant="ghost"
              key={dashboard.id}
              onClick={() => handleDashboardSwitch(dashboard)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap min-w-fit backdrop-blur-sm border-0 h-auto",
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200/50"
                  : "text-orange-700 hover:text-orange-800 hover:bg-orange-100/60 hover:shadow-md disabled:opacity-100"
              )}
            >
              <IconComponent className="h-4 w-4" />
              {dashboard.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}