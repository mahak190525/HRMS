import React, { useState } from 'react';
import { useAllFeedback, useUpdateFeedbackStatus, type EmployeeFeedback } from '@/hooks/useFeedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MessageSquare, Eye, Clock, AlertCircle, CheckCircle, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

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

interface FeedbackDetailModalProps {
  feedback: EmployeeFeedback;
  onStatusUpdate: (feedbackId: string, status: 'submitted' | 'noted' | 'resolved') => void;
  isUpdating: boolean;
}

function FeedbackDetailModal({ feedback, onStatusUpdate, isUpdating }: FeedbackDetailModalProps) {
  const [newStatus, setNewStatus] = useState<'submitted' | 'noted' | 'resolved'>(feedback.status);

  const handleStatusUpdate = () => {
    if (newStatus !== feedback.status) {
      onStatusUpdate(feedback.id, newStatus);
    }
  };

  return (
    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Feedback Details
        </DialogTitle>
        <DialogDescription>
          View and manage employee feedback submission
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-6">
        {/* Employee Information */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <User className="h-5 w-5 text-gray-600" />
          <div>
            <p className="font-medium text-gray-900">{feedback.employee_name}</p>
            <p className="text-sm text-gray-600">{feedback.employee_email}</p>
          </div>
        </div>

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
            Submitted: {format(new Date(feedback.created_at), 'MMM dd yyyy, hh:mm a')}
          </div>
          <div className="flex items-center gap-2">
            Current Status: 
            <Badge className={`gap-1 ${getStatusColor(feedback.status)}`}>
              {getStatusIcon(feedback.status)}
              {getStatusLabel(feedback.status)}
            </Badge>
          </div>
        </div>

        {/* Status Update */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium text-gray-900">Update Status</h4>
          <div className="flex items-center gap-3">
            <Select
              value={newStatus}
              onValueChange={(value: 'submitted' | 'noted' | 'resolved') => setNewStatus(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="noted">Noted</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleStatusUpdate}
              disabled={newStatus === feedback.status || isUpdating}
              size="sm"
            >
              {isUpdating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

export function FeedbackManagement() {
  const { feedback, loading, refetch } = useAllFeedback();
  const { updateStatus, loading: updating } = useUpdateFeedbackStatus();
  const [selectedFeedback, setSelectedFeedback] = useState<EmployeeFeedback | null>(null);

  const handleStatusUpdate = async (feedbackId: string, status: 'submitted' | 'noted' | 'resolved') => {
    const success = await updateStatus(feedbackId, status);
    if (success) {
      refetch();
      setSelectedFeedback(null);
    }
  };

  const getStatsSummary = () => {
    const submitted = feedback.filter(f => f.status === 'submitted').length;
    const noted = feedback.filter(f => f.status === 'noted').length;
    const resolved = feedback.filter(f => f.status === 'resolved').length;
    return { submitted, noted, resolved, total: feedback.length };
  };

  const stats = getStatsSummary();

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
        <h1 className="text-2xl font-bold text-gray-900">HRMS Feedback Management</h1>
        <p className="text-gray-600">View and manage employee feedback submissions</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            <div className={`p-2 rounded-lg bg-gray-500`}>
                <MessageSquare className="h-4 w-4 text-white" />
            </div>
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <div className={`p-2 rounded-lg bg-gray-500`}>
                <Clock className="h-4 w-4 text-white" />
            </div>
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.submitted}</div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Noted</CardTitle>
            <div className={`p-2 rounded-lg bg-gray-500`}>
                <AlertCircle className="h-4 w-4 text-white" />
            </div>
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.noted}</div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <div className={`p-2 rounded-lg bg-gray-500`}>
                <CheckCircle className="h-4 w-4 text-white" />
            </div>
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            </CardContent>
        </Card>
      </div>

      {/* Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Feedback</CardTitle>
          <CardDescription>
            All feedback submissions from employees with their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No feedback submitted yet</p>
              <p className="text-sm text-gray-400">Employee feedback will appear here when submitted</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-medium">{item.employee_name}</p>
                          <p className="text-sm text-gray-500">{item.employee_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
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
                        {format(new Date(item.created_at), 'MMM dd, yyyy')}
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
                          {selectedFeedback && (
                            <FeedbackDetailModal
                              feedback={selectedFeedback}
                              onStatusUpdate={handleStatusUpdate}
                              isUpdating={updating}
                            />
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
