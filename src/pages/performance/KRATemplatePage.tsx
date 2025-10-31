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
  type KRATemplate 
} from '@/hooks/useKRA';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';

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
  const { data: existingAssignments } = useTemplateAssignments(templateId || '');
  
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
        // For new assignments, insert new records
        const { error } = await supabase
          .from('kra_assignments')
          .insert(assignments);
        
        if (error) throw error;
      }

      setIsAssignDialogOpen(false);
      toast.success(`Template ${mode === 'reassign' ? 'reassigned' : 'assigned'} successfully`);
    } catch (error) {
      console.error('Error publishing template:', error);
      toast.error('Failed to publish template');
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
          onAssign={handlePublishTemplate}
          isLoading={bulkAssignTemplate.isPending}
        />
      )}
    </div>
  );
}
