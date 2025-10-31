import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter,
  FileText,
  Eye,
  Edit,
  Trash2,
  Copy,
  MoreVertical
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import type { Policy } from '../../types';
import { usePolicies } from '../../hooks/usePolicies';

interface PolicySidebarProps {
  selectedPolicyId?: string;
  onPolicySelect: (policy: Policy) => void;
  onCreatePolicy?: () => void;
  onEditPolicy?: (policy: Policy) => void;
  onDeletePolicy?: (policy: Policy) => void;
  onDuplicatePolicy?: (policy: Policy) => void;
  className?: string;
}

export const PolicySidebar: React.FC<PolicySidebarProps> = ({
  selectedPolicyId,
  onPolicySelect,
  onCreatePolicy,
  onEditPolicy,
  onDeletePolicy,
  onDuplicatePolicy,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Memoize filters to prevent infinite re-renders
  const filters = useMemo(() => ({
    search_term: searchTerm,
    is_active: showActiveOnly ? true : undefined
  }), [searchTerm, showActiveOnly]);

  const { policies, loading: policiesLoading } = usePolicies(filters);

  // Filter policies based on search and active status
  const filteredPolicies = React.useMemo(() => {
    return policies.filter(policy => {
      const matchesSearch = !searchTerm || 
        policy.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive = !showActiveOnly || policy.is_active;
      return matchesSearch && matchesActive;
    });
  }, [policies, searchTerm, showActiveOnly]);

  const PolicyItem: React.FC<{ policy: Policy }> = ({ policy }) => {
    const isSelected = policy.id === selectedPolicyId;
    
    return (
      <div
        className={cn(
          "group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors",
          isSelected 
            ? "bg-blue-50 border-l-2 border-l-blue-500" 
            : "hover:bg-gray-50"
        )}
        onClick={() => onPolicySelect(policy)}
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium truncate",
              isSelected ? "text-blue-900" : "text-gray-900"
            )}>
              {policy.name}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              <Badge 
                variant={policy.is_active ? "default" : "secondary"}
                className="text-xs"
              >
                {policy.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className="text-xs text-gray-500">
                v{policy.version}
              </span>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPolicySelect(policy)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            {onEditPolicy && (
              <DropdownMenuItem onClick={() => onEditPolicy(policy)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onDuplicatePolicy && (
              <DropdownMenuItem onClick={() => onDuplicatePolicy(policy)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
            )}
            {(onEditPolicy || onDuplicatePolicy || onDeletePolicy) && <DropdownMenuSeparator />}
            {onDeletePolicy && (
              <DropdownMenuItem 
                onClick={() => onDeletePolicy(policy)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  if (policiesLoading) {
    return (
      <div className={cn("w-80 border-r bg-gray-50 p-4", className)}>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-80 border-r bg-gray-50 flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Policies</h2>
          {onCreatePolicy && (
            <Button onClick={onCreatePolicy} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filters */}
        <div className="flex items-center justify-between mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={cn(
              "text-xs",
              showActiveOnly && "bg-blue-50 text-blue-700"
            )}
          >
            <Filter className="h-3 w-3 mr-1" />
            {showActiveOnly ? "Active Only" : "All Policies"}
          </Button>
          <span className="text-xs text-gray-500">
            {filteredPolicies.length} policies
          </span>
        </div>
      </div>

      {/* Policy List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                {searchTerm ? "No policies found" : "No policies yet"}
              </p>
              {!searchTerm && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onCreatePolicy}
                  className="mt-2"
                >
                  Create a policy
                </Button>
              )}
            </div>
          ) : (
            filteredPolicies.map(policy => (
              <PolicyItem key={policy.id} policy={policy} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PolicySidebar;