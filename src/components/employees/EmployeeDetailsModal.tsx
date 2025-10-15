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
  useCreateDocumentType 
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
import {
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
  AlertTriangle
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
  employment_terms: z.enum(['part_time', 'full_time', 'associate', 'contract', 'internship']).optional(),
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
  const { user } = useAuth();
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

  // Incident-related hooks
  const { data: employeeIncidents } = useEmployeeIncidents(employee?.id || '');
  const createIncidentMutation = useCreateIncident();
  const updateIncidentMutation = useUpdateIncident();
  const deleteIncidentMutation = useDeleteIncident();
  const uploadIncidentAttachmentMutation = useUploadIncidentAttachment();
  const removeIncidentAttachmentMutation = useRemoveIncidentAttachment();

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
      address: '',
      permanent_address: '',
      date_of_birth: '',
      date_of_joining: '',
      role_id: '',
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
    },
  });

  // Track previous employee and mode to reset form when needed
  const prevModeRef = React.useRef(mode);
  const prevEmployeeRef = React.useRef(employee?.id);
  
  // Reset form when switching to edit mode OR when employee changes
  React.useEffect(() => {
    if (employee && mode === 'edit' && (prevModeRef.current !== 'edit' || prevEmployeeRef.current !== employee.id)) {
      form.reset({
        id: employee.id,
        full_name: employee.full_name,
        employee_id: employee.employee_id || '',
        email: employee.email,
        company_email: employee.company_email || '',
        personal_email: employee.personal_email || '',
        phone: employee.phone || '',
        alternate_contact_no: employee.alternate_contact_no || '',
        position: employee.position || '',
        designation_offer_letter: employee.designation_offer_letter || '',
        salary: employee.salary || 0,
        address: employee.address || '',
        permanent_address: employee.permanent_address || '',
        date_of_birth: employee.date_of_birth || '',
        date_of_joining: employee.date_of_joining || '',
        role_id: employee.role_id || '',
        department_id: employee.department_id || '',
        manager_id: employee.manager_id || 'none',
        status: employee.status || 'active',
        level_grade: employee.level_grade || '',
        skill: employee.skill || [],
        current_office_location: employee.current_office_location || '',
        blood_group: employee.blood_group || '',
        religion: employee.religion || '',
        gender: employee.gender || undefined,
        marital_status: employee.marital_status || undefined,
        date_of_marriage_anniversary: employee.date_of_marriage_anniversary || '',
        father_name: employee.father_name || '',
        father_dob: employee.father_dob || '',
        mother_name: employee.mother_name || '',
        mother_dob: employee.mother_dob || '',
        aadhar_card_no: employee.aadhar_card_no || '',
        pan_no: employee.pan_no || '',
        bank_account_no: employee.bank_account_no || '',
        ifsc_code: employee.ifsc_code || '',
        qualification: employee.qualification || '',
        employment_terms: employee.employment_terms || 'full_time',
        // New onboarding fields
        appointment_formalities: employee.appointment_formalities || 'Not Done',
        orientation: employee.orientation || 'Not Done',
        order_id_card: employee.order_id_card || 'No',
        email_account: employee.email_account || 'N/A',
        skype_account: employee.skype_account || 'N/A',
        system_account: employee.system_account || 'N/A',
        added_to_mailing_list: employee.added_to_mailing_list || 'No',
        added_to_attendance_sheet: employee.added_to_attendance_sheet || 'No',
        confluence_info_provided: employee.confluence_info_provided || 'No',
        id_card_provided: employee.id_card_provided || 'N/A',
        remarks: employee.remarks || '',
        uan_number: employee.uan_number || '',
        is_experienced: employee.is_experienced || 'No',
      });
    }
    
    // Update the previous references
    prevModeRef.current = mode;
    prevEmployeeRef.current = employee?.id;
  }, [employee, mode, form]);


  const onEmployeeSubmit = async (data: EmployeeFormData) => {
    if (!employee) return;

    // Coerce empty selects to null to avoid uuid parsing errors
    const safeUpdates = {
      ...data,
      role_id: data.role_id || null,
      department_id: data.department_id || null,
      manager_id: data.manager_id === 'none' ? null : data.manager_id || null,
      salary: data.salary || null,
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
    };

    updateEmployee.mutate({
      id: employee.id,
      updates: safeUpdates
    }, {
      onSuccess: () => {
        // Don't change mode - keep in edit mode after saving
        // Don't reset form - keep user inputs intact
        // toast.success('Changes saved successfully!');
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
            {mode === 'edit' ? 'Edit Employee' : 'Employee Details'}
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
            employee={employee}
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
            newDocumentType={newDocumentType}
            setNewDocumentType={setNewDocumentType}
            uploadingDocumentId={uploadingDocumentId}
            downloadingAll={downloadingAll}
            documentTypes={documentTypes}
            employeeDocuments={employeeDocuments}
            createDocumentType={createDocumentType}
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
            removeIncidentAttachment={removeIncidentAttachmentMutation}
          />
        ) : (
          <EditMode
            employee={employee}
            form={form}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onEmployeeSubmit={onEmployeeSubmit}
            updateEmployee={updateEmployee}
            departmentOptions={departmentOptions}
            roleOptions={roleOptions}
            userOptions={userOptions}
            onModeChange={onModeChange}
            getDocumentStatusBadge={getDocumentStatusBadge}
            handleDownloadDocument={handleDownloadDocument}
            handleViewDocument={handleViewDocument}
            handleDownloadAllDocuments={handleDownloadAllDocuments}
            handleFileUpload={handleFileUpload}
            handleRequestDocument={handleRequestDocument}
            handleDeleteDocument={handleDeleteDocument}
            handleCreateCustomDocumentType={handleCreateCustomDocumentType}
            newDocumentType={newDocumentType}
            setNewDocumentType={setNewDocumentType}
            uploadingDocumentId={uploadingDocumentId}
            downloadingAll={downloadingAll}
            documentTypes={documentTypes}
            employeeDocuments={employeeDocuments}
            createDocumentType={createDocumentType}
            requestDocument={requestDocument}
            deleteDocument={deleteDocument}
            permissions={permissions}
            // Incident props
            employeeIncidents={employeeIncidents}
            createIncident={createIncidentMutation}
            updateIncident={updateIncidentMutation}
            deleteIncident={deleteIncidentMutation}
            uploadIncidentAttachment={uploadIncidentAttachmentMutation}
            removeIncidentAttachment={removeIncidentAttachmentMutation}
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
  newDocumentType,
  setNewDocumentType,
  uploadingDocumentId,
  downloadingAll,
  documentTypes,
  employeeDocuments,
  createDocumentType,
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
  removeIncidentAttachment
}: any) {
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
                 employee.employment_terms === 'internship' ? 'Internship' : 'Not specified'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 gap-1 flex-shrink-0">
          <TabsTrigger value="basic" className="flex items-center gap-2 text-xs sm:text-sm">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Basic Info</span>
            <span className="sm:hidden">Basic</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2 text-xs sm:text-sm">
            <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Contact</span>
            <span className="sm:hidden">Contact</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2 text-xs sm:text-sm">
            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Personal</span>
            <span className="sm:hidden">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="work" className="flex items-center gap-2 text-xs sm:text-sm">
            <Building className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Work Details</span>
            <span className="sm:hidden">Work</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2 text-xs sm:text-sm">
            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Onboarding</span>
            <span className="sm:hidden">Onboard</span>
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-2 text-xs sm:text-sm">
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Incidents</span>
            <span className="sm:hidden">Incidents</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2 text-xs sm:text-sm">
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
              newDocumentType={newDocumentType}
              setNewDocumentType={setNewDocumentType}
              uploadingDocumentId={uploadingDocumentId}
              downloadingAll={downloadingAll}
              documentTypes={documentTypes}
              employeeDocuments={employeeDocuments}
              createDocumentType={createDocumentType}
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
  getDocumentStatusBadge,
  handleDownloadDocument,
  handleViewDocument,
  handleDownloadAllDocuments,
  handleFileUpload,
  handleRequestDocument,
  handleDeleteDocument,
  handleCreateCustomDocumentType,
  newDocumentType,
  setNewDocumentType,
  uploadingDocumentId,
  downloadingAll,
  documentTypes,
  employeeDocuments,
  createDocumentType,
  requestDocument,
  deleteDocument,
  permissions,
  // Incident props
  employeeIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  uploadIncidentAttachment,
  removeIncidentAttachment
}: any) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onEmployeeSubmit)} className="flex flex-col flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 gap-2 flex-shrink-0">
            <TabsTrigger value="basic" className="flex items-center gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Basic Info</span>
              <span className="sm:hidden">Basic</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-2 text-xs sm:text-sm">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Contact</span>
              <span className="sm:hidden">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2 text-xs sm:text-sm">
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Personal</span>
              <span className="sm:hidden">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="work" className="flex items-center gap-2 text-xs sm:text-sm">
              <Building className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Work Details</span>
              <span className="sm:hidden">Work</span>
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex items-center gap-2 text-xs sm:text-sm">
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Onboarding</span>
              <span className="sm:hidden">Onboard</span>
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2 text-xs sm:text-sm">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Incidents</span>
              <span className="sm:hidden">Incidents</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 text-xs sm:text-sm">
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
              />
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
                newDocumentType={newDocumentType}
                setNewDocumentType={setNewDocumentType}
                uploadingDocumentId={uploadingDocumentId}
                downloadingAll={downloadingAll}
                documentTypes={documentTypes}
                employeeDocuments={employeeDocuments}
                createDocumentType={createDocumentType}
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
            disabled={updateEmployee.isPending}
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
          <p className="font-medium">Role:</p>
          <p className="text-muted-foreground capitalize">{getRoleDisplayName(employee.role?.name || '') || 'Not assigned'}</p>
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
             employee.employment_terms === 'internship' ? 'Internship' : 'Not specified'}
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

      {employee.salary && (
        <div className="p-4 bg-green-50 rounded-lg mt-4">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="h-4 w-4 text-green-600" />
            <span className="font-medium">Salary Information</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            ₹ {employee.salary.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Annual salary</p>
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
  newDocumentType,
  setNewDocumentType,
  uploadingDocumentId,
  downloadingAll,
  documentTypes,
  employeeDocuments,
  createDocumentType,
  requestDocument,
  deleteDocument,
  permissions,
  mode
}: any) {
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
        
        {documentTypes && documentTypes.length > 0 ? (
          <div className="grid gap-4">
            {documentTypes.map((docType: any) => {
              const existingDoc = employeeDocuments?.find((doc: any) => doc.document_type_id === docType.id);
              const isUploading = uploadingDocumentId === docType.id;
              
              return (
                <Card key={docType.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{docType.name}</h4>
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
                            Custom
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
                            accept="application/pdf"
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

function WorkInfoEdit({ form, departmentOptions, roleOptions, userOptions, employee, permissions }: any) {
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
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="salary"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Annual Salary</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Enter salary" 
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