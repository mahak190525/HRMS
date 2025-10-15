import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAssets, useCreateAssetComplaint, useUserAssetComplaints, useAssetCategories, useCreateAssetRequest, useUserAssetRequests, useUpdateAssignmentCondition } from '@/hooks/useEmployees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Package,
  Plus,
  Monitor,
  Smartphone,
  HardDrive,
  Keyboard,
  Mouse,
  Headphones,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  Camera,
} from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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

const complaintSchema = z.object({
  asset_assignment_id: z.string().min(1, 'Please select an asset'),
  problem_description: z.string().min(10, 'Please provide a detailed description (at least 10 characters)'),
  priority: z.string().min(1, 'Please select priority'),
});

const assetRequestSchema = z.object({
  category_id: z.string().min(1, 'Please select an asset category'),
  description: z.string().min(10, 'Please provide a detailed description (at least 10 characters)'),
  justification: z.string().min(5, 'Please explain what this asset is needed for (at least 5 characters)'),
  priority: z.string().min(1, 'Please select priority'),
});

const conditionNotesSchema = z.object({
  condition_at_issuance: z.string().min(1, 'Please select asset condition'),
  issuance_condition_notes: z.string().optional(),
});

type ComplaintFormData = z.infer<typeof complaintSchema>;
type AssetRequestFormData = z.infer<typeof assetRequestSchema>;
type ConditionNotesFormData = z.infer<typeof conditionNotesSchema>;

const getAssetIcon = (categoryName: string) => {
  const category = categoryName?.toLowerCase() || '';
  if (category.includes('laptop')) return assetIcons.laptop;
  if (category.includes('desktop')) return assetIcons.desktop;
  if (category.includes('mobile') || category.includes('phone')) return assetIcons.mobile;
  if (category.includes('tablet')) return assetIcons.tablet;
  if (category.includes('storage') || category.includes('drive')) return assetIcons.storage;
  if (category.includes('keyboard')) return assetIcons.keyboard;
  if (category.includes('mouse')) return assetIcons.mouse;
  if (category.includes('headphone') || category.includes('audio')) return assetIcons.headphones;
  return assetIcons.other;
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

const getStatusBadge = (status: string) => {
  const variants = {
    open: 'bg-red-100 text-red-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    pending: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    fulfilled: 'bg-purple-100 text-purple-800',
  };
  return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open':
      return <AlertTriangle className="h-4 w-4" />;
    case 'in_progress':
      return <Clock className="h-4 w-4" />;
    case 'resolved':
      return <CheckCircle className="h-4 w-4" />;
    case 'closed':
      return <CheckCircle className="h-4 w-4" />;
    case 'pending':
      return <Clock className="h-4 w-4" />;
    case 'approved':
      return <CheckCircle className="h-4 w-4" />;
    case 'rejected':
      return <AlertTriangle className="h-4 w-4" />;
    case 'fulfilled':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
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

export function Assets() {
  const { user } = useAuth();
  const { data: userAssets, isLoading: assetsLoading } = useUserAssets(user?.id);
  const { data: userComplaints, isLoading: complaintsLoading } = useUserAssetComplaints(user?.id);
  const { data: assetCategories } = useAssetCategories();
  const { data: userRequests, isLoading: requestsLoading, error: requestsError } = useUserAssetRequests(user?.id);
  const createComplaint = useCreateAssetComplaint();
  const createAssetRequest = useCreateAssetRequest();
  const updateAssignmentCondition = useUpdateAssignmentCondition();
  const [isComplaintDialogOpen, setIsComplaintDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isConditionNotesDialogOpen, setIsConditionNotesDialogOpen] = useState(false);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<any>(null);

  const complaintForm = useForm<ComplaintFormData>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      asset_assignment_id: '',
      problem_description: '',
      priority: '',
    },
  });

  const requestForm = useForm<AssetRequestFormData>({
    resolver: zodResolver(assetRequestSchema),
    defaultValues: {
      category_id: '',
      description: '',
      justification: '',
      priority: '',
    },
  });

  const conditionNotesForm = useForm<ConditionNotesFormData>({
    resolver: zodResolver(conditionNotesSchema),
    defaultValues: {
      condition_at_issuance: '',
      issuance_condition_notes: '',
    },
  });

  const onComplaintSubmit = async (data: ComplaintFormData) => {
    if (!user) return;

    // Find the selected assignment to get asset details
    const selectedAssignment = userAssets?.find(assignment => assignment.id === data.asset_assignment_id);
    if (!selectedAssignment) {
      toast.error('Selected asset not found');
      return;
    }

    createComplaint.mutate({
      user_id: user.id,
      asset_id: selectedAssignment.asset.id,
      asset_assignment_id: data.asset_assignment_id,
      problem_description: data.problem_description,
      priority: data.priority,
    }, {
      onSuccess: () => {
        setIsComplaintDialogOpen(false);
        complaintForm.reset();
      }
    });
  };

  const onAssetRequestSubmit = async (data: AssetRequestFormData) => {
    if (!user) return;

    try {
      createAssetRequest.mutate({
        user_id: user.id,
        category_id: data.category_id,
        description: data.description,
        justification: data.justification,
        priority: data.priority,
      }, {
        onSuccess: () => {
          setIsRequestDialogOpen(false);
          requestForm.reset();
        },
        onError: (error) => {
          console.error('Asset request submission error:', error);
          toast.error('Failed to submit asset request. The feature may not be available yet.');
        }
      });
    } catch (error) {
      console.error('Asset request submission error:', error);
      toast.error('Failed to submit asset request. Please try again later.');
    }
  };

  const handleEditConditionNotes = (assignment: any) => {
    setSelectedAssetForEdit(assignment);
    conditionNotesForm.reset({
      condition_at_issuance: assignment.condition_at_issuance || 'good',
      issuance_condition_notes: assignment.issuance_condition_notes || '',
    });
    setIsConditionNotesDialogOpen(true);
  };

  const onConditionNotesSubmit = async (data: ConditionNotesFormData) => {
    if (!selectedAssetForEdit) return;

    updateAssignmentCondition.mutate({
      assignmentId: selectedAssetForEdit.id,
      condition: data.condition_at_issuance,
      notes: data.issuance_condition_notes,
    }, {
      onSuccess: () => {
        setIsConditionNotesDialogOpen(false);
        setSelectedAssetForEdit(null);
        conditionNotesForm.reset();
      }
    });
  };

  if (assetsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <span className="ml-2">Loading your assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Assets</h1>
          <p className="text-muted-foreground">
            View your assigned assets, request new assets, and report any issues
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog 
            open={isRequestDialogOpen} 
            onOpenChange={(open) => {
              setIsRequestDialogOpen(open);
              if (!open) {
                requestForm.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={!!requestsError}>
                <Plus className="h-4 w-4 mr-2" />
                Request an Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Request an Asset</DialogTitle>
                <DialogDescription>
                  Submit a request for a new asset to be assigned to you.
                </DialogDescription>
              </DialogHeader>
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onAssetRequestSubmit)} className="space-y-4">
                  <FormField
                    control={requestForm.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Category *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose an asset category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assetCategories?.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  {React.createElement(getAssetIcon(category.name || ''), { className: "h-4 w-4" })}
                                  <span>{category.name}</span>
                                </div>
                              </SelectItem>
                            )) || (
                              <SelectItem value="" disabled>
                                Loading categories...
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={requestForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                Low
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                Medium
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                High
                              </div>
                            </SelectItem>
                            <SelectItem value="urgent">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                Urgent
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={requestForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Please describe what type of asset you need..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={requestForm.control}
                    name="justification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justification & Purpose *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Please explain what this asset is needed for and how it will be used..."
                            rows={3}
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
                      onClick={() => setIsRequestDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAssetRequest.isPending}>
                      {createAssetRequest.isPending ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog 
            open={isComplaintDialogOpen} 
            onOpenChange={(open) => {
              setIsComplaintDialogOpen(open);
              if (!open) {
                complaintForm.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Report Asset Issue</DialogTitle>
                <DialogDescription>
                  Submit a maintenance or support request for one of your assigned assets.
                </DialogDescription>
              </DialogHeader>
              <Form {...complaintForm}>
                <form onSubmit={complaintForm.handleSubmit(onComplaintSubmit)} className="space-y-4">
                  <FormField
                    control={complaintForm.control}
                    name="asset_assignment_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Asset *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose an asset" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {userAssets?.map((assignment) => (
                              <SelectItem key={assignment.id} value={assignment.id}>
                                <div className="flex items-center gap-2">
                                  {React.createElement(getAssetIcon(assignment.asset.category?.name || ''), { className: "h-4 w-4" })}
                                  <span>{assignment.asset.name} ({assignment.asset.asset_tag})</span>
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
                    control={complaintForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                Low
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                Medium
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                High
                              </div>
                            </SelectItem>
                            <SelectItem value="urgent">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                Urgent
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={complaintForm.control}
                    name="problem_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Problem Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Please describe the issue in detail..."
                            rows={4}
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
                      onClick={() => setIsComplaintDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createComplaint.isPending}>
                      {createComplaint.isPending ? 'Submitting...' : 'Submit Report'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="assets">My Assets</TabsTrigger>
          <TabsTrigger value="images">Quarterly Images</TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="maintenance">Asset Maintenance & Support</TabsTrigger>
          <TabsTrigger value="complaints">My Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Assigned Assets
              </CardTitle>
              <CardDescription>
                Assets currently assigned to you
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!userAssets || userAssets.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Assets Assigned</h3>
                  <p className="text-muted-foreground">
                    You don't have any assets assigned to you at the moment.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Asset Tag</TableHead>
                        <TableHead>Brand/Model</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Assigned Date</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userAssets.map((assignment) => {
                        const IconComponent = getAssetIcon(assignment.asset.category?.name || '');
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <span className="font-medium">{assignment.asset.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {assignment.asset.category?.name || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {assignment.asset.asset_tag}
                            </TableCell>
                            <TableCell>
                              {assignment.asset.brand && assignment.asset.model
                                ? `${assignment.asset.brand} ${assignment.asset.model}`
                                : assignment.asset.brand || assignment.asset.model || 'N/A'
                              }
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge className={getConditionBadge(assignment.condition_at_issuance || assignment.asset.condition || 'good')}>
                                  {assignment.condition_at_issuance || assignment.asset.condition || 'Good'}
                                </Badge>
                                {assignment.issuance_condition_notes && (
                                  <p className="text-xs text-muted-foreground truncate max-w-32" title={assignment.issuance_condition_notes}>
                                    Your notes: {assignment.issuance_condition_notes.length > 30 
                                      ? `${assignment.issuance_condition_notes.substring(0, 30)}...`
                                      : assignment.issuance_condition_notes
                                    }
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {assignment.assigned_date 
                                ? formatDateForDisplay(assignment.assigned_date, 'PPP')
                                : 'N/A'
                              }
                            </TableCell>
                            <TableCell>
                              {/* Only show for hardware assets */}
                              {!assignment.asset.category?.name?.toLowerCase()?.includes('software') && 
                               !assignment.asset.category?.name?.toLowerCase()?.includes('license') && 
                               !assignment.asset.category?.name?.toLowerCase()?.includes('subscription') ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex items-center gap-1"
                                    >
                                      <Camera className="h-3 w-3" />
                                      Images
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Asset Condition Images</DialogTitle>
                                      <DialogDescription>
                                        Upload and view quarterly condition images for {assignment.asset.name} ({assignment.asset.asset_tag})
                                      </DialogDescription>
                                    </DialogHeader>
                                    <AssetImageUpload
                                      assetAssignmentId={assignment.id}
                                      assetName={assignment.asset.name}
                                      assetTag={assignment.asset.asset_tag}
                                      userId={user?.id || ''}
                                      isHardwareAsset={true}
                                      onUploadComplete={() => {
                                        toast.success('Images uploaded successfully');
                                      }}
                                    />
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <span className="text-muted-foreground text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditConditionNotes(assignment)}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit Condition
                              </Button>
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

        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Quarterly Asset Images
              </CardTitle>
              <CardDescription>
                Upload quarterly condition images for your assigned hardware assets (up to 5 images per asset per quarter)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!userAssets || userAssets.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Assets Assigned</h3>
                  <p className="text-muted-foreground">
                    You don't have any assets assigned to you at the moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {userAssets
                    .filter(assignment => 
                      !assignment.asset.category?.name?.toLowerCase()?.includes('software') && 
                      !assignment.asset.category?.name?.toLowerCase()?.includes('license') && 
                      !assignment.asset.category?.name?.toLowerCase()?.includes('subscription')
                    )
                    .map((assignment) => {
                      const IconComponent = getAssetIcon(assignment.asset.category?.name || '');
                      return (
                        <div key={assignment.id} className="border rounded-lg p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <IconComponent className="h-6 w-6 text-muted-foreground" />
                            <div>
                              <h3 className="font-semibold text-lg">{assignment.asset.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {assignment.asset.asset_tag} • {assignment.asset.brand} {assignment.asset.model}
                              </p>
                            </div>
                            <Badge variant="outline" className="ml-auto">
                              {assignment.asset.category?.name}
                            </Badge>
                          </div>
                          
                          <AssetImageUpload
                            assetAssignmentId={assignment.id}
                            assetName={assignment.asset.name}
                            assetTag={assignment.asset.asset_tag}
                            userId={user?.id || ''}
                            isHardwareAsset={true}
                            onUploadComplete={() => {
                              toast.success('Images uploaded successfully');
                            }}
                          />
                        </div>
                      );
                    })
                  }
                  
                  {userAssets.filter(assignment => 
                    !assignment.asset.category?.name?.toLowerCase()?.includes('software') && 
                    !assignment.asset.category?.name?.toLowerCase()?.includes('license') && 
                    !assignment.asset.category?.name?.toLowerCase()?.includes('subscription')
                  ).length === 0 && (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Hardware Assets</h3>
                      <p className="text-muted-foreground">
                        You don't have any hardware assets that require quarterly image uploads. Only hardware assets need condition documentation.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                My Asset Requests
              </CardTitle>
              <CardDescription>
                Track the status of your asset requests. Requests require manager approval before HR can fulfill them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsError ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Asset Requests Unavailable</h3>
                  <p className="text-muted-foreground mb-4">
                    Asset requests feature is not yet available. Please contact your administrator.
                  </p>
                </div>
              ) : requestsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                  <span className="ml-2">Loading requests...</span>
                </div>
              ) : !userRequests || userRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Asset Requests</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't submitted any asset requests yet.
                  </p>
                  <Dialog 
                    open={isRequestDialogOpen} 
                    onOpenChange={(open) => {
                      setIsRequestDialogOpen(open);
                      if (!open) {
                        requestForm.reset();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button disabled={!!requestsError}>
                        <Plus className="h-4 w-4 mr-2" />
                        Request Your First Asset
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Approved/Rejected By</TableHead>
                        <TableHead>Fulfilled By</TableHead>
                        <TableHead>Fulfilled Asset</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {React.createElement(getAssetIcon(request.category?.name || ''), { className: "h-4 w-4" })}
                              <span className="font-medium">{request.category?.name || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="text-sm truncate" title={request.description}>
                                {request.description.length > 50 
                                  ? `${request.description.substring(0, 50)}...`
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
                            <Badge className={getStatusBadge(request.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(request.status)}
                                {request.status.replace('_', ' ').toUpperCase()}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateForDisplay(request.created_at, 'PPP')}
                          </TableCell>
                          <TableCell>
                            {request.approved_by_user?.full_name || 
                             request.rejected_by_user?.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            {request.fulfilled_by_user?.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            {request.fulfilled_asset 
                              ? `${request.fulfilled_asset.name} (${request.fulfilled_asset.asset_tag})`
                              : '-'
                            }
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
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Asset Maintenance & Support
              </CardTitle>
              <CardDescription>
                Report issues with your assigned assets for maintenance or support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Need Help with an Asset?</h3>
                <p className="text-muted-foreground mb-4">
                  If you're experiencing issues with any of your assigned assets, you can submit a maintenance or support request.
                </p>
                <Dialog 
                  open={isComplaintDialogOpen} 
                  onOpenChange={(open) => {
                    setIsComplaintDialogOpen(open);
                    if (!open) {
                      complaintForm.reset();
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Report New Issue
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Complaints
              </CardTitle>
              <CardDescription>
                Track the status of your submitted asset issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {complaintsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                  <span className="ml-2">Loading complaints...</span>
                </div>
              ) : !userComplaints || userComplaints.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Complaints Submitted</h3>
                  <p className="text-muted-foreground">
                    You haven't submitted any asset complaints yet.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead className="w-32">Problem</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Resolved By</TableHead>
                        <TableHead className="w-32">Resolution Notes</TableHead>
                        <TableHead>Resolution Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userComplaints.map((complaint) => (
                        <TableRow key={complaint.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {React.createElement(getAssetIcon(complaint.asset.category?.name || ''), { className: "h-4 w-4" })}
                              <div>
                                <span className="font-medium">{complaint.asset.name}</span>
                                <div className="text-sm text-muted-foreground">
                                  {complaint.asset.asset_tag}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              <p className="text-sm truncate" title={complaint.problem_description}>
                                {complaint.problem_description.length > 30 
                                  ? `${complaint.problem_description.substring(0, 30)}...`
                                  : complaint.problem_description
                                }
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityBadge(complaint.priority || 'medium')}>
                              {(complaint.priority || 'medium').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(complaint.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(complaint.status)}
                                {complaint.status.replace('_', ' ').toUpperCase()}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateForDisplay(complaint.created_at, 'PPP')}
                          </TableCell>
                          <TableCell>
                            {complaint.resolved_by_user?.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              {complaint.resolution_notes ? (
                                <p className="text-sm truncate" title={complaint.resolution_notes}>
                                  {complaint.resolution_notes.length > 30 
                                    ? `${complaint.resolution_notes.substring(0, 30)}...`
                                    : complaint.resolution_notes
                                  }
                                </p>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {complaint.resolved_at 
                              ? formatDateForDisplay(complaint.resolved_at, 'PPP')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
      </Tabs>

      {/* View Complaint Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[60vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complaint Details</DialogTitle>
            <DialogDescription>
              Full details of your submitted complaint
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-medium text-sm">Asset:</p>
                  <div className="flex items-center gap-2 mt-1">
                    {React.createElement(getAssetIcon(selectedComplaint.asset?.category?.name || ''), { className: "h-4 w-4" })}
                    <span className='font-sm'>{selectedComplaint.asset?.name}</span>
                    <span className="text-muted-foreground font-sm">({selectedComplaint.asset?.asset_tag})</span>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm">Priority:</p>
                  <Badge className={getPriorityBadge(selectedComplaint.priority || 'medium')} style={{ marginTop: '4px' }}>
                    {(selectedComplaint.priority || 'medium').toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-sm">Status:</p>
                  <Badge className={getStatusBadge(selectedComplaint.status)} style={{ marginTop: '4px' }}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(selectedComplaint.status)}
                      {selectedComplaint.status.replace('_', ' ').toUpperCase()}
                    </div>
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-sm">Submitted:</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {formatDateForDisplay(selectedComplaint.created_at, 'PPP')}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-medium text-sm mb-2">Problem Description:</p>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm">{selectedComplaint.problem_description}</p>
                </div>
              </div>

              {selectedComplaint.resolution_notes && (
                <div>
                  <p className="font-medium text-sm mb-2">Resolution Notes:</p>
                  <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                    <p className="text-sm">{selectedComplaint.resolution_notes}</p>
                  </div>
                </div>
              )}

              {selectedComplaint.resolved_by_user && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-sm">Resolved By:</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {selectedComplaint.resolved_by_user.full_name}
                    </p>
                  </div>
                  {selectedComplaint.resolved_at && (
                    <div>
                      <p className="font-medium text-sm">Resolution Date:</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        {formatDateForDisplay(selectedComplaint.resolved_at, 'PPP')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Condition Notes Dialog */}
      <Dialog open={isConditionNotesDialogOpen} onOpenChange={setIsConditionNotesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Asset Condition Assessment</DialogTitle>
            <DialogDescription>
              Update your assessment of the asset's condition and add any relevant notes.
            </DialogDescription>
          </DialogHeader>
          <Form {...conditionNotesForm}>
            <form onSubmit={conditionNotesForm.handleSubmit(onConditionNotesSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={conditionNotesForm.control}
                  name="condition_at_issuance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Condition *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="excellent">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              Excellent
                            </div>
                          </SelectItem>
                          <SelectItem value="good">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              Good
                            </div>
                          </SelectItem>
                          <SelectItem value="fair">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                              Fair
                            </div>
                          </SelectItem>
                          <SelectItem value="poor">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                              Poor
                            </div>
                          </SelectItem>
                          <SelectItem value="damaged">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                              Damaged
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={conditionNotesForm.control}
                  name="issuance_condition_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Assessment Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any observations about the asset's condition, functionality, or any issues you've noticed..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsConditionNotesDialogOpen(false);
                    setSelectedAssetForEdit(null);
                    conditionNotesForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAssignmentCondition.isPending}>
                  {updateAssignmentCondition.isPending ? 'Updating...' : 'Update Assessment'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
