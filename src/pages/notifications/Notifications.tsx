import React from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Trash2 } from 'lucide-react';

export function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const unread = notifications.filter(n => !n.is_read);

  const go = (n: any) => {
    const target = n?.data?.target as string | undefined;
    const tab = n?.data?.tab as string | undefined;
    if (target) {
      window.location.href = tab ? `/${target}?tab=${encodeURIComponent(tab)}` : `/${target}`;
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Notifications</CardTitle>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={() => markAllAsRead.mutateAsync()} disabled={markAllAsRead.isPending}>
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unread">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
              <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="unread" className="mt-4">
              <ScrollArea className="h-[70vh]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10"><LoadingSpinner /></div>
                ) : unread.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><Bell className="mx-auto mb-2" />No unread notifications</div>
                ) : (
                  <div className="space-y-2">
                    {unread.map(n => (
                      <div key={n.id} className="flex items-start gap-3 p-3 rounded-md border hover:bg-orange-50/40" onClick={() => go(n)}>
                        <div className="shrink-0 mt-1"><Bell className="h-4 w-4 text-orange-600" /></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{n.title}</div>
                            <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">{n.message}</div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markAsRead.mutateAsync(n.id); }}>
                              <Check className="h-3 w-3 mr-1" /> Mark read
                            </Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteNotification.mutateAsync(n.id); }}>
                              <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-[70vh]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10"><LoadingSpinner /></div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><Bell className="mx-auto mb-2" />No notifications yet</div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(n => (
                      <div key={n.id} className="flex items-start gap-3 p-3 rounded-md border hover:bg-orange-50/40" onClick={() => go(n)}>
                        <div className="shrink-0 mt-1"><Bell className="h-4 w-4 text-orange-600" /></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{n.title}</div>
                            <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">{n.message}</div>
                          <div className="flex gap-2 mt-2">
                            {!n.is_read && (
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markAsRead.mutateAsync(n.id); }}>
                                <Check className="h-3 w-3 mr-1" /> Mark read
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteNotification.mutateAsync(n.id); }}>
                              <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default NotificationsPage;