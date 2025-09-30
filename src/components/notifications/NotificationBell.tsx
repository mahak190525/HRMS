import React from 'react';
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

  const handleOpenPage = () => {
    window.location.href = '/notifications';
  };

  const triggerClasses = variant === 'sidebar'
    ? cn(
        'group flex items-center text-sm font-medium rounded-xl transition-all duration-200 backdrop-blur-sm',
        'text-gray-700 hover:bg-orange-50/50 hover:text-orange-800 hover:shadow-sm',
        isCollapsed ? 'justify-center px-2 py-2.5 w-full' : 'justify-start px-3 py-2.5 w-full'
      )
    : 'relative hover:bg-orange-100/50 transition-colors';

  return (
    <Button
      variant="ghost"
      className={triggerClasses}
      title={isCollapsed && variant === 'sidebar' ? 'Notifications' : undefined}
      onClick={handleOpenPage}
    >
      <span className={cn(
        'relative inline-flex items-center flex-shrink-0',
        variant === 'sidebar' && !isCollapsed && 'mr-3'
      )}>
        {unreadCount > 0 ? (
          <BellRing className={cn('h-5 w-5 stroke-[2.5]', variant === 'sidebar' ? 'text-orange-600' : 'text-orange-600')} />
        ) : (
          <Bell className={cn('h-5 w-5 stroke-[2.5]', variant === 'sidebar' ? 'text-gray-700' : 'text-gray-600')} />
        )}
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className={cn(
              'absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-500',
              ''
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </span>
      {variant === 'sidebar' && !isCollapsed && (
        <span>Notifications</span>
      )}
    </Button>
  );
}