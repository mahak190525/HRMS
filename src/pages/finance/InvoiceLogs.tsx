import { useState } from 'react';
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllInvoiceLogs, useFinanceInvoices } from '@/hooks/useFinance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Filter,
  Eye,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  Search,
  FileText,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

export function InvoiceLogs() {
  const { user } = useAuth();
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isViewLogDialogOpen, setIsViewLogDialogOpen] = useState(false);

  const { data: logsData, isLoading, refetch } = useAllInvoiceLogs(limit, offset);
  const { data: invoices } = useFinanceInvoices();

  // Get unique users from logs for filter dropdown
  const uniqueUsers = logsData?.logs ? 
    [...new Set(logsData.logs.map(log => log.changed_by_name))].filter(Boolean).sort() : [];

  // Filter logs based on search criteria
  const filteredLogs = logsData?.logs?.filter(log => {
    const matchesSearch = !searchTerm || 
      log.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.changed_by_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.field_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = !actionFilter || actionFilter === 'all' || log.action === actionFilter;
    const matchesLogType = !logTypeFilter || logTypeFilter === 'all' || log.log_type === logTypeFilter;
    const matchesUser = !userFilter || userFilter === 'all' || log.changed_by_name === userFilter;

    // Date range filter
    let matchesDateRange = true;
    if (dateRangeFilter.from || dateRangeFilter.to) {
      const logDate = parseToISTDate(log.created_at);
      if (dateRangeFilter.from && logDate < dateRangeFilter.from) {
        matchesDateRange = false;
      }
      if (dateRangeFilter.to && logDate > dateRangeFilter.to) {
        matchesDateRange = false;
      }
    }

    return matchesSearch && matchesAction && matchesLogType && matchesUser && matchesDateRange;
  }) || [];

  const getActionBadge = (action: string) => {
    const variants = {
      created: 'bg-green-100 text-green-800',
      updated: 'bg-blue-100 text-blue-800',
      deleted: 'bg-red-100 text-red-800',
      status_changed: 'bg-purple-100 text-purple-800',
    };
    return variants[action as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getLogTypeBadge = (logType: string) => {
    const variants = {
      invoice: 'bg-blue-100 text-blue-800',
      task: 'bg-orange-100 text-orange-800',
    };
    return variants[logType as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const exportLogsToCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      alert('No logs to export');
      return;
    }

    const headers = [
      'Date/Time',
      'Invoice Number',
      'Client Name',
      'Log Type',
      'Action',
      'Field Changed',
      'Old Value',
      'New Value',
      'Changed By',
      'Reason'
    ];

    const csvData = filteredLogs.map(log => [
      formatDateForDisplay(log.created_at, 'yyyy-MM-dd HH:mm:ss'),
      log.invoice_number || '',
      log.client_name || '',
      log.log_type || '',
      log.action || '',
      log.field_name || '',
      formatValue(log.old_value),
      formatValue(log.new_value),
      log.changed_by_name || '',
      log.change_reason || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoice_logs_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + limit);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Change Logs</h1>
          <p className="text-muted-foreground">
            Track all changes made to invoices and tasks for audit purposes
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={exportLogsToCSV}
            disabled={!filteredLogs || filteredLogs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export ({filteredLogs?.length || 0})
          </Button>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <Label className="text-sm font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="status_changed">Status Changed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Log Type</Label>
              <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Changed By</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map((userName) => (
                    <SelectItem key={userName} value={userName}>
                      {userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      (!dateRangeFilter.from && !dateRangeFilter.to) && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {dateRangeFilter.from ? (
                        dateRangeFilter.to ? (
                          <>
                            {formatDateForDisplay(dateRangeFilter.from, "MMM dd")} -{" "}
                            {formatDateForDisplay(dateRangeFilter.to, "MMM dd, yyyy")}
                          </>
                        ) : (
                          formatDateForDisplay(dateRangeFilter.from, "MMM dd, yyyy")
                        )
                      ) : (
                        "Pick date range"
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRangeFilter.from}
                    selected={{
                      from: dateRangeFilter.from,
                      to: dateRangeFilter.to,
                    }}
                    onSelect={(range) => {
                      setDateRangeFilter({
                        from: range?.from,
                        to: range?.to,
                      });
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setActionFilter('');
                setLogTypeFilter('');
                setUserFilter('');
                setDateRangeFilter({ from: undefined, to: undefined });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Change Logs
          </CardTitle>
          <CardDescription>
            Showing {filteredLogs?.length || 0} of {logsData?.total || 0} log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Type & Action</TableHead>
                <TableHead>Field Changed</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.map((log) => (
                <TableRow key={`${log.log_type}-${log.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        <div>{formatDateForDisplay(log.created_at, 'MMM dd, yyyy')}</div>
                        <div className="text-muted-foreground">
                          {formatDateForDisplay(log.created_at, 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{log.client_name}</div>
                      {log.log_type === 'task' && log.task_name && (
                        <div className="text-xs text-blue-600">Task: {log.task_name}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={getLogTypeBadge(log.log_type)}>
                        {log.log_type}
                      </Badge>
                      <Badge className={getActionBadge(log.action)}>
                        {log.action.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {log.field_name || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {log.changed_by_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <div className="font-medium">{log.changed_by_name}</div>
                        <div className="text-muted-foreground text-xs">{log.changed_by_email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedLog(log);
                        setIsViewLogDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Load More Button */}
          {logsData?.hasMore && (
            <div className="flex justify-center mt-4">
              <Button 
                variant="outline" 
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Log Details Dialog */}
      <Dialog open={isViewLogDialogOpen} onOpenChange={(open) => {
        setIsViewLogDialogOpen(open);
        if (!open) {
          setSelectedLog(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Log Entry Details</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Detailed information about this change
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Date & Time</Label>
                  <div className="text-sm font-semibold">
                    {formatDateForDisplay(selectedLog.created_at, 'PPP p')}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Invoice</Label>
                  <div className="text-sm font-semibold">
                    {selectedLog.invoice_number} - {selectedLog.client_name}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Log Type</Label>
                  <Badge className={getLogTypeBadge(selectedLog.log_type)}>
                    {selectedLog.log_type}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Action</Label>
                  <Badge className={getActionBadge(selectedLog.action)}>
                    {selectedLog.action.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Changed By</Label>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedLog.changed_by_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedLog.changed_by_name}</span>
                  </div>
                </div>
              </div>

              {/* Task Information (if applicable) */}
              {selectedLog.log_type === 'task' && selectedLog.task_name && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Task Information</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <div className="font-medium">{selectedLog.task_name}</div>
                    {selectedLog.hours && selectedLog.rate_per_hour && (
                      <div className="text-sm text-muted-foreground">
                        {selectedLog.hours}h × ${selectedLog.rate_per_hour}/hr = ${selectedLog.total_amount}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Field Changes */}
              {selectedLog.field_name && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Field Changed</Label>
                  <div className="text-sm font-medium">{selectedLog.field_name}</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Previous Value</Label>
                      <div className="p-3 bg-red-50 rounded border border-red-200">
                        <pre className="text-sm text-red-800 whitespace-pre-wrap">
                          {formatValue(selectedLog.old_value)}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">New Value</Label>
                      <div className="p-3 bg-green-50 rounded border border-green-200">
                        <pre className="text-sm text-green-800 whitespace-pre-wrap">
                          {formatValue(selectedLog.new_value)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Change Reason */}
              {selectedLog.change_reason && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Change Reason</Label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {selectedLog.change_reason}
                  </div>
                </div>
              )}

              {/* Full Data (for create/delete operations) */}
              {(selectedLog.action === 'created' || selectedLog.action === 'deleted') && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {selectedLog.action === 'created' ? 'Created Data' : 'Deleted Data'}
                  </Label>
                  <div className="p-3 bg-muted rounded-md">
                    <pre className="text-sm whitespace-pre-wrap">
                      {formatValue(selectedLog.action === 'created' ? selectedLog.new_value : selectedLog.old_value)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
