import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

export function Sidebar() {
  const { user } = useAuth();
  const { getAccessibleDashboards } = usePermissions();

  const dashboards = getAccessibleDashboards();

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-lg lg:block hidden">
      <div className="flex h-16 items-center justify-center border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Mechlin HRMS</h1>
      </div>
      
      <nav className="mt-6 px-4">
        <div className="space-y-2">
          {dashboards.map((dashboard) => {
            const IconComponent = Icons[dashboard.icon as keyof typeof Icons] as React.ComponentType<any>;
            
            return (
              <NavLink
                key={dashboard.id}
                to={dashboard.pages[0]?.path || `/${dashboard.slug}`}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <IconComponent className="mr-3 h-5 w-5 flex-shrink-0" />
                {dashboard.name}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.position}</p>
          </div>
        </div>
      </div>
    </div>
  );
}