import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  FileText, 
  BarChart3,
  Target
} from 'lucide-react';

// Import KRA components
import { KRATemplateManager } from '@/components/kra/KRATemplateManager';
import { KRAAssignmentManager } from '@/components/kra/KRAAssignmentManager';
import { AdminKRAOverview } from '@/components/kra/AdminKRAOverview';
// Manager-only imports - employees access KRA through personal dashboard
import { KRADashboard } from '@/components/kra/KRADashboard';
import { PerformanceOverview } from './PerformanceOverview';
import { KRANotificationTest } from '@/components/debug/KRANotificationTest';

import { 
  useKRATemplates, 
  useKRAAssignments, 
  useTeamMembers 
} from '@/hooks/useKRA';
import { useKRAPermissions } from '@/hooks/useKRAPermissions';

export function KRA() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const permissions = useKRAPermissions();

  // Note: Access restrictions removed for now - everyone can access KRA dashboard

  // Fetch manager data
  const { data: templates, isLoading: templatesLoading } = useKRATemplates();
  const { data: assignments, isLoading: assignmentsLoading } = useKRAAssignments();
  const { data: teamMembers } = useTeamMembers();

  // Calculate manager statistics
  const myTemplates = templates?.filter(t => t.created_by === user?.id) || [];
  const activeTemplates = myTemplates.filter(t => t.status === 'active');
  const myTeamAssignments = assignments?.filter(a => a.assigned_by === user?.id) || [];
  const pendingEvaluations = myTeamAssignments.filter(a => a.status === 'submitted');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">KRA Management</h1>
          <Badge variant="default">
            Full Access (Simplified)
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Create and manage Key Result Areas - all users have full access to all features
        </p>
      </div>

      {/* Manager Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Active Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTemplates.length}</div>
                <p className="text-xs text-muted-foreground">KRA templates</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamMembers?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Reporting to you</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Active Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myTeamAssignments.length}</div>
                <p className="text-xs text-muted-foreground">KRAs assigned</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Pending Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingEvaluations.length}</div>
                <p className="text-xs text-muted-foreground">Awaiting evaluation</p>
              </CardContent>
            </Card>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${(() => {
          let tabCount = 1; // Dashboard is always visible
          if (permissions.canCreateTemplates) tabCount++;
          if (permissions.canViewAssignments) tabCount++;
          if (permissions.canViewAllKRA) tabCount++;
          // if (permissions.canViewAssignments || permissions.canViewAllKRA) tabCount++; // Performance Overview
          return `grid-cols-${tabCount}`;
        })()}`}>
          <TabsTrigger value="dashboard" className="cursor-pointer">Dashboard</TabsTrigger>
          {permissions.canCreateTemplates && <TabsTrigger value="templates" className="cursor-pointer">Templates</TabsTrigger>}
          {permissions.canViewAssignments && <TabsTrigger value="assignments" className="cursor-pointer">Team KRAs</TabsTrigger>}
          {permissions.canViewAllKRA && <TabsTrigger value="admin-overview" className="cursor-pointer">All KRAs</TabsTrigger>}
          {/* {(permissions.canViewAssignments || permissions.canViewAllKRA) && (
            <TabsTrigger value="performance-overview" className="cursor-pointer">Performance Overview</TabsTrigger>
          )} */}
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <KRADashboard 
            templates={myTemplates}
            assignments={myTeamAssignments}
            teamMembers={teamMembers}
            permissions={permissions}
          />
        </TabsContent>

        {permissions.canCreateTemplates && (
          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">KRA Templates</h2>
                <p className="text-muted-foreground">
                  Create and manage KRA templates for your team
                </p>
              </div>
            </div>
            <KRATemplateManager templates={myTemplates} isLoading={templatesLoading} permissions={permissions} />
          </TabsContent>
        )}

        {permissions.canViewAssignments && (
          <TabsContent value="assignments" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Team KRA Assignments</h2>
                <p className="text-muted-foreground">
                  {permissions.isReadOnly ? 'View team KRA assignments' : 'Manage and evaluate your team\'s KRA assignments'}
                </p>
              </div>
            </div>
            <KRAAssignmentManager 
              assignments={myTeamAssignments} 
              isLoading={assignmentsLoading}
              teamMembers={teamMembers}
              permissions={permissions}
              context="team"
            />
          </TabsContent>
        )}

        {permissions.canViewAllKRA && (
          <TabsContent value="admin-overview" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Organization KRA Overview</h2>
                <p className="text-muted-foreground">
                  Comprehensive view of all KRA assignments across the organization
                </p>
              </div>
            </div>
            <AdminKRAOverview />
          </TabsContent>
        )}

        {(permissions.canViewAssignments || permissions.canViewAllKRA) && (
          <TabsContent value="performance-overview" className="space-y-6">
            <PerformanceOverview />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}
