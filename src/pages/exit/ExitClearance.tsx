import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useExitProcess } from '@/hooks/useExit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ClipboardCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Building,
  Package,
  Key,
  FileText,
  DollarSign,
  Monitor,
  BookOpen,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

// Mock clearance items data
const mockClearanceItems = [
  {
    id: '1',
    item_name: 'Return Company Laptop',
    description: 'Return assigned laptop, charger, and accessories to IT department',
    responsible_department: 'IT',
    responsible_person: 'John Smith (IT Manager)',
    is_completed: true,
    completed_at: new Date().toISOString(),
    completed_by: 'John Smith',
    comments: 'Laptop returned in good condition. All data wiped.',
    is_mandatory: true,
    icon: Monitor,
    color: 'bg-blue-500',
  },
  {
    id: '2',
    item_name: 'Return Access Cards',
    description: 'Return office access cards, parking pass, and any keys',
    responsible_department: 'Security',
    responsible_person: 'Security Desk',
    is_completed: false,
    completed_at: null,
    completed_by: null,
    comments: null,
    is_mandatory: true,
    icon: Key,
    color: 'bg-orange-500',
  },
  {
    id: '3',
    item_name: 'Knowledge Transfer',
    description: 'Complete knowledge transfer documentation and handover',
    responsible_department: 'Manager',
    responsible_person: 'Sarah Johnson (Direct Manager)',
    is_completed: true,
    completed_at: new Date().toISOString(),
    completed_by: 'Sarah Johnson',
    comments: 'Comprehensive handover document created and reviewed.',
    is_mandatory: true,
    icon: FileText,
    color: 'bg-green-500',
  },
  {
    id: '4',
    item_name: 'Project Handover',
    description: 'Hand over ongoing projects and responsibilities',
    responsible_department: 'Manager',
    responsible_person: 'Sarah Johnson (Direct Manager)',
    is_completed: false,
    completed_at: null,
    completed_by: null,
    comments: null,
    is_mandatory: true,
    icon: Package,
    color: 'bg-purple-500',
  },
  {
    id: '5',
    item_name: 'Clear Pending Expenses',
    description: 'Submit and clear all pending expense claims',
    responsible_department: 'Finance',
    responsible_person: 'Finance Team',
    is_completed: false,
    completed_at: null,
    completed_by: null,
    comments: null,
    is_mandatory: true,
    icon: DollarSign,
    color: 'bg-red-500',
  },
  {
    id: '6',
    item_name: 'Return Company Assets',
    description: 'Return any other company assets (books, equipment, etc.)',
    responsible_department: 'HR',
    responsible_person: 'HR Team',
    is_completed: false,
    completed_at: null,
    completed_by: null,
    comments: null,
    is_mandatory: true,
    icon: Building,
    color: 'bg-gray-500',
  },
  {
    id: '7',
    item_name: 'Update Emergency Contacts',
    description: 'Provide updated contact information for future reference',
    responsible_department: 'HR',
    responsible_person: 'HR Team',
    is_completed: false,
    completed_at: null,
    completed_by: null,
    comments: null,
    is_mandatory: false,
    icon: User,
    color: 'bg-indigo-500',
  },
  {
    id: '8',
    item_name: 'Library Clearance',
    description: 'Return any borrowed books or materials',
    responsible_department: 'Admin',
    responsible_person: 'Admin Team',
    is_completed: false,
    completed_at: null,
    completed_by: null,
    comments: null,
    is_mandatory: false,
    icon: BookOpen,
    color: 'bg-cyan-500',
  },
];

export function ExitClearance() {
  const { user } = useAuth();
  const { data: exitProcess, isLoading: exitProcessLoading } = useExitProcess();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newComment, setNewComment] = useState('');

  // Check if user is HR
  const isHR = user?.role?.name === 'hr' || user?.role_id === 'hr' || 
              ['super_admin', 'admin'].includes(user?.role?.name || user?.role_id || '');

  const mandatoryItems = mockClearanceItems.filter(item => item.is_mandatory);
  const optionalItems = mockClearanceItems.filter(item => !item.is_mandatory);
  const completedMandatory = mandatoryItems.filter(item => item.is_completed).length;
  const totalMandatory = mandatoryItems.length;
  const completedOptional = optionalItems.filter(item => item.is_completed).length;
  const totalOptional = optionalItems.length;

  const handleMarkComplete = (itemId: string) => {
    // In a real app, this would update the database
    toast.success('Clearance item marked as completed!');
  };

  const handleAddComment = (itemId: string) => {
    if (!newComment.trim()) return;
    
    // In a real app, this would update the database
    toast.success('Comment added successfully!');
    setNewComment('');
  };

  if (exitProcessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!exitProcess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exit Clearance</h1>
          <p className="text-muted-foreground">
            Complete your exit clearance checklist
          </p>
        </div>

        <Card>
          <CardContent className="text-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Exit Process</h3>
            <p className="text-muted-foreground">
              Clearance checklist will be available when you have an active exit process.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exit Clearance Checklist</h1>
        <p className="text-muted-foreground">
          Complete all required items before your last working day
        </p>
      </div>

      {/* Clearance Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mandatory Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{completedMandatory}/{totalMandatory}</div>
            <Progress value={(completedMandatory / totalMandatory) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">Must complete all</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Optional Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{completedOptional}/{totalOptional}</div>
            <Progress value={totalOptional > 0 ? (completedOptional / totalOptional) * 100 : 0} className="mb-2" />
            <p className="text-xs text-muted-foreground">Recommended to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {Math.round((completedMandatory / totalMandatory) * 100)}%
            </div>
            <Progress value={(completedMandatory / totalMandatory) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">Exit readiness</p>
          </CardContent>
        </Card>
      </div>

      {/* Clearance Status Alert */}
      {completedMandatory < totalMandatory && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> You have {totalMandatory - completedMandatory} mandatory clearance item{totalMandatory - completedMandatory > 1 ? 's' : ''} remaining. 
            These must be completed before your last working day.
          </AlertDescription>
        </Alert>
      )}

      {completedMandatory === totalMandatory && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Congratulations!</strong> You have completed all mandatory clearance items. 
            Your exit documents will be generated shortly.
          </AlertDescription>
        </Alert>
      )}

      {/* Mandatory Clearance Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Mandatory Clearance Items
          </CardTitle>
          <CardDescription>
            These items must be completed before your exit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mandatoryItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${item.color}`}>
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.item_name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Department: {item.responsible_department}</span>
                          <span>Contact: {item.responsible_person}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.is_completed ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {item.is_completed && item.comments && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">
                        <strong>Completed by {item.completed_by}:</strong> {item.comments}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {format(new Date(item.completed_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  )}

                  {!item.is_completed && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedItem(item)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Add Update
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update Clearance Item</DialogTitle>
                              <DialogDescription>
                                Add comments or updates for {selectedItem?.item_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Comments/Updates</Label>
                                <Textarea
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="Add any updates, progress notes, or questions..."
                                  className="mt-1"
                                  rows={3}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setNewComment('')}>
                                  Cancel
                                </Button>
                                <Button onClick={() => handleAddComment(selectedItem?.id)}>
                                  Add Comment
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {isHR && (
                          <Button 
                            size="sm"
                            onClick={() => handleMarkComplete(item.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Optional Clearance Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Optional Clearance Items
          </CardTitle>
          <CardDescription>
            Recommended items for a smooth transition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {optionalItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${item.color}`}>
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.item_name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Department: {item.responsible_department}</span>
                          <span>Contact: {item.responsible_person}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.is_completed ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Optional
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!item.is_completed && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Add Update
                        </Button>
                        
                        {isHR && (
                          <Button 
                            size="sm"
                            onClick={() => handleMarkComplete(item.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Clearance Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Clearance Guidelines</CardTitle>
          <CardDescription>Important information about the exit clearance process</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Mandatory Items:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Must be completed before your last working day</li>
                <li>• Required for final settlement processing</li>
                <li>• Blocking items for document generation</li>
                <li>• Contact respective departments for assistance</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Optional Items:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Recommended for a smooth transition</li>
                <li>• Helps maintain good relationships</li>
                <li>• May be useful for future references</li>
                <li>• Can be completed after exit if needed</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Need Help?</h4>
              <p className="text-muted-foreground">
                If you have questions about any clearance item or need assistance, 
                contact the responsible department or reach out to HR at hr@company.com.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}