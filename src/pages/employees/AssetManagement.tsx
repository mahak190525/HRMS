import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { 
  useAssets, 
  useAssetAssignments, 
  useAssetCategories, 
  useAvailableAssets,
  useCreateAssetAssignment,
  useCreateAsset,
  useAllEmployees,
  useUpdateAsset,
  useUpdateAssetAssignment,
  useDeleteAssetAssignment,
  useCreateVM,
  useUpdateVM,
  useVMByAssetId,
  useCreateAssetCategory,
  useUnassignAsset,
  useUnassignSpecificUser,
  useAllNotesGuidance,
  useCreateNotesGuidance,
  useUpdateNotesGuidance,
  useDeleteNotesGuidance,
  useUsersWithAssignmentHistory,
  useUserAssignmentLogs,
  useAllAssetAssignments,
  useAllAssetComplaints,
  useUpdateAssetComplaint,
  useAllAssetRequests,
  useManagerAssetRequests,
  useManagerAssetComplaints,
  useUpdateAssetRequest
} from '@/hooks/useEmployees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDelete } from '@/components/ui/confirm-delete';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Package,
  Plus,
  Monitor,
  Smartphone,
  HardDrive,
  Keyboard,
  Mouse,
  Headphones,
  Eye,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  Server,
  FileText,
  Briefcase,
  Key,
  Network,
  Shield,
  Download,
  FileDown,
  Filter as FilterIcon,
  MapPin,
  ChevronDown,
  ChevronRight,
  Users,
  Clock,
  AlertTriangle,
  Archive,
  CheckCircle2
} from 'lucide-react';
import { formatDateForDisplay as formatDateForDisplayUtil, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAssetRetrievalNotifications } from '@/hooks/useAssetRetrievalNotifications';
import {
  exportAssetAssignmentsToExcel,
  exportAssetAssignmentsToPDF,
  exportAssetsToExcel,
  exportAssetsToPDF,
  exportVMsToExcel,
  exportVMsToPDF,
  exportComplaintsToExcel,
  exportComplaintsToPDF,
  applyFilters
} from '@/utils/exportUtils';
import { useUserStatuses } from '@/hooks/useUserStatuses';
import { AssetImageUpload } from '@/components/assets/AssetImageUpload';

const assetIcons = {
  laptop: Monitor,
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Smartphone,
  storage: HardDrive,
  keyboard: Keyboard,
  mouse: Mouse,
  headphones: Headphones,
  other: Package
};

const assignmentSchema = z.object({
  asset_id: z.string().min(1, 'Please select an asset'),
  user_ids: z.array(z.string()).min(1, 'Please select at least one employee'),
  assignment_type: z.string().min(1, 'Please select assignment type'),
  assignment_expiry_date: z.date().optional(),
  condition_at_issuance: z.string().min(1, 'Please select asset condition'),
  issuance_condition_notes: z.string().optional(),
  notes: z.string().optional(),
});

const editAssignmentSchema = z.object({
  asset_id: z.string().min(1, 'Please select an asset'),
  user_id: z.string().min(1, 'Please select an employee'),
  assignment_type: z.string().min(1, 'Please select assignment type'),
  assignment_expiry_date: z.date().optional(),
  condition_at_issuance: z.string().min(1, 'Please select asset condition'),
  issuance_condition_notes: z.string().optional(),
  return_condition_notes: z.string().optional(),
  notes: z.string().optional(),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;
type EditAssignmentFormData = z.infer<typeof editAssignmentSchema>;

const assetSchema = z.object({
  asset_tag: z.string().min(1, 'Asset tag is required'),
  name: z.string().min(1, 'Asset name is required'),
  category_id: z.string().min(1, 'Please select a category'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  purchase_date: z.date().optional(),
  purchase_cost: z.number().min(0, 'Purchase cost must be positive').optional(),
  warranty_expiry: z.date().optional(),
  location: z.string().optional(),
  condition: z.string().min(1, 'Please select condition'),
  status: z.string().min(1, 'Please select status'),
  notes: z.string().optional(),
  // New extended fields
  insurance_warranty_extended: z.date().optional(),
  previous_audit_date: z.date().optional(),
  hardware_image_date: z.date().optional(),
  invoice_copy_link: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  warranty_document_link: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  // For dynamic category creation
  new_category_name: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

const vmSchema = z.object({
  vm_number: z.string().min(1, 'VM Number is required'),
  vm_location: z.string().min(1, 'Please select VM location'),
  access_type: z.string().min(1, 'Please select access type'),
  requested_by: z.string().min(1, 'Requested by is required'),
  approved_by: z.string().min(1, 'Approved by is required'),
  created_by: z.string().min(1, 'Created by is required'),
  current_user_type: z.string().min(1, 'Please select current user type'),
  purpose: z.string().min(1, 'Please select purpose'),
  project_name: z.string().min(1, 'Project name is required'),
  username: z.string().min(1, 'ID or Username is required'),
  current_password: z.string().min(1, 'Current password is required'),
  previous_password: z.string().optional(),
  ip_address: z.string().min(1, 'IP Address is required'),
  ghost_ip: z.string().optional(),
  vpn_requirement: z.string().min(1, 'Please select VPN requirement'),
  mfa_enabled: z.string().min(1, 'Please select MFA status'),
  approval_date: z.date().optional(),
  request_ticket_id: z.string().min(1, 'Request Ticket ID is required'),
  expiry_date: z.date().optional(),
  cloud_provider: z.string().min(1, 'Please select cloud provider'),
  backup_enabled: z.string().min(1, 'Please select backup status'),
  audit_status: z.string().min(1, 'Please select audit status'),
});

type VMFormData = z.infer<typeof vmSchema>;

const notesGuidanceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  guidance_text: z.string().min(1, 'Guidance text is required'),
});

type NotesGuidanceFormData = z.infer<typeof notesGuidanceSchema>;

const complaintResolutionSchema = z.object({
  status: z.string().min(1, 'Please select status'),
  priority: z.string().min(1, 'Please select priority'),
  resolution_notes: z.string().optional(),
});

type ComplaintResolutionFormData = z.infer<typeof complaintResolutionSchema>;

const assetRequestActionSchema = z.object({
  status: z.string().min(1, 'Please select action'),
  approval_notes: z.string().optional(),
  rejection_reason: z.string().optional(),
  fulfilled_asset_id: z.string().optional(),
});

type AssetRequestActionFormData = z.infer<typeof assetRequestActionSchema>;

export function AssetManagement() {
  const { user } = useAuth();
  const permissions = useEmployeePermissions();
  const { data: assets } = useAssets();
  const { data: assignments, isLoading: assignmentsLoading } = useAssetAssignments();
  const { data: allAssignments } = useAllAssetAssignments(); // New: includes all assignments (active + returned)
  const { data: categories } = useAssetCategories();
  const { data: availableAssets } = useAvailableAssets();
  const { data: employees } = useAllEmployees();
  const { data: usersWithHistory } = useUsersWithAssignmentHistory(); // New: users from assignment logs
  const createAssignment = useCreateAssetAssignment();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const updateAssignment = useUpdateAssetAssignment();
  const deleteAssignment = useDeleteAssetAssignment();
  const createVM = useCreateVM();
  const updateVM = useUpdateVM();
  const createAssetCategory = useCreateAssetCategory();
  const unassignAsset = useUnassignAsset();
  const unassignSpecificUser = useUnassignSpecificUser();
  const { data: allNotesGuidance, isLoading: guidanceLoading } = useAllNotesGuidance();
  const createNotesGuidance = useCreateNotesGuidance();
  const updateNotesGuidance = useUpdateNotesGuidance();
  const deleteNotesGuidance = useDeleteNotesGuidance();
  const { data: allComplaints } = useAllAssetComplaints();
  const updateComplaint = useUpdateAssetComplaint();
  // Use conditional hooks based on user permissions
  const { data: allAssetRequests } = useAllAssetRequests();
  const { data: managerAssetRequests } = useManagerAssetRequests(); 
  const { data: managerComplaints } = useManagerAssetComplaints();
  const updateAssetRequest = useUpdateAssetRequest();

  // Choose the appropriate data source based on user permissions
  // For managers: use ONLY manager-specific data
  // For HR/Admin: use all data
  const assetRequestsData = permissions.canViewAllEmployees ? allAssetRequests : managerAssetRequests;
  
  // Debug: Log the actual data being used
  console.log('AssetManagement - Final Data Debug:', {
    userRole: user?.role?.name,
    accessLevel: permissions.accessLevel,
    canViewAllEmployees: permissions.canViewAllEmployees,
    finalAssetRequestsData: assetRequestsData,
    finalAssetRequestsCount: assetRequestsData?.length || 0
  });
  // Filter employees based on permissions
  const filteredEmployees = permissions.canViewAllEmployees 
    ? employees 
    : employees?.filter((emp: any) => emp.manager_id === user?.id);

  // Filter assignments data based on permissions
  const assignmentsData = permissions.canViewAllEmployees 
    ? allAssignments 
    : allAssignments?.filter(assignment => assignment.user?.manager_id === user?.id);
  
  // Filter assets based on permissions - managers should see:
  // 1. Assets assigned to their team members
  // 2. Available assets (for potential assignment)
  const roleBasedFilteredAssets = permissions.canViewAllEmployees 
    ? assets 
    : assets?.filter(asset => {
        // Always show available assets
        if (!asset.current_assignment || asset.current_assignment.length === 0) {
          return true;
        }
        // Show assets assigned to team members
        return asset.current_assignment?.some((assignment: any) => 
          assignment.user?.manager_id === user?.id
        );
      });
  
  const complaintsData = permissions.canViewAllEmployees ? allComplaints : managerComplaints;

  // Debug logging for data selection
  console.log('AssetManagement - Data Selection Debug:', {
    canViewAllEmployees: permissions.canViewAllEmployees,
    allAssetRequestsCount: allAssetRequests?.length || 0,
    managerAssetRequestsCount: managerAssetRequests?.length || 0,
    selectedDataCount: assetRequestsData?.length || 0,
    selectedDataSource: permissions.canViewAllEmployees ? 'allAssetRequests' : 'managerAssetRequests',
    allAssignmentsCount: allAssignments?.length || 0,
    filteredAssignmentsCount: assignmentsData?.length || 0,
    allAssetsCount: assets?.length || 0,
    filteredAssetsCount: roleBasedFilteredAssets?.length || 0
  });
  
  // For VM data, we'll need to fetch directly from the API
  const [vmData, setVMData] = useState<any[]>([]);

  // Fetch VM data when component loads
  useEffect(() => {
    fetchVMData();
  }, []);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCreateAssetDialogOpen, setIsCreateAssetDialogOpen] = useState(false);
  const [isEditAssetDialogOpen, setIsEditAssetDialogOpen] = useState(false);
  const [isEditAssignmentDialogOpen, setIsEditAssignmentDialogOpen] = useState(false);
  const [isCreateVMDialogOpen, setIsCreateVMDialogOpen] = useState(false);
  const [isEditVMDialogOpen, setIsEditVMDialogOpen] = useState(false);
  const [isViewVMDialogOpen, setIsViewVMDialogOpen] = useState(false);
  const [selectedVM, setSelectedVM] = useState<any>(null);
  const [vmAssetId, setVMAssetId] = useState<string>('');
  const [isNotesGuidanceDialogOpen, setIsNotesGuidanceDialogOpen] = useState(false);
  const [isCreateGuidanceDialogOpen, setIsCreateGuidanceDialogOpen] = useState(false);
  const [isEditGuidanceDialogOpen, setIsEditGuidanceDialogOpen] = useState(false);
  const [selectedGuidance, setSelectedGuidance] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAssetRequest, setSelectedAssetRequest] = useState<any>(null);
  const [isViewAssetRequestDialogOpen, setIsViewAssetRequestDialogOpen] = useState(false);
  const [isAssetRequestActionDialogOpen, setIsAssetRequestActionDialogOpen] = useState(false);
  const [assetRequestAction, setAssetRequestAction] = useState<'approve' | 'reject' | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [isComplaintDetailsDialogOpen, setIsComplaintDetailsDialogOpen] = useState(false);
  const [isEditComplaintDialogOpen, setIsEditComplaintDialogOpen] = useState(false);
  
  // Get assignment logs for selected user
  const { data: userAssignmentLogs, isLoading: userLogsLoading, error: userLogsError } = useUserAssignmentLogs(selectedUserId);
  
  // Debug logging (temporary)
  // if (selectedUserId) {
  //   console.log('Selected User ID:', selectedUserId);
  //   console.log('User Assignment Logs:', userAssignmentLogs);
  //   console.log('User Logs Error:', userLogsError);
  // }
  
  // Filter states for each tab
  const [assignmentFilters, setAssignmentFilters] = useState({
    asset_name: '',
    user_name: '',
    status: 'all',
    category: 'all',
    assigned_by: '',
    employee_status: 'all'
  });
  
  const [assetFilters, setAssetFilters] = useState({
    name: '',
    asset_tag: '',
    category: 'all',
    brand: '',
    status: 'all',
    condition: 'all',
    location: ''
  });
  
  const [vmFilters, setVMFilters] = useState({
    vm_number: '',
    vm_location: '',
    project_name: '',
    cloud_provider: 'all',
    audit_status: 'all',
    purpose: ''
  });

  const [complaintFilters, setComplaintFilters] = useState({
    status: 'all',
    priority: 'all',
    user_name: '',
    asset_name: '',
    category: 'all',
    date_from: '',
    date_to: ''
  });
  
  // Filtered data for display (moved after filter state declarations)
  let filteredAssignments = [];
  let filteredAssets = [];
  let filteredVMs = [];
  let filteredComplaints = [];
  let enhancedUsersWithHistory = [];
  
  try {
    filteredAssignments = assignmentsData ? applyFilters(assignmentsData, assignmentFilters) : [];
    // Apply filters to assets - use role-based filtered assets as starting point
    let assetsToFilter = roleBasedFilteredAssets; // Use role-based filtered assets
    if (assetFilters.status === 'all') {
      // When no specific status is selected, exclude archived assets
      assetsToFilter = roleBasedFilteredAssets ? roleBasedFilteredAssets.filter(asset => asset.status !== 'archived') : [];
    }
    filteredAssets = assetsToFilter ? applyFilters(assetsToFilter, assetFilters) : [];
    filteredVMs = vmData ? applyFilters(vmData, vmFilters) : [];
    filteredComplaints = complaintsData ? applyFilters(complaintsData, complaintFilters) : [];
    
    // Enhanced users with assignment history from the new assignment logs system
    if (usersWithHistory && employees) {
      enhancedUsersWithHistory = usersWithHistory.map((userHistoryData: any) => {
        // Get current employee data for status and other details
        
        return {
          userId: userHistoryData.user_id,
          user: {
            id: userHistoryData.user_id,
            full_name: userHistoryData.user_name,
            employee_id: userHistoryData.user_employee_id,
            department: { name: userHistoryData.user_department },
            status: userHistoryData.user_status || 'active'
          },
          totalCount: userHistoryData.total_assignments,
          activeCount: userHistoryData.active_assignments,
          lastAssignmentDate: userHistoryData.last_assignment_date
        };
      }).sort((a: any, b: any) => a.user.full_name.localeCompare(b.user.full_name));
    }
  } catch (error) {
    console.error('Error computing filtered data:', error);
    filteredAssignments = assignmentsData || [];
    filteredAssets = assets || [];
    filteredVMs = vmData || [];
    filteredComplaints = complaintsData || [];
    enhancedUsersWithHistory = [];
  }
  
  // Hook to handle the recurring asset retrieval notifications
  useAssetRetrievalNotifications(enhancedUsersWithHistory);
  
  // Fetch VM data when needed for specific VM
  const { data: specificVMData, isLoading: vmDataLoading, error: vmDataError } = useVMByAssetId(vmAssetId);
  
  // Populate edit form when VM data is fetched
  
  // Fetch VM data on component mount
  useEffect(() => {
    fetchVMData();
  }, []);
  
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<any[]>([]);
  const [showExpiryDate, setShowExpiryDate] = useState(false);
  const [showEditExpiryDate, setShowEditExpiryDate] = useState(false);

  const assignmentForm = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      asset_id: '',
      user_ids: [],
      assignment_type: 'permanent',
      notes: '',
      condition_at_issuance: 'good',
      issuance_condition_notes: '',
    },
  });

  const editAssignmentForm = useForm<EditAssignmentFormData>({
    resolver: zodResolver(editAssignmentSchema),
    defaultValues: {
      asset_id: '',
      user_id: '',
      assignment_type: 'permanent',
      notes: '',
      condition_at_issuance: 'good',
      issuance_condition_notes: '',
      return_condition_notes: '',
    },
  });

  const assetForm = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      asset_tag: '',
      name: '',
      category_id: '',
      brand: '',
      model: '',
      serial_number: '',
      purchase_cost: 0,
      location: '',
      condition: 'good',
      status: 'available',
      notes: '',
      invoice_copy_link: '',
      warranty_document_link: '',
      new_category_name: '',
    },
  });

  const vmForm = useForm<VMFormData>({
    resolver: zodResolver(vmSchema),
    defaultValues: {
      vm_number: '',
      vm_location: '',
      access_type: '',
      requested_by: '',
      approved_by: '',
      created_by: '',
      current_user_type: '',
      purpose: '',
      project_name: '',
      username: '',
      current_password: '',
      previous_password: '',
      ip_address: '',
      ghost_ip: '',
      vpn_requirement: '',
      mfa_enabled: '',
      request_ticket_id: '',
      cloud_provider: '',
      backup_enabled: '',
      audit_status: '',
    },
  });

  const editVMForm = useForm<VMFormData>({
    resolver: zodResolver(vmSchema),
    defaultValues: {
      vm_number: '',
      vm_location: '',
      access_type: '',
      requested_by: '',
      approved_by: '',
      created_by: '',
      current_user_type: '',
      purpose: '',
      project_name: '',
      username: '',
      current_password: '',
      previous_password: '',
      ip_address: '',
      ghost_ip: '',
      vpn_requirement: '',
      mfa_enabled: '',
      request_ticket_id: '',
      cloud_provider: '',
      backup_enabled: '',
      audit_status: '',
    },
  });

  const createGuidanceForm = useForm<NotesGuidanceFormData>({
    resolver: zodResolver(notesGuidanceSchema),
    defaultValues: {
      title: '',
      guidance_text: '',
    },
  });

  const editGuidanceForm = useForm<NotesGuidanceFormData>({
    resolver: zodResolver(notesGuidanceSchema),
    defaultValues: {
      title: '',
      guidance_text: '',
    },
  });

  const editComplaintForm = useForm<ComplaintResolutionFormData>({
    resolver: zodResolver(complaintResolutionSchema),
    defaultValues: {
      status: '',
      priority: '',
      resolution_notes: '',
    },
  });

  const assetRequestActionForm = useForm<AssetRequestActionFormData>({
    resolver: zodResolver(assetRequestActionSchema),
    defaultValues: {
      status: '',
      approval_notes: '',
      rejection_reason: '',
      fulfilled_asset_id: '',
    },
  });

  // Populate edit guidance form when selected guidance is loaded
  useEffect(() => {
    if (selectedGuidance && isEditGuidanceDialogOpen) {
      editGuidanceForm.reset({
        title: selectedGuidance.title || '',
        guidance_text: selectedGuidance.guidance_text || '',
      });
    }
  }, [selectedGuidance, isEditGuidanceDialogOpen, editGuidanceForm]);

  // Populate edit complaint form when selected complaint is loaded
  useEffect(() => {
    if (selectedComplaint && isEditComplaintDialogOpen) {
      editComplaintForm.reset({
        status: selectedComplaint.status || '',
        priority: selectedComplaint.priority || 'medium',
        resolution_notes: selectedComplaint.resolution_notes || '',
      });
    }
  }, [selectedComplaint, isEditComplaintDialogOpen, editComplaintForm]);

  // Update selected user data when user ID changes
  useEffect(() => {
    // This effect is no longer needed since selectedUserData was removed
  }, [selectedUserId, employees]);

  // Populate edit form when VM data is fetched
  useEffect(() => {
    // Handle both cases: VM data from asset lookup (specificVMData) or direct VM data (selectedVM)
    const vmData = specificVMData || selectedVM;
    
    if (vmData && isEditVMDialogOpen) {
      if (specificVMData) {
        setSelectedVM(specificVMData);
      }
      editVMForm.reset({
        vm_number: vmData.vm_number || '',
        vm_location: vmData.vm_location || '',
        access_type: vmData.access_type || '',
        requested_by: vmData.requested_by || '',
        approved_by: vmData.approved_by || '',
        created_by: vmData.created_by || '',
        current_user_type: vmData.current_user_type || '',
        purpose: vmData.purpose || '',
        project_name: vmData.project_name || '',
        username: vmData.username || '',
        current_password: vmData.current_password || '',
        previous_password: vmData.previous_password || '',
        ip_address: vmData.ip_address || '',
        ghost_ip: vmData.ghost_ip || '',
        vpn_requirement: vmData.vpn_requirement || '',
        mfa_enabled: vmData.mfa_enabled || '',
        request_ticket_id: vmData.request_ticket_id || '',
        cloud_provider: vmData.cloud_provider || '',
        backup_enabled: vmData.backup_enabled || '',
        audit_status: vmData.audit_status || '',
        approval_date: createISTDate(vmData.approval_date),
        expiry_date: createISTDate(vmData.expiry_date),
      });
    }
  }, [specificVMData, selectedVM, isEditVMDialogOpen, editVMForm]);


  const onAssignmentSubmit = async (data: AssignmentFormData) => {
    if (!user) return;

    createAssignment.mutate({
      asset_id: data.asset_id,
      user_ids: data.user_ids,
      assigned_by: user.id,
      assignment_type: data.assignment_type,
      assignment_expiry_date: data.assignment_expiry_date ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      condition_at_issuance: data.condition_at_issuance,
      issuance_condition_notes: data.issuance_condition_notes,
      notes: data.notes
    }, {
      onSuccess: () => {
        assignmentForm.reset();
        setIsAssignDialogOpen(false);
        setSelectedEmployees([]);
        setShowExpiryDate(false);
      }
    });
  };

  const onAssetSubmit = async (data: AssetFormData) => {
    if (!user) return;

    let finalCategoryId = data.category_id;

    // Handle dynamic category creation
    if (data.category_id === 'create_new' && data.new_category_name) {
      try {
        const categoryId = await createAssetCategory.mutateAsync({
          name: data.new_category_name,
          description: `Custom category: ${data.new_category_name}`,
          depreciation_rate: 10.00
        });
        finalCategoryId = categoryId;
      } catch (error) {
        console.error('Failed to create category:', error);
        return;
      }
    }

    // Auto-archive when condition is damaged, unless status is manually set
    let finalStatus = data.status;
    if (data.condition === 'damaged' && data.status !== 'archived') {
      finalStatus = 'archived';
    }

    const assetData = {
      ...data,
      category_id: finalCategoryId,
      purchase_date: data.purchase_date ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      warranty_expiry: data.warranty_expiry ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      insurance_warranty_extended: data.insurance_warranty_extended ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      previous_audit_date: data.previous_audit_date ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      hardware_image_date: data.hardware_image_date ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      current_value: data.purchase_cost || 0,
      status: finalStatus,
      // Remove the new_category_name from the final data
      new_category_name: undefined
    };

    createAsset.mutate(assetData, {
      onSuccess: () => {
        if (data.condition === 'damaged' && finalStatus === 'archived') {
          toast.success('Asset created and automatically moved to archive due to damaged condition');
        } else if (data.status === 'archived') {
          toast.success('Asset created and archived');
        } else {
          toast.success('Asset created successfully');
        }
        assetForm.reset();
        setIsCreateAssetDialogOpen(false);
        setShowNewCategoryInput(false);
      }
    });
  };

  // Helper function to create date from string in IST timezone
  const createISTDate = (dateString: string | null | undefined) => {
    if (!dateString) return undefined;
    return parseToISTDate(dateString);
  };

  // Helper function to format date for display in IST
  const formatDateForDisplay = (date: Date | string | null | undefined) => {
    if (!date) return '';
    return formatDateForDisplayUtil(date, 'MMM dd, yyyy');
  };

  // Helper function to convert Date to IST date string for database
  const formatDateForDatabase = (date: Date | null | undefined) => {
    if (!date) return undefined;
    // Format date as YYYY-MM-DD in IST timezone
    const istDate = getCurrentISTDate();
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleEditAsset = (asset: any) => {
    setSelectedAsset(asset);
    assetForm.reset({
      asset_tag: asset.asset_tag,
      name: asset.name,
      category_id: asset.category_id,
      brand: asset.brand || '',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      purchase_date: createISTDate(asset.purchase_date),
      purchase_cost: asset.purchase_cost || 0,
      warranty_expiry: createISTDate(asset.warranty_expiry),
      location: asset.location || '',
      condition: asset.condition,
      status: asset.status || 'available',
      notes: asset.notes || '',
      // New extended fields
      insurance_warranty_extended: createISTDate(asset.insurance_warranty_extended),
      previous_audit_date: createISTDate(asset.previous_audit_date),
      hardware_image_date: createISTDate(asset.hardware_image_date),
      invoice_copy_link: asset.invoice_copy_link || '',
      warranty_document_link: asset.warranty_document_link || '',
      new_category_name: '',
    });
    setIsEditAssetDialogOpen(true);
  };

  const handleEditAssignment = (assignment: any) => {
    setSelectedAssignment(assignment);
    setShowEditExpiryDate(assignment.assignment_type === 'temporary');
    editAssignmentForm.reset({
      asset_id: assignment.asset_id,
      user_id: assignment.user_id,
      assignment_type: assignment.assignment_type || 'permanent',
      assignment_expiry_date: createISTDate(assignment.assignment_expiry_date),
      condition_at_issuance: assignment.condition_at_issuance || 'good',
      issuance_condition_notes: assignment.issuance_condition_notes || '',
      return_condition_notes: assignment.return_condition_notes || '',
      notes: assignment.notes || '',
    });
    setIsEditAssignmentDialogOpen(true);
  };

  const onAssetUpdate = async (data: AssetFormData) => {
    if (!selectedAsset) return;

    let finalCategoryId = data.category_id;

    // Handle dynamic category creation for edit as well
    if (data.category_id === 'create_new' && data.new_category_name) {
      try {
        const categoryId = await createAssetCategory.mutateAsync({
          name: data.new_category_name,
          description: `Custom category: ${data.new_category_name}`,
          depreciation_rate: 10.00
        });
        finalCategoryId = categoryId;
      } catch (error) {
        console.error('Failed to create category:', error);
        return;
      }
    }

    // Auto-archive when condition becomes damaged, unless status is manually set
    let finalStatus = data.status;
    if (data.condition === 'damaged' && data.status !== 'archived') {
      finalStatus = 'archived';
    }

    const assetData = {
      ...data,
      category_id: finalCategoryId,
      purchase_date: formatDateForDatabase(data.purchase_date),
      warranty_expiry: formatDateForDatabase(data.warranty_expiry),
      insurance_warranty_extended: formatDateForDatabase(data.insurance_warranty_extended),
      previous_audit_date: formatDateForDatabase(data.previous_audit_date),
      hardware_image_date: formatDateForDatabase(data.hardware_image_date),
      current_value: data.purchase_cost || 0,
      status: finalStatus,
      // Remove the new_category_name from the final data
      new_category_name: undefined
    };

    updateAsset.mutate({
      id: selectedAsset.id,
      updates: assetData
    }, {
      onSuccess: () => {
        if (data.condition === 'damaged' && finalStatus === 'archived') {
          toast.success('Asset updated and automatically moved to archive due to damaged condition');
        } else if (data.status === 'archived') {
          toast.success('Asset archived successfully');
        } else {
          toast.success('Asset updated successfully');
        }
        setIsEditAssetDialogOpen(false);
        setSelectedAsset(null);
        setShowNewCategoryInput(false);
        assetForm.reset();
      }
    });
  };

  const onAssignmentUpdate = async (data: EditAssignmentFormData) => {
    if (!selectedAssignment) return;

    updateAssignment.mutate({
      id: selectedAssignment.id,
      updates: {
        asset_id: data.asset_id,
        user_id: data.user_id,
        assignment_type: data.assignment_type,
        assignment_expiry_date: formatDateForDatabase(data.assignment_expiry_date),
        condition_at_issuance: data.condition_at_issuance,
        issuance_condition_notes: data.issuance_condition_notes,
        return_condition_notes: data.return_condition_notes,
        notes: data.notes,
      }
    }, {
      onSuccess: () => {
        setIsEditAssignmentDialogOpen(false);
        setSelectedAssignment(null);
        setShowEditExpiryDate(false);
        editAssignmentForm.reset();
      }
    });
  };

  const onVMSubmit = async (data: VMFormData) => {
    if (!user) return;

    const vmData = {
      ...data,
      approval_date: data.approval_date ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      expiry_date: data.expiry_date ? getCurrentISTDate().toISOString().split('T')[0] : undefined,
      // Add created_by as current user's name or ID
      created_by: user.full_name || user.email || 'System',
    };

    createVM.mutate(vmData, {
      onSuccess: () => {
        vmForm.reset();
        setIsCreateVMDialogOpen(false);
        // Refresh VM data to show the new VM in the table
        fetchVMData();
      }
    });
  };


  // New handlers for direct VM data (used in VM table)
  const handleViewVMDirect = (vm: any) => {
    // Clear any previous asset-based VM data
    setVMAssetId('');
    setSelectedAsset(null);
    // Set the VM data directly
    setSelectedVM(vm);
    setIsViewVMDialogOpen(true);
  };

  const handleEditVMDirect = (vm: any) => {
    // Clear any previous asset-based VM data
    setVMAssetId('');
    setSelectedAsset(null);
    // Set the VM data directly
    setSelectedVM(vm);
    setIsEditVMDialogOpen(true);
  };

  const onVMUpdate = async (data: VMFormData) => {
    if (!selectedVM || !selectedVM.id) return;

    const vmUpdateData = {
      ...data,
      approval_date: formatDateForDatabase(data.approval_date),
      expiry_date: formatDateForDatabase(data.expiry_date),
    };

    updateVM.mutate({ id: selectedVM.id, updates: vmUpdateData }, {
      onSuccess: () => {
        editVMForm.reset();
        setIsEditVMDialogOpen(false);
        setSelectedVM(null);
        setVMAssetId('');
        // Refresh VM data to show updated fields in the table
        fetchVMData();
      }
    });
  };

  const onCreateGuidanceSubmit = async (data: NotesGuidanceFormData) => {
    console.log('Form data being submitted:', data);
    
    if (!data.title || !data.guidance_text) {
      toast.error('Please fill in both title and guidance text');
      return;
    }
    
    createNotesGuidance.mutate({
      title: data.title,
      guidance_text: data.guidance_text
    }, {
      onSuccess: () => {
        createGuidanceForm.reset();
        setIsCreateGuidanceDialogOpen(false);
      }
    });
  };

  const onEditGuidanceSubmit = async (data: NotesGuidanceFormData) => {
    if (!selectedGuidance) return;
    
    updateNotesGuidance.mutate({
      id: selectedGuidance.id,
      title: data.title,
      guidance_text: data.guidance_text
    }, {
      onSuccess: () => {
        editGuidanceForm.reset();
        setIsEditGuidanceDialogOpen(false);
        setSelectedGuidance(null);
      }
    });
  };

  const handleDeleteGuidance = (id: string) => {
    if (confirm('Are you sure you want to delete this guidance?')) {
      deleteNotesGuidance.mutate(id);
    }
  };

  const handleUpdateComplaintStatus = (complaintId: string, status: string) => {
    const updates: any = { status };
    
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_by = user?.id;
    }

    updateComplaint.mutate({ 
      complaintId, 
      updates 
    });
  };

  const onComplaintResolutionSubmit = async (data: ComplaintResolutionFormData) => {
    if (!selectedComplaint) return;

    const updates: any = {
      status: data.status,
      priority: data.priority,
      resolution_notes: data.resolution_notes,
    };
    
    if (data.status === 'resolved' || data.status === 'closed') {
      updates.resolved_by = user?.id;
    }

    updateComplaint.mutate({ 
      complaintId: selectedComplaint.id, 
      updates 
    }, {
      onSuccess: () => {
        setIsEditComplaintDialogOpen(false);
        editComplaintForm.reset();
      }
    });
  };

  // Asset Request Handlers
  const handleViewAssetRequest = (request: any) => {
    setSelectedAssetRequest(request);
    setIsViewAssetRequestDialogOpen(true);
  };

  const handleAssetRequestAction = (request: any, action: 'approve' | 'reject') => {
    setSelectedAssetRequest(request);
    setAssetRequestAction(action);
    setIsAssetRequestActionDialogOpen(true);
    
    // Pre-populate form based on action
    if (action === 'approve') {
      assetRequestActionForm.reset({
        status: 'approved',
        approval_notes: '',
        rejection_reason: '',
        fulfilled_asset_id: '',
      });
    } else {
      assetRequestActionForm.reset({
        status: 'rejected',
        approval_notes: '',
        rejection_reason: '',
        fulfilled_asset_id: '',
      });
    }
  };

  const handleFulfillAssetRequest = (request: any) => {
    setSelectedAssetRequest(request);
    setAssetRequestAction('approve');
    setIsAssetRequestActionDialogOpen(true);
    
    assetRequestActionForm.reset({
      status: 'fulfilled',
      approval_notes: '',
      rejection_reason: '',
      fulfilled_asset_id: '',
    });
  };

  const onAssetRequestActionSubmit = async (data: AssetRequestActionFormData) => {
    if (!user || !selectedAssetRequest) return;

    const updates: any = {
      status: data.status,
    };

    // Add appropriate fields based on status
    if (data.status === 'approved') {
      updates.approved_by = user.id;
      updates.approved_at = getCurrentISTDate().toISOString();
      if (data.approval_notes) {
        updates.approval_notes = data.approval_notes;
      }
    } else if (data.status === 'rejected') {
      updates.rejected_by = user.id;
      updates.rejected_at = getCurrentISTDate().toISOString();
      if (data.rejection_reason) {
        updates.rejection_reason = data.rejection_reason;
      }
    } else if (data.status === 'fulfilled') {
      updates.fulfilled_by = user.id;
      updates.fulfilled_at = getCurrentISTDate().toISOString();
      if (data.fulfilled_asset_id) {
        updates.fulfilled_asset_id = data.fulfilled_asset_id;
      }
    }

    updateAssetRequest.mutate({
      requestId: selectedAssetRequest.id,
      updates
    }, {
      onSuccess: () => {
        setIsAssetRequestActionDialogOpen(false);
        assetRequestActionForm.reset();
        setSelectedAssetRequest(null);
        setAssetRequestAction(null);
      }
    });
  };

  const toggleUserExpansion = (userId: string) => {
    const isCurrentlyExpanded = expandedUsers.has(userId);
    
    if (isCurrentlyExpanded) {
      // If clicking on the currently expanded user, collapse it
      setExpandedUsers(new Set());
      setSelectedUserId('');
    } else {
      // If clicking on a different user, expand only this one (collapse others)
      setExpandedUsers(new Set([userId]));
      setSelectedUserId(userId);
    }
  };

  // Export handler functions
  const handleExportAssignments = (format: 'excel' | 'pdf') => {
    if (!assignments) return;
    
    if (format === 'excel') {
      exportAssetAssignmentsToExcel(filteredAssignments, assignmentFilters);
    } else {
      exportAssetAssignmentsToPDF(filteredAssignments, assignmentFilters);
    }
  };

  const handleExportAssets = (format: 'excel' | 'pdf') => {
    if (!assets) return;
    
    // Filter out virtual machines from the regular assets export
    const assetsWithoutVMs = filteredAssets.filter(asset => 
      asset.category?.name?.toLowerCase() !== 'virtual machine'
    );
    
    if (format === 'excel') {
      exportAssetsToExcel(assetsWithoutVMs, assetFilters);
    } else {
      exportAssetsToPDF(assetsWithoutVMs, assetFilters);
    }
  };

  const fetchVMData = async () => {
    try {
      // Import vmApi dynamically to avoid circular dependencies
      const { vmApi } = await import('@/services/api');
      const data = await vmApi.getAllVMs();
      setVMData(data || []);
    } catch (error) {
      console.error('Error fetching VM data:', error);
      setVMData([]);
    }
  };

  const handleExportVMs = async (format: 'excel' | 'pdf') => {
    if (vmData.length === 0) {
      await fetchVMData();
    }
    
    if (format === 'excel') {
      exportVMsToExcel(filteredVMs, vmFilters);
    } else {
      exportVMsToPDF(filteredVMs, vmFilters);
    }
  };

  const handleExportComplaints = (format: 'excel' | 'pdf') => {
    if (!complaintsData) return;
    
    if (format === 'excel') {
      exportComplaintsToExcel(filteredComplaints, complaintFilters);
    } else {
      exportComplaintsToPDF(filteredComplaints, complaintFilters);
    }
  };

  const getAssetIcon = (categoryName: string) => {
    const category = categoryName.toLowerCase();
    if (category.includes('laptop') || category.includes('computer')) return assetIcons.laptop;
    if (category.includes('mobile') || category.includes('phone')) return assetIcons.mobile;
    if (category.includes('storage') || category.includes('drive')) return assetIcons.storage;
    if (category.includes('keyboard')) return assetIcons.keyboard;
    if (category.includes('mouse')) return assetIcons.mouse;
    if (category.includes('headphone') || category.includes('audio')) return assetIcons.headphones;
    return assetIcons.other;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      assigned: 'bg-blue-100 text-blue-800',
      available: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      retired: 'bg-red-100 text-red-800',
      lost: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getConditionBadge = (condition: string) => {
    const variants = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      fair: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-orange-100 text-orange-800',
      damaged: 'bg-red-100 text-red-800',
    };
    return variants[condition as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return variants[priority as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  // Authoritative user status map from users table for assignment users
  const assignmentUserIds = (assignmentsData || []).map((a: any) => a.user_id);
  const { data: userStatusMap = {} } = useUserStatuses(assignmentUserIds);

  const getEmployeeStatusBadge = (status: string) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'inactive') return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  // Robust resolver for employee status using multiple possible fields
  const resolveEmployeeStatus = (assignment: any): 'active' | 'inactive' => {
    // First try to get status from the assignment's user data (from getAllAssetAssignments)
    const userStatus = assignment?.user?.status;
    if (userStatus) {
      return userStatus.toLowerCase() === 'inactive' ? 'inactive' : 'active';
    }
    
    // Fallback to userStatusMap or employees data
    const candidate = assignment?.user || {};
    const employeeRow = (userStatusMap as any)[assignment?.user_id] || employees?.find((e: any) => e.id === assignment?.user_id) || {};
    const raw = (employeeRow.status ?? candidate.status ?? 'active');
    const status = String(raw).toLowerCase();
    return status === 'inactive' ? 'inactive' : 'active';
  };

  const getRequestStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      fulfilled: 'bg-purple-100 text-purple-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  if (assignmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <span className="ml-2">Loading asset assignments...</span>
      </div>
    );
  }
  
  // Check if user has permission to access asset management
  if (!permissions.canManageAssets) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to access Asset Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Management</h1>
          <p className="text-muted-foreground">
            {permissions.accessLevel === 'all' 
              ? 'Track and manage company assets and assignments'
              : 'Track and manage assets for your team members'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isNotesGuidanceDialogOpen} onOpenChange={setIsNotesGuidanceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Notes Guidance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <DialogTitle>Asset Notes Guidance</DialogTitle>
                    <DialogDescription>
                      Manage guidance entries for asset notes
                    </DialogDescription>
                  </div>
                  <Button onClick={() => setIsCreateGuidanceDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Guidance
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {guidanceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : allNotesGuidance && allNotesGuidance.length > 0 ? (
                  allNotesGuidance.map((guidance: any) => (
                    <Card key={guidance.id} className="border">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-md">{guidance.title}</CardTitle>
                            <CardDescription className="text-sm">
                              Created by {guidance.created_by_user?.full_name || guidance.updated_by_user?.full_name || 'Unknown'} on{' '}
                              {formatDateForDisplayUtil(guidance.created_at, 'MMM dd, yyyy')}
                              {guidance.updated_at !== guidance.created_at && (
                                <span className="text-muted-foreground">
                                  {' '}• Updated by {guidance.updated_by_user?.full_name || 'Unknown'} on {formatDateForDisplayUtil(guidance.updated_at, 'MMM dd, yyyy')}
                                </span>
                              )}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedGuidance(guidance);
                                setIsEditGuidanceDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteGuidance(guidance.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {guidance.guidance_text}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No guidance entries found</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => setIsCreateGuidanceDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Guidance
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Guidance Modal */}
          <Dialog open={isCreateGuidanceDialogOpen} onOpenChange={setIsCreateGuidanceDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Guidance</DialogTitle>
                <DialogDescription>
                  Create guidance for what users should include in asset notes
                </DialogDescription>
              </DialogHeader>
              <Form {...createGuidanceForm}>
                <form onSubmit={createGuidanceForm.handleSubmit(onCreateGuidanceSubmit)} className="space-y-4">
                  <FormField
                    control={createGuidanceForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title/Heading</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter guidance title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createGuidanceForm.control}
                    name="guidance_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guidance Text</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter detailed guidance for what users should include in asset notes..."
                            className="min-h-[200px] overflow-y-auto"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateGuidanceDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createNotesGuidance.isPending}>
                      {createNotesGuidance.isPending ? 'Creating...' : 'Create Guidance'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Edit Guidance Modal */}
          <Dialog open={isEditGuidanceDialogOpen} onOpenChange={setIsEditGuidanceDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Guidance</DialogTitle>
                <DialogDescription>
                  Update the guidance information
                </DialogDescription>
              </DialogHeader>
              <Form {...editGuidanceForm}>
                <form onSubmit={editGuidanceForm.handleSubmit(onEditGuidanceSubmit)} className="space-y-4">
                  <FormField
                    control={editGuidanceForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title/Heading</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter guidance title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editGuidanceForm.control}
                    name="guidance_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guidance Text</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter detailed guidance for what users should include in asset notes..."
                            className="min-h-[200px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditGuidanceDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateNotesGuidance.isPending}>
                      {updateNotesGuidance.isPending ? 'Updating...' : 'Update Guidance'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateVMDialogOpen} onOpenChange={setIsCreateVMDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Server className="h-4 w-4 mr-2" />
                Create VM
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Virtual Machine</DialogTitle>
                <DialogDescription>
                  Create a new VM instance with complete configuration details
                </DialogDescription>
              </DialogHeader>
              <Form {...vmForm}>
                <form onSubmit={vmForm.handleSubmit(onVMSubmit)} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="vm_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VM Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 1001, 2001, 3377" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="vm_location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VM Location *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger >
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="india">India</SelectItem>
                                <SelectItem value="us">US</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="access_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Type *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select access type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="local">Local</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="current_user_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current User of Account *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select user type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="single">Single</SelectItem>
                                <SelectItem value="multiple">Multiple</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Request Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Request Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="requested_by"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Requested By *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter requester name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="approved_by"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approved By *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter approver name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="created_by"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Created By *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter creator name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="request_ticket_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Request Ticket ID *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter ticket reference" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Project Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Project Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="purpose"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purpose of Account Creation *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select purpose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="client_project">Client Project</SelectItem>
                                <SelectItem value="internal_project">Internal Project</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="project_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter project name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Access Credentials */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Access Credentials</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID or Username *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter username or ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="current_password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password *</FormLabel>
                            <FormControl>
                              <Input type="text" placeholder="Enter current password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={vmForm.control}
                      name="previous_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous Password</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="Enter previous password (optional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Network Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Network Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="ip_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IP Address or Public IP *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 192.168.1.100" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="ghost_ip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ghost IP</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter ghost IP (optional)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="vpn_requirement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VPN Requirement *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select VPN requirement" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="mfa_enabled"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MFA Enabled *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select MFA status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Infrastructure & Compliance */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Infrastructure & Compliance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="cloud_provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cloud Provider *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select cloud provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="aws">AWS</SelectItem>
                                <SelectItem value="azure">Azure</SelectItem>
                                <SelectItem value="gcp">GCP</SelectItem>
                                <SelectItem value="on_prem">On-Prem</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="backup_enabled"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backup Enabled *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select backup status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={vmForm.control}
                      name="audit_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Audit Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select audit status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="compliant">Compliant</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Dates */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Important Dates</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vmForm.control}
                        name="approval_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approval Date of VM</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick approval date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date > getCurrentISTDate()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={vmForm.control}
                        name="expiry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Expiry or Deactivation Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick expiry date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < getCurrentISTDate()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateVMDialogOpen(false);
                        vmForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createVM.isPending}>
                      {createVM.isPending ? 'Creating...' : 'Create VM'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          <Dialog 
            open={isCreateAssetDialogOpen} 
            onOpenChange={(open) => {
              setIsCreateAssetDialogOpen(open);
              if (!open) {
                // Reset form when dialog is closed
                assetForm.reset();
                setShowNewCategoryInput(false);
              }
            }}
          >
            {permissions.canViewAllEmployees && (
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Asset
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Asset</DialogTitle>
                <DialogDescription>
                  Add a new asset to the company inventory
                </DialogDescription>
              </DialogHeader>
              <Form {...assetForm}>
                <form onSubmit={assetForm.handleSubmit(onAssetSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="asset_tag"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Tag *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., LAP-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., MacBook Pro 16-inch" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="category_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category *</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              if (value === 'create_new') {
                                setShowNewCategoryInput(true);
                              } else {
                                setShowNewCategoryInput(false);
                                
                                // Check if selected category is "virtual machine"
                                const selectedCategory = categories?.find(cat => cat.id === value);
                                if (selectedCategory?.name.toLowerCase() === 'virtual machine') {
                                  // Close create asset dialog and open VM dialog
                                  setIsCreateAssetDialogOpen(false);
                                  setIsCreateVMDialogOpen(true);
                                  assetForm.reset();
                                  return;
                                }
                              }
                              field.onChange(value);
                            }} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories?.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                              {(user?.role?.name === 'admin' || user?.role?.name === 'super_admin' || user?.isSA) && (
                                <SelectItem value="create_new">
                                  <span className="text-blue-600 font-medium">+ Create New Category</span>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {showNewCategoryInput && (
                      <FormField
                        control={assetForm.control}
                        name="new_category_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Category Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter new category name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={assetForm.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="poor">Poor</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">Available</SelectItem>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Apple, Dell, HP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., MacBook Pro M3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="serial_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Device serial number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Office Floor 2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="purchase_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick purchase date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="purchase_cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Cost</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={assetForm.control}
                    name="warranty_expiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiry</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick warranty expiry date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Extended Date Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="insurance_warranty_extended"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance/Warranty Extended</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick extended warranty date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="previous_audit_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous Audit Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick audit date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={assetForm.control}
                    name="hardware_image_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hardware Image Date (Quarterly)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick hardware image date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Document Links */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="invoice_copy_link"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Copy Link</FormLabel>
                          <FormControl>
                            <Input 
                              type="url"
                              placeholder="https://example.com/invoice.pdf" 
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={assetForm.control}
                      name="warranty_document_link"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warranty Document Link</FormLabel>
                          <FormControl>
                            <Input 
                              type="url"
                              placeholder="https://example.com/warranty.pdf" 
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={assetForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional information about the asset..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateAssetDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAsset.isPending}>
                      {createAsset.isPending ? 'Creating...' : 'Create Asset'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          <Dialog 
            open={isAssignDialogOpen} 
            onOpenChange={(open) => {
              setIsAssignDialogOpen(open);
              if (!open) {
                // Reset form when dialog is closed
                assignmentForm.reset();
                setSelectedEmployees([]);
                setShowExpiryDate(false);
              }
            }}
          >
            {(permissions.canViewAllEmployees || permissions.canViewTeamEmployees) && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Asset
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign Asset to Employee</DialogTitle>
                <DialogDescription>
                  Create a new asset assignment record
                </DialogDescription>
              </DialogHeader>
              <Form {...assignmentForm}>
                <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4">
                  <FormField
                    control={assignmentForm.control}
                    name="asset_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an asset" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableAssets?.map((asset) => {
                              const assignmentCount = assignmentsData?.filter(a => a.asset_id === asset.id && a.is_active).length || 0;
                              const isAssigned = asset.status === 'assigned';
                              
                              return (
                                <SelectItem key={asset.id} value={asset.id}>
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <div className="flex items-center gap-2">
                                      {React.createElement(getAssetIcon(asset.category?.name || ''), { className: "h-4 w-4" })}
                                      <span>{asset.name} ({asset.asset_tag})</span>
                                    </div>
                                    {isAssigned && (
                                      <Badge variant="secondary" className="text-xs">
                                        {assignmentCount} assigned
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={assignmentForm.control}
                    name="user_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employees * (Multi-select)</FormLabel>
                        <div className="space-y-2">
                          <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                            {filteredEmployees?.map((employee: any) => (
                              <div key={employee.id} className="flex items-center space-x-2 p-1">
                                <input
                                  type="checkbox"
                                  id={`employee-${employee.id}`}
                                  checked={field.value?.includes(employee.id) || false}
                                  onChange={(e) => {
                                    const currentIds = field.value || [];
                                    const updatedIds = e.target.checked
                                      ? [...currentIds, employee.id]
                                      : currentIds.filter((id: string) => id !== employee.id);
                                    field.onChange(updatedIds);
                                    
                                    // Update selected employees for department/manager display
                                    const updatedEmployees = e.target.checked
                                      ? [...selectedEmployees, employee]
                                      : selectedEmployees.filter((emp: any) => emp.id !== employee.id);
                                    setSelectedEmployees(updatedEmployees);
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={employee.avatar_url} />
                                  <AvatarFallback className="text-xs">
                                    {employee.full_name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <label 
                                  htmlFor={`employee-${employee.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {employee.full_name} ({employee.employee_id})
                                  {employee.department?.name && (
                                    <span className="text-muted-foreground ml-1">
                                      - {employee.department.name}
                                    </span>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                          {(field.value?.length || 0) > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {field.value?.length || 0} employee(s) selected
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Display department and manager info for selected employees */}
                  {selectedEmployees.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Selected Employees Details:</h4>
                      <div className="max-h-32 overflow-y-auto space-y-2">
                        {selectedEmployees.map((employee: any) => (
                          <div key={employee.id} className="text-sm p-2 bg-muted rounded">
                            <div className="font-medium">{employee.full_name}</div>
                            <div className="text-muted-foreground">
                              Department: {employee.department?.name || 'Not specified'}
                            </div>
                            <div className="text-muted-foreground">
                              Manager: {employee.manager?.full_name || 'Not specified'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={assignmentForm.control}
                      name="assignment_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assignment Type *</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowExpiryDate(value === 'temporary');
                            }} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select assignment type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="permanent">Permanent</SelectItem>
                              <SelectItem value="temporary">Temporary</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {showExpiryDate && (
                      <FormField
                        control={assignmentForm.control}
                        name="assignment_expiry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date *</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick expiry date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < getCurrentISTDate()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <FormField
                    control={assignmentForm.control}
                    name="condition_at_issuance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Condition at Issuance *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select asset condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={assignmentForm.control}
                    name="issuance_condition_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition Notes (Employee Assessment)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Employee's notes about the asset condition at issuance..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={assignmentForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignment Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Purpose, project, or additional notes..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsAssignDialogOpen(false);
                      setSelectedEmployees([]);
                      setShowExpiryDate(false);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAssignment.isPending}>
                      {createAssignment.isPending ? 'Assigning...' : 'Assign Asset'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Asset Management Tabs */}
      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="assignments">Asset Assignments</TabsTrigger>
          <TabsTrigger value="assets">All Assets</TabsTrigger>
          <TabsTrigger value="archived">Archived Assets</TabsTrigger>
          <TabsTrigger value="requests">Asset Requests</TabsTrigger>
          <TabsTrigger value="maintenance">Asset Maintenance & Support</TabsTrigger>
          <TabsTrigger value="user-history">Asset History</TabsTrigger>
        </TabsList>

        
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Asset Assignments</CardTitle>
                  <CardDescription>
                    All active asset assignments and their details
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportAssignments('excel')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportAssignments('pdf')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="filter-asset-name" className='mb-2'>Asset Name</Label>
                  <Input
                    id="filter-asset-name"
                    placeholder="Filter by asset name"
                    value={assignmentFilters.asset_name}
                    onChange={(e) => setAssignmentFilters(prev => ({ ...prev, asset_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="filter-user-name" className='mb-2'>Assigned To</Label>
                  <Input
                    id="filter-user-name"
                    placeholder="Filter by user name"
                    value={assignmentFilters.user_name}
                    onChange={(e) => setAssignmentFilters(prev => ({ ...prev, user_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="filter-status" className='mb-2'>Assignment Status</Label>
                  <Select
                    value={assignmentFilters.status}
                    onValueChange={(value) => setAssignmentFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger >
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filter-employee-status" className='mb-2'>Employee Status</Label>
                  <Select
                    value={assignmentFilters.employee_status}
                    onValueChange={(value) => setAssignmentFilters(prev => ({ ...prev, employee_status: value }))}
                  >
                    <SelectTrigger >
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filter-category" className='mb-2'>Category</Label>
                  <Select
                    value={assignmentFilters.category}
                    onValueChange={(value) => setAssignmentFilters(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger >
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setAssignmentFilters({
                      asset_name: '',
                      user_name: '',
                      status: 'all',
                      category: 'all',
                      assigned_by: '',
                      employee_status: 'all'
                    })}
                  >
                    <FilterIcon className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Asset Status</TableHead>
                <TableHead>Employee Status</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Assigned By</TableHead>
                <TableHead>Assignment Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map((assignment) => {
                const IconComponent = getAssetIcon(assignment.asset?.category?.name || '');
                return (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{assignment.asset?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {assignment.asset?.asset_tag} • {assignment.asset?.brand} {assignment.asset?.model}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {assignment.user?.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{assignment.user?.full_name}</div>
                          <div className="text-sm text-muted-foreground">{assignment.user?.employee_id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.asset?.category?.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(assignment.asset?.status || 'available')}>
                        {assignment.asset?.status || 'available'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const status = resolveEmployeeStatus(assignment);
                        return <Badge className={getEmployeeStatusBadge(status)}>{status}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>{formatDateForDisplay(assignment.assigned_date)}</TableCell>
                    <TableCell>{assignment.assigned_by_user?.full_name}</TableCell>
                    <TableCell>
                      {(() => {
                        const status = assignment.is_active ? 'Active' : (assignment.return_date ? 'Returned' : 'Inactive');
                        const badgeClass = assignment.is_active 
                          ? "bg-green-100 text-green-800" 
                          : assignment.return_date 
                            ? "bg-blue-100 text-blue-800" 
                            : "bg-gray-100 text-gray-800";
                        return <Badge className={badgeClass}>{status}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedAssignment(assignment)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Asset Assignment Details</DialogTitle>
                              <DialogDescription>
                                Complete information about this asset assignment
                              </DialogDescription>
                            </DialogHeader>
                            {selectedAssignment && (
                              <div className="space-y-6">
                                {/* Asset Information Section */}
                                <div>
                                  <h4 className="font-semibold text-base mb-3 text-primary">Asset Information</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium">Asset Name:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.asset?.name}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Asset Tag:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.asset?.asset_tag}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Brand/Model:</p>
                                      <p className="text-muted-foreground">
                                        {selectedAssignment.asset?.brand} {selectedAssignment.asset?.model}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Category:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.asset?.category?.name}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Asset Status:</p>
                                      <Badge className={getStatusBadge(selectedAssignment.asset?.status)} variant="outline">
                                        {selectedAssignment.asset?.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Employee Information Section */}
                                <div>
                                  <h4 className="font-semibold text-base mb-3 text-primary">Employee Information</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium">Assigned To:</p>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="text-xs">
                                            {selectedAssignment.user?.full_name?.charAt(0)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-muted-foreground">{selectedAssignment.user?.full_name}</span>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="font-medium">Employee ID:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.user?.employee_id}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Department:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.employee_department || 'Not specified'}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Manager:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.employee_manager || 'Not specified'}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Assignment Details Section */}
                                <div>
                                  <h4 className="font-semibold text-base mb-3 text-primary">Assignment Details</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium">Assignment Type:</p>
                                      <Badge variant="outline" className={selectedAssignment.assignment_type === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>
                                        {selectedAssignment.assignment_type || 'Permanent'}
                                      </Badge>
                                    </div>
                                    <div>
                                      <p className="font-medium">Assigned Date:</p>
                                      <p className="text-muted-foreground">
                                        {formatDateForDisplay(selectedAssignment.assigned_date)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Assigned By:</p>
                                      <p className="text-muted-foreground">{selectedAssignment.assigned_by_user?.full_name}</p>
                                    </div>
                                    {selectedAssignment.assignment_expiry_date && (
                                      <div>
                                        <p className="font-medium">Expiry Date:</p>
                                        <p className="text-muted-foreground">
                                          {formatDateForDisplay(selectedAssignment.assignment_expiry_date)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Asset Condition Section */}
                                <div>
                                  <h4 className="font-semibold text-base mb-3 text-primary">Asset Condition</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium">Condition at Issuance:</p>
                                      <Badge className={getConditionBadge(selectedAssignment.condition_at_issuance || 'good')} variant="outline">
                                        {selectedAssignment.condition_at_issuance || 'Good'}
                                      </Badge>
                                    </div>
                                    {selectedAssignment.return_date && (
                                      <div>
                                        <p className="font-medium">Return Date:</p>
                                        <p className="text-muted-foreground">
                                          {formatDateForDisplay(selectedAssignment.return_date)}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {selectedAssignment.issuance_condition_notes && (
                                    <div className="mt-3">
                                      <p className="font-medium mb-1">Employee Condition Notes (At Issuance):</p>
                                      <p className="text-muted-foreground text-sm p-2 bg-muted rounded-md">
                                        {selectedAssignment.issuance_condition_notes}
                                      </p>
                                    </div>
                                  )}

                                  {selectedAssignment.return_condition_notes && (
                                    <div className="mt-3">
                                      <p className="font-medium mb-1">HR Return Condition Notes:</p>
                                      <p className="text-muted-foreground text-sm p-2 bg-muted rounded-md">
                                        {selectedAssignment.return_condition_notes}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Assignment Notes Section */}
                                {selectedAssignment.notes && (
                                  <div>
                                    <h4 className="font-semibold text-base mb-3 text-primary">Assignment Notes</h4>
                                    <p className="text-muted-foreground text-sm p-3 bg-muted rounded-md">
                                      {selectedAssignment.notes}
                                    </p>
                                  </div>
                                )}

                                {/* Assignment Status */}
                                <div>
                                  <h4 className="font-semibold text-base mb-3 text-primary">Status</h4>
                                  <div className="flex items-center gap-2">
                                    <Badge className={selectedAssignment.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                      {selectedAssignment.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                    {!selectedAssignment.is_active && selectedAssignment.return_date && (
                                      <span className="text-sm text-muted-foreground">
                                        (Returned on {formatDateForDisplay(selectedAssignment.return_date)})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Asset Condition Images - View Only */}
                                {user && (
                                  <AssetImageUpload
                                    assetAssignmentId={selectedAssignment.id}
                                    assetName={selectedAssignment.asset?.name || ''}
                                    assetTag={selectedAssignment.asset?.asset_tag || ''}
                                    userId={selectedAssignment.user_id}
                                    isHardwareAsset={!selectedAssignment.asset?.category?.name?.toLowerCase()?.includes('software') && 
                                                   !selectedAssignment.asset?.category?.name?.toLowerCase()?.includes('license') && 
                                                   !selectedAssignment.asset?.category?.name?.toLowerCase()?.includes('subscription')}
                                    viewOnly={true}
                                  />
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        {(permissions.canEditAllEmployees || 
                          (permissions.canEditTeamEmployees && assignment.user?.manager_id === user?.id)) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditAssignment(assignment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const confirmed = window.confirm(`Are you sure you want to unassign ${assignment.user?.full_name} from this asset?`);
                            if (confirmed) {
                              unassignSpecificUser.mutate({ 
                                assignmentId: assignment.id,
                                returnCondition: 'good',
                                returnNotes: `User ${assignment.user?.full_name} unassigned by HR`
                              });
                            }
                          }}
                          disabled={unassignSpecificUser.isPending}
                        >
                          Unassign User
                        </Button>
                        
                        <ConfirmDelete
                          trigger={(
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          title="Delete Assignment"
                          description="Are you sure you want to delete this asset assignment? This will make the asset available for reassignment."
                          confirmText="Delete Assignment"
                          onConfirm={() => deleteAssignment.mutate(assignment.id)}
                          loading={deleteAssignment.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="assets">
          {/* Sub-tabs for Assets */}
          <Tabs defaultValue="regular-assets" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="regular-assets">Assets</TabsTrigger>
              <TabsTrigger value="virtual-machines">Virtual Machines</TabsTrigger>
            </TabsList>
            
            <TabsContent value="regular-assets">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {permissions.canViewAllEmployees ? 'All Assets' : 'Team Assets'}
                      </CardTitle>
                      <CardDescription>
                        {permissions.canViewAllEmployees 
                          ? 'Complete inventory of all company assets (excluding Virtual Machines)'
                          : 'Assets assigned to your team members and available assets (excluding Virtual Machines)'
                        }
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportAssets('excel')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportAssets('pdf')}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label htmlFor="filter-asset-name" className='mb-2'>Asset Name</Label>
                      <Input
                        id="filter-asset-name"
                        placeholder="Filter by name"
                        value={assetFilters.name}
                        onChange={(e) => setAssetFilters(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-asset-tag" className='mb-2'>Asset Tag</Label>
                      <Input
                        id="filter-asset-tag"
                        placeholder="Filter by tag"
                        value={assetFilters.asset_tag}
                        onChange={(e) => setAssetFilters(prev => ({ ...prev, asset_tag: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-asset-category" className='mb-2'>Category</Label>
                      <Select
                        value={assetFilters.category}
                        onValueChange={(value) => setAssetFilters(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger >
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="filter-asset-status" className='mb-2'>Status</Label>
                      <Select
                        value={assetFilters.status}
                        onValueChange={(value) => setAssetFilters(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger >
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="filter-asset-condition" className='mb-2'>Condition</Label>
                      <Select
                        value={assetFilters.condition}
                        onValueChange={(value) => setAssetFilters(prev => ({ ...prev, condition: value }))}
                      >
                        <SelectTrigger >
                          <SelectValue placeholder="All Conditions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Conditions</SelectItem>
                          <SelectItem value="excellent">Excellent</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="poor">Poor</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => setAssetFilters({
                          name: '',
                          asset_tag: '',
                          category: 'all',
                          brand: '',
                          status: 'all',
                          condition: 'all',
                          location: ''
                        })}
                      >
                        <FilterIcon className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand/Model</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purchase Info</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets?.filter(asset => asset.category?.name?.toLowerCase() !== 'virtual machine').map((asset) => {
                const IconComponent = getAssetIcon(asset.category?.name || '');
                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          <div className="text-sm text-muted-foreground">{asset.asset_tag}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.category?.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{asset.brand}</div>
                        <div className="text-sm text-muted-foreground">{asset.model}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getConditionBadge(asset.condition)}>
                        {asset.condition}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(asset.status)}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {asset.purchase_cost && (
                          <div className="font-medium">${asset.purchase_cost.toLocaleString()}</div>
                        )}
                        {asset.purchase_date && (
                          <div className="text-muted-foreground">
                            {formatDateForDisplay(asset.purchase_date)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditAsset(asset)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        {asset.status === 'assigned' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const confirmed = window.confirm('Are you sure you want to unassign this asset from all users?');
                              if (confirmed) {
                                unassignAsset.mutate({ 
                                  assetId: asset.id,
                                  returnCondition: 'good',
                                  returnNotes: 'Asset unassigned by HR'
                                });
                              }
                            }}
                            disabled={unassignAsset.isPending}
                          >
                            Unassign
                          </Button>
                        )}
                        
                        {/* <ConfirmDelete
                          trigger={(
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          title="Delete Asset"
                          description="Are you sure you want to delete this asset? This action cannot be undone."
                          confirmText="Delete Asset"
                          onConfirm={() => deleteAsset.mutate(asset.id)}
                          loading={deleteAsset.isPending}
                        /> */}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="virtual-machines">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Virtual Machines</CardTitle>
                      <CardDescription>
                        All Virtual Machine assets and their configurations
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportVMs('excel')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportVMs('pdf')}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label htmlFor="filter-vm-number" className='mb-2'>VM Number</Label>
                      <Input
                        id="filter-vm-number"
                        placeholder="Filter by VM number"
                        value={vmFilters.vm_number}
                        onChange={(e) => setVMFilters(prev => ({ ...prev, vm_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-vm-location" className='mb-2'>Location</Label>
                      <Input
                        id="filter-vm-location"
                        placeholder="Filter by location"
                        value={vmFilters.vm_location}
                        onChange={(e) => setVMFilters(prev => ({ ...prev, vm_location: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-vm-project" className='mb-2'>Project</Label>
                      <Input
                        id="filter-vm-project"
                        placeholder="Filter by project"
                        value={vmFilters.project_name}
                        onChange={(e) => setVMFilters(prev => ({ ...prev, project_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-vm-provider" className='mb-2'>Cloud Provider</Label>
                      <Select
                        value={vmFilters.cloud_provider}
                        onValueChange={(value) => setVMFilters(prev => ({ ...prev, cloud_provider: value }))}
                      >
                        <SelectTrigger >
                          <SelectValue placeholder="All Providers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Providers</SelectItem>
                          <SelectItem value="aws">AWS</SelectItem>
                          <SelectItem value="azure">Microsoft Azure</SelectItem>
                          <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                          <SelectItem value="on_prem">On-Premises</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="filter-vm-audit" className='mb-2'>Audit Status</Label>
                      <Select
                        value={vmFilters.audit_status}
                        onValueChange={(value) => setVMFilters(prev => ({ ...prev, audit_status: value }))}
                      >
                        <SelectTrigger >
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="compliant">Compliant</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => setVMFilters({
                          vm_number: '',
                          vm_location: '',
                          project_name: '',
                          cloud_provider: 'all',
                          audit_status: 'all',
                          purpose: ''
                        })}
                      >
                        <FilterIcon className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>VM Number</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Cloud Provider</TableHead>
                        <TableHead>Audit Status</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVMs?.map((vm: any) => (
                        <TableRow key={vm.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Server className="h-5 w-5 text-muted-foreground" />
                              <div className="font-medium">VM-{vm.vm_number || 'N/A'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {vm.vm_location || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{vm.project_name || 'N/A'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {vm.cloud_provider || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              vm.audit_status === 'passed' ? 'default' : 
                              vm.audit_status === 'pending' ? 'secondary' : 
                              vm.audit_status === 'failed' ? 'destructive' : 'outline'
                            }>
                              {vm.audit_status || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {vm.ip_address || 'N/A'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleViewVMDirect(vm)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditVMDirect(vm)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Archived Assets
                  </CardTitle>
                  <CardDescription>
                    Assets that have been archived due to damage or other reasons
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!assets) return;
                      const archivedAssets = assets.filter(asset => asset.status === 'archived');
                      exportAssetsToExcel(archivedAssets, { status: 'archived' });
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!assets) return;
                      const archivedAssets = assets.filter(asset => asset.status === 'archived');
                      exportAssetsToPDF(archivedAssets, { status: 'archived' });
                    }}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Archived Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleBasedFilteredAssets?.filter(asset => asset.status === 'archived').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No archived assets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      roleBasedFilteredAssets?.filter(asset => asset.status === 'archived').map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.asset_tag}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {/* <Monitor className="h-4 w-4" /> */}
                              {asset.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{asset.category?.name || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>{asset.brand || 'N/A'}</TableCell>
                          <TableCell>{asset.model || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={asset.condition === 'damaged' ? 'destructive' : 'secondary'}
                            >
                              {asset.condition || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {asset.updated_at ? formatDateForDisplayUtil(asset.updated_at, 'PPP') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {asset.condition === 'damaged' ? 'Damaged condition' : 'Manual archive'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditAsset(asset)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  const confirmed = window.confirm('Are you sure you want to restore this asset from archive?');
                                  if (confirmed) {
                                    updateAsset.mutate({
                                      id: asset.id,
                                      updates: { status: 'available' }
                                    });
                                  }
                                }}
                                disabled={updateAsset.isPending}
                              >
                                Restore
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Asset Requests
                  </CardTitle>
                  <CardDescription>
                    Manage employee asset requests and approvals
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!assetRequestsData || assetRequestsData.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Asset Requests</h3>
                  <p className="text-muted-foreground">
                    No asset requests have been submitted yet.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assetRequestsData.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{request.user?.full_name}</span>
                              <div className="text-sm text-muted-foreground">
                                {request.user?.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {request.user?.department?.name || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {React.createElement(getAssetIcon(request.category?.name || ''), { className: "h-4 w-4" })}
                              <span>{request.category?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="text-sm truncate" title={request.description}>
                                {request.description.length > 40 
                                  ? `${request.description.substring(0, 40)}...`
                                  : request.description
                                }
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityBadge(request.priority || 'medium')}>
                              {(request.priority || 'medium').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRequestStatusBadge(request.status)}>
                              {request.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateForDisplayUtil(request.created_at, 'PPP')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewAssetRequest(request)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {request.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleAssetRequestAction(request, 'approve')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleAssetRequestAction(request, 'reject')}
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {request.status === 'approved' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-purple-600 hover:text-purple-700"
                                  onClick={() => handleFulfillAssetRequest(request)}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Asset Maintenance & Support
                  </CardTitle>
                  <CardDescription>
                    All asset complaints and maintenance requests
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportComplaints('excel')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportComplaints('pdf')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="filter-complaint-status" className='mb-2'>Status</Label>
                  <Select
                    value={complaintFilters.status}
                    onValueChange={(value) => setComplaintFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger >
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filter-complaint-priority" className='mb-2'>Priority</Label>
                  <Select
                    value={complaintFilters.priority}
                    onValueChange={(value) => setComplaintFilters(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger >
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filter-complaint-user" className='mb-2'>User</Label>
                  <Input
                    id="filter-complaint-user"
                    placeholder="Filter by user name"
                    value={complaintFilters.user_name}
                    onChange={(e) => setComplaintFilters(prev => ({ ...prev, user_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="filter-complaint-asset" className='mb-2'>Asset</Label>
                  <Input
                    id="filter-complaint-asset"
                    placeholder="Filter by asset name"
                    value={complaintFilters.asset_name}
                    onChange={(e) => setComplaintFilters(prev => ({ ...prev, asset_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="filter-complaint-category" className='mb-2'>Category</Label>
                  <Select
                    value={complaintFilters.category}
                    onValueChange={(value) => setComplaintFilters(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger >
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setComplaintFilters({
                      status: 'all',
                      priority: 'all',
                      user_name: '',
                      asset_name: '',
                      category: 'all',
                      date_from: '',
                      date_to: ''
                    })}
                  >
                    <FilterIcon className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>

              {!allComplaints || allComplaints.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Complaints Found</h3>
                  <p className="text-muted-foreground">
                    No asset maintenance or support requests have been submitted yet.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Resolved By</TableHead>
                        <TableHead>Resolution Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComplaints?.map((complaint) => {
                        const IconComponent = getAssetIcon(complaint.asset?.category?.name || '');
                        return (
                          <TableRow key={complaint.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <div>
                                  <span className="font-medium">{complaint.asset?.name}</span>
                                  <div className="text-sm text-muted-foreground">
                                    {complaint.asset?.asset_tag}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{complaint.user?.full_name}</span>
                                <div className="text-sm text-muted-foreground">
                                  {complaint.user?.employee_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                <p className="text-sm truncate" title={complaint.problem_description}>
                                  {complaint.problem_description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                complaint.status === 'open' ? 'bg-red-100 text-red-800' :
                                complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                <div className="flex items-center gap-1">
                                  {complaint.status === 'open' && <AlertTriangle className="h-3 w-3" />}
                                  {complaint.status === 'in_progress' && <Clock className="h-3 w-3" />}
                                  {(complaint.status === 'resolved' || complaint.status === 'closed') && <CheckCircle2 className="h-3 w-3" />}
                                  {complaint.status.replace('_', ' ').toUpperCase()}
                                </div>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPriorityBadge(complaint.priority || 'medium')}>
                                {(complaint.priority || 'medium').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDateForDisplayUtil(complaint.created_at)}
                            </TableCell>
                            <TableCell>
                              {complaint.resolved_by_user?.full_name || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                {complaint.resolution_notes ? (
                                  <p className="text-sm truncate" title={complaint.resolution_notes}>
                                    {complaint.resolution_notes}
                                  </p>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setIsComplaintDetailsDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setIsEditComplaintDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                
                                {complaint.status !== 'resolved' && complaint.status !== 'closed' && (
                                  <Select
                                    value={complaint.status}
                                    onValueChange={(value) => handleUpdateComplaintStatus(complaint.id, value)}
                                  >
                                    <SelectTrigger className="w-32 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="open">Open</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="resolved">Resolved</SelectItem>
                                      <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Asset Assignment History
                  </CardTitle>
                  <CardDescription>
                    All employees who have ever been assigned assets. Click on an employee to view their complete history.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {enhancedUsersWithHistory.length} employees with asset history
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {enhancedUsersWithHistory.length > 0 ? (
                <div className="space-y-2">
                  {enhancedUsersWithHistory.map((userData: any) => {
                    const isExpanded = expandedUsers.has(userData.user.id);
                    const isEmployeeInactive = userData.user.status !== 'active';
                    const hasActiveAssets = userData.activeCount > 0;
                    const isRisk = isEmployeeInactive && hasActiveAssets;
                    
                    return (
                      <div key={userData.userId} className="border rounded-lg">
                        {/* User Header - Clickable */}
                        <div 
                          className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                            isRisk ? 'bg-red-50 border-red-200 hover:bg-red-100' : ''
                          }`}
                          onClick={() => toggleUserExpansion(userData.user.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={userData.user.avatar_url} />
                                  <AvatarFallback>
                                    {userData.user.full_name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{userData.user.full_name}</h3>
                                  <Badge 
                                    variant={userData.user.status === 'active' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {userData.user.status === 'active' ? 'Active' : 'Inactive'}
                                  </Badge>
                                  {isRisk && (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Risk
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>ID: {userData.user.employee_id}</span>
                                  <span>•</span>
                                  <span>Department: {userData.user.department?.name || 'Not specified'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{userData.totalCount} total assignments</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm mt-1">
                                  {hasActiveAssets ? (
                                    <Badge variant={isEmployeeInactive ? 'destructive' : 'default'} className="text-xs">
                                      {userData.activeCount} active asset{userData.activeCount !== 1 ? 's' : ''}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      No active assets
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded History - Only show when expanded */}
                        {isExpanded && (
                          <div className="border-t bg-muted/20" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-primary">Asset Assignment Timeline</h4>
                                {isEmployeeInactive && hasActiveAssets && (
                                  <Badge variant="destructive" className="text-xs">
                                    ⚠ Employee Inactive - Review Active Assets
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="space-y-3">
                                {isExpanded && userData.user.id && selectedUserId === userData.user.id ? (
                                  userAssignmentLogs && userAssignmentLogs.length > 0 ? (
                                    userAssignmentLogs.map((log: any) => {
                                    const IconComponent = getAssetIcon(log.asset_category || '');
                                    // Check if this assignment is currently active based on actual assignment data
                                    const currentAssignment = allAssignments?.find(a => a.id === log.assignment_id);
                                    const isActive = currentAssignment?.is_active === true;
                                  
                                  return (
                                    <div key={log.id} className="relative">
                                      <div className={`flex items-start gap-4 p-3 rounded-lg border ${
                                        isEmployeeInactive && isActive ? 'bg-red-50 border-red-200' : 
                                        isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                                      }`}>
                                        {/* Timeline dot */}
                                        <div className={`w-3 h-3 rounded-full mt-2 ${
                                          isActive ? 'bg-green-500' : 'bg-gray-400'
                                        }`} />
                                        
                                        <div className={`flex-1 min-w-0 ${!isActive ? 'opacity-60' : ''}`}>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <IconComponent className={`h-5 w-5 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                                              <div>
                                                <div className={`font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{log.asset_name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                  {log.asset_tag} • {log.asset_category}
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                              <Badge variant={
                                                log.action === 'assigned' ? 'default' : 
                                                log.action === 'unassigned' ? 'secondary' : 
                                                'outline'
                                              } className="text-xs">
                                                {log.action}
                                              </Badge>
                                              <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                                                {log.status}
                                              </Badge>
                                              {isEmployeeInactive && isActive && (
                                                <Badge variant="destructive" className="text-xs">
                                                  ⚠ Risk
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                                            <div>
                                              <span className="text-muted-foreground">Action Date:</span>{' '}
                                              <span className="font-medium">
                                                {formatDateForDisplayUtil(log.action_date, 'MMM dd, yyyy')}
                                              </span>
                                            </div>
                                            {log.assignment_expiry_date && (
                                              <div>
                                                <span className="text-muted-foreground">Expiry:</span>{' '}
                                                <span className="font-medium">
                                                  {formatDateForDisplayUtil(log.assignment_expiry_date, 'MMM dd, yyyy')}
                                                </span>
                                              </div>
                                            )}
                                            <div>
                                              <span className="text-muted-foreground">Type:</span>{' '}
                                              <Badge variant="outline" className="text-xs">
                                                {log.assignment_type || 'permanent'}
                                              </Badge>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Action by:</span>{' '}
                                              <span className="text-sm">
                                                {log.action_by_name || 'System'}
                                              </span>
                                            </div>
                                          </div>
                                          
                                          {log.action_notes && (
                                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                                              <span className="font-medium">Notes:</span> {log.action_notes}
                                            </div>
                                          )}
                                          
                                          {/* Action buttons for active assignments */}
                                          {isActive && (
                                            <div className="mt-3 flex gap-2">
                                              <Dialog>
                                                <DialogTrigger asChild>
                                                  <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      // Create an assignment-like object from the log for the modal
                                                      const logAsAssignment = {
                                                        id: log.assignment_id,
                                                        asset: {
                                                          name: log.asset_name,
                                                          asset_tag: log.asset_tag,
                                                          category: { name: log.asset_category }
                                                        },
                                                        user: {
                                                          full_name: log.user_name,
                                                          employee_id: log.user_employee_id
                                                        },
                                                        assigned_date: log.action_date,
                                                        assignment_type: log.assignment_type,
                                                        condition_at_issuance: log.condition_at_action,
                                                        notes: log.action_notes,
                                                        assigned_by_user: {
                                                          full_name: log.action_by_name
                                                        },
                                                        is_active: log.status === 'active'
                                                      };
                                                      setSelectedAssignment(logAsAssignment);
                                                    }}
                                                  >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    View Details
                                                  </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                                  <DialogHeader>
                                                    <DialogTitle>Asset Assignment Details</DialogTitle>
                                                    <DialogDescription>
                                                      Complete information about this asset assignment
                                                    </DialogDescription>
                                                  </DialogHeader>
                                                  {selectedAssignment && (
                                                    <div className="space-y-6">
                                                      {/* Asset Information Section */}
                                                      <div>
                                                        <h4 className="font-semibold text-base mb-3 text-primary">Asset Information</h4>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                          <div>
                                                            <p className="font-medium">Asset Name:</p>
                                                            <p className="text-muted-foreground">{selectedAssignment.asset?.name}</p>
                                                          </div>
                                                          <div>
                                                            <p className="font-medium">Asset Tag:</p>
                                                            <p className="text-muted-foreground">{selectedAssignment.asset?.asset_tag}</p>
                                                          </div>
                                                          <div>
                                                            <p className="font-medium">Brand/Model:</p>
                                                            <p className="text-muted-foreground">
                                                              {selectedAssignment.asset?.brand} {selectedAssignment.asset?.model}
                                                            </p>
                                                          </div>
                                                          <div>
                                                            <p className="font-medium">Category:</p>
                                                            <p className="text-muted-foreground">{selectedAssignment.asset?.category?.name}</p>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {/* Employee Information Section */}
                                                      <div>
                                                        <h4 className="font-semibold text-base mb-3 text-primary">Employee Information</h4>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                          <div>
                                                            <p className="font-medium">Assigned To:</p>
                                                            <div className="flex items-center gap-2">
                                                              <Avatar className="h-6 w-6">
                                                                <AvatarFallback className="text-xs">
                                                                  {selectedAssignment.user?.full_name?.charAt(0)}
                                                                </AvatarFallback>
                                                              </Avatar>
                                                              <span className="text-muted-foreground">{selectedAssignment.user?.full_name}</span>
                                                            </div>
                                                          </div>
                                                          <div>
                                                            <p className="font-medium">Employee Status:</p>
                                                            <Badge variant={userData.user.status === 'active' ? 'default' : 'destructive'}>
                                                              {userData.user.status || 'active'}
                                                            </Badge>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {/* Assignment Details Section */}
                                                      <div>
                                                        <h4 className="font-semibold text-base mb-3 text-primary">Assignment Details</h4>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                          <div>
                                                            <p className="font-medium">Assignment Type:</p>
                                                            <Badge variant="outline">
                                                              {selectedAssignment.assignment_type || 'Permanent'}
                                                            </Badge>
                                                          </div>
                                                          <div>
                                                            <p className="font-medium">Status:</p>
                                                            <Badge className={selectedAssignment.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                                              {selectedAssignment.is_active ? 'Active' : 'Inactive'}
                                                            </Badge>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </DialogContent>
                                              </Dialog>
                                              
                                              <Button 
                                                size="sm" 
                                                variant={isEmployeeInactive ? "destructive" : "outline"}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const actionText = isEmployeeInactive 
                                                    ? `⚠ URGENT: Employee is inactive. Are you sure you want to unassign this asset from ${log.user_name}?`
                                                    : `Are you sure you want to unassign ${log.user_name} from this asset?`;
                                                  
                                                  const confirmed = window.confirm(actionText);
                                                  if (confirmed) {
                                                    unassignSpecificUser.mutate({ 
                                                      assignmentId: log.assignment_id,
                                                      returnCondition: 'good',
                                                      returnNotes: isEmployeeInactive 
                                                        ? `Asset revoked - Employee ${log.user_name} is inactive`
                                                        : `User ${log.user_name} unassigned by HR`
                                                    });
                                                  }
                                                }}
                                                disabled={unassignSpecificUser.isPending}
                                              >
                                                {isEmployeeInactive ? (
                                                  <>
                                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                                    Revoke Asset
                                                  </>
                                                ) : (
                                                  'Unassign'
                                                )}
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                  })
                                ) : (
                                  <div className="text-center py-8">
                                    <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                      {userLogsLoading ? 'Loading assignment history...' : 
                                       userLogsError ? `Error loading logs: ${userLogsError.message}` :
                                       'No assignment history found'}
                                    </p>
                                    {userLogsError && (
                                      <p className="text-xs text-muted-foreground mt-2">
                                        Try clicking "Sync Logs" to initialize the assignment history system.
                                      </p>
                                    )}
                                  </div>
                                )
                              ) : isExpanded ? (
                                <div className="text-center py-8">
                                  <p className="text-sm text-muted-foreground">Click to view assignment history</p>
                                </div>
                              ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Asset Assignments Found</h3>
                  <p className="text-muted-foreground">
                    No employees have been assigned assets yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Asset Dialog */}
      <Dialog 
        open={isEditAssetDialogOpen} 
        onOpenChange={(open) => {
          setIsEditAssetDialogOpen(open);
          if (!open) {
            // Reset form and selected asset when dialog is closed
            assetForm.reset();
            setSelectedAsset(null);
            setShowNewCategoryInput(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update asset information and details
            </DialogDescription>
          </DialogHeader>
          <Form {...assetForm}>
            <form onSubmit={assetForm.handleSubmit(onAssetUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="asset_tag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Tag *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., LAP-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assetForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., MacBook Pro 16-inch" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          if (value === 'create_new') {
                            setShowNewCategoryInput(true);
                          } else {
                            setShowNewCategoryInput(false);
                            
                            // Check if selected category is "virtual machine"
                            const selectedCategory = categories?.find(cat => cat.id === value);
                            if (selectedCategory?.name.toLowerCase() === 'virtual machine') {
                              // Close edit asset dialog and open VM dialog
                              setIsEditAssetDialogOpen(false);
                              setIsCreateVMDialogOpen(true);
                              setSelectedAsset(null);
                              assetForm.reset();
                              return;
                            }
                          }
                          field.onChange(value);
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger >
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                          {(user?.role?.name === 'admin' || user?.role?.name === 'super_admin' || user?.isSA) && (
                            <SelectItem value="create_new">
                              <span className="text-blue-600 font-medium">+ Create New Category</span>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showNewCategoryInput && (
                  <FormField
                    control={assetForm.control}
                    name="new_category_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Category Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter new category name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={assetForm.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={assetForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Apple, Dell, HP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assetForm.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., MacBook Pro M3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="serial_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Device serial number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assetForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Office Floor 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick purchase date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assetForm.control}
                  name="purchase_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Cost</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={assetForm.control}
                name="warranty_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warranty Expiry</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick warranty expiry date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Extended Date Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="insurance_warranty_extended"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance/Warranty Extended</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick extended warranty date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assetForm.control}
                  name="previous_audit_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous Audit Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick audit date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={assetForm.control}
                name="hardware_image_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hardware Image Date (Quarterly)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick hardware image date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Document Links */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="invoice_copy_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Copy Link</FormLabel>
                      <FormControl>
                        <Input 
                          type="url"
                          placeholder="https://example.com/invoice.pdf" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assetForm.control}
                  name="warranty_document_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warranty Document Link</FormLabel>
                      <FormControl>
                        <Input 
                          type="url"
                          placeholder="https://example.com/warranty.pdf" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={assetForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional information about the asset..."
                        
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditAssetDialogOpen(false);
                    setSelectedAsset(null);
                    setShowNewCategoryInput(false);
                    assetForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAsset.isPending}>
                  {updateAsset.isPending ? 'Updating...' : 'Update Asset'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog 
        open={isEditAssignmentDialogOpen} 
        onOpenChange={(open) => {
          setIsEditAssignmentDialogOpen(open);
          if (!open) {
            // Reset form and selected assignment when dialog is closed
            editAssignmentForm.reset();
            setSelectedAssignment(null);
            setShowEditExpiryDate(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Asset Assignment</DialogTitle>
            <DialogDescription>
              Update asset assignment details and conditions
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editAssignmentForm}>
            <form onSubmit={editAssignmentForm.handleSubmit(onAssignmentUpdate)} className="space-y-4">
                <FormField
                control={editAssignmentForm.control}
                name="asset_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger >
                          <SelectValue placeholder={selectedAssignment?.asset ? 
                            `${selectedAssignment.asset.name} (${selectedAssignment.asset.asset_tag})` : 
                            "Select an asset"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableAssets?.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            <div className="flex items-center gap-2">
                              {React.createElement(getAssetIcon(asset.category?.name || ''), { className: "h-4 w-4" })}
                              <span>{asset.name} ({asset.asset_tag})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editAssignmentForm.control}
                name="user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger >
                          <SelectValue 
                            placeholder={selectedAssignment?.user ? 
                              `${selectedAssignment.user.full_name} (${selectedAssignment.user.employee_id})` : 
                              "Select an employee"
                            } 
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredEmployees?.map((employee: any) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={employee.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {employee.full_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{employee.full_name} ({employee.employee_id})</span>
                              {employee.department?.name && (
                                <span className="text-muted-foreground ml-1">
                                  - {employee.department.name}
                                </span>
                              )}
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
                  control={editAssignmentForm.control}
                  name="assignment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignment Type *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setShowEditExpiryDate(value === 'temporary');
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger >
                            <SelectValue placeholder="Select assignment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="permanent">Permanent</SelectItem>
                          <SelectItem value="temporary">Temporary</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showEditExpiryDate && (
                  <FormField
                    control={editAssignmentForm.control}
                    name="assignment_expiry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick expiry date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={editAssignmentForm.control}
                name="condition_at_issuance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Condition at Issuance *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger >
                          <SelectValue placeholder="Select asset condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editAssignmentForm.control}
                name="issuance_condition_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition Notes (Employee Assessment)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Employee's notes about the asset condition at issuance..."
                        
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editAssignmentForm.control}
                name="return_condition_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Condition Notes (HR Assessment)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="HR notes about asset condition when returned..."
                        
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editAssignmentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignment Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Purpose, project, or additional notes..."
                        
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditAssignmentDialogOpen(false);
                    setSelectedAssignment(null);
                    setShowEditExpiryDate(false);
                    editAssignmentForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAssignment.isPending}>
                  {updateAssignment.isPending ? 'Updating...' : 'Update Assignment'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit VM Dialog */}
      <Dialog open={isEditVMDialogOpen} onOpenChange={(open) => {
        setIsEditVMDialogOpen(open);
        if (!open) {
          // Reset VM state when dialog closes
          setSelectedVM(null);
          setVMAssetId('');
          setSelectedAsset(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Virtual Machine</DialogTitle>
            <DialogDescription>
              Update virtual machine configuration and details
            </DialogDescription>
          </DialogHeader>
          
          {(vmDataLoading && vmAssetId && !selectedVM) ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-2">Loading VM data...</span>
            </div>
          ) : (vmDataError && vmAssetId && !specificVMData && !selectedVM) ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-2">⚠️ Error loading VM data</div>
              <p className="text-sm text-muted-foreground">
                There was an error fetching the virtual machine information. Please try again.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditVMDialogOpen(false);
                  setVMAssetId('');
                }}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          ) : !specificVMData && !selectedVM ? (
            <div className="text-center py-8">
              <div className="text-yellow-600 mb-2">📋 No VM data available</div>
              <p className="text-sm text-muted-foreground">
                No virtual machine configuration found for this asset. Check the console for details.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditVMDialogOpen(false);
                  setVMAssetId('');
                }}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          ) : (specificVMData || selectedVM) && (() => {
            const currentVM = specificVMData || selectedVM;
            return (
              <div className="space-y-6">
                {/* VM Header Information */}
                <div className="bg-primary/5 p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Server className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold">VM-{currentVM.vm_number || 'N/A'}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>📍 {currentVM.vm_location || 'N/A'}</span>
                        <span>•</span>
                        <span>☁️ {currentVM.cloud_provider || 'N/A'}</span>
                        <span>•</span>
                        <span>🔐 {currentVM.access_type || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Form {...editVMForm}>
            <form onSubmit={editVMForm.handleSubmit(onVMUpdate)} className="space-y-6">
              {/* Basic Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="vm_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-sm text-gray-600">VM Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter VM number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="vm_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VM Location *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="indian">Indian</SelectItem>
                            <SelectItem value="us">US</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="access_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select access type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="cloud_provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cloud Provider *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="aws">AWS</SelectItem>
                            <SelectItem value="azure">Azure</SelectItem>
                            <SelectItem value="gcp">GCP</SelectItem>
                            <SelectItem value="on-prem">On-Prem</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Request Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Request Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="requested_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requested By *</FormLabel>
                        <FormControl>
                          <Input placeholder="Name of requester" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="approved_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approved By *</FormLabel>
                        <FormControl>
                          <Input placeholder="Name of approver" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="created_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Created By *</FormLabel>
                        <FormControl>
                          <Input placeholder="Name of creator" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="request_ticket_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request Ticket ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ticket reference ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Project Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Project Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="current_user_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current User Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select user type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="multiple">Multiple</SelectItem>
                            <SelectItem value="single">Single</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select purpose" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="client_project">Client Project</SelectItem>
                            <SelectItem value="internal_project">Internal Project</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="project_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Name of the project" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Access Credentials Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Access Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="VM username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="current_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password *</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="Current password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="previous_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous Password</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="Previous password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Network Configuration Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Network Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="ip_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 192.168.1.100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="ghost_ip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ghost IP</FormLabel>
                        <FormControl>
                          <Input placeholder="Ghost IP address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="vpn_requirement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VPN Requirement *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="VPN required?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="mfa_enabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MFA Enabled *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="MFA enabled?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Infrastructure & Compliance Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Infrastructure & Compliance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="backup_enabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backup Enabled *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Backup enabled?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="audit_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audit Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger >
                              <SelectValue placeholder="Select audit status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="compliant">Compliant</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Important Dates Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Important Dates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editVMForm.control}
                    name="approval_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick approval date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editVMForm.control}
                    name="expiry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDateForDisplayUtil(field.value, "PPP") : "Pick expiry date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditVMDialogOpen(false);
                    setSelectedVM(null);
                    editVMForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Update VM
                </Button>
              </div>
            </form>
          </Form>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View VM Dialog */}
      <Dialog open={isViewVMDialogOpen} onOpenChange={(open) => {
        setIsViewVMDialogOpen(open);
        if (!open) {
          // Reset VM state when dialog closes
          setSelectedVM(null);
          setVMAssetId('');
          setSelectedAsset(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Virtual Machine Details</DialogTitle>
            <DialogDescription>
              Complete information about this virtual machine
            </DialogDescription>
          </DialogHeader>
          
          {(vmDataLoading && vmAssetId && !selectedVM) ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-2">Loading VM data...</span>
            </div>
          ) : (vmDataError && vmAssetId && !specificVMData && !selectedVM) ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-2">⚠️ Error loading VM data</div>
              <p className="text-sm text-muted-foreground">
                There was an error fetching the virtual machine information. Please try again.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsViewVMDialogOpen(false);
                  setVMAssetId('');
                }}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          ) : !specificVMData && !selectedVM ? (
            <div className="text-center py-8">
              <div className="text-yellow-600 mb-2">📋 No VM data available</div>
              <p className="text-sm text-muted-foreground">
                No virtual machine configuration found for this asset. Check the console for details.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsViewVMDialogOpen(false);
                  setVMAssetId('');
                }}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          ) : (specificVMData || selectedVM) && (() => {
            const currentVM = specificVMData || selectedVM;
            return (
            <div className="space-y-4">
              {/* VM Header Information */}
              <div className="bg-primary/5 p-2 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Server className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="text-md font-semibold">VM-{currentVM.vm_number || 'N/A'}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>📍 {currentVM.vm_location || 'N/A'}</span>
                      <span>•</span>
                      <span>☁️ {currentVM.cloud_provider || 'N/A'}</span>
                      <span>•</span>
                      <span>🔐 {currentVM.access_type || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Information Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Basic Information
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">VM Number</p>
                      <p className="text-sm">{currentVM.vm_number || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">VM Location</p>
                      <p className="text-sm">{currentVM.vm_location || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">Access Type</p>
                      <Badge variant="outline">{currentVM.access_type || 'Not specified'}</Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Cloud Provider</p>
                      <Badge variant="secondary">{currentVM.cloud_provider || 'Not specified'}</Badge>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">Current User Type</p>
                      <p className="text-sm">{currentVM.current_user_type || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">Purpose</p>
                      <p className="text-sm">{currentVM.purpose.split('_').map((word:string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Not specified'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Request Information Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Request Information
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Requested By</p>
                      <p className="text-sm">{currentVM.requested_by || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">Approved By</p>
                      <p className="text-sm">{currentVM.approved_by || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Created By</p>
                      <p className="text-sm">{currentVM.created_by || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">Request Ticket ID</p>
                      <Badge variant="outline">{currentVM.request_ticket_id || 'Not specified'}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Information Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Project Information
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Project Name</p>
                      <p className="text-sm font-medium">{currentVM.project_name || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Purpose</p>
                      <Badge variant="secondary">{currentVM.purpose || 'Not specified'}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Credentials Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Access Credentials
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Username</p>
                      <p className="text-sm bg-muted px-2 py-1 rounded">{currentVM.username || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Current Password</p>
                      <p className="text-sm bg-muted px-2 py-1 rounded">{currentVM.current_password || 'Not configured'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Previous Password</p>
                      <p className="text-sm bg-muted px-2 py-1 rounded">{currentVM.previous_password || 'Not configured'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Configuration Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Network Configuration
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">IP Address</p>
                      <p className="text-sm bg-muted px-2 py-1 rounded">{currentVM.ip_address || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">Ghost IP</p>
                      <p className="text-sm bg-muted px-2 py-1 rounded">{currentVM.ghost_ip || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">VPN Requirement</p>
                      <Badge variant={currentVM.vpn_requirement === 'yes' ? "default" : "secondary"}>
                        {currentVM.vpn_requirement === 'yes' ? 'Required' : 'Not Required'}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-600">MFA Enabled</p>
                      <Badge variant={currentVM.mfa_enabled === 'yes' ? "default" : "secondary"}>
                        {currentVM.mfa_enabled === 'yes' ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Infrastructure & Compliance Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Infrastructure & Compliance
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Backup Enabled</p>
                      <Badge variant={currentVM.backup_enabled === 'yes' ? "default" : "destructive"}>
                        {currentVM.backup_enabled === 'yes' ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Audit Status</p>
                      <Badge variant={
                        currentVM.audit_status === 'compliant' ? "default" :
                        currentVM.audit_status === 'pending' ? "secondary" : "destructive"
                      }>
                        {currentVM.audit_status || 'Not specified'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Dates Section */}
              <div>
                <h4 className="font-semibold text-md mb-4 text-primary flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Important Dates
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Approval Date</p>
                      <p className="text-sm">
                        {currentVM.approval_date ? formatDateForDisplayUtil(currentVM.approval_date, 'PPP') : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-600">Expiry Date</p>
                      <p className="text-sm">
                        {currentVM.expiry_date ? formatDateForDisplayUtil(currentVM.expiry_date, 'PPP') : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsViewVMDialogOpen(false);
                    setSelectedVM(null);
                    setVMAssetId('');
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Complaint Details Dialog */}
      <Dialog open={isComplaintDetailsDialogOpen} onOpenChange={setIsComplaintDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complaint Details</DialogTitle>
            <DialogDescription>
              Complete information about this asset complaint
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-6">
              {/* Asset Information */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">Asset Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Asset Name:</p>
                    <p className="text-muted-foreground">{selectedComplaint.asset?.name}</p>
                  </div>
                  <div>
                    <p className="font-medium">Asset Tag:</p>
                    <p className="text-muted-foreground">{selectedComplaint.asset?.asset_tag}</p>
                  </div>
                  <div>
                    <p className="font-medium">Brand/Model:</p>
                    <p className="text-muted-foreground">
                      {selectedComplaint.asset?.brand} {selectedComplaint.asset?.model}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Category:</p>
                    <p className="text-muted-foreground">{selectedComplaint.asset?.category?.name}</p>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">User Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Reported By:</p>
                    <p className="text-muted-foreground">{selectedComplaint.user?.full_name}</p>
                  </div>
                  <div>
                    <p className="font-medium">Employee ID:</p>
                    <p className="text-muted-foreground">{selectedComplaint.user?.employee_id}</p>
                  </div>
                </div>
              </div>

              {/* Complaint Details */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">Complaint Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Status:</p>
                    <Badge className={
                      selectedComplaint.status === 'open' ? 'bg-red-100 text-red-800' :
                      selectedComplaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      selectedComplaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {selectedComplaint.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">Priority:</p>
                    <Badge className={getPriorityBadge(selectedComplaint.priority || 'medium')}>
                      {(selectedComplaint.priority || 'medium').toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">Submitted Date:</p>
                    <p className="text-muted-foreground">
                      {formatDateForDisplayUtil(selectedComplaint.created_at, 'PPP')}
                    </p>
                  </div>
                  {selectedComplaint.resolved_at && (
                    <div>
                      <p className="font-medium">Resolved Date:</p>
                      <p className="text-muted-foreground">
                        {formatDateForDisplayUtil(selectedComplaint.resolved_at, 'PPP')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">Problem Description</h4>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{selectedComplaint.problem_description}</p>
                </div>
              </div>

              {/* Resolution Details */}
              {selectedComplaint.resolved_by_user && (
                <div>
                  <h4 className="font-semibold text-base mb-3 text-primary">Resolution Details</h4>
                  <div className="text-sm">
                    <div>
                      <p className="font-medium">Resolved By:</p>
                      <p className="text-muted-foreground">{selectedComplaint.resolved_by_user.full_name}</p>
                    </div>
                    {selectedComplaint.resolution_notes && (
                      <div className="mt-3">
                        <p className="font-medium">Resolution Notes:</p>
                        <div className="p-3 bg-muted rounded-md mt-1">
                          <p className="text-sm">{selectedComplaint.resolution_notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setIsComplaintDetailsDialogOpen(false)}
                >
                  Close
                </Button>
                {selectedComplaint.status !== 'resolved' && selectedComplaint.status !== 'closed' && (
                  <Select
                    value={selectedComplaint.status}
                    onValueChange={(value) => {
                      handleUpdateComplaintStatus(selectedComplaint.id, value);
                      setIsComplaintDetailsDialogOpen(false);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Mark as Open</SelectItem>
                      <SelectItem value="in_progress">Mark as In Progress</SelectItem>
                      <SelectItem value="resolved">Mark as Resolved</SelectItem>
                      <SelectItem value="closed">Mark as Closed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Complaint Dialog */}
      <Dialog open={isEditComplaintDialogOpen} onOpenChange={(open) => {
        setIsEditComplaintDialogOpen(open);
        if (!open) {
          editComplaintForm.reset();
          setSelectedComplaint(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Complaint</DialogTitle>
            <DialogDescription>
              Update complaint status, priority, and add resolution notes
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              {/* Complaint Summary */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Asset:</p>
                    <p className="text-muted-foreground">{selectedComplaint.asset?.name} ({selectedComplaint.asset?.asset_tag})</p>
                  </div>
                  <div>
                    <p className="font-medium">Reported by:</p>
                    <p className="text-muted-foreground">{selectedComplaint.user?.full_name}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium">Problem:</p>
                    <p className="text-muted-foreground text-sm">{selectedComplaint.problem_description}</p>
                  </div>
                </div>
              </div>

              <Form {...editComplaintForm}>
                <form onSubmit={editComplaintForm.handleSubmit(onComplaintResolutionSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editComplaintForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger >
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editComplaintForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger >
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editComplaintForm.control}
                    name="resolution_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resolution Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add notes about the resolution, actions taken, or any additional information..."
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditComplaintDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateComplaint.isPending}>
                      {updateComplaint.isPending ? 'Updating...' : 'Update Complaint'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Asset Request Dialog */}
      <Dialog open={isViewAssetRequestDialogOpen} onOpenChange={setIsViewAssetRequestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Request Details</DialogTitle>
            <DialogDescription>
              Complete information about the asset request
            </DialogDescription>
          </DialogHeader>
          {selectedAssetRequest && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">Request Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Employee:</p>
                    <p className="text-muted-foreground">
                      {selectedAssetRequest.user?.full_name} ({selectedAssetRequest.user?.employee_id})
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Department:</p>
                    <p className="text-muted-foreground">{selectedAssetRequest.user?.department?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Category:</p>
                    <div className="flex items-center gap-2 mt-1">
                      {React.createElement(getAssetIcon(selectedAssetRequest.category?.name || ''), { className: "h-4 w-4" })}
                      <span>{selectedAssetRequest.category?.name}</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Priority:</p>
                    <Badge className={getPriorityBadge(selectedAssetRequest.priority || 'medium')} style={{ marginTop: '4px' }}>
                      {(selectedAssetRequest.priority || 'medium').toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">Status:</p>
                    <Badge className={getRequestStatusBadge(selectedAssetRequest.status)} style={{ marginTop: '4px' }}>
                      {selectedAssetRequest.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">Submitted:</p>
                    <p className="text-muted-foreground">
                      {formatDateForDisplayUtil(selectedAssetRequest.created_at, 'PPP')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">Description</h4>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{selectedAssetRequest.description}</p>
                </div>
              </div>

              {/* Justification */}
              <div>
                <h4 className="font-semibold text-base mb-3 text-primary">Justification & Purpose</h4>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{selectedAssetRequest.justification}</p>
                </div>
              </div>

              {/* Approval/Rejection Details */}
              {(selectedAssetRequest.approved_by_user || selectedAssetRequest.rejected_by_user) && selectedAssetRequest.status !== 'fulfilled' && (
                <div>
                  <h4 className="font-semibold text-base mb-3 text-primary">
                    {selectedAssetRequest.status === 'approved' ? 'Approval' : 'Rejection'} Details
                  </h4>
                  <div className="text-sm">
                    <div>
                      <p className="font-medium">
                        {selectedAssetRequest.status === 'approved' ? 'Approved' : 'Rejected'} By:
                      </p>
                      <p className="text-muted-foreground">
                        {selectedAssetRequest.approved_by_user?.full_name || selectedAssetRequest.rejected_by_user?.full_name}
                      </p>
                    </div>
                    {(selectedAssetRequest.approval_notes || selectedAssetRequest.rejection_reason) && (
                      <div className="mt-3">
                        <p className="font-medium">
                          {selectedAssetRequest.status === 'approved' ? 'Approval Notes:' : 'Rejection Reason:'}
                        </p>
                        <div className="p-3 bg-muted rounded-md mt-1">
                          <p className="text-sm">
                            {selectedAssetRequest.approval_notes || selectedAssetRequest.rejection_reason}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fulfillment Details */}
              {selectedAssetRequest.fulfilled_by_user && (
                <div>
                  <h4 className="font-semibold text-base mb-3 text-primary">Fulfillment Details</h4>
                  <div className="text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium">Fulfilled By:</p>
                        <p className="text-muted-foreground">{selectedAssetRequest.fulfilled_by_user.full_name}</p>
                      </div>
                      <div>
                        <p className="font-medium">Fulfilled Date:</p>
                        <p className="text-muted-foreground">
                          {selectedAssetRequest.fulfilled_at ? 
                            formatDateForDisplayUtil(selectedAssetRequest.fulfilled_at, 'PPP') : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {selectedAssetRequest.fulfilled_asset && (
                      <div className="mt-3">
                        <p className="font-medium">Assigned Asset:</p>
                        <p className="text-muted-foreground">
                          {selectedAssetRequest.fulfilled_asset.name} ({selectedAssetRequest.fulfilled_asset.asset_tag})
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setIsViewAssetRequestDialogOpen(false)}
                >
                  Close
                </Button>
                {selectedAssetRequest.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                      onClick={() => {
                        setIsViewAssetRequestDialogOpen(false);
                        handleAssetRequestAction(selectedAssetRequest, 'approve');
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      onClick={() => {
                        setIsViewAssetRequestDialogOpen(false);
                        handleAssetRequestAction(selectedAssetRequest, 'reject');
                      }}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedAssetRequest.status === 'approved' && (
                  <Button
                    variant="outline"
                    className="text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
                    onClick={() => {
                      setIsViewAssetRequestDialogOpen(false);
                      handleFulfillAssetRequest(selectedAssetRequest);
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Fulfill Request
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Asset Request Action Dialog */}
      <Dialog open={isAssetRequestActionDialogOpen} onOpenChange={setIsAssetRequestActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assetRequestAction === 'approve' ? 
                (assetRequestActionForm.watch('status') === 'fulfilled' ? 'Fulfill Asset Request' : 'Approve Asset Request') :
                'Reject Asset Request'
              }
            </DialogTitle>
            <DialogDescription>
              {assetRequestAction === 'approve' ? 
                (assetRequestActionForm.watch('status') === 'fulfilled' ? 
                  'Assign an asset to fulfill this request.' :
                  'Approve this asset request for processing.'
                ) :
                'Provide a reason for rejecting this asset request.'
              }
            </DialogDescription>
          </DialogHeader>
          {selectedAssetRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{selectedAssetRequest.user?.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAssetRequest.category?.name} - {selectedAssetRequest.description}
                </p>
              </div>

              <Form {...assetRequestActionForm}>
                <form onSubmit={assetRequestActionForm.handleSubmit(onAssetRequestActionSubmit)} className="space-y-4">
                  {assetRequestAction === 'approve' && assetRequestActionForm.watch('status') === 'fulfilled' && (
                    <FormField
                      control={assetRequestActionForm.control}
                      name="fulfilled_asset_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Asset to Assign</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger >
                                <SelectValue placeholder="Choose an asset" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {roleBasedFilteredAssets?.filter(asset => 
                                asset.status !== 'archived'
                              ).map((asset) => (
                                <SelectItem key={asset.id} value={asset.id}>
                                  <div className="flex items-center gap-2">
                                    {React.createElement(getAssetIcon(asset.category?.name || ''), { className: "h-4 w-4" })}
                                    <div className="flex flex-col">
                                      <span>{asset.name} ({asset.asset_tag})</span>
                                      <span className="text-xs text-muted-foreground">
                                        {asset.category?.name} • [{asset.status}]
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {assetRequestAction === 'approve' && assetRequestActionForm.watch('status') !== 'fulfilled' && (
                    <FormField
                      control={assetRequestActionForm.control}
                      name="approval_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approval Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Add any notes about the approval..."
                              rows={3}
                              
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {assetRequestAction === 'reject' && (
                    <FormField
                      control={assetRequestActionForm.control}
                      name="rejection_reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rejection Reason *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Please explain why this request is being rejected..."
                              rows={4}
                              
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAssetRequestActionDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateAssetRequest.isPending}
                      className={
                        assetRequestAction === 'approve' ? 
                          'bg-green-600 hover:bg-green-700' : 
                          'bg-red-600 hover:bg-red-700'
                      }
                    >
                      {updateAssetRequest.isPending ? 'Processing...' : 
                        (assetRequestAction === 'approve' ? 
                          (assetRequestActionForm.watch('status') === 'fulfilled' ? 'Fulfill Request' : 'Approve Request') :
                          'Reject Request'
                        )
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
