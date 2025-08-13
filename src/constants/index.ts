export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR: 'hr',
  SDM: 'sdm',
  BDM: 'bdm',
  QAM: 'qam',
  EMPLOYEE: 'employee',
  CANDIDATE: 'candidate',
  EX_EMPLOYEE: 'ex_employee'
} as const;

export const DASHBOARDS = {
  SELF: 'self',
  EMPLOYEE_MANAGEMENT: 'employee_management',
  PERFORMANCE: 'performance',
  GRIEVANCE: 'grievance',
  BD_TEAM: 'bd_team',
  FINANCE: 'finance',
  ATS: 'ats',
  LMS: 'lms',
  EXIT: 'exit'
} as const;

export const DASHBOARD_CONFIG = [
  {
    id: DASHBOARDS.SELF,
    name: 'My Dashboard',
    slug: 'dashboard',
    description: 'Personal employee dashboard',
    icon: 'User',
    color: 'bg-blue-500',
    pages: [
      { id: 'overview', name: 'Overview', slug: 'overview', path: '/dashboard', icon: 'Home' },
      { id: 'leave', name: 'Leave Application', slug: 'leave', path: '/dashboard/leave', icon: 'Calendar' },
      { id: 'documents', name: 'Documents', slug: 'documents', path: '/dashboard/documents', icon: 'FileText' },
      { id: 'complaints', name: 'Complaints', slug: 'complaints', path: '/dashboard/complaints', icon: 'MessageSquare' },
      { id: 'performance', name: 'Performance', slug: 'performance', path: '/dashboard/performance', icon: 'Target' },
      { id: 'referrals', name: 'Refer Someone', slug: 'referrals', path: '/dashboard/referrals', icon: 'UserPlus' },
      { id: 'settings', name: 'Settings', slug: 'settings', path: '/dashboard/settings', icon: 'Settings' }
    ]
  },
  {
    id: DASHBOARDS.EMPLOYEE_MANAGEMENT,
    name: 'Employee Management',
    slug: 'employees',
    description: 'Manage employee data and processes',
    icon: 'Users',
    color: 'bg-green-500',
    pages: [
      { id: 'list', name: 'Employee List', slug: 'list', path: '/employees', icon: 'Users' },
      { id: 'assets', name: 'Asset Management', slug: 'assets', path: '/employees/assets', icon: 'Package' },
      { id: 'referrals', name: 'Referral Dashboard', slug: 'referrals', path: '/employees/referrals', icon: 'UserPlus' },
      { id: 'exit', name: 'Exit Process', slug: 'exit', path: '/employees/exit', icon: 'LogOut' }
    ]
  },
  {
    id: DASHBOARDS.PERFORMANCE,
    name: 'Performance Management',
    slug: 'performance',
    description: 'Track and manage employee performance',
    icon: 'Target',
    color: 'bg-purple-500',
    pages: [
      { id: 'overview', name: 'Overview', slug: 'overview', path: '/performance', icon: 'BarChart3' },
      { id: 'goals', name: 'Goals', slug: 'goals', path: '/performance/goals', icon: 'Target' },
      { id: 'evaluations', name: 'Evaluations', slug: 'evaluations', path: '/performance/evaluations', icon: 'ClipboardCheck' },
      { id: 'appraisals', name: 'Appraisals', slug: 'appraisals', path: '/performance/appraisals', icon: 'Award' },
      { id: 'feedback', name: 'Feedback', slug: 'feedback', path: '/performance/feedback', icon: 'MessageCircle' }
    ]
  },
  {
    id: DASHBOARDS.GRIEVANCE,
    name: 'Grievance Management',
    slug: 'grievance',
    description: 'Handle employee complaints and grievances',
    icon: 'AlertTriangle',
    color: 'bg-red-500',
    pages: [
      { id: 'active', name: 'Active Complaints', slug: 'active', path: '/grievance', icon: 'AlertCircle' },
      { id: 'all', name: 'All Complaints', slug: 'all', path: '/grievance/all', icon: 'List' }
    ]
  },
  {
    id: DASHBOARDS.BD_TEAM,
    name: 'BD Team Dashboard',
    slug: 'bd',
    description: 'Business development operations',
    icon: 'TrendingUp',
    color: 'bg-orange-500',
    pages: [
      { id: 'overview', name: 'Dashboard', slug: 'overview', path: '/bd', icon: 'BarChart3' },
      { id: 'billing', name: 'All Billings', slug: 'billing', path: '/bd/billing', icon: 'Receipt' },
      { id: 'invoices', name: 'All Invoices', slug: 'invoices', path: '/bd/invoices', icon: 'FileText' },
      { id: 'logs', name: 'Billing Logs', slug: 'logs', path: '/bd/logs', icon: 'History' }
    ]
  },
  {
    id: DASHBOARDS.FINANCE,
    name: 'Finance Dashboard',
    slug: 'finance',
    description: 'Financial operations and payroll',
    icon: 'DollarSign',
    color: 'bg-emerald-500',
    pages: [
      { id: 'overview', name: 'Dashboard', slug: 'overview', path: '/finance', icon: 'BarChart3' },
      { id: 'payroll', name: 'Payroll', slug: 'payroll', path: '/finance/payroll', icon: 'Banknote' },
      { id: 'billing', name: 'Billing', slug: 'billing', path: '/finance/billing', icon: 'Receipt' }
    ]
  },
  {
    id: DASHBOARDS.ATS,
    name: 'Application Tracking',
    slug: 'ats',
    description: 'Recruitment and candidate management',
    icon: 'UserCheck',
    color: 'bg-indigo-500',
    pages: [
      { id: 'overview', name: 'Dashboard', slug: 'overview', path: '/ats', icon: 'BarChart3' },
      { id: 'candidates', name: 'Candidates', slug: 'candidates', path: '/ats/candidates', icon: 'Users' },
      { id: 'assessment', name: 'Assessment', slug: 'assessment', path: '/ats/assessment', icon: 'Code' },
      { id: 'questions', name: 'Question Bank', slug: 'questions', path: '/ats/questions', icon: 'HelpCircle' }
    ]
  },
  {
    id: DASHBOARDS.LMS,
    name: 'Learning Management',
    slug: 'lms',
    description: 'Training and development',
    icon: 'GraduationCap',
    color: 'bg-cyan-500',
    pages: [
      { id: 'overview', name: 'Dashboard', slug: 'overview', path: '/lms', icon: 'BarChart3' },
      { id: 'prerequisites', name: 'Prerequisites', slug: 'prerequisites', path: '/lms/prerequisites', icon: 'BookOpen' },
      { id: 'documents', name: 'Documents', slug: 'documents', path: '/lms/documents', icon: 'Upload' },
      { id: 'candidates', name: 'All Candidates', slug: 'candidates', path: '/lms/candidates', icon: 'Users' }
    ]
  },
  {
    id: DASHBOARDS.EXIT,
    name: 'Exit Dashboard',
    slug: 'exit',
    description: 'Employee exit process',
    icon: 'LogOut',
    color: 'bg-gray-500',
    pages: [
      { id: 'overview', name: 'Dashboard', slug: 'overview', path: '/exit', icon: 'BarChart3' },
      { id: 'documents', name: 'Documents', slug: 'documents', path: '/exit/documents', icon: 'FileText' },
      { id: 'clearance', name: 'Clearance', slug: 'clearance', path: '/exit/clearance', icon: 'CheckSquare' },
      { id: 'interview', name: 'Exit Interview', slug: 'interview', path: '/exit/interview', icon: 'MessageSquare' }
    ]
  }
];

export const ROLE_DASHBOARD_MAPPING = {
  [ROLES.SUPER_ADMIN]: Object.values(DASHBOARDS),
  [ROLES.ADMIN]: Object.values(DASHBOARDS),
  [ROLES.HR]: [DASHBOARDS.SELF, DASHBOARDS.ATS, DASHBOARDS.GRIEVANCE, DASHBOARDS.EMPLOYEE_MANAGEMENT, DASHBOARDS.PERFORMANCE],
  [ROLES.SDM]: [DASHBOARDS.SELF, DASHBOARDS.PERFORMANCE, DASHBOARDS.LMS],
  [ROLES.BDM]: [DASHBOARDS.SELF, DASHBOARDS.PERFORMANCE, DASHBOARDS.LMS, DASHBOARDS.BD_TEAM],
  [ROLES.QAM]: [DASHBOARDS.SELF, DASHBOARDS.PERFORMANCE, DASHBOARDS.LMS],
  [ROLES.EMPLOYEE]: [DASHBOARDS.SELF],
  [ROLES.CANDIDATE]: [DASHBOARDS.ATS, DASHBOARDS.LMS],
  [ROLES.EX_EMPLOYEE]: [DASHBOARDS.EXIT]
};

export const AUTH_PROVIDERS = {
  MICROSOFT: 'microsoft',
  GOOGLE: 'google',
  MANUAL: 'manual'
} as const;

export const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'casual', label: 'Casual Leave' },
  { value: 'annual', label: 'Annual Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'emergency', label: 'Emergency Leave' }
];

export const COMPLAINT_CATEGORIES = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'discrimination', label: 'Discrimination' },
  { value: 'workplace', label: 'Workplace Environment' },
  { value: 'management', label: 'Management Issues' },
  { value: 'other', label: 'Other' }
];

export const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

export const CONTRACT_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'milestone', label: 'Milestone-based' }
];

export const BILLING_CYCLES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' }
];

export const PAYMENT_TERMS = [
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'custom', label: 'Custom' }
];

export const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' }
];