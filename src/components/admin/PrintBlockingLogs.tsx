import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/services/supabase';
import { format } from 'date-fns';

// Helper function to convert UTC to IST
const formatInIST = (date: Date, formatStr: string) => {
  // Convert to IST (UTC + 5:30)
  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return format(istDate, formatStr);
};
import { Shield, AlertTriangle, Eye, Download, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface PrintBlockingLog {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action_type: string;
  action_description: string;
  key_combination: string;
  user_agent: string;
  ip_address: string;
  page_url: string;
  session_id: string;
  blocked_at: string;
  additional_data: any;
}

interface PrintBlockingSummary {
  [key: string]: number;
}

export function PrintBlockingLogs() {
  const [logs, setLogs] = useState<PrintBlockingLog[]>([]);
  const [summary, setSummary] = useState<PrintBlockingSummary>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('7'); // days
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  const actionTypeColors: { [key: string]: string } = {
    print: 'bg-red-100 text-red-800',
    save: 'bg-orange-100 text-orange-800',
    screenshot: 'bg-yellow-100 text-yellow-800',
    copy: 'bg-blue-100 text-blue-800',
    devtools: 'bg-purple-100 text-purple-800',
    context_menu: 'bg-green-100 text-green-800',
    view_source: 'bg-gray-100 text-gray-800',
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('print_blocking_logs')
        .select('*', { count: 'exact' })
        .order('blocked_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      // Apply filters
      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }

      if (searchTerm) {
        query = query.or(`user_email.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%,action_description.ilike.%${searchTerm}%`);
      }

      if (dateFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter));
        query = query.gte('blocked_at', daysAgo.toISOString());
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching print blocking logs:', error);
      toast.error('Failed to fetch print blocking logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      // Calculate summary from logs directly
      const { data, error } = await supabase
        .from('print_blocking_logs')
        .select('action_type')
        .gte('blocked_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const summaryData: PrintBlockingSummary = {};
      data?.forEach(log => {
        summaryData[log.action_type] = (summaryData[log.action_type] || 0) + 1;
      });

      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching print blocking summary:', error);
    }
  };

  const exportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('print_blocking_logs')
        .select('*')
        .order('blocked_at', { ascending: false })
        .limit(10000);

      if (error) throw error;

      const csv = [
        'Date,User Email,User Name,Action Type,Action Description,Key Combination,Page URL,User Agent',
        ...data.map(log => [
          formatInIST(new Date(log.blocked_at), 'yyyy-MM-dd HH:mm:ss'),
          log.user_email || '',
          log.user_name || '',
          log.action_type,
          log.action_description,
          log.key_combination || '',
          log.page_url || '',
          log.user_agent || ''
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `print-blocking-logs-${formatInIST(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Logs exported successfully');
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Failed to export logs');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter, searchTerm, dateFilter]);

  useEffect(() => {
    fetchSummary();
  }, []);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">Security events blocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Print Attempts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.print || 0}
            </div>
            <p className="text-xs text-muted-foreground">Print blocking events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DevTools Attempts</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.devtools || 0}
            </div>
            <p className="text-xs text-muted-foreground">Developer tools blocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(logs.map(log => log.user_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">Users with blocked actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Print Blocking Logs</CardTitle>
          <CardDescription>
            Monitor and analyze security events where users attempted blocked actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user email, name, or action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="print">Print</SelectItem>
                <SelectItem value="save">Save</SelectItem>
                <SelectItem value="screenshot">Screenshot</SelectItem>
                <SelectItem value="copy">Copy/Paste</SelectItem>
                <SelectItem value="devtools">Developer Tools</SelectItem>
                <SelectItem value="context_menu">Context Menu</SelectItem>
                <SelectItem value="view_source">View Source</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={exportLogs} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Logs Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Key Combination</TableHead>
                  <TableHead>Page</TableHead>
                  {/* <TableHead>Details</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No logs found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{formatInIST(new Date(log.blocked_at), 'MMM dd, yyyy')}</div>
                        <div className="text-sm text-muted-foreground">{formatInIST(new Date(log.blocked_at), 'HH:mm:ss')} IST</div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.user_name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{log.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={actionTypeColors[log.action_type] || 'bg-gray-100 text-gray-800'}>
                            {log.action_type}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {log.action_description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.key_combination || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {log.page_url ? new URL(log.page_url).pathname : '-'}
                      </TableCell>
                      {/* <TableCell>
                        {log.additional_data && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                              View Details
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-w-[300px]">
                              {JSON.stringify(log.additional_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </TableCell> */}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
