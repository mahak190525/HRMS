export interface User {
  id: string;
  auth_provider: 'microsoft' | 'google' | 'manual';
  provider_user_id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  employee_id?: string;
  role_id: string;
  additional_role_ids?: string[]; // New field for multiple roles
  department_id?: string;
  position?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  date_of_joining?: string;
  company_email?: string;
  salary?: number;
  extra_permissions: {
    dashboards?: Record<string, boolean>;
    department_dashboards?: Record<string, boolean>;
    pages?: Record<string, Record<string, boolean>>;
    department_pages?: Record<string, Record<string, boolean>>;
    features?: Record<string, Record<string, boolean>>;
    crud?: Record<string, Record<string, boolean>>;
    department_crud?: Record<string, Record<string, boolean>>;
    notifications?: Record<string, boolean>;
    preferences?: Record<string, any>;
  };
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  last_login?: string;
  avatar_url?: string;
  signup_data?: Record<string, any>;
  role?: { name: string; description: string; };
  additional_roles?: { id: string; name: string; description: string; }[]; // Additional roles data
  all_role_names?: string[]; // Aggregated role names for easy access
  aggregated_permissions?: Record<string, any>; // Aggregated permissions from all roles
  aggregated_dashboards?: string[]; // Aggregated dashboards from all roles
  department?: { name: string; description: string; };
  
  // New profile fields from migration
  personal_email?: string;
  alternate_contact_no?: string;
  level_grade?: string;
  skill?: string[];
  current_office_location?: string;
  blood_group?: string;
  religion?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  date_of_marriage_anniversary?: string;
  father_name?: string;
  father_dob?: string;
  mother_name?: string;
  mother_dob?: string;
  designation_offer_letter?: string;
  permanent_address?: string;
  aadhar_card_no?: string;
  pan_no?: string;
  bank_account_no?: string;
  ifsc_code?: string;
  qualification?: string;
  employment_terms?: 'part_time' | 'full_time';
  tenure_mechlin?: string; // interval type from PostgreSQL
  isSA?: boolean;
}

export interface DashboardPermissions {
  read: boolean;
  write: boolean;
  view: boolean;
  delete: boolean;
}

export interface PagePermissions {
  read: boolean;
  write: boolean;
  view: boolean;
  delete: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  default_dashboards: string[];
  permissions: Record<string, boolean>;
  dashboard_permissions?: Record<string, DashboardPermissions>;
  page_permissions?: Record<string, Record<string, PagePermissions>>;
}

export interface Dashboard {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  pages: DashboardPage[];
}

export interface DashboardPage {
  id: string;
  name: string;
  slug: string;
  path: string;
  icon: string;
  permissions_required?: string[];
}

export interface Permission {
  dashboard_id: string;
  page_id?: string;
  granted: boolean;
}

export interface LeaveApplication {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  is_half_day?: boolean;
  half_day_period?: '1st_half' | '2nd_half';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applied_at: string;
  approved_by?: string;
  approved_at?: string;
  comments?: string;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  resolution?: string;
  resolved_at?: string;
}

export interface PerformanceEvaluation {
  id: string;
  user_id: string;
  evaluator_id: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  overall_rating?: number;
  technical_skills_rating?: number;
  communication_rating?: number;
  teamwork_rating?: number;
  leadership_rating?: number;
  strengths?: string;
  areas_for_improvement?: string;
  comments?: string;
  status: 'draft' | 'submitted' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface PerformanceAppraisal {
  id: string;
  user_id: string;
  appraisal_year: number;
  self_assessment?: string;
  manager_assessment?: string;
  hr_assessment?: string;
  final_rating?: number;
  salary_increment_percentage: number;
  promotion_recommended: boolean;
  development_plan?: string;
  status: 'in_progress' | 'completed' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface PerformanceFeedback {
  id: string;
  user_id: string;
  feedback_giver_id: string;
  feedback_type?: 'peer' | 'subordinate' | 'manager' | 'self';
  feedback_text: string;
  rating?: number;
  is_anonymous: boolean;
  created_at: string;
}

export interface BillingRecord {
  id: string;
  client_name: string;
  project_name?: string;
  contract_type: 'fixed' | 'hourly' | 'retainer' | 'milestone';
  billing_cycle: 'one_time' | 'monthly' | 'quarterly' | 'custom';
  contract_start_date: string;
  contract_end_date: string;
  contract_value: number;
  billed_to_date: number;
  remaining_amount: number;
  next_billing_date: string;
  payment_terms: 'net_15' | 'net_30' | 'custom';
  internal_notes?: string;
  assigned_to_finance: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_title: string;
  client_name: string;
  project?: string;
  billing_reference?: string;
  invoice_amount: number;
  due_date: string;
  payment_terms: 'net_15' | 'net_30' | 'custom';
  currency: 'USD' | 'INR' | 'EUR' | 'GBP';
  notes_to_finance?: string;
  status: 'assigned' | 'in_progress' | 'sent' | 'paid' | 'overdue';
  attachments?: string[];
  assigned_finance_poc: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  position_applied: string;
  resume_url?: string;
  status: 'applied' | 'screening' | 'interview_scheduled' | 'interviewed' | 'selected' | 'rejected' | 'hired';
  interview_date?: string;
  interview_notes?: string;
  assessment_score?: number;
  referred_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PerformanceGoal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  target_date: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  progress_percentage: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referred_by: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  position: string;
  resume_url?: string;
  additional_info?: string;
  relationship?: string;
  linkedin_profile?: string;
  current_company?: string;
  current_job_title?: string;
  total_experience_years?: number;
  total_experience_months?: number;
  current_ctc?: number;
  expected_ctc?: number;
  notice_period_availability?: string;
  reason_for_change?: string;
  key_skills?: string;
  domain_expertise?: string;
  location_preference?: 'Mohali' | 'Kota';
  status: 'submitted' | 'under_review' | 'contacted' | 'hired' | 'rejected';
  bonus_eligible?: boolean;
  bonus_amount?: number;
  bonus_paid?: boolean;
  hr_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_hours: number;
  is_mandatory: boolean;
  prerequisites: string[];
  target_roles: string[];
  target_departments: string[];
  content_type: 'video' | 'document' | 'interactive' | 'mixed';
  status: 'active' | 'draft' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleResource {
  id: string;
  module_id: string;
  title: string;
  description: string;
  resource_type: 'video' | 'document' | 'link' | 'quiz' | 'interactive';
  resource_url: string;
  file_path: string;
  duration_minutes: number;
  is_required: boolean;
  order_index: number;
  created_at: string;
}

export interface ModuleQuiz {
  id: string;
  module_id: string;
  title: string;
  description: string;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number;
  is_required: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserModuleProgress {
  id: string;
  user_id: string;
  module_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progress_percentage: number;
  started_at: string;
  completed_at: string;
  last_accessed_at: string;
  total_time_spent_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  document_requirement_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  status: 'uploaded' | 'under_review' | 'approved' | 'rejected';
  reviewed_by: string;
  reviewed_at: string;
  review_comments: string;
  uploaded_at: string;
  created_at: string;
}

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  document_type: string;
  is_mandatory: boolean;
  target_roles: string[];
  target_departments: string[];
  file_format_restrictions: string[];
  max_file_size_mb: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

// Policy Management Types
export interface Policy {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  version: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  permissions?: PolicyPermission[];
  can_read?: boolean;
  can_write?: boolean;
  can_delete?: boolean;
}

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version: number;
  name: string;
  content: string;
  created_by?: string;
  created_at: string;
}

export interface PolicyPermission {
  id: string;
  policy_id: string;
  user_id?: string;
  role?: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  granted_by?: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  user?: User;
}

export interface PolicyAccessLog {
  id: string;
  policy_id: string;
  user_id: string;
  action: 'read' | 'write' | 'delete' | 'create';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  // Computed fields
  policy?: Policy;
  user?: User;
}

// Policy Editor Types
export interface PolicyEditorState {
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  error?: string;
}

export interface PolicyFormData {
  name: string;
  content: string;
  is_active: boolean;
}

export interface PolicyPermissionFormData {
  policy_id: string;
  user_id?: string;
  role?: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

// Policy Dashboard Types
export interface PolicyDashboardStats {
  total_policies: number;
  active_policies: number;
  recent_updates: number;
  user_accessible_policies: number;
}

export interface PolicySearchFilters {
  is_active?: boolean;
  search_term?: string;
  created_by?: string;
  date_range?: {
    start: string;
    end: string;
  };
}