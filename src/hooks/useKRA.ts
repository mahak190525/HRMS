import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface KRACategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface KRAEvaluationLevel {
  id: string;
  level_number: number;
  level_name: string;
  description?: string;
}

export interface KRATemplate {
  id: string;
  template_name: string;
  description?: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_by: string;
  department_id?: string;
  total_weight: number;
  
  // Quarterly due dates
  q1_due_date?: string;
  q2_due_date?: string;
  q3_due_date?: string;
  q4_due_date?: string;
  
  created_at: string;
  updated_at: string;
  created_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  department?: {
    id: string;
    name: string;
  };
  goals?: KRAGoal[];
}

export interface KRAGoal {
  id: string;
  template_id: string;
  goal_id: string;
  strategic_goal_title: string;
  category_id?: string;
  smart_goal: string;
  weight: number;
  max_score: number;
  target: string;
  dependencies?: string;
  level_1_marks: string;
  level_2_marks: string;
  level_3_marks: string;
  level_4_marks: string;
  level_5_marks: string;
  level_1_points: number;
  level_2_points: number;
  level_3_points: number;
  level_4_points: number;
  level_5_points: number;
  level_1_rating: string;
  level_2_rating: string;
  level_3_rating: string;
  level_4_rating: string;
  level_5_rating: string;
  manager_comments?: string;
  display_order: number;
  category?: KRACategory;
}

export interface KRAAssignment {
  id: string;
  template_id: string;
  employee_id: string;
  assigned_by: string;
  assigned_date: string;
  due_date?: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'evaluated' | 'approved';
  total_score: number;
  total_possible_score: number;
  overall_percentage: number;
  overall_rating?: string;
  submitted_at?: string;
  submitted_by?: string;
  evaluated_at?: string;
  evaluated_by?: string;
  
  // Quarterly status tracking
  q1_status: 'not_started' | 'in_progress' | 'submitted' | 'evaluated';
  q2_status: 'not_started' | 'in_progress' | 'submitted' | 'evaluated';
  q3_status: 'not_started' | 'in_progress' | 'submitted' | 'evaluated';
  q4_status: 'not_started' | 'in_progress' | 'submitted' | 'evaluated';
  
  // Quarterly due dates (employee-specific)
  q1_due_date?: string;
  q2_due_date?: string;
  q3_due_date?: string;
  q4_due_date?: string;
  
  // Quarterly visibility controls
  q1_enabled: boolean;
  q2_enabled: boolean;
  q3_enabled: boolean;
  q4_enabled: boolean;
  
  // Quarterly enabled tracking
  q1_enabled_at?: string;
  q2_enabled_at?: string;
  q3_enabled_at?: string;
  q4_enabled_at?: string;
  q1_enabled_by?: string;
  q2_enabled_by?: string;
  q3_enabled_by?: string;
  q4_enabled_by?: string;
  
  // Quarterly submission tracking
  q1_submitted_at?: string;
  q1_submitted_by?: string;
  q1_evaluated_at?: string;
  q1_evaluated_by?: string;
  q2_submitted_at?: string;
  q2_submitted_by?: string;
  q2_evaluated_at?: string;
  q2_evaluated_by?: string;
  q3_submitted_at?: string;
  q3_submitted_by?: string;
  q3_evaluated_at?: string;
  q3_evaluated_by?: string;
  q4_submitted_at?: string;
  q4_submitted_by?: string;
  q4_evaluated_at?: string;
  q4_evaluated_by?: string;
  
  // Quarterly scores
  q1_total_score: number;
  q1_total_possible_score: number;
  q1_overall_percentage: number;
  q1_overall_rating?: string;
  q2_total_score: number;
  q2_total_possible_score: number;
  q2_overall_percentage: number;
  q2_overall_rating?: string;
  q3_total_score: number;
  q3_total_possible_score: number;
  q3_overall_percentage: number;
  q3_overall_rating?: string;
  q4_total_score: number;
  q4_total_possible_score: number;
  q4_overall_percentage: number;
  q4_overall_rating?: string;
  
  // Cumulative scores (running totals)
  q1_cumulative_score: number;
  q1_cumulative_possible_score: number;
  q1_cumulative_percentage: number;
  q2_cumulative_score: number;
  q2_cumulative_possible_score: number;
  q2_cumulative_percentage: number;
  q3_cumulative_score: number;
  q3_cumulative_possible_score: number;
  q3_cumulative_percentage: number;
  q4_cumulative_score: number;
  q4_cumulative_possible_score: number;
  q4_cumulative_percentage: number;
  
  // Annual summary
  annual_average_score: number;
  annual_average_percentage: number;
  annual_overall_rating?: string;
  completed_quarters: number;
  
  template?: KRATemplate;
  employee?: {
    id: string;
    full_name: string;
    email: string;
    employee_id?: string;
  };
  assigned_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  evaluations?: KRAEvaluation[];
}

export interface KRAEvaluation {
  id: string;
  assignment_id: string;
  goal_id: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  employee_comments?: string;
  employee_submitted_at?: string;
  selected_level?: number;
  awarded_marks: number;
  awarded_points: number;
  final_rating?: string;
  manager_evaluation_comments?: string;
  manager_evaluated_at?: string;
  manager_evaluated_by?: string;
  weighted_score: number;
  goal?: KRAGoal;
}

// Hooks for KRA Categories
export function useKRACategories() {
  return useQuery({
    queryKey: ['kra-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as KRACategory[];
    },
  });
}

// Hooks for KRA Evaluation Levels
export function useKRAEvaluationLevels() {
  return useQuery({
    queryKey: ['kra-evaluation-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_evaluation_levels')
        .select('*')
        .order('level_number');

      if (error) throw error;
      return data as KRAEvaluationLevel[];
    },
  });
}

// Hooks for KRA Templates
export function useKRATemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['kra-templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_templates')
        .select(`
          *,
          created_by_user:users!kra_templates_created_by_fkey (
            id, full_name, email
          ),
          department:departments (
            id, name
          ),
          goals:kra_goals (
            *,
            category:kra_categories (
              id, name, description
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KRATemplate[];
    },
  });
}

export function useKRATemplate(templateId: string) {
  return useQuery({
    queryKey: ['kra-template', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_templates')
        .select(`
          *,
          created_by_user:users!kra_templates_created_by_fkey (
            id, full_name, email
          ),
          department:departments (
            id, name
          ),
          goals:kra_goals (
            *,
            category:kra_categories (
              id, name, description
            )
          )
        `)
        .eq('id', templateId)
        .single();

      if (error) throw error;
      return data as KRATemplate;
    },
    enabled: !!templateId,
  });
}

// Hook for creating KRA template
export function useCreateKRATemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: Partial<KRATemplate>) => {
      const { data, error } = await supabase
        .from('kra_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
    },
    onError: (error) => {
      console.error('Failed to create KRA template:', error);
    },
  });
}

// Hook for updating KRA template
export function useUpdateKRATemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...templateData }: Partial<KRATemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('kra_templates')
        .update(templateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
      queryClient.invalidateQueries({ queryKey: ['kra-template'] });
    },
    onError: (error) => {
      console.error('Failed to update KRA template:', error);
    },
  });
}

// Hook for deleting KRA templates
export function useDeleteKRATemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // First check if template has any assignments
      const { data: assignments, error: assignmentError } = await supabase
        .from('kra_assignments')
        .select('id')
        .eq('template_id', templateId)
        .limit(1);

      if (assignmentError) throw assignmentError;

      if (assignments && assignments.length > 0) {
        // Archive the template instead of deleting it
        const { error: archiveError } = await supabase
          .from('kra_templates')
          .update({ 
            status: 'archived',
            updated_at: new Date().toISOString()
          })
          .eq('id', templateId);

        if (archiveError) throw archiveError;
        return { templateId, archived: true };
      }

      // Delete the template (goals will be deleted by cascade)
      const { error } = await supabase
        .from('kra_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      return { templateId, archived: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
      queryClient.invalidateQueries({ queryKey: ['kra-template'] });
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      // Let the component handle the toast
    },
  });
}

// Hook for copying KRA templates
export function useCopyKRATemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, currentUserId }: { templateId: string; currentUserId: string }) => {
      // First, get the original template with all its goals
      const { data: originalTemplate, error: templateError } = await supabase
        .from('kra_templates')
        .select(`
          *,
          goals:kra_goals(*)
        `)
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;
      if (!originalTemplate) throw new Error('Template not found');

      // Create the new template (copy)
      const newTemplateData = {
        template_name: `${originalTemplate.template_name} (Copy)`,
        description: originalTemplate.description,
        evaluation_period_start: originalTemplate.evaluation_period_start,
        evaluation_period_end: originalTemplate.evaluation_period_end,
        status: 'draft', // Always create copies as draft
        created_by: currentUserId, // Use current user as creator
        department_id: originalTemplate.department_id,
        total_weight: originalTemplate.total_weight,
      };

      const { data: newTemplate, error: createTemplateError } = await supabase
        .from('kra_templates')
        .insert([newTemplateData])
        .select()
        .single();

      if (createTemplateError) throw createTemplateError;
      if (!newTemplate) throw new Error('Failed to create template copy');

      // Copy all the goals
      if (originalTemplate.goals && originalTemplate.goals.length > 0) {
        const newGoals = originalTemplate.goals.map((goal: any) => ({
          template_id: newTemplate.id,
          goal_id: goal.goal_id,
          strategic_goal_title: goal.strategic_goal_title,
          category_id: goal.category_id,
          smart_goal: goal.smart_goal,
          weight: goal.weight,
          max_score: goal.max_score,
          target: goal.target,
          dependencies: goal.dependencies,
          level_1_marks: goal.level_1_marks,
          level_2_marks: goal.level_2_marks,
          level_3_marks: goal.level_3_marks,
          level_4_marks: goal.level_4_marks,
          level_5_marks: goal.level_5_marks,
          level_1_points: goal.level_1_points,
          level_2_points: goal.level_2_points,
          level_3_points: goal.level_3_points,
          level_4_points: goal.level_4_points,
          level_5_points: goal.level_5_points,
          level_1_rating: goal.level_1_rating,
          level_2_rating: goal.level_2_rating,
          level_3_rating: goal.level_3_rating,
          level_4_rating: goal.level_4_rating,
          level_5_rating: goal.level_5_rating,
          manager_comments: goal.manager_comments,
          display_order: goal.display_order,
        }));

        const { error: createGoalsError } = await supabase
          .from('kra_goals')
          .insert(newGoals);

        if (createGoalsError) throw createGoalsError;
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
      queryClient.invalidateQueries({ queryKey: ['kra-template'] });
    },
    onError: (error) => {
      console.error('Error copying template:', error);
    },
  });
}

// Hook for creating KRA goals
export function useCreateKRAGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalData: Partial<KRAGoal>) => {
      // Remove relationship fields and temporary fields that don't exist in the database
      const { category, tempId, isNew, ...dbGoalData } = goalData as any;
      
      const { data, error } = await supabase
        .from('kra_goals')
        .insert(dbGoalData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kra-template', (variables as any).template_id] });
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
    },
    onError: (error) => {
      console.error('Failed to add KRA goal:', error);
    },
  });
}

// Hook for updating KRA goals
export function useUpdateKRAGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...goalData }: Partial<KRAGoal> & { id: string }) => {
      // Remove relationship fields and temporary fields that don't exist in the database
      const { category, tempId, isNew, ...dbGoalData } = goalData as any;
      
      const { data, error } = await supabase
        .from('kra_goals')
        .update(dbGoalData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kra-template', data.template_id] });
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
    },
    onError: (error) => {
      console.error('Failed to update KRA goal:', error);
    },
  });
}

// Hook for KRA assignments (for managers)
export function useKRAAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['kra-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_assignments')
        .select(`
          *,
          template:kra_templates (
            id, template_name, evaluation_period_start, evaluation_period_end
          ),
          employee:users!kra_assignments_employee_id_fkey (
            id, full_name, email, employee_id
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, full_name, email
          )
        `)
        .eq('assigned_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KRAAssignment[];
    },
  });
}

// Hook for admin/HR to view all KRA assignments
export function useAllKRAAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-kra-assignments', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Check if user has admin/HR permissions
      const roleName = user.role?.name || user.role_id || '';
      const isAdmin = user.isSA || roleName === 'admin' || roleName === 'super_admin';
      const isHR = roleName === 'hr' || roleName === 'hrm';

      if (!isAdmin && !isHR) {
        throw new Error('Insufficient permissions to view all KRA assignments');
      }

      const { data, error } = await supabase
        .from('kra_assignments')
        .select(`
          *,
          template:kra_templates (
            id, template_name, evaluation_period_start, evaluation_period_end, description
          ),
          employee:users!kra_assignments_employee_id_fkey (
            id, full_name, email, employee_id, position, department_id
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, full_name, email, position
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KRAAssignment[];
    },
    enabled: !!user,
  });
}

// Hook for employee's KRA assignments
export function useMyKRAAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-kra-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_assignments')
        .select(`
          *,
          template:kra_templates (
            id, template_name, evaluation_period_start, evaluation_period_end, description
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, full_name, email
          )
        `)
        .eq('employee_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KRAAssignment[];
    },
    enabled: !!user?.id,
  });
}

// Hook for getting KRA assignment details with evaluations
export function useKRAAssignmentDetails(assignmentId: string) {
  return useQuery({
    queryKey: ['kra-assignment-details', assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_assignments')
        .select(`
          *,
          template:kra_templates (
            *,
            goals:kra_goals (
              *,
              category:kra_categories (
                id, name, description
              )
            )
          ),
          employee:users!kra_assignments_employee_id_fkey (
            id, full_name, email, employee_id
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, full_name, email
          ),
          evaluations:kra_evaluations (
            *,
            goal:kra_goals (
              id, goal_id, strategic_goal_title, weight
            )
          )
        `)
        .eq('id', assignmentId)
        .single();

      if (error) throw error;
      return data as KRAAssignment;
    },
    enabled: !!assignmentId,
  });
}

// Hook for creating KRA assignments
export function useCreateKRAAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentData: Partial<KRAAssignment>) => {
      const { data, error } = await supabase
        .from('kra_assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-assignments'] });
    },
    onError: (error) => {
      console.error('Failed to assign KRA:', error);
    },
  });
}

// Hook for bulk creating KRA assignments
export function useBulkCreateKRAAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentsData: Partial<KRAAssignment>[]) => {
      const { data, error } = await supabase
        .from('kra_assignments')
        .insert(assignmentsData)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-assignments'] });
    },
    onError: (error) => {
      console.error('Failed to assign KRA:', error);
    },
  });
}

// Hook for handling bulk assignment/reassignment
export function useBulkAssignKRATemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      templateId, 
      assignments, 
      mode 
    }: { 
      templateId: string; 
      assignments: Array<{ employeeId: string; dueDate: string; assignedBy: string }>; 
      mode: 'assign' | 'reassign' 
    }) => {
      
      if (mode === 'reassign') {
        // For reassignment, we need to handle existing assignments
        const reassignmentPromises = assignments.map(async ({ employeeId, dueDate, assignedBy }) => {
          // First, try to update existing assignment
          const { data: existingAssignment, error: findError } = await supabase
            .from('kra_assignments')
            .select('id, status')
            .eq('template_id', templateId)
            .eq('employee_id', employeeId)
            .single();

          if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows found
            throw findError;
          }

          if (existingAssignment) {
            // Update existing assignment
            const { data, error } = await supabase
              .from('kra_assignments')
              .update({
                assigned_by: assignedBy,
                assigned_date: new Date().toISOString().split('T')[0],
                due_date: dueDate,
                status: 'assigned', // Reset to assigned status
                submitted_at: null,
                submitted_by: null,
                evaluated_at: null,
                evaluated_by: null,
                total_score: 0,
                total_possible_score: 0,
                overall_percentage: 0,
                overall_rating: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingAssignment.id)
              .select();

            if (error) throw error;

            // Clear existing evaluations for reassignment
            await supabase
              .from('kra_evaluations')
              .delete()
              .eq('assignment_id', existingAssignment.id);

            return data[0];
          } else {
            // Create new assignment if none exists
            const { data, error } = await supabase
              .from('kra_assignments')
              .insert({
                template_id: templateId,
                employee_id: employeeId,
                assigned_by: assignedBy,
                assigned_date: new Date().toISOString().split('T')[0],
                due_date: dueDate,
                status: 'assigned'
              })
              .select();

            if (error) throw error;
            return data[0];
          }
        });

        return await Promise.all(reassignmentPromises);
      } else {
        // Regular assignment - only assign to employees who don't have this template
        const newAssignments = assignments.map(({ employeeId, dueDate, assignedBy }) => ({
          template_id: templateId,
          employee_id: employeeId,
          assigned_by: assignedBy,
          assigned_date: new Date().toISOString().split('T')[0],
          due_date: dueDate,
          status: 'assigned' as const
        }));

        const { data, error } = await supabase
          .from('kra_assignments')
          .insert(newAssignments)
          .select();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kra-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['template-assignments', variables.templateId] });
    },
    onError: (error) => {
      console.error('Failed to assign KRA template:', error);
    },
  });
}

// Hook for creating/updating KRA evaluations
export function useUpdateKRAEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...evaluationData }: Partial<KRAEvaluation> & { id?: string }) => {
      if (id) {
        // Update existing evaluation
        const { data, error } = await supabase
          .from('kra_evaluations')
          .update(evaluationData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new evaluation
        const { data, error } = await supabase
          .from('kra_evaluations')
          .insert(evaluationData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kra-assignment-details', data.assignment_id] });
      queryClient.invalidateQueries({ queryKey: ['my-kra-assignments'] });
    },
    onError: (error) => {
      console.error('Failed to update evaluation:', error);
    },
  });
}

// Hook for getting team members (for managers)
export function useTeamMembers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-members', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, employee_id, position, department_id')
        .eq('manager_id', user?.id)
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Hook for getting existing assignments for a template
export function useTemplateAssignments(templateId: string) {
  return useQuery({
    queryKey: ['template-assignments', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kra_assignments')
        .select(`
          *,
          employee:users!kra_assignments_employee_id_fkey (
            id, full_name, email, employee_id
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, full_name, email
          )
        `)
        .eq('template_id', templateId)
        .order('assigned_date', { ascending: false });

      if (error) throw error;
      return data as KRAAssignment[];
    },
    enabled: !!templateId,
  });
}

// Hook for creating KRA category
export function useCreateKRACategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryData: Partial<KRACategory>) => {
      const { data, error } = await supabase
        .from('kra_categories')
        .insert(categoryData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-categories'] });
    },
    onError: (error) => {
      console.error('Failed to create category:', error);
    },
  });
}
