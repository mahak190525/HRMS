import bcrypt from 'bcryptjs';
import { supabase } from './supabase';
import { financeApi } from './financeApi';
import { atsApi } from './atsApi';
import { notificationApi } from './notificationApi';
import { FileUploadService } from './fileUpload';
import { getTodayIST, getISTDateOffset, formatDateForDatabase } from '@/utils/dateUtils';
import type {
  User,
  LeaveApplication,
  Complaint,
  PerformanceGoal,
  Referral,
  PerformanceEvaluation,
  PerformanceAppraisal,
  PerformanceFeedback
} from '@/types';

// Auth API
export const authApi = {
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(name, description),
        department:departments!users_department_id_fkey(name, description)
      `)
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    // Filter out relational data and only keep direct column updates
    const allowedFields = [
      // Essential profile fields
      'full_name', 'email', 'phone', 'address', 'date_of_birth', 'password_hash',
      'avatar_url', 'extra_permissions', 'position', 'company_email',
      'employee_id', 'role_id', 'department_id', 'manager_id', 'salary', 'status',
      // Extended profile fields from migration
      'personal_email', 'alternate_contact_no', 'level_grade', 'skill',
      'current_office_location', 'blood_group', 'religion', 'gender',
      'marital_status', 'date_of_marriage_anniversary', 'father_name',
      'father_dob', 'mother_name', 'mother_dob', 'designation_offer_letter',
      'permanent_address', 'aadhar_card_no', 'pan_no', 'bank_account_no',
      'ifsc_code', 'qualification', 'employment_terms', 'date_of_joining',
      // New onboarding fields
      'appointment_formalities', 'orientation', 'order_id_card', 'email_account',
      'skype_account', 'system_account', 'added_to_mailing_list',
      'added_to_attendance_sheet', 'confluence_info_provided', 'id_card_provided',
      'remarks', 'uan_number', 'is_experienced',
      // System fields
      'isSA'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key as keyof User];
        return obj;
      }, {} as any);

    // Coerce empty date strings to null to satisfy Postgres date type
    const dateFields = ['date_of_birth', 'date_of_joining', 'date_of_marriage_anniversary', 'father_dob', 'mother_dob'];
    dateFields.forEach(field => {
      if (filteredUpdates[field] === '') {
        filteredUpdates[field] = null;
      }
    });

    // Hash password if it's being updated
    if (filteredUpdates.password_hash && !filteredUpdates.password_hash.startsWith('$2')) {
      filteredUpdates.password_hash = await bcrypt.hash(filteredUpdates.password_hash, 10);
    }

    // Coerce empty UUID fields to null to satisfy Postgres uuid type
    if (filteredUpdates.role_id === '') {
      filteredUpdates.role_id = null;
    }
    if (filteredUpdates.department_id === '') {
      filteredUpdates.department_id = null;
    }
    if (filteredUpdates.manager_id === '') {
      filteredUpdates.manager_id = null;
    }

    // Coerce empty employee_id to null to satisfy unique constraint
    if (filteredUpdates.employee_id === '') {
      filteredUpdates.employee_id = null;
    }

    // Handle empty string fields that should be null
    const optionalTextFields = [
      'company_email', 'personal_email', 'phone', 'address', 'position',
      'alternate_contact_no', 'level_grade', 'current_office_location',
      'blood_group', 'religion', 'gender', 'marital_status',
      'father_name', 'mother_name', 'designation_offer_letter',
      'permanent_address', 'aadhar_card_no', 'pan_no', 'bank_account_no',
      'ifsc_code', 'qualification', 'employment_terms',
      // New onboarding fields (text fields)
      'remarks', 'uan_number'
    ];
    optionalTextFields.forEach(field => {
      if (filteredUpdates[field] === '') {
        filteredUpdates[field] = null;
      }
    });

    const finalUpdates = {
      ...filteredUpdates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('users')
      .update(finalUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Leave API
export const leaveApi = {
  async getLeaveTypes() {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async getLeaveBalance(userId: string, year: number = new Date().getFullYear()) {
    const { data, error } = await supabase
      .from('leave_balances')
      .select(`
        *,
        leave_type:leave_types(name, description)
      `)
      .eq('user_id', userId)
      .eq('year', year);

    if (error) throw error;
    return data;
  },

  async getUserLeaveSummary(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_leave_summary', { p_user_id: userId });

    if (error) throw error;
    return data;
  },

  async recalculateUserBalance(userId: string) {
    const { data, error } = await supabase
      .rpc('recalculate_user_leave_balance', { p_user_id: userId });

    if (error) throw error;
    return data;
  },

  // Automatic leave maintenance has been removed
  // HR now manages leave allocations manually once a year

  // New functions for HR leave balance management
  async getAllEmployeesLeaveBalances(year: number = new Date().getFullYear()) {
    // Use RPC function to get comprehensive leave balance data
    const { data, error } = await supabase
      .rpc('get_all_employees_leave_balances', { p_year: year });

    if (error) throw error;
    return data;
  },

  // Manager-specific function to get leave balances with manager information
  async getAllEmployeesLeaveBalancesWithManager(year: number = new Date().getFullYear()) {
    // First get leave balance data from RPC
    const { data: balanceData, error: balanceError } = await supabase
      .rpc('get_all_employees_leave_balances', { p_year: year });

    if (balanceError) throw balanceError;

    // Then get user manager information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, manager_id')
      .in('id', balanceData?.map((b: any) => b.user_id) || []);

    if (userError) throw userError;

    // Merge the data
    return balanceData?.map((balance: any) => {
      const userInfo = userData?.find(u => u.id === balance.user_id);
      return {
        ...balance,
        user: {
          id: balance.user_id,
          full_name: balance.full_name,
          employee_id: balance.employee_id,
          email: balance.email,
          manager_id: userInfo?.manager_id
        }
      };
    }) || [];
  },

  async updateLeaveBalance(balanceId: string, updates: {
    allocated_days?: number | string;
    used_days?: number | string;
    comments?: string;
  }) {
    const { data, error } = await supabase
      .from('leave_balances')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', balanceId)
      .select(`
        *,
        leave_type:leave_types(name, description),
        user:users(full_name, employee_id, email)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async adjustLeaveBalance(userId: string, adjustment: {
    type: 'add' | 'subtract';
    amount: number | string;
    reason: string;
    year?: number;
  }, currentUserId?: string) {
    const year = adjustment.year || new Date().getFullYear();

    // Use RPC function to handle the adjustment server-side
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('adjust_leave_balance', {
        p_user_id: userId,
        p_adjustment_type: adjustment.type,
        p_amount: adjustment.amount,
        p_reason: adjustment.reason,
        p_year: year,
        p_adjusted_by: currentUserId || null
      });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw rpcError;
    }

    if (!rpcResult || rpcResult.length === 0) {
      throw new Error('No result returned from balance adjustment');
    }

    const result = rpcResult[0];

    if (!result.success) {
      throw new Error(result.message || 'Failed to adjust leave balance');
    }

    // Get the updated balance record with full details
    const { data: balanceData, error: balanceError } = await supabase
      .from('leave_balances')
      .select(`
        *,
        leave_type:leave_types(name, description),
        user:users(full_name, employee_id, email)
      `)
      .eq('id', result.balance_id)
      .single();

    if (balanceError) {
      console.error('Failed to fetch updated balance:', balanceError);
      throw balanceError;
    }

    return balanceData;
  },

  async getLeaveBalanceAdjustments(userId?: string, limit: number = 50) {
    let query = supabase
      .from('leave_balance_adjustments')
      .select(`
        *,
        user:users!user_id(full_name, employee_id, email, manager_id),
        adjusted_by_user:users!adjusted_by(full_name, email),
        leave_balance:leave_balances!leave_balance_adjustments_balance_id_fkey(
          leave_type:leave_types(name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async createLeaveBalanceForUser(userId: string, leaveTypeId: string, allocatedDays: number | string, year?: number) {
    const balanceYear = year || new Date().getFullYear();

    const { data, error } = await supabase
      .from('leave_balances')
      .insert({
        user_id: userId,
        leave_type_id: leaveTypeId,
        year: balanceYear,
        allocated_days: allocatedDays,
        used_days: 0,
        monthly_credit_rate: 0, // Will be updated by system
        carry_forward_from_previous_year: 0
      })
      .select(`
        *,
        leave_type:leave_types(name, description),
        user:users(full_name, employee_id, email)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async getLeaveApplications(userId: string) {
    const { data, error } = await supabase
      .from('leave_applications')
      .select(`
        *,
        leave_type:leave_types!leave_type_id(name, description)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createLeaveApplication(leaveData: Omit<LeaveApplication, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('leave_applications')
      .insert(leaveData)
      .select(`
        *,
        leave_type:leave_types!leave_type_id(name, description)
      `)
      .single();

    if (error) throw error;

    // The database trigger will automatically create the notification
    // No need to manually create it here

    return data;
  },

  async getEmployeesOnLeave(startDate?: string, endDate?: string) {
    const today = getTodayIST();
    const fromDate = startDate || today;
    const toDate = endDate || getISTDateOffset(7); // Next 7 days

    const { data, error } = await supabase
      .from('leave_applications')
      .select(`
        *,
        user:users!user_id(id, full_name, employee_id, avatar_url),
        leave_type:leave_types!leave_type_id(name, description)
      `)
      .eq('status', 'approved')
      .or(`and(start_date.lte.${toDate},end_date.gte.${fromDate})`) // Show overlapping leave periods
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  async previewSandwichLeaveCalculation(
    userId: string,
    startDate: string,
    endDate: string,
    isHalfDay: boolean = false
  ) {
    const { data, error } = await supabase
      .rpc('preview_sandwich_leave_calculation', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_is_half_day: isHalfDay
      });

    if (error) throw error;
    return data?.[0] || null;
  },

  async findRelatedFridayMondayApplications(
    userId: string,
    startDate: string,
    endDate: string
  ) {
    const { data, error } = await supabase
      .rpc('find_related_friday_monday_applications', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (error) throw error;
    return data || [];
  },

  async recalculateAllApprovedLeaveBalances() {
    const { data, error } = await supabase
      .rpc('recalculate_all_approved_leave_balances');

    if (error) throw error;
    return data;
  },

  async getAllHolidays(year?: number) {
    let query = supabase
      .from('holidays')
      .select('*')
      .order('date');

    if (year) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      query = query.gte('date', yearStart).lte('date', yearEnd);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async createHoliday(holidayData: { date: string; name: string; is_optional?: boolean }) {
    const { data, error } = await supabase
      .from('holidays')
      .insert(holidayData)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async deleteHoliday(holidayId: string) {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', holidayId);

    if (error) throw error;
  }
};

// Rest of the API functions remain the same...
// Complaints API
export const complaintsApi = {
  async getComplaintCategories() {
    const { data, error } = await supabase
      .from('complaint_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async getComplaints(userId: string) {
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        assigned_to_user:users!assigned_to(full_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createComplaint(complaintData: Omit<Complaint, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('complaints')
      .insert(complaintData)
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        user:users!complaints_user_id_fkey(full_name, employee_id, email, manager_id),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name, email)
      `)
      .single();

    if (error) throw error;

    // Send notification to user's manager for approval
    try {
      if (data.user.manager_id) {
        // Notify manager for approval
        await notificationApi.createNotification({
          user_id: data.user.manager_id,
          title: 'Complaint Requires Approval',
          message: `${data.user.full_name} has submitted a complaint "${data.title}" that requires your approval before assignment.`,
          type: 'complaint_submitted',
          data: { complaint_id: data.id, action: 'approve_or_reject', target: 'grievance/active' }
        });
      }

      // Also notify HR for visibility
      const { data: hrUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', (await supabase.from('roles').select('id').eq('name', 'hr').single()).data?.id);

      if (hrUsers && hrUsers.length > 0) {
        for (const hrUser of hrUsers) {
          await notificationApi.createNotification({
            user_id: hrUser.id,
            title: 'New Complaint Submitted',
            message: `${data.user.full_name} has submitted a complaint "${data.title}" for manager review.`,
            type: 'complaint_submitted',
            data: { complaint_id: data.id, action: 'monitor', target: 'grievance/active' }
          });
        }
      }
    } catch (notificationError) {
      console.error('Failed to send complaint notification:', notificationError);
    }

    return data;
  }
};

// Performance API
export const performanceApi = {
  async getPerformanceGoals(userId: string) {
    const { data, error } = await supabase
      .from('performance_goals')
      .select(`
        *,
        created_by_user:users!created_by(full_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateGoalProgress(goalId: string, progress: number) {
    const status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started';

    const { data, error } = await supabase
      .from('performance_goals')
      .update({
        progress_percentage: progress,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', goalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPerformanceEvaluations(userId: string) {
    const { data, error } = await supabase
      .from('performance_evaluations')
      .select(`
        *,
        evaluator:users!evaluator_id(full_name)
      `)
      .eq('user_id', userId)
      .order('evaluation_period_end', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getPerformanceAppraisals(userId: string) {
    const { data, error } = await supabase
      .from('performance_appraisals')
      .select('*')
      .eq('user_id', userId)
      .order('appraisal_year', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getPerformanceFeedback(userId: string) {
    const { data, error } = await supabase
      .from('performance_feedback')
      .select(`
        *,
        feedback_giver:users!feedback_giver_id(full_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

// Helper function to get HR and Admin users for notifications
async function getHRAndAdminUsers(): Promise<{ id: string; full_name: string }[]> {
  try {
    console.log('Fetching HR and Admin users for referral notifications...');

    // Get all active users with their role and department info
    const { data: allUsers, error } = await supabase
      .from('users')
      .select(`
        id, 
        full_name,
        role:roles(name),
        department:departments!users_department_id_fkey(name),
        "isSA"
      `)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    console.log(`Found ${allUsers?.length || 0} active users`);

    // Filter to find HR and Admin users
    const hrAdminUsers = allUsers?.filter(user => {
      const isHRRole = user.role?.name && ['hr', 'hrm', 'admin', 'super_admin'].includes(user.role.name);
      const isSuperAdmin = user.isSA === true;
      const isHRDepartment = user.department?.name &&
        user.department.name.toLowerCase().includes('hr');

      const isHRAdminUser = isHRRole || isSuperAdmin || isHRDepartment;

      if (isHRAdminUser) {
        console.log(`HR/Admin User found: ${user.full_name} - Role: ${user.role?.name}, Super Admin: ${user.isSA}, Department: ${user.department?.name}`);
      }

      return isHRAdminUser;
    }) || [];

    console.log(`Filtered to ${hrAdminUsers.length} HR/Admin users:`, hrAdminUsers.map(u => u.full_name));

    return hrAdminUsers.map(user => ({
      id: user.id,
      full_name: user.full_name
    }));
  } catch (error) {
    console.error('Failed to get HR and Admin users:', error);
    return [];
  }
}

// Referrals API
export const referralsApi = {
  async getJobPositions() {
    const { data, error } = await supabase
      .from('job_positions')
      .select(`
        *,
        department:departments(name)
      `)
      .eq('status', 'open')
      .eq('referral_encouraged', true)
      .order('job_title');

    if (error) throw error;
    return data;
  },

  async getReferrals(userId: string) {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createReferral(referralData: Omit<Referral, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('referrals')
      .insert(referralData)
      .select(`
        *,
        referred_by_user:users!referred_by(full_name, employee_id, email)
      `)
      .single();

    if (error) throw error;

    // Send notifications to HR and Admin users
    try {
      const hrAdminUsers = await getHRAndAdminUsers();

      if (hrAdminUsers.length === 0) {
        console.warn('No HR/Admin users found to notify about referral submission');
      } else {
        console.log(`Sending referral notifications to ${hrAdminUsers.length} HR/Admin users`);

        const notificationPromises = hrAdminUsers.map(async (hrUser) => {
          try {
            const result = await notificationApi.createNotification({
              user_id: hrUser.id,
              title: 'New Employee Referral Submitted',
              message: `${data.referred_by_user?.full_name || 'An employee'} has referred ${data.candidate_name} for the position "${data.position}".`,
              type: 'referral_submitted',
              data: {
                referral_id: data.id,
                candidate_name: data.candidate_name,
                candidate_email: data.candidate_email,
                position: data.position,
                referred_by: data.referred_by_user?.full_name,
                referred_by_employee_id: data.referred_by_user?.employee_id,
                action: 'review_referral',
                target: 'employees/referrals'
              }
            });
            console.log(`Referral notification sent to HR/Admin user ${hrUser.full_name}:`, result);
            return result;
          } catch (error) {
            console.error(`Failed to send referral notification to HR/Admin user ${hrUser.full_name}:`, error);
            return null;
          }
        });

        const results = await Promise.allSettled(notificationPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        console.log(`Referral notifications: ${successful}/${hrAdminUsers.length} sent successfully`);
      }
    } catch (notificationError) {
      console.error('Failed to send referral notifications:', notificationError);
      // Don't throw error here - referral was created successfully, notification failure shouldn't break the flow
    }

    return data;
  },

  async createReferralWithResume(referralData: Omit<Referral, 'id' | 'created_at' | 'updated_at'>, resumeFile?: File) {
    let finalReferralData = { ...referralData };

    // Upload resume if provided
    if (resumeFile) {
      const uploadResult = await FileUploadService.uploadResume(
        resumeFile,
        referralData.candidate_name
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload resume');
      }

      finalReferralData.resume_url = uploadResult.url;
    }

    const { data, error } = await supabase
      .from('referrals')
      .insert(finalReferralData)
      .select(`
        *,
        referred_by_user:users!referred_by(full_name, employee_id, email)
      `)
      .single();

    if (error) {
      // If database insert fails and we uploaded a file, try to clean up
      if (finalReferralData.resume_url) {
        try {
          await FileUploadService.deleteResume(finalReferralData.resume_url);
        } catch (deleteError) {
          console.error('Failed to cleanup uploaded file after database error:', deleteError);
        }
      }
      throw error;
    }

    // Send notifications to HR and Admin users
    try {
      const hrAdminUsers = await getHRAndAdminUsers();

      if (hrAdminUsers.length === 0) {
        console.warn('No HR/Admin users found to notify about referral submission');
      } else {
        console.log(`Sending referral with resume notifications to ${hrAdminUsers.length} HR/Admin users`);

        const notificationPromises = hrAdminUsers.map(async (hrUser) => {
          try {
            const result = await notificationApi.createNotification({
              user_id: hrUser.id,
              title: 'New Employee Referral with Resume Submitted',
              message: `${data.referred_by_user?.full_name || 'An employee'} has referred ${data.candidate_name} for the position "${data.position}" with resume attached.`,
              type: 'referral_submitted',
              data: {
                referral_id: data.id,
                candidate_name: data.candidate_name,
                candidate_email: data.candidate_email,
                position: data.position,
                referred_by: data.referred_by_user?.full_name,
                referred_by_employee_id: data.referred_by_user?.employee_id,
                has_resume: !!data.resume_url,
                resume_url: data.resume_url,
                action: 'review_referral',
                target: 'employees/referrals'
              }
            });
            console.log(`Referral with resume notification sent to HR/Admin user ${hrUser.full_name}:`, result);
            return result;
          } catch (error) {
            console.error(`Failed to send referral notification to HR/Admin user ${hrUser.full_name}:`, error);
            return null;
          }
        });

        const results = await Promise.allSettled(notificationPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        console.log(`Referral with resume notifications: ${successful}/${hrAdminUsers.length} sent successfully`);
      }
    } catch (notificationError) {
      console.error('Failed to send referral notifications:', notificationError);
      // Don't throw error here - referral was created successfully, notification failure shouldn't break the flow
    }

    return data;
  },

  async updateReferralResume(id: string, resumeFile: File, candidateName: string) {
    // Get current referral to check for existing resume
    const { data: currentReferral, error: fetchError } = await supabase
      .from('referrals')
      .select('resume_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Upload new resume
    const uploadResult = await FileUploadService.uploadResume(resumeFile, candidateName);

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload resume');
    }

    // Update referral with new resume URL
    const { data, error } = await supabase
      .from('referrals')
      .update({
        resume_url: uploadResult.url,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // If database update fails, cleanup the newly uploaded file
      try {
        await FileUploadService.deleteResume(uploadResult.url!);
      } catch (deleteError) {
        console.error('Failed to cleanup uploaded file after database error:', deleteError);
      }
      throw error;
    }

    // Delete old resume file if it exists
    if (currentReferral.resume_url) {
      try {
        await FileUploadService.deleteResume(currentReferral.resume_url);
      } catch (deleteError) {
        console.warn('Failed to delete old resume file:', deleteError);
        // Don't throw error here as the main operation succeeded
      }
    }

    return data;
  }
};

// Dashboard Stats API
export const dashboardApi = {
  async getDashboardStats(userId: string) {
    // Get leave balance
    const currentYear = new Date().getFullYear();
    const { data: leaveBalance } = await supabase
      .from('leave_balances')
      .select('remaining_days')
      .eq('user_id', userId)
      .eq('year', currentYear);

    // Get attendance summary for current month
    const currentMonth = new Date().getMonth() + 1;
    const { data: attendanceData } = await supabase
      .from('attendance_summary')
      .select('days_present, total_working_days')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .eq('year', currentYear);

    const attendance = attendanceData && attendanceData.length > 0 ? attendanceData[0] : null;

    // Get active goals
    const { data: goals } = await supabase
      .from('performance_goals')
      .select('id, status')
      .eq('user_id', userId);

    // Get active project assignments
    const { data: projects } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    return {
      leaveBalance: leaveBalance?.reduce((sum: any, lb: any) => sum + lb.remaining_days, 0) || 0,
      attendance: attendance ? `${attendance.days_present}/${attendance.total_working_days}` : '0/0',
      activeGoals: goals?.filter((g: any) => g.status !== 'completed').length || 0,
      activeProjects: projects?.length || 0
    };
  },

  async getUpcomingHolidays() {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', getTodayIST())
      .order('date')
      .limit(4);

    if (error) throw error;
    return data;
  }
};

// Time tracking API
export const timeTrackingApi = {
  async getTodayTimeEntries(userId: string) {
    const today = getTodayIST();
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        project:new_projects(project_name)
      `)
      .eq('user_id', userId)
      .eq('entry_date', today);

    if (error) throw error;
    return data;
  },

  async createTimeEntry(timeData: any) {
    const { data, error } = await supabase
      .from('time_entries')
      .insert(timeData)
      .select(`
        *,
        project:new_projects(project_name)
      `)
      .single();

    if (error) throw error;
    return data;
  }
};

// Exit Process API
export const exitApi = {
  async createExitProcess(exitData: {
    user_id: string;
    resignation_date: string;
    last_working_day: string;
    notice_period_days: number;
    reason_for_leaving?: string;
    new_company?: string;
    new_position?: string;
    exit_type: string;
    initiated_by: string;
  }) {
    const { data, error } = await supabase
      .from('exit_processes')
      .insert(exitData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getExitProcess(userId: string) {
    const { data, error } = await supabase
      .from('exit_processes')
      .select(`
        *,
        initiated_by_user:users!initiated_by(full_name),
        hr_approved_by_user:users!hr_approved_by(full_name)
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};

// Employee Management API
export const employeeApi = {
  async getAllEmployees() {
    const { data, error } = await supabase
      .rpc('get_employees_with_manager_details');

    if (error) throw error;

    // Transform the data to match the expected structure
    return data?.map((row: any) => ({
      id: row.id,
      auth_provider: row.auth_provider,
      provider_user_id: row.provider_user_id,
      email: row.email,
      password_hash: row.password_hash,
      full_name: row.full_name,
      employee_id: row.employee_id,
      role_id: row.role_id,
      department_id: row.department_id,
      position: row.position,
      avatar_url: row.avatar_url,
      phone: row.phone,
      address: row.address,
      date_of_birth: row.date_of_birth,
      date_of_joining: row.date_of_joining,
      salary: row.salary,
      extra_permissions: row.extra_permissions,
      status: row.status,
      last_login: row.last_login,
      created_at: row.created_at,
      updated_at: row.updated_at,
      manager_id: row.manager_id,
      tenure_mechlin: row.tenure_mechlin,
      level_grade: row.level_grade,
      skill: row.skill,
      current_office_location: row.current_office_location,
      alternate_contact_no: row.alternate_contact_no,
      blood_group: row.blood_group,
      religion: row.religion,
      gender: row.gender,
      marital_status: row.marital_status,
      date_of_marriage_anniversary: row.date_of_marriage_anniversary,
      father_name: row.father_name,
      father_dob: row.father_dob,
      mother_name: row.mother_name,
      mother_dob: row.mother_dob,
      designation_offer_letter: row.designation_offer_letter,
      permanent_address: row.permanent_address,
      aadhar_card_no: row.aadhar_card_no,
      pan_no: row.pan_no,
      personal_email: row.personal_email,
      company_email: row.company_email,
      bank_account_no: row.bank_account_no,
      ifsc_code: row.ifsc_code,
      qualification: row.qualification,
      employment_terms: row.employment_terms,
      // New onboarding fields
      appointment_formalities: row.appointment_formalities,
      orientation: row.orientation,
      order_id_card: row.order_id_card,
      email_account: row.email_account,
      skype_account: row.skype_account,
      system_account: row.system_account,
      added_to_mailing_list: row.added_to_mailing_list,
      added_to_attendance_sheet: row.added_to_attendance_sheet,
      confluence_info_provided: row.confluence_info_provided,
      id_card_provided: row.id_card_provided,
      remarks: row.remarks,
      uan_number: row.uan_number,
      is_experienced: row.is_experienced,
      role: row.role_name ? {
        name: row.role_name,
        description: row.role_description
      } : null,
      department: row.department_name ? {
        name: row.department_name,
        description: row.department_description
      } : null,
      manager: row.manager_full_name ? {
        id: row.manager_id,
        full_name: row.manager_full_name,
        email: row.manager_email,
        position: row.manager_position
      } : null
    })) || [];
  },

  async getAllUsersDetails() {
    const { data, error } = await supabase
      .rpc('get_all_users_with_manager_details');

    if (error) throw error;

    // Transform the data to match the expected structure
    return data?.map((row: any) => ({
      id: row.id,
      auth_provider: row.auth_provider,
      provider_user_id: row.provider_user_id,
      email: row.email,
      password_hash: row.password_hash,
      full_name: row.full_name,
      employee_id: row.employee_id,
      role_id: row.role_id,
      department_id: row.department_id,
      position: row.position,
      avatar_url: row.avatar_url,
      phone: row.phone,
      address: row.address,
      date_of_birth: row.date_of_birth,
      date_of_joining: row.date_of_joining,
      salary: row.salary,
      extra_permissions: row.extra_permissions,
      status: row.status,
      last_login: row.last_login,
      created_at: row.created_at,
      updated_at: row.updated_at,
      manager_id: row.manager_id,
      tenure_mechlin: row.tenure_mechlin,
      level_grade: row.level_grade,
      skill: row.skill,
      current_office_location: row.current_office_location,
      alternate_contact_no: row.alternate_contact_no,
      blood_group: row.blood_group,
      religion: row.religion,
      gender: row.gender,
      marital_status: row.marital_status,
      date_of_marriage_anniversary: row.date_of_marriage_anniversary,
      father_name: row.father_name,
      father_dob: row.father_dob,
      mother_name: row.mother_name,
      mother_dob: row.mother_dob,
      designation_offer_letter: row.designation_offer_letter,
      permanent_address: row.permanent_address,
      aadhar_card_no: row.aadhar_card_no,
      pan_no: row.pan_no,
      personal_email: row.personal_email,
      company_email: row.company_email,
      bank_account_no: row.bank_account_no,
      ifsc_code: row.ifsc_code,
      qualification: row.qualification,
      employment_terms: row.employment_terms,
      // New onboarding fields
      appointment_formalities: row.appointment_formalities,
      orientation: row.orientation,
      order_id_card: row.order_id_card,
      email_account: row.email_account,
      skype_account: row.skype_account,
      system_account: row.system_account,
      added_to_mailing_list: row.added_to_mailing_list,
      added_to_attendance_sheet: row.added_to_attendance_sheet,
      confluence_info_provided: row.confluence_info_provided,
      id_card_provided: row.id_card_provided,
      remarks: row.remarks,
      uan_number: row.uan_number,
      is_experienced: row.is_experienced,
      role: row.role_name ? {
        name: row.role_name,
        description: row.role_description
      } : null,
      department: row.department_name ? {
        name: row.department_name,
        description: row.department_description
      } : null,
      manager: row.manager_full_name ? {
        id: row.manager_id,
        full_name: row.manager_full_name,
        email: row.manager_email,
        position: row.manager_position
      } : null
    })) || [];
  },

  async getEmployeeById(id: string) {
    const { data, error } = await supabase
      .rpc('get_all_users_with_manager_details');

    if (error) throw error;

    // Find the specific employee
    const employee = data?.find((row: any) => row.id === id);
    if (!employee) throw new Error('Employee not found');

    // Transform the data to match the expected structure
    return {
      id: employee.id,
      auth_provider: employee.auth_provider,
      provider_user_id: employee.provider_user_id,
      email: employee.email,
      password_hash: employee.password_hash,
      full_name: employee.full_name,
      employee_id: employee.employee_id,
      role_id: employee.role_id,
      department_id: employee.department_id,
      position: employee.position,
      avatar_url: employee.avatar_url,
      phone: employee.phone,
      address: employee.address,
      date_of_birth: employee.date_of_birth,
      date_of_joining: employee.date_of_joining,
      salary: employee.salary,
      extra_permissions: employee.extra_permissions,
      status: employee.status,
      last_login: employee.last_login,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
      manager_id: employee.manager_id,
      tenure_mechlin: employee.tenure_mechlin,
      level_grade: employee.level_grade,
      skill: employee.skill,
      current_office_location: employee.current_office_location,
      alternate_contact_no: employee.alternate_contact_no,
      blood_group: employee.blood_group,
      religion: employee.religion,
      gender: employee.gender,
      marital_status: employee.marital_status,
      date_of_marriage_anniversary: employee.date_of_marriage_anniversary,
      father_name: employee.father_name,
      father_dob: employee.father_dob,
      mother_name: employee.mother_name,
      mother_dob: employee.mother_dob,
      designation_offer_letter: employee.designation_offer_letter,
      permanent_address: employee.permanent_address,
      aadhar_card_no: employee.aadhar_card_no,
      pan_no: employee.pan_no,
      personal_email: employee.personal_email,
      bank_account_no: employee.bank_account_no,
      ifsc_code: employee.ifsc_code,
      qualification: employee.qualification,
      employment_terms: employee.employment_terms,
      role: employee.role_name ? {
        name: employee.role_name,
        description: employee.role_description
      } : null,
      department: employee.department_name ? {
        name: employee.department_name,
        description: employee.department_description
      } : null,
      manager: employee.manager_full_name ? {
        id: employee.manager_id,
        full_name: employee.manager_full_name,
        email: employee.manager_email,
        position: employee.manager_position
      } : null
    };
  },

  async getEmployeeAttendance(userId: string, year: number = new Date().getFullYear()) {
    const { data, error } = await supabase
      .from('attendance_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('month');

    if (error) throw error;
    return data;
  },

  async getAllEmployeesAttendance(year: number = new Date().getFullYear(), month?: number) {
    let query = supabase
      .from('attendance_summary')
      .select(`
        *,
        user:users(full_name, employee_id, department:departments!users_department_id_fkey(name))
      `)
      .eq('year', year);

    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query.order('month');

    if (error) throw error;
    return data;
  },

  async getAllEmployeesAttendanceFromSecondDB(year: number = new Date().getFullYear(), month?: number) {
    try {
      // Import secondSupabase dynamically to avoid circular dependencies
      const { secondSupabase } = await import('@/services/secondSupabase');

      // Get all employees from main database
      const employees = await this.getAllEmployees();

      // Get holidays for the year
      const holidays = await leaveApi.getAllHolidays(year);

      // Calculate date range
      const startDate = month
        ? new Date(year, month - 1, 1)
        : new Date(year, 0, 1);
      const endDate = month
        ? new Date(year, month, 0) // Last day of the month
        : new Date(year, 11, 31); // Last day of the year

      const attendanceReports = [];

      for (const employee of employees) {
        try {
          // Get user ID from second database using email
          const { data: profiles, error: profileError } = await secondSupabase
            .from('profiles')
            .select('id')
            .eq('email', employee.email.toLowerCase())
            .limit(1);

          if (profileError || !profiles || profiles.length === 0) {
            // Employee not found in second database, create empty record
            if (month) {
              attendanceReports.push({
                user_id: employee.id,
                year,
                month,
                total_working_days: this.getWorkingDaysInMonth(year, month, holidays),
                days_present: 0,
                days_absent: this.getWorkingDaysInMonth(year, month, holidays),
                days_on_leave: 0,
                total_hours_worked: 0,
                overtime_hours: 0,
                user: {
                  full_name: employee.full_name,
                  employee_id: employee.employee_id,
                  department: employee.department
                }
              });
            } else {
              // For yearly report, create monthly records
              for (let m = 1; m <= 12; m++) {
                attendanceReports.push({
                  user_id: employee.id,
                  year,
                  month: m,
                  total_working_days: this.getWorkingDaysInMonth(year, m, holidays),
                  days_present: 0,
                  days_absent: this.getWorkingDaysInMonth(year, m, holidays),
                  days_on_leave: 0,
                  total_hours_worked: 0,
                  overtime_hours: 0,
                  user: {
                    full_name: employee.full_name,
                    employee_id: employee.employee_id,
                    department: employee.department
                  }
                });
              }
            }
            continue;
          }

          const secondDbUserId = profiles[0].id;

          // Get time entries for the date range
          let timeQuery = secondSupabase
            .from('time_entries')
            .select('id, start_time, duration, created_at')
            .eq('user_id', secondDbUserId)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString());

          const { data: timeEntries, error: timeError } = await timeQuery;

          if (timeError) {
            console.error(`Error fetching time entries for ${employee.email}:`, timeError);
            continue;
          }

          // Process time entries by month (using start_time for allocation)
          // This ensures night shift hours are allocated to the month/day the shift started
          const monthlyData = new Map();

          if (timeEntries && timeEntries.length > 0) {
            timeEntries.forEach(entry => {
              // Use start_time for date allocation (important for night shifts)
              const entryDate = new Date(entry.start_time);
              const entryMonth = entryDate.getMonth() + 1;
              const entryYear = entryDate.getFullYear();
              const key = `${entryYear}-${entryMonth}`;

              if (!monthlyData.has(key)) {
                monthlyData.set(key, {
                  year: entryYear,
                  month: entryMonth,
                  totalHours: 0,
                  daysWorked: new Set()
                });
              }

              const monthData = monthlyData.get(key);
              monthData.totalHours += (entry.duration || 0) / 3600; // Convert seconds to hours
              // Use start_time date for tracking unique working days (local date)
              const localDateKey = `${entryYear}-${String(entryMonth).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
              monthData.daysWorked.add(localDateKey);
            });
          }

          // Generate reports based on processed data
          if (month) {
            // Single month report
            const key = `${year}-${month}`;
            const monthData = monthlyData.get(key);
            const workingDays = this.getWorkingDaysInMonth(year, month, holidays);
            const daysPresent = monthData ? monthData.daysWorked.size : 0;
            const totalHours = monthData ? monthData.totalHours : 0;

            attendanceReports.push({
              user_id: employee.id,
              year,
              month,
              total_working_days: workingDays,
              days_present: daysPresent,
              days_absent: Math.max(0, workingDays - daysPresent),
              days_on_leave: 0, // We don't have leave data in time tracking
              total_hours_worked: Math.round(totalHours * 100) / 100,
              overtime_hours: Math.max(0, Math.round((totalHours - (daysPresent * 8)) * 100) / 100),
              user: {
                full_name: employee.full_name,
                employee_id: employee.employee_id,
                department: employee.department
              }
            });
          } else {
            // Yearly report - generate for each month
            for (let m = 1; m <= 12; m++) {
              const key = `${year}-${m}`;
              const monthData = monthlyData.get(key);
              const workingDays = this.getWorkingDaysInMonth(year, m, holidays);
              const daysPresent = monthData ? monthData.daysWorked.size : 0;
              const totalHours = monthData ? monthData.totalHours : 0;

              attendanceReports.push({
                user_id: employee.id,
                year,
                month: m,
                total_working_days: workingDays,
                days_present: daysPresent,
                days_absent: Math.max(0, workingDays - daysPresent),
                days_on_leave: 0,
                total_hours_worked: Math.round(totalHours * 100) / 100,
                overtime_hours: Math.max(0, Math.round((totalHours - (daysPresent * 8)) * 100) / 100),
                user: {
                  full_name: employee.full_name,
                  employee_id: employee.employee_id,
                  department: employee.department
                }
              });
            }
          }
        } catch (employeeError) {
          console.error(`Error processing employee ${employee.email}:`, employeeError);
          continue;
        }
      }

      return attendanceReports.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return (a.user?.full_name || '').localeCompare(b.user?.full_name || '');
      });

    } catch (error) {
      console.error('Error in getAllEmployeesAttendanceFromSecondDB:', error);
      throw error;
    }
  },

  // Helper function to calculate working days in a month (excluding weekends and holidays)
  getWorkingDaysInMonth(year: number, month: number, holidays: any[] = []): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let workingDays = 0;

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday (0) or Saturday (6)
      const { isHoliday } = this.isHoliday(date, holidays);

      if (!isWeekend && !isHoliday) {
        workingDays++;
      }
    }

    return workingDays;
  },

  async getEmployeeDaywiseAttendance(employeeId: string, year: number, month: number) {
    try {
      // Import secondSupabase dynamically to avoid circular dependencies
      const { secondSupabase } = await import('@/services/secondSupabase');

      // Get employee details from main database
      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get holidays for the year
      const holidays = await leaveApi.getAllHolidays(year);

      // Get user ID from second database using email
      const { data: profiles, error: profileError } = await secondSupabase
        .from('profiles')
        .select('id')
        .eq('email', employee.email.toLowerCase())
        .limit(1);

      if (profileError || !profiles || profiles.length === 0) {
        // Employee not found in second database, return empty daywise data
        const daysInMonth = new Date(year, month, 0).getDate();
        const daywiseData = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const { isHoliday, holiday } = this.isHoliday(date, holidays);

          let status = 'Absent';
          if (isWeekend) {
            status = 'Weekend';
          } else if (isHoliday) {
            status = 'Holiday';
          }

          const isWorkingDay = !isWeekend && !isHoliday;

          daywiseData.push({
            date: date.toISOString().split('T')[0],
            day: day,
            dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
            isWeekend,
            isHoliday,
            holiday: holiday || null,
            isWorkingDay,
            status,
            hoursWorked: 0,
            timeEntries: []
          });
        }

        return {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id,
            email: employee.email,
            department: employee.department
          },
          year,
          month,
          monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
          daywiseData,
          summary: {
            totalWorkingDays: daywiseData.filter(d => d.isWorkingDay).length,
            daysPresent: 0,
            daysAbsent: daywiseData.filter(d => d.isWorkingDay).length,
            totalHours: 0,
            averageHoursPerDay: 0
          }
        };
      }

      const secondDbUserId = profiles[0].id;

      // Get time entries for the specific month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const { data: timeEntries, error: timeError } = await secondSupabase
        .from('time_entries')
        .select('id, start_time, duration, created_at')
        .eq('user_id', secondDbUserId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');

      if (timeError) {
        console.error(`Error fetching time entries for ${employee.email}:`, timeError);
        throw timeError;
      }

      // Group time entries by date (using start_time date for allocation)
      // This ensures night shift hours are allocated to the day the shift started
      const entriesByDate = new Map();
      if (timeEntries && timeEntries.length > 0) {
        timeEntries.forEach(entry => {
          // Use start_time date for allocation (important for night shifts)
          const startDate = new Date(entry.start_time);

          // Debug: Let's see what we're working with
          if (employee.email.includes('mahak') || employee.full_name.includes('Mahak')) {
            console.log(`DEBUG - Entry for ${employee.full_name}:`);
            console.log(`  start_time from DB: ${entry.start_time}`);
            console.log(`  Parsed as Date: ${startDate.toString()}`);
            console.log(`  Local date: ${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`);
            console.log(`  Time: ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`);
          }

          // Create date key using local timezone to avoid UTC conversion issues
          // This ensures night shifts are allocated to the correct local date
          const localYear = startDate.getFullYear();
          const localMonth = String(startDate.getMonth() + 1).padStart(2, '0');
          const localDay = String(startDate.getDate()).padStart(2, '0');
          const dateKey = `${localYear}-${localMonth}-${localDay}`;

          if (!entriesByDate.has(dateKey)) {
            entriesByDate.set(dateKey, []);
          }
          entriesByDate.get(dateKey).push(entry);
        });
      }

      // Generate daywise data
      const daysInMonth = new Date(year, month, 0).getDate();
      const daywiseData = [];
      let totalHours = 0;
      let daysPresent = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        // Use local date to match the key format used above
        const dateYear = date.getFullYear();
        const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
        const dateDay = String(date.getDate()).padStart(2, '0');
        const dateKey = `${dateYear}-${dateMonth}-${dateDay}`;
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayEntries = entriesByDate.get(dateKey) || [];

        const dayHours = dayEntries.reduce((sum: number, entry: any) => sum + ((entry.duration || 0) / 3600), 0);
        totalHours += dayHours;

        // Check if this date is a holiday
        const { isHoliday, holiday } = this.isHoliday(date, holidays);

        let status = 'Absent';
        if (isWeekend) {
          status = 'Weekend';
        } else if (isHoliday) {
          status = 'Holiday';
        } else if (dayEntries.length > 0) {
          status = 'Present';
          daysPresent++;
        }

        const isWorkingDay = !isWeekend && !isHoliday;

        daywiseData.push({
          date: dateKey,
          day: day,
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          isWeekend,
          isHoliday,
          holiday: holiday || null,
          isWorkingDay,
          status,
          hoursWorked: Math.round(dayHours * 100) / 100,
          timeEntries: dayEntries.map((entry: any) => ({
            id: entry.id,
            startTime: entry.start_time,
            duration: entry.duration,
            durationHours: Math.round((entry.duration / 3600) * 100) / 100,
            formattedDuration: this.formatDurationFromSeconds(entry.duration || 0)
          }))
        });
      }

      const workingDays = daywiseData.filter(d => d.isWorkingDay).length;

      return {
        employee: {
          id: employee.id,
          full_name: employee.full_name,
          employee_id: employee.employee_id,
          email: employee.email,
          department: employee.department
        },
        year,
        month,
        monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
        daywiseData,
        summary: {
          totalWorkingDays: workingDays,
          daysPresent,
          daysAbsent: workingDays - daysPresent,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHoursPerDay: daysPresent > 0 ? Math.round((totalHours / daysPresent) * 100) / 100 : 0
        }
      };

    } catch (error) {
      console.error('Error in getEmployeeDaywiseAttendance:', error);
      throw error;
    }
  },

  // Helper function to format duration from seconds
  formatDurationFromSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  },



  // Helper function to check if a date is a holiday
  isHoliday(date: Date, holidays: any[]): { isHoliday: boolean; holiday?: any } {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const holiday = holidays.find(h => h.date === dateStr);

    return {
      isHoliday: !!holiday,
      holiday
    };
  }
};

// Asset Management API
export const assetApi = {
  async getAllAssets() {
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        category:asset_categories(name, description)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAssetAssignments() {
    const { data, error } = await supabase
      .from('asset_assignments')
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name, description), status),
        user:users!user_id(full_name, employee_id, manager_id),
        assigned_by_user:users!assigned_by(full_name)
      `)
      .eq('is_active', true)
      .order('assigned_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAssetCategories() {
    const { data, error } = await supabase
      .from('asset_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async createAssetAssignment(assignmentData: any) {
    const { data, error } = await supabase
      .from('asset_assignments')
      .insert(assignmentData)
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name)),
        user:users!user_id(full_name, employee_id, email),
        assigned_by_user:users!assigned_by(full_name),
        vm:virtual_machines(vm_number, project_name, purpose, cloud_provider)
      `)
      .single();

    if (error) throw error;

    // Notifications are now handled automatically by database triggers
    // This ensures notifications are sent even if the client disconnects
    console.log('Asset assignment created successfully, notifications triggered via database triggers');

    return data;
  },

  async getAvailableAssets() {
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        category:asset_categories(name)
      `)
      .in('status', ['available', 'assigned'])  // Include both available and assigned assets for multiple assignments
      .order('name');

    if (error) throw error;
    return data;
  },

  async createAsset(assetData: any) {
    const { data, error } = await supabase
      .from('assets')
      .insert(assetData)
      .select(`
        *,
        category:asset_categories(name, description)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateAsset(id: string, updates: any) {
    const { data, error } = await supabase
      .from('assets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:asset_categories(name, description)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAsset(id: string) {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async updateAssetAssignment(id: string, updates: any) {
    const { data, error } = await supabase
      .from('asset_assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model),
        user:users!user_id(full_name, employee_id),
        assigned_by_user:users!assigned_by(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAssetAssignment(id: string) {
    const { error } = await supabase
      .from('asset_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getEmployeeDetails(userId: string) {
    const { data, error } = await supabase
      .rpc('get_employee_details', { p_user_id: userId });

    if (error) throw error;
    return data[0];
  },

  async bulkAssignAsset(assignmentData: {
    asset_id: string;
    user_ids: string[];
    assigned_by: string;
    assignment_type: string;
    assignment_expiry_date?: string;
    condition_at_issuance?: string;
    issuance_condition_notes?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .rpc('bulk_assign_asset', {
        p_asset_id: assignmentData.asset_id,
        p_user_ids: assignmentData.user_ids,
        p_assigned_by: assignmentData.assigned_by,
        p_assignment_type: assignmentData.assignment_type,
        p_assignment_expiry_date: assignmentData.assignment_expiry_date,
        p_condition_at_issuance: assignmentData.condition_at_issuance,
        p_issuance_condition_notes: assignmentData.issuance_condition_notes,
        p_notes: assignmentData.notes
      });

    if (error) throw error;
    return data;
  },

  async unassignAssetFromAll(assetId: string, returnCondition?: string, returnNotes?: string) {
    const { data, error } = await supabase
      .rpc('unassign_asset_from_all', {
        p_asset_id: assetId,
        p_return_condition: returnCondition || 'good',
        p_return_notes: returnNotes
      });

    if (error) throw error;

    // Notifications for unassignment are handled automatically by database triggers
    console.log('Asset unassigned successfully, notifications triggered via database triggers');

    return data;
  },

  async updateAssignmentCondition(assignmentId: string, condition: string, notes?: string) {
    const { data, error } = await supabase
      .rpc('update_assignment_condition', {
        p_assignment_id: assignmentId,
        p_condition_at_issuance: condition,
        p_issuance_notes: notes
      });

    if (error) throw error;
    return data;
  },

  async unassignSpecificUser(assignmentId: string, returnCondition?: string, returnNotes?: string) {
    const { error } = await supabase
      .from('asset_assignments')
      .update({
        is_active: false,
        return_date: new Date().toISOString().split('T')[0],
        return_condition_notes: returnNotes
      })
      .eq('id', assignmentId);

    if (error) throw error;

    // Check if this was the last assignment for this asset, if so update asset status
    const { data: remainingAssignments } = await supabase
      .from('asset_assignments')
      .select('asset_id')
      .eq('asset_id', (await supabase.from('asset_assignments').select('asset_id').eq('id', assignmentId).single()).data?.asset_id)
      .eq('is_active', true);

    if (!remainingAssignments || remainingAssignments.length === 0) {
      await supabase
        .from('assets')
        .update({ status: 'available' })
        .eq('id', (await supabase.from('asset_assignments').select('asset_id').eq('id', assignmentId).single()).data?.asset_id);
    }
  },

  async createAssetCategory(categoryData: { name: string; description?: string; depreciation_rate?: number }) {
    const { data, error } = await supabase
      .rpc('create_asset_category_if_not_exists', {
        p_category_name: categoryData.name,
        p_description: categoryData.description,
        p_depreciation_rate: categoryData.depreciation_rate || 10.00
      });

    if (error) throw error;
    return data;
  },

  async getAssetMetrics() {
    // Get total assets count
    const { data: totalAssets } = await supabase
      .from('assets')
      .select('id, status');

    // Get active assignments count
    const { data: activeAssignments } = await supabase
      .from('asset_assignments')
      .select('id')
      .eq('is_active', true);

    // Get assets by status
    const assetsByStatus = totalAssets?.reduce((acc: any, asset: any) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return {
      totalAssets: totalAssets?.length || 0,
      activeAssignments: activeAssignments?.length || 0,
      availableAssets: assetsByStatus.available || 0,
      assignedAssets: assetsByStatus.assigned || 0,
      maintenanceAssets: assetsByStatus.maintenance || 0,
      retiredAssets: assetsByStatus.retired || 0,
    };
  },

  async getCurrentNotesGuidance() {
    const { data, error } = await supabase
      .from('current_asset_notes_guidance')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createNotesGuidance(title: string, guidance_text: string) {
    console.log('Creating notes guidance with:', { title, guidance_text });

    // Get current user from localStorage (matching the auth pattern used in this app)
    const userDataStr = localStorage.getItem('hrms_user');
    if (!userDataStr) throw new Error('Not authenticated');

    const userData = JSON.parse(userDataStr);
    if (!userData || !userData.id) throw new Error('Invalid user session');

    const { data, error } = await supabase
      .from('asset_notes_guidance')
      .insert({
        title,
        guidance_text,
        created_by: userData.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notes guidance:', error);
      throw error;
    }

    console.log('Successfully created notes guidance:', data);
    return data;
  },

  async updateNotesGuidance(id: string, title: string, guidance_text: string) {
    // Get current user from localStorage (matching the auth pattern used in this app)
    const userDataStr = localStorage.getItem('hrms_user');
    if (!userDataStr) throw new Error('Not authenticated');

    const userData = JSON.parse(userDataStr);
    if (!userData || !userData.id) throw new Error('Invalid user session');

    const { data, error } = await supabase
      .from('asset_notes_guidance')
      .update({
        title,
        guidance_text,
        updated_by: userData.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update notes guidance error:', error);
      throw error;
    }

    console.log('Successfully updated notes guidance:', data);
    return data;
  },

  async deleteNotesGuidance(id: string) {
    const { data, error } = await supabase
      .from('asset_notes_guidance')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return data;
  },

  async getAllNotesGuidance() {
    const { data, error } = await supabase
      .from('asset_notes_guidance')
      .select(`
        *,
        created_by_user:users!created_by(full_name),
        updated_by_user:users!updated_by(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getNotesGuidanceHistory() {
    const { data, error } = await supabase
      .from('asset_notes_guidance')
      .select(`
        *,
        created_by_user:users!created_by(full_name),
        updated_by_user:users!updated_by(full_name)
      `)
      .order('version', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Assignment Logs API
  async getUserAssignmentLogs(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_assignment_logs', { p_user_id: userId });

    if (error) throw error;
    return data;
  },

  async getUsersWithAssignmentHistory() {
    const { data, error } = await supabase
      .rpc('get_users_with_assignment_history');

    if (error) throw error;
    return data;
  },

  async getAllAssignmentLogs() {
    const { data, error } = await supabase
      .from('assignment_logs')
      .select(`
        *,
        action_by_user:users!action_by(full_name)
      `)
      .order('action_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async backfillAssignmentLogs() {
    const { data, error } = await supabase
      .rpc('backfill_assignment_logs');

    if (error) throw error;
    return data;
  },

  // Get all assignments (including inactive ones) for backward compatibility
  async getAllAssetAssignments() {
    const { data, error } = await supabase
      .from('asset_assignments')
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, status, category:asset_categories(name, description)),
        user:users!user_id(full_name, employee_id, status, manager_id, department:departments!users_department_id_fkey(name)),
        assigned_by_user:users!assigned_by(full_name)
      `)
      .order('assigned_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get user's assigned assets
  async getUserAssets(userId: string) {
    const { data, error } = await supabase
      .from('asset_assignments')
      .select(`
        *,
        asset:assets(
          id,
          name, 
          asset_tag, 
          brand, 
          model, 
          condition,
          category:asset_categories(name, description)
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('assigned_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Asset maintenance/support complaint functions
  async createAssetComplaint(complaintData: {
    user_id: string;
    asset_id: string;
    asset_assignment_id: string;
    problem_description: string;
    priority?: string;
  }) {
    const { data, error } = await supabase
      .from('asset_complaints')
      .insert({
        ...complaintData,
        priority: complaintData.priority || 'medium',
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name)),
        user:users!asset_complaints_user_id_fkey(full_name, employee_id)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async getUserAssetComplaints(userId: string) {
    const { data, error } = await supabase
      .from('asset_complaints')
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name)),
        resolved_by_user:users!asset_complaints_resolved_by_fkey(full_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get all asset complaints for admin view
  async getAllAssetComplaints() {
    const { data, error } = await supabase
      .from('asset_complaints')
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name)),
        user:users!asset_complaints_user_id_fkey(full_name, employee_id),
        resolved_by_user:users!asset_complaints_resolved_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Update complaint status and resolution
  async updateAssetComplaint(complaintId: string, updates: {
    status?: string;
    priority?: string;
    resolved_by?: string;
    resolution_notes?: string;
  }) {
    const { data, error } = await supabase
      .from('asset_complaints')
      .update(updates)
      .eq('id', complaintId)
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name)),
        user:users!asset_complaints_user_id_fkey(full_name, employee_id),
        resolved_by_user:users!asset_complaints_resolved_by_fkey(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Asset Requests API
  async createAssetRequest(requestData: {
    user_id: string;
    category_id: string;
    description: string;
    justification?: string;
    priority?: string;
  }) {
    const { data, error } = await supabase
      .from('asset_requests')
      .insert(requestData)
      .select(`
        *,
        category:asset_categories(name, description),
        user:users!asset_requests_user_id_fkey(full_name, employee_id, manager_id)
      `)
      .single();

    if (error) throw error;

    // Notifications are now handled automatically by database triggers
    // This ensures notifications are sent even if the client disconnects
    console.log('Asset request created successfully, notifications triggered via database triggers');

    return data;
  },

  async getUserAssetRequests(userId: string) {
    const { data, error } = await supabase
      .from('asset_requests')
      .select(`
        *,
        category:asset_categories(name, description),
        approved_by_user:users!asset_requests_approved_by_fkey(full_name),
        rejected_by_user:users!asset_requests_rejected_by_fkey(full_name),
        fulfilled_by_user:users!asset_requests_fulfilled_by_fkey(full_name),
        fulfilled_asset:assets(name, asset_tag, brand, model)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAllAssetRequests() {
    console.log('API: getAllAssetRequests called');
    const { data, error } = await supabase
      .from('asset_requests')
      .select(`
        *,
        category:asset_categories(name, description),
        user:users!asset_requests_user_id_fkey(full_name, employee_id, department:departments!users_department_id_fkey(name)),
        approved_by_user:users!asset_requests_approved_by_fkey(full_name),
        rejected_by_user:users!asset_requests_rejected_by_fkey(full_name),
        fulfilled_by_user:users!asset_requests_fulfilled_by_fkey(full_name),
        fulfilled_asset:assets(name, asset_tag, brand, model)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('API: getAllAssetRequests error:', error);
      throw error;
    }
    console.log('API: getAllAssetRequests returned', data?.length || 0, 'requests');
    return data;
  },

  // Get asset requests visible to current user based on RLS policies (managers see managed user requests)
  // This will be filtered by RLS policies to only show requests from directly managed users
  async getManagerAssetRequests() {
    console.log('API: getManagerAssetRequests called');
    const { data, error } = await supabase
      .from('asset_requests')
      .select(`
        *,
        category:asset_categories(name, description),
        user:users!asset_requests_user_id_fkey(full_name, employee_id, department:departments!users_department_id_fkey(name)),
        approved_by_user:users!asset_requests_approved_by_fkey(full_name),
        rejected_by_user:users!asset_requests_rejected_by_fkey(full_name),
        fulfilled_by_user:users!asset_requests_fulfilled_by_fkey(full_name),
        fulfilled_asset:assets(name, asset_tag, brand, model)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('API: getManagerAssetRequests error:', error);
      throw error;
    }
    console.log('API: getManagerAssetRequests returned', data?.length || 0, 'requests');
    return data;
  },

  // Get asset assignments with manager filtering via RLS
  async getManagerAssetAssignments() {
    const { data, error } = await supabase
      .from('asset_assignments')
      .select(`
        *,
        asset:assets(
          name, asset_tag, brand, model, condition, status,
          category:asset_categories(name)
        ),
        user:users!asset_assignments_user_id_fkey(full_name, employee_id, department:departments!users_department_id_fkey(name)),
        assigned_by_user:users!asset_assignments_assigned_by_fkey(full_name)
      `)
      .order('assigned_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get asset complaints with manager filtering via RLS
  async getManagerAssetComplaints() {
    const { data, error } = await supabase
      .from('asset_complaints')
      .select(`
        *,
        asset:assets(name, asset_tag, brand, model, category:asset_categories(name)),
        user:users!asset_complaints_user_id_fkey(full_name, employee_id, department:departments!users_department_id_fkey(name)),
        resolved_by_user:users!asset_complaints_resolved_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateAssetRequest(requestId: string, updates: {
    status?: string;
    approved_by?: string;
    rejected_by?: string;
    fulfilled_by?: string;
    rejection_reason?: string;
    approval_notes?: string;
    fulfilled_asset_id?: string;
    approved_at?: string;
    rejected_at?: string;
    fulfilled_at?: string;
    manager_notified?: boolean;
    hr_notified?: boolean;
    admin_notified?: boolean;
    approval_notification_sent?: boolean;
  }) {
    // Add timestamps for status changes
    if (updates.status === 'approved' && !updates.approved_at) {
      updates.approved_at = new Date().toISOString();
    } else if (updates.status === 'rejected' && !updates.rejected_at) {
      updates.rejected_at = new Date().toISOString();
    } else if (updates.status === 'fulfilled' && !updates.fulfilled_at) {
      updates.fulfilled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('asset_requests')
      .update(updates)
      .eq('id', requestId)
      .select(`
        *,
        category:asset_categories(name, description),
        user:users!asset_requests_user_id_fkey(full_name, employee_id, department:departments!users_department_id_fkey(name)),
        approved_by_user:users!asset_requests_approved_by_fkey(full_name),
        rejected_by_user:users!asset_requests_rejected_by_fkey(full_name),
        fulfilled_by_user:users!asset_requests_fulfilled_by_fkey(full_name),
        fulfilled_asset:assets(name, asset_tag, brand, model)
      `)
      .single();

    if (error) throw error;

    // Notifications for status changes are handled automatically by database triggers
    console.log('Asset request updated successfully, status change notifications triggered via database triggers');

    return data;
  }
};

// Virtual Machine Management API
export const vmApi = {
  async getAllVMs() {
    const { data, error } = await supabase
      .from('virtual_machines')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getVMAssignments() {
    const { data, error } = await supabase
      .from('vm_assignments_view')
      .select('*')
      .order('assigned_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAvailableVMs() {
    const { data, error } = await supabase
      .rpc('get_available_vms');

    if (error) throw error;
    return data;
  },

  async getUserVMs(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_vms', { p_user_id: userId });

    if (error) throw error;
    return data;
  },

  async createVM(vmData: any) {
    const { data, error } = await supabase
      .rpc('create_vm_with_assignment', {
        p_vm_number: vmData.vm_number,
        p_vm_location: vmData.vm_location,
        p_access_type: vmData.access_type,
        p_current_user_type: vmData.current_user_type,
        p_requested_by: vmData.requested_by,
        p_approved_by: vmData.approved_by,
        p_created_by: vmData.created_by,
        p_request_ticket_id: vmData.request_ticket_id,
        p_purpose: vmData.purpose,
        p_project_name: vmData.project_name,
        p_username: vmData.username,
        p_current_password: vmData.current_password,
        p_previous_password: vmData.previous_password,
        p_ip_address: vmData.ip_address,
        p_ghost_ip: vmData.ghost_ip,
        p_vpn_requirement: vmData.vpn_requirement,
        p_mfa_enabled: vmData.mfa_enabled,
        p_cloud_provider: vmData.cloud_provider,
        p_backup_enabled: vmData.backup_enabled,
        p_audit_status: vmData.audit_status,
        p_approval_date: vmData.approval_date,
        p_expiry_date: vmData.expiry_date,
        p_assign_to_user_id: vmData.assign_to_user_id,
        p_assigned_by_user_id: vmData.assigned_by_user_id,
        p_assignment_notes: vmData.assignment_notes
      });

    if (error) throw error;
    return data;
  },

  async assignVMToUser(vmId: string, userId: string, assignedBy: string, notes?: string) {
    const { data, error } = await supabase
      .rpc('assign_vm_to_user', {
        p_vm_id: vmId,
        p_user_id: userId,
        p_assigned_by_user_id: assignedBy,
        p_notes: notes
      });

    if (error) throw error;
    return data;
  },

  async unassignVMFromUser(vmId: string, returnCondition: string = 'good') {
    const { data, error } = await supabase
      .rpc('unassign_vm_from_user', {
        p_vm_id: vmId,
        p_return_condition: returnCondition
      });

    if (error) throw error;
    return data;
  },

  async updateVM(vmId: string, updates: any) {
    console.log('Updating VM with data:', updates);

    const { data, error } = await supabase
      .from('virtual_machines')
      .update(updates)
      .eq('id', vmId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteVM(vmId: string) {
    // First unassign if assigned
    await this.unassignVMFromUser(vmId);

    // Delete the VM record
    const { error } = await supabase
      .from('virtual_machines')
      .delete()
      .eq('id', vmId);

    if (error) throw error;
  },

  async getVMMetrics() {
    // Get total VMs count
    const { data: totalVMs } = await supabase
      .from('virtual_machines')
      .select('id, vm_location, cloud_provider, audit_status');

    // Get active VM assignments count
    const { data: activeVMAssignments } = await supabase
      .from('asset_assignments')
      .select('id')
      .eq('is_active', true)
      .not('vm_id', 'is', null);

    // Get VMs by location
    const vmsByLocation = totalVMs?.reduce((acc: any, vm: any) => {
      acc[vm.vm_location] = (acc[vm.vm_location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get VMs by cloud provider
    const vmsByProvider = totalVMs?.reduce((acc: any, vm: any) => {
      acc[vm.cloud_provider] = (acc[vm.cloud_provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get VMs by audit status
    const vmsByAuditStatus = totalVMs?.reduce((acc: any, vm: any) => {
      acc[vm.audit_status] = (acc[vm.audit_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return {
      totalVMs: totalVMs?.length || 0,
      activeVMAssignments: activeVMAssignments?.length || 0,
      availableVMs: (totalVMs?.length || 0) - (activeVMAssignments?.length || 0),
      vmsByLocation,
      vmsByProvider,
      vmsByAuditStatus
    };
  },

  async getVMByAssetId(assetId: string) {
    try {
      // First, get the asset information to extract the VM number from asset_tag
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('asset_tag, name')
        .eq('id', assetId)
        .single();

      if (assetError) {
        console.error('Error fetching asset:', assetError);
        return null;
      }

      if (!asset?.asset_tag) {
        console.log('No asset_tag found for asset:', assetId);
        return null;
      }

      // Check if this is a VM asset (asset_tag should start with 'VM-')
      if (!asset.asset_tag.startsWith('VM-')) {
        console.log('Asset is not a VM asset:', asset.asset_tag);
        return null;
      }

      // Extract VM number from asset_tag (e.g., 'VM-1001' -> '1001')
      const vmNumber = asset.asset_tag.replace('VM-', '');
      console.log('Extracted VM number:', vmNumber, 'from asset_tag:', asset.asset_tag);

      // Fetch VM data directly from virtual_machines table using vm_number
      // Select specific columns to avoid schema cache issues
      const { data: vmData, error: vmError } = await supabase
        .from('virtual_machines')
        .select(`
          id,
          vm_number,
          vm_location,
          access_type,
          current_user_type,
          requested_by,
          approved_by,
          created_by,
          request_ticket_id,
          purpose,
          project_name,
          username,
          current_password,
          previous_password,
          ip_address,
          ghost_ip,
          vpn_requirement,
          mfa_enabled,
          cloud_provider,
          backup_enabled,
          audit_status,
          approval_date,
          expiry_date,
          created_at,
          updated_at
        `)
        .eq('vm_number', vmNumber)
        .single();

      if (vmError) {
        console.error('Error fetching VM data for vm_number:', vmNumber, vmError);
        return null;
      }

      console.log('Successfully fetched VM data:', vmData);
      return vmData;

    } catch (error) {
      console.error('Unexpected error in getVMByAssetId:', error);
      return null;
    }
  }
};

// HR Referrals API
export const hrReferralsApi = {
  async getAllReferrals() {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        referred_by_user:users!referred_by(full_name, employee_id, email, department:departments!users_department_id_fkey(name))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateReferralStatus(
    id: string,
    status: string,
    hrNotes?: string,
    bonusEligible?: boolean,
    bonusAmount?: number | null,
    bonusPaid?: boolean
  ) {
    const updateData: any = {
      status,
      hr_notes: hrNotes,
      updated_at: new Date().toISOString()
    };

    // Handle bonus fields
    if (bonusEligible !== undefined) {
      updateData.bonus_eligible = bonusEligible;
    }

    if (bonusAmount !== undefined) {
      updateData.bonus_amount = bonusAmount;
    }

    if (bonusPaid !== undefined) {
      updateData.bonus_paid = bonusPaid;
    }

    const { data, error } = await supabase
      .from('referrals')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        referred_by_user:users!referred_by(full_name, employee_id, email, department:departments!users_department_id_fkey(name))
      `)
      .single();

    if (error) throw error;
    return data;
  }
};

// Grievance Management API
export const grievanceApi = {
  async getAllComplaints() {
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        user:users!complaints_user_id_fkey(full_name, employee_id, email),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getComplaintCategories() {
    const { data, error } = await supabase
      .from('complaint_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async approveComplaint(id: string, assigned_to: string, approvedBy: string) {
    console.log('Approving complaint:', { id, assigned_to, approvedBy });

    const { data, error } = await supabase
      .from('complaints')
      .update({
        status: 'in_progress', // Change to in_progress when approved and assigned
        assigned_to: assigned_to, // Update the assigned_to field with the new resolver
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        user:users!complaints_user_id_fkey(full_name, employee_id, email, manager_id),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    console.log('Complaint updated successfully:', data);

    // Send notifications after manager approval
    try {
      // 1. Notify the assigned resolver
      await notificationApi.createNotification({
        user_id: assigned_to,
        title: 'Complaint Assigned to You',
        message: `You have been assigned to resolve the complaint "${data.title}" submitted by ${data.user.full_name}.`,
        type: 'complaint_assigned',
        data: { complaint_id: data.id, action: 'resolve', target: 'grievance/active' }
      });

      // 2. Notify the employee who submitted the complaint
      await notificationApi.createNotification({
        user_id: data.user_id,
        title: 'Complaint Approved and Assigned',
        message: `Your complaint "${data.title}" has been approved by your manager and assigned to ${data.assigned_to_user.full_name} for resolution.`,
        type: 'complaint_approved',
        data: { complaint_id: data.id, action: 'view', target: 'dashboard/complaints', tab: 'my-complaints' }
      });
    } catch (notificationError: any) {
      console.error('Failed to send approval notifications:', notificationError);
    }

    return data;
  },

  async rejectComplaint(id: string, rejectedBy: string, reason?: string) {
    const { data, error } = await supabase
      .from('complaints')
      .update({
        status: 'closed',
        resolution: `Rejected: ${reason}` || 'Complaint rejected by manager',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        user:users!complaints_user_id_fkey(full_name, employee_id, email, manager_id),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    // Send notifications for rejection
    try {
      // 1. Notify the employee who submitted the complaint
      await notificationApi.createNotification({
        user_id: data.user_id,
        title: 'Complaint Closed',
        message: `Your complaint "${data.title}" has been closed by your manager. ${reason ? `Reason: ${reason}` : ''}`,
        type: 'complaint_resolved',
        data: { complaint_id: data.id, action: 'view', target: 'dashboard/complaints', tab: 'my-complaints' }
      });
    } catch (notificationError) {
      console.error('Failed to send rejection notification:', notificationError);
    }

    return data;
  },

  async reassignComplaint(id: string, new_assigned_to: string, reassignedBy: string, reason?: string) {
    const { data, error } = await supabase
      .from('complaints')
      .update({
        assigned_to: new_assigned_to,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        user:users!complaints_user_id_fkey(full_name, employee_id, email, manager_id),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    // Send notifications for reassignment
    try {
      // 1. Notify the new assignee
      await notificationApi.createNotification({
        user_id: new_assigned_to,
        title: 'Complaint Reassigned to You',
        message: `The complaint "${data.title}" has been reassigned to you${reason ? `: ${reason}` : '.'}`,
        type: 'complaint_reassigned',
        data: { complaint_id: data.id, action: 'resolve' }
      });

      // 2. Notify the employee who submitted the complaint
      await notificationApi.createNotification({
        user_id: data.user_id,
        title: 'Complaint Reassigned',
        message: `Your complaint "${data.title}" has been reassigned to a different resolver for better handling.`,
        type: 'complaint_reassigned',
        data: { complaint_id: data.id, action: 'view', target: 'dashboard/complaints', tab: 'my-complaints' }
      });

      // 3. Notify the employee's manager (if different from reassigner)
      if (data.user.manager_id) {
        await notificationApi.createNotification({
          user_id: data.user.manager_id,
          title: 'Team Member Complaint Reassigned',
          message: `The complaint "${data.title}" from ${data.user.full_name} has been reassigned.`,
          type: 'complaint_reassigned',
          data: { complaint_id: data.id, action: 'view', target: 'grievance/active' }
        });
      }
    } catch (notificationError) {
      console.error('Failed to send reassignment notifications:', notificationError);
    }

    return data;
  },

  async getResolverOptions() {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, employee_id, role:roles(name), department:departments!users_department_id_fkey(name)')
      .eq('status', 'active')
      .order('full_name');

    if (error) throw error;

    // Also get users by role name for flexibility
    const { data: roleBasedUsers, error: roleError } = await supabase
      .from('users')
      .select(`
        id, full_name, employee_id, 
        role:roles!inner(name), 
        department:departments!users_department_id_fkey(name)
      `)
      .eq('status', 'active')
      .in('role.name', ['hr', 'bdm', 'qam', 'sdm', 'hrm', 'admin', 'super_admin'])
      .order('full_name');

    if (roleError) throw roleError;

    // Get users who are managers (have direct reports)
    const { data: managers, error: managersError } = await supabase
      .from('users')
      .select(`
        id, full_name, employee_id, 
        role:roles(name), 
        department:departments!users_department_id_fkey(name)
      `)
      .eq('status', 'active')
      .not('manager_id', 'is', null)
      .order('full_name');

    if (managersError) throw managersError;

    // Get users from HR and Finance departments
    const { data: departmentUsers, error: deptError } = await supabase
      .from('users')
      .select(`
        id, full_name, employee_id, 
        role:roles(name), 
        department:departments!users_department_id_fkey!inner(name)
      `)
      .eq('status', 'active')
      .in('department.name', ['HR', 'Finance', 'Human Resources'])
      .order('full_name');

    if (deptError) throw deptError;

    // Combine all resolver sources and deduplicate
    const allResolvers = [
      ...(roleBasedUsers || []),
      ...(managers || []),
      ...(departmentUsers || [])
    ];
    const uniqueResolvers = allResolvers.filter((resolver, index, self) =>
      index === self.findIndex(r => r.id === resolver.id)
    );

    return uniqueResolvers;
  },

  async updateComplaintStatus(id: string, status: string, resolution?: string, assigned_to?: string) {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (resolution) {
      updateData.resolution = resolution;
    }

    if (assigned_to) {
      updateData.assigned_to = assigned_to;
    }

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('complaints')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:complaint_categories(name, description, priority_level),
        user:users!complaints_user_id_fkey(full_name, employee_id, email, manager_id),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    // Send notifications for all status updates
    try {
      // 1. Notify the employee who submitted the complaint
      let notificationTitle = 'Complaint Status Updated';
      let notificationMessage = `Your complaint "${data.title}" status has been updated to ${status}.`;

      if (status === 'resolved') {
        notificationTitle = 'Complaint Resolved';
        notificationMessage = `Your complaint "${data.title}" has been resolved.`;
        if (resolution) {
          notificationMessage += ` Resolution: ${resolution}`;
        }
      }

      await notificationApi.createNotification({
        user_id: data.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: status === 'resolved' ? 'complaint_resolved' : 'complaint_status_updated',
        data: { complaint_id: data.id, action: 'view' }
      });

      // 2. Notify the employee's manager (always notify manager of changes)
      if (data.user.manager_id && data.user.manager_id !== assigned_to) {
        await notificationApi.createNotification({
          user_id: data.user.manager_id,
          title: 'Team Member Complaint Updated',
          message: `The complaint "${data.title}" from ${data.user.full_name} has been ${status}.`,
          type: status === 'resolved' ? 'complaint_resolved' : 'complaint_status_updated',
          data: { complaint_id: data.id, action: 'view' }
        });
      }

      // 3. If there's an assigned resolver (and it's not the employee or manager), notify them too
      if (data.assigned_to && data.assigned_to !== data.user_id && data.assigned_to !== data.user.manager_id) {
        await notificationApi.createNotification({
          user_id: data.assigned_to,
          title: 'Assigned Complaint Updated',
          message: `The complaint "${data.title}" you are resolving has been updated to ${status}.`,
          type: status === 'resolved' ? 'complaint_resolved' : 'complaint_status_updated',
          data: { complaint_id: data.id, action: 'view' }
        });
      }
    } catch (notificationError) {
      console.error('Failed to send status update notifications:', notificationError);
    }

    return data;
  },

  async getComplaintComments(complaintId: string) {
    const { data, error } = await supabase
      .from('complaint_comments')
      .select(`
        *,
        user:users(full_name, avatar_url)
      `)
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async createComplaintComment(commentData: {
    complaint_id: string;
    user_id: string;
    comment: string;
    is_internal?: boolean;
  }) {
    const { data, error } = await supabase
      .from('complaint_comments')
      .insert(commentData)
      .select(`
        *,
        user:users(full_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  }
};

// Exit Process API for HR
export const hrExitApi = {
  async getAllExitProcesses() {
    const { data, error } = await supabase
      .from('exit_processes')
      .select(`
        *,
        user:users!user_id(full_name, employee_id, email, department:departments!users_department_id_fkey(name)),
        initiated_by_user:users!initiated_by(full_name),
        hr_approved_by_user:users!hr_approved_by(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getExitProcessById(id: string) {
    const { data, error } = await supabase
      .from('exit_processes')
      .select(`
        *,
        user:users!user_id(full_name, employee_id, email, phone, department:departments!users_department_id_fkey(name), role:roles(name)),
        initiated_by_user:users!initiated_by(full_name),
        hr_approved_by_user:users!hr_approved_by(full_name),
        clearance_items:exit_clearance_items(*),
        documents:exit_documents(*),
        interview:exit_interviews(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateExitProcess(id: string, updates: any) {
    const { data, error } = await supabase
      .from('exit_processes')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteExitProcess(id: string) {
    const { error } = await supabase
      .from('exit_processes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// BD Team API
export const bdTeamApi = {
  async getDashboardStats() {
    // Get active clients count
    const { data: billingRecords } = await supabase
      .from('billing_records')
      .select('client_name')
      .gte('contract_end_date', getTodayIST());

    const activeClients = new Set(billingRecords?.map((r: any) => r.client_name)).size;

    // Get unpaid invoices
    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('invoice_amount')
      .in('status', ['assigned', 'in_progress', 'sent']);

    const unpaidAmount = unpaidInvoices?.reduce((sum: any, inv: any) => sum + inv.invoice_amount, 0) || 0;
    const unpaidCount = unpaidInvoices?.length || 0;

    // Get overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id')
      .lt('due_date', getTodayIST())
      .neq('status', 'paid');

    const overdueCount = overdueInvoices?.length || 0;

    // Get total contract value
    const { data: totalContracts } = await supabase
      .from('billing_records')
      .select('contract_value');

    const totalContractValue = totalContracts?.reduce((sum: any, record: any) => sum + record.contract_value, 0) || 0;

    return {
      activeClients,
      unpaidAmount,
      unpaidCount,
      overdueCount,
      totalContractValue
    };
  },

  async getAllBillingRecords() {
    const { data, error } = await supabase
      .from('billing_records')
      .select(`
        *,
        assigned_to_finance_user:users!assigned_to_finance(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getBillingRecordById(id: string) {
    const { data, error } = await supabase
      .from('billing_records')
      .select(`
        *,
        assigned_to_finance_user:users!assigned_to_finance(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createBillingRecord(billingData: any) {
    const { data, error } = await supabase
      .from('billing_records')
      .insert(billingData)
      .select(`
        *,
        assigned_to_finance_user:users!assigned_to_finance(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateBillingRecord(id: string, updates: any, currentUserId: string) {
    const { data, error } = await supabase
      .from('billing_records')
      .update({
        ...updates,
        last_modified_by: currentUserId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        assigned_to_finance_user:users!assigned_to_finance(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async getAllInvoices() {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        assigned_finance_poc_user:users!assigned_finance_poc(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getInvoiceById(id: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        assigned_finance_poc_user:users!assigned_finance_poc(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createInvoice(invoiceData: any) {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select(`
        *,
        assigned_finance_poc_user:users!assigned_finance_poc(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateInvoice(id: string, updates: any, currentUserId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        ...updates,
        last_modified_by: currentUserId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        assigned_finance_poc_user:users!assigned_finance_poc(full_name, email),
        created_by_user:users!created_by(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async getBillingLogs(recordId?: string, invoiceId?: string) {
    try {
      let query = supabase
        .from('billing_logs')
        .select(`
          *,
          changed_by_user:users!changed_by(full_name)
        `);

      if (recordId) {
        query = query.eq('billing_record_id', recordId);
      }

      if (invoiceId) {
        query = query.eq('invoice_id', invoiceId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Billing logs fetch error:', error);
        // Return empty array if there's an RLS error or no data
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Billing logs API error:', error);
      return [];
    }
  },

  async getRecentBillingLogs(limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('billing_logs')
        .select(`
          *,
          changed_by_user:users!changed_by(full_name),
          billing_record:billing_records(client_name, project_name),
          invoice:invoices(invoice_title, client_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit || 10);

      if (error) {
        console.error('Recent billing logs fetch error:', error);
        // Return empty array if there's an RLS error or no data
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Recent billing logs API error:', error);
      return [];
    }
  },

  async getInvoiceComments(invoiceId: string) {
    const { data, error } = await supabase
      .from('invoice_comments')
      .select(`
        *,
        user:users(full_name, avatar_url)
      `)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async createInvoiceComment(commentData: {
    invoice_id: string;
    user_id: string;
    comment: string;
    is_internal?: boolean;
  }) {
    const { data, error } = await supabase
      .from('invoice_comments')
      .insert(commentData)
      .select(`
        *,
        user:users(full_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async getFinanceUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, employee_id')
      .eq('status', 'active')
      .order('full_name');

    if (error) throw error;
    return data;
  },

  async getBillingHistoryByClient(clientName: string) {
    const { data, error } = await supabase
      .from('billing_records')
      .select('*')
      .eq('client_name', clientName)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

// Export finance API
export { financeApi };

// Export ATS API
export { atsApi };

// Export LMS API
export { lmsApi } from './lmsApi';

// Export Notification API
export { notificationApi };