import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { 
  useDocumentTypes, 
  useEmployeeDocuments, 
  useUploadEmployeeDocument, 
  useRequestEmployeeDocument, 
  useDeleteEmployeeDocument, 
  useCreateDocumentType,
  useUpdateDocumentType
} from '@/hooks/useEmployeeDocuments';
import { 
  useWorkExperience,
  useCreateWorkExperience,
  useUpdateWorkExperience,
  useDeleteWorkExperience,
  useUploadWorkExperienceAttachment,
  useRemoveWorkExperienceAttachment
} from '@/hooks/useWorkExperience';
import {
  useEmployeeIncidents,
  useCreateIncident,
  useUpdateIncident,
  useDeleteIncident,
  useUploadIncidentAttachment,
  useUploadIncidentAttachments,
  useRemoveIncidentAttachment
} from '@/hooks/useEmployeeIncidents';
import { getRoleDisplayName } from '@/constants/index';
import { IncidentsView } from './IncidentsView';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import {
  Check,
  ChevronsUpDown,
  Users,
  Phone,
  Building,
  UserCheck,
  IndianRupee,
  FileText,
  Upload,
  Download,
  Trash2,
  Send,
  Plus,
  Eye,
  AlertTriangle,
  X,
  Pencil,
  XCircle,
  Calendar
} from 'lucide-react';

const employeeSchema = z.object({
  id: z.string().uuid('Invalid employee ID'),
  full_name: z.string().min(1, 'Full name is required'),
  employee_id: z.string().optional(),
  email: z.string().email('Invalid email address'),
  company_email: z.string().optional(),
  personal_email: z.string().optional(),
  phone: z.string().optional(),
  alternate_contact_no: z.string().optional(),
  position: z.string().optional(),
  designation_offer_letter: z.string().optional(),
  salary: z.number().min(0, 'Salary must be positive').optional(),
  address: z.string().optional(),
  permanent_address: z.string().optional(),
  date_of_birth: z.string().optional(),
  date_of_joining: z
    .string()
    .min(1, 'Date of joining is required')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
  role_id: z.string().optional(),
  additional_role_ids: z.array(z.string()).optional(),
  department_id: z.string().optional(),
  manager_id: z.string().optional(),
  status: z.string().optional(),
  level_grade: z.string().optional(),
  skill: z.array(z.string()).optional(),
  current_office_location: z.string().optional(),
  blood_group: z.string().optional(),
  religion: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  date_of_marriage_anniversary: z.string().optional(),
  father_name: z.string().optional(),
  father_dob: z.string().optional(),
  mother_name: z.string().optional(),
  mother_dob: z.string().optional(),
  aadhar_card_no: z.string().optional(),
  pan_no: z.string().optional(),
  bank_account_no: z.string().optional(),
  ifsc_code: z.string().optional(),
  qualification: z.string().optional(),
  employment_terms: z.enum(['part_time', 'full_time', 'associate', 'contract', 'probation/internship']).optional(),
  comp_off_balance: z.number().min(0, 'Comp off balance must be positive').optional(),
  // New onboarding fields
  appointment_formalities: z.enum(['Done', 'Not Done']).optional(),
  orientation: z.enum(['Done', 'Not Done']).optional(),
  order_id_card: z.enum(['Yes', 'No']).optional(),
  // Accounts Created Group
  email_account: z.enum(['Yes', 'No', 'N/A']).optional(),
  skype_account: z.enum(['Yes', 'No', 'N/A']).optional(),
  system_account: z.enum(['Yes', 'No', 'N/A']).optional(),
  // Access & Tools Group
  added_to_mailing_list: z.enum(['Yes', 'No']).optional(),
  added_to_attendance_sheet: z.enum(['Yes', 'No']).optional(),
  confluence_info_provided: z.enum(['Yes', 'No']).optional(),
  id_card_provided: z.enum(['Yes', 'No', 'N/A']).optional(),
  // Additional Fields
  remarks: z.string().optional(),
  uan_number: z.string().optional(),
  is_experienced: z.enum(['Yes', 'No']).optional(),
  // Salary Annexure fields
  pf_applicable: z.boolean().optional(),
  esi_applicable: z.boolean().optional(),
  monthly_ctc: z.string().optional(),
  monthly_basic_pay: z.string().optional(),
  hra: z.string().optional(),
  night_allowance: z.string().optional(),
  special_allowance: z.string().optional(),
  monthly_gross: z.string().optional(),
  employer_pf: z.string().optional(),
  employer_esi: z.string().optional(),
  monthly_gratuity_provision: z.string().optional(),
  monthly_bonus_provision: z.string().optional(),
  group_medical_insurance: z.string().optional(),
  pf_employee: z.string().optional(),
  esi_employee: z.string().optional(),
  tds: z.string().optional(),
  professional_tax: z.string().optional(),
  total_deductions: z.string().optional(),
  net_pay: z.string().optional(),
  monthly_take_home_salary: z.string().optional(),
  // Loyalty Bonus fields
  loyalty_bonus_enrollment_date: z.string().optional(),
  loyalty_bonus_specific_condition: z.string().optional(),
  loyalty_bonus_tenure_period: z.string().optional(),
  loyalty_bonus_amount: z.string().optional(),
  loyalty_bonus_installment_1_amount: z.string().optional(),
  loyalty_bonus_installment_2_amount: z.string().optional(),
  loyalty_bonus_installment_3_amount: z.string().optional(),
  loyalty_bonus_installment_4_amount: z.string().optional(),
  loyalty_bonus_installment_5_amount: z.string().optional(),
  loyalty_bonus_installment_6_amount: z.string().optional(),
  loyalty_bonus_installment_1_date: z.string().optional(),
  loyalty_bonus_installment_2_date: z.string().optional(),
  loyalty_bonus_installment_3_date: z.string().optional(),
  loyalty_bonus_installment_4_date: z.string().optional(),
  loyalty_bonus_installment_5_date: z.string().optional(),
  loyalty_bonus_installment_6_date: z.string().optional(),
  loyalty_bonus_installment_1_disbursed: z.boolean().optional(),
  loyalty_bonus_installment_2_disbursed: z.boolean().optional(),
  loyalty_bonus_installment_3_disbursed: z.boolean().optional(),
  loyalty_bonus_installment_4_disbursed: z.boolean().optional(),
  loyalty_bonus_installment_5_disbursed: z.boolean().optional(),
  loyalty_bonus_installment_6_disbursed: z.boolean().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
  email: string;
  company_email?: string;
  personal_email?: string;
  phone?: string;
  position?: string;
  department?: { name: string };
  role?: { name: string };
  role_id?: string;
  status: string;
  avatar_url?: string;
  auth_provider?: 'microsoft' | 'google' | 'manual';
  provider_user_id?: string;
  extra_permissions?: {
    dashboards?: Record<string, boolean>;
    pages?: Record<string, Record<string, boolean>>;
    [key: string]: any;
  };
  created_at?: string;
  [key: string]: any;
}

interface EmployeeDetailsModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'edit';
  onModeChange?: (mode: 'view' | 'edit') => void;
}

export function EmployeeDetailsModal({ 
  employee, 
  isOpen, 
  onClose, 
  mode, 
  onModeChange 
}: EmployeeDetailsModalProps) {
  const { user, refreshUserRoles } = useAuth();
  const permissions = useEmployeePermissions();
  const updateEmployee = useUpdateEmployee();
  const [activeTab, setActiveTab] = useState('basic');
  const [newDocumentType, setNewDocumentType] = useState('');
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Document-related hooks
  const { data: documentTypes } = useDocumentTypes(employee?.id);
  const { data: employeeDocuments } = useEmployeeDocuments(employee?.id || '');
  const uploadDocument = useUploadEmployeeDocument();
  const requestDocument = useRequestEmployeeDocument();
  const deleteDocument = useDeleteEmployeeDocument();
  const createDocumentType = useCreateDocumentType();
  const updateDocumentType = useUpdateDocumentType();

  // Incident-related hooks
  const { data: employeeIncidents } = useEmployeeIncidents(employee?.id || '');
  const createIncidentMutation = useCreateIncident();
  const updateIncidentMutation = useUpdateIncident();
  const deleteIncidentMutation = useDeleteIncident();
  const uploadIncidentAttachmentMutation = useUploadIncidentAttachment();
  const uploadIncidentAttachmentsMutation = useUploadIncidentAttachments();
  const removeIncidentAttachmentMutation = useRemoveIncidentAttachment();

  // Fetch employee's complete data including CTC fields from database
  const { data: completeEmployeeData, isLoading: isLoadingCompleteData } = useQuery({
    queryKey: ['employee-complete-data', employee?.id],
    queryFn: async () => {
      if (!employee?.id) {
        return null;
      }
      
      console.log('🔄 Fetching complete employee data from database...', {
        employee_id: employee.id
      });
      
      // Fetch complete employee data including all CTC fields
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          department:departments!users_department_id_fkey(id, name),
          role:roles!users_role_id_fkey(id, name)
        `)
        .eq('id', employee.id)
        .single();

      if (userError) {
        console.error('Failed to fetch complete employee data:', userError);
        throw userError;
      }

      console.log('📋 Complete employee data from DB:', {
        id: userData.id,
        name: userData.full_name,
        monthly_ctc: userData.monthly_ctc,
        pf_applicable: userData.pf_applicable,
        esi_applicable: userData.esi_applicable,
        monthly_basic_pay: userData.monthly_basic_pay,
        total_deductions: userData.total_deductions
      });

      // If user has additional role IDs, fetch the role details
      let additionalRoles: any[] = [];
      if (userData.additional_role_ids && userData.additional_role_ids.length > 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('id, name, description')
          .in('id', userData.additional_role_ids);

        if (rolesError) {
          console.error('Failed to fetch role details:', rolesError);
        } else {
          additionalRoles = rolesData || [];
          console.log('✅ Additional roles fetched:', rolesData?.map((r: any) => r.name));
        }
      }

      return {
        ...userData,
        additional_roles: additionalRoles
      };
    },
    enabled: !!employee?.id && isOpen,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // For backward compatibility, also provide the additional roles data separately
  const additionalRolesData = React.useMemo(() => {
    if (!completeEmployeeData) {
      return { additional_role_ids: [], additional_roles: [] };
    }
    
    return {
      additional_role_ids: completeEmployeeData.additional_role_ids || [],
      additional_roles: completeEmployeeData.additional_roles || []
    };
  }, [completeEmployeeData]);

  const isLoadingAdditionalRoles = isLoadingCompleteData;

  // Use complete employee data from database, fallback to prop data
  const employeeData = React.useMemo(() => {
    // If we have complete data from database, use it (includes all CTC fields)
    if (completeEmployeeData) {
      console.log('✅ Using complete employee data from database');
      return completeEmployeeData;
    }
    
    // Fallback to the employee prop (may be missing CTC fields)
    if (employee) {
      console.log('⚠️ Using employee prop data (may be missing CTC fields)');
      // If we have additional roles data, merge it with employee data
      if (additionalRolesData) {
        return {
          ...employee,
          additional_role_ids: additionalRolesData.additional_role_ids,
          additional_roles: additionalRolesData.additional_roles
        };
      }
      return employee;
    }
    
    return null;
  }, [completeEmployeeData, employee, additionalRolesData]);

  // Get departments, roles, and users for dropdowns
  const { data: departmentOptions } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: roleOptions } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: userOptions } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    shouldUnregister: false, // Keep field values when components unmount/remount
    defaultValues: {
      id: '',
      full_name: '',
      employee_id: '',
      email: '',
      company_email: '',
      personal_email: '',
      phone: '',
      alternate_contact_no: '',
      position: '',
      designation_offer_letter: '',
      salary: 0,
      comp_off_balance: 0,
      address: '',
      permanent_address: '',
      date_of_birth: '',
      date_of_joining: '',
      role_id: '',
      additional_role_ids: [],
      department_id: '',
      manager_id: 'none',
      status: 'active',
      level_grade: '',
      skill: [],
      current_office_location: '',
      blood_group: '',
      religion: '',
      gender: undefined,
      marital_status: undefined,
      date_of_marriage_anniversary: '',
      father_name: '',
      father_dob: '',
      mother_name: '',
      mother_dob: '',
      aadhar_card_no: '',
      pan_no: '',
      bank_account_no: '',
      ifsc_code: '',
      qualification: '',
      employment_terms: 'full_time',
      // Salary Annexure fields
      pf_applicable: false,
      esi_applicable: false,
      monthly_ctc: '',
      monthly_basic_pay: '',
      hra: '',
      night_allowance: '2000',
      special_allowance: '',
      monthly_gross: '',
      employer_pf: '',
      employer_esi: '',
      monthly_gratuity_provision: '',
      monthly_bonus_provision: '',
      group_medical_insurance: '138',
      pf_employee: '',
      esi_employee: '',
      tds: '',
      professional_tax: '200',
      total_deductions: '',
      net_pay: '',
      monthly_take_home_salary: '',
      // Loyalty Bonus fields
      loyalty_bonus_enrollment_date: '',
      loyalty_bonus_specific_condition: '',
      loyalty_bonus_tenure_period: '3',
      loyalty_bonus_amount: '',
      loyalty_bonus_installment_1_amount: '',
      loyalty_bonus_installment_2_amount: '',
      loyalty_bonus_installment_3_amount: '',
      loyalty_bonus_installment_4_amount: '',
      loyalty_bonus_installment_5_amount: '',
      loyalty_bonus_installment_6_amount: '',
      loyalty_bonus_installment_1_date: '',
      loyalty_bonus_installment_2_date: '',
      loyalty_bonus_installment_3_date: '',
      loyalty_bonus_installment_4_date: '',
      loyalty_bonus_installment_5_date: '',
      loyalty_bonus_installment_6_date: '',
      loyalty_bonus_installment_1_disbursed: false,
      loyalty_bonus_installment_2_disbursed: false,
      loyalty_bonus_installment_3_disbursed: false,
      loyalty_bonus_installment_4_disbursed: false,
      loyalty_bonus_installment_5_disbursed: false,
      loyalty_bonus_installment_6_disbursed: false,
    },
  });

  // Track previous employee and mode to reset form when needed
  const prevModeRef = React.useRef(mode);
  const prevEmployeeRef = React.useRef(employee?.id);
  const [originalFormValues, setOriginalFormValues] = React.useState<EmployeeFormData | null>(null);
  
  // Reset form when switching to edit mode OR when employee changes
  React.useEffect(() => {
    // Wait for complete employee data to load before initializing form
    if (isLoadingCompleteData) {
      console.log('⏳ Waiting for complete employee data to load...');
      return;
    }

    const currentEmployeeData = employeeData || employee;
    
    if (currentEmployeeData && mode === 'edit' && (prevModeRef.current !== 'edit' || prevEmployeeRef.current !== currentEmployeeData.id)) {
      console.log('🔄 Initializing form with employee data:', {
        id: currentEmployeeData.id,
        name: currentEmployeeData.full_name,
        additional_role_ids: currentEmployeeData.additional_role_ids,
        additional_roles: currentEmployeeData.additional_roles?.map((r: any) => r.name),
        employee_prop_has_additional_role_ids: !!employee?.additional_role_ids,
        employeeData_has_additional_role_ids: !!employeeData?.additional_role_ids,
        monthly_ctc: currentEmployeeData.monthly_ctc,
        monthly_basic_pay: currentEmployeeData.monthly_basic_pay,
        total_deductions: currentEmployeeData.total_deductions
      });
      
      const formData = {
        id: currentEmployeeData.id,
        full_name: currentEmployeeData.full_name,
        employee_id: currentEmployeeData.employee_id || '',
        email: currentEmployeeData.email,
        company_email: currentEmployeeData.company_email || '',
        personal_email: currentEmployeeData.personal_email || '',
        phone: currentEmployeeData.phone || '',
        alternate_contact_no: currentEmployeeData.alternate_contact_no || '',
        position: currentEmployeeData.position || '',
        designation_offer_letter: currentEmployeeData.designation_offer_letter || '',
        salary: currentEmployeeData.salary || 0,
        comp_off_balance: currentEmployeeData.comp_off_balance || 0,
        address: currentEmployeeData.address || '',
        permanent_address: currentEmployeeData.permanent_address || '',
        date_of_birth: currentEmployeeData.date_of_birth || '',
        date_of_joining: currentEmployeeData.date_of_joining || '',
        role_id: currentEmployeeData.role_id || '',
        additional_role_ids: currentEmployeeData.additional_role_ids || [],
        department_id: currentEmployeeData.department_id || '',
        manager_id: currentEmployeeData.manager_id || 'none',
        status: currentEmployeeData.status || 'active',
        level_grade: currentEmployeeData.level_grade || '',
        skill: currentEmployeeData.skill || [],
        current_office_location: currentEmployeeData.current_office_location || '',
        blood_group: currentEmployeeData.blood_group || '',
        religion: currentEmployeeData.religion || '',
        gender: currentEmployeeData.gender || undefined,
        marital_status: currentEmployeeData.marital_status || undefined,
        date_of_marriage_anniversary: currentEmployeeData.date_of_marriage_anniversary || '',
        father_name: currentEmployeeData.father_name || '',
        father_dob: currentEmployeeData.father_dob || '',
        mother_name: currentEmployeeData.mother_name || '',
        mother_dob: currentEmployeeData.mother_dob || '',
        aadhar_card_no: currentEmployeeData.aadhar_card_no || '',
        pan_no: currentEmployeeData.pan_no || '',
        bank_account_no: currentEmployeeData.bank_account_no || '',
        ifsc_code: currentEmployeeData.ifsc_code || '',
        qualification: currentEmployeeData.qualification || '',
        employment_terms: currentEmployeeData.employment_terms || 'full_time',
        // New onboarding fields
        appointment_formalities: currentEmployeeData.appointment_formalities || 'Not Done',
        orientation: currentEmployeeData.orientation || 'Not Done',
        order_id_card: currentEmployeeData.order_id_card || 'No',
        email_account: currentEmployeeData.email_account || 'N/A',
        skype_account: currentEmployeeData.skype_account || 'N/A',
        system_account: currentEmployeeData.system_account || 'N/A',
        added_to_mailing_list: currentEmployeeData.added_to_mailing_list || 'No',
        added_to_attendance_sheet: currentEmployeeData.added_to_attendance_sheet || 'No',
        confluence_info_provided: currentEmployeeData.confluence_info_provided || 'No',
        id_card_provided: currentEmployeeData.id_card_provided || 'N/A',
        remarks: currentEmployeeData.remarks || '',
        uan_number: currentEmployeeData.uan_number || '',
        is_experienced: currentEmployeeData.is_experienced || 'No',
        // Salary Annexure fields
        // Preserve existing values from database, use defaults only if null/undefined
        pf_applicable: currentEmployeeData.pf_applicable ?? false,
        esi_applicable: currentEmployeeData.esi_applicable ?? false,
        monthly_ctc: currentEmployeeData.monthly_ctc ?? '',
        monthly_basic_pay: currentEmployeeData.monthly_basic_pay ?? '',
        hra: currentEmployeeData.hra ?? '',
        night_allowance: currentEmployeeData.night_allowance ?? '2000',
        special_allowance: currentEmployeeData.special_allowance ?? '',
        monthly_gross: currentEmployeeData.monthly_gross ?? '',
        employer_pf: currentEmployeeData.employer_pf ?? '',
        employer_esi: currentEmployeeData.employer_esi ?? '',
        monthly_gratuity_provision: currentEmployeeData.monthly_gratuity_provision ?? '',
        monthly_bonus_provision: currentEmployeeData.monthly_bonus_provision ?? '',
        group_medical_insurance: currentEmployeeData.group_medical_insurance ?? '138',
        pf_employee: currentEmployeeData.pf_employee ?? '',
        esi_employee: currentEmployeeData.esi_employee ?? '',
        tds: currentEmployeeData.tds ?? '',
        professional_tax: currentEmployeeData.professional_tax ?? '200',
        total_deductions: currentEmployeeData.total_deductions ?? '',
        net_pay: currentEmployeeData.net_pay ?? '',
        monthly_take_home_salary: currentEmployeeData.monthly_take_home_salary ?? '',
        // Loyalty Bonus fields
        loyalty_bonus_enrollment_date: currentEmployeeData.loyalty_bonus_enrollment_date || '',
        loyalty_bonus_specific_condition: currentEmployeeData.loyalty_bonus_specific_condition || '',
        loyalty_bonus_tenure_period: currentEmployeeData.loyalty_bonus_tenure_period || '3',
        loyalty_bonus_amount: currentEmployeeData.loyalty_bonus_amount || '',
        loyalty_bonus_installment_1_amount: currentEmployeeData.loyalty_bonus_installment_1_amount || '',
        loyalty_bonus_installment_2_amount: currentEmployeeData.loyalty_bonus_installment_2_amount || '',
        loyalty_bonus_installment_3_amount: currentEmployeeData.loyalty_bonus_installment_3_amount || '',
        loyalty_bonus_installment_4_amount: currentEmployeeData.loyalty_bonus_installment_4_amount || '',
        loyalty_bonus_installment_5_amount: currentEmployeeData.loyalty_bonus_installment_5_amount || '',
        loyalty_bonus_installment_6_amount: currentEmployeeData.loyalty_bonus_installment_6_amount || '',
        loyalty_bonus_installment_1_date: currentEmployeeData.loyalty_bonus_installment_1_date || '',
        loyalty_bonus_installment_2_date: currentEmployeeData.loyalty_bonus_installment_2_date || '',
        loyalty_bonus_installment_3_date: currentEmployeeData.loyalty_bonus_installment_3_date || '',
        loyalty_bonus_installment_4_date: currentEmployeeData.loyalty_bonus_installment_4_date || '',
        loyalty_bonus_installment_5_date: currentEmployeeData.loyalty_bonus_installment_5_date || '',
        loyalty_bonus_installment_6_date: currentEmployeeData.loyalty_bonus_installment_6_date || '',
        loyalty_bonus_installment_1_disbursed: currentEmployeeData.loyalty_bonus_installment_1_disbursed || false,
        loyalty_bonus_installment_2_disbursed: currentEmployeeData.loyalty_bonus_installment_2_disbursed || false,
        loyalty_bonus_installment_3_disbursed: currentEmployeeData.loyalty_bonus_installment_3_disbursed || false,
        loyalty_bonus_installment_4_disbursed: currentEmployeeData.loyalty_bonus_installment_4_disbursed || false,
        loyalty_bonus_installment_5_disbursed: currentEmployeeData.loyalty_bonus_installment_5_disbursed || false,
        loyalty_bonus_installment_6_disbursed: currentEmployeeData.loyalty_bonus_installment_6_disbursed || false,
      };
      
      // Store original values for comparison (deep clone)
      setOriginalFormValues(JSON.parse(JSON.stringify(formData)));
      
      // Reset form - this will mark the form as not dirty
      form.reset(formData, { keepDefaultValues: false });
    }
    
    // Update the previous references
    prevModeRef.current = mode;
    prevEmployeeRef.current = currentEmployeeData?.id;
  }, [isLoadingCompleteData, employeeData, employee, mode, form]);

  // Update form when additional roles data becomes available
  React.useEffect(() => {
    if (additionalRolesData && mode === 'edit') {
      console.log('🔄 Updating form with fetched additional roles:', {
        additional_role_ids: additionalRolesData.additional_role_ids,
        additional_roles: additionalRolesData.additional_roles?.map((r: any) => r.name),
        form_current_value: form.getValues('additional_role_ids')
      });
      
      // Update the additional_role_ids field with fetched data
      form.setValue('additional_role_ids', additionalRolesData.additional_role_ids || []);
      
      // Update original values to reflect the fetched additional roles
      if (originalFormValues) {
        setOriginalFormValues(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            additional_role_ids: additionalRolesData.additional_role_ids || []
          };
        });
      }
      
      // Force form to re-render with new values
      form.trigger('additional_role_ids');
      
      console.log('✅ Additional roles updated in form:', {
        new_value: form.getValues('additional_role_ids')
      });
    }
  }, [additionalRolesData, mode, form]);


  const onEmployeeSubmit = async (data: EmployeeFormData) => {
    const currentEmployee = employeeData || employee;
    if (!currentEmployee) return;

    // Coerce empty selects to null to avoid uuid parsing errors
    const safeUpdates = {
      ...data,
      role_id: data.role_id || null,
      additional_role_ids: data.additional_role_ids || [],
      department_id: data.department_id || null,
      manager_id: data.manager_id === 'none' ? null : data.manager_id || null,
      salary: data.salary || null,
      comp_off_balance: data.comp_off_balance || 0,
      date_of_birth: data.date_of_birth || null,
      date_of_joining: data.date_of_joining || null,
      date_of_marriage_anniversary: data.date_of_marriage_anniversary || null,
      father_dob: data.father_dob || null,
      mother_dob: data.mother_dob || null,
      // Convert empty strings to null for optional fields
      company_email: data.company_email || null,
      personal_email: data.personal_email || null,
      alternate_contact_no: data.alternate_contact_no || null,
      designation_offer_letter: data.designation_offer_letter || null,
      permanent_address: data.permanent_address || null,
      level_grade: data.level_grade || null,
      current_office_location: data.current_office_location || null,
      blood_group: data.blood_group || null,
      religion: data.religion || null,
      gender: data.gender || null,
      marital_status: data.marital_status || null,
      father_name: data.father_name || null,
      mother_name: data.mother_name || null,
      aadhar_card_no: data.aadhar_card_no || null,
      pan_no: data.pan_no || null,
      bank_account_no: data.bank_account_no || null,
      ifsc_code: data.ifsc_code || null,
      qualification: data.qualification || null,
      employment_terms: data.employment_terms || 'full_time',
      // New onboarding fields
      appointment_formalities: data.appointment_formalities || 'Not Done',
      orientation: data.orientation || 'Not Done',
      order_id_card: data.order_id_card || 'No',
      email_account: data.email_account || 'N/A',
      skype_account: data.skype_account || 'N/A',
      system_account: data.system_account || 'N/A',
      added_to_mailing_list: data.added_to_mailing_list || 'No',
      added_to_attendance_sheet: data.added_to_attendance_sheet || 'No',
      confluence_info_provided: data.confluence_info_provided || 'No',
      id_card_provided: data.id_card_provided || 'N/A',
      remarks: data.remarks || null,
      uan_number: data.uan_number || null,
      is_experienced: data.is_experienced || 'No',
      // Salary Annexure fields
      pf_applicable: data.pf_applicable || false,
      esi_applicable: data.esi_applicable || false,
      monthly_ctc: data.monthly_ctc || null,
      monthly_basic_pay: data.monthly_basic_pay || null,
      hra: data.hra || null,
      night_allowance: data.night_allowance || '2000',
      special_allowance: data.special_allowance || null,
      monthly_gross: data.monthly_gross || null,
      employer_pf: data.employer_pf || null,
      employer_esi: data.employer_esi || null,
      monthly_gratuity_provision: data.monthly_gratuity_provision || null,
      monthly_bonus_provision: data.monthly_bonus_provision || null,
      group_medical_insurance: data.group_medical_insurance || '138',
      pf_employee: data.pf_employee || null,
      esi_employee: data.esi_employee || null,
      tds: data.tds || null,
      professional_tax: data.professional_tax || '200',
      total_deductions: data.total_deductions || null,
      net_pay: data.net_pay || null,
      monthly_take_home_salary: data.monthly_take_home_salary || null,
      // Loyalty Bonus fields
      loyalty_bonus_enrollment_date: data.loyalty_bonus_enrollment_date || null,
      loyalty_bonus_specific_condition: data.loyalty_bonus_specific_condition || null,
      loyalty_bonus_tenure_period: data.loyalty_bonus_tenure_period || '3',
      loyalty_bonus_amount: data.loyalty_bonus_amount || null,
      loyalty_bonus_installment_1_amount: data.loyalty_bonus_installment_1_amount || null,
      loyalty_bonus_installment_2_amount: data.loyalty_bonus_installment_2_amount || null,
      loyalty_bonus_installment_3_amount: data.loyalty_bonus_installment_3_amount || null,
      loyalty_bonus_installment_4_amount: data.loyalty_bonus_installment_4_amount || null,
      loyalty_bonus_installment_5_amount: data.loyalty_bonus_installment_5_amount || null,
      loyalty_bonus_installment_6_amount: data.loyalty_bonus_installment_6_amount || null,
      loyalty_bonus_installment_1_date: data.loyalty_bonus_installment_1_date || null,
      loyalty_bonus_installment_2_date: data.loyalty_bonus_installment_2_date || null,
      loyalty_bonus_installment_3_date: data.loyalty_bonus_installment_3_date || null,
      loyalty_bonus_installment_4_date: data.loyalty_bonus_installment_4_date || null,
      loyalty_bonus_installment_5_date: data.loyalty_bonus_installment_5_date || null,
      loyalty_bonus_installment_6_date: data.loyalty_bonus_installment_6_date || null,
      loyalty_bonus_installment_1_disbursed: data.loyalty_bonus_installment_1_disbursed || false,
      loyalty_bonus_installment_2_disbursed: data.loyalty_bonus_installment_2_disbursed || false,
      loyalty_bonus_installment_3_disbursed: data.loyalty_bonus_installment_3_disbursed || false,
      loyalty_bonus_installment_4_disbursed: data.loyalty_bonus_installment_4_disbursed || false,
      loyalty_bonus_installment_5_disbursed: data.loyalty_bonus_installment_5_disbursed || false,
      loyalty_bonus_installment_6_disbursed: data.loyalty_bonus_installment_6_disbursed || false,
    };

    // Debug: Log the data being sent to the API
    console.log('🔍 Employee update data:', {
      additional_role_ids: safeUpdates.additional_role_ids,
      role_id: safeUpdates.role_id,
      employee_id: currentEmployee.id
    });

    updateEmployee.mutate({
      id: currentEmployee.id,
      updates: safeUpdates
    }, {
      onSuccess: async () => {
        // Don't change mode - keep in edit mode after saving
        // Don't reset form - keep user inputs intact
        // toast.success('Changes saved successfully!');
        
        // Update the original form values with the current form values (which were just saved)
        // This will make the "Save Changes" button disabled again since values match
        const currentFormValues = form.getValues();
        setOriginalFormValues(JSON.parse(JSON.stringify(currentFormValues)));
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Original form values updated after save:', {
            originalKeys: Object.keys(currentFormValues).length
          });
        }
        
        // If the current user is editing their own profile and roles were updated,
        // refresh the auth context to get the new permissions
        if (user?.id === currentEmployee.id) {
          const roleChanged = safeUpdates.role_id !== undefined && safeUpdates.role_id !== currentEmployee.role_id;
          const additionalRolesChanged = safeUpdates.additional_role_ids !== undefined && 
            JSON.stringify(safeUpdates.additional_role_ids) !== JSON.stringify(currentEmployee.additional_role_ids || []);
          
          if (roleChanged || additionalRolesChanged) {
            console.log('🔄 Refreshing current user permissions after role update...', {
              roleChanged,
              additionalRolesChanged,
              newRoleId: safeUpdates.role_id,
              oldRoleId: currentEmployee.role_id
            });
            
            // Use refreshUserRoles to fetch fresh data from database
            // This ensures we get the complete role information including role details
            await refreshUserRoles();
            
            toast.success('Your role has been updated. Please refresh the page to access your new role.');
          }
        }
      },
      onError: (error) => {
        console.error('Employee update failed:', error);
        toast.error('Failed to save changes. Please try again.');
      }
    });
  };

  // Document-related functions
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentTypeId: string) => {
    const file = event.target.files?.[0];
    if (!file || !employee || !user) {
      console.log('Upload cancelled: missing file, employee, or user', { file: !!file, employee: !!employee, user: !!user });
      return;
    }

    console.log('Starting upload for document type:', documentTypeId, 'File:', file.name);
    setUploadingDocumentId(documentTypeId);
    
    try {
      const result = await uploadDocument.mutateAsync({
        file,
        employeeId: employee.id,
        documentTypeId,
        uploadedBy: user.id
      });
      console.log('Upload result:', result);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingDocumentId(null);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleRequestDocument = async (documentTypeId: string) => {
    if (!employee || !user) return;

    await requestDocument.mutateAsync({
      employeeId: employee.id,
      documentTypeId,
      requestedBy: user.id
    });
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!employee) return;

    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument.mutateAsync({
        documentId,
        employeeId: employee.id
      });
    }
  };

  const handleCreateCustomDocumentType = async () => {
    if (!newDocumentType.trim() || !employee || !user) return;

    await createDocumentType.mutateAsync({
      name: newDocumentType.trim(),
      is_mandatory: false,
      category: 'custom',
      created_for_employee_id: employee.id, // Make it employee-specific
      created_by: user.id
    });

    setNewDocumentType('');
  };

  const handleRenameDocumentType = async (documentTypeId: string, newName: string) => {
    if (!newName.trim() || !employee) return;

    await updateDocumentType.mutateAsync({
      documentTypeId,
      updates: { name: newName.trim() },
      employeeId: employee.id
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-red-100 text-red-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getDocumentStatusBadge = (status: string) => {
    const variants = {
      uploaded: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      requested: 'bg-blue-100 text-blue-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleDownloadDocument = (fileUrl: string, documentName: string) => {
    try {
      // First, open the document in a new tab for viewing
      window.open(fileUrl, '_blank');
    } catch (error) {
      // Fallback to download if viewing fails
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `${documentName}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleViewDocument = (fileUrl: string) => {
    try {
      window.open(fileUrl, '_blank');
    } catch (error) {
      toast.error('Unable to open document. Please try downloading instead.');
    }
  };

  const handleDownloadAllDocuments = async () => {
    if (!employee || !employeeDocuments?.length) {
      toast.error('No documents to download');
      return;
    }

    setDownloadingAll(true);
    
    try {
      // Import JSZip dynamically to avoid bundle size issues
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Filter documents that have files uploaded
      const documentsWithFiles = employeeDocuments.filter(doc => doc.file_url && doc.status === 'uploaded');
      
      if (documentsWithFiles.length === 0) {
        toast.error('No uploaded documents found to download');
        setDownloadingAll(false);
        return;
      }

      // Download each document and add to zip
      const downloadPromises = documentsWithFiles.map(async (doc) => {
        try {
          const response = await fetch(doc.file_url!);
          if (!response.ok) throw new Error(`Failed to download ${doc.document_name}`);
          
          const blob = await response.blob();
          const sanitizedDocName = doc.document_name.replace(/[^a-zA-Z0-9\s\-_.]/g, '');
          zip.file(`${sanitizedDocName}.pdf`, blob);
        } catch (error) {
          console.error(`Failed to download ${doc.document_name}:`, error);
          toast.error(`Failed to download ${doc.document_name}`);
        }
      });

      await Promise.all(downloadPromises);

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${employee.full_name.replace(/[^a-zA-Z0-9\s\-_.]/g, '')}_Documents.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${documentsWithFiles.length} documents successfully!`);
    } catch (error) {
      console.error('Download all documents error:', error);
      toast.error('Failed to download documents. Please try again.');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleClose = () => {
    setActiveTab('basic');
    // Reset form to clear any previous employee data
    form.reset();
    onClose();
  };


  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {mode === 'edit' ? `Edit Employee - ${employee.full_name}` : 'Employee Details'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? 'Update employee information and details'
              : `Complete information for ${employee.full_name}`
            }
          </DialogDescription>
        </DialogHeader>

        {mode === 'view' ? (
          <ViewMode 
            employee={employeeData || employee}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            getStatusBadge={getStatusBadge}
            getDocumentStatusBadge={getDocumentStatusBadge}
            handleDownloadDocument={handleDownloadDocument}
            handleViewDocument={handleViewDocument}
            handleDownloadAllDocuments={handleDownloadAllDocuments}
            handleFileUpload={handleFileUpload}
            handleRequestDocument={handleRequestDocument}
            handleDeleteDocument={handleDeleteDocument}
            handleCreateCustomDocumentType={handleCreateCustomDocumentType}
            handleRenameDocumentType={handleRenameDocumentType}
            newDocumentType={newDocumentType}
            setNewDocumentType={setNewDocumentType}
            uploadingDocumentId={uploadingDocumentId}
            downloadingAll={downloadingAll}
            documentTypes={documentTypes}
            employeeDocuments={employeeDocuments}
            createDocumentType={createDocumentType}
            updateDocumentType={updateDocumentType}
            requestDocument={requestDocument}
            deleteDocument={deleteDocument}
            permissions={permissions}
            mode={mode}
            // Incident props
            employeeIncidents={employeeIncidents}
            createIncident={createIncidentMutation}
            updateIncident={updateIncidentMutation}
            deleteIncident={deleteIncidentMutation}
            uploadIncidentAttachment={uploadIncidentAttachmentMutation}
            uploadIncidentAttachments={uploadIncidentAttachmentsMutation}
            removeIncidentAttachment={removeIncidentAttachmentMutation}
          />
        ) : (
          <EditMode
            employee={employeeData || employee}
            form={form}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onEmployeeSubmit={onEmployeeSubmit}
            updateEmployee={updateEmployee}
            departmentOptions={departmentOptions}
            roleOptions={roleOptions}
            userOptions={userOptions}
            onModeChange={onModeChange}
            isLoadingAdditionalRoles={isLoadingAdditionalRoles}
            getDocumentStatusBadge={getDocumentStatusBadge}
            handleDownloadDocument={handleDownloadDocument}
            handleViewDocument={handleViewDocument}
            handleDownloadAllDocuments={handleDownloadAllDocuments}
            handleFileUpload={handleFileUpload}
            handleRequestDocument={handleRequestDocument}
            handleDeleteDocument={handleDeleteDocument}
            handleCreateCustomDocumentType={handleCreateCustomDocumentType}
            handleRenameDocumentType={handleRenameDocumentType}
            newDocumentType={newDocumentType}
            setNewDocumentType={setNewDocumentType}
            uploadingDocumentId={uploadingDocumentId}
            downloadingAll={downloadingAll}
            documentTypes={documentTypes}
            employeeDocuments={employeeDocuments}
            createDocumentType={createDocumentType}
            updateDocumentType={updateDocumentType}
            requestDocument={requestDocument}
            deleteDocument={deleteDocument}
            permissions={permissions}
            // Incident props
            employeeIncidents={employeeIncidents}
            createIncident={createIncidentMutation}
            updateIncident={updateIncidentMutation}
            deleteIncident={deleteIncidentMutation}
            uploadIncidentAttachment={uploadIncidentAttachmentMutation}
            uploadIncidentAttachments={uploadIncidentAttachmentsMutation}
            removeIncidentAttachment={removeIncidentAttachmentMutation}
            originalFormValues={originalFormValues}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// View Mode Component
function ViewMode({ 
  employee, 
  activeTab, 
  setActiveTab, 
  getStatusBadge, 
  getDocumentStatusBadge,
  handleDownloadDocument,
  handleViewDocument,
  handleDownloadAllDocuments,
  handleFileUpload,
  handleRequestDocument,
  handleDeleteDocument,
  handleCreateCustomDocumentType,
  handleRenameDocumentType,
  newDocumentType,
  setNewDocumentType,
  uploadingDocumentId,
  downloadingAll,
  documentTypes,
  employeeDocuments,
  createDocumentType,
  updateDocumentType,
  requestDocument,
  deleteDocument,
  permissions,
  mode,
  // Incident props
  employeeIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  uploadIncidentAttachment,
  uploadIncidentAttachments,
  removeIncidentAttachment
}: any) {
  console.log('🏗️ ViewMode employee data:', {
    id: employee?.id,
    name: employee?.full_name,
    monthly_ctc: employee?.monthly_ctc,
    monthly_basic_pay: employee?.monthly_basic_pay,
    total_deductions: employee?.total_deductions,
    hasAllFields: !!(employee?.monthly_ctc && employee?.monthly_basic_pay)
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-4 flex-shrink-0 mb-6">
        <Avatar className="h-16 w-16">
          <AvatarImage src={employee.avatar_url} />
          <AvatarFallback className="text-lg">
            {employee.full_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-xl font-semibold">{employee.full_name}</h3>
          <p className="text-muted-foreground">{employee.position}</p>
          <div className="flex gap-2 mt-2">
            <Badge className={getStatusBadge(employee.status)}>
              {employee.status}
            </Badge>
            {employee.employment_terms && (
              <Badge variant="outline">
                {employee.employment_terms === 'full_time' ? 'Full Time' : 
                 employee.employment_terms === 'part_time' ? 'Part Time' :
                 employee.employment_terms === 'associate' ? 'Associate' :
                 employee.employment_terms === 'contract' ? 'Contract' :
                 employee.employment_terms === 'probation/internship' ? 'Probation/Internship' : 'Not specified'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 gap-1 flex-shrink-0">
          <TabsTrigger value="basic" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Basic Info</span>
            <span className="sm:hidden">Basic</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Contact</span>
            <span className="sm:hidden">Contact</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Personal</span>
            <span className="sm:hidden">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="work" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <Building className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Work Details</span>
            <span className="sm:hidden">Work</span>
          </TabsTrigger>
          <TabsTrigger value="ctc" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">CTC & Salary</span>
            <span className="sm:hidden">CTC</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Onboarding</span>
            <span className="sm:hidden">Onboard</span>
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Incidents</span>
            <span className="sm:hidden">Incidents</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mt-6">
          <TabsContent value="basic" className="space-y-4">
            <BasicInfoView employee={employee} />
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <ContactInfoView employee={employee} />
          </TabsContent>

          <TabsContent value="personal" className="space-y-4">
            <PersonalInfoView employee={employee} />
          </TabsContent>

          <TabsContent value="work" className="space-y-4">
            <WorkInfoView employee={employee} getStatusBadge={getStatusBadge} />
          </TabsContent>

          <TabsContent value="ctc" className="space-y-4">
            <CTCView employee={employee} />
          </TabsContent>

          <TabsContent value="onboarding" className="space-y-4">
            <OnboardingView employee={employee} />
          </TabsContent>

          <TabsContent value="incidents" className="space-y-4">
            <IncidentsView 
              employee={employee}
              employeeIncidents={employeeIncidents}
              createIncident={createIncident}
              updateIncident={updateIncident}
              deleteIncident={deleteIncident}
              uploadIncidentAttachment={uploadIncidentAttachment}
              uploadIncidentAttachments={uploadIncidentAttachments}
              removeIncidentAttachment={removeIncidentAttachment}
              permissions={permissions}
              mode={mode}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentsView 
              getDocumentStatusBadge={getDocumentStatusBadge}
              handleDownloadDocument={handleDownloadDocument}
              handleViewDocument={handleViewDocument}
              handleDownloadAllDocuments={handleDownloadAllDocuments}
              handleFileUpload={handleFileUpload}
              handleRequestDocument={handleRequestDocument}
              handleDeleteDocument={handleDeleteDocument}
              handleCreateCustomDocumentType={handleCreateCustomDocumentType}
              handleRenameDocumentType={handleRenameDocumentType}
              newDocumentType={newDocumentType}
              setNewDocumentType={setNewDocumentType}
              uploadingDocumentId={uploadingDocumentId}
              downloadingAll={downloadingAll}
              documentTypes={documentTypes}
              employeeDocuments={employeeDocuments}
              createDocumentType={createDocumentType}
              updateDocumentType={updateDocumentType}
              requestDocument={requestDocument}
              deleteDocument={deleteDocument}
              permissions={permissions}
              mode={mode}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Edit Mode Component
function EditMode({ 
  employee, 
  form, 
  activeTab, 
  setActiveTab, 
  onEmployeeSubmit, 
  updateEmployee,
  departmentOptions,
  roleOptions,
  userOptions,
  onModeChange,
  isLoadingAdditionalRoles,
  getDocumentStatusBadge,
  handleDownloadDocument,
  handleViewDocument,
  handleDownloadAllDocuments,
  handleFileUpload,
  handleRequestDocument,
  handleDeleteDocument,
  handleCreateCustomDocumentType,
  handleRenameDocumentType,
  newDocumentType,
  setNewDocumentType,
  uploadingDocumentId,
  downloadingAll,
  documentTypes,
  employeeDocuments,
  createDocumentType,
  updateDocumentType,
  requestDocument,
  deleteDocument,
  permissions,
  // Incident props
  employeeIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  uploadIncidentAttachment,
  uploadIncidentAttachments,
  removeIncidentAttachment,
  originalFormValues
}: any) {
  // Watch all form values to detect changes - this triggers re-renders on form changes
  // Store watched values to trigger re-renders when form changes
  const watchedValues = form.watch();
  
  // Get form state to track dirty fields
  const formState = form.formState;
  
  // Helper function to normalize values for comparison (handle null, undefined, empty strings)
  const normalizeValue = React.useCallback((val: any): any => {
    if (val === null || val === undefined || val === '') return null;
    if (Array.isArray(val)) return val.length === 0 ? null : [...val].sort();
    return val;
  }, []);
  
  // Helper function to deep compare two objects
  const areValuesEqual = React.useCallback((original: any, current: any): boolean => {
    if (!original || !current) return false;
    
    // Get all keys from original (source of truth)
    const originalKeys = Object.keys(original);
    
    for (const key of originalKeys) {
      const originalVal = normalizeValue(original[key]);
      const currentVal = normalizeValue(current[key]);
      
      // Both are null/empty - equal
      if (originalVal === null && currentVal === null) continue;
      
      // One is null/empty, other is not - not equal
      if (originalVal === null || currentVal === null) return false;
      
      // Handle arrays
      if (Array.isArray(originalVal) && Array.isArray(currentVal)) {
        if (originalVal.length !== currentVal.length) return false;
        if (!originalVal.every((val, idx) => val === currentVal[idx])) return false;
        continue;
      }
      
      // Handle objects recursively
      if (typeof originalVal === 'object' && typeof currentVal === 'object' && 
          !Array.isArray(originalVal) && !Array.isArray(currentVal)) {
        if (!areValuesEqual(originalVal, currentVal)) return false;
        continue;
      }
      
      // Handle primitives
      if (originalVal !== currentVal) return false;
    }
    
    return true;
  }, [normalizeValue]);
  
  // Check if form has changes - recalculate when form state changes
  // Use formState.isDirty and dirtyFields to trigger re-renders
  const hasChanges = React.useMemo(() => {
    if (!originalFormValues) {
      return false;
    }
    
    // Get current form values (only actual form data, not internal state)
    const currentValues = form.getValues();
    
    // Compare only the fields that exist in original
    const isEqual = areValuesEqual(originalFormValues, currentValues);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Form change detection:', {
        hasChanges: !isEqual,
        isDirty: formState.isDirty,
        dirtyFieldsCount: Object.keys(formState.dirtyFields || {}).length,
        originalKeys: Object.keys(originalFormValues).length,
        currentKeys: Object.keys(currentValues).length
      });
    }
    
    return !isEqual;
  }, [originalFormValues, watchedValues, formState.isDirty, formState.dirtyFields, form, areValuesEqual]);
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onEmployeeSubmit)} className="flex flex-col flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 gap-2 flex-shrink-0">
            <TabsTrigger value="basic" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Basic Info</span>
              <span className="sm:hidden">Basic</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Contact</span>
              <span className="sm:hidden">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Personal</span>
              <span className="sm:hidden">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="work" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <Building className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Work Details</span>
              <span className="sm:hidden">Work</span>
            </TabsTrigger>
            <TabsTrigger value="ctc" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">CTC & Salary</span>
              <span className="sm:hidden">CTC</span>
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Onboarding</span>
              <span className="sm:hidden">Onboard</span>
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Incidents</span>
              <span className="sm:hidden">Incidents</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Documents</span>
              <span className="sm:hidden">Docs</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mt-4">
            <TabsContent value="basic" className="space-y-6 h-full">
              <BasicInfoEdit form={form} />
            </TabsContent>

            <TabsContent value="contact" className="space-y-6 h-full">
              <ContactInfoEdit form={form} />
            </TabsContent>

            <TabsContent value="personal" className="space-y-6 h-full">
              <PersonalInfoEdit form={form} />
            </TabsContent>

            <TabsContent value="work" className="space-y-6 h-full">
              <WorkInfoEdit 
                form={form} 
                departmentOptions={departmentOptions}
                roleOptions={roleOptions}
                userOptions={userOptions}
                employee={employee}
                permissions={permissions}
                isLoadingAdditionalRoles={isLoadingAdditionalRoles}
              />
            </TabsContent>

            <TabsContent value="ctc" className="space-y-6 h-full">
              <CTCEdit form={form} />
            </TabsContent>

            <TabsContent value="onboarding" className="space-y-6 h-full">
              <OnboardingEdit form={form} employee={employee} />
            </TabsContent>

            <TabsContent value="incidents" className="space-y-6 h-full">
              <IncidentsView 
                employee={employee}
                employeeIncidents={employeeIncidents}
                createIncident={createIncident}
                updateIncident={updateIncident}
                deleteIncident={deleteIncident}
                uploadIncidentAttachment={uploadIncidentAttachment}
                uploadIncidentAttachments={uploadIncidentAttachments}
                removeIncidentAttachment={removeIncidentAttachment}
                permissions={permissions}
                mode={'edit'}
              />
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 h-full">
              <DocumentsView 
                getDocumentStatusBadge={getDocumentStatusBadge}
                handleDownloadDocument={handleDownloadDocument}
                handleViewDocument={handleViewDocument}
                handleDownloadAllDocuments={handleDownloadAllDocuments}
                handleFileUpload={handleFileUpload}
                handleRequestDocument={handleRequestDocument}
                handleDeleteDocument={handleDeleteDocument}
            handleCreateCustomDocumentType={handleCreateCustomDocumentType}
            handleRenameDocumentType={handleRenameDocumentType}
            newDocumentType={newDocumentType}
            setNewDocumentType={setNewDocumentType}
            uploadingDocumentId={uploadingDocumentId}
            downloadingAll={downloadingAll}
            documentTypes={documentTypes}
            employeeDocuments={employeeDocuments}
            createDocumentType={createDocumentType}
            updateDocumentType={updateDocumentType}
            requestDocument={requestDocument}
            deleteDocument={deleteDocument}
            permissions={permissions}
            mode={'edit'}
              />
            </TabsContent>
          </div>
        </Tabs>

        {Object.keys(form.formState.errors).length > 0 && (
            <p className="text-red-500 text-sm mt-2 text-end font-semibold">
                One or more required fields are missing
            </p>
        )}
        <div className="flex justify-end gap-2 border-t pt-4 mt-4 flex-shrink-0">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              onModeChange?.('view');
              form.reset();
              setActiveTab('basic');
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={form.handleSubmit(onEmployeeSubmit)} 
            disabled={updateEmployee.isPending || !hasChanges}
          >
            {updateEmployee.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Individual view components would be extracted here for brevity
// For now, I'll include placeholder components

function BasicInfoView({ employee }: { employee: Employee }) {
  return (
    <div className="pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium">Employee ID:</p>
          <p className="text-muted-foreground">{employee.employee_id || 'Not assigned'}</p>
        </div>
        <div>
          <p className="font-medium">Date of Birth:</p>
          <p className="text-muted-foreground">
            {employee.date_of_birth ? formatDateForDisplay(employee.date_of_birth, 'MMM dd, yyyy') : 'Not provided'}
          </p>
        </div>
        <div>
          <p className="font-medium">Joining Date:</p>
          <p className="text-muted-foreground">
            {employee.date_of_joining ? formatDateForDisplay(employee.date_of_joining, 'MMM dd, yyyy') : 'Not set'}
          </p>
        </div>
        <div>
          <p className="font-medium">Gender:</p>
          <p className="text-muted-foreground capitalize">{employee.gender?.replace('_', ' ') || 'Not specified'}</p>
        </div>
        <div>
          <p className="font-medium">Blood Group:</p>
          <p className="text-muted-foreground">{employee.blood_group || 'Not specified'}</p>
        </div>
        <div>
          <p className="font-medium">Marital Status:</p>
          <p className="text-muted-foreground capitalize">{employee.marital_status || 'Not specified'}</p>
        </div>
        <div>
          <p className="font-medium">Marriage Anniversary:</p>
          <p className="text-muted-foreground">
            {employee.date_of_marriage_anniversary ? formatDateForDisplay(employee.date_of_marriage_anniversary, 'MMM dd, yyyy') : 'Not provided'}
          </p>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <p className="font-medium">Religion:</p>
          <p className="text-muted-foreground">{employee.religion || 'Not specified'}</p>
        </div>
      </div>
    </div>
  );
}

function ContactInfoView({ employee }: { employee: Employee }) {
  return (
    <div className="pb-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium">Official Email:</p>
          <p className="text-muted-foreground">{employee.email}</p>
        </div>
        <div>
          <p className="font-medium">Company Email:</p>
          <p className="text-muted-foreground">{employee.company_email || 'Not provided'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-medium">Personal Email:</p>
          <p className="text-muted-foreground">{employee.personal_email || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">Phone Number:</p>
          <p className="text-muted-foreground">{employee.phone || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">Alternate Contact:</p>
          <p className="text-muted-foreground">{employee.alternate_contact_no || 'Not provided'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-medium">Current Address:</p>
          <p className="text-muted-foreground">{employee.address || 'Not provided'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-medium">Permanent Address:</p>
          <p className="text-muted-foreground">{employee.permanent_address || 'Not provided'}</p>
        </div>
      </div>
    </div>
  );
}

function PersonalInfoView({ employee }: { employee: Employee }) {
  return (
    <div className="pb-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium">Father's Name:</p>
          <p className="text-muted-foreground">{employee.father_name || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">Father's DOB:</p>
          <p className="text-muted-foreground">
            {employee.father_dob ? formatDateForDisplay(employee.father_dob, 'MMM dd, yyyy') : 'Not provided'}
          </p>
        </div>
        <div>
          <p className="font-medium">Mother's Name:</p>
          <p className="text-muted-foreground">{employee.mother_name || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">Mother's DOB:</p>
          <p className="text-muted-foreground">
            {employee.mother_dob ? formatDateForDisplay(employee.mother_dob, 'MMM dd, yyyy') : 'Not provided'}
          </p>
        </div>
        <div>
          <p className="font-medium">Aadhar Number:</p>
          <p className="text-muted-foreground">{employee.aadhar_card_no || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">PAN Number:</p>
          <p className="text-muted-foreground">{employee.pan_no || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">Bank Account:</p>
          <p className="text-muted-foreground">{employee.bank_account_no || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">IFSC Code:</p>
          <p className="text-muted-foreground">{employee.ifsc_code || 'Not provided'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-medium">Qualification:</p>
          <p className="text-muted-foreground">{employee.qualification || 'Not provided'}</p>
        </div>
      </div>
    </div>
  );
}

function OnboardingView({ employee }: { employee: Employee }) {
  return (
    <div className="pb-4 space-y-6">
      {/* Onboarding Progress */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Onboarding Progress</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">Appointment Formalities:</p>
            <p className="text-muted-foreground">{employee.appointment_formalities || 'Not Done'}</p>
          </div>
          <div>
            <p className="font-medium">Orientation:</p>
            <p className="text-muted-foreground">{employee.orientation || 'Not Done'}</p>
          </div>
          <div>
            <p className="font-medium">Order ID Card:</p>
            <p className="text-muted-foreground">{employee.order_id_card || 'No'}</p>
          </div>
          <div>
            <p className="font-medium">ID Card Provided:</p>
            <p className="text-muted-foreground">{employee.id_card_provided || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Accounts Created */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Accounts Created</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium">Email Account:</p>
            <p className="text-muted-foreground">{employee.email_account || 'N/A'}</p>
          </div>
          <div>
            <p className="font-medium">Skype Account:</p>
            <p className="text-muted-foreground">{employee.skype_account || 'N/A'}</p>
          </div>
          <div>
            <p className="font-medium">System Account:</p>
            <p className="text-muted-foreground">{employee.system_account || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Access & Tools */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Access & Tools</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">Added to Mailing List:</p>
            <p className="text-muted-foreground">{employee.added_to_mailing_list || 'No'}</p>
          </div>
          <div>
            <p className="font-medium">Added to Attendance Sheet:</p>
            <p className="text-muted-foreground">{employee.added_to_attendance_sheet || 'No'}</p>
          </div>
          <div>
            <p className="font-medium">Confluence Info Provided:</p>
            <p className="text-muted-foreground">{employee.confluence_info_provided || 'No'}</p>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">UAN Number:</p>
            <p className="text-muted-foreground">{employee.uan_number || 'Not provided'}</p>
          </div>
          <div>
            <p className="font-medium">Is Experienced:</p>
            <p className="text-muted-foreground">{employee.is_experienced || 'No'}</p>
          </div>
        </div>
      </div>

      {/* Remarks */}
      {employee.remarks && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Remarks</h3>
          <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">{employee.remarks}</p>
        </div>
      )}

      {/* Work Experience Section - Conditional */}
      {employee.is_experienced === 'Yes' && (
        <WorkExperienceView employee={employee} />
      )}
    </div>
  );
}

function WorkInfoView({ employee, getStatusBadge }: { employee: Employee; getStatusBadge: (status: string) => string }) {
  return (
    <div className="pb-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium">Current Position:</p>
          <p className="text-muted-foreground">{employee.position || 'Not assigned'}</p>
        </div>
        <div>
          <p className="font-medium">Designation (Offer Letter):</p>
          <p className="text-muted-foreground">{employee.designation_offer_letter || 'Not provided'}</p>
        </div>
        <div>
          <p className="font-medium">Department:</p>
          <p className="text-muted-foreground">{employee.department?.name || 'Not assigned'}</p>
        </div>
        <div>
          <p className="font-medium">Primary Role:</p>
          <Badge variant="default" className="capitalize mt-1">
            {getRoleDisplayName(employee.role?.name || '') || 'Not assigned'}
          </Badge>
        </div>
        <div>
          <p className="font-medium">Additional Roles:</p>
          <div className="mt-1">
            {employee.additional_roles && employee.additional_roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {employee.additional_roles.map((role: any) => (
                  <Badge key={role.id} variant="secondary" className="text-xs">
                    {getRoleDisplayName(role.name)}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">No additional roles assigned</span>
            )}
          </div>
        </div>
        <div>
          <p className="font-medium">Manager:</p>
          <p className="text-muted-foreground">
            {employee.manager?.full_name ? (
              <span>
                {employee.manager.full_name}
                {employee.manager.position && (
                  <span className="text-xs block text-muted-foreground/70">
                    {employee.manager.position}
                  </span>
                )}
              </span>
            ) : (
              'No manager assigned'
            )}
          </p>
        </div>
        <div>
          <p className="font-medium">Level/Grade:</p>
          <p className="text-muted-foreground">{employee.level_grade || 'Not assigned'}</p>
        </div>
        <div>
          <p className="font-medium">Office Location:</p>
          <p className="text-muted-foreground">{employee.current_office_location || 'Not specified'}</p>
        </div>
        <div>
          <p className="font-medium">Employment Terms:</p>
          <p className="text-muted-foreground">
            {employee.employment_terms === 'full_time' ? 'Full Time' : 
             employee.employment_terms === 'part_time' ? 'Part Time' :
             employee.employment_terms === 'associate' ? 'Associate' :
             employee.employment_terms === 'contract' ? 'Contract' :
             employee.employment_terms === 'probation/internship' ? 'Probation/Internship' : 'Not specified'}
          </p>
        </div>
        <div>
          <p className="font-medium">Status:</p>
          <Badge className={getStatusBadge(employee.status)}>
            {employee.status}
          </Badge>
        </div>
        {employee.skill && employee.skill.length > 0 && (
          <div className="col-span-2">
            <p className="font-medium">Skills:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {employee.skill.map((skill: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      
      {employee.comp_off_balance !== undefined && (
        <div className="p-4 bg-blue-50 rounded-lg mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="font-medium">Compensatory Off Balance</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {employee.comp_off_balance} {employee.comp_off_balance === 1 ? 'day' : 'days'}
          </p>
          <p className="text-sm text-muted-foreground">Available compensatory off balance</p>
        </div>
      )}
    </div>
  );
}

function DocumentsView({ 
  getDocumentStatusBadge,
  handleDownloadDocument,
  handleViewDocument,
  handleDownloadAllDocuments,
  handleFileUpload,
  handleRequestDocument,
  handleDeleteDocument,
  handleCreateCustomDocumentType,
  handleRenameDocumentType,
  newDocumentType,
  setNewDocumentType,
  uploadingDocumentId,
  downloadingAll,
  documentTypes,
  employeeDocuments,
  createDocumentType,
  updateDocumentType,
  requestDocument,
  deleteDocument,
  permissions,
  mode
}: any) {
  const [editingDocTypeId, setEditingDocTypeId] = useState<string | null>(null);
  const [editingDocTypeName, setEditingDocTypeName] = useState<string>('');

  // Sort document types: custom documents (with created_for_employee_id) first, then others
  const sortedDocumentTypes = React.useMemo(() => {
    if (!documentTypes) return [];
    return [...documentTypes].sort((a: any, b: any) => {
      const aIsCustom = !!a.created_for_employee_id;
      const bIsCustom = !!b.created_for_employee_id;
      if (aIsCustom && !bIsCustom) return -1;
      if (!aIsCustom && bIsCustom) return 1;
      return 0;
    });
  }, [documentTypes]);

  const handleStartEdit = (docType: any) => {
    setEditingDocTypeId(docType.id);
    setEditingDocTypeName(docType.name);
  };

  const handleCancelEdit = () => {
    setEditingDocTypeId(null);
    setEditingDocTypeName('');
  };

  const handleSaveEdit = async (docTypeId: string) => {
    if (!editingDocTypeName.trim()) {
      toast.error('Document name cannot be empty');
      return;
    }
    await handleRenameDocumentType(docTypeId, editingDocTypeName);
    setEditingDocTypeId(null);
    setEditingDocTypeName('');
  };

  return (
    <div className="pb-4">
      {/* Add Custom Document Type Section - Only in Edit Mode */}
      {permissions.canManageAccess && mode === 'edit' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Custom Document Type for This Employee
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a custom document type that will only appear for this specific employee.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Visa Copy, Training Certificate"
                value={newDocumentType}
                onChange={(e) => setNewDocumentType(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button"
                onClick={handleCreateCustomDocumentType}
                disabled={!newDocumentType.trim() || createDocumentType.isPending}
              >
                {createDocumentType.isPending ? 'Adding...' : 'Add Custom'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Employee Documents</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadAllDocuments}
            disabled={!employeeDocuments?.length || downloadingAll}
            className="flex items-center gap-2"
          >
            {downloadingAll ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download All
          </Button>
        </div>
        
        {sortedDocumentTypes && sortedDocumentTypes.length > 0 ? (
          <div className="grid gap-4">
            {sortedDocumentTypes.map((docType: any) => {
              const existingDoc = employeeDocuments?.find((doc: any) => doc.document_type_id === docType.id);
              const isUploading = uploadingDocumentId === docType.id;
              
              return (
                <Card key={docType.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {editingDocTypeId === docType.id ? (
                          // Edit mode for custom documents
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingDocTypeName}
                              onChange={(e) => setEditingDocTypeName(e.target.value)}
                              className="flex-1 max-w-xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(docType.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaveEdit(docType.id)}
                              disabled={updateDocumentType.isPending || !editingDocTypeName.trim()}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              disabled={updateDocumentType.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          // View mode
                          <>
                            <h4 className="font-medium">{docType.name}</h4>
                            {permissions.canManageAccess && mode === 'edit' && docType.created_for_employee_id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEdit(docType)}
                                className="h-6 w-6 p-0"
                                title="Rename document"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                        {docType.is_mandatory && (
                          <Badge variant="destructive" className="text-xs">
                            Mandatory
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {docType.category}
                        </Badge>
                        {docType.created_for_employee_id && (
                          <Badge variant="secondary" className="text-xs">
                            Optional
                          </Badge>
                        )}
                      </div>
                      
                      {existingDoc && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge className={getDocumentStatusBadge(existingDoc.status)}>
                            {existingDoc.status}
                          </Badge>
                          
                          {existingDoc.status === 'uploaded' && existingDoc.uploaded_by_user && (
                            <span>Uploaded by {existingDoc.uploaded_by_user.full_name}</span>
                          )}
                          
                          {existingDoc.status === 'requested' && existingDoc.requested_by_user && (
                            <span>Requested by {existingDoc.requested_by_user.full_name}</span>
                          )}
                          
                          {existingDoc.file_size && (
                            <span>({(existingDoc.file_size / 1024 / 1024).toFixed(2)} MB)</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* View and Download Buttons */}
                      {existingDoc?.file_url && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDocument(existingDoc.file_url!)}
                            title="View Document"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadDocument(existingDoc.file_url!, existingDoc.document_name)}
                            title="Download Document"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {/* Upload Button - Only in Edit Mode */}
                      {permissions.canManageAccess && mode === 'edit' && (
                        <div className="relative">
                          <input
                            type="file"
                            onChange={(e) => handleFileUpload(e, docType.id)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploading}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUploading}
                            className="pointer-events-none"
                          >
                            {isUploading ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {/* Request Button - Only in Edit Mode */}
                      {permissions.canManageAccess && mode === 'edit' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestDocument(docType.id)}
                          disabled={existingDoc?.status === 'uploaded' || requestDocument.isPending}
                        >
                          <Send className="h-4 w-4" /> Request Document
                        </Button>
                      )}
                      
                      {/* Delete Button - Only in Edit Mode */}
                      {permissions.canManageAccess && mode === 'edit' && existingDoc && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteDocument(existingDoc.id)}
                          disabled={deleteDocument.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No document types available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Edit form components would continue here...
// For brevity, I'll include basic placeholders

function BasicInfoEdit({ form }: any) {
  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Full Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter full name" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="employee_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Employee ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter employee ID" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="date_of_birth"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Date of Birth</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date_of_joining"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Date of Joining *</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Gender</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="blood_group"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Blood Group</FormLabel>
              <FormControl>
                <Input placeholder="Enter blood group (e.g., A+)" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="marital_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Marital Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select marital status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date_of_marriage_anniversary"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Marriage Anniversary</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="religion"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Religion</FormLabel>
            <FormControl>
              <Input placeholder="Enter religion" {...field} className="mt-1" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function ContactInfoEdit({ form }: any) {
  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Official Email *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter official email" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="company_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Company Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter company email" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="personal_email"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Personal Email</FormLabel>
            <FormControl>
              <Input type="email" placeholder="Enter personal email" {...field} className="mt-1" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter phone number" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="alternate_contact_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Alternate Contact</FormLabel>
              <FormControl>
                <Input placeholder="Enter alternate contact" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Current Address</FormLabel>
            <FormControl>
              <Textarea placeholder="Enter current address" {...field} className="mt-1" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="permanent_address"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Permanent Address</FormLabel>
            <FormControl>
              <Textarea placeholder="Enter permanent address" {...field} className="mt-1" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function PersonalInfoEdit({ form }: any) {
  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="father_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Father's Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter father's name" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="father_dob"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Father's Date of Birth</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="mother_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Mother's Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter mother's name" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mother_dob"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Mother's Date of Birth</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="aadhar_card_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Aadhar Card Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter Aadhar number" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pan_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">PAN Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter PAN number" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="bank_account_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Bank Account Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter bank account number" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ifsc_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">IFSC Code</FormLabel>
              <FormControl>
                <Input placeholder="Enter IFSC code" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="qualification"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Qualification</FormLabel>
            <FormControl>
              <Textarea placeholder="Enter educational qualification" {...field} className="mt-1" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function WorkInfoEdit({ form, departmentOptions, roleOptions, userOptions, employee, permissions, isLoadingAdditionalRoles }: any) {
  // Filter out admin role for non-admin users
  const filteredRoleOptions = roleOptions?.filter((role: any) => {
    // If user can't manage roles (i.e., not admin), hide admin role
    if (!permissions.canManageRoles && role.name === 'admin') {
      return false;
    }
    return true;
  });

  // Check if the employee being edited is an admin
  const isEmployeeAdmin = employee?.role?.name === 'admin';
  
  // HR users cannot change admin roles at all
  const isRoleDisabled = !permissions.canManageRoles && isEmployeeAdmin;
  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Current Position</FormLabel>
              <FormControl>
                <Input placeholder="Enter current position" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="designation_offer_letter"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Designation (As per Offer Letter)</FormLabel>
              <FormControl>
                <Input placeholder="Enter designation from offer letter" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="role_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                Role
                {isRoleDisabled && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Admin role cannot be changed by HR)
                  </span>
                )}
              </FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                disabled={isRoleDisabled}
              >
                <FormControl>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {filteredRoleOptions?.map((role: any) => (
                    <SelectItem key={role.id} value={role.id}>
                      {getRoleDisplayName(role.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="department_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Department</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departmentOptions?.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Additional Roles Field */}
      <FormField
        control={form.control}
        name="additional_role_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">
              Additional Roles
              <span className="text-xs text-muted-foreground ml-2">
                (Optional - assign multiple roles for enhanced permissions)
              </span>
            </FormLabel>
            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between mt-1"
                      disabled={isRoleDisabled || isLoadingAdditionalRoles}
                    >
                      {isLoadingAdditionalRoles ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                          <span>Loading roles...</span>
                        </div>
                      ) : field.value && field.value.length > 0 ? (
                        `${field.value.length} additional role${field.value.length > 1 ? 's' : ''} selected`
                      ) : (
                        "Select additional roles"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search roles..." />
                    <CommandEmpty>No roles found.</CommandEmpty>
                    <CommandGroup>
                      {filteredRoleOptions?.map((role: any) => {
                        const isSelected = field.value?.includes(role.id);
                        const isPrimaryRole = form.getValues('role_id') === role.id;
                        
                        return (
                          <CommandItem
                            key={role.id}
                            onSelect={() => {
                              if (isPrimaryRole) return; // Don't allow selecting primary role as additional
                              
                              const currentValues = field.value || [];
                              const newValues = isSelected
                                ? currentValues.filter((id: string) => id !== role.id)
                                : [...currentValues, role.id];
                              field.onChange(newValues);
                            }}
                            disabled={isPrimaryRole}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="flex-1">
                              <span className={isPrimaryRole ? "text-muted-foreground" : ""}>
                                {getRoleDisplayName(role.name)}
                              </span>
                              {isPrimaryRole && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (Primary Role)
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {/* Display selected additional roles */}
              {field.value && field.value.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {field.value.map((roleId: string) => {
                    const role = filteredRoleOptions?.find((r: any) => r.id === roleId);
                    if (!role) return null;
                    
                    return (
                      <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                        {getRoleDisplayName(role.name)}
                        <button
                          type="button"
                          onClick={() => {
                            const newValues = field.value.filter((id: string) => id !== roleId);
                            field.onChange(newValues);
                          }}
                          className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                          disabled={isRoleDisabled}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="manager_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Manager</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                
                <SelectItem value="none">No Manager</SelectItem>
                {userOptions?.filter((user: any) => user.id !== employee?.id).map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex flex-col">
                      <span>{user.full_name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="level_grade"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Level/Grade</FormLabel>
              <FormControl>
                <Input placeholder="Enter level or grade" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="current_office_location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Current Office Location</FormLabel>
              <FormControl>
                <Input placeholder="Enter office location" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="employment_terms"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Employment Terms</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select employment terms" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="associate">Associate</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="probation/internship">Probation/Internship</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comp_off_balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Compensatory Off Balance</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.5"
                  min="0"
                  placeholder="Enter comp off balance" 
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-700">Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function OnboardingEdit({ form, employee }: { form: any; employee: Employee }) {
  return (
    <div className="space-y-6 pb-4">
      {/* Onboarding Progress Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Onboarding Progress</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="appointment_formalities"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Appointment Formalities</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'Not Done'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Done">Done</SelectItem>
                    <SelectItem value="Not Done">Not Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orientation"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Orientation</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'Not Done'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Done">Done</SelectItem>
                    <SelectItem value="Not Done">Not Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="order_id_card"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Order ID Card</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'No'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="id_card_provided"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">ID Card Provided</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'N/A'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Accounts Created Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Accounts Created</h3>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="email_account"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Email Account</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'N/A'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="skype_account"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Skype Account</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'N/A'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="system_account"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">System Account</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'N/A'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Access & Tools Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Access & Tools</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="added_to_mailing_list"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Added to Mailing List</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'No'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="added_to_attendance_sheet"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Added to Attendance Sheet</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'No'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confluence_info_provided"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Confluence Info Provided</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'No'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Additional Information Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="uan_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">UAN Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter UAN number" {...field} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_experienced"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Is Experienced?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'No'}>
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Remarks Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Remarks</h3>
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Comments or Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter any additional comments or notes" 
                  {...field} 
                  className="mt-1 min-h-[100px]" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Work Experience Section - Conditional */}
      {form.watch('is_experienced') === 'Yes' && (
        <WorkExperienceEdit employee={employee} />
      )}
    </div>
  );
}

function WorkExperienceView({ employee }: { employee: Employee }) {
  const { data: workExperience, isLoading } = useWorkExperience(employee.id);

  if (isLoading) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Work Experience</h3>
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!workExperience || workExperience.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Work Experience</h3>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">No work experience records found.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Work Experience</h3>
      <div className="space-y-4">
        {workExperience.map((exp) => (
          <Card key={exp.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-lg">{exp.employer_name}</h4>
                <Badge variant={
                  exp.verification_status === 'Verified' ? 'default' :
                  exp.verification_status === 'Not Verified' ? 'destructive' : 'secondary'
                }>
                  {exp.verification_status}
                </Badge>
              </div>
              
              {exp.comments && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Comments:</p>
                  <p className="text-sm text-gray-600">{exp.comments}</p>
                </div>
              )}

              {exp.attachment_file_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Attachment:</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(exp.attachment_file_url, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = exp.attachment_file_url!;
                        link.download = exp.attachment_file_name || 'attachment';
                        link.click();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                    {exp.attachment_file_size && (
                      <span className="text-xs text-gray-500">
                        ({(exp.attachment_file_size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Added on {formatDateForDisplay(exp.created_at, 'MMM dd, yyyy')}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkExperienceEdit({ employee }: { employee: Employee }) {
  const { data: workExperience, isLoading } = useWorkExperience(employee.id);
  const createWorkExperience = useCreateWorkExperience();
  const updateWorkExperience = useUpdateWorkExperience();
  const deleteWorkExperience = useDeleteWorkExperience();
  const uploadAttachment = useUploadWorkExperienceAttachment();
  const removeAttachment = useRemoveWorkExperienceAttachment();

  const [newExperience, setNewExperience] = useState({
    employer_name: '',
    verification_status: 'Not Verified' as 'Verified' | 'Not Verified' | 'N/A',
    comments: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, any>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  const handleAddExperience = async () => {
    if (!newExperience.employer_name.trim()) {
      toast.error('Employer name is required');
      return;
    }

    try {
      await createWorkExperience.mutateAsync({
        employee_id: employee.id,
        ...newExperience
      });
      setNewExperience({
        employer_name: '',
        verification_status: 'Not Verified',
        comments: ''
      });
    } catch (error) {
      console.error('Failed to add work experience:', error);
    }
  };

  const handleUpdateExperience = async (id: string) => {
    try {
      await updateWorkExperience.mutateAsync({
        id,
        workExperienceData: editingData,
        employeeId: employee.id
      });
      setEditingId(null);
      setEditingData({});
    } catch (error) {
      console.error('Failed to update work experience:', error);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work experience record?')) {
      return;
    }

    try {
      await deleteWorkExperience.mutateAsync({
        id,
        employeeId: employee.id
      });
    } catch (error) {
      console.error('Failed to delete work experience:', error);
    }
  };

  const handleFileUpload = async (workExpId: string, file: File, employerName: string) => {
    setUploadingFiles(prev => ({ ...prev, [workExpId]: true }));
    try {
      await uploadAttachment.mutateAsync({
        workExperienceId: workExpId,
        file,
        employeeId: employee.id,
        employerName
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [workExpId]: false }));
    }
  };

  const handleRemoveAttachment = async (workExpId: string) => {
    if (!confirm('Are you sure you want to remove this attachment?')) {
      return;
    }

    try {
      await removeAttachment.mutateAsync({
        workExperienceId: workExpId,
        employeeId: employee.id
      });
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
  };

  if (isLoading) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Work Experience</h3>
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Work Experience</h3>
      
      {/* Add New Work Experience */}
      <Card className="p-4 mb-4 bg-blue-50">
        <h4 className="font-medium mb-3">Add New Work Experience</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Employer Name"
              value={newExperience.employer_name}
              onChange={(e) => setNewExperience(prev => ({ ...prev, employer_name: e.target.value }))}
            />
            <Select 
              value={newExperience.verification_status} 
              onValueChange={(value: 'Verified' | 'Not Verified' | 'N/A') => 
                setNewExperience(prev => ({ ...prev, verification_status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Verification Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Verified">Verified</SelectItem>
                <SelectItem value="Not Verified">Not Verified</SelectItem>
                <SelectItem value="N/A">N/A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Comments (optional)"
            value={newExperience.comments}
            onChange={(e) => setNewExperience(prev => ({ ...prev, comments: e.target.value }))}
            className="min-h-[80px]"
          />
          <Button 
            onClick={handleAddExperience}
            disabled={createWorkExperience.isPending || !newExperience.employer_name.trim()}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {createWorkExperience.isPending ? 'Adding...' : 'Add Experience'}
          </Button>
        </div>
      </Card>

      {/* Existing Work Experience */}
      <div className="space-y-4">
        {workExperience?.map((exp) => (
          <Card key={exp.id} className="p-4">
            {editingId === exp.id ? (
              /* Edit Mode */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={editingData.employer_name || exp.employer_name}
                    onChange={(e) => setEditingData(prev => ({ ...prev, employer_name: e.target.value }))}
                    placeholder="Employer Name"
                  />
                  <Select 
                    value={editingData.verification_status || exp.verification_status}
                    onValueChange={(value) => setEditingData(prev => ({ ...prev, verification_status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Verified">Verified</SelectItem>
                      <SelectItem value="Not Verified">Not Verified</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={editingData.comments || exp.comments || ''}
                  onChange={(e) => setEditingData(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="Comments"
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleUpdateExperience(exp.id)}
                    disabled={updateWorkExperience.isPending}
                    size="sm"
                  >
                    {updateWorkExperience.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setEditingId(null);
                      setEditingData({});
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-lg">{exp.employer_name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      exp.verification_status === 'Verified' ? 'default' :
                      exp.verification_status === 'Not Verified' ? 'destructive' : 'secondary'
                    }>
                      {exp.verification_status}
                    </Badge>
                    <Button
                      onClick={() => {
                        setEditingId(exp.id);
                        setEditingData({});
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteExperience(exp.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {exp.comments && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Comments:</p>
                    <p className="text-sm text-gray-600">{exp.comments}</p>
                  </div>
                )}

                {/* File Upload/Management */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Attachment:</p>
                  {exp.attachment_file_url ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(exp.attachment_file_url, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = exp.attachment_file_url!;
                          link.download = exp.attachment_file_name || 'attachment';
                          link.click();
                        }}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAttachment(exp.id)}
                        className="flex items-center gap-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                      {exp.attachment_file_size && (
                        <span className="text-xs text-gray-500">
                          ({(exp.attachment_file_size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(exp.id, file, exp.employer_name);
                          }
                        }}
                        disabled={uploadingFiles[exp.id]}
                        className="max-w-xs"
                      />
                      {uploadingFiles[exp.id] && (
                        <LoadingSpinner />
                      )}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  Added on {formatDateForDisplay(exp.created_at, 'MMM dd, yyyy')}
                  {exp.updated_at !== exp.created_at && (
                    <span> • Updated on {formatDateForDisplay(exp.updated_at, 'MMM dd, yyyy')}</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        )) || (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">No work experience records found. Add one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CTCView({ employee }: { employee: Employee }) {
  console.log('🏗️ CTCView employee data:', {
    id: employee?.id,
    name: employee?.full_name,
    salary: employee?.salary,
    monthly_ctc: employee?.monthly_ctc,
    monthly_basic_pay: employee?.monthly_basic_pay,
    total_deductions: employee?.total_deductions,
    net_pay: employee?.net_pay,
    pf_applicable: employee?.pf_applicable,
    esi_applicable: employee?.esi_applicable,
    hasCompleteData: !!(employee?.monthly_ctc || employee?.pf_applicable !== undefined)
  });

  // Calculate values from Annual Salary (same logic as edit mode)
  const calculateSalaryComponents = () => {
    if (!employee.salary || employee.salary <= 0) {
      return {
        monthly_ctc: 0,
        monthly_basic_pay: 0,
        hra: 0,
        night_allowance: 2000,
        special_allowance: 0,
        monthly_gross: 0,
        employer_pf: 0,
        employer_esi: 0,
        monthly_gratuity_provision: 0,
        monthly_bonus_provision: 0,
        group_medical_insurance: 138,
        pf_employee: 0,
        esi_employee: 0,
        tds: 0,
        professional_tax: 200,
        total_deductions: 0,
        net_pay: 0,
        monthly_take_home_salary: 0
      };
    }

    // Calculate ALL values from original unrounded values first
    const monthlyCTCValue = employee.salary / 12;
    const monthlyBasicValue = monthlyCTCValue * 0.51;
    const hraValue = monthlyBasicValue * 0.40;
    const nightAllowanceValue = parseFloat(employee.night_allowance?.toString() || '2000');
    const groupInsuranceValue = parseFloat(employee.group_medical_insurance?.toString() || '138');
    
    // Calculate employer contributions from original values
    const employerPFValue = employee.pf_applicable ? monthlyBasicValue * 0.12 : 0;
    const gratuityValue = ((monthlyBasicValue * 15) / 26) / 12;
    const bonusValue = monthlyBasicValue < 21000 ? monthlyBasicValue * 0.0833 : 0;
    
    // Calculate initial monthly gross (without special allowance) from original values for ESI calculation
    const initialMonthlyGrossValue = monthlyBasicValue + hraValue + nightAllowanceValue;
    const employerESIValue = (employee.esi_applicable && initialMonthlyGrossValue < 21000) ? initialMonthlyGrossValue * 0.0325 : 0;
    
    // Calculate special allowance from original values (balancing figure)
    const specialAllowanceValue = monthlyCTCValue - (monthlyBasicValue + hraValue + nightAllowanceValue + employerPFValue + employerESIValue + gratuityValue + bonusValue + groupInsuranceValue);
    
    // Calculate monthly gross from original values
    const monthlyGrossValue = monthlyBasicValue + hraValue + nightAllowanceValue + specialAllowanceValue;

    // Calculate employee deductions from original values
    const employeePFValue = employee.pf_applicable ? monthlyBasicValue * 0.12 : 0;
    const employeeESIValue = employee.esi_applicable ? monthlyBasicValue * 0.0075 : 0;
    const tdsValue = parseFloat(employee.tds?.toString() || '0');
    const professionalTaxValue = parseFloat(employee.professional_tax?.toString() || '200');
    
    // Calculate totals from original values
    const totalDeductionsValue = employeePFValue + employeeESIValue + tdsValue + professionalTaxValue;
    const netPayValue = monthlyGrossValue - totalDeductionsValue;
    const takeHomeValue = netPayValue + bonusValue;

    // Apply ceiling to each final result independently
    return {
      monthly_ctc: Math.ceil(monthlyCTCValue),
      monthly_basic_pay: Math.ceil(monthlyBasicValue),
      hra: Math.ceil(hraValue),
      night_allowance: Math.ceil(nightAllowanceValue),
      special_allowance: Math.ceil(specialAllowanceValue),
      monthly_gross: Math.ceil(monthlyGrossValue),
      employer_pf: Math.ceil(employerPFValue),
      employer_esi: Math.ceil(employerESIValue),
      monthly_gratuity_provision: Math.ceil(gratuityValue),
      monthly_bonus_provision: Math.ceil(bonusValue),
      group_medical_insurance: Math.ceil(groupInsuranceValue),
      pf_employee: Math.ceil(employeePFValue),
      esi_employee: Math.ceil(employeeESIValue),
      tds: Math.ceil(tdsValue),
      professional_tax: Math.ceil(professionalTaxValue),
      total_deductions: Math.ceil(totalDeductionsValue),
      net_pay: Math.ceil(netPayValue),
      monthly_take_home_salary: Math.ceil(takeHomeValue)
    };
  };

  // Use database values when available, fallback to calculated values
  const getDisplayValue = (dbValue: any, calculatedValue: number, fallbackValue: number = 0) => {
    // If database value exists and is not null/undefined/empty string, use it
    if (dbValue !== null && dbValue !== undefined && dbValue !== '') {
      return parseFloat(dbValue.toString()) || fallbackValue;
    }
    // Otherwise use calculated value
    return calculatedValue;
  };

  const calculated = calculateSalaryComponents();
  
  // Determine if we have database values or need to show calculated ones
  const hasDbValues = !!(employee?.monthly_ctc || employee?.monthly_basic_pay || employee?.total_deductions);
  
  console.log('💰 CTC Display Values:', {
    hasDbValues,
    db_monthly_ctc: employee?.monthly_ctc,
    calc_monthly_ctc: calculated.monthly_ctc,
    db_pf_applicable: employee?.pf_applicable,
    db_total_deductions: employee?.total_deductions
  });

  return (
    <div className="pb-4 space-y-6">
      {/* Annual CTC Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Annual CTC</h3>
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="h-4 w-4 text-green-600" />
            <span className="font-medium">Annual CTC</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            ₹ {employee.salary ? employee.salary.toLocaleString() : 'Not specified'}
          </p>
          <p className="text-sm text-muted-foreground">Annual Cost to Company</p>
        </div>
      </div>

      {/* Salary Annexure Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Salary Annexure</h3>
        
        {/* Applicability Flags */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-medium text-sm">PF Applicable</p>
            <p className="text-lg font-semibold text-blue-600">
              {employee.pf_applicable ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="font-medium text-sm">ESI Applicable</p>
            <p className="text-lg font-semibold text-purple-600">
              {employee.esi_applicable ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        {/* Core Salary Components */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p className="font-medium">Monthly CTC:</p>
            <p className="text-muted-foreground">₹ {getDisplayValue(employee?.monthly_ctc, calculated.monthly_ctc).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium">Monthly Basic Pay:</p>
            <p className="text-muted-foreground">₹ {getDisplayValue(employee?.monthly_basic_pay, calculated.monthly_basic_pay).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium">HRA:</p>
            <p className="text-muted-foreground">₹ {getDisplayValue(employee?.hra, calculated.hra).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium">Night Allowance:</p>
            <p className="text-muted-foreground">₹ {getDisplayValue(employee?.night_allowance, calculated.night_allowance, 2000).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium">Special Allowance:</p>
            <p className="text-muted-foreground">₹ {getDisplayValue(employee?.special_allowance, calculated.special_allowance).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium">Monthly Gross:</p>
            <p className="text-muted-foreground">₹ {getDisplayValue(employee?.monthly_gross, calculated.monthly_gross).toLocaleString()}</p>
          </div>
        </div>

        {/* Employer Contributions */}
        <div className="mb-6">
          <h4 className="font-medium mb-3">Employer Contributions</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Employer PF:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.employer_pf, calculated.employer_pf).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">Employer ESI:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.employer_esi, calculated.employer_esi).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">Monthly Gratuity (Provision):</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.monthly_gratuity_provision, calculated.monthly_gratuity_provision).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">Monthly Bonus (Provision):</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.monthly_bonus_provision, calculated.monthly_bonus_provision).toLocaleString()}</p>
            </div>
            <div className="col-span-2">
              <p className="font-medium">Group Medical Insurance:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.group_medical_insurance, calculated.group_medical_insurance, 138).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Employee Deductions */}
        <div className="mb-6">
          <h4 className="font-medium mb-3">Employee Deductions</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">PF Employee:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.pf_employee, calculated.pf_employee).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">ESI Employee:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.esi_employee, calculated.esi_employee).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">TDS:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.tds, calculated.tds).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">Professional Tax:</p>
              <p className="text-muted-foreground">₹ {getDisplayValue(employee?.professional_tax, calculated.professional_tax, 200).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Final Calculations */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="font-medium text-sm">Total Deductions</p>
            <p className="text-lg font-semibold text-red-600">
              ₹ {getDisplayValue(employee?.total_deductions, calculated.total_deductions).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="font-medium text-sm">Net Pay</p>
            <p className="text-lg font-semibold text-green-600">
              ₹ {getDisplayValue(employee?.net_pay, calculated.net_pay).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-medium text-sm">Monthly Take Home</p>
            <p className="text-lg font-semibold text-blue-600">
              ₹ {getDisplayValue(employee?.monthly_take_home_salary, calculated.monthly_take_home_salary).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Loyalty Bonus Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Loyalty Bonus</h3>
        
        {/* Basic Loyalty Info */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p className="font-medium">Enrollment Date:</p>
            <p className="text-muted-foreground">
              {employee.loyalty_bonus_enrollment_date ? formatDateForDisplay(employee.loyalty_bonus_enrollment_date, 'MMM dd, yyyy') : 'Not set'}
            </p>
          </div>
          <div>
            <p className="font-medium">Tenure Period:</p>
            <p className="text-muted-foreground">{employee.loyalty_bonus_tenure_period || '3'} years</p>
          </div>
          <div className="col-span-2">
            <p className="font-medium">Total Loyalty Bonus Amount:</p>
            <p className="text-muted-foreground">₹ {employee.loyalty_bonus_amount || 'Not specified'}</p>
          </div>
          {employee.loyalty_bonus_specific_condition && (
            <div className="col-span-2">
              <p className="font-medium">Specific Conditions:</p>
              <p className="text-muted-foreground">{employee.loyalty_bonus_specific_condition}</p>
            </div>
          )}
        </div>

        {/* Installments */}
        <div>
          <h4 className="font-medium mb-3">Installment Schedule</h4>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((installment) => {
              const amountKey = `loyalty_bonus_installment_${installment}_amount` as keyof Employee;
              const dateKey = `loyalty_bonus_installment_${installment}_date` as keyof Employee;
              const disbursedKey = `loyalty_bonus_installment_${installment}_disbursed` as keyof Employee;
              
              const amount = employee[amountKey] as string;
              const date = employee[dateKey] as string;
              const disbursed = employee[disbursedKey] as boolean;
              
              if (!amount && !date) return null;
              
              return (
                <div key={installment} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Installment {installment}</p>
                    <p className="text-xs text-muted-foreground">
                      Amount: ₹ {amount || 'Not calculated'} | 
                      Date: {date ? formatDateForDisplay(date, 'MMM dd, yyyy') : 'Not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={disbursed ? 'default' : 'secondary'}>
                      {disbursed ? 'Disbursed' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CTCEdit({ form }: { form: any }) {
  console.log('🏗️ CTCEdit rendering', { 
    monthly_ctc: form.getValues('monthly_ctc'),
    total_deductions: form.getValues('total_deductions')
  });

  // State to track if form is ready (to prevent premature auto-calculation)
  const [isFormReady, setIsFormReady] = React.useState(false);

  // Watch for changes in salary and recalculate
  const watchedSalary = form.watch('salary');
  const watchedPFApplicable = form.watch('pf_applicable');
  const watchedESIApplicable = form.watch('esi_applicable');
  const watchedNightAllowance = form.watch('night_allowance');
  const watchedGroupInsurance = form.watch('group_medical_insurance');
  const watchedTDS = form.watch('tds');
  const watchedProfessionalTax = form.watch('professional_tax');

  // Effect to mark form as ready after a short delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsFormReady(true);
      console.log('📋 CTCEdit form marked as ready, current values:', {
        monthly_ctc: form.getValues('monthly_ctc'),
        monthly_basic_pay: form.getValues('monthly_basic_pay'),
        total_deductions: form.getValues('total_deductions'),
        pf_applicable: form.getValues('pf_applicable'),
        esi_applicable: form.getValues('esi_applicable')
      });
    }, 200); // Increased delay to allow form initialization

    return () => clearTimeout(timer);
  }, [form]);

  // Track previous values to detect actual changes
  const prevValuesRef = React.useRef({
    salary: watchedSalary,
    pf_applicable: watchedPFApplicable,
    esi_applicable: watchedESIApplicable,
    night_allowance: watchedNightAllowance,
    group_medical_insurance: watchedGroupInsurance,
    tds: watchedTDS,
    professional_tax: watchedProfessionalTax
  });

  // Auto-calculate fields when dependencies change (rounding to ceiling values)
  React.useEffect(() => {
    // Skip if form is not ready yet (prevents overwriting database values during initialization)
    if (!isFormReady) {
      console.log('⏳ Skipping calculation - form not ready yet');
      return;
    }

    // Skip if no salary value
    if (!watchedSalary || watchedSalary <= 0) {
      return;
    }

    // Check if monthly_ctc exists in database - if so, NEVER auto-calculate
    const existingMonthlyCTC = form.getValues('monthly_ctc');
    const existingBasicPay = form.getValues('monthly_basic_pay');
    const existingTotalDeductions = form.getValues('total_deductions');
    
    // More robust check - if ANY of the key CTC fields have values, skip auto-calculation
    const hasExistingCTCData = (existingMonthlyCTC && existingMonthlyCTC !== '') || 
                               (existingBasicPay && existingBasicPay !== '') ||
                               (existingTotalDeductions && existingTotalDeductions !== '');

    // If CTC data exists in database, completely disable auto-calculation
    if (hasExistingCTCData) {
      console.log('✅ Skipping calculation - DB values exist', {
        monthly_ctc: existingMonthlyCTC,
        monthly_basic_pay: existingBasicPay,
        total_deductions: existingTotalDeductions
      });
      // Update refs to prevent future calculations
      prevValuesRef.current = {
        salary: watchedSalary,
        pf_applicable: watchedPFApplicable,
        esi_applicable: watchedESIApplicable,
        night_allowance: watchedNightAllowance,
        group_medical_insurance: watchedGroupInsurance,
        tds: watchedTDS,
        professional_tax: watchedProfessionalTax
      };
      return;
    }

    // Check if any dependency actually changed
    const hasChanged = 
      prevValuesRef.current.salary !== watchedSalary ||
      prevValuesRef.current.pf_applicable !== watchedPFApplicable ||
      prevValuesRef.current.esi_applicable !== watchedESIApplicable ||
      prevValuesRef.current.night_allowance !== watchedNightAllowance ||
      prevValuesRef.current.group_medical_insurance !== watchedGroupInsurance ||
      prevValuesRef.current.tds !== watchedTDS ||
      prevValuesRef.current.professional_tax !== watchedProfessionalTax;

    // Only recalculate if dependencies changed
    if (!hasChanged) {
      return;
    }

    console.log('🧮 Running auto-calculation for new employee or changed values');

    // Update refs with current values
    prevValuesRef.current = {
      salary: watchedSalary,
      pf_applicable: watchedPFApplicable,
      esi_applicable: watchedESIApplicable,
      night_allowance: watchedNightAllowance,
      group_medical_insurance: watchedGroupInsurance,
      tds: watchedTDS,
      professional_tax: watchedProfessionalTax
    };

    if (watchedSalary && watchedSalary > 0) {
      // Calculate ALL values from original unrounded values first
      const monthlyCTCValue = watchedSalary / 12;
      const monthlyBasicValue = monthlyCTCValue * 0.51;
      const hraValue = monthlyBasicValue * 0.40;
      const nightAllowanceValue = parseFloat(watchedNightAllowance || '2000');
      const groupInsuranceValue = parseFloat(watchedGroupInsurance || '138');
      
      // Calculate employer contributions from original values
      const employerPFValue = watchedPFApplicable ? monthlyBasicValue * 0.12 : 0;
      const gratuityValue = ((monthlyBasicValue * 15) / 26) / 12;
      const bonusValue = monthlyBasicValue < 21000 ? monthlyBasicValue * 0.0833 : 0;
      
      // Calculate initial monthly gross (without special allowance) from original values for ESI calculation
      const initialMonthlyGrossValue = monthlyBasicValue + hraValue + nightAllowanceValue;
      const employerESIValue = (watchedESIApplicable && initialMonthlyGrossValue < 21000) ? initialMonthlyGrossValue * 0.0325 : 0;
      
      // Calculate special allowance from original values (balancing figure)
      const specialAllowanceValue = monthlyCTCValue - (monthlyBasicValue + hraValue + nightAllowanceValue + employerPFValue + employerESIValue + gratuityValue + bonusValue + groupInsuranceValue);
      
      // Calculate monthly gross from original values
      // Monthly Gross = Monthly Basic Pay + HRA + Night Allowance + Special Allowance
      const monthlyGrossValue = monthlyBasicValue + hraValue + nightAllowanceValue + specialAllowanceValue;

      // Calculate employee deductions from original values
      const employeePFValue = watchedPFApplicable ? monthlyBasicValue * 0.12 : 0;
      const employeeESIValue = watchedESIApplicable ? monthlyBasicValue * 0.0075 : 0;
      const tdsValue = parseFloat(watchedTDS || '0');
      const professionalTaxValue = parseFloat(watchedProfessionalTax || '200');
      
      // Calculate totals from original values
      const totalDeductionsValue = employeePFValue + employeeESIValue + tdsValue + professionalTaxValue;
      const netPayValue = monthlyGrossValue - totalDeductionsValue;
      const takeHomeValue = netPayValue + bonusValue;

      // Apply ceiling to each final result independently
      // Note: nightAllowance, groupInsurance, tds, and professionalTax are user-editable fields,
      // so we don't set them here - we only use their values in calculations
      const monthlyCTC = Math.ceil(monthlyCTCValue);
      const monthlyBasic = Math.ceil(monthlyBasicValue);
      const hra = Math.ceil(hraValue);
      const employerPF = Math.ceil(employerPFValue);
      const gratuity = Math.ceil(gratuityValue);
      const bonus = Math.ceil(bonusValue);
      const employerESI = Math.ceil(employerESIValue);
      const specialAllowance = Math.ceil(specialAllowanceValue);
      const monthlyGross = Math.ceil(monthlyGrossValue);
      const employeePF = Math.ceil(employeePFValue);
      const employeeESI = Math.ceil(employeeESIValue);
      const totalDeductions = Math.ceil(totalDeductionsValue);
      const netPay = Math.ceil(netPayValue);
      const takeHome = Math.ceil(takeHomeValue);

      // Update form values with ceiling rounded values (whole numbers)
      form.setValue('monthly_ctc', monthlyCTC.toString());
      form.setValue('monthly_basic_pay', monthlyBasic.toString());
      form.setValue('hra', hra.toString());
      form.setValue('special_allowance', specialAllowance.toString());
      form.setValue('monthly_gross', monthlyGross.toString());
      form.setValue('employer_pf', employerPF.toString());
      form.setValue('employer_esi', employerESI.toString());
      form.setValue('monthly_gratuity_provision', gratuity.toString());
      form.setValue('monthly_bonus_provision', bonus.toString());
      form.setValue('pf_employee', employeePF.toString());
      form.setValue('esi_employee', employeeESI.toString());
      form.setValue('total_deductions', totalDeductions.toString());
      form.setValue('net_pay', netPay.toString());
      form.setValue('monthly_take_home_salary', takeHome.toString());
    }
  }, [isFormReady, watchedSalary, watchedPFApplicable, watchedESIApplicable, watchedNightAllowance, watchedGroupInsurance, watchedTDS, watchedProfessionalTax, form]);

  // Loyalty bonus calculation
  const watchedLoyaltyAmount = form.watch('loyalty_bonus_amount');
  const watchedTenurePeriod = form.watch('loyalty_bonus_tenure_period');
  const watchedEnrollmentDate = form.watch('loyalty_bonus_enrollment_date');

  // Track previous loyalty bonus values to detect actual changes
  const prevLoyaltyRef = React.useRef({
    loyalty_bonus_amount: watchedLoyaltyAmount,
    loyalty_bonus_tenure_period: watchedTenurePeriod,
    loyalty_bonus_enrollment_date: watchedEnrollmentDate
  });

  React.useEffect(() => {
    // Skip if form is not ready yet
    if (!isFormReady) {
      return;
    }

    // Skip if required fields are missing
    if (!watchedLoyaltyAmount || !watchedTenurePeriod || !watchedEnrollmentDate) {
      return;
    }

    // Check if installment amounts exist in database - if so, NEVER auto-calculate
    const existingInstallment1 = form.getValues('loyalty_bonus_installment_1_amount');
    const hasExistingInstallments = existingInstallment1 && existingInstallment1 !== '';

    // If installment amounts exist in database, completely disable auto-calculation
    if (hasExistingInstallments) {
      console.log('✅ Skipping loyalty bonus calculation - DB values exist');
      // Update refs to prevent future calculations
      prevLoyaltyRef.current = {
        loyalty_bonus_amount: watchedLoyaltyAmount,
        loyalty_bonus_tenure_period: watchedTenurePeriod,
        loyalty_bonus_enrollment_date: watchedEnrollmentDate
      };
      return;
    }

    // Check if any dependency actually changed
    const hasChanged = 
      prevLoyaltyRef.current.loyalty_bonus_amount !== watchedLoyaltyAmount ||
      prevLoyaltyRef.current.loyalty_bonus_tenure_period !== watchedTenurePeriod ||
      prevLoyaltyRef.current.loyalty_bonus_enrollment_date !== watchedEnrollmentDate;

    // Only recalculate if dependencies changed
    if (!hasChanged) {
      return;
    }

    console.log('🧮 Running loyalty bonus calculation');

    // Update refs with current values
    prevLoyaltyRef.current = {
      loyalty_bonus_amount: watchedLoyaltyAmount,
      loyalty_bonus_tenure_period: watchedTenurePeriod,
      loyalty_bonus_enrollment_date: watchedEnrollmentDate
    };

    if (watchedLoyaltyAmount && watchedTenurePeriod && watchedEnrollmentDate) {
      const amount = parseFloat(watchedLoyaltyAmount);
      const tenure = parseFloat(watchedTenurePeriod);
      const installments = tenure * 2; // 2 installments per year
      const installmentAmount = Math.ceil(amount / installments).toString();
      
      const enrollmentDate = new Date(watchedEnrollmentDate);
      
      // Calculate installment amounts and dates
      for (let i = 1; i <= 6; i++) {
        if (i <= installments) {
          form.setValue(`loyalty_bonus_installment_${i}_amount`, installmentAmount);
          
          // Calculate date (6 months apart)
          const installmentDate = new Date(enrollmentDate);
          installmentDate.setMonth(installmentDate.getMonth() + (i * 6));
          form.setValue(`loyalty_bonus_installment_${i}_date`, installmentDate.toISOString().split('T')[0]);
        } else {
          form.setValue(`loyalty_bonus_installment_${i}_amount`, '');
          form.setValue(`loyalty_bonus_installment_${i}_date`, '');
        }
      }
    }
  }, [isFormReady, watchedLoyaltyAmount, watchedTenurePeriod, watchedEnrollmentDate, form]);

  // Show loading state while form is being initialized
  if (!isFormReady) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Initializing form...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Annual CTC Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Annual CTC</h3>
        <FormField
          control={form.control}
          name="salary"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Annual CTC *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Enter annual CTC" 
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Salary Annexure Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Salary Annexure</h3>
        
        {/* Applicability Checkboxes */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <FormField
            control={form.control}
            name="pf_applicable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="mt-1"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-medium text-gray-700">
                    PF Applicable
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Employee discretion at time of joining
                  </p>
                </div>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="esi_applicable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="mt-1"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-medium text-gray-700">
                    ESI Applicable
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Triggers only if Monthly Gross &lt; Rs. 21,000
                  </p>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* Core Salary Fields */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <FormField
            control={form.control}
            name="monthly_ctc"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Monthly CTC</FormLabel>
                <FormControl>
                  <Input 
                    type="text" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="mt-1" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Annual CTC ÷ 12 (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="monthly_basic_pay"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Monthly Basic Pay</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated"
                    onChange={(e) => field.onChange(e.target.value)}
                    className="mt-1" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">51% of Monthly CTC (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hra"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">HRA</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="mt-1" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">40% of Monthly Basic Pay (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="night_allowance"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Night Allowance</FormLabel>
                <FormControl>
                  <Input  
                    type="number" 
                    step="0.01"
                    {...field} 
                    placeholder="2000" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="mt-1" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Default: Rs. 2000 (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="special_allowance"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Special Allowance</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="mt-1" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Monthly CTC - (Basic + HRA + Night + Employer contributions) (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="monthly_gross"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Monthly Gross</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="mt-1" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Sum of all allowances (editable)</p>
              </FormItem>
            )}
          />
        </div>

        {/* Employer Contributions */}
        <div className="mb-6">
          <h4 className="font-medium mb-3">Employer Contributions</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="employer_pf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Employer PF</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Auto-calculated" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">12% of Basic Pay (when PF enabled) (editable)</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employer_esi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Employer ESI</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Auto-calculated" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">3.25% of Monthly Gross (if &lt; Rs. 21,000) (editable)</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monthly_gratuity_provision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Monthly Gratuity (Provision)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Auto-calculated" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">[(Basic × 15) ÷ 26] ÷ 12 (editable)</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monthly_bonus_provision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Monthly Bonus (Provision)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Auto-calculated" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Basic × 8.33% (if Basic &lt; Rs. 21,000) (editable)</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_medical_insurance"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-sm font-medium text-gray-700">Group Medical Insurance</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="138" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Default: Rs. 138 (editable)</p>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Employee Deductions */}
        <div className="mb-6">
          <h4 className="font-medium mb-3">Employee Deductions</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="pf_employee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">PF Employee</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Auto-calculated" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">12% of Basic Pay (editable)</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="esi_employee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">ESI Employee</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Auto-calculated" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">0.75% of Basic Pay (editable)</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">TDS</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="Enter TDS amount" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Manual entry</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="professional_tax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Professional Tax</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      {...field} 
                      placeholder="200" 
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Default: Rs. 200 (editable)</p>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Final Calculations */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="total_deductions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Total Deductions</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="bg-red-50" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Sum of all deductions (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="net_pay"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Net Pay</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="bg-green-50" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Monthly Gross - Total Deductions (editable)</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="monthly_take_home_salary"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Monthly Take Home</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    value={field.value || ''}
                    placeholder="Auto-calculated" 
                    onChange={(e) => field.onChange(e.target.value)}
                    className="bg-blue-50" 
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Net Pay + Monthly Bonus (editable)</p>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Loyalty Bonus Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Loyalty Bonus</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <FormField
            control={form.control}
            name="loyalty_bonus_enrollment_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Enrollment Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="mt-1" />
                </FormControl>
                <p className="text-xs text-muted-foreground">Generally same as date of joining</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="loyalty_bonus_tenure_period"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Tenure Period (Years)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="3" className="mt-1" />
                </FormControl>
                <p className="text-xs text-muted-foreground">Default: 3 years</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="loyalty_bonus_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Total Loyalty Bonus Amount</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter total bonus amount" className="mt-1" />
                </FormControl>
                <p className="text-xs text-muted-foreground">Will be divided into installments</p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="loyalty_bonus_specific_condition"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Specific Conditions</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter any specific conditions" className="mt-1" />
                </FormControl>
                <p className="text-xs text-muted-foreground">Optional conditions</p>
              </FormItem>
            )}
          />
        </div>

        {/* Installment Schedule */}
        <div>
          <h4 className="font-medium mb-3">Installment Schedule</h4>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((installment) => (
              <div key={installment} className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm mb-2">Installment {installment}</p>
                </div>
                
                <FormField
                  control={form.control}
                  name={`loyalty_bonus_installment_${installment}_amount`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Amount</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="Auto-calculated" readOnly className="bg-white text-sm" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`loyalty_bonus_installment_${installment}_date`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} readOnly className="bg-white text-sm" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`loyalty_bonus_installment_${installment}_disbursed`}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-xs">Disbursed</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}