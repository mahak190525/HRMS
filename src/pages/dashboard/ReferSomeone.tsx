import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

const availablePositions = [
  { value: 'frontend-developer', label: 'Frontend Developer', department: 'Engineering' },
  { value: 'backend-developer', label: 'Backend Developer', department: 'Engineering' },
  { value: 'fullstack-developer', label: 'Full Stack Developer', department: 'Engineering' },
  { value: 'ui-ux-designer', label: 'UI/UX Designer', department: 'Design' },
  { value: 'product-manager', label: 'Product Manager', department: 'Product' },
  { value: 'qa-engineer', label: 'QA Engineer', department: 'Quality Assurance' },
  { value: 'devops-engineer', label: 'DevOps Engineer', department: 'Engineering' },
  { value: 'business-analyst', label: 'Business Analyst', department: 'Business Development' },
];

const relationshipTypes = [
  { value: 'friend', label: 'Friend' },
  { value: 'former-colleague', label: 'Former Colleague' },
  { value: 'university-mate', label: 'University Mate' },
  { value: 'professional-network', label: 'Professional Network' },
  { value: 'family', label: 'Family Member' },
  { value: 'other', label: 'Other' },
];

const referralHistory = [
  {
    id: 1,
    candidateName: 'John Smith',
    candidateEmail: 'john.smith@email.com',
    position: 'Frontend Developer',
    relationship: 'Former Colleague',
    status: 'hired',
    submittedAt: '2024-11-15',
    bonusAmount: 5000,
    bonusPaid: true,
    currentStage: 'Onboarded'
  },
  {
    id: 2,
    candidateName: 'Sarah Wilson',
    candidateEmail: 'sarah.wilson@email.com',
    position: 'UI/UX Designer',
    relationship: 'University Mate',
    status: 'interviewed',
    submittedAt: '2024-12-01',
    bonusAmount: 3000,
    bonusPaid: false,
    currentStage: 'Final Interview'
  },
  {
    id: 3,
    candidateName: 'Mike Johnson',
    candidateEmail: 'mike.johnson@email.com',
    position: 'Backend Developer',
    relationship: 'Friend',
    status: 'rejected',
    submittedAt: '2024-10-20',
    bonusAmount: 0,
    bonusPaid: false,
    currentStage: 'Application Rejected'
  },
  {
    id: 4,
    candidateName: 'Emily Davis',
    candidateEmail: 'emily.davis@email.com',
    position: 'Product Manager',
    relationship: 'Professional Network',
    status: 'under_review',
    submittedAt: '2024-12-10',
    bonusAmount: 4000,
    bonusPaid: false,
    currentStage: 'Resume Screening'
  }
];

export function ReferSomeone() {
  const { user } = useAuth();
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [position, setPosition] = useState('');
  const [relationship, setRelationship] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [whyRecommend, setWhyRecommend] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim() || !position || !relationship) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reset form
      setCandidateName('');
      setCandidateEmail('');
      setCandidatePhone('');
      setPosition('');
      setRelationship('');
      setAdditionalInfo('');
      setWhyRecommend('');
      setResumeFile(null);
      
      alert('Referral submitted successfully! HR will review and contact the candidate.');
    } catch (error) {
      alert('Failed to submit referral');
    } finally {
      setIsSubmitting(false);
    }
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

  const totalReferrals = referralHistory.length;
  const successfulReferrals = referralHistory.filter(r => r.status === 'hired').length;
  const totalBonusEarned = referralHistory
    .filter(r => r.bonusPaid)
    .reduce((sum, r) => sum + r.bonusAmount, 0);
  const pendingBonus = referralHistory
    .filter(r => r.status === 'hired' && !r.bonusPaid)
    .reduce((sum, r) => sum + r.bonusAmount, 0);

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
                        <Label htmlFor="position">Position *</Label>
                        <Select value={position} onValueChange={setPosition}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePositions.map((pos) => (
                              <SelectItem key={pos.value} value={pos.value}>
                                <div>
                                  <div>{pos.label}</div>
                                  <div className="text-xs text-muted-foreground">{pos.department}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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

                    <div>
                      <Label htmlFor="resume">Resume Upload</Label>
                      <Input
                        id="resume"
                        type="file"
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        className="mt-1"
                        accept=".pdf,.doc,.docx"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported formats: PDF, DOC, DOCX (Max 5MB)
                      </p>
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
                      disabled={!candidateName.trim() || !candidateEmail.trim() || !position || !relationship || !whyRecommend.trim() || isSubmitting}
                    >
                      {isSubmitting ? 'Submitting Referral...' : 'Submit Referral'}
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
                  <div className="space-y-3">
                    {availablePositions.slice(0, 5).map((pos) => (
                      <div key={pos.value} className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{pos.label}</p>
                          <p className="text-xs text-muted-foreground">{pos.department}</p>
                        </div>
                        <Badge variant="outline">Open</Badge>
                      </div>
                    ))}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralHistory.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.candidateName}</div>
                          <div className="text-sm text-muted-foreground">{referral.candidateEmail}</div>
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
                      <TableCell>{referral.currentStage}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            ${referral.bonusAmount.toLocaleString()}
                          </div>
                          {referral.bonusAmount > 0 && (
                            <div className={`text-xs ${referral.bonusPaid ? 'text-green-600' : 'text-yellow-600'}`}>
                              {referral.bonusPaid ? 'Paid' : 'Pending'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(referral.submittedAt), 'MMM dd, yyyy')}</TableCell>
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