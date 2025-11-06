import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search,
  Edit,
  Trash2,
  Copy,
  Eye,
  MoreVertical,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PolicyEditor } from '@/components/policies/PolicyEditor';
import { PolicySimpleEditor } from '@/components/ui/policy-simple-editor';
import { usePolicies } from '@/hooks/usePolicies';
import { usePolicyDashboardPermissions } from '@/hooks/usePolicyDashboardPermissions';
import type { Policy, PolicyFormData } from '@/types';
import { toast } from 'sonner';

export const AllPoliciesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode] = useState<'table' | 'cards'>('table');

  const { 
    policies, 
    loading: policiesLoading, 
    refetch: refetchPolicies 
  } = usePolicies();
  const { 
    createPolicy, 
    updatePolicy, 
    deletePolicy, 
    duplicatePolicy
  } = usePolicies();

  const {
    canCreatePolicies,
    canEditPolicies,
    canDeletePolicies,
    isReadOnly
  } = usePolicyDashboardPermissions();

  // Filter policies based on search (only show active policies since inactive ones are deleted)
  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = !searchTerm || 
      policy.name.toLowerCase().includes(searchTerm.toLowerCase());
    const isActive = policy.is_active; // Only show active policies
    
    return matchesSearch && isActive;
  });

  const handleCreatePolicy = () => {
    if (!canCreatePolicies) {
      toast.error('You do not have permission to create policies');
      return;
    }
    setSelectedPolicy(null);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEditPolicy = (policy: Policy) => {
    if (!canEditPolicies) {
      toast.error('You do not have permission to edit policies');
      return;
    }
    setSelectedPolicy(policy);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleViewPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleDeletePolicy = async (policy: Policy) => {
    if (!canDeletePolicies) {
      toast.error('You do not have permission to delete policies');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${policy.name}"? This action cannot be undone.`)) {
      try {
        await deletePolicy(policy.id);
        if (selectedPolicy?.id === policy.id) {
          setSelectedPolicy(null);
        }
        // Refetch policies to get the latest list
        await refetchPolicies();
        toast.success('Policy deleted successfully');
      } catch (error) {
        console.error('Failed to delete policy:', error);
        toast.error('Failed to delete policy');
      }
    }
  };

  const handleDuplicatePolicy = async (policy: Policy) => {
    if (!canCreatePolicies) {
      toast.error('You do not have permission to duplicate policies');
      return;
    }
    const newName = prompt('Enter name for the duplicated policy:', `${policy.name} (Copy)`);
    if (newName && newName.trim()) {
      try {
        const duplicatedPolicy = await duplicatePolicy(policy.id, newName.trim());
        setSelectedPolicy(duplicatedPolicy);
        // Refetch policies to get the latest list
        await refetchPolicies();
        toast.success('Policy duplicated successfully');
      } catch (error) {
        console.error('Failed to duplicate policy:', error);
        toast.error('Failed to duplicate policy');
      }
    }
  };

  const handleSavePolicy = async (data: PolicyFormData) => {
    try {
      if (isCreating) {
        const newPolicy = await createPolicy(data);
        setSelectedPolicy(newPolicy);
        setIsCreating(false);
        // Refetch policies to get the latest list
        await refetchPolicies();
        toast.success('Policy created successfully');
      } else if (selectedPolicy) {
        const updatedPolicy = await updatePolicy(selectedPolicy.id, data);
        setSelectedPolicy(updatedPolicy);
        setIsEditing(false);
        // Refetch policies to get the latest list
        await refetchPolicies();
        toast.success('Policy updated successfully');
      }
    } catch (error) {
      console.error('Failed to save policy:', error);
      toast.error('Failed to save policy');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
  };

  const PolicyCard: React.FC<{ policy: Policy }> = ({ policy }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewPolicy(policy)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">{policy.name}</CardTitle>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant={policy.is_active ? "default" : "secondary"} className="text-xs">
                {policy.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className="text-xs text-gray-500">v{policy.version}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewPolicy(policy); }}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              {canEditPolicies && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditPolicy(policy); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canCreatePolicies && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicatePolicy(policy); }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {(canEditPolicies || canCreatePolicies || canDeletePolicies) && <DropdownMenuSeparator />}
              {canDeletePolicies && (
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); handleDeletePolicy(policy); }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-gray-600">
          Last updated {new Date(policy.updated_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );

  // Show editor when creating or editing
  if (isCreating || isEditing) {
    return (
      <div className="h-full flex flex-col">
        {/* <div className="border-b p-4 bg-white">
          <h2 className="text-lg font-semibold">
            {isCreating ? 'Create New Policy' : `Edit Policy: ${selectedPolicy?.name}`}
          </h2>
        </div> */}
        <div className="flex-1 overflow-hidden">
          <PolicyEditor
            policy={isEditing ? selectedPolicy : null}
            onSave={handleSavePolicy}
            onCancel={handleCancelEdit}
          />
        </div>
      </div>
    );
  }

  // Show policy viewer when viewing a specific policy
  if (selectedPolicy && !isEditing && !isCreating) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedPolicy(null)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back to All Policies
                </Button>
              </div>
              <h2 className="text-lg font-semibold mt-2">{selectedPolicy.name}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={selectedPolicy.is_active ? "default" : "secondary"}>
                  {selectedPolicy.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-sm text-gray-500">
                  Version {selectedPolicy.version}
                </span>
                <span className="text-sm text-gray-500">
                  Last updated {new Date(selectedPolicy.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {canEditPolicies && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditPolicy(selectedPolicy)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          <PolicySimpleEditor
            content={selectedPolicy.content}
            onChange={() => {}} // Read-only
            editable={false}
            className="prose prose-sm max-w-none"
          />
        </div>
      </div>
    );
  }

  // Main policies list view
  return (
    <div className="h-full flex flex-col">
      {/* Header with actions */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">All Policies</h2>
            <p className="text-sm text-gray-600">
              {filteredPolicies.length} of {policies.length} policies
            </p>
          </div>
          {canCreatePolicies && (
            <Button onClick={handleCreatePolicy}>
              <Plus className="h-4 w-4 mr-2" />
              New Policy
            </Button>
          )}
        </div>

        {/* Search and filters */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search policies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isReadOnly && (
          <Alert className="mt-4">
            <Settings className="h-4 w-4" />
            <AlertDescription>
              You have read-only access to policies. Contact your administrator to request write permissions.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {policiesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No policies found' : 'No policies yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms or filters'
                  : 'Get started by creating your first organizational policy'
                }
              </p>
              {canCreatePolicies && !searchTerm && (
                <Button onClick={handleCreatePolicy}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Policy
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'cards' ? (
          <ScrollArea className="h-full p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPolicies.map(policy => (
                <PolicyCard key={policy.id} policy={policy} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map(policy => (
                  <TableRow 
                    key={policy.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewPolicy(policy)}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{policy.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={policy.is_active ? "default" : "secondary"}>
                        {policy.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>v{policy.version}</TableCell>
                    <TableCell>{new Date(policy.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewPolicy(policy); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {canEditPolicies && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditPolicy(policy); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canCreatePolicies && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicatePolicy(policy); }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                          )}
                          {(canEditPolicies || canCreatePolicies || canDeletePolicies) && <DropdownMenuSeparator />}
                          {canDeletePolicies && (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleDeletePolicy(policy); }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllPoliciesPage;
