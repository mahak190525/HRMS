import { useState } from 'react';
import { useAllReferrals, useUpdateReferralStatus } from '@/hooks/useEmployees';
import { useCreateJobPosition, useDepartmentsBasic, useAllJobPositions, useUpdateJobPosition, useDeleteJobPosition } from '@/hooks/useATS';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserPlus,
  Filter,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  User,
  Plus,
  Minus
} from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDelete } from '@/components/ui/confirm-delete';

export function ReferralDashboard() {
  const { user } = useAuth();
  const { data: referrals, isLoading: referralsLoading } = useAllReferrals();
  const updateReferralStatus = useUpdateReferralStatus();
  const { data: departments } = useDepartmentsBasic();
  const createJobPosition = useCreateJobPosition();
  const updateJobPosition = useUpdateJobPosition();
  const deleteJobPosition = useDeleteJobPosition();
  const { data: allPositions } = useAllJobPositions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [hrNotes, setHrNotes] = useState('');
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  
  // Bonus fields for update dialog
  const [bonusEligible, setBonusEligible] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusPaid, setBonusPaid] = useState(false);

  // Create Job Position form state
  const [isCreatePositionOpen, setIsCreatePositionOpen] = useState(false);
  // Job Basics
  const [jobTitle, setJobTitle] = useState('');
  const [positionDepartmentId, setPositionDepartmentId] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [workType, setWorkType] = useState('full_time');
  // Role Overview - Bullet Points for Key Responsibilities
  const [keyResponsibilitiesBullets, setKeyResponsibilitiesBullets] = useState<string[]>(['']);
  // Candidate Requirements
  const [experienceLevelDescription, setExperienceLevelDescription] = useState('');
  const [technicalSkillsRequired, setTechnicalSkillsRequired] = useState('');
  const [softSkills, setSoftSkills] = useState('');
  // Application Process
  const [howToApply, setHowToApply] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [referralEncouraged, setReferralEncouraged] = useState(true);
  // Additional Details for Create Dialog
  const [createExperienceLevel, setCreateExperienceLevel] = useState('mid');
  const [createEmploymentType, setCreateEmploymentType] = useState('full_time');
  const [createSalaryMin, setCreateSalaryMin] = useState('');
  const [createSalaryMax, setCreateSalaryMax] = useState('');
  const [createStatus, setCreateStatus] = useState('open');
  // Legacy fields (keeping for backward compatibility) - removed unused variables

  // Positions tab filters and editing
  const [positionsSearch, setPositionsSearch] = useState('');
  const [positionsStatus, setPositionsStatus] = useState<'all' | 'open' | 'closed' | 'on_hold'>('open');
  const [positionsDepartment, setPositionsDepartment] = useState<string>('all');
  const [isEditPositionOpen, setIsEditPositionOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editExperienceLevel, setEditExperienceLevel] = useState('mid');
  const [editEmploymentType, setEditEmploymentType] = useState('full_time');
  const [editSalaryMin, setEditSalaryMin] = useState('');
  const [editSalaryMax, setEditSalaryMax] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIsRemote, setEditIsRemote] = useState(false);
  const [editStatus, setEditStatus] = useState<'open' | 'closed' | 'on_hold'>('open');
  // Additional edit form fields to match the comprehensive view
  const [editKeyResponsibilities, setEditKeyResponsibilities] = useState('');
  const [editExperienceLevelDescription, setEditExperienceLevelDescription] = useState('');
  const [editTechnicalSkills, setEditTechnicalSkills] = useState('');
  const [editSoftSkills, setEditSoftSkills] = useState('');
  const [editHowToApply, setEditHowToApply] = useState('');
  const [editApplicationDeadline, setEditApplicationDeadline] = useState('');
  const [editReferralEncouraged, setEditReferralEncouraged] = useState(true);
  const [editWorkType, setEditWorkType] = useState('full_time');
  // Removed unused editDescription and editRequirements

  // Bullet point helper functions
  const addBulletPoint = () => {
    setKeyResponsibilitiesBullets([...keyResponsibilitiesBullets, '']);
  };

  const removeBulletPoint = (index: number) => {
    if (keyResponsibilitiesBullets.length > 1) {
      const newBullets = keyResponsibilitiesBullets.filter((_, i) => i !== index);
      setKeyResponsibilitiesBullets(newBullets);
    }
  };

  const updateBulletPoint = (index: number, value: string) => {
    const newBullets = [...keyResponsibilitiesBullets];
    newBullets[index] = value;
    setKeyResponsibilitiesBullets(newBullets);
  };

  const bulletsToString = (bullets: string[]) => {
    return bullets
      .filter(bullet => bullet.trim())
      .map(bullet => `• ${bullet.trim()}`)
      .join('\n');
  };

  // Removed unused stringToBullets function

  const handleCreatePosition = () => {
    if (!user?.id || !jobTitle.trim() || !positionDepartmentId) return;
    
    // Convert bullet points to formatted string
    const responsibilitiesString = bulletsToString(keyResponsibilitiesBullets);
    
    createJobPosition.mutate({
      job_title: jobTitle.trim(),
      department_id: positionDepartmentId,
      location: location.trim() || null,
      is_remote: isRemote,
      work_type: workType,
      key_responsibilities: responsibilitiesString || null,
      experience_level_description: experienceLevelDescription.trim() || null,
      technical_skills_required: technicalSkillsRequired.trim() || null,
      soft_skills: softSkills.trim() || null,
      how_to_apply: howToApply.trim() || null,
      application_deadline: applicationDeadline || null,
      referral_encouraged: referralEncouraged,
      experience_level: createExperienceLevel,
      employment_type: createEmploymentType,
      salary_range_min: createSalaryMin ? Number(createSalaryMin) : null,
      salary_range_max: createSalaryMax ? Number(createSalaryMax) : null,
      status: createStatus,
      posted_by: user.id,
    }, {
      onSuccess: () => {
        setIsCreatePositionOpen(false);
        // Reset new fields
        setJobTitle('');
        setPositionDepartmentId('');
        setLocation('');
        setIsRemote(false);
        setWorkType('full_time');
        setKeyResponsibilitiesBullets(['']);
        setExperienceLevelDescription('');
        setTechnicalSkillsRequired('');
        setSoftSkills('');
        setHowToApply('');
        setApplicationDeadline('');
        setReferralEncouraged(true);
        // Reset additional fields
        setCreateExperienceLevel('mid');
        setCreateEmploymentType('full_time');
        setCreateSalaryMin('');
        setCreateSalaryMax('');
        setCreateStatus('open');
        // Reset legacy fields - removed unused variables
      }
    });
  };

  const filteredReferrals = referrals?.filter(referral => {
    const matchesSearch = referral.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         referral.candidate_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         referral.referred_by_user?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || referral.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'interviewed':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'contacted':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      hired: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      interviewed: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-purple-100 text-purple-800',
      submitted: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleStatusUpdate = () => {
    if (!selectedReferral || !newStatus) return;

    updateReferralStatus.mutate({
      id: selectedReferral.id,
      status: newStatus,
      hrNotes: hrNotes.trim() || undefined,
      bonusEligible,
      bonusAmount: bonusEligible && bonusAmount ? parseFloat(bonusAmount) : null,
      bonusPaid: bonusEligible ? bonusPaid : false
    }, {
      onSuccess: () => {
        setIsUpdateDialogOpen(false);
        setNewStatus('');
        setHrNotes('');
        setBonusEligible(false);
        setBonusAmount('');
        setBonusPaid(false);
        setSelectedReferral(null);
      }
    });
  };

  const totalReferrals = referrals?.length || 0;
  const successfulReferrals = referrals?.filter(r => r.status === 'hired').length || 0;
  const pendingReferrals = referrals?.filter(r => ['submitted', 'under_review', 'contacted'].includes(r.status)).length || 0;
  const totalBonusPaid = referrals?.filter(r => r.bonus_paid).reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0;

  if (referralsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referral Dashboard</h1>
        <p className="text-muted-foreground">
          Manage employee referrals and track hiring progress
        </p>
      </div>

      <Tabs defaultValue="referrals" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="referrals">All Referrals</TabsTrigger>
          <TabsTrigger value="positions">Open Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalReferrals}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Successful Hires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successfulReferrals}</div>
                <p className="text-xs text-muted-foreground">
                  {totalReferrals > 0 ? Math.round((successfulReferrals / totalReferrals) * 100) : 0}% success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingReferrals}</div>
                <p className="text-xs text-muted-foreground">Awaiting action</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Bonus Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalBonusPaid.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total distributed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Input
                    placeholder="Search referrals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="interviewed">Interviewed</SelectItem>
                      <SelectItem value="hired">Hired</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Referrals</CardTitle>
              <CardDescription>
                Employee referrals and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead>Candidate</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Referred By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resume</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals?.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.candidate_name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {referral.candidate_email}
                          </div>
                          {referral.candidate_phone && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {referral.candidate_phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{referral.position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {referral.referred_by_user?.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{referral.referred_by_user?.full_name}</div>
                            <div className="text-sm text-muted-foreground">{referral.referred_by_user?.employee_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(referral.status)}
                          <Badge className={getStatusBadge(referral.status)}>
                            {referral.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {referral.resume_url ? (
                          <a 
                            href={referral.resume_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                          >
                            View
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            ₹{(referral.bonus_amount || 0).toLocaleString()}
                          </div>
                          {referral.bonus_amount > 0 && (
                            <div className={`text-xs ${referral.bonus_paid ? 'text-green-600' : 'text-yellow-600'}`}>
                              {referral.bonus_paid ? 'Paid' : 'Pending'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateForDisplay(referral.created_at, 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                asChild={false}
                                onClick={() => setSelectedReferral(referral)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Referral Details</DialogTitle>
                                <DialogDescription>
                                  Complete information about this referral
                                </DialogDescription>
                              </DialogHeader>
                              {selectedReferral && (
                                <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                                  {/* Candidate Information */}
                                  <div>
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <User className="h-4 w-4" />
                                      Candidate Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Full Name:</p>
                                        <p className="text-muted-foreground">{selectedReferral.candidate_name}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Email Address:</p>
                                        <p className="text-muted-foreground">{selectedReferral.candidate_email}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Phone Number:</p>
                                        <p className="text-muted-foreground">{selectedReferral.candidate_phone || 'Not provided'}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">LinkedIn Profile:</p>
                                        {selectedReferral.linkedin_profile ? (
                                          <p className="text-muted-foreground">
                                            {selectedReferral.linkedin_profile}
                                          </p>
                                        ) : (
                                          <p className="text-muted-foreground">Not provided</p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium">Location Preference:</p>
                                        <p className="text-muted-foreground">{selectedReferral.location_preference || 'Not specified'}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Position & Referral Details */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <UserPlus className="h-4 w-4" />
                                      Position & Referral Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Position Applied:</p>
                                        <p className="text-muted-foreground">{selectedReferral.position}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Referred By:</p>
                                        <p className="text-muted-foreground">{selectedReferral.referred_by_user?.full_name}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Employee ID:</p>
                                        <p className="text-muted-foreground">{selectedReferral.referred_by_user?.employee_id || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Department:</p>
                                        <p className="text-muted-foreground">{selectedReferral.referred_by_user?.department?.name || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Relationship:</p>
                                        <p className="text-muted-foreground capitalize">{selectedReferral.relationship?.replace('_', ' ') || 'Not specified'}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Current Status:</p>
                                        <div className="flex items-center gap-2">
                                          {getStatusIcon(selectedReferral.status)}
                                          <Badge className={getStatusBadge(selectedReferral.status)}>
                                            {selectedReferral.status.replace('_', ' ')}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    {selectedReferral.resume_url && (
                                      <div className="mt-4">
                                        <p className="font-medium mb-1">Resume:</p>
                                        <a 
                                          href={selectedReferral.resume_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                                        >
                                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          View Resume Document
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {/* Professional Background */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8z" />
                                      </svg>
                                      Professional Background
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Current Company:</p>
                                        <p className="text-muted-foreground">{selectedReferral.current_company || 'Not provided'}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Current Job Title:</p>
                                        <p className="text-muted-foreground">{selectedReferral.current_job_title || 'Not provided'}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Total Experience:</p>
                                        <p className="text-muted-foreground">
                                          {selectedReferral.total_experience_years || 0} years, {selectedReferral.total_experience_months || 0} months
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Notice Period:</p>
                                        <p className="text-muted-foreground">{selectedReferral.notice_period_availability || 'Not specified'}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Compensation Details */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <DollarSign className="h-4 w-4" />
                                      Compensation Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Current CTC:</p>
                                        <p className="text-muted-foreground">
                                          {selectedReferral.current_ctc ? `₹${selectedReferral.current_ctc.toLocaleString()}` : 'Not disclosed'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Expected CTC:</p>
                                        <p className="text-muted-foreground">
                                          {selectedReferral.expected_ctc ? `₹${selectedReferral.expected_ctc.toLocaleString()}` : 'Not specified'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Skills & Expertise */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                      </svg>
                                      Skills & Expertise
                                    </h4>
                                    <div className="space-y-3 text-sm">
                                      <div>
                                        <p className="font-medium mb-1">Key Technical/Functional Skills:</p>
                                        <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                          {selectedReferral.key_skills || 'Not provided'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium mb-1">Domain Expertise:</p>
                                        <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                          {selectedReferral.domain_expertise || 'Not provided'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium mb-1">Reason for Job Change:</p>
                                        <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                          {selectedReferral.reason_for_change || 'Not provided'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Referral Bonus Information */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                      </svg>
                                      Referral Bonus
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Bonus Eligible:</p>
                                        <p className="text-muted-foreground">
                                          {selectedReferral.bonus_eligible ? (
                                            <span className="text-green-600 font-medium flex items-center gap-1">
                                              <CheckCircle className="h-3 w-3" />
                                              Yes
                                            </span>
                                          ) : (
                                            <span className="text-red-600 font-medium flex items-center gap-1">
                                              <XCircle className="h-3 w-3" />
                                              No
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Bonus Amount:</p>
                                        <p className="text-muted-foreground font-semibold">
                                          ₹{(selectedReferral.bonus_amount || 0).toLocaleString()}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Payment Status:</p>
                                        <p className="text-muted-foreground">
                                          {selectedReferral.bonus_amount > 0 ? (
                                            selectedReferral.bonus_paid ? (
                                              <span className="text-green-600 font-medium flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" />
                                                Paid
                                              </span>
                                            ) : (
                                              <span className="text-yellow-600 font-medium flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Pending
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-gray-500">Not applicable</span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Additional Information */}
                                  {selectedReferral.additional_info && (
                                    <div className="border-t pt-4">
                                      <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Additional Information
                                      </h4>
                                      <p className="text-muted-foreground text-sm whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                        {selectedReferral.additional_info}
                                      </p>
                                    </div>
                                  )}

                                  {/* Timeline Information */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                      <Calendar className="h-4 w-4" />
                                      Timeline
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Submitted On:</p>
                                        <p className="text-muted-foreground">
                                          {formatDateForDisplay(selectedReferral.created_at, 'MMM dd, yyyy HH:mm')}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Last Updated:</p>
                                        <p className="text-muted-foreground">
                                          {formatDateForDisplay(selectedReferral.updated_at, 'MMM dd, yyyy HH:mm')}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Referral ID:</p>
                                        <p className="text-muted-foreground font-mono text-xs">{selectedReferral.id}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* HR Management */}
                                  {selectedReferral.hr_notes && (
                                    <div className="border-t pt-4">
                                      <h4 className="font-semibold mb-3 text-base flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        HR Notes
                                      </h4>
                                      <p className="text-muted-foreground text-sm whitespace-pre-line bg-blue-50 p-3 rounded-md border-l-4 border-blue-200">
                                        {selectedReferral.hr_notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          
                          <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm"
                                asChild={false}
                                onClick={() => {
                                  setSelectedReferral(referral);
                                  setNewStatus(referral.status);
                                  setHrNotes(referral.hr_notes || '');
                                  setBonusEligible(referral.bonus_eligible || false);
                                  setBonusAmount(referral.bonus_amount ? String(referral.bonus_amount) : '');
                                  setBonusPaid(referral.bonus_paid || false);
                                }}
                              >
                                Update
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Referral Status</DialogTitle>
                                <DialogDescription>
                                  Update the status and add HR notes for {selectedReferral?.candidate_name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Status</Label>
                                  <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="submitted">Submitted</SelectItem>
                                      <SelectItem value="under_review">Under Review</SelectItem>
                                      <SelectItem value="contacted">Contacted</SelectItem>
                                      <SelectItem value="interviewed">Interviewed</SelectItem>
                                      <SelectItem value="hired">Hired</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label>HR Notes</Label>
                                  <Textarea
                                    value={hrNotes}
                                    onChange={(e) => setHrNotes(e.target.value)}
                                    placeholder="Add notes about the referral process..."
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>

                                {/* Bonus Management Section */}
                                <div className="space-y-4 border-t pt-4">
                                  <h4 className="font-medium text-sm">Bonus Management</h4>
                                  
                                  <div className="flex items-center space-x-2">
                                    <Switch 
                                      checked={bonusEligible} 
                                      onCheckedChange={setBonusEligible}
                                      className="data-[state=unchecked]:bg-gray-300"
                                    />
                                    <Label className="text-sm">Bonus Eligible</Label>
                                  </div>

                                  {bonusEligible && (
                                    <div className="space-y-3">
                                      <div>
                                        <Label htmlFor="bonusAmount" className="text-sm">Bonus Amount (₹)</Label>
                                        <Input
                                          id="bonusAmount"
                                          type="number"
                                          value={bonusAmount}
                                          onChange={(e) => setBonusAmount(e.target.value)}
                                          placeholder="Enter bonus amount"
                                          className="mt-1"
                                          min="0"
                                          step="100"
                                        />
                                      </div>

                                      <div className="flex items-center space-x-2">
                                        <Switch 
                                          checked={bonusPaid} 
                                          onCheckedChange={setBonusPaid} 
                                          className="data-[state=unchecked]:bg-gray-300"
                                        />
                                        <Label className="text-sm">Bonus Paid</Label>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleStatusUpdate} disabled={updateReferralStatus.isPending}>
                                    {updateReferralStatus.isPending ? 'Updating...' : 'Update Status'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
                <CardDescription>Manage and publish roles employees can refer to</CardDescription>
              </div>
              <Dialog open={isCreatePositionOpen} onOpenChange={setIsCreatePositionOpen}>
                <DialogTrigger asChild>
                  <Button>Create Job Position</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Job Position</DialogTitle>
                    <DialogDescription>Define comprehensive details for the new position</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Job Basics */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Job Basics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Job Title *</Label>
                          <Input 
                            value={jobTitle} 
                            onChange={(e) => setJobTitle(e.target.value)} 
                            placeholder="e.g., Senior React Developer" 
                            className="mt-1" 
                          />
                        </div>
                        <div>
                          <Label>Department *</Label>
                          <Select value={positionDepartmentId} onValueChange={setPositionDepartmentId}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments?.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Location</Label>
                          <Input 
                            value={location} 
                            onChange={(e) => setLocation(e.target.value)} 
                            placeholder="City, State/Country" 
                            className="mt-1" 
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                          <Switch checked={isRemote} onCheckedChange={setIsRemote} className="data-[state=unchecked]:bg-gray-300"/>
                          <Label className="!mt-0">Remote Position</Label>
                        </div>
                        <div className="md:col-span-2">
                          <Label>Work Type</Label>
                          <Select value={workType} onValueChange={setWorkType}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_time">Full-time</SelectItem>
                              <SelectItem value="part_time">Part-time</SelectItem>
                              <SelectItem value="contract">Contract</SelectItem>
                              <SelectItem value="probation/internship">Probation/Internship</SelectItem>
                              <SelectItem value="temporary">Temporary</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Role Overview */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Role Overview</h3>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Key Responsibilities</Label>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={addBulletPoint}
                            className="flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add Point
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {keyResponsibilitiesBullets.map((bullet, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm font-medium">•</span>
                              <Input
                                value={bullet}
                                onChange={(e) => updateBulletPoint(index, e.target.value)}
                                placeholder={`Responsibility ${index + 1}...`}
                                className="flex-1"
                              />
                              {keyResponsibilitiesBullets.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeBulletPoint(index)}
                                  className="px-2"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Add specific responsibilities and duties for this role. Each point will be displayed as a bullet point.
                        </p>
                      </div>
                    </div>

                    {/* Candidate Requirements */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Candidate Requirements</h3>
                      <div>
                        <Label>Experience Level Description</Label>
                        <Textarea 
                          value={experienceLevelDescription} 
                          onChange={(e) => setExperienceLevelDescription(e.target.value)} 
                          rows={3} 
                          className="mt-1" 
                          placeholder="5+ years of experience in frontend development with React..." 
                        />
                      </div>
                      <div>
                        <Label>Technical Skills Required</Label>
                        <Textarea 
                          value={technicalSkillsRequired} 
                          onChange={(e) => setTechnicalSkillsRequired(e.target.value)} 
                          rows={3} 
                          className="mt-1" 
                          placeholder="JavaScript, TypeScript, React, Node.js, Git..." 
                        />
                      </div>
                      <div>
                        <Label>Soft Skills</Label>
                        <Textarea 
                          value={softSkills} 
                          onChange={(e) => setSoftSkills(e.target.value)} 
                          rows={3} 
                          className="mt-1" 
                          placeholder="Strong communication, teamwork, problem-solving..." 
                        />
                      </div>
                    </div>

                    {/* Application Process */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Application Process</h3>
                      <div>
                        <Label>How to Apply</Label>
                        <Textarea 
                          value={howToApply} 
                          onChange={(e) => setHowToApply(e.target.value)} 
                          rows={3} 
                          className="mt-1" 
                          placeholder="Send resume to hr@company.com or apply through referral system..." 
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Application Deadline</Label>
                          <Input 
                            type="date" 
                            value={applicationDeadline} 
                            onChange={(e) => setApplicationDeadline(e.target.value)} 
                            className="mt-1" 
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                          <Switch checked={referralEncouraged} onCheckedChange={setReferralEncouraged} className="data-[state=unchecked]:bg-gray-300"/>
                          <Label className="!mt-0">Referrals Encouraged</Label>
                        </div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Additional Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Experience Level</Label>
                          <Select value={createExperienceLevel} onValueChange={setCreateExperienceLevel}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entry">Entry</SelectItem>
                              <SelectItem value="mid">Mid</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Employment Type</Label>
                          <Select value={createEmploymentType} onValueChange={setCreateEmploymentType}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_time">Full-time</SelectItem>
                              <SelectItem value="part_time">Part-time</SelectItem>
                              <SelectItem value="contract">Contract</SelectItem>
                              <SelectItem value="probation/internship">Probation/Internship</SelectItem>
                              <SelectItem value="temporary">Temporary</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Salary Range Min</Label>
                          <Input 
                            type="number" 
                            value={createSalaryMin} 
                            onChange={(e) => setCreateSalaryMin(e.target.value)} 
                            placeholder="e.g., 50000" 
                            className="mt-1" 
                          />
                        </div>
                        <div>
                          <Label>Salary Range Max</Label>
                          <Input 
                            type="number" 
                            value={createSalaryMax} 
                            onChange={(e) => setCreateSalaryMax(e.target.value)} 
                            placeholder="e.g., 80000" 
                            className="mt-1" 
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={createStatus} onValueChange={(v) => setCreateStatus(v as 'open' | 'closed' | 'on_hold')}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setIsCreatePositionOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreatePosition} disabled={!jobTitle.trim() || !positionDepartmentId || createJobPosition.isPending}>
                        {createJobPosition.isPending ? 'Creating...' : 'Create Position'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input placeholder="Search positions..." value={positionsSearch} onChange={(e) => setPositionsSearch(e.target.value)} />
                <Select value={positionsStatus} onValueChange={(v) => setPositionsStatus(v as 'all' | 'open' | 'closed' | 'on_hold')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={positionsDepartment} onValueChange={setPositionsDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments?.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { setPositionsSearch(''); setPositionsStatus('all'); setPositionsDepartment('all'); }}>Clear</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Positions</CardTitle>
              <CardDescription>Open and closed positions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Referrals</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPositions?.filter((p: any) => {
                    const matchSearch = (p.job_title || '').toLowerCase().includes(positionsSearch.toLowerCase());
                    const matchStatus = positionsStatus === 'all' ? true : p.status === positionsStatus;
                    const matchDept = positionsDepartment === 'all' ? true : (p.department_id === positionsDepartment || p.department?.id === positionsDepartment);
                    return matchSearch && matchStatus && matchDept;
                  }).map((pos: any) => (
                    <TableRow key={pos.id}>
                      <TableCell>
                        <div className="font-medium">{pos.job_title}</div>
                      </TableCell>
                      <TableCell>{pos.department?.name}</TableCell>
                      <TableCell className="capitalize">{pos.experience_level?.replace('_', ' ')}</TableCell>
                      <TableCell className="capitalize">{pos.employment_type?.replace('_', ' ')}</TableCell>
                      <TableCell>{pos.is_remote ? 'Remote' : (pos.location || '—')}</TableCell>
                      <TableCell>
                        <Badge className={pos.status === 'open' ? 'bg-green-100 text-green-800' : pos.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>
                          {pos.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={pos.referral_encouraged ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}>
                          {pos.referral_encouraged ? 'Encouraged' : 'Not Encouraged'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateForDisplay(pos.created_at, 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4"/>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Position Details</DialogTitle>
                                <DialogDescription>Complete information about this job position</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6 text-sm">
                                {/* Job Basics */}
                                <div>
                                  <h4 className="font-semibold mb-3 text-base border-b pb-2">Job Basics</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="font-medium">Job Title:</p>
                                      <p className="text-muted-foreground">{pos.job_title}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Department:</p>
                                      <p className="text-muted-foreground">{pos.department?.name}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Location:</p>
                                      <p className="text-muted-foreground">{pos.location || 'Not specified'}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Work Type:</p>
                                      <p className="text-muted-foreground capitalize">{(pos.work_type || pos.employment_type)?.replace('_', ' ')}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Remote Position:</p>
                                      <p className="text-muted-foreground">{pos.is_remote ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Status:</p>
                                      <Badge className={pos.status === 'open' ? 'bg-green-100 text-green-800' : pos.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>
                                        {pos.status?.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <div>
                                      <p className="font-medium">Experience Level:</p>
                                      <p className="text-muted-foreground capitalize">{pos.experience_level?.replace('_', ' ') || 'Not specified'}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Employment Type:</p>
                                      <p className="text-muted-foreground capitalize">{pos.employment_type?.replace('_', ' ') || 'Not specified'}</p>
                                    </div>
                                    {(pos.salary_range_min || pos.salary_range_max) && (
                                      <div className="md:col-span-2">
                                        <p className="font-medium">Salary Range:</p>
                                        <p className="text-muted-foreground">
                                          {pos.salary_range_min && pos.salary_range_max 
                                            ? `₹${pos.salary_range_min.toLocaleString()} - ₹${pos.salary_range_max.toLocaleString()}`
                                            : pos.salary_range_min 
                                              ? `₹${pos.salary_range_min.toLocaleString()}+`
                                              : `Up to ₹${pos.salary_range_max.toLocaleString()}`
                                          }
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Role Overview */}
                                {pos.key_responsibilities && (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base border-b pb-2">Role Overview</h4>
                                    <div>
                                      <p className="font-medium mb-2">Key Responsibilities:</p>
                                      <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                        {pos.key_responsibilities}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Candidate Requirements */}
                                {(pos.experience_level_description || pos.technical_skills_required || pos.soft_skills) && (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base border-b pb-2">Candidate Requirements</h4>
                                    <div className="space-y-4">
                                      {pos.experience_level_description && (
                                        <div>
                                          <p className="font-medium mb-2">Experience Level Description:</p>
                                          <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                            {pos.experience_level_description}
                                          </p>
                                        </div>
                                      )}
                                      {pos.technical_skills_required && (
                                        <div>
                                          <p className="font-medium mb-2">Technical Skills Required:</p>
                                          <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                            {pos.technical_skills_required}
                                          </p>
                                        </div>
                                      )}
                                      {pos.soft_skills && (
                                        <div>
                                          <p className="font-medium mb-2">Soft Skills:</p>
                                          <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                            {pos.soft_skills}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Application Process */}
                                {(pos.how_to_apply || pos.application_deadline || pos.referral_encouraged !== undefined) && (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base border-b pb-2">Application Process</h4>
                                    <div className="space-y-4">
                                      {pos.how_to_apply && (
                                        <div>
                                          <p className="font-medium mb-2">How to Apply:</p>
                                          <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                            {pos.how_to_apply}
                                          </p>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-2 gap-4">
                                        {pos.application_deadline && (
                                          <div>
                                            <p className="font-medium">Application Deadline:</p>
                                            <p className="text-muted-foreground">
                                              {formatDateForDisplay(pos.application_deadline, 'MMM dd, yyyy')}
                                            </p>
                                          </div>
                                        )}
                                        {pos.referral_encouraged !== undefined && (
                                          <div>
                                            <p className="font-medium">Referrals Encouraged:</p>
                                            <p className="text-muted-foreground">
                                              {pos.referral_encouraged ? (
                                                <span className="text-green-600 font-medium flex items-center gap-1">
                                                  <CheckCircle className="h-3 w-3" />
                                                  Yes
                                                </span>
                                              ) : (
                                                <span className="text-red-600 font-medium flex items-center gap-1">
                                                  <XCircle className="h-3 w-3" />
                                                  No
                                                </span>
                                              )}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Legacy Information (if new fields not available) */}
                                {(!pos.key_responsibilities && pos.description) && (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base border-b pb-2">Legacy Description</h4>
                                    <div>
                                      <p className="font-medium mb-2">Description:</p>
                                      <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                        {pos.description}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {(!pos.experience_level_description && !pos.technical_skills_required && pos.requirements) && (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3 text-base border-b pb-2">Legacy Requirements</h4>
                                    <div>
                                      <p className="font-medium mb-2">Requirements:</p>
                                      <p className="text-muted-foreground whitespace-pre-line bg-gray-50 p-3 rounded-md">
                                        {pos.requirements}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Administrative Information */}
                                <div className="border-t pt-4">
                                  <h4 className="font-semibold mb-3 text-base border-b pb-2">Administrative Information</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="font-medium">Posted By:</p>
                                      <p className="text-muted-foreground">{pos.posted_by_user?.full_name || '—'}{pos.posted_by_user?.employee_id ? ` (${pos.posted_by_user.employee_id})` : ''}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Position ID:</p>
                                      <p className="text-muted-foreground font-mono text-xs">{pos.id}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Created At:</p>
                                      <p className="text-muted-foreground">{pos.created_at ? formatDateForDisplay(pos.created_at, 'MMM dd, yyyy HH:mm') : '—'}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Updated At:</p>
                                      <p className="text-muted-foreground">{pos.updated_at ? formatDateForDisplay(pos.updated_at, 'MMM dd, yyyy HH:mm') : '—'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Dialog open={isEditPositionOpen && editingPosition?.id === pos.id} onOpenChange={(open) => { setIsEditPositionOpen(open); if (!open) setEditingPosition(null); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" onClick={() => {
                                setEditingPosition(pos);
                                setEditTitle(pos.job_title || '');
                                setEditDepartmentId(pos.department_id || '');
                                setEditKeyResponsibilities(pos.key_responsibilities || '');
                                setEditExperienceLevelDescription(pos.experience_level_description || '');
                                setEditTechnicalSkills(pos.technical_skills_required || '');
                                setEditSoftSkills(pos.soft_skills || '');
                                setEditHowToApply(pos.how_to_apply || '');
                                setEditApplicationDeadline(pos.application_deadline ? pos.application_deadline.split('T')[0] : '');
                                setEditReferralEncouraged(pos.referral_encouraged !== undefined ? pos.referral_encouraged : true);
                                setEditWorkType(pos.work_type || pos.employment_type || 'full_time');
                                setEditExperienceLevel(pos.experience_level || 'mid');
                                setEditEmploymentType(pos.employment_type || 'full_time');
                                setEditSalaryMin(pos.salary_range_min ? String(pos.salary_range_min) : '');
                                setEditSalaryMax(pos.salary_range_max ? String(pos.salary_range_max) : '');
                                setEditLocation(pos.location || '');
                                setEditIsRemote(!!pos.is_remote);
                                setEditStatus(pos.status || 'open');
                                // Legacy fields for backward compatibility - removed unused variables
                              }}>
                                <Edit className="h-4 w-4"/>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Job Position</DialogTitle>
                                <DialogDescription>Edit comprehensive details for this position</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6">
                                {/* Job Basics */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-lg border-b pb-2">Job Basics</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label>Job Title *</Label>
                                      <Input 
                                        value={editTitle} 
                                        onChange={(e) => setEditTitle(e.target.value)} 
                                        placeholder="e.g., Senior React Developer" 
                                        className="mt-1" 
                                      />
                                    </div>
                                    <div>
                                      <Label>Department *</Label>
                                      <Select value={editDepartmentId} onValueChange={setEditDepartmentId}>
                                        <SelectTrigger className="mt-1">
                                          <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {departments?.map((d: any) => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Location</Label>
                                      <Input 
                                        value={editLocation} 
                                        onChange={(e) => setEditLocation(e.target.value)} 
                                        placeholder="City, State/Country" 
                                        className="mt-1" 
                                      />
                                    </div>
                                    <div className="flex items-center gap-3 pt-6">
                                      <Switch checked={editIsRemote} onCheckedChange={setEditIsRemote} className="data-[state=unchecked]:bg-gray-300"/>
                                      <Label className="!mt-0">Remote Position</Label>
                                    </div>
                                    <div className="md:col-span-2">
                                      <Label>Work Type</Label>
                                      <Select value={editWorkType} onValueChange={setEditWorkType}>
                                        <SelectTrigger className="mt-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="full_time">Full-time</SelectItem>
                                          <SelectItem value="part_time">Part-time</SelectItem>
                                          <SelectItem value="contract">Contract</SelectItem>
                                          <SelectItem value="probation/internship">Probation/Internship</SelectItem>
                                          <SelectItem value="temporary">Temporary</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>

                                {/* Role Overview */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-lg border-b pb-2">Role Overview</h3>
                                  <div>
                                    <Label>Key Responsibilities</Label>
                                    <Textarea 
                                      value={editKeyResponsibilities} 
                                      onChange={(e) => setEditKeyResponsibilities(e.target.value)} 
                                      rows={4} 
                                      className="mt-1" 
                                      placeholder="• Develop and maintain React applications\n• Collaborate with cross-functional teams\n• Write clean, maintainable code..." 
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Add responsibilities as bullet points. Use • for each point.
                                    </p>
                                  </div>
                                </div>

                                {/* Candidate Requirements */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-lg border-b pb-2">Candidate Requirements</h3>
                                  <div>
                                    <Label>Experience Level Description</Label>
                                    <Textarea 
                                      value={editExperienceLevelDescription} 
                                      onChange={(e) => setEditExperienceLevelDescription(e.target.value)} 
                                      rows={3} 
                                      className="mt-1" 
                                      placeholder="5+ years of experience in frontend development with React..." 
                                    />
                                  </div>
                                  <div>
                                    <Label>Technical Skills Required</Label>
                                    <Textarea 
                                      value={editTechnicalSkills} 
                                      onChange={(e) => setEditTechnicalSkills(e.target.value)} 
                                      rows={3} 
                                      className="mt-1" 
                                      placeholder="JavaScript, TypeScript, React, Node.js, Git..." 
                                    />
                                  </div>
                                  <div>
                                    <Label>Soft Skills</Label>
                                    <Textarea 
                                      value={editSoftSkills} 
                                      onChange={(e) => setEditSoftSkills(e.target.value)} 
                                      rows={3} 
                                      className="mt-1" 
                                      placeholder="Strong communication, teamwork, problem-solving..." 
                                    />
                                  </div>
                                </div>

                                {/* Application Process */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-lg border-b pb-2">Application Process</h3>
                                  <div>
                                    <Label>How to Apply</Label>
                                    <Textarea 
                                      value={editHowToApply} 
                                      onChange={(e) => setEditHowToApply(e.target.value)} 
                                      rows={3} 
                                      className="mt-1" 
                                      placeholder="Send resume to hr@company.com or apply through referral system..." 
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label>Application Deadline</Label>
                                      <Input 
                                        type="date" 
                                        value={editApplicationDeadline} 
                                        onChange={(e) => setEditApplicationDeadline(e.target.value)} 
                                        className="mt-1" 
                                      />
                                    </div>
                                    <div className="flex items-center gap-3 pt-6">
                                      <Switch checked={editReferralEncouraged} onCheckedChange={setEditReferralEncouraged} className="data-[state=unchecked]:bg-gray-300"/>
                                      <Label className="!mt-0">Referrals Encouraged</Label>
                                    </div>
                                  </div>
                                </div>

                                {/* Additional Fields */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-lg border-b pb-2">Additional Details</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label>Experience Level</Label>
                                      <Select value={editExperienceLevel} onValueChange={setEditExperienceLevel}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="entry">Entry</SelectItem>
                                          <SelectItem value="mid">Mid</SelectItem>
                                          <SelectItem value="senior">Senior</SelectItem>
                                          <SelectItem value="lead">Lead</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Employment Type</Label>
                                      <Select value={editEmploymentType} onValueChange={setEditEmploymentType}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="full_time">Full-time</SelectItem>
                                          <SelectItem value="part_time">Part-time</SelectItem>
                                          <SelectItem value="contract">Contract</SelectItem>
                                          <SelectItem value="probation/internship">Probation/Internship</SelectItem>
                                          <SelectItem value="temporary">Temporary</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label>Salary Range Min</Label>
                                      <Input 
                                        type="number" 
                                        value={editSalaryMin} 
                                        onChange={(e) => setEditSalaryMin(e.target.value)} 
                                        placeholder="e.g., 50000" 
                                        className="mt-1" 
                                      />
                                    </div>
                                    <div>
                                      <Label>Salary Range Max</Label>
                                      <Input 
                                        type="number" 
                                        value={editSalaryMax} 
                                        onChange={(e) => setEditSalaryMax(e.target.value)} 
                                        placeholder="e.g., 80000" 
                                        className="mt-1" 
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as 'open' | 'closed' | 'on_hold')}>
                                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="open">Open</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                  <Button variant="outline" onClick={() => { setIsEditPositionOpen(false); setEditingPosition(null); }}>Cancel</Button>
                                  <Button onClick={() => {
                                    if (!editingPosition) return;
                                    updateJobPosition.mutate({ id: editingPosition.id, updates: {
                                      job_title: editTitle.trim(),
                                      department_id: editDepartmentId || null,
                                      key_responsibilities: editKeyResponsibilities.trim() || null,
                                      experience_level_description: editExperienceLevelDescription.trim() || null,
                                      technical_skills_required: editTechnicalSkills.trim() || null,
                                      soft_skills: editSoftSkills.trim() || null,
                                      how_to_apply: editHowToApply.trim() || null,
                                      application_deadline: editApplicationDeadline || null,
                                      referral_encouraged: editReferralEncouraged,
                                      work_type: editWorkType,
                                      experience_level: editExperienceLevel,
                                      employment_type: editEmploymentType,
                                      salary_range_min: editSalaryMin ? Number(editSalaryMin) : null,
                                      salary_range_max: editSalaryMax ? Number(editSalaryMax) : null,
                                      location: editLocation.trim() || null,
                                      is_remote: editIsRemote,
                                      status: editStatus,
                                    } }, {
                                      onSuccess: () => { setIsEditPositionOpen(false); setEditingPosition(null); }
                                    });
                                  }} disabled={updateJobPosition.isPending}>{updateJobPosition.isPending ? 'Saving...' : 'Save Changes'}</Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <ConfirmDelete
                            trigger={(
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-4 w-4"/>
                              </Button>
                            )}
                            title="Delete Job Position"
                            description="Are you sure you want to delete this job position? This action cannot be undone."
                            confirmText="Delete Position"
                            onConfirm={() => deleteJobPosition.mutate(pos.id)}
                            loading={deleteJobPosition.isPending}
                          />
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
    </div>
  );
}