import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  User, 
  UserCheck, 
  CheckCircle, 
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';

export function KRANotificationTest() {
  const { user } = useAuth();
  const { data: notifications, refetch } = useNotifications();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter KRA-related notifications
  const kraNotifications = notifications?.filter(n => 
    n.type?.startsWith('kra_')
  ) || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Notifications refreshed');
    } catch (error) {
      toast.error('Failed to refresh notifications');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'kra_assignment':
        return <User className="h-4 w-4" />;
      case 'kra_quarter_enabled':
        return <Clock className="h-4 w-4" />;
      case 'kra_submitted':
        return <UserCheck className="h-4 w-4" />;
      case 'kra_evaluated':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'kra_assignment':
        return 'bg-blue-100 text-blue-800';
      case 'kra_quarter_enabled':
        return 'bg-purple-100 text-purple-800';
      case 'kra_submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'kra_evaluated':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'kra_assignment':
        return 'Assignment';
      case 'kra_quarter_enabled':
        return 'Quarter Enabled';
      case 'kra_submitted':
        return 'Submitted';
      case 'kra_evaluated':
        return 'Evaluated';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              KRA Notification Test
            </CardTitle>
            <CardDescription>
              Monitor and test KRA-related notifications for user: {user?.name || user?.email}
            </CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {kraNotifications.filter(n => n.type === 'kra_assignment').length}
            </div>
            <div className="text-sm text-blue-600">Assignments</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {kraNotifications.filter(n => n.type === 'kra_quarter_enabled').length}
            </div>
            <div className="text-sm text-purple-600">Quarters Enabled</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {kraNotifications.filter(n => n.type === 'kra_submitted').length}
            </div>
            <div className="text-sm text-yellow-600">Submissions</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {kraNotifications.filter(n => n.type === 'kra_evaluated').length}
            </div>
            <div className="text-sm text-green-600">Evaluations</div>
          </div>
        </div>

        <Separator />

        {/* Notification List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent KRA Notifications</h3>
          
          {kraNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>No KRA notifications found</p>
              <p className="text-sm">Notifications will appear here when KRA activities occur</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kraNotifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg ${
                    notification.is_read ? 'bg-gray-50' : 'bg-white border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <Badge className={getNotificationColor(notification.type)}>
                            {getNotificationTypeLabel(notification.type)}
                          </Badge>
                          {!notification.is_read && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(notification.created_at)}
                        </div>
                        
                        {/* Additional data display */}
                        {notification.data && Object.keys(notification.data).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View Details
                            </summary>
                            <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(notification.data, null, 2)}
                              </pre>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Testing Instructions */}
        <Separator />
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Testing Instructions</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>To test KRA notifications:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li><strong>Assignment:</strong> Create and assign a new KRA template to an employee</li>
              <li><strong>Quarter Enable:</strong> Enable Q2, Q3, or Q4 for an existing assignment</li>
              <li><strong>Submission:</strong> As an employee, submit evidence for an enabled quarter</li>
              <li><strong>Evaluation:</strong> As a manager, evaluate submitted evidence</li>
            </ol>
            <p className="mt-2">
              <strong>Expected Recipients:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Assignment/Enable: Employee receives notification</li>
              <li>Submission: Manager receives notification</li>
              <li>Evaluation: Employee, HR, and Admin receive notifications</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
