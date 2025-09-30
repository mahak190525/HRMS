import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { notificationApi } from '@/services/notificationApi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationApi.getUserNotifications(user!.id),
    enabled: !!user?.id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchInterval: 30 * 1000, // Fallback polling every 30 seconds
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread-count', user?.id],
    queryFn: () => notificationApi.getUnreadCount(user!.id),
    enabled: !!user?.id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchInterval: 30 * 1000, // Fallback polling every 30 seconds
  });

  const markAsRead = useMutation({
    mutationFn: notificationApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
    },
    onError: (error) => {
      console.error('Failed to mark notification as read:', error);
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      toast.success('All notifications marked as read');
    },
    onError: (error) => {
      console.error('Failed to mark all notifications as read:', error);
      toast.error('Failed to mark notifications as read');
    },
  });

  const deleteNotification = useMutation({
    mutationFn: notificationApi.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      toast.success('Notification deleted');
    },
    onError: (error) => {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    },
  });

  const deleteAllReadNotifications = useMutation({
    mutationFn: () => notificationApi.deleteAllReadNotifications(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      toast.success('All read notifications deleted');
    },
    onError: (error) => {
      console.error('Failed to delete read notifications:', error);
      toast.error('Failed to delete read notifications');
    },
  });
  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | undefined;

    const setupRealtime = async () => {
      try {
        unsubscribe = notificationApi.subscribeToNotifications(
          user.id,
          (newNotification) => {
            // Update the cache with the new notification
            queryClient.setQueryData(['notifications', user.id], (oldData: any) => {
              return oldData ? [newNotification, ...oldData] : [newNotification];
            });

            // Update unread count
            queryClient.setQueryData(['notifications-unread-count', user.id], (oldCount: number) => {
              return (oldCount || 0) + 1;
            });

            // Show toast notification
            toast.info(newNotification.title, {
              description: newNotification.message,
              duration: 5000,
            });
          }
        );
        setIsRealtimeConnected(true);
      } catch (error) {
        console.warn('Real-time notifications not available:', error);
        setIsRealtimeConnected(false);
        // Fallback to more frequent polling
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user.id] });
      }
    };

    setupRealtime();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id, queryClient]);

  return {
    notifications: notifications || [],
    unreadCount: unreadCount || 0,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllReadNotifications,
    isRealtimeConnected,
  };
}