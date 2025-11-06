// Dashboard Configuration
export const DASHBOARDS = {
  SELF: 'self',
  EMPLOYEE_MANAGEMENT: 'employee_management',
  PERFORMANCE: 'performance',
  GRIEVANCE: 'grievance',
  BD_TEAM: 'bd_team',
  FINANCE: 'finance',
  ATS: 'ats',
  LMS: 'lms',
  EXIT: 'exit',
  POLICIES: 'policies',
} as const;

// Role Constants
export const ROLES = {
  // SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR: 'hr',
  HRM: 'hrm',
  SDM: 'sdm',
  BDM: 'bdm',
  QAM: 'qam',
  EMPLOYEE: 'employee',
  EX_EMPLOYEE: 'ex_employee',
  CANDIDATE: 'candidate',
  FINANCE: 'finance',
  FINANCE_MANAGER: 'finance_manager',
} as const;

// Role Name Maps
export const roleNameMap = {
  // super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  hrm: "HR Manager",
  sdm: "SD Manager",
  bdm: "BD Manager",
  qam: "QA Manager",
  employee: "Employee",
  ex_employee: "Ex-Employee",
  candidate: "Candidate",
  finance: "Finance",
  finance_manager: "Finance Manager",
} as const;

export const getRoleDisplayName = (role: string) => {
  return roleNameMap[role as keyof typeof roleNameMap];
};

// Dashboard Configuration
export const DASHBOARD_CONFIG = [
  {
    id: 'self',
    name: 'My Dashboard',
    slug: 'dashboard',
    description: 'Personal dashboard with your information',
    icon: 'UserIcon',
    color: 'blue',
    pages: [
      { id: 'overview', name: 'Overview', slug: 'overview', path: '/dashboard', icon: 'Home' },
      { id: 'leave', name: 'Leave Application', slug: 'leave', path: '/dashboard/leave', icon: 'Calendar' },
      { id: 'assets', name: 'My Assets', slug: 'assets', path: '/dashboard/assets', icon: 'Package' },
      { id: 'documents', name: 'Documents', slug: 'documents', path: '/dashboard/documents', icon: 'FileText' },
      { id: 'policies', name: 'Policies', slug: 'policies', path: '/dashboard/policies', icon: 'Shield' },
      // { id: 'complaints', name: 'Complaints', slug: 'complaints', path: '/dashboard/complaints', icon: 'MessageSquare' },
      { id: 'performance', name: 'Performance', slug: 'performance', path: '/dashboard/performance', icon: 'Target' },
      { id: 'feedback', name: 'HRMS Feedback', slug: 'feedback', path: '/dashboard/feedback', icon: 'MessageSquare' },
      // { id: 'referrals', name: 'Refer Someone', slug: 'referrals', path: '/dashboard/referrals', icon: 'UserPlus' },
      { id: 'settings', name: 'Settings', slug: 'settings', path: '/dashboard/settings', icon: 'Settings' },
    ],
  },
  {
    id: 'employee_management',
    name: 'Employee Management',
    slug: 'employees',
    description: 'Manage employee information and records',
    icon: 'Users',
    color: 'green',
    pages: [
      { id: 'overview', name: 'All Employees', slug: 'overview', path: '/employees', icon: 'Users' },
      { id: 'assets', name: 'Asset Management', slug: 'assets', path: '/employees/assets', icon: 'Package' },
      { id: 'leave', name: 'Leave Management', slug: 'leave', path: '/employees/leave', icon: 'Calendar' },
      // { id: 'referrals', name: 'Referral Dashboard', slug: 'referrals', path: '/employees/referrals', icon: 'UserPlus' },
      // { id: 'exit', name: 'Exit Process', slug: 'exit', path: '/employees/exit', icon: 'LogOut' },
      // { id: 'attendance', name: 'Attendance Reports', slug: 'attendance', path: '/employees/attendance', icon: 'Clock' },
      // { id: 'projects', name: 'Project Management', slug: 'projects', path: '/employees/projects', icon: 'Building' },
      { id: 'feedback', name: 'HRMS Feedback', slug: 'feedback', path: '/employees/feedback', icon: 'MessageSquare' },
    ],
  },
  {
    id: 'performance',
    name: 'Performance Management',
    slug: 'performance',
    description: 'Track and manage performance metrics',
    icon: 'Target',
    color: 'purple',
    pages: [
      { id: 'overview', name: 'Performance Overview', slug: 'overview', path: '/performance', icon: 'Target' },
      // { id: 'goals', name: 'Goals Management', slug: 'goals', path: '/performance/goals', icon: 'Target' },
      // { id: 'evaluations', name: 'Evaluations', slug: 'evaluations', path: '/performance/evaluations', icon: 'BarChart3' },
      // { id: 'feedback', name: 'Feedback', slug: 'feedback', path: '/performance/feedback', icon: 'MessageCircle' },
      { id: 'KRA', name: 'KRA', slug: 'kra', path: '/performance/kra', icon: 'SquareChartGantt' },
      // { id: 'appraisals', name: 'Appraisals', slug: 'appraisals', path: '/performance/appraisals', icon: 'BanknoteArrowUp' },
    ],
  },
  // {
  //   id: 'grievance',
  //   name: 'Grievance Management',
  //   slug: 'grievance',
  //   description: 'Handle employee complaints and grievances',
  //   icon: 'AlertTriangle',
  //   color: 'red',
  //   pages: [
  //     { id: 'overview', name: 'Grievance Dashboard', slug: 'overview', path: '/grievance', icon: 'AlertTriangle' },
  //     { id: 'all', name: 'All Complaints', slug: 'all', path: '/grievance/all', icon: 'List' },
  //   ],
  // },
  // {
  //   id: 'bd_team',
  //   name: 'BD Team',
  //   slug: 'bd',
  //   description: 'Business development and client management',
  //   icon: 'TrendingUp',
  //   color: 'indigo',
  //   pages: [
  //     { id: 'overview', name: 'BD Dashboard', slug: 'overview', path: '/bd', icon: 'TrendingUp' },
  //     { id: 'billing', name: 'All Billings', slug: 'billing', path: '/bd/billing', icon: 'Receipt' },
  //     { id: 'invoices', name: 'All Invoices', slug: 'invoices', path: '/bd/invoices', icon: 'FileText' },
  //     { id: 'logs', name: 'Billing Logs', slug: 'logs', path: '/bd/logs', icon: 'History' },
  //   ],
  // },
  {
    id: 'finance',
    name: 'Finance',
    slug: 'finance',
    description: 'Financial operations and payroll',
    icon: 'DollarSign',
    color: 'emerald',
    pages: [
      { id: 'overview', name: 'Finance Dashboard', slug: 'overview', path: '/finance', icon: 'DollarSign' },
      { id: 'payroll', name: 'All Payroll', slug: 'payroll', path: '/finance/payroll', icon: 'Banknote' },
      { id: 'billing', name: 'All Billing', slug: 'billing', path: '/finance/billing', icon: 'Receipt' },
      { id: 'logs', name: 'Payroll Logs', slug: 'logs', path: '/finance/logs', icon: 'History' },
    ],
  },
  // {
  //   id: 'ats',
  //   name: 'ATS',
  //   slug: 'ats',
  //   description: 'Applicant tracking system',
  //   icon: 'UserCheck',
  //   color: 'cyan',
  //   pages: [
  //     { id: 'overview', name: 'ATS Dashboard', slug: 'overview', path: '/ats', icon: 'UserCheck' },
  //     { id: 'candidates', name: 'Candidates List', slug: 'candidates', path: '/ats/candidates', icon: 'Users' },
  //     { id: 'assessment', name: 'Recruitment Assessment', slug: 'assessment', path: '/ats/assessment', icon: 'Code' },
  //     { id: 'questions', name: 'Question Bank', slug: 'questions', path: '/ats/questions', icon: 'HelpCircle' },
  //   ],
  // },
  // {
  //   id: 'lms',
  //   name: 'LMS',
  //   slug: 'lms',
  //   description: 'Learning management system',
  //   icon: 'GraduationCap',
  //   color: 'violet',
  //   pages: [
  //     { id: 'overview', name: 'LMS Dashboard', slug: 'overview', path: '/lms', icon: 'GraduationCap' },
  //     { id: 'prerequisites', name: 'Prerequisites', slug: 'prerequisites', path: '/lms/prerequisites', icon: 'BookOpen' },
  //     { id: 'documents', name: 'Document Upload', slug: 'documents', path: '/lms/documents', icon: 'Upload' },
  //     { id: 'candidates', name: 'All Candidates', slug: 'candidates', path: '/lms/candidates', icon: 'Users' },
  //   ],
  // },
  // {
  //   id: 'exit',
  //   name: 'Exit Management',
  //   slug: 'exit',
  //   description: 'Employee exit process management',
  //   icon: 'LogOut',
  //   color: 'gray',
  //   pages: [
  //     { id: 'overview', name: 'Exit Dashboard', slug: 'overview', path: '/exit', icon: 'LogOut' },
  //     { id: 'documents', name: 'Exit Documents', slug: 'documents', path: '/exit/documents', icon: 'FileText' },
  //     { id: 'clearance', name: 'Exit Clearance', slug: 'clearance', path: '/exit/clearance', icon: 'ClipboardCheck' },
  //     { id: 'interview', name: 'Exit Interview', slug: 'interview', path: '/exit/interview', icon: 'MessageSquare' },
  //   ],
  // },
  {
    id: 'policies',
    name: 'Policies',
    slug: 'policies',
    description: 'Manage organizational policies and access permissions',
    icon: 'Shield',
    color: 'blue',
    pages: [
      { id: 'all-policies', name: 'All Policies', slug: 'all-policies', path: '/policies', icon: 'FileText' },
      { id: 'assign', name: 'Assign Policies', slug: 'assign', path: '/policies/assign', icon: 'Send' },
      { id: 'history', name: 'History', slug: 'history', path: '/policies/history', icon: 'History' },
      { id: 'logs', name: 'Activity Logs', slug: 'logs', path: '/policies/logs', icon: 'BarChart3' },
      // { id: 'permissions', name: 'Permissions', slug: 'permissions', path: '/policies/permissions', icon: 'Settings' },
    ],
  },
];

// Role to Dashboard Mapping
export const ROLE_DASHBOARD_MAPPING = {
  [ROLES.ADMIN]: Object.values(DASHBOARDS),
  [ROLES.HR]: [
    DASHBOARDS.SELF,
    DASHBOARDS.EMPLOYEE_MANAGEMENT,
    DASHBOARDS.GRIEVANCE,
    DASHBOARDS.ATS,
    DASHBOARDS.LMS,
    DASHBOARDS.EXIT,
    DASHBOARDS.POLICIES,
  ],
  [ROLES.HRM]: [
    DASHBOARDS.SELF,
    DASHBOARDS.EMPLOYEE_MANAGEMENT,
    DASHBOARDS.GRIEVANCE,
    DASHBOARDS.ATS,
    DASHBOARDS.LMS,
    DASHBOARDS.EXIT,
    DASHBOARDS.POLICIES,
  ],
  [ROLES.SDM]: [
    DASHBOARDS.SELF,
    DASHBOARDS.EMPLOYEE_MANAGEMENT,
    DASHBOARDS.PERFORMANCE,
    DASHBOARDS.GRIEVANCE,
  ],
  [ROLES.BDM]: [
    DASHBOARDS.SELF,
    DASHBOARDS.BD_TEAM,
    DASHBOARDS.GRIEVANCE,
  ],
  [ROLES.QAM]: [
    DASHBOARDS.SELF,
    DASHBOARDS.EMPLOYEE_MANAGEMENT,
    DASHBOARDS.PERFORMANCE,
    DASHBOARDS.GRIEVANCE,
  ],
  [ROLES.FINANCE]: [
    DASHBOARDS.SELF,
    DASHBOARDS.FINANCE,
    DASHBOARDS.EMPLOYEE_MANAGEMENT,
  ],
  [ROLES.FINANCE_MANAGER]: [
    DASHBOARDS.SELF,
    DASHBOARDS.FINANCE,
    DASHBOARDS.EMPLOYEE_MANAGEMENT,
  ],
  [ROLES.EMPLOYEE]: [
    DASHBOARDS.SELF,
  ],
  [ROLES.EX_EMPLOYEE]: [
    DASHBOARDS.SELF,
    DASHBOARDS.EXIT,
  ],
  [ROLES.CANDIDATE]: [
    DASHBOARDS.SELF,
    DASHBOARDS.ATS,
    DASHBOARDS.LMS,
  ],
} as const;

// Contract Types for Billing
export const CONTRACT_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'milestone', label: 'Milestone Based' },
];

// Billing Cycles
export const BILLING_CYCLES = [
  { value: 'one_time', label: 'One Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
];

// Payment Terms
export const PAYMENT_TERMS = [
  { value: 'net_15', label: 'Net 15 Days' },
  { value: 'net_30', label: 'Net 30 Days' },
  { value: 'custom', label: 'Custom Terms' },
];

// Currencies
export const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

// Complaint Status Flow
export const COMPLAINT_STATUS_FLOW = {
  SUBMITTED: 'open',           // Employee submits complaint
  APPROVED: 'approved',        // Manager approves complaint
  REJECTED: 'rejected',        // Manager rejects complaint
  ASSIGNED: 'in_progress',     // Complaint assigned to resolver
  RESOLVED: 'resolved',        // Resolver marks as resolved
  CLOSED: 'closed',           // Final closure
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  COMPLAINT_SUBMITTED: 'complaint_submitted',
  COMPLAINT_APPROVED: 'complaint_approved',
  COMPLAINT_REJECTED: 'complaint_rejected',
  COMPLAINT_ASSIGNED: 'complaint_assigned',
  COMPLAINT_REASSIGNED: 'complaint_reassigned',
  COMPLAINT_RESOLVED: 'complaint_resolved',
  LEAVE_REQUEST_SUBMITTED: 'leave_request_submitted',
  LEAVE_REQUEST_APPROVED: 'leave_request_approved',
  LEAVE_REQUEST_REJECTED: 'leave_request_rejected',
  LEAVE_REQUEST_WITHDRAWN: 'leave_request_withdrawn',
  PROJECT_ASSIGNED: 'project_assigned',
  PROJECT_UNASSIGNED: 'project_unassigned',
  PROJECT_ROLE_UPDATED: 'project_role_updated',
  PROJECT_DELETED: 'project_deleted',
  POLICY_ASSIGNED: 'policy_assigned',
  POLICY_ACKNOWLEDGED: 'policy_acknowledged',
} as const;