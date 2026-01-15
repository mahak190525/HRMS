import React from 'react';
import { NavLink } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  variant?: 'default' | 'sidebar';
  isCollapsed?: boolean;
}

export function NotificationBell({ variant = 'default', isCollapsed = false }: NotificationBellProps) {
  const { notifications, unreadCount } = useNotifications();

  if (variant === 'sidebar') {
    return (
      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          cn(
            'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 backdrop-blur-sm no-underline',
            isActive && isCollapsed
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200/50'
              : isActive && !isCollapsed
              ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 shadow-md shadow-orange-200/30'
              : 'text-gray-700 hover:bg-orange-50/50 hover:text-orange-800 hover:shadow-sm',
            isCollapsed && 'justify-center px-2 w-full'
          )
        }
        title={isCollapsed ? 'Notifications' : undefined}
      >
        <span className={cn(
          'relative inline-flex items-center flex-shrink-0',
          !isCollapsed && 'mr-3'
        )}>
          {unreadCount > 0 ? (
            <BellRing className={cn('h-5 w-5 stroke-[2.5]')} />
          ) : (
            <Bell className={cn('h-5 w-5 stroke-[2.5]')} />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className={cn(
                'absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs bg-red-500 hover:bg-red-500 p-3 rounded-full',
                ''
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </span>
        {!isCollapsed && (
          <span>Notifications</span>
        )}
      </NavLink>
    );
  }

  // Default variant (header bell icon)
  const handleOpenPage = () => {
    window.location.href = '/notifications';
  };

  return (
    <Button
      variant="ghost"
      className={cn('relative hover:bg-orange-100/50 transition-colors cursor-pointer')}
      onClick={handleOpenPage}
    >
      <span className={cn('relative inline-flex items-center flex-shrink-0')}>
        {unreadCount > 0 ? (
          <BellRing className={cn('h-5 w-5 stroke-[2.5] text-orange-600')} />
        ) : (
          <Bell className={cn('h-5 w-5 stroke-[2.5] text-gray-600')} />
        )}
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className={cn(
              'absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs bg-red-500 hover:bg-red-500 p-3 rounded-full',
              ''
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </span>
    </Button>
  );
}