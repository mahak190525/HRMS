import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKRAPermissions } from './useKRAPermissions';
import { getAllUserRoleNames } from '@/utils/multipleRoles';
import type { KRAAssignment } from './useKRA';

export interface ContextualKRAPermissions {
  canEdit: boolean;
  canView: boolean;
  isReadOnly: boolean;
  viewContext: 'employee' | 'manager' | 'admin' | 'hr';
  reason?: string; // For debugging/logging
}

/**
 * Hook that provides context-aware KRA permissions for admin-managers
 * 
 * For admins who are also managers:
 * - Team KRAs tab: Full edit access for their direct team members (manager role)
 * - All KRAs tab: View-only access for all other employees (admin role)
 * 
 * @param assignment - The KRA assignment to check permissions for
 * @param context - The context where this is being used ('team' | 'all')
 */
export function useContextualKRAPermissions(
  assignment: KRAAssignment | null,
  context: 'team' | 'all'
): ContextualKRAPermissions {
  const { user } = useAuth();
  const basePermissions = useKRAPermissions();

  return useMemo(() => {
    if (!assignment || !user) {
      return {
        canEdit: false,
        canView: false,
        isReadOnly: true,
        viewContext: 'employee',
        reason: 'No assignment or user'
      };
    }

    // Get user role information from all assigned roles
    const userRoles = getAllUserRoleNames(user);
    const isAdmin = user.isSA || userRoles.some(role => ['admin', 'super_admin'].includes(role));
    const isHR = userRoles.some(role => ['hr', 'hrm'].includes(role));
    const isManager = userRoles.some(role => ['sdm', 'bdm', 'qam', 'manager'].includes(role));
    
    // Check if user is the direct manager of this assignment
    const isDirectManager = assignment.assigned_by === user.id;
    
    // Check if user is the employee themselves
    const isEmployee = assignment.employee_id === user.id;

    // Context-specific logic
    if (context === 'team') {
      // Team KRAs tab - for direct team members
      if (isEmployee) {
        return {
          canEdit: true, // Employees can edit their own KRAs
          canView: true,
          isReadOnly: false,
          viewContext: 'employee',
          reason: 'Employee viewing own KRA in team context'
        };
      }
      
      if (isDirectManager) {
        return {
          canEdit: true, // Direct managers can edit their team's KRAs
          canView: true,
          isReadOnly: false,
          viewContext: 'manager',
          reason: 'Direct manager in team context'
        };
      }
      
      // Admin-managers can edit if they're the direct manager, otherwise no access in team context
      if (isAdmin && isManager) {
        return {
          canEdit: false,
          canView: false,
          isReadOnly: true,
          viewContext: 'admin',
          reason: 'Admin-manager but not direct manager in team context'
        };
      }
      
      return {
        canEdit: false,
        canView: false,
        isReadOnly: true,
        viewContext: 'employee',
        reason: 'No team access'
      };
    }
    
    if (context === 'all') {
      // All KRAs tab - for viewing all employees
      if (isEmployee) {
        return {
          canEdit: true, // Employees can edit their own KRAs
          canView: true,
          isReadOnly: false,
          viewContext: 'employee',
          reason: 'Employee viewing own KRA in all context'
        };
      }
      
      if (isDirectManager && !isAdmin) {
        // Pure managers can edit their direct reports in all context too
        return {
          canEdit: true,
          canView: true,
          isReadOnly: false,
          viewContext: 'manager',
          reason: 'Direct manager in all context'
        };
      }
      
      if (isAdmin || isHR) {
        // Admin/HR logic: can edit if direct manager, otherwise view-only
        if (isDirectManager) {
          return {
            canEdit: true,
            canView: true,
            isReadOnly: false,
            viewContext: isAdmin ? 'admin' : 'hr',
            reason: 'Admin/HR who is also direct manager'
          };
        } else {
          return {
            canEdit: false,
            canView: true,
            isReadOnly: true,
            viewContext: isAdmin ? 'admin' : 'hr',
            reason: 'Admin/HR view-only for non-direct reports'
          };
        }
      }
      
      return {
        canEdit: false,
        canView: false,
        isReadOnly: true,
        viewContext: 'employee',
        reason: 'No all access'
      };
    }

    // Fallback
    return {
      canEdit: false,
      canView: basePermissions.canViewOwnKRA && isEmployee,
      isReadOnly: true,
      viewContext: 'employee',
      reason: 'Fallback permissions'
    };
  }, [assignment, context, user, basePermissions]);
}

/**
 * Helper hook to determine if a user can access a specific KRA assignment
 * in a given context, with detailed reasoning
 */
export function useKRAAccessCheck(
  assignment: KRAAssignment | null,
  context: 'team' | 'all'
) {
  const permissions = useContextualKRAPermissions(assignment, context);
  
  return {
    ...permissions,
    canAccess: permissions.canView || permissions.canEdit,
  };
}
