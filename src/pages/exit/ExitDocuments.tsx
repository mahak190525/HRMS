import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useExitProcess } from '@/hooks/useExit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Mock exit documents data
const mockExitDocuments = [
  {
    id: '1',
    document_type: 'experience_letter',
    document_name: 'Experience Letter',
    description: 'Official experience certificate for your tenure',
    status: 'generated',
    file_url: 'https://example.com/experience-letter.pdf',
    generated_at: getCurrentISTDate().toISOString(),
    is_required: true,
  },
  {
    id: '2',
    document_type: 'relieving_letter',
    document_name: 'Relieving Letter',
    description: 'Official relieving letter confirming your last working day',
    status: 'pending',
    file_url: null,
    generated_at: null,
    is_required: true,
  },
  {
    id: '3',
    document_type: 'salary_certificate',
    document_name: 'Salary Certificate',
    description: 'Certificate showing your last drawn salary',
    status: 'generated',
    file_url: 'https://example.com/salary-certificate.pdf',
    generated_at: getCurrentISTDate().toISOString(),
    is_required: true,
  },
  {
    id: '4',
    document_type: 'pf_transfer',
    document_name: 'PF Transfer Form',
    description: 'Provident Fund transfer documentation',
    status: 'pending',
    file_url: null,
    generated_at: null,
    is_required: true,
  },
  {
    id: '5',
    document_type: 'final_settlement',
    document_name: 'Final Settlement Statement',
    description: 'Complete breakdown of final settlement amount',
    status: 'pending',
    file_url: null,
    generated_at: null,
    is_required: true,
  },
  {
    id: '6',
    document_type: 'recommendation_letter',
    document_name: 'Recommendation Letter',
    description: 'Optional recommendation letter from your manager',
    status: 'pending',
    file_url: null,
    generated_at: null,
    is_required: false,
  },
];

export function ExitDocuments() {
  const { user } = useAuth();
  const { data: exitProcess, isLoading: exitProcessLoading } = useExitProcess();
  // Removed unused selectedDocument and isHR variables

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generated':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'sent':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'acknowledged':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      generated: 'bg-green-100 text-green-800',
      sent: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleDownload = (document: any) => {
    if (document.file_url) {
      // In a real app, this would trigger actual file download
      window.open(document.file_url, '_blank');
    }
  };

  const requiredDocuments = mockExitDocuments.filter(doc => doc.is_required);
  const optionalDocuments = mockExitDocuments.filter(doc => !doc.is_required);
  const completedRequired = requiredDocuments.filter(doc => doc.status === 'generated').length;
  const totalRequired = requiredDocuments.length;

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
          <h1 className="text-3xl font-bold tracking-tight">Exit Documents</h1>
          <p className="text-muted-foreground">
            Download your exit and transition documents
          </p>
        </div>

        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Exit Process</h3>
            <p className="text-muted-foreground">
              Exit documents will be available when you have an active exit process.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exit Documents</h1>
        <p className="text-muted-foreground">
          Download your official exit documents and certificates
        </p>
      </div>

      {/* Document Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Required Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{completedRequired}/{totalRequired}</div>
            <Progress value={(completedRequired / totalRequired) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">Ready for download</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Optional Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {optionalDocuments.filter(doc => doc.status === 'generated').length}/{optionalDocuments.length}
            </div>
            <Progress value={(optionalDocuments.filter(doc => doc.status === 'generated').length / optionalDocuments.length) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">Additional documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {Math.round((completedRequired / totalRequired) * 100)}%
            </div>
            <Progress value={(completedRequired / totalRequired) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">Documents ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Important Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> Some documents will only be generated after completing your clearance checklist. 
          Please ensure all clearance items are completed to receive all required documents.
        </AlertDescription>
      </Alert>

      {/* Required Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-600" />
            Required Documents
          </CardTitle>
          <CardDescription>
            Essential documents for your next employment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requiredDocuments.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{document.document_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{document.description}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(document.status)}
                      <Badge className={getStatusBadge(document.status)}>
                        {document.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {document.generated_at ? (
                      formatDateForDisplay(document.generated_at, 'MMM dd, yyyy')
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {document.file_url ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleDownload(document)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          <Clock className="h-4 w-4 mr-1" />
                          Pending
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Optional Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Optional Documents
          </CardTitle>
          <CardDescription>
            Additional documents that may be helpful for your career
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optionalDocuments.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{document.document_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{document.description}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(document.status)}
                      <Badge className={getStatusBadge(document.status)}>
                        {document.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {document.file_url ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleDownload(document)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          <Clock className="h-4 w-4 mr-1" />
                          Pending
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Document Information */}
      <Card>
        <CardHeader>
          <CardTitle>Document Information</CardTitle>
          <CardDescription>Important notes about your exit documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Document Generation Timeline:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Experience Letter: Available immediately after resignation approval</li>
                <li>• Salary Certificate: Generated within 2 business days</li>
                <li>• Relieving Letter: Available on your last working day</li>
                <li>• Final Settlement: Generated after clearance completion</li>
                <li>• PF Transfer: Processed within 7 business days after exit</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Document Usage:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• All documents are digitally signed and legally valid</li>
                <li>• Use these documents for background verification at new companies</li>
                <li>• Keep copies for your personal records</li>
                <li>• Contact HR if you need additional copies in the future</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Support:</h4>
              <p className="text-muted-foreground">
                If you have any questions about your documents or need assistance, 
                please contact HR at hr@company.com or call +1 (555) 123-4567.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}