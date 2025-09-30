import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useJobPositions, useReferrals, useCreateReferral, useCreateReferralWithResume } from '@/hooks/useReferrals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserPlus,
  Upload,
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const relationshipTypes = [
  { value: 'friend', label: 'Friend' },
  { value: 'former-colleague', label: 'Former Colleague' },
  { value: 'university-mate', label: 'University Mate' },
  { value: 'professional-network', label: 'Professional Network' },
  { value: 'family', label: 'Family Member' },
  { value: 'other', label: 'Other' },
];

export function ReferSomeone() {
  const { user } = useAuth();
  const { data: jobPositions, isLoading: positionsLoading } = useJobPositions();
  const { data: referralHistory, isLoading: historyLoading } = useReferrals();
  const createReferral = useCreateReferral();
  const createReferralWithResume = useCreateReferralWithResume();
  
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [position, setPosition] = useState('');
  const [relationship, setRelationship] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [whyRecommend, setWhyRecommend] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New fields
  const [linkedinProfile, setLinkedinProfile] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [currentJobTitle, setCurrentJobTitle] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [experienceMonths, setExperienceMonths] = useState('');
  const [currentCtc, setCurrentCtc] = useState('');
  const [expectedCtc, setExpectedCtc] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [reasonForChange, setReasonForChange] = useState('');
  const [keySkills, setKeySkills] = useState('');
  const [domainExpertise, setDomainExpertise] = useState('');
  const [locationPreference, setLocationPreference] = useState('Mohali');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim() || !position || !relationship || !user) return;

    const referralData = {
      referred_by: user.id,
      candidate_name: candidateName.trim(),
      candidate_email: candidateEmail.trim(),
      candidate_phone: candidatePhone.trim() || null,
      position: position,
      additional_info: additionalInfo.trim() || null,
      relationship: relationship,
      linkedin_profile: linkedinProfile.trim() || null,
      current_company: currentCompany.trim() || null,
      current_job_title: currentJobTitle.trim() || null,
      total_experience_years: experienceYears ? parseInt(experienceYears) : null,
      total_experience_months: experienceMonths ? parseInt(experienceMonths) : null,
      current_ctc: currentCtc ? parseFloat(currentCtc) : null,
      expected_ctc: expectedCtc ? parseFloat(expectedCtc) : null,
      notice_period_availability: noticePeriod.trim() || null,
      reason_for_change: reasonForChange.trim() || null,
      key_skills: keySkills.trim() || null,
      domain_expertise: domainExpertise.trim() || null,
      location_preference: locationPreference as 'Mohali' | 'Kota',
      status: 'submitted',
      bonus_eligible: true
    };

    const mutation = resumeFile ? createReferralWithResume : createReferral;
    const mutationData = resumeFile 
      ? { referralData, resumeFile }
      : referralData;

    mutation.mutate(mutationData, {
      onSuccess: () => {
        // Reset form
        setCandidateName('');
        setCandidateEmail('');
        setCandidatePhone('');
        setPosition('');
        setRelationship('');
        setAdditionalInfo('');
        setWhyRecommend('');
        setResumeFile(null);
        // Reset new fields
        setLinkedinProfile('');
        setCurrentCompany('');
        setCurrentJobTitle('');
        setExperienceYears('');
        setExperienceMonths('');
        setCurrentCtc('');
        setExpectedCtc('');
        setNoticePeriod('');
        setReasonForChange('');
        setKeySkills('');
        setDomainExpertise('');
        setLocationPreference('Mohali');
        // Clear file input
        const fileInput = document.getElementById('resume') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'interviewed':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'under_review':
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
      under_review: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const totalReferrals = referralHistory?.length || 0;
  const successfulReferrals = referralHistory?.filter(r => r.status === 'hired').length || 0;
  const totalBonusEarned = referralHistory?.filter(r => r.bonus_paid).reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0;
  const pendingBonus = referralHistory?.filter(r => r.status === 'hired' && !r.bonus_paid).reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0;

  if (positionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Refer Someone</h1>
        <p className="text-muted-foreground">
          Help us find great talent and earn referral bonuses
        </p>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Successful Hires
            </CardTitle>
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
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Bonus Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBonusEarned.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total paid out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Pending Bonus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingBonus.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">To be processed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="refer" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="refer">Submit Referral</TabsTrigger>
          <TabsTrigger value="history">My Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="refer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Submit New Referral
                  </CardTitle>
                  <CardDescription>
                    Refer a qualified candidate for open positions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <h3 className="text-lg font-semibold mb-4">Candidate Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="candidateName">Candidate Name *</Label>
                        <Input
                          id="candidateName"
                          value={candidateName}
                          onChange={(e) => setCandidateName(e.target.value)}
                          placeholder="Full name"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="candidateEmail">Email Address *</Label>
                        <Input
                          id="candidateEmail"
                          type="email"
                          value={candidateEmail}
                          onChange={(e) => setCandidateEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="candidatePhone">Phone Number</Label>
                        <Input
                          id="candidatePhone"
                          value={candidatePhone}
                          onChange={(e) => setCandidatePhone(e.target.value)}
                          placeholder="+1 (555) 123-4567"
                          className="mt-1"
                        />
                      </div>

                      <div>
                          <Label htmlFor="linkedinProfile">LinkedIn Profile</Label>
                          <Input
                            id="linkedinProfile"
                            value={linkedinProfile}
                            onChange={(e) => setLinkedinProfile(e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            className="mt-1"
                          />
                        </div>
                    </div>

                    <div>
                      <Label htmlFor="resume">Resume Upload</Label>
                      <Input
                        id="resume"
                        type="file"
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        className="mt-1"
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported formats: PDF, DOC, DOCX, TXT, JPEG, PNG (Max 10MB)
                      </p>
                      {resumeFile && (
                        <p className="text-xs text-green-600 mt-1">
                          Selected: {resumeFile.name} ({Math.round(resumeFile.size / 1024)}KB)
                        </p>
                      )}
                    </div>

                    {/* Professional Details Section */}
                    <div className="border-t pt-2">
                      <h3 className="text-lg font-semibold mb-4">Professional Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div>
                          <Label htmlFor="currentCompany">Current Company</Label>
                          <Input
                            id="currentCompany"
                            value={currentCompany}
                            onChange={(e) => setCurrentCompany(e.target.value)}
                            placeholder="Company name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="currentJobTitle">Current Job Title</Label>
                          <Input
                            id="currentJobTitle"
                            value={currentJobTitle}
                            onChange={(e) => setCurrentJobTitle(e.target.value)}
                            placeholder="Current position"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <Label htmlFor="experienceYears">Experience (Years)</Label>
                          <Input
                            id="experienceYears"
                            type="number"
                            value={experienceYears}
                            onChange={(e) => setExperienceYears(e.target.value)}
                            placeholder="0"
                            min="0"
                            max="50"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="experienceMonths">Experience (Months)</Label>
                          <Input
                            id="experienceMonths"
                            type="number"
                            value={experienceMonths}
                            onChange={(e) => setExperienceMonths(e.target.value)}
                            placeholder="0"
                            min="0"
                            max="11"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <Label htmlFor="currentCtc">Current CTC (Optional)</Label>
                          <Input
                            id="currentCtc"
                            type="number"
                            value={currentCtc}
                            onChange={(e) => setCurrentCtc(e.target.value)}
                            placeholder="Annual salary in ₹"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="expectedCtc">Expected CTC (Optional)</Label>
                          <Input
                            id="expectedCtc"
                            type="number"
                            value={expectedCtc}
                            onChange={(e) => setExpectedCtc(e.target.value)}
                            placeholder="Expected annual salary in ₹"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <Label htmlFor="noticePeriod">Notice Period / Availability</Label>
                          <Input
                            id="noticePeriod"
                            value={noticePeriod}
                            onChange={(e) => setNoticePeriod(e.target.value)}
                            placeholder="e.g., 30 days, Immediate"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="reasonForChange">Reason For Looking for Change</Label>
                          <Textarea
                            id="reasonForChange"
                            value={reasonForChange}
                            onChange={(e) => setReasonForChange(e.target.value)}
                            placeholder="Why is the candidate looking for a new opportunity?"
                            className="mt-1"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Skills & Expertise */}
                      <h3 className="text-lg font-semibold mb-4 border-t pt-2">Skills & Expertise</h3>
                    
                    <div className="my-4">
                        <Label htmlFor="keySkills">Key Technical/Functional Skills</Label>
                        <Textarea
                          id="keySkills"
                          value={keySkills}
                          onChange={(e) => setKeySkills(e.target.value)}
                          placeholder="List the candidate's key skills, technologies, frameworks, etc."
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="domainExpertise">Domain Expertise (if any)</Label>
                        <Textarea
                          id="domainExpertise"
                          value={domainExpertise}
                          onChange={(e) => setDomainExpertise(e.target.value)}
                          placeholder="e.g., Healthcare, Fintech, E-commerce"
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    
                    {/* Referral Information */}
                      <h3 className="text-lg font-semibold mb-4 border-t pt-2">Referral Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="position">Position Referred For *</Label>
                        <Select value={position} onValueChange={setPosition}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent>
                            {jobPositions?.map((pos: any) => (
                              <SelectItem key={pos.id} value={pos.job_title}>
                                {pos.job_title}
                                {pos.department?.name && (
                                  <span className="text-xs text-muted-foreground ml-2">({pos.department.name})</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="locationPreference">Location Referring for *</Label>
                        <Select value={locationPreference} onValueChange={setLocationPreference}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mohali">Mohali</SelectItem>
                            <SelectItem value="Kota">Kota</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="relationship">Relationship *</Label>
                        <Select value={relationship} onValueChange={setRelationship}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="How do you know this person?" />
                          </SelectTrigger>
                          <SelectContent>
                            {relationshipTypes.map((rel) => (
                              <SelectItem key={rel.value} value={rel.value}>
                                {rel.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="whyRecommend">Why do you recommend this candidate? *</Label>
                      <Textarea
                        id="whyRecommend"
                        value={whyRecommend}
                        onChange={(e) => setWhyRecommend(e.target.value)}
                        placeholder="Describe their skills, experience, and why they would be a good fit..."
                        className="mt-1"
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="additionalInfo">Additional Information</Label>
                      <Textarea
                        id="additionalInfo"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        placeholder="Any additional context, achievements, or relevant information..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <Alert>
                      <Gift className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Referral Bonus:</strong> Earn $3,000-$5,000 for successful hires based on position level. 
                        Bonus is paid after the candidate completes 90 days of employment.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={!candidateName.trim() || !candidateEmail.trim() || !position || !relationship || !whyRecommend.trim() || createReferral.isPending || createReferralWithResume.isPending}
                    >
                      {(createReferral.isPending || createReferralWithResume.isPending) ? (
                        resumeFile ? 'Uploading Resume & Submitting...' : 'Submitting Referral...'
                      ) : 'Submit Referral'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Referral Program</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Bonus Structure:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Senior Roles</span>
                        <span className="font-medium">$5,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mid-level Roles</span>
                        <span className="font-medium">$4,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Junior Roles</span>
                        <span className="font-medium">$3,000</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Requirements:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Candidate must be hired</li>
                      <li>• Complete 90-day probation</li>
                      <li>• Not previously in our system</li>
                      <li>• Meet all job requirements</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Open Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {jobPositions?.slice(0, 5).map((pos: any) => {
                      const salaryMin = typeof pos.salary_range_min === 'number' ? pos.salary_range_min : (pos.salary_range_min ? Number(pos.salary_range_min) : null);
                      const salaryMax = typeof pos.salary_range_max === 'number' ? pos.salary_range_max : (pos.salary_range_max ? Number(pos.salary_range_max) : null);
                      const salaryDisplay = salaryMin || salaryMax
                        ? `₹${(salaryMin ?? 0).toLocaleString()} - ₹${(salaryMax ?? 0).toLocaleString()}`
                        : 'Not disclosed';
                      const experienceDisplay = (pos.experience_level || '').replace('_', ' ');
                      const locationDisplay = pos.is_remote ? 'Remote' : (pos.location || 'On-site');
                      return (
                        <div key={pos.id} className="rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-none truncate">{pos.job_title}</p>
                              <div className="mt-1 flex items-center gap-2">
                                {pos.department?.name && (
                                  <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                    {pos.department.name}
                                  </Badge>
                                )}
                                {pos.employment_type && (
                                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 capitalize">
                                    {pos.employment_type.replace('_', ' ')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize">{(pos.status || 'open').replace('_', ' ')}</Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">Experience</p>
                              <p className="font-medium capitalize">{experienceDisplay || '—'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">Location</p>
                              <p className="font-medium">{locationDisplay}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">Salary Range</p>
                              <p className="font-medium">{salaryDisplay}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">Status</p>
                              <p className="font-medium capitalize">{(pos.status || 'open').replace('_', ' ')}</p>
                            </div>
                          </div>

                          {(pos.description || pos.requirements) && (
                            <div className="mt-3 space-y-2">
                              {pos.description && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Description</p>
                                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{pos.description}</p>
                                </div>
                              )}
                              {pos.requirements && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Requirements</p>
                                  <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4 leading-relaxed">{pos.requirements}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Referral History</CardTitle>
              <CardDescription>
                Track the status of your submitted referrals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <LoadingSpinner size="sm" />
              ) : referralHistory && referralHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralHistory.map((referral: any) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{referral.candidate_name}</div>
                            <div className="text-sm text-muted-foreground">{referral.candidate_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{referral.position}</TableCell>
                        <TableCell>{referral.relationship}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(referral.status)}
                            <Badge className={getStatusBadge(referral.status)}>
                              {referral.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              ${(referral.bonus_amount || 0).toLocaleString()}
                            </div>
                            {referral.bonus_amount > 0 && (
                              <div className={`text-xs ${referral.bonus_paid ? 'text-green-600' : 'text-yellow-600'}`}>
                                {referral.bonus_paid ? 'Paid' : 'Pending'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(referral.created_at), 'MMM dd, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No referrals submitted yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}