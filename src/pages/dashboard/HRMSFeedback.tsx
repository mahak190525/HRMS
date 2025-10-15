import React, { useState } from 'react';
import { useMyFeedback, useCreateFeedback, type CreateFeedbackData, type EmployeeFeedback } from '@/hooks/useFeedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MessageSquare, Plus, Calendar, AlertCircle, CheckCircle, Clock, Eye } from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'submitted':
      return <Clock className="h-4 w-4" />;
    case 'noted':
      return <AlertCircle className="h-4 w-4" />;
    case 'resolved':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'noted':
      return 'bg-yellow-100 text-yellow-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'noted':
      return 'Noted';
    case 'resolved':
      return 'Resolved';
    default:
      return status;
  }
};

interface FeedbackViewModalProps {
  feedback: EmployeeFeedback;
}

function FeedbackViewModal({ feedback }: FeedbackViewModalProps) {
  return (
    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Feedback Details
        </DialogTitle>
        <DialogDescription>
          View your feedback submission details
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-6">
        {/* Feedback Content */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Title</h4>
            <p className="text-gray-700 bg-gray-50 p-3 rounded-md">{feedback.title}</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Description</h4>
            <div className="text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
              {feedback.description}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Submitted: {formatDateForDisplay(feedback.created_at, 'MMM dd yyyy, hh:mm a')}
          </div>
          <div className="flex items-center gap-2">
            Status: 
            <Badge className={`gap-1 ${getStatusColor(feedback.status)}`}>
              {getStatusIcon(feedback.status)}
              {getStatusLabel(feedback.status)}
            </Badge>
          </div>
        </div>

        {feedback.updated_at !== feedback.created_at && (
          <div className="text-sm text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last updated: {formatDateForDisplay(feedback.updated_at, 'MMM dd yyyy, hh:mm a')}
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

export function HRMSFeedback() {
  const { feedback, loading, refetch } = useMyFeedback();
  const { createFeedback, loading: creating } = useCreateFeedback();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<EmployeeFeedback | null>(null);
  const [formData, setFormData] = useState<CreateFeedbackData>({
    title: '',
    description: '',
  });

  const handleInputChange = (field: keyof CreateFeedbackData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    const success = await createFeedback(formData);
    if (success) {
      setFormData({ title: '', description: '' });
      setDialogOpen(false);
      refetch();
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HRMS Feedback</h1>
        <p className="text-gray-600">Share your feedback and suggestions for HRMS development</p>
      </div>

      {/* Feedback Form Dialog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Submit Feedback
          </CardTitle>
          <CardDescription>
            Help us improve the HRMS by sharing your feedback and suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Submit New Feedback
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Submit HRMS Feedback</DialogTitle>
                <DialogDescription>
                  Share your feedback, suggestions, or issues related to the HRMS system.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Brief summary of your feedback"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide detailed feedback, suggestions, or describe any issues you've encountered"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={5}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Feedback'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* My Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Feedback History
          </CardTitle>
          <CardDescription>
            View all your submitted feedback and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No feedback submitted yet</p>
              <p className="text-sm text-gray-400">Click "Submit New Feedback" to share your thoughts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[200px]">
                        <div className="truncate" title={item.title}>
                          {item.title}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="truncate" title={item.description}>
                          {item.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`gap-1 ${getStatusColor(item.status)}`}
                        >
                          {getStatusIcon(item.status)}
                          {getStatusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDateForDisplay(item.created_at, 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFeedback(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          {selectedFeedback && selectedFeedback.id === item.id && (
                            <FeedbackViewModal feedback={selectedFeedback} />
                          )}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
