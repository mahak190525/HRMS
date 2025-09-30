import React from 'react';
import { useBDDashboardStats, useRecentBillingLogs } from '@/hooks/useBDTeam';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  Building,
  CreditCard,
  Target,
  BarChart3,
  History,
  Edit,
  Plus,
  User
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export function BDDashboard() {
  const { data: stats, isLoading: statsLoading } = useBDDashboardStats();
  const { data: recentLogs, isLoading: logsLoading, error: logsError } = useRecentBillingLogs(5);
  const navigate = useNavigate();

  const dashboardCards = [
    {
      title: 'Active Clients',
      value: stats?.activeClients || 0,
      description: 'Currently engaged clients',
      icon: Users,
      color: 'bg-gray-500',
      trend: '+2 this month',
    },
    {
      title: 'Unpaid Invoices',
      value: `$${(stats?.unpaidAmount || 0).toLocaleString()}`,
      description: `${stats?.unpaidCount || 0} invoices pending`,
      icon: FileText,
      color: 'bg-gray-500',
      trend: '-$15K from last month',
    },
    {
      title: 'Overdue Invoices',
      value: stats?.overdueCount || 0,
      description: 'Require immediate attention',
      icon: AlertTriangle,
      color: 'bg-gray-500',
      trend: '2 new this week',
    },
    {
      title: 'Total Contract Value',
      value: `$${(stats?.totalContractValue || 0).toLocaleString()}`,
      description: 'Active contracts',
      icon: DollarSign,
      color: 'bg-gray-500',
      trend: '+12% from last quarter',
    },
  ];

  const quickActions = [
    {
      title: 'Create Billing Record',
      description: 'Set up new client billing',
      icon: CreditCard,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/bd/billing?action=create'),
    },
    {
      title: 'Generate Invoice',
      description: 'Create new invoice',
      icon: FileText,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/bd/invoices?action=create'),
    },
    {
      title: 'View Billing Logs',
      description: 'Check recent changes',
      icon: BarChart3,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/bd/logs'),
    },
  ];

  // Get upcoming billings from API
  const { data: upcomingBillings } = useQuery({
    queryKey: ['upcoming-billings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_records')
        .select('client_name, project_name, contract_value, next_billing_date, billing_cycle')
        .gte('next_billing_date', new Date().toISOString().split('T')[0])
        .lte('next_billing_date', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('next_billing_date')
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BD Team Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor billing, invoices, and client relationships
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
                <div className="flex items-center pt-1">
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">{card.trend}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used BD operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <Button
                      key={action.title}
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2"
                      onClick={action.action}
                    >
                      <div className={`p-2 rounded-lg ${action.color}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{action.title}</div>
                        <div className="text-xs text-muted-foreground">{action.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Billing Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest billing and invoice changes</CardDescription>
            </CardHeader>
            <CardContent>
              {logsError && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Unable to load recent activity. This may be due to permissions or the logs table not being accessible.
                  </p>
                </div>
              )}
              {logsLoading ? (
                <LoadingSpinner size="sm" />
              ) : recentLogs && recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {recentLogs.map((log: any) => {
                    const getActionIcon = (action: string) => {
                      switch (action) {
                        case 'created':
                          return <Plus className="h-4 w-4 text-green-600" />;
                        case 'updated':
                          return <Edit className="h-4 w-4 text-blue-600" />;
                        case 'status_changed':
                          return <CheckCircle className="h-4 w-4 text-purple-600" />;
                        default:
                          return <History className="h-4 w-4 text-gray-600" />;
                      }
                    };

                    const getActionColor = (action: string) => {
                      switch (action) {
                        case 'created':
                          return 'bg-green-100';
                        case 'updated':
                          return 'bg-blue-100';
                        case 'status_changed':
                          return 'bg-purple-100';
                        default:
                          return 'bg-gray-100';
                      }
                    };

                    const getRecordInfo = () => {
                      if (log.billing_record) {
                        return `${log.billing_record.client_name}${log.billing_record.project_name ? ` - ${log.billing_record.project_name}` : ''}`;
                      } else if (log.invoice) {
                        return `${log.invoice.invoice_title}`;
                      }
                      return 'Unknown record';
                    };

                    return (
                      <div key={log.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className={`p-2 rounded-full ${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {log.action_type === 'created' && log.billing_record_id && 'New billing record created'}
                            {log.action_type === 'created' && log.invoice_id && 'New invoice created'}
                            {log.action_type === 'updated' && `${log.field_changed?.replace('_', ' ')} updated`}
                            {log.action_type === 'status_changed' && 'Status changed'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getRecordInfo()} • by {log.changed_by_user?.full_name} • {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                          {log.old_value && log.new_value && (
                            <p className="text-xs text-muted-foreground">
                              {log.old_value} → {log.new_value}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/bd/logs')}
                    >
                      View All Logs
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {logsError ? 'Unable to load activity logs' : 'No recent activity'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create or update billing records and invoices to see activity here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Upcoming Billings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Billings
              </CardTitle>
              <CardDescription>Next billing dates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingBillings && upcomingBillings.length > 0 ? upcomingBillings.map((billing, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{billing.client_name}</p>
                      <p className="text-xs text-muted-foreground">{billing.billing_cycle.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${billing.contract_value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(billing.next_billing_date), 'MMM dd')}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming billings in the next 2 weeks
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>BD performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Collection Rate</span>
                    <span>{stats ? Math.round(((stats.totalContractValue - stats.unpaidAmount) / stats.totalContractValue) * 100) : 0}%</span>
                  </div>
                  <Progress value={stats ? Math.round(((stats.totalContractValue - stats.unpaidAmount) / stats.totalContractValue) * 100) : 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Active Clients</span>
                    <span>{stats?.activeClients || 0}</span>
                  </div>
                  <Progress value={stats?.activeClients ? Math.min((stats.activeClients / 10) * 100, 100) : 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Unpaid Invoices</span>
                    <span>{stats?.unpaidCount || 0}</span>
                  </div>
                  <Progress value={stats?.unpaidCount ? Math.min((stats.unpaidCount / 20) * 100, 100) : 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}