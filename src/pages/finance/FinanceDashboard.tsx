import React from 'react';
import { useFinanceDashboardStats } from '@/hooks/useFinance';
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
  Receipt,
  Banknote,
  Plus,
  ArrowRight
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns';

export function FinanceDashboard() {
  const { data: stats, isLoading: statsLoading } = useFinanceDashboardStats();
  const navigate = useNavigate();

  const dashboardCards = [
    {
      title: 'Active Clients',
      value: stats?.activeClients || 0,
      description: 'Currently engaged clients',
      icon: Users,
      color: 'bg-gray-500',
      trend: '+3 this month',
    },
    {
      title: 'Unpaid Invoices',
      value: `$${(stats?.unpaidAmount || 0).toLocaleString()}`,
      description: `${stats?.unpaidCount || 0} invoices pending`,
      icon: FileText,
      color: 'bg-gray-500',
      trend: '-$8K from last month',
    },
    {
      title: 'Upcoming Invoices',
      value: stats?.upcomingInvoices || 0,
      description: 'Due for generation this week',
      icon: Calendar,
      color: 'bg-gray-500',
      trend: '5 clients scheduled',
    },
    {
      title: 'Unpaid Billing',
      value: `$${(stats?.unpaidBillingAmount || 0).toLocaleString()}`,
      description: 'Outstanding billing amounts',
      icon: AlertTriangle,
      color: 'bg-gray-500',
      trend: 'Requires follow-up',
    },
  ];

  const quickActions = [
    {
      title: 'Generate Payslips',
      description: 'Process monthly payroll',
      icon: Banknote,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/finance/payroll'),
    },
    {
      title: 'Create Invoice',
      description: 'Generate new invoice',
      icon: FileText,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/finance/billing?action=create-invoice'),
    },
    {
      title: 'Billing Records',
      description: 'Manage billing contracts',
      icon: Receipt,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/finance/billing'),
    },
  ];

  // Get upcoming invoice generation from real data
  const { data: upcomingInvoiceGeneration } = useQuery({
    queryKey: ['upcoming-invoice-generation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_records')
        .select('client_name, project_name, next_billing_date, contract_value')
        .gte('next_billing_date', new Date().toISOString().split('T')[0])
        .lte('next_billing_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('next_billing_date')
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
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
        <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor payroll, billing, and financial operations
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden hover:shadow-lg transition-shadow">
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
              <CardDescription>Frequently used finance operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <Button
                      key={action.title}
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2 hover:shadow-md transition-all"
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

          {/* Monthly Payroll Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Monthly Payroll Overview
              </CardTitle>
              <CardDescription>Current month payroll status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{stats?.totalEmployees || 0}</div>
                    <div className="text-xs text-muted-foreground">Total Employees</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">${(stats?.totalPayroll || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Payroll</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats?.payrollProcessed || 0}%</div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Payroll Processing</span>
                    <span>{stats?.payrollProcessed || 0}%</span>
                  </div>
                  <Progress value={stats?.payrollProcessed || 0} className="h-2" />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/finance/payroll')}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Manage Payroll
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Upcoming Invoice Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Invoices
              </CardTitle>
              <CardDescription>Scheduled for generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingInvoiceGeneration && upcomingInvoiceGeneration.length > 0 ? (
                  upcomingInvoiceGeneration.map((billing: any, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{billing.client_name}{billing.project_name ? ` - ${billing.project_name}` : ''}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(billing.next_billing_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Badge variant="outline">Due</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming invoices this week
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>Financial performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Collection Rate</span>
                    <span>92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Invoice Accuracy</span>
                    <span>98%</span>
                  </div>
                  <Progress value={98} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Payroll Processing</span>
                    <span>95%</span>
                  </div>
                  <Progress value={95} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest finance operations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-6">
                Recent activity will appear here as you process payroll and manage billing
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}