import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Calendar,
  Package,
  Target,
  Shield,
  Bell,
  Mail,
  Users,
  FileText,
  DollarSign,
  Save,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmploymentTermLeaveRates,
  useUpdateMultipleLeaveRates,
} from '@/hooks/useEmploymentTermLeaveRates';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/services/supabase';
import { DASHBOARD_CONFIG } from '@/constants';
import type { Role, DashboardPermissions, PagePermissions } from '@/types';

export function SettingsManager() {
  // General Settings
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [enableNotifications, setEnableNotifications] = useState(true);

  // Leave Management Settings
  const [enableLeaveManagement, setEnableLeaveManagement] = useState(true);
  const [enableSandwichLeave, setEnableSandwichLeave] = useState(true);
  const [leaveApprovalRequired, setLeaveApprovalRequired] = useState(true);
  const [maxLeaveDays, setMaxLeaveDays] = useState('30');
  const [leaveCarryForward, setLeaveCarryForward] = useState(true);
  const [leaveCarryForwardLimit, setLeaveCarryForwardLimit] = useState('10');

  // Employment Term Leave Rates
  const { data: leaveRates, isLoading: isLoadingLeaveRates } = useEmploymentTermLeaveRates();
  const updateMultipleLeaveRates = useUpdateMultipleLeaveRates();
  const [leaveRateConfig, setLeaveRateConfig] = useState<Record<string, number>>({});

  // Initialize leave rate config when data is loaded
  useEffect(() => {
    if (leaveRates) {
      const config: Record<string, number> = {};
      leaveRates.forEach((rate) => {
        config[rate.employment_term] = rate.leave_rate;
      });
      setLeaveRateConfig(config);
    }
  }, [leaveRates]);

  const handleLeaveRateChange = (employmentTerm: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLeaveRateConfig((prev) => ({
      ...prev,
      [employmentTerm]: numValue,
    }));
  };

  const handleSaveLeaveRates = async () => {
    const ratesToSave = Object.entries(leaveRateConfig).map(([employment_term, leave_rate]) => ({
      employment_term,
      leave_rate,
    }));

    await updateMultipleLeaveRates.mutateAsync(ratesToSave);
  };

  const getEmploymentTermDisplayName = (term: string) => {
    const names: Record<string, string> = {
      full_time: 'Full Time',
      part_time: 'Part Time',
      associate: 'Associate',
      contract: 'Contract',
      'probation/internship': 'Probation/Internship',
    };
    return names[term] || term;
  };

  // Asset Management Settings
  const [enableAssetManagement, setEnableAssetManagement] = useState(true);
  const [assetApprovalRequired, setAssetApprovalRequired] = useState(true);
  const [enableAssetTracking, setEnableAssetTracking] = useState(true);
  const [assetReturnReminder, setAssetReturnReminder] = useState(true);
  const [assetReturnReminderDays, setAssetReturnReminderDays] = useState('7');

  // Performance/KRA Settings
  const [enableKRASystem, setEnableKRASystem] = useState(true);
  const [kraEvaluationFrequency, setKraEvaluationFrequency] = useState('quarterly');
  const [enableSelfEvaluation, setEnableSelfEvaluation] = useState(true);
  const [enableManagerEvaluation, setEnableManagerEvaluation] = useState(true);
  const [kraWeightageRequired, setKraWeightageRequired] = useState(true);
  const [kraEmailNotifications, setKraEmailNotifications] = useState(true);

  // Policy Settings
  const [enablePolicyManagement, setEnablePolicyManagement] = useState(true);
  const [policyApprovalRequired, setPolicyApprovalRequired] = useState(true);
  const [enablePolicyVersioning, setEnablePolicyVersioning] = useState(true);
  const [policyNotificationRequired, setPolicyNotificationRequired] = useState(true);

  // Notification Settings
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(true);
  const [enableInAppNotifications, setEnableInAppNotifications] = useState(true);
  const [enablePushNotifications, setEnablePushNotifications] = useState(false);
  const [notificationRetentionDays, setNotificationRetentionDays] = useState('90');

  // Email Settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');

  // Employee Management Settings
  const [enableEmployeeManagement, setEnableEmployeeManagement] = useState(true);
  const [enableDocumentManagement, setEnableDocumentManagement] = useState(true);
  const [enableAttendanceTracking, setEnableAttendanceTracking] = useState(false);
  const [enableProjectManagement, setEnableProjectManagement] = useState(true);

  // Grievance Settings
  const [enableGrievanceSystem, setEnableGrievanceSystem] = useState(true);
  const [grievanceAutoAssign, setGrievanceAutoAssign] = useState(true);
  const [grievanceResponseTime, setGrievanceResponseTime] = useState('48');

  // Finance Settings
  const [enableFinanceModule, setEnableFinanceModule] = useState(true);
  const [enablePayroll, setEnablePayroll] = useState(true);
  const [enableBilling, setEnableBilling] = useState(true);
  const [financeApprovalRequired, setFinanceApprovalRequired] = useState(true);

  // Role-based Dashboard/Page Access Settings
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [expandedDashboards, setExpandedDashboards] = useState<Set<string>>(new Set());
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, DashboardPermissions>>({});
  const [pagePermissions, setPagePermissions] = useState<Record<string, Record<string, PagePermissions>>>({});
  const [hasPermissionChanges, setHasPermissionChanges] = useState(false);

  // Fetch all roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, dashboard_permissions, page_permissions, default_dashboards, permissions')
        .order('name');
      
      if (error) throw error;
      return (data || []) as Role[];
    }
  });

  // Load permissions when role is selected
  useEffect(() => {
    if (!selectedRoleId || !roles) return;
    
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (!selectedRole) return;

    // Initialize dashboard permissions
    const dashPerms: Record<string, DashboardPermissions> = {};
    DASHBOARD_CONFIG.forEach(dashboard => {
      const existingPerms = selectedRole.dashboard_permissions?.[dashboard.id];
      dashPerms[dashboard.id] = {
        read: existingPerms?.read ?? false,
        write: existingPerms?.write ?? false,
        view: existingPerms?.view ?? false,
        delete: existingPerms?.delete ?? false,
      };
    });
    setDashboardPermissions(dashPerms);

    // Initialize page permissions
    const pagePerms: Record<string, Record<string, PagePermissions>> = {};
    DASHBOARD_CONFIG.forEach(dashboard => {
      pagePerms[dashboard.id] = {};
      dashboard.pages?.forEach(page => {
        const existingPerms = selectedRole.page_permissions?.[dashboard.id]?.[page.id];
        pagePerms[dashboard.id][page.id] = {
          read: existingPerms?.read ?? false,
          write: existingPerms?.write ?? false,
          view: existingPerms?.view ?? false,
          delete: existingPerms?.delete ?? false,
        };
      });
    });
    setPagePermissions(pagePerms);
    setHasPermissionChanges(false);
  }, [selectedRoleId, roles]);

  // Update role permissions mutation
  const updateRolePermissions = useMutation({
    mutationFn: async ({ roleId, dashPerms, pagePerms }: {
      roleId: string;
      dashPerms: Record<string, DashboardPermissions>;
      pagePerms: Record<string, Record<string, PagePermissions>>;
    }) => {
      const { error } = await supabase
        .from('roles')
        .update({
          dashboard_permissions: dashPerms,
          page_permissions: pagePerms,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-role-permissions'] });
      setHasPermissionChanges(false);
      toast.success('Role permissions updated successfully. Users may need to refresh to see changes.');
    },
    onError: (error: any) => {
      toast.error(`Failed to update permissions: ${error.message}`);
    }
  });

  const handleDashboardAccessChange = (dashboardId: string, hasAccess: boolean) => {
    setDashboardPermissions(prev => ({
      ...prev,
      [dashboardId]: {
        read: hasAccess,
        write: hasAccess,
        view: hasAccess,
        delete: false, // Delete is typically not granted by default
      }
    }));

    // Automatically enable/disable all pages when dashboard access changes
    const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
    if (dashboard && dashboard.pages) {
      setPagePermissions(prev => {
        const updated = { ...prev };
        if (!updated[dashboardId]) {
          updated[dashboardId] = {};
        }
        dashboard.pages.forEach(page => {
          updated[dashboardId][page.id] = {
            read: hasAccess,
            write: hasAccess,
            view: hasAccess,
            delete: false,
          };
        });
        return updated;
      });
    }

    setHasPermissionChanges(true);
  };

  const handlePageAccessChange = (dashboardId: string, pageId: string, hasAccess: boolean) => {
    setPagePermissions(prev => ({
      ...prev,
      [dashboardId]: {
        ...prev[dashboardId],
        [pageId]: {
          read: hasAccess,
          write: hasAccess,
          view: hasAccess,
          delete: false, // Delete is typically not granted by default
        }
      }
    }));
    setHasPermissionChanges(true);
  };

  const toggleDashboardExpanded = (dashboardId: string) => {
    setExpandedDashboards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dashboardId)) {
        newSet.delete(dashboardId);
      } else {
        newSet.add(dashboardId);
      }
      return newSet;
    });
  };

  const handleSaveRolePermissions = () => {
    if (!selectedRoleId) {
      toast.error('Please select a role first');
      return;
    }
    updateRolePermissions.mutate({
      roleId: selectedRoleId,
      dashPerms: dashboardPermissions,
      pagePerms: pagePermissions,
    });
  };

  const handleSave = (section: string) => {
    // TODO: Implement save functionality
    toast.success(`${section} settings saved successfully!`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure settings for different features and modules in the HRMS system.
        </p>
      </div>

      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
          {/* <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger> */}
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </TabsTrigger>
          {/* <TabsTrigger value="assets" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Assets</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Policies</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger> */}
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Employees</span>
          </TabsTrigger>
          {/* <TabsTrigger value="grievance" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Grievance</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Finance</span>
          </TabsTrigger> */}
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure general system settings and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="company@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="UTC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Input
                    id="dateFormat"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    placeholder="DD/MM/YYYY"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableNotifications">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable system-wide notifications
                  </p>
                </div>
                <Switch
                  id="enableNotifications"
                  checked={enableNotifications}
                  onCheckedChange={setEnableNotifications}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('General')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Management Settings */}
        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Management Settings</CardTitle>
              <CardDescription>
                Configure leave management policies and rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Separator/>
              {/* Employment Term Leave Rates Configuration */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Leave Rate by Employment Term</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure the monthly leave rate (days per month) for each employment term type.
                    This rate will be automatically applied to the rate_of_leave column in leave_balances.
                  </p>
                </div>

                {/* Reference Section - Current Leave Rates */}
                {/* {!isLoadingLeaveRates && leaveRates && leaveRates.length > 0 && (
                  <Card className="bg-blue-50/50 border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        Current Leave Rates Reference
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Quick reference of current leave rates configured for each employment term
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {leaveRates
                          .sort((a, b) => {
                            const order = ['full_time', 'part_time', 'associate', 'contract', 'probation/internship'];
                            return order.indexOf(a.employment_term) - order.indexOf(b.employment_term);
                          })
                          .map((rate) => (
                            <div
                              key={rate.employment_term}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100"
                            >
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {getEmploymentTermDisplayName(rate.employment_term)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {rate.description || 'Monthly leave rate'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-blue-600">
                                  {rate.leave_rate.toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground">days/month</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )} */}

                {isLoadingLeaveRates ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {['full_time', 'part_time', 'associate', 'contract', 'probation/internship'].map((term) => (
                      <div key={term} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <Label htmlFor={`leave-rate-${term}`} className="text-sm font-medium">
                            {getEmploymentTermDisplayName(term)}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Monthly leave rate for {getEmploymentTermDisplayName(term).toLowerCase()} employees
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`leave-rate-${term}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={leaveRateConfig[term] ?? ''}
                            onChange={(e) => handleLeaveRateChange(term, e.target.value)}
                            placeholder="0.00"
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">days/month</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveLeaveRates}
                    disabled={updateMultipleLeaveRates.isPending || isLoadingLeaveRates}
                  >
                    {updateMultipleLeaveRates.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Leave Rates
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* <div className="flex justify-end pt-4">
                <Button onClick={() => handleSave('Leave Management')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div> */}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Asset Management Settings */}
        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Management Settings</CardTitle>
              <CardDescription>
                Configure asset management and tracking settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableAssetManagement">Enable Asset Management</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable the asset management module
                    </p>
                  </div>
                  <Switch
                    id="enableAssetManagement"
                    checked={enableAssetManagement}
                    onCheckedChange={setEnableAssetManagement}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="assetApprovalRequired">Require Asset Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Asset requests require approval before assignment
                    </p>
                  </div>
                  <Switch
                    id="assetApprovalRequired"
                    checked={assetApprovalRequired}
                    onCheckedChange={setAssetApprovalRequired}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableAssetTracking">Enable Asset Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track asset location and status changes
                    </p>
                  </div>
                  <Switch
                    id="enableAssetTracking"
                    checked={enableAssetTracking}
                    onCheckedChange={setEnableAssetTracking}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="assetReturnReminder">Enable Return Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Send reminders for asset returns
                    </p>
                  </div>
                  <Switch
                    id="assetReturnReminder"
                    checked={assetReturnReminder}
                    onCheckedChange={setAssetReturnReminder}
                  />
                </div>
                {assetReturnReminder && (
                  <div className="space-y-2">
                    <Label htmlFor="assetReturnReminderDays">Reminder Days Before Return</Label>
                    <Input
                      id="assetReturnReminderDays"
                      type="number"
                      value={assetReturnReminderDays}
                      onChange={(e) => setAssetReturnReminderDays(e.target.value)}
                      placeholder="7"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Asset Management')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance/KRA Settings */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance & KRA Settings</CardTitle>
              <CardDescription>
                Configure performance management and KRA evaluation settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableKRASystem">Enable KRA System</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable Key Result Areas (KRA) management
                    </p>
                  </div>
                  <Switch
                    id="enableKRASystem"
                    checked={enableKRASystem}
                    onCheckedChange={setEnableKRASystem}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="kraEvaluationFrequency">Evaluation Frequency</Label>
                  <Input
                    id="kraEvaluationFrequency"
                    value={kraEvaluationFrequency}
                    onChange={(e) => setKraEvaluationFrequency(e.target.value)}
                    placeholder="quarterly"
                  />
                  <p className="text-sm text-muted-foreground">
                    Options: monthly, quarterly, half-yearly, yearly
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableSelfEvaluation">Enable Self Evaluation</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow employees to self-evaluate their KRAs
                    </p>
                  </div>
                  <Switch
                    id="enableSelfEvaluation"
                    checked={enableSelfEvaluation}
                    onCheckedChange={setEnableSelfEvaluation}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableManagerEvaluation">Enable Manager Evaluation</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow managers to evaluate employee KRAs
                    </p>
                  </div>
                  <Switch
                    id="enableManagerEvaluation"
                    checked={enableManagerEvaluation}
                    onCheckedChange={setEnableManagerEvaluation}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="kraWeightageRequired">Require Weightage</Label>
                    <p className="text-sm text-muted-foreground">
                      Require weightage allocation for KRA goals
                    </p>
                  </div>
                  <Switch
                    id="kraWeightageRequired"
                    checked={kraWeightageRequired}
                    onCheckedChange={setKraWeightageRequired}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="kraEmailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for KRA assignments and evaluations
                    </p>
                  </div>
                  <Switch
                    id="kraEmailNotifications"
                    checked={kraEmailNotifications}
                    onCheckedChange={setKraEmailNotifications}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Performance & KRA')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Settings */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Management Settings</CardTitle>
              <CardDescription>
                Configure policy management and distribution settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enablePolicyManagement">Enable Policy Management</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable the policy management module
                    </p>
                  </div>
                  <Switch
                    id="enablePolicyManagement"
                    checked={enablePolicyManagement}
                    onCheckedChange={setEnablePolicyManagement}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="policyApprovalRequired">Require Policy Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Policies require approval before publishing
                    </p>
                  </div>
                  <Switch
                    id="policyApprovalRequired"
                    checked={policyApprovalRequired}
                    onCheckedChange={setPolicyApprovalRequired}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enablePolicyVersioning">Enable Policy Versioning</Label>
                    <p className="text-sm text-muted-foreground">
                      Track policy versions and changes
                    </p>
                  </div>
                  <Switch
                    id="enablePolicyVersioning"
                    checked={enablePolicyVersioning}
                    onCheckedChange={setEnablePolicyVersioning}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="policyNotificationRequired">Send Policy Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify employees when new policies are published
                    </p>
                  </div>
                  <Switch
                    id="policyNotificationRequired"
                    checked={policyNotificationRequired}
                    onCheckedChange={setPolicyNotificationRequired}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Policy Management')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure notification preferences and channels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableEmailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notifications via email
                    </p>
                  </div>
                  <Switch
                    id="enableEmailNotifications"
                    checked={enableEmailNotifications}
                    onCheckedChange={setEnableEmailNotifications}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableInAppNotifications">In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show notifications within the application
                    </p>
                  </div>
                  <Switch
                    id="enableInAppNotifications"
                    checked={enableInAppNotifications}
                    onCheckedChange={setEnableInAppNotifications}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enablePushNotifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send browser push notifications (requires user permission)
                    </p>
                  </div>
                  <Switch
                    id="enablePushNotifications"
                    checked={enablePushNotifications}
                    onCheckedChange={setEnablePushNotifications}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="notificationRetentionDays">Notification Retention (Days)</Label>
                  <Input
                    id="notificationRetentionDays"
                    type="number"
                    value={notificationRetentionDays}
                    onChange={(e) => setNotificationRetentionDays(e.target.value)}
                    placeholder="90"
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of days to retain notification history
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Notifications')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Configure SMTP settings for sending emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUsername">SMTP Username</Label>
                  <Input
                    id="smtpUsername"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">From Name</Label>
                  <Input
                    id="emailFromName"
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    placeholder="HRMS System"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFromAddress">From Email Address</Label>
                  <Input
                    id="emailFromAddress"
                    type="email"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    placeholder="noreply@example.com"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Email Configuration')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Management Settings */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Management Settings</CardTitle>
              <CardDescription>
                Configure employee management module settings.
              </CardDescription>
            </CardHeader>
            
          </Card>

          {/* Role-Based Dashboard/Page Access */}
          <Card>
            <CardHeader>
              <CardTitle>Role-Based Dashboard & Page Access</CardTitle>
              <CardDescription>
                Configure default access to dashboards and pages for each role. Employees will have access to dashboards and pages based on their assigned role(s).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role-select">Select Role</Label>
                  {rolesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger id="role-select">
                        <SelectValue placeholder="Select a role to configure access" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles?.filter(role => role.name !== 'super_admin').map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name} {role.description && `- ${role.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selectedRoleId && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-semibold">Dashboard & Page Access</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Enable or disable access to dashboards and their pages for this role
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[600px] overflow-y-auto border rounded-lg p-4">
                        {DASHBOARD_CONFIG.map((dashboard) => {
                          const isExpanded = expandedDashboards.has(dashboard.id);
                          const dashboardAccess = dashboardPermissions[dashboard.id]?.view ?? false;
                          const hasPages = dashboard.pages && dashboard.pages.length > 0;

                          return (
                            <div key={dashboard.id} className="space-y-2">
                              <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                                {hasPages && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleDashboardExpanded(dashboard.id)}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                {!hasPages && <div className="w-6" />}
                                <Checkbox
                                  id={`dashboard-${dashboard.id}`}
                                  checked={dashboardAccess}
                                  onCheckedChange={(checked) =>
                                    handleDashboardAccessChange(dashboard.id, checked as boolean)
                                  }
                                />
                                <Label
                                  htmlFor={`dashboard-${dashboard.id}`}
                                  className="flex-1 cursor-pointer font-medium"
                                >
                                  {dashboard.name}
                                </Label>
                              </div>

                              {isExpanded && hasPages && (
                                <div className="ml-8 space-y-2">
                                  {dashboard.pages.map((page) => {
                                    const pageAccess = pagePermissions[dashboard.id]?.[page.id]?.view ?? false;
                                    return (
                                      <div
                                        key={page.id}
                                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/30"
                                      >
                                        <Checkbox
                                          id={`page-${dashboard.id}-${page.id}`}
                                          checked={pageAccess}
                                          onCheckedChange={(checked) =>
                                            handlePageAccessChange(dashboard.id, page.id, checked as boolean)
                                          }
                                        />
                                        <Label
                                          htmlFor={`page-${dashboard.id}-${page.id}`}
                                          className="flex-1 cursor-pointer text-sm"
                                        >
                                          {page.name}
                                        </Label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {hasPermissionChanges && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            You have unsaved changes. Click Save to apply the permissions.
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedRoleId('');
                            setHasPermissionChanges(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveRolePermissions}
                          disabled={updateRolePermissions.isPending || !hasPermissionChanges}
                        >
                          {updateRolePermissions.isPending ? (
                            <>
                              <LoadingSpinner size="sm" className="mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Role Permissions
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {!selectedRoleId && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <div className="text-center">
                      <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a role above to configure dashboard and page access</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grievance Settings */}
        <TabsContent value="grievance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grievance Management Settings</CardTitle>
              <CardDescription>
                Configure grievance handling and resolution settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableGrievanceSystem">Enable Grievance System</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable the grievance management module
                    </p>
                  </div>
                  <Switch
                    id="enableGrievanceSystem"
                    checked={enableGrievanceSystem}
                    onCheckedChange={setEnableGrievanceSystem}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="grievanceAutoAssign">Auto-Assign Grievances</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically assign grievances to appropriate handlers
                    </p>
                  </div>
                  <Switch
                    id="grievanceAutoAssign"
                    checked={grievanceAutoAssign}
                    onCheckedChange={setGrievanceAutoAssign}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="grievanceResponseTime">Response Time (Hours)</Label>
                  <Input
                    id="grievanceResponseTime"
                    type="number"
                    value={grievanceResponseTime}
                    onChange={(e) => setGrievanceResponseTime(e.target.value)}
                    placeholder="48"
                  />
                  <p className="text-sm text-muted-foreground">
                    Expected response time for grievance resolution
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Grievance Management')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Settings */}
        <TabsContent value="finance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Finance Module Settings</CardTitle>
              <CardDescription>
                Configure finance and billing module settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableFinanceModule">Enable Finance Module</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable the finance management module
                    </p>
                  </div>
                  <Switch
                    id="enableFinanceModule"
                    checked={enableFinanceModule}
                    onCheckedChange={setEnableFinanceModule}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enablePayroll">Enable Payroll</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable payroll management features
                    </p>
                  </div>
                  <Switch
                    id="enablePayroll"
                    checked={enablePayroll}
                    onCheckedChange={setEnablePayroll}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableBilling">Enable Billing</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable billing and invoicing features
                    </p>
                  </div>
                  <Switch
                    id="enableBilling"
                    checked={enableBilling}
                    onCheckedChange={setEnableBilling}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="financeApprovalRequired">Require Finance Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Financial transactions require approval
                    </p>
                  </div>
                  <Switch
                    id="financeApprovalRequired"
                    checked={financeApprovalRequired}
                    onCheckedChange={setFinanceApprovalRequired}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Finance Module')}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

