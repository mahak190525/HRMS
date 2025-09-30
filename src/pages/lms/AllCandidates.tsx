import React from 'react';
import { useAllCandidatesProgress } from '@/hooks/useLMS';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Eye, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface CandidateProgress {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  overallProgress: number;
  moduleProgress: {
    completed: number;
    total: number;
    modules: Array<{
      id: string;
      title: string;
      status: 'not_started' | 'in_progress' | 'completed' | 'failed';
      progress: number;
    }>;
  };
  documentStatus: {
    uploaded: number;
    required: number;
    approved: number;
    pending: number;
  };
  lastActivity: string;
}

const AllCandidates: React.FC = () => {
  const { data: candidates, isLoading, error } = useAllCandidatesProgress();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <XCircle className="h-12 w-12 mx-auto mb-4" />
            <p>Failed to load candidate data. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Not Started</Badge>;
    }
  };

  const getDocumentStatusBadge = (uploaded: number, required: number, approved: number) => {
    if (approved === required) {
      return <Badge variant="default" className="bg-green-100 text-green-800">All Approved</Badge>;
    } else if (uploaded === required) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Under Review</Badge>;
    } else if (uploaded > 0) {
      return <Badge variant="outline" className="bg-orange-100 text-orange-800">Partial</Badge>;
    } else {
      return <Badge variant="destructive">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Candidates</h1>
          <p className="text-muted-foreground">
            Monitor candidate progress across learning modules and document submissions
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Training</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {candidates?.filter(c => c.overallProgress === 100).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {candidates?.filter(c => c.overallProgress > 0 && c.overallProgress < 100).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {candidates?.filter(c => c.overallProgress === 0).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidate Progress Overview</CardTitle>
          <CardDescription>
            Track learning progress and document submission status for all candidates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Module Progress</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates?.map((candidate) => (
                <TableRow key={candidate.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={candidate.avatar} />
                        <AvatarFallback>
                          {candidate.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{candidate.name}</div>
                        <div className="text-sm text-muted-foreground">{candidate.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{candidate.role}</Badge>
                  </TableCell>
                  <TableCell>{candidate.department}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{candidate.moduleProgress.completed}/{candidate.moduleProgress.total} modules</span>
                        <span>{candidate.overallProgress}%</span>
                      </div>
                      <Progress value={candidate.overallProgress} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {getDocumentStatusBadge(
                      candidate.documentStatus.uploaded,
                      candidate.documentStatus.required,
                      candidate.documentStatus.approved
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {candidate.lastActivity}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>{candidate.name} - Detailed Progress</DialogTitle>
                          <DialogDescription>
                            Complete overview of learning progress and document status
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">Module Progress</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  {candidate.moduleProgress.modules.map((module) => (
                                    <div key={module.id} className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{module.title}</div>
                                        <Progress value={module.progress} className="h-2 mt-1" />
                                      </div>
                                      <div className="ml-4">
                                        {getStatusBadge(module.status)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                            
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">Document Status</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div className="flex justify-between">
                                    <span>Required Documents:</span>
                                    <span className="font-medium">{candidate.documentStatus.required}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Uploaded:</span>
                                    <span className="font-medium">{candidate.documentStatus.uploaded}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Approved:</span>
                                    <span className="font-medium text-green-600">{candidate.documentStatus.approved}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Pending Review:</span>
                                    <span className="font-medium text-yellow-600">{candidate.documentStatus.pending}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {(!candidates || candidates.length === 0) && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No candidates found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AllCandidates;