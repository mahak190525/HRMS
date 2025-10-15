import React, { useState } from 'react';
import { useBillingLogs, useBillingRecords, useInvoices } from '@/hooks/useBDTeam';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History,
  Filter,
  Download,
  FileText,
  Receipt,
  Edit,
  Plus,
  User,
  AlertTriangle
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function BillingLogs() {
  const { data: billingRecords } = useBillingRecords();
  const { data: invoices } = useInvoices();
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  
  const { data: logs, isLoading: logsLoading, error: logsError } = useBillingLogs(
    selectedRecordId || undefined, 
    selectedInvoiceId || undefined
  );

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = log.changed_by_user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.field_changed?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.old_value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.new_value?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = !actionFilter || actionFilter === 'all' || log.action_type === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const handleDownloadLogs = () => {
    if (!filteredLogs) return;
    
    // Create CSV content
    const headers = ['Date', 'User', 'Action', 'Field Changed', 'Old Value', 'New Value', 'Record Type'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        formatDateForDisplay(log.created_at, 'yyyy-MM-dd HH:mm:ss'),
        `"${log.changed_by_user?.full_name || ''}"`,
        log.action_type,
        log.field_changed || '',
        `"${log.old_value || ''}"`,
        `"${log.new_value || ''}"`,
        log.billing_record_id ? 'Billing Record' : 'Invoice'
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_logs_${formatDateForDisplay(getCurrentISTDate(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getActionBadge = (action: string) => {
    const variants = {
      created: 'bg-green-100 text-green-800',
      updated: 'bg-blue-100 text-blue-800',
      deleted: 'bg-red-100 text-red-800',
      assigned: 'bg-purple-100 text-purple-800',
      status_changed: 'bg-orange-100 text-orange-800',
    };
    return variants[action as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'assigned':
        return <User className="h-4 w-4 text-purple-600" />;
      default:
        return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  // Debug logging
  React.useEffect(() => {
    if (logsError) {
      console.error('Billing logs error:', logsError);
    }
    if (logs) {
      console.log('Billing logs data:', logs);
    }
  }, [logs, logsError]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing Logs</h1>
          <p className="text-muted-foreground">
            Track all changes and edits to billing records and invoices
          </p>
        </div>
        <Button onClick={handleDownloadLogs} variant="outline" disabled={!filteredLogs?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={selectedRecordId} onValueChange={(value) => setSelectedRecordId(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Billing Records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Billing Records</SelectItem>
                  {billingRecords?.map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {record.client_name} {record.project_name && `- ${record.project_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedInvoiceId} onValueChange={(value) => setSelectedInvoiceId(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Invoices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invoices</SelectItem>
                  {invoices?.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={actionFilter} onValueChange={(value) => setActionFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="status_changed">Status Changed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRecordId('');
                  setSelectedInvoiceId('');
                  setActionFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Information */}
      {logsError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Error loading billing logs</p>
                <p className="text-sm text-red-700">
                  {logsError.message || 'Unable to fetch billing logs. Please check permissions.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
          <CardDescription>
            Complete audit trail of all billing and invoice changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <LoadingSpinner size="sm" />
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record Type</TableHead>
                  <TableHead>Field Changed</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {formatDateForDisplay(log.created_at, 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateForDisplay(log.created_at, 'HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {log.changed_by_user?.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{log.changed_by_user?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        <Badge className={getActionBadge(log.action_type)}>
                          {log.action_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {log.billing_record_id ? (
                          <>
                            <Receipt className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">Billing Record</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm">Invoice</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">
                        {log.field_changed || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.old_value && log.new_value ? (
                        <div className="text-xs">
                          <div className="text-red-600">- {log.old_value}</div>
                          <div className="text-green-600">+ {log.new_value}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {log.action_type === 'created' ? 'Record created' : 'No changes'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Logs Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedRecordId || selectedInvoiceId || actionFilter
                  ? 'No logs match your current filters.'
                  : 'No activity logs available yet. Try creating or updating a billing record or invoice to see logs here.'}
              </p>
              {logsError && (
                <p className="text-sm text-red-600 mt-2">
                  Error: {logsError.message}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}