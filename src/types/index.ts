export interface User {
  id: string;
  auth_provider: 'microsoft' | 'google' | 'manual';
  provider_user_id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  employee_id?: string;
  role_id: string;
  department_id?: string;
  position?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  date_of_joining?: string;
  company_email?: string;
  salary?: number;
  extra_permissions: Record<string, any>;
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  last_login?: string;
  avatar_url?: string;
  signup_data?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  default_dashboards: string[];
  permissions: Record<string, boolean>;
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
  leave_type: 'sick' | 'casual' | 'annual' | 'maternity' | 'paternity' | 'emergency';
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
  approved_by?: string;
  approved_at?: string;
  comments?: string;
}

export interface Complaint {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: 'harassment' | 'discrimination' | 'workplace' | 'management' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  assigned_to?: string;
  resolution?: string;
  resolved_at?: string;
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
  status: 'submitted' | 'under_review' | 'contacted' | 'hired' | 'rejected';
  created_at: string;
  updated_at: string;
}