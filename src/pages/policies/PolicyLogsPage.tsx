import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Download,
  Eye,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { usePolicyLogs, usePolicyActivityStats, type PolicyActivityLog, type PolicyLogsFilters } from '@/hooks/usePolicyLogs';
import { usePolicies } from '@/hooks/usePolicies';
import { cn } from '@/lib/utils';
import { PolicySimpleEditor } from '@/components/ui/policy-simple-editor';

const ACTION_ICONS = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  activate: ToggleRight,
  deactivate: ToggleLeft
};

const ACTION_COLORS = {
  create: 'text-green-600 bg-green-50 border-green-200',
  update: 'text-blue-600 bg-blue-50 border-blue-200',
  delete: 'text-red-600 bg-red-50 border-red-200',
  activate: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  deactivate: 'text-gray-600 bg-gray-50 border-gray-200'
};

const ACTION_LABELS = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  activate: 'Activated',
  deactivate: 'Deactivated'
};

// Add custom styles for policy log preview
const logPreviewStyles = `
  .policy-log-preview .ProseMirror {
    font-size: 0.875rem !important;
    line-height: 1.5 !important;
    padding: 0 !important;
    min-height: auto !important;
  }
  
  .policy-log-preview .ProseMirror h1 {
    font-size: 1.5rem !important;
    margin-top: 0.75rem !important;
    margin-bottom: 0.5rem !important;
  }
  
  .policy-log-preview .ProseMirror h2 {
    font-size: 1.25rem !important;
    margin-top: 0.75rem !important;
    margin-bottom: 0.5rem !important;
  }
  
  .policy-log-preview .ProseMirror h3 {
    font-size: 1.125rem !important;
    margin-top: 0.5rem !important;
    margin-bottom: 0.375rem !important;
  }
  
  .policy-log-preview .ProseMirror h4,
  .policy-log-preview .ProseMirror h5,
  .policy-log-preview .ProseMirror h6 {
    font-size: 1rem !important;
    margin-top: 0.5rem !important;
    margin-bottom: 0.375rem !important;
  }
  
  .policy-log-preview .ProseMirror ul,
  .policy-log-preview .ProseMirror ol {
    margin: 0.75rem 0 !important;
    padding-left: 1.5rem !important;
  }
  
  .policy-log-preview .ProseMirror li {
    margin: 0.25rem 0 !important;
  }
  
  .policy-log-preview .ProseMirror blockquote {
    margin: 0.75rem 0 !important;
    padding-left: 1rem !important;
    font-size: 0.875rem !important;
  }
  
  .policy-log-preview .ProseMirror p {
    margin: 0.375rem 0 !important;
  }
`;

export const PolicyLogsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<PolicyActivityLog | null>(null);
  
  // Inject custom styles for log preview
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = logPreviewStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const { policies } = usePolicies();
  const { stats, loading: statsLoading } = usePolicyActivityStats();

  // Build filters
  const filters: PolicyLogsFilters = useMemo(() => {
    const f: PolicyLogsFilters = {};
    if (selectedAction !== 'all') f.action = selectedAction;
    if (selectedPolicy !== 'all') f.policy_id = selectedPolicy;
    if (selectedUser !== 'all') f.user_id = selectedUser;
    return f;
  }, [selectedAction, selectedPolicy, selectedUser]);

  const { logs, loading, hasMore, loadMore, refresh } = usePolicyLogs(filters);

  // Filter logs by search term
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    return logs.filter(log => 
      log.policy_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  // Get unique users from logs for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map();
    logs.forEach(log => {
      if (log.user_id && log.user_full_name) {
        users.set(log.user_id, {
          id: log.user_id,
          name: log.user_full_name,
          email: log.user_email
        });
      }
    });
    return Array.from(users.values());
  }, [logs]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const getChangesSummary = (log: PolicyActivityLog) => {
    if (!log.changes) return null;

    const changes = [];
    
    // Handle different action types
    if (log.changes.action_type === 'create') {
      changes.push(`Created with ${log.changes.content_length} characters`);
    } else if (log.changes.action_type === 'delete') {
      changes.push(`Deleted (was ${log.changes.was_active ? 'active' : 'inactive'})`);
    } else {
      // Handle update changes
      if (log.changes.name) {
        changes.push(`Name: "${log.changes.name.from}" → "${log.changes.name.to}"`);
      }
      if (log.changes.content?.content_changed) {
        const sizeChange = log.changes.content.size_change;
        const sizeText = sizeChange > 0 ? `+${sizeChange}` : `${sizeChange}`;
        changes.push(`Content modified (${sizeText} chars)`);
      }
      if (log.changes.is_active) {
        changes.push(`Status: ${log.changes.is_active.from ? 'Active' : 'Inactive'} → ${log.changes.is_active.to ? 'Active' : 'Inactive'}`);
      }
      if (log.changes.version) {
        changes.push(`Version: v${log.changes.version.from} → v${log.changes.version.to}`);
      }
    }

    return changes.length > 0 ? changes.join(', ') : null;
  };

  const LogDetailDialog: React.FC<{ log: PolicyActivityLog }> = ({ log }) => (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Details
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Action</label>
            <div className="flex items-center gap-2 mt-1">
              {React.createElement(ACTION_ICONS[log.action], { className: "h-4 w-4" })}
              <span className="text-sm font-medium capitalize">{ACTION_LABELS[log.action]}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Time</label>
            <p className="text-sm font-medium mt-1">{new Date(log.created_at).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Policy</label>
            <p className="mt-1 text-sm font-medium">{log.policy_name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Version</label>
            <p className="mt-1 text-sm font-medium">v{log.policy_version}</p>
          </div>
          {/* <div className="col-span-2">
            <label className="text-sm font-medium text-gray-500">User</label>
            <p className="mt-1 text-sm font-medium">
              {log.user_full_name ? (
                <>
                  {log.user_full_name}
                  {log.user_email && <span className="text-gray-500 ml-2">({log.user_email})</span>}
                </>
              ) : (
                <span className="text-gray-500">System</span>
              )}
            </p>
          </div> */}
        </div>

        <Separator />

        {/* Changes */}
        {log.changes && Object.keys(log.changes).length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-500">Changes</label>
            <div className="mt-2 space-y-2">
              {/* Action Type */}
              {log.changes.action_type && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <div className="text-sm font-medium">Action Type</div>
                  <div className="text-sm text-gray-600 mt-1 capitalize">
                    {log.changes.action_type}
                  </div>
                </div>
              )}

              {/* Name Changes */}
              {log.changes.name && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium">Policy Name</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="line-through text-red-600">{log.changes.name.from}</span>
                    {' → '}
                    <span className="text-green-600">{log.changes.name.to}</span>
                  </div>
                </div>
              )}

              {/* Version Changes */}
              {log.changes.version && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium">Version</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="line-through text-red-600">v{log.changes.version.from}</span>
                    {' → '}
                    <span className="text-green-600">v{log.changes.version.to}</span>
                  </div>
                </div>
              )}

              {/* Status Changes */}
              {log.changes.is_active && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="line-through text-red-600">
                      {log.changes.is_active.from ? 'Active' : 'Inactive'}
                    </span>
                    {' → '}
                    <span className="text-green-600">
                      {log.changes.is_active.to ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              )}

              {/* Content Changes */}
              {log.changes.content && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium">Content Changes</div>
                  <div className="text-sm text-gray-600 mt-1 space-y-1">
                    <div>Length: {log.changes.content.old_length} → {log.changes.content.new_length} characters</div>
                    <div className={log.changes.content.size_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                      Size change: {log.changes.content.size_change >= 0 ? '+' : ''}{log.changes.content.size_change} characters
                    </div>
                    {log.changes.content.old_preview && log.changes.content.new_preview ? (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-gray-700 mb-2">
                          Content Changes:
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <div className="grid grid-cols-2 gap-0">
                            <div className="border-r">
                              <div className="bg-red-100 px-3 py-2 text-xs font-medium text-red-800 border-b">
                                Previous Version
                              </div>
                              <div className="p-3 bg-red-50 max-h-64 overflow-y-auto policy-log-preview">
                                <PolicySimpleEditor
                                  content={log.changes.content.old_preview || ''}
                                  onChange={() => {}} // Read-only
                                  editable={false}
                                  
                                />
                              </div>
                            </div>
                            <div>
                              <div className="bg-green-100 px-3 py-2 text-xs font-medium text-green-800 border-b">
                                New Version
                              </div>
                              <div className="p-3 bg-green-50 max-h-64 overflow-y-auto policy-log-preview">
                                <PolicySimpleEditor
                                  content={log.changes.content.new_preview || ''}
                                  onChange={() => {}} // Read-only
                                  editable={false}
                                  className=""
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-amber-800 mb-1">
                            Content Preview Not Available
                          </div>
                          <div className="text-xs text-amber-700">
                            The policy content was modified, but detailed change preview is not available for this log entry. 
                            {log.changes.content.old_length && log.changes.content.new_length && (
                              <span> Content length changed from {log.changes.content.old_length} to {log.changes.content.new_length} characters.</span>
                            )}
                          </div>
                          <div className="text-xs text-amber-600 mt-2 italic">
                            Note: Enhanced change tracking is available for new policy modifications after applying the latest system updates.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Creation/Deletion Info */}
              {log.changes.content_length && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium">Content Length</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {log.changes.content_length} characters
                  </div>
                </div>
              )}

              {log.changes.was_active !== undefined && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="font-medium">Final Status</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {log.changes.was_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Policy Activity Logs
            </h2>
            <p className="text-sm text-gray-600">
              Track all policy changes and activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.total_activities}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{stats.creates}</div>
                  <div className="text-xs text-gray-600">Created</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.updates}</div>
                  <div className="text-xs text-gray-600">Updated</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{stats.deletes}</div>
                  <div className="text-xs text-gray-600">Deleted</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">{stats.activations}</div>
                  <div className="text-xs text-gray-600">Activated</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{stats.recent_activity_count}</div>
                  <div className="text-xs text-gray-600">Last 24h</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
              <SelectItem value="activate">Activated</SelectItem>
              <SelectItem value="deactivate">Deactivated</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Policies</SelectItem>
              {policies.map(policy => (
                <SelectItem key={policy.id} value={policy.id}>
                  {policy.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading && filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No activity logs found
              </h3>
              <p className="text-gray-600">
                {searchTerm || selectedAction !== 'all' || selectedPolicy !== 'all' || selectedUser !== 'all'
                  ? 'Try adjusting your search terms or filters'
                  : 'Policy activities will appear here as they occur'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-[100px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const ActionIcon = ACTION_ICONS[log.action];
                    const changesSummary = getChangesSummary(log);
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-1.5 rounded-full border",
                              ACTION_COLORS[log.action]
                            )}>
                              <ActionIcon className="h-3 w-3" />
                            </div>
                            <span className="capitalize font-medium">
                              {ACTION_LABELS[log.action]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.policy_name}</div>
                            {log.policy_version && (
                              <div className="text-xs text-gray-500">v{log.policy_version}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.user_full_name ? (
                            <div>
                              <div className="font-medium">{log.user_full_name}</div>
                              {log.user_email && (
                                <div className="text-xs text-gray-500">{log.user_email}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {changesSummary ? (
                            <div className="text-sm text-gray-600 max-w-xs truncate">
                              {changesSummary}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{formatTimeAgo(log.created_at)}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <LogDetailDialog log={log} />
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {hasMore && (
              <div className="p-4 text-center">
                <Button 
                  variant="outline" 
                  onClick={loadMore} 
                  disabled={loading}
                  className="w-full max-w-xs"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PolicyLogsPage;
