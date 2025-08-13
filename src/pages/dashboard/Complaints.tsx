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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  LogOut,
  User
} from 'lucide-react';
import { format } from 'date-fns';

const complaintCategories = [
  { value: 'harassment', label: 'Harassment', color: 'bg-red-500' },
  { value: 'discrimination', label: 'Discrimination', color: 'bg-orange-500' },
  { value: 'workplace', label: 'Workplace Environment', color: 'bg-yellow-500' },
  { value: 'management', label: 'Management Issues', color: 'bg-blue-500' },
  { value: 'policy', label: 'Policy Violation', color: 'bg-purple-500' },
  { value: 'safety', label: 'Safety Concerns', color: 'bg-green-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' }
];

const priorityLevels = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
];

const complaintHistory = [
  {
    id: 1,
    title: 'Workplace Noise Issue',
    category: 'Workplace Environment',
    priority: 'medium',
    status: 'resolved',
    description: 'Excessive noise from construction work affecting productivity',
    submittedAt: '2024-12-15',
    resolvedAt: '2024-12-20',
    assignedTo: 'Facilities Team',
    resolution: 'Noise barriers installed and construction hours adjusted'
  },
  {
    id: 2,
    title: 'Overtime Policy Clarification',
    category: 'Policy Violation',
    priority: 'low',
    status: 'in_progress',
    description: 'Need clarification on overtime compensation policy',
    submittedAt: '2024-12-10',
    resolvedAt: null,
    assignedTo: 'HR Department',
    resolution: null
  },
  {
    id: 3,
    title: 'Team Communication Issues',
    category: 'Management Issues',
    priority: 'high',
    status: 'open',
    description: 'Lack of clear communication from project manager causing delays',
    submittedAt: '2024-12-05',
    resolvedAt: null,
    assignedTo: 'HR Department',
    resolution: null
  }
];

export function Complaints() {
  const { user } = useAuth();
  const [complaintType, setComplaintType] = useState('complaint');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);

  // Resignation form states
  const [resignationReason, setResignationReason] = useState('');
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !priority || !title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset form
      setCategory('');
      setPriority('');
      setTitle('');
      setDescription('');
      
      alert('Complaint submitted successfully!');
    } catch (error) {
      alert('Failed to submit complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResignationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resignationReason.trim() || !lastWorkingDay || !noticePeriod) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset form
      setResignationReason('');
      setLastWorkingDay('');
      setNoticePeriod('');
      setAdditionalComments('');
      
      alert('Resignation submitted successfully! HR will contact you soon.');
    } catch (error) {
      alert('Failed to submit resignation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'open':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      resolved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      in_progress: 'bg-blue-100 text-blue-800',
      open: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const level = priorityLevels.find(p => p.value === priority);
    return level?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Complaint Portal</h1>
        <p className="text-muted-foreground">
          Submit complaints, issues, or resignation requests
        </p>
      </div>

      <Tabs defaultValue="submit" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submit">Submit Complaint</TabsTrigger>
          <TabsTrigger value="history">My Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Submit New Complaint or Issue
                  </CardTitle>
                  <CardDescription>
                    Report workplace issues, policy violations, or submit resignation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <Label>Type of Submission</Label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="complaint"
                          checked={complaintType === 'complaint'}
                          onChange={(e) => setComplaintType(e.target.value)}
                          className="text-blue-600"
                        />
                        <span>Complaint/Issue</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="resignation"
                          checked={complaintType === 'resignation'}
                          onChange={(e) => setComplaintType(e.target.value)}
                          className="text-blue-600"
                        />
                        <span>Resignation</span>
                      </label>
                    </div>
                  </div>

                  {complaintType === 'complaint' ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select complaint category" />
                          </SelectTrigger>
                          <SelectContent>
                            {complaintCategories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                                  {cat.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="priority">Priority Level</Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select priority level" />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityLevels.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="title">Issue Title</Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Brief description of the issue"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Detailed Description</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Please provide detailed information about the issue, including dates, people involved, and any relevant context..."
                          className="mt-1"
                          rows={6}
                        />
                      </div>

                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          All complaints are treated confidentially. HR will investigate and respond within 3-5 business days.
                        </AlertDescription>
                      </Alert>

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={!category || !priority || !title.trim() || !description.trim() || isSubmitting}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleResignationSubmit} className="space-y-6">
                      <Alert className="border-orange-200 bg-orange-50">
                        <LogOut className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Resignation Submission</strong><br />
                          Please fill out all required information. HR will contact you to discuss the resignation process.
                        </AlertDescription>
                      </Alert>

                      <div>
                        <Label htmlFor="resignationReason">Reason for Resignation</Label>
                        <Textarea
                          id="resignationReason"
                          value={resignationReason}
                          onChange={(e) => setResignationReason(e.target.value)}
                          placeholder="Please provide your reason for resignation..."
                          className="mt-1"
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="lastWorkingDay">Proposed Last Working Day</Label>
                          <Input
                            id="lastWorkingDay"
                            type="date"
                            value={lastWorkingDay}
                            onChange={(e) => setLastWorkingDay(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="noticePeriod">Notice Period (Days)</Label>
                          <Select value={noticePeriod} onValueChange={setNoticePeriod}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select notice period" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 Days</SelectItem>
                              <SelectItem value="60">60 Days</SelectItem>
                              <SelectItem value="90">90 Days</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="additionalComments">Additional Comments (Optional)</Label>
                        <Textarea
                          id="additionalComments"
                          value={additionalComments}
                          onChange={(e) => setAdditionalComments(e.target.value)}
                          placeholder="Any additional information or feedback..."
                          className="mt-1"
                          rows={3}
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        disabled={!resignationReason.trim() || !lastWorkingDay || !noticePeriod || isSubmitting}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Resignation'}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">For Complaints:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Be specific and factual</li>
                      <li>• Include dates and witnesses</li>
                      <li>• Provide supporting evidence</li>
                      <li>• Choose appropriate priority</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">For Resignations:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Standard notice period is 30-60 days</li>
                      <li>• HR will schedule exit interview</li>
                      <li>• Complete handover process</li>
                      <li>• Return company assets</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">HR Department</p>
                    <p className="text-muted-foreground">hr@company.com</p>
                    <p className="text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                  <div>
                    <p className="font-medium">Anonymous Hotline</p>
                    <p className="text-muted-foreground">+1 (555) 987-6543</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Complaints History</CardTitle>
              <CardDescription>
                Track the status of your submitted complaints and issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complaintHistory.map((complaint) => (
                    <TableRow key={complaint.id}>
                      <TableCell className="font-medium">{complaint.title}</TableCell>
                      <TableCell>{complaint.category}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityBadge(complaint.priority)}>
                          {complaint.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(complaint.status)}
                          <Badge className={getStatusBadge(complaint.status)}>
                            {complaint.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(complaint.submittedAt), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedComplaint(complaint)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{selectedComplaint?.title}</DialogTitle>
                              <DialogDescription>
                                Complaint details and resolution status
                              </DialogDescription>
                            </DialogHeader>
                            {selectedComplaint && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="font-medium">Category:</p>
                                    <p className="text-muted-foreground">{selectedComplaint.category}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Priority:</p>
                                    <Badge className={getPriorityBadge(selectedComplaint.priority)}>
                                      {selectedComplaint.priority}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="font-medium">Status:</p>
                                    <Badge className={getStatusBadge(selectedComplaint.status)}>
                                      {selectedComplaint.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="font-medium">Assigned To:</p>
                                    <p className="text-muted-foreground">{selectedComplaint.assignedTo}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <p className="font-medium mb-2">Description:</p>
                                  <p className="text-muted-foreground text-sm">{selectedComplaint.description}</p>
                                </div>

                                {selectedComplaint.resolution && (
                                  <div>
                                    <p className="font-medium mb-2">Resolution:</p>
                                    <p className="text-muted-foreground text-sm">{selectedComplaint.resolution}</p>
                                  </div>
                                )}

                                <div className="flex justify-between text-xs text-muted-foreground pt-4 border-t">
                                  <span>Submitted: {format(new Date(selectedComplaint.submittedAt), 'MMM dd, yyyy')}</span>
                                  {selectedComplaint.resolvedAt && (
                                    <span>Resolved: {format(new Date(selectedComplaint.resolvedAt), 'MMM dd, yyyy')}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
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