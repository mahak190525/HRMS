import { supabase } from './supabase';
import type { User } from '@/types';

export const lmsApi = {
  // Dashboard Stats
  async getDashboardStats(userId: string) {
    // Get user's accessible modules
    const { data: accessibleModules } = await supabase
      .from('learning_modules')
      .select('id')
      .eq('status', 'active');

    // Get user's progress
    const { data: userProgress } = await supabase
      .from('user_module_progress')
      .select('status, progress_percentage')
      .eq('user_id', userId);

    // Get completed modules
    const completedModules = userProgress?.filter(p => p.status === 'completed').length || 0;
    const totalModules = accessibleModules?.length || 0;
    const inProgressModules = userProgress?.filter(p => p.status === 'in_progress').length || 0;
    const overallProgress = userProgress?.reduce((sum, p) => sum + p.progress_percentage, 0) / (userProgress?.length || 1) || 0;

    // Get quiz attempts
    const { data: quizAttempts } = await supabase
      .from('user_quiz_attempts')
      .select('score, passed')
      .eq('user_id', userId);

    const totalQuizzes = quizAttempts?.length || 0;
    const passedQuizzes = quizAttempts?.filter(q => q.passed).length || 0;
    const averageScore = quizAttempts?.reduce((sum, q) => sum + q.score, 0) / (quizAttempts?.length || 1) || 0;

    // Get document uploads
    const { data: documents } = await supabase
      .from('user_documents')
      .select('status')
      .eq('user_id', userId);

    const totalDocuments = documents?.length || 0;
    const approvedDocuments = documents?.filter(d => d.status === 'approved').length || 0;

    return {
      totalModules,
      completedModules,
      inProgressModules,
      overallProgress: Math.round(overallProgress),
      totalQuizzes,
      passedQuizzes,
      averageScore: Math.round(averageScore),
      totalDocuments,
      approvedDocuments,
      completionRate: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0
    };
  },

  // Learning Modules
  async getUserModules(userId: string) {
    const { data, error } = await supabase
      .from('learning_modules')
      .select(`
        *,
        user_progress:user_module_progress!user_module_progress_module_id_fkey(
          status,
          progress_percentage,
          started_at,
          completed_at,
          last_accessed_at,
          total_time_spent_minutes
        ),
        resources:module_resources(*),
        quizzes:module_quizzes(*)
      `)
      .eq('status', 'active')
      .eq('user_progress.user_id', userId)
      .order('category', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getModuleById(moduleId: string, userId: string) {
    const { data, error } = await supabase
      .from('learning_modules')
      .select(`
        *,
        user_progress:user_module_progress!user_module_progress_module_id_fkey(
          status,
          progress_percentage,
          started_at,
          completed_at,
          last_accessed_at,
          total_time_spent_minutes
        ),
        resources:module_resources(*),
        quizzes:module_quizzes(
          *,
          questions:quiz_questions(*)
        )
      `)
      .eq('id', moduleId)
      .eq('user_progress.user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateModuleProgress(userId: string, moduleId: string, progressData: any) {
    const { data, error } = await supabase
      .from('user_module_progress')
      .upsert({
        user_id: userId,
        module_id: moduleId,
        ...progressData,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Quiz Management
  async getQuizById(quizId: string) {
    const { data, error } = await supabase
      .from('module_quizzes')
      .select(`
        *,
        questions:quiz_questions(*),
        module:learning_modules(title, description)
      `)
      .eq('id', quizId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserQuizAttempts(userId: string, quizId: string) {
    const { data, error } = await supabase
      .from('user_quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .order('attempt_number', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async submitQuizAttempt(attemptData: {
    user_id: string;
    quiz_id: string;
    attempt_number: number;
    answers: any;
    score: number;
    passed: boolean;
    started_at: string;
    submitted_at: string;
    time_taken_minutes: number;
  }) {
    const { data, error } = await supabase
      .from('user_quiz_attempts')
      .insert(attemptData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Document Management
  async getDocumentRequirements(userId: string) {
    const { data, error } = await supabase
      .from('document_requirements')
      .select(`
        *,
        user_documents:user_documents!user_documents_document_requirement_id_fkey(
          id,
          document_name,
          status,
          uploaded_at,
          review_comments
        )
      `)
      .eq('user_documents.user_id', userId);
    
    if (error) throw error;
    return data;
  },

  async getUserDocuments(userId: string) {
    const { data, error } = await supabase
      .from('user_documents')
      .select(`
        *,
        requirement:document_requirements(name, description, is_mandatory),
        reviewed_by_user:users!reviewed_by(full_name)
      `)
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async uploadDocument(documentData: {
    user_id: string;
    document_requirement_id?: string;
    document_name: string;
    document_type: string;
    file_url: string;
    file_size: number;
    mime_type: string;
  }) {
    const { data, error } = await supabase
      .from('user_documents')
      .insert(documentData)
      .select(`
        *,
        requirement:document_requirements(name, description, is_mandatory)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Manager/HR Dashboard
  async getAllCandidatesProgress() {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(name, description),
        department:departments!users_department_id_fkey(name, description),
        module_progress:user_module_progress(
          module_id,
          status,
          progress_percentage,
          completed_at,
          module:learning_modules(title, category, is_mandatory)
        ),
        quiz_attempts:user_quiz_attempts(
          quiz_id,
          score,
          passed,
          submitted_at,
          quiz:module_quizzes(title, module:learning_modules(title))
        ),
        documents:user_documents(
          document_name,
          document_type,
          status,
          uploaded_at,
          requirement:document_requirements(name, is_mandatory)
        )
      `)
      .in('role_id', ['candidate', 'employee'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getCandidateProgress(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(name, description),
        department:departments!users_department_id_fkey(name, description),
        module_progress:user_module_progress(
          *,
          module:learning_modules(title, description, category, is_mandatory, estimated_duration_hours)
        ),
        quiz_attempts:user_quiz_attempts(
          *,
          quiz:module_quizzes(title, passing_score, module:learning_modules(title))
        ),
        documents:user_documents(
          *,
          requirement:document_requirements(name, description, is_mandatory),
          reviewed_by_user:users!reviewed_by(full_name)
        )
      `)
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateDocumentStatus(documentId: string, status: string, reviewComments?: string, reviewedBy?: string) {
    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString()
    };
    
    if (reviewComments) updateData.review_comments = reviewComments;
    if (reviewedBy) updateData.reviewed_by = reviewedBy;

    const { data, error } = await supabase
      .from('user_documents')
      .update(updateData)
      .eq('id', documentId)
      .select(`
        *,
        requirement:document_requirements(name, description, is_mandatory),
        reviewed_by_user:users!reviewed_by(full_name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Module Management (HR)
  async getAllModules() {
    const { data, error } = await supabase
      .from('learning_modules')
      .select(`
        *,
        created_by_user:users!created_by(full_name),
        resources:module_resources(*),
        quizzes:module_quizzes(*)
      `)
      .order('category', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createModule(moduleData: any) {
    const { data, error } = await supabase
      .from('learning_modules')
      .insert(moduleData)
      .select(`
        *,
        created_by_user:users!created_by(full_name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateModule(moduleId: string, updates: any) {
    const { data, error } = await supabase
      .from('learning_modules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)
      .select(`
        *,
        created_by_user:users!created_by(full_name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteModule(moduleId: string) {
    const { error } = await supabase
      .from('learning_modules')
      .update({ status: 'archived' })
      .eq('id', moduleId);
    
    if (error) throw error;
  },

  // Initialize modules for new user
  async initializeUserModules(userId: string) {
    // Call the database function to initialize modules
    const { error } = await supabase.rpc('initialize_user_modules', {
      p_user_id: userId
    });
    
    if (error) throw error;
  },

  // Get LMS metrics for manager dashboard
  async getLMSMetrics() {
    // Get total users with LMS access
    const { data: lmsUsers } = await supabase
      .from('users')
      .select('id')
      .in('role_id', ['candidate', 'employee']);

    // Get module completion stats
    const { data: moduleProgress } = await supabase
      .from('user_module_progress')
      .select('status, user_id');

    // Get quiz performance
    const { data: quizAttempts } = await supabase
      .from('user_quiz_attempts')
      .select('score, passed, user_id');

    // Get document upload stats
    const { data: documents } = await supabase
      .from('user_documents')
      .select('status, user_id');

    const totalUsers = lmsUsers?.length || 0;
    const usersWithProgress = new Set(moduleProgress?.map(p => p.user_id)).size;
    const completedModules = moduleProgress?.filter(p => p.status === 'completed').length || 0;
    const totalModuleAssignments = moduleProgress?.length || 0;
    const averageQuizScore = quizAttempts?.reduce((sum, q) => sum + q.score, 0) / (quizAttempts?.length || 1) || 0;
    const documentsApproved = documents?.filter(d => d.status === 'approved').length || 0;
    const totalDocuments = documents?.length || 0;

    return {
      totalUsers,
      usersWithProgress,
      completedModules,
      totalModuleAssignments,
      completionRate: totalModuleAssignments > 0 ? Math.round((completedModules / totalModuleAssignments) * 100) : 0,
      averageQuizScore: Math.round(averageQuizScore),
      documentsApproved,
      totalDocuments,
      documentApprovalRate: totalDocuments > 0 ? Math.round((documentsApproved / totalDocuments) * 100) : 0
    };
  }
};