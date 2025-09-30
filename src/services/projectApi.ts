import { supabase } from './supabase';
import { notificationApi } from './notificationApi';
import { NOTIFICATION_TYPES } from '@/constants';

export interface Project {
  id: string;
  project_name: string;
  status: 'active' | 'completed' | 'on-hold' | 'cancelled';
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  role_type: 'QA' | 'Development' | 'Design' | 'Testing' | 'Management' | 'Support' | 'Other' | 'Custom' | null;
  custom_role_name?: string;
  assigned_by: string; // User ID who assigned this role
  assigned_at?: string;
  is_active?: boolean;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface ProjectWithRelations extends Project {
  project_assignments?: ProjectAssignment[];
  created_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CreateProjectData {
  project_name: string;
  assignments: Array<{
    user_id: string;
    role_type: 'QA' | 'Development' | 'Design' | 'Testing' | 'Management' | 'Support' | 'Other' | 'Custom' | null;
    custom_role_name?: string;
  }>;
  status: 'active' | 'completed' | 'on-hold' | 'cancelled';
}

export interface UpdateProjectData extends CreateProjectData {}

export const projectApi = {
  // Fetch all projects with user details
  async getProjects(): Promise<ProjectWithRelations[]> {
    const { data, error } = await supabase
      .from('new_projects')
      .select(`
        *,
        created_by_user:created_by(
          id,
          full_name,
          email
        ),
        project_assignments(
          id,
          user_id,
          role_type,
          custom_role_name,
          assigned_by,
          assigned_at,
          is_active,
          user:user_id(
            id,
            full_name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Fetch all users for dropdowns
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role_id')
      .eq('status', 'active')
      .order('full_name');
    
    if (error) throw error;
    return data;
  },



  // Create a new project
  async createProject(data: CreateProjectData): Promise<Project> {
    // Get the current user's ID from the public.users table

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .limit(1)
      .single();
    
    if (usersError || !users) {
      throw new Error('No users found in system');
    }
    
    console.log('Using user for project creation:', users);
    
    // Verify the user exists before using their ID
    const { data: userCheck, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', users.id)
      .single();
    
    if (userCheckError || !userCheck) {
      throw new Error(`User with ID ${users.id} not found in users table`);
    }
    
    console.log('User verification successful:', userCheck);
    
    // First create the project
    const { data: project, error: projectError } = await supabase
      .from('new_projects')
      .insert({
        project_name: data.project_name,
        status: data.status,
        created_by: users.id,
      })
      .select('*')
      .single();

    if (projectError) {
      console.error('Project creation error:', projectError);
      throw projectError;
    }

    // Then create project assignments
    if (data.assignments.length > 0) {
      const assignments = data.assignments.map(assignment => ({
        project_id: project.id,
        user_id: assignment.user_id,
        role_type: assignment.role_type,
        custom_role_name: assignment.custom_role_name || null,
        assigned_by: users.id, // Set the assigned_by to the user creating the project
      }));

      const { error: assignmentError } = await supabase
        .from('project_assignments')
        .insert(assignments);

      if (assignmentError) {
        console.error('Assignment creation error:', assignmentError);
        throw assignmentError;
      }

      // Send notifications to assigned users
      try {
        const notificationPromises = data.assignments.map(async (assignment) => {
          const roleText = assignment.role_type 
            ? (assignment.role_type === 'Other' && assignment.custom_role_name 
                ? assignment.custom_role_name 
                : assignment.role_type)
            : 'team member';

          await notificationApi.createNotification({
            user_id: assignment.user_id,
            title: 'Project Assignment',
            message: `You have been assigned to project "${project.project_name}" as ${roleText} role.`,
            type: NOTIFICATION_TYPES.PROJECT_ASSIGNED,
            data: { 
              project_id: project.id, 
              project_name: project.project_name,
              role_type: assignment.role_type,
              custom_role_name: assignment.custom_role_name,
              assigned_by: users.id,
              assigned_by_name: users.full_name,
              action: 'view',
              target: 'projects'
            }
          });
        });

        await Promise.all(notificationPromises);
        console.log(`Sent assignment notifications for ${data.assignments.length} users`);
      } catch (notificationError) {
        console.error('Failed to send assignment notifications:', notificationError);
        // Don't throw here - project creation was successful, just notification failed
      }
    }

    return project;
  },

  // Update an existing project
  async updateProject(id: string, data: UpdateProjectData): Promise<void> {
    // Get current project and assignments for comparison
    const { data: currentProject, error: fetchError } = await supabase
      .from('new_projects')
      .select(`
        *,
        project_assignments(
          user_id,
          role_type,
          custom_role_name
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Update project details
    const { error: projectError } = await supabase
      .from('new_projects')
      .update({
        project_name: data.project_name,
        status: data.status,
      })
      .eq('id', id);

    if (projectError) throw projectError;

    // Get current and new assignments for comparison
    const currentAssignments = currentProject.project_assignments || [];
    const newAssignments = data.assignments;

    // Find removed users (in current but not in new)
    const removedUsers = currentAssignments.filter(current => 
      !newAssignments.some(newAssign => newAssign.user_id === current.user_id)
    );

    // Find added users (in new but not in current)
    const addedUsers = newAssignments.filter(newAssign =>
      !currentAssignments.some(current => current.user_id === newAssign.user_id)
    );

    // Find users with role changes
    const roleChangedUsers = newAssignments.filter(newAssign => {
      const currentAssign = currentAssignments.find(current => current.user_id === newAssign.user_id);
      return currentAssign && (
        currentAssign.role_type !== newAssign.role_type ||
        currentAssign.custom_role_name !== newAssign.custom_role_name
      );
    });

    // Delete existing assignments and recreate
    await supabase.from('project_assignments').delete().eq('project_id', id);

    // Create new assignments
    if (data.assignments.length > 0) {
      // Get the current user's ID for assigned_by
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name')
        .limit(1)
        .single();
      
      if (usersError || !users) {
        throw new Error('No users found in system');
      }

      const assignments = data.assignments.map(assignment => ({
        project_id: id,
        user_id: assignment.user_id,
        role_type: assignment.role_type,
        custom_role_name: assignment.custom_role_name || null,
        assigned_by: users.id, // Set the assigned_by to the user updating the project
      }));

      const { error: assignmentError } = await supabase
        .from('project_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      // Send notifications for changes
      try {
        const notificationPromises = [];

        // Notify removed users
        for (const removedUser of removedUsers) {
          notificationPromises.push(
            notificationApi.createNotification({
              user_id: removedUser.user_id,
              title: 'Project Assignment Removed',
              message: `You have been removed from project "${data.project_name}".`,
              type: NOTIFICATION_TYPES.PROJECT_UNASSIGNED,
              data: { 
                project_id: id, 
                project_name: data.project_name,
                removed_by: users.id,
                removed_by_name: users.full_name,
                action: 'view',
                target: 'projects'
              }
            })
          );
        }

        // Notify newly added users
        for (const addedUser of addedUsers) {
          const roleText = addedUser.role_type 
            ? (addedUser.role_type === 'Other' && addedUser.custom_role_name 
                ? addedUser.custom_role_name 
                : addedUser.role_type)
            : 'team member';

          notificationPromises.push(
            notificationApi.createNotification({
              user_id: addedUser.user_id,
              title: 'Project Assignment',
              message: `You have been assigned to project "${data.project_name}" as ${roleText}.`,
              type: NOTIFICATION_TYPES.PROJECT_ASSIGNED,
              data: { 
                project_id: id, 
                project_name: data.project_name,
                role_type: addedUser.role_type,
                custom_role_name: addedUser.custom_role_name,
                assigned_by: users.id,
                assigned_by_name: users.full_name,
                action: 'view',
                target: 'projects'
              }
            })
          );
        }

        // Notify users with role changes
        for (const changedUser of roleChangedUsers) {
          const newRoleText = changedUser.role_type 
            ? (changedUser.role_type === 'Other' && changedUser.custom_role_name 
                ? changedUser.custom_role_name 
                : changedUser.role_type)
            : 'team member';

          notificationPromises.push(
            notificationApi.createNotification({
              user_id: changedUser.user_id,
              title: 'Project Role Updated',
              message: `Your role in project "${data.project_name}" has been updated to ${newRoleText}.`,
              type: NOTIFICATION_TYPES.PROJECT_ROLE_UPDATED,
              data: { 
                project_id: id, 
                project_name: data.project_name,
                new_role_type: changedUser.role_type,
                new_custom_role_name: changedUser.custom_role_name,
                updated_by: users.id,
                updated_by_name: users.full_name,
                action: 'view',
                target: 'projects'
              }
            })
          );
        }

        await Promise.all(notificationPromises);
        console.log(`Sent ${removedUsers.length} removal, ${addedUsers.length} assignment, and ${roleChangedUsers.length} role change notifications`);
      } catch (notificationError) {
        console.error('Failed to send update notifications:', notificationError);
        // Don't throw here - project update was successful, just notification failed
      }
    } else {
      // If no new assignments, notify all removed users
      try {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name')
          .limit(1)
          .single();
        
        if (users && currentAssignments.length > 0) {
          const notificationPromises = currentAssignments.map(removedUser =>
            notificationApi.createNotification({
              user_id: removedUser.user_id,
              title: 'Project Assignment Removed',
              message: `You have been removed from project "${data.project_name}".`,
              type: NOTIFICATION_TYPES.PROJECT_UNASSIGNED,
              data: { 
                project_id: id, 
                project_name: data.project_name,
                removed_by: users.id,
                removed_by_name: users.full_name,
                action: 'view',
                target: 'projects'
              }
            })
          );

          await Promise.all(notificationPromises);
          console.log(`Sent removal notifications to ${currentAssignments.length} users`);
        }
      } catch (notificationError) {
        console.error('Failed to send removal notifications:', notificationError);
      }
    }
  },

  // Delete a project
  async deleteProject(projectId: string): Promise<void> {
    // Get project details and assignments before deletion for notifications
    const { data: projectToDelete, error: fetchError } = await supabase
      .from('new_projects')
      .select(`
        *,
        project_assignments(user_id)
      `)
      .eq('id', projectId)
      .single();

    if (fetchError) throw fetchError;

    // Delete related assignments first (CASCADE should handle this, but being explicit)
    await supabase.from('project_assignments').delete().eq('project_id', projectId);
    
    // Delete the project
    const { error } = await supabase
      .from('new_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;

    // Send notifications to users who were assigned to the deleted project
    if (projectToDelete.project_assignments && projectToDelete.project_assignments.length > 0) {
      try {
        // Get current user for the deletion notification
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name')
          .limit(1)
          .single();

        if (users) {
          const notificationPromises = projectToDelete.project_assignments.map(assignment =>
            notificationApi.createNotification({
              user_id: assignment.user_id,
              title: 'Project Deleted',
              message: `Project "${projectToDelete.project_name}" has been deleted. You are no longer assigned to this project.`,
              type: NOTIFICATION_TYPES.PROJECT_DELETED,
              data: { 
                project_id: projectId, 
                project_name: projectToDelete.project_name,
                deleted_by: users.id,
                deleted_by_name: users.full_name,
                action: 'view',
                target: 'projects'
              }
            })
          );

          await Promise.all(notificationPromises);
          console.log(`Sent deletion notifications to ${projectToDelete.project_assignments.length} users`);
        }
      } catch (notificationError) {
        console.error('Failed to send deletion notifications:', notificationError);
        // Don't throw here - project deletion was successful, just notification failed
      }
    }
  },
};
