import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCandidates, useCreateCandidate, useUpdateCandidate, useCreateInterview } from '@/hooks/useATS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Filter,
  Eye,
  Calendar as CalendarIcon,
  Mail,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  UserPlus
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const candidateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  position_applied: z.string().min(1, 'Position is required'),
  resume_url: z.string().url().optional().or(z.literal('')),
  cover_letter: z.string().optional(),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  github_url: z.string().url().optional().or(z.literal('')),
  portfolio_url: z.string().url().optional().or(z.literal('')),
  experience_years: z.number().min(0, 'Experience must be positive'),
  current_company: z.string().optional(),
  current_position: z.string().optional(),
  expected_salary: z.number().min(0, 'Salary must be positive').optional(),
  notice_period: z.number().min(0, 'Notice period must be positive').optional(),
});

const interviewSchema = z.object({
  interview_type: z.string().min(1, 'Interview type is required'),
  scheduled_at: z.date({ message: 'Interview date is required' }),
  duration_minutes: z.number().min(15, 'Duration must be at least 15 minutes'),
  meeting_link: z.string().url().optional().or(z.literal('')),
});

type CandidateFormData = z.infer<typeof candidateSchema>;
type InterviewFormData = z.infer<typeof interviewSchema>;

export function CandidatesList() {
  const { user } = useAuth();
  const { data: candidates, isLoading: candidatesLoading } = useAllCandidates();
  const createCandidate = useCreateCandidate();
  const updateCandidate = useUpdateCandidate();
  const createInterview = useCreateInterview();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInterviewDialogOpen, setIsInterviewDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<any>(null);

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      position_applied: '',
      resume_url: '',
      cover_letter: '',
      linkedin_url: '',
      github_url: '',
      portfolio_url: '',
      experience_years: 0,
      current_company: '',
      current_position: '',
      expected_salary: 0,
      notice_period: 0,
    },
  });

  const interviewForm = useForm<InterviewFormData>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      interview_type: 'screening',
      duration_minutes: 60,
      meeting_link: '',
    },
  });

  const filteredCandidates = candidates?.filter(candidate => {
    const matchesSearch = candidate.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.position_applied.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || candidate.status === statusFilter;
    const matchesPosition = !positionFilter || positionFilter === 'all' || candidate.position_applied === positionFilter;
    
    return matchesSearch && matchesStatus && matchesPosition;
  });

  const positions = [...new Set(candidates?.map(c => c.position_applied))];

  const onCandidateSubmit = async (data: CandidateFormData) => {
    const candidateData = {
      ...data,
      source: 'direct',
      status: 'applied',
    };

    if (editingCandidate) {
      updateCandidate.mutate({
        id: editingCandidate.id,
        updates: candidateData
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditingCandidate(null);
          candidateForm.reset();
        }
      });
    } else {
      createCandidate.mutate(candidateData, {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          candidateForm.reset();
        }
      });
    }
  };

  const onInterviewSubmit = async (data: InterviewFormData) => {
    if (!selectedCandidate || !user) return;

    const interviewData = {
      candidate_id: selectedCandidate.id,
      interviewer_id: user.id,
      interview_type: data.interview_type,
      scheduled_at: getCurrentISTDate().toISOString(),
      duration_minutes: data.duration_minutes,
      meeting_link: data.meeting_link || null,
      status: 'scheduled',
    };

    createInterview.mutate(interviewData, {
      onSuccess: () => {
        setIsInterviewDialogOpen(false);
        setSelectedCandidate(null);
        interviewForm.reset();
        // Update candidate status
        updateCandidate.mutate({
          id: selectedCandidate.id,
          updates: { status: 'interview_scheduled' }
        });
      }
    });
  };

  const handleEditCandidate = (candidate: any) => {
    setEditingCandidate(candidate);
    candidateForm.reset({
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone || '',
      position_applied: candidate.position_applied,
      resume_url: candidate.resume_url || '',
      cover_letter: candidate.cover_letter || '',
      linkedin_url: candidate.linkedin_url || '',
      github_url: candidate.github_url || '',
      portfolio_url: candidate.portfolio_url || '',
      experience_years: candidate.experience_years || 0,
      current_company: candidate.current_company || '',
      current_position: candidate.current_position || '',
      expected_salary: candidate.expected_salary || 0,
      notice_period: candidate.notice_period || 0,
    });
    setIsEditDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'selected':
        return <UserPlus className="h-4 w-4 text-blue-600" />;
      case 'interviewed':
        return <Clock className="h-4 w-4 text-purple-600" />;
      case 'interview_scheduled':
        return <Calendar className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      hired: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      selected: 'bg-blue-100 text-blue-800',
      interviewed: 'bg-purple-100 text-purple-800',
      interview_scheduled: 'bg-orange-100 text-orange-800',
      screening: 'bg-yellow-100 text-yellow-800',
      applied: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  if (candidatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
          <p className="text-muted-foreground">
            Manage candidate applications and hiring pipeline
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Candidate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Candidate</DialogTitle>
              <DialogDescription>
                Register a new candidate in the system
              </DialogDescription>
            </DialogHeader>
            <Form {...candidateForm}>
              <form onSubmit={candidateForm.handleSubmit(onCandidateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={candidateForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={candidateForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={candidateForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={candidateForm.control}
                    name="position_applied"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position Applied *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter position" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={candidateForm.control}
                    name="experience_years"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of Experience</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={candidateForm.control}
                    name="expected_salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Salary</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
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
                  control={candidateForm.control}
                  name="resume_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resume URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
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
                      setIsCreateDialogOpen(false);
                      candidateForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCandidate.isPending}>
                    {createCandidate.isPending ? 'Creating...' : 'Create Candidate'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                placeholder="Search candidates..."
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
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                  <SelectItem value="interviewed">Interviewed</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="hired">Hired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Positions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {positions.map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setPositionFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidates Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Candidates ({filteredCandidates?.length || 0})</CardTitle>
          <CardDescription>
            Complete list of candidates in the hiring pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Referred By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates?.map((candidate) => (
                <TableRow key={candidate.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{candidate.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{candidate.full_name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {candidate.email}
                        </div>
                        {candidate.phone && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {candidate.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{candidate.position_applied}</div>
                      {candidate.position_applied_job?.department && (
                        <div className="text-sm text-muted-foreground">
                          {candidate.position_applied_job.department.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline">{candidate.experience_years} years</Badge>
                      {candidate.current_company && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {candidate.current_position} at {candidate.current_company}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(candidate.status)}
                      <Badge className={getStatusBadge(candidate.status)}>
                        {candidate.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatDateForDisplay(candidate.created_at, 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    {candidate.referred_by_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs">
                            {candidate.referred_by_user.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{candidate.referred_by_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Direct</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild
                            onClick={() => setSelectedCandidate(candidate)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Candidate Profile</DialogTitle>
                            <DialogDescription>
                              Complete information for {selectedCandidate?.full_name}
                            </DialogDescription>
                          </DialogHeader>
                          {selectedCandidate && (
                            <Tabs defaultValue="profile" className="space-y-4">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="profile">Profile</TabsTrigger>
                                <TabsTrigger value="interviews">Interviews</TabsTrigger>
                                <TabsTrigger value="assessments">Assessments</TabsTrigger>
                              </TabsList>

                              <TabsContent value="profile" className="space-y-4">
                                <div className="flex items-center gap-4 mb-6">
                                  <Avatar className="h-16 w-16">
                                    <AvatarFallback className="text-lg">
                                      {selectedCandidate.full_name.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <h3 className="text-xl font-semibold">{selectedCandidate.full_name}</h3>
                                    <p className="text-muted-foreground">{selectedCandidate.position_applied}</p>
                                    <Badge className={getStatusBadge(selectedCandidate.status)}>
                                      {selectedCandidate.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="font-medium">Email:</p>
                                    <p className="text-muted-foreground">{selectedCandidate.email}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Phone:</p>
                                    <p className="text-muted-foreground">{selectedCandidate.phone || 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Experience:</p>
                                    <p className="text-muted-foreground">{selectedCandidate.experience_years} years</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Expected Salary:</p>
                                    <p className="text-muted-foreground">
                                      {selectedCandidate.expected_salary ? `$${selectedCandidate.expected_salary.toLocaleString()}` : 'Not specified'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Current Company:</p>
                                    <p className="text-muted-foreground">{selectedCandidate.current_company || 'Not specified'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Notice Period:</p>
                                    <p className="text-muted-foreground">
                                      {selectedCandidate.notice_period ? `${selectedCandidate.notice_period} days` : 'Not specified'}
                                    </p>
                                  </div>
                                </div>

                                {selectedCandidate.cover_letter && (
                                  <div>
                                    <p className="font-medium mb-2">Cover Letter:</p>
                                    <p className="text-muted-foreground text-sm">{selectedCandidate.cover_letter}</p>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  {selectedCandidate.resume_url && (
                                    <Button size="sm" variant="outline">
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Resume
                                    </Button>
                                  )}
                                  {selectedCandidate.linkedin_url && (
                                    <Button size="sm" variant="outline">
                                      LinkedIn
                                    </Button>
                                  )}
                                  {selectedCandidate.github_url && (
                                    <Button size="sm" variant="outline">
                                      GitHub
                                    </Button>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="interviews" className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Interview history and scheduling for this candidate
                                </p>
                                {/* Interview content would go here */}
                              </TabsContent>

                              <TabsContent value="assessments" className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Assessment results and coding test performance
                                </p>
                                {/* Assessment content would go here */}
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        asChild
                        onClick={() => handleEditCandidate(candidate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Dialog open={isInterviewDialogOpen} onOpenChange={setIsInterviewDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm"
                            asChild
                            onClick={() => setSelectedCandidate(candidate)}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Schedule Interview</DialogTitle>
                            <DialogDescription>
                              Schedule an interview with {selectedCandidate?.full_name}
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...interviewForm}>
                            <form onSubmit={interviewForm.handleSubmit(onInterviewSubmit)} className="space-y-4">
                              <FormField
                                control={interviewForm.control}
                                name="interview_type"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Interview Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select interview type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="screening">Screening</SelectItem>
                                        <SelectItem value="technical">Technical</SelectItem>
                                        <SelectItem value="behavioral">Behavioral</SelectItem>
                                        <SelectItem value="final">Final</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={interviewForm.control}
                                name="scheduled_at"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Interview Date & Time</FormLabel>
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
                                            {field.value ? formatDateForDisplay(field.value, "PPP HH:mm") : "Pick date and time"}
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

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={interviewForm.control}
                                  name="duration_minutes"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Duration (minutes)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          placeholder="60" 
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={interviewForm.control}
                                  name="meeting_link"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Meeting Link</FormLabel>
                                      <FormControl>
                                        <Input placeholder="https://meet.google.com/..." {...field} />
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
                                    setIsInterviewDialogOpen(false);
                                    setSelectedCandidate(null);
                                    interviewForm.reset();
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={createInterview.isPending}>
                                  {createInterview.isPending ? 'Scheduling...' : 'Schedule Interview'}
                                </Button>
                              </div>
                            </form>
                          </Form>
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

      {/* Edit Candidate Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
            <DialogDescription>
              Update candidate information and details
            </DialogDescription>
          </DialogHeader>
          <Form {...candidateForm}>
            <form onSubmit={candidateForm.handleSubmit(onCandidateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={candidateForm.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={candidateForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={candidateForm.control}
                name="position_applied"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position Applied *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter position" {...field} />
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
                    setIsEditDialogOpen(false);
                    setEditingCandidate(null);
                    candidateForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCandidate.isPending}>
                  {updateCandidate.isPending ? 'Updating...' : 'Update Candidate'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}