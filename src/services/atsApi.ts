import { supabase } from './supabase';
import { notificationApi } from './notificationApi';
 

export const atsApi = {
  // Dashboard Stats
  async getDashboardStats() {
    // Get total candidates
    const { data: totalCandidates } = await supabase
      .from('candidates')
      .select('id, status');

    // Get active interviews
    const { data: activeInterviews } = await supabase
      .from('interviews')
      .select('id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString());

    // Get pending assessments
    const { data: pendingAssessments } = await supabase
      .from('assessments')
      .select('id')
      .in('status', ['assigned', 'in_progress']);

    // Get recent hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentHires } = await supabase
      .from('candidates')
      .select('id')
      .eq('status', 'hired')
      .gte('updated_at', thirtyDaysAgo.toISOString());

    // Calculate stats by status
    const candidatesByStatus = (totalCandidates || []).reduce((acc: Record<string, number>, candidate: any) => {
      acc[candidate.status] = (acc[candidate.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCandidates: totalCandidates?.length || 0,
      activeInterviews: activeInterviews?.length || 0,
      pendingAssessments: pendingAssessments?.length || 0,
      recentHires: recentHires?.length || 0,
      candidatesByStatus,
      appliedCandidates: candidatesByStatus.applied || 0,
      screeningCandidates: candidatesByStatus.screening || 0,
      interviewScheduled: candidatesByStatus.interview_scheduled || 0,
      selectedCandidates: candidatesByStatus.selected || 0,
    };
  },

  // Candidates
  async getAllCandidates() {
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        position_applied_job:job_positions(job_title, department:departments(name)),
        referred_by_user:users!referred_by(full_name, employee_id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getCandidateById(id: string) {
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        position_applied_job:job_positions(job_title, department:departments(name)),
        referred_by_user:users!referred_by(full_name, employee_id),
        interviews(*),
        assessments(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createCandidate(candidateData: any) {
    const { data, error } = await supabase
      .from('candidates')
      .insert(candidateData)
      .select(`
        *,
        position_applied_job:job_positions(job_title, department:departments(name))
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateCandidate(id: string, updates: any) {
    const { data, error } = await supabase
      .from('candidates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        position_applied_job:job_positions(job_title, department:departments(name))
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Interviews
  async getInterviews(candidateId?: string) {
    let query = supabase
      .from('interviews')
      .select(`
        *,
        candidate:candidates(full_name, email, position_applied),
        interviewer:users!interviewer_id(full_name, email)
      `);
    
    if (candidateId) {
      query = query.eq('candidate_id', candidateId);
    }
    
    const { data, error } = await query.order('scheduled_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getMyInterviews(userId: string) {
    // For candidates, get interviews where they are the candidate
    const { data: candidateData } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', userId);

    if (candidateData && candidateData.length > 0) {
      const { data, error } = await supabase
        .from('interviews')
        .select(`
          *,
          candidate:candidates(full_name, email, position_applied),
          interviewer:users!interviewer_id(full_name, email)
        `)
        .eq('candidate_id', candidateData[0].id)
        .order('scheduled_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }

    // For interviewers, get interviews they are conducting
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        *,
        candidate:candidates(full_name, email, position_applied),
        interviewer:users!interviewer_id(full_name, email)
      `)
      .eq('interviewer_id', userId)
      .order('scheduled_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createInterview(interviewData: any) {
    const { data, error } = await supabase
      .from('interviews')
      .insert(interviewData)
      .select(`
        *,
        candidate:candidates(full_name, email, position_applied),
        interviewer:users!interviewer_id(full_name, email)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateInterview(id: string, updates: any) {
    const { data, error } = await supabase
      .from('interviews')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        candidate:candidates(full_name, email, position_applied),
        interviewer:users!interviewer_id(full_name, email)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Assessments
  async getAssessments(candidateId?: string) {
    let query = supabase
      .from('assessments')
      .select(`
        *,
        candidate:candidates(full_name, email, position_applied),
        graded_by_user:users!graded_by(full_name)
      `);
    
    if (candidateId) {
      query = query.eq('candidate_id', candidateId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getMyAssessments(userId: string) {
    // Get assessments for candidate
    const { data: candidateData } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', userId);

    if (candidateData && candidateData.length > 0) {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          candidate:candidates(full_name, email, position_applied),
          graded_by_user:users!graded_by(full_name)
        `)
        .eq('candidate_id', candidateData[0].id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }

    return [];
  },

  async createAssessment(assessmentData: any) {
    const { data, error } = await supabase
      .from('assessments')
      .insert(assessmentData)
      .select(`
        *,
        candidate:candidates(full_name, email, position_applied)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async submitAssessment(id: string, answers: any) {
    const { data, error } = await supabase
      .from('assessments')
      .update({
        questions: answers,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Question Bank
  async getQuestionBank() {
    const { data, error } = await supabase
      .from('question_bank')
      .select(`
        *,
        created_by_user:users!created_by(full_name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createQuestion(questionData: any) {
    const { data, error } = await supabase
      .from('question_bank')
      .insert(questionData)
      .select(`
        *,
        created_by_user:users!created_by(full_name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateQuestion(id: string, updates: any) {
    const { data, error } = await supabase
      .from('question_bank')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        created_by_user:users!created_by(full_name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteQuestion(id: string) {
    const { error } = await supabase
      .from('question_bank')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  },

  // Job Positions
  async getJobPositions() {
    const { data, error } = await supabase
      .from('job_positions')
      .select(`
        *,
        department:departments(name),
        posted_by_user:users!posted_by(full_name)
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getAllJobPositions() {
    const { data, error } = await supabase
      .from('job_positions')
      .select(`
        *,
        department:departments(name),
        posted_by_user:users!posted_by(full_name, employee_id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createJobPosition(positionData: any) {
    // Prepare the data object with all new and legacy fields
    const insertData = {
      // New categorized fields
      job_title: positionData.job_title,
      work_type: positionData.work_type,
      key_responsibilities: positionData.key_responsibilities,
      experience_level_description: positionData.experience_level_description,
      technical_skills_required: positionData.technical_skills_required,
      soft_skills: positionData.soft_skills,
      how_to_apply: positionData.how_to_apply,
      application_deadline: positionData.application_deadline,
      referral_encouraged: positionData.referral_encouraged,
      // Legacy fields (maintain backward compatibility)
      title: positionData.title,
      department_id: positionData.department_id,
      description: positionData.description,
      requirements: positionData.requirements,
      experience_level: positionData.experience_level,
      employment_type: positionData.employment_type,
      salary_range_min: positionData.salary_range_min,
      salary_range_max: positionData.salary_range_max,
      location: positionData.location,
      is_remote: positionData.is_remote,
      status: positionData.status,
      posted_by: positionData.posted_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('job_positions')
      .insert(insertData)
      .select(`
        *,
        department:departments(name),
        posted_by_user:users!posted_by(full_name, employee_id)
      `)
      .single();
    
    if (error) throw error;
    
    // Only send notifications if referrals are encouraged for this position
    if (data.referral_encouraged) {
      try {
        const { data: allUsers } = await supabase
          .from('users')
          .select('id')
          .eq('status', 'active');
        const notifyTitle = 'New Job Position Posted';
        const notifyMessage = `${data.job_title} in ${data.department?.name || 'Company'}${data.location ? ' - ' + data.location : ''} - Referrals encouraged!`;
        await Promise.all((allUsers || []).map((u: any) => notificationApi.createNotification({
          user_id: u.id,
          title: notifyTitle,
          message: notifyMessage,
          type: 'general',
          data: { position_id: data.id, status: data.status || 'open', referral_encouraged: true }
        })));
      } catch (e) {
        console.error('Failed to broadcast new job position notification:', e);
      }
    }
    return data;
  },

  async updateJobPosition(id: string, updates: any) {
    // Get existing to detect status changes
    const { data: existing } = await supabase
      .from('job_positions')
      .select('*')
      .eq('id', id)
      .single();

    // Prepare update data with new and legacy fields
    const updateData = {
      // Include any new categorized fields if provided
      ...(updates.job_title !== undefined && { job_title: updates.job_title }),
      ...(updates.work_type !== undefined && { work_type: updates.work_type }),
      ...(updates.key_responsibilities !== undefined && { key_responsibilities: updates.key_responsibilities }),
      ...(updates.experience_level_description !== undefined && { experience_level_description: updates.experience_level_description }),
      ...(updates.technical_skills_required !== undefined && { technical_skills_required: updates.technical_skills_required }),
      ...(updates.soft_skills !== undefined && { soft_skills: updates.soft_skills }),
      ...(updates.how_to_apply !== undefined && { how_to_apply: updates.how_to_apply }),
      ...(updates.application_deadline !== undefined && { application_deadline: updates.application_deadline }),
      ...(updates.referral_encouraged !== undefined && { referral_encouraged: updates.referral_encouraged }),
      // Legacy fields
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.department_id !== undefined && { department_id: updates.department_id }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.requirements !== undefined && { requirements: updates.requirements }),
      ...(updates.experience_level !== undefined && { experience_level: updates.experience_level }),
      ...(updates.employment_type !== undefined && { employment_type: updates.employment_type }),
      ...(updates.salary_range_min !== undefined && { salary_range_min: updates.salary_range_min }),
      ...(updates.salary_range_max !== undefined && { salary_range_max: updates.salary_range_max }),
      ...(updates.location !== undefined && { location: updates.location }),
      ...(updates.is_remote !== undefined && { is_remote: updates.is_remote }),
      ...(updates.status !== undefined && { status: updates.status }),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('job_positions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        department:departments(name),
        posted_by_user:users!posted_by(full_name, employee_id)
      `)
      .single();
    
    if (error) throw error;
    try {
      const statusChanged = updates?.status && existing?.status !== updates.status;
      const referralToggled = updates?.referral_encouraged !== undefined && 
                             existing?.referral_encouraged === false && 
                             updates.referral_encouraged === true;
      
      if (statusChanged || referralToggled) {
        const { data: allUsers } = await supabase
          .from('users')
          .select('id')
          .eq('status', 'active');
        
        if (statusChanged) {
          const isClosed = updates.status === 'closed';
          const notifyTitle = isClosed ? 'Job Position Closed' : 'Job Position Updated';
          const notifyMessage = `${data.job_title} is now ${updates.status.replace('_',' ')}${data.location ? ' - ' + data.location : ''}`;
          await Promise.all((allUsers || []).map((u: any) => notificationApi.createNotification({
            user_id: u.id,
            title: notifyTitle,
            message: notifyMessage,
            type: 'general',
            data: { position_id: data.id, status: data.status }
          })));
        }
        
        if (referralToggled) {
          const notifyTitle = 'New Job Position Available for Referrals';
          const notifyMessage = `${data.job_title} in ${data.department?.name || 'Company'}${data.location ? ' - ' + data.location : ''} - Referrals now encouraged!`;
          await Promise.all((allUsers || []).map((u: any) => notificationApi.createNotification({
            user_id: u.id,
            title: notifyTitle,
            message: notifyMessage,
            type: 'general',
            data: { position_id: data.id, status: data.status || 'open', referral_encouraged: true, action: 'referral_enabled' }
          })));
        }
      }
    } catch (e) {
      console.error('Failed to broadcast job position update notification:', e);
    }
    return data;
  },

  async deleteJobPosition(id: string) {
    const { error } = await supabase
      .from('job_positions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getDepartmentsBasic() {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (error) throw error;
    return data;
  },

  // Get random question for assessment
  async getRandomQuestion(category?: string, difficulty?: string) {
    let query = supabase
      .from('question_bank')
      .select('*')
      .eq('is_active', true);
    
    if (category) {
      query = query.eq('category', category);
    }
    
    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex];
    }
    
    return null;
  },
};