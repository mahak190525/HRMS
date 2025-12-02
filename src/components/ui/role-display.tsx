import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getRoleDisplayName } from '@/constants';
import type { User } from '@/types';

interface RoleDisplayProps {
  user: User | null;
  variant?: 'default' | 'compact' | 'detailed';
  showLabels?: boolean;
  className?: string;
}

/**
 * Reusable component for displaying user roles (primary + additional)
 */
export function RoleDisplay({ 
  user, 
  variant = 'default', 
  showLabels = true,
  className = '' 
}: RoleDisplayProps) {
  if (!user) {
    return (
      <Badge variant="outline" className={className}>
        No Role Assigned
      </Badge>
    );
  }

  const primaryRole = user.role?.name || user.role_id;
  const additionalRoles = user.additional_roles || [];

  if (variant === 'compact') {
    // Compact view - just show count if multiple roles
    const totalRoles = (primaryRole ? 1 : 0) + additionalRoles.length;
    
    if (totalRoles === 0) {
      return <Badge variant="outline" className={className}>No Role</Badge>;
    }
    
    if (totalRoles === 1) {
      return (
        <Badge variant="default" className={className}>
          {getRoleDisplayName(primaryRole || '') || 'Employee'}
        </Badge>
      );
    }
    
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Badge variant="default">
          {getRoleDisplayName(primaryRole || '') || 'Employee'}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          +{additionalRoles.length}
        </Badge>
      </div>
    );
  }

  if (variant === 'detailed') {
    // Detailed view with labels and full role list
    return (
      <div className={`space-y-2 ${className}`}>
        {primaryRole && (
          <div>
            {showLabels && <p className="text-sm font-medium mb-1">Primary Role:</p>}
            <Badge variant="default" className="capitalize">
              {getRoleDisplayName(primaryRole) || 'Employee'}
            </Badge>
          </div>
        )}
        
        {additionalRoles.length > 0 && (
          <div>
            {showLabels && (
              <p className="text-sm font-medium mb-1">
                Additional Role{additionalRoles.length > 1 ? 's' : ''}:
              </p>
            )}
            <div className="flex gap-1 justify-end">
              {additionalRoles.map((role: any) => (
                <Badge key={role.id} variant="secondary" className="text-xs capitalize">
                  {getRoleDisplayName(role.name)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {!primaryRole && additionalRoles.length === 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            No roles assigned
          </Badge>
        )}
      </div>
    );
  }

  // Default view - inline display
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {primaryRole && (
        <Badge variant="default" className="capitalize">
          {getRoleDisplayName(primaryRole) || 'Employee'}
        </Badge>
      )}
      
      {additionalRoles.map((role: any) => (
        <Badge key={role.id} variant="secondary" className="text-xs capitalize">
          +{getRoleDisplayName(role.name)}
        </Badge>
      ))}
      
      {!primaryRole && additionalRoles.length === 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          No roles assigned
        </Badge>
      )}
    </div>
  );
}

/**
 * Simple role count display
 */
export function RoleCount({ user }: { user: User | null }) {
  if (!user) return null;
  
  const primaryRole = user.role?.name || user.role_id;
  const additionalRoles = user.additional_roles || [];
  const totalRoles = (primaryRole ? 1 : 0) + additionalRoles.length;
  
  if (totalRoles === 0) return null;
  
  return (
    <span className="text-xs text-muted-foreground">
      {totalRoles} role{totalRoles > 1 ? 's' : ''}
    </span>
  );
}

/**
 * Role list for tooltips or detailed displays
 */
export function RoleList({ user }: { user: User | null }) {
  if (!user) return null;
  
  const primaryRole = user.role?.name || user.role_id;
  const additionalRoles = user.additional_roles || [];
  
  const allRoles = [
    ...(primaryRole ? [{ name: primaryRole, isPrimary: true }] : []),
    ...additionalRoles.map((role: any) => ({ name: role.name, isPrimary: false }))
  ];
  
  if (allRoles.length === 0) return <span className="text-muted-foreground">No roles assigned</span>;
  
  return (
    <div className="space-y-1">
      {allRoles.map((role, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="capitalize">{getRoleDisplayName(role.name)}</span>
          {role.isPrimary && (
            <Badge variant="outline" className="text-xs">Primary</Badge>
          )}
        </div>
      ))}
    </div>
  );
}
