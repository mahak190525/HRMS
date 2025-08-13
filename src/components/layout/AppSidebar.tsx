import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  Home,
  Calendar,
  FileText,
  MessageSquare,
  Target,
  UserPlus,
  Settings,
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  LogOut,
  Building2,
  ChevronUp,
  ChevronLeft,
} from 'lucide-react';

const navigationItems = [
  {
    title: 'Personal',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: Home },
      { title: 'Leave Application', url: '/dashboard/leave', icon: Calendar },
      { title: 'Documents', url: '/dashboard/documents', icon: FileText },
      { title: 'Complaints', url: '/dashboard/complaints', icon: MessageSquare },
      { title: 'Performance', url: '/dashboard/performance', icon: Target },
      { title: 'Refer Someone', url: '/dashboard/referrals', icon: UserPlus },
      { title: 'Settings', url: '/dashboard/settings', icon: Settings },
    ],
  },
];

const managementItems = [
  { title: 'Employee Management', url: '/employees', icon: Users },
  { title: 'Performance', url: '/performance', icon: Target },
  { title: 'Grievance', url: '/grievance', icon: AlertTriangle },
  { title: 'BD Team', url: '/bd', icon: TrendingUp },
  { title: 'Finance', url: '/finance', icon: DollarSign },
  { title: 'ATS', url: '/ats', icon: UserCheck },
  { title: 'LMS', url: '/lms', icon: GraduationCap },
  { title: 'Exit', url: '/exit', icon: LogOut },
];

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { getAccessibleDashboards } = usePermissions();
  const location = useLocation();

  const accessibleDashboards = getAccessibleDashboards();
  const hasManagementAccess = accessibleDashboards.some(d => d.id !== 'self');

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col fixed left-0 top-0 h-screen z-50",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 mx-auto"
          >
            <Menu className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Mechlin HRMS</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Personal Navigation */}
        <div className="px-2">
          {!isCollapsed && (
            <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Personal
            </h3>
          )}
          <nav className="space-y-1">
            {navigationItems[0].items.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive && isCollapsed
                      ? 'bg-blue-600 text-white'
                      : isActive && !isCollapsed
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                    isCollapsed && 'justify-center px-2'
                  )
                }
                title={isCollapsed ? item.title : undefined}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")} />
                {!isCollapsed && <span>{item.title}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Management Navigation */}
        {hasManagementAccess && (
          <div className="px-2 mt-6">
            {!isCollapsed && (
              <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Management
              </h3>
            )}
            <nav className="space-y-1">
              {managementItems
                .filter(item => 
                  accessibleDashboards.some(d => 
                    item.url.includes(d.slug) || 
                    (item.title === 'Employee Management' && d.slug === 'employees')
                  )
                )
                .map((item) => (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                        isActive && isCollapsed
                          ? 'bg-blue-600 text-white'
                          : isActive && !isCollapsed
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                        isCollapsed && 'justify-center px-2'
                      )
                    }
                    title={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")} />
                    {!isCollapsed && <span>{item.title}</span>}
                  </NavLink>
                ))}
            </nav>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-auto p-2 hover:bg-gray-50",
                isCollapsed && "justify-center"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name} />
                <AvatarFallback>
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="ml-3 text-left flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize truncate">
                    {user?.role_id?.replace('_', ' ')}
                  </p>
                </div>
              )}
              {!isCollapsed && <ChevronUp className="ml-auto h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            side={isCollapsed ? "right" : "top"}
            align={isCollapsed ? "start" : "end"}
            sideOffset={8}
          >
            <DropdownMenuItem asChild>
              <NavLink to="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}