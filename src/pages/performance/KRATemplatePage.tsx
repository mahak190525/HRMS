import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Save, 
  Users, 
  Calendar,
  Target,
  FileText,
  Plus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KRATemplateForm } from '@/components/kra/KRATemplateForm';
import { KRATemplateDetails } from '@/components/kra/KRATemplateDetails';
import { KRAAssignDialog } from '@/components/kra/KRAAssignDialog';
import { 
  useKRATemplate, 
  useCreateKRATemplate, 
  useUpdateKRATemplate, 
  useTeamMembers, 
  useBulkAssignKRATemplate, 
  useTemplateAssignments,
  useCreateKRAGoal,
  useUpdateKRAGoal,
  triggerKRAEmail,
  type KRATemplate 
} from '@/hooks/useKRA';
import { notificationApi } from '@/services/notificationApi';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

export function KRATemplatePage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'view'; // 'create', 'edit', 'view'
  const { user } = useAuth();

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [showForm, setShowForm] = useState(mode === 'create' || mode === 'edit');

  // Hooks
  const { data: template, isLoading: templateLoading } = useKRATemplate(templateId || '');
  const { data: teamMembers } = useTeamMembers();
  const { data: existingAssignments, refetch: refetchAssignments } = useTemplateAssignments(templateId || '');
  
  const createTemplate = useCreateKRATemplate();
  const updateTemplate = useUpdateKRATemplate();
  const bulkAssignTemplate = useBulkAssignKRATemplate();
  const createGoal = useCreateKRAGoal();
  const updateGoal = useUpdateKRAGoal();

  useEffect(() => {
    if (mode === 'create' || mode === 'edit') {
      setShowForm(true);
    }
  }, [mode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateTemplate = async (templateData: Partial<KRATemplate> & { goals?: any[] }) => {
    try {
      const { goals, ...template } = templateData;
      
      // Create template first
      const newTemplate = await createTemplate.mutateAsync({
        ...template,
        created_by: user?.id,
        department_id: user?.department_id,
      });

      // Create goals if provided
      if (goals && goals.length > 0 && newTemplate?.id) {
        for (const goal of goals) {
          const hasRequiredFields = goal.goal_id && 
                                   goal.strategic_goal_title && 
                                   goal.smart_goal && 
                                   goal.weight && 
                                   goal.target;
          
          if (hasRequiredFields) {
            const goalData = {
              ...goal,
              template_id: newTemplate.id,
              id: undefined,
              tempId: undefined,
              isNew: undefined,
            };
            
            await createGoal.mutateAsync(goalData);
          }
        }
      }
      
      toast.success('KRA template created successfully');
      navigate(`/performance/kra/template/${newTemplate.id}?mode=view`);
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const handleUpdateTemplate = async (templateData: Partial<KRATemplate> & { goals?: any[] }) => {
    if (!template?.id) return;

    try {
      const { goals, ...templateUpdate } = templateData;
      
      // Update template
      await updateTemplate.mutateAsync({
        ...templateUpdate,
        id: template.id,
      });

      // Handle goals updates
      if (goals) {
        for (const goal of goals) {
          const hasRequiredFields = goal.goal_id && 
                                   goal.strategic_goal_title && 
                                   goal.smart_goal && 
                                   goal.weight && 
                                   goal.target;
          
          if (hasRequiredFields) {
            if (goal.isNew || !goal.id) {
              // Create new goal
              const goalData = {
                ...goal,
                template_id: template.id,
                id: undefined,
                tempId: undefined,
                isNew: undefined,
              };
              await createGoal.mutateAsync(goalData);
            } else {
              // Update existing goal
              const goalData = {
                ...goal,
                tempId: undefined,
                isNew: undefined,
              };
              await updateGoal.mutateAsync(goalData);
            }
          }
        }
      }
      
      toast.success('KRA template updated successfully');
      setShowForm(false);
      navigate(`/performance/kra/template/${template.id}?mode=view`);
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const handlePublishTemplate = async (templateId: string, selectedEmployees: string[], mode: 'assign' | 'reassign') => {
    try {
      // Create assignments without quarterly due dates (will be set individually in Team KRA section)
      
      const assignments = selectedEmployees.map(employeeId => ({
        template_id: templateId,
        employee_id: employeeId,
        assigned_by: user?.id || '',
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'assigned',
        // Quarterly due dates will be set individually in Team KRA section
        q1_due_date: null,
        q2_due_date: null,
        q3_due_date: null,
        q4_due_date: null,
        // Enable Q1 by default, others disabled until manager enables them
        q1_enabled: true,
        q2_enabled: false,
        q3_enabled: false,
        q4_enabled: false,
        q1_enabled_by: user?.id,
        q1_enabled_at: new Date().toISOString(),
        // Initialize quarterly status
        q1_status: 'not_started',
        q2_status: 'not_started',
        q3_status: 'not_started',
        q4_status: 'not_started'
      }));

      // Use direct Supabase call instead of the bulk assign hook for now
      // since we need to handle the new quarterly fields
      if (mode === 'reassign') {
        // For reassignment, update existing assignments
        for (const assignment of assignments) {
          const { employee_id, ...updateData } = assignment;
          const { error } = await supabase
            .from('kra_assignments')
            .update(updateData)
            .eq('template_id', templateId)
            .eq('employee_id', employee_id);
          
          if (error) throw error;
        }
      } else {
        // For new assignments, check for existing assignments first
        const { data: existingAssignments } = await supabase
          .from('kra_assignments')
          .select('employee_id')
          .eq('template_id', templateId)
          .in('employee_id', selectedEmployees);

        if (existingAssignments && existingAssignments.length > 0) {
          const existingEmployeeIds = existingAssignments.map(a => a.employee_id);
          const duplicateEmployees = selectedEmployees.filter(id => existingEmployeeIds.includes(id));
          
          if (duplicateEmployees.length > 0) {
            const shouldReassign = window.confirm(
              `${duplicateEmployees.length} employee(s) already have this KRA assigned. Do you want to reassign it to them?`
            );
            
            if (shouldReassign) {
              // Use reassign mode for all employees
              return handlePublishTemplate(templateId, selectedEmployees, 'reassign');
            } else {
              // Only assign to new employees
              const newEmployees = selectedEmployees.filter(id => !existingEmployeeIds.includes(id));
              if (newEmployees.length === 0) {
                toast.error('All selected employees already have this KRA assigned');
                return;
              }
              // Update assignments to only include new employees
              const filteredAssignments = assignments.filter(a => newEmployees.includes(a.employee_id));
              const { error } = await supabase
                .from('kra_assignments')
                .insert(filteredAssignments);
              
              if (error) throw error;
              toast.success(`KRA assigned to ${newEmployees.length} new employee(s). ${duplicateEmployees.length} employee(s) already had this KRA.`);
            }
          } else {
            // No duplicates, proceed with normal insertion
            const { error } = await supabase
              .from('kra_assignments')
              .insert(assignments);
            
            if (error) throw error;
          }
        } else {
          // No existing assignments, proceed with normal insertion
          const { error } = await supabase
            .from('kra_assignments')
            .insert(assignments);
          
          if (error) throw error;
        }
      }

      setIsAssignDialogOpen(false);
      toast.success(`Template ${mode === 'reassign' ? 'reassigned' : 'assigned'} successfully`);
    } catch (error) {
      console.error('Error publishing template:', error);
      toast.error('Failed to publish template');
    }
  };

  // NEW: Simplified function using the hook that triggers both notifications AND emails
  const handlePublishTemplateWithEmails = async (templateId: string, selectedEmployees: string[], mode: 'assign' | 'reassign') => {
    try {
      // Prepare assignments data for the hook
      const assignments = selectedEmployees.map(employeeId => ({
        employeeId,
        dueDate: null, // Will be set individually in Team KRA section
        assignedBy: user?.id || ''
      }));

      // Use the hook which will trigger BOTH notifications AND emails
      const result = await bulkAssignTemplate.mutateAsync({
        templateId,
        assignments,
        mode
      });

      // Create in-app notifications for reassignments to Admin, Manager, HR, and Employee
      if (mode === 'reassign' && Array.isArray(result)) {
        console.log('🔔 Creating in-app notifications for reassignments to all stakeholders:', result);
        
        for (const assignment of result) {
          if (assignment?.id && assignment?.employee_id) {
            try {
              // Get employee details for notification context
              const { data: employeeData } = await supabase
                .from('users')
                .select('full_name, email, manager_id')
                .eq('id', assignment.employee_id)
                .single();

              const employeeName = employeeData?.full_name || 'Employee';
              const templateName = template?.template_name || 'KRA Template';
              const managerName = user?.full_name || 'Manager';

              // 1. Notification to Employee
              await notificationApi.createNotification({
                user_id: assignment.employee_id,
                title: 'KRA Reassignment',
                message: `Your KRA "${templateName}" has been reassigned by ${managerName}. Please review the updated details.`,
                type: 'kra_assignment',
                data: {
                  assignment_id: assignment.id,
                  template_id: templateId,
                  template_name: templateName,
                  assigned_by: user?.id,
                  manager_name: managerName,
                  reassignment: true,
                  target: 'performance/my-kra'
                }
              });
              console.log('✅ Reassignment notification sent to Employee:', assignment.employee_id);

              // 2. Notification to Manager (if different from current user)
              if (employeeData?.manager_id && employeeData.manager_id !== user?.id) {
                await notificationApi.createNotification({
                  user_id: employeeData.manager_id,
                  title: 'KRA Reassignment - Team Member',
                  message: `${employeeName}'s KRA "${templateName}" has been reassigned by ${managerName}. Monitor progress as needed.`,
                  type: 'kra_assignment',
                  data: {
                    assignment_id: assignment.id,
                    template_id: templateId,
                    template_name: templateName,
                    employee_name: employeeName,
                    assigned_by: user?.id,
                    manager_name: managerName,
                    reassignment: true,
                    target: 'performance/team-kra'
                  }
                });
                console.log('✅ Reassignment notification sent to Manager:', employeeData.manager_id);
              }

              // 3. Notifications to HR Users
              const { data: hrUsers, error: hrError } = await supabase
                .from('users')
                .select('id, roles!inner(name)')
                .eq('status', 'active')
                .eq('roles.name', 'hr');

              console.log('🔍 HR Users Query Result:', { hrUsers, hrError });

              if (hrError) {
                console.error('❌ Error fetching HR users:', hrError);
              } else if (hrUsers && hrUsers.length > 0) {
                for (const hrUser of hrUsers) {
                  try {
                    await notificationApi.createNotification({
                      user_id: hrUser.id,
                      title: 'KRA Reassignment - HR Notice',
                      message: `${employeeName}'s KRA "${templateName}" has been reassigned by ${managerName}. Review for compliance and tracking.`,
                      type: 'kra_assignment',
                      data: {
                        assignment_id: assignment.id,
                        template_id: templateId,
                        template_name: templateName,
                        employee_name: employeeName,
                        assigned_by: user?.id,
                        manager_name: managerName,
                        reassignment: true,
                        target: 'performance/all-kra'
                      }
                    });
                    console.log('✅ HR notification sent to user:', hrUser.id);
                  } catch (hrNotificationError) {
                    console.error('❌ Failed to send HR notification:', hrNotificationError);
                  }
                }
                console.log(`✅ Reassignment notifications sent to ${hrUsers.length} HR users`);
              } else {
                console.log('ℹ️ No HR users found');
              }

              // 4. Notifications to Admin Users
              const { data: adminUsers, error: adminError } = await supabase
                .from('users')
                .select('id, roles!inner(name)')
                .eq('status', 'active')
                .in('roles.name', ['admin', 'super_admin']);

              console.log('🔍 Admin Users Query Result:', { adminUsers, adminError });

              if (adminError) {
                console.error('❌ Error fetching Admin users:', adminError);
              } else if (adminUsers && adminUsers.length > 0) {
                for (const adminUser of adminUsers) {
                  try {
                    await notificationApi.createNotification({
                      user_id: adminUser.id,
                      title: 'KRA Reassignment - Admin Notice',
                      message: `${employeeName}'s KRA "${templateName}" has been reassigned by ${managerName}. System oversight notification.`,
                      type: 'kra_assignment',
                      data: {
                        assignment_id: assignment.id,
                        template_id: templateId,
                        template_name: templateName,
                        employee_name: employeeName,
                        assigned_by: user?.id,
                        manager_name: managerName,
                        reassignment: true,
                        target: 'performance/all-kra'
                      }
                    });
                    console.log('✅ Admin notification sent to user:', adminUser.id);
                  } catch (adminNotificationError) {
                    console.error('❌ Failed to send Admin notification:', adminNotificationError);
                  }
                }
                console.log(`✅ Reassignment notifications sent to ${adminUsers.length} Admin users`);
              } else {
                console.log('ℹ️ No Admin users found');
              }

            } catch (notificationError) {
              console.error('❌ Failed to create reassignment notifications:', notificationError);
            }
          }
        }
      }

      // ALSO trigger emails directly for each assignment
      console.log('🎯 Triggering direct emails for assignments:', result);
      if (Array.isArray(result)) {
        for (const assignment of result) {
          if (assignment?.id) {
            await triggerKRAEmail(
              mode === 'reassign' ? 'reassignment' : 'assignment',
              assignment.id
            );
          }
        }
      }

      setIsAssignDialogOpen(false);
      toast.success(`Template ${mode === 'reassign' ? 'reassigned' : 'assigned'} successfully with notifications and emails sent!`);
      
      // Refresh assignments data
      if (refetchAssignments) {
        refetchAssignments();
      }
    } catch (error) {
      console.error('Error publishing template:', error);
      toast.error(`Failed to ${mode} template`);
    }
  };

  if (templateLoading && templateId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/performance/kra?tab=templates')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Templates
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === 'create' ? 'Create KRA Template' : 
               mode === 'edit' ? 'Edit KRA Template' : 
               template?.template_name || 'KRA Template'}
            </h1>
            <p className="text-muted-foreground">
              {mode === 'create' ? 'Create a new KRA template with quarterly due dates' :
               mode === 'edit' ? 'Modify the KRA template and its goals' :
               'View and manage the KRA template'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {template && (
            <Badge className={getStatusColor(template.status)}>
              {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
            </Badge>
          )}
          
          {!showForm && template && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Edit Template
              </Button>
              <Button
                onClick={() => setIsAssignDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Publish to Team
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6">
        {showForm ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {mode === 'create' ? 'Create New Template' : 'Edit Template'}
              </CardTitle>
              <CardDescription>
                {mode === 'create' 
                  ? 'Define KRA goals and set quarterly due dates for your team members'
                  : 'Modify the template details, goals, and quarterly schedules'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KRATemplateForm
                template={template}
                onSubmit={mode === 'create' ? handleCreateTemplate : handleUpdateTemplate}
                onCancel={() => {
                  setShowForm(false);
                  if (mode === 'create') {
                    navigate('/performance/kra?tab=templates');
                  }
                }}
                isLoading={createTemplate.isPending || updateTemplate.isPending}
              />
            </CardContent>
          </Card>
        ) : template ? (
          <KRATemplateDetails
            template={template}
            onClose={() => navigate('/performance/kra?tab=templates')}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Template Not Found</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                The requested KRA template could not be found or you don't have permission to view it.
              </p>
              <Button onClick={() => navigate('/performance/kra?tab=templates')}>
                Back to Templates
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assign Template Dialog */}
      {template && (
        <KRAAssignDialog
          isOpen={isAssignDialogOpen}
          onClose={() => setIsAssignDialogOpen(false)}
          template={template}
          teamMembers={teamMembers || []}
          existingAssignments={existingAssignments || []}
          onAssign={handlePublishTemplateWithEmails}
          isLoading={bulkAssignTemplate.isPending}
        />
      )}
    </div>
  );
}
