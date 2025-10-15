import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentRequirements, useUserDocuments, useUploadDocument } from '@/hooks/useLMS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Eye,
  Download,
  User
} from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function DocumentUpload() {
  const { user } = useAuth();
  const { data: requirements, isLoading: requirementsLoading } = useDocumentRequirements();
  const { data: userDocuments, isLoading: documentsLoading } = useUserDocuments();
  const uploadDocument = useUploadDocument();
  
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [uploadingDocuments, setUploadingDocuments] = useState<Set<string>>(new Set());

  const handleFileSelect = (requirementId: string, file: File) => {
    setSelectedFiles(prev => ({
      ...prev,
      [requirementId]: file
    }));
  };

  const handleUpload = async (requirement: any) => {
    const file = selectedFiles[requirement.id];
    if (!file || !user) return;

    setUploadingDocuments(prev => new Set(prev).add(requirement.id));

    try {
      // In a real app, you would upload to Supabase Storage first
      // For demo, we'll simulate the upload
      const mockFileUrl = `https://storage.supabase.co/documents/${user.id}/${file.name}`;
      
      await uploadDocument.mutateAsync({
        user_id: user.id,
        document_requirement_id: requirement.id,
        document_name: file.name,
        document_type: requirement.document_type,
        file_url: mockFileUrl,
        file_size: file.size,
        mime_type: file.type,
      });

      // Clear selected file
      setSelectedFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[requirement.id];
        return newFiles;
      });
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploadingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(requirement.id);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'under_review':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'uploaded':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      under_review: 'bg-blue-100 text-blue-800',
      uploaded: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getDocumentForRequirement = (requirementId: string) => {
    return userDocuments?.find(doc => doc.document_requirement_id === requirementId);
  };

  const totalRequired = requirements?.filter(r => r.is_mandatory).length || 0;
  const approvedRequired = requirements?.filter(r => {
    const doc = getDocumentForRequirement(r.id);
    return r.is_mandatory && doc?.status === 'approved';
  }).length || 0;

  const totalOptional = requirements?.filter(r => !r.is_mandatory).length || 0;
  const approvedOptional = requirements?.filter(r => {
    const doc = getDocumentForRequirement(r.id);
    return !r.is_mandatory && doc?.status === 'approved';
  }).length || 0;

  if (requirementsLoading || documentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Upload</h1>
        <p className="text-muted-foreground">
          Upload required documents for your onboarding and payroll setup
        </p>
      </div>

      {/* Upload Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Required Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{approvedRequired}/{totalRequired}</div>
            <Progress value={totalRequired > 0 ? (approvedRequired / totalRequired) * 100 : 0} className="mb-2" />
            <p className="text-xs text-muted-foreground">Mandatory uploads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Optional Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{approvedOptional}/{totalOptional}</div>
            <Progress value={totalOptional > 0 ? (approvedOptional / totalOptional) * 100 : 0} className="mb-2" />
            <p className="text-xs text-muted-foreground">Additional uploads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {totalRequired > 0 ? Math.round((approvedRequired / totalRequired) * 100) : 0}%
            </div>
            <Progress value={totalRequired > 0 ? (approvedRequired / totalRequired) * 100 : 0} className="mb-2" />
            <p className="text-xs text-muted-foreground">Completion rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Required Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Required Documents
              </CardTitle>
              <CardDescription>
                These documents are mandatory for payroll and compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requirements?.filter(req => req.is_mandatory).map((requirement) => {
                  const existingDoc = getDocumentForRequirement(requirement.id);
                  const selectedFile = selectedFiles[requirement.id];
                  const isUploading = uploadingDocuments.has(requirement.id);
                  
                  return (
                    <div key={requirement.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{requirement.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {requirement.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>Max size: {requirement.max_file_size_mb}MB</span>
                            <span>•</span>
                            <span>Formats: {requirement.file_format_restrictions?.join(', ')}</span>
                          </div>
                        </div>
                        {existingDoc && (
                          <div className="flex items-center gap-2">
                            {getStatusIcon(existingDoc.status)}
                            <Badge className={getStatusBadge(existingDoc.status)}>
                              {existingDoc.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {existingDoc ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{existingDoc.document_name}</span>
                            <span className="text-xs text-muted-foreground">
                              • {formatDateForDisplay(existingDoc.uploaded_at, 'MMM dd, yyyy')}
                            </span>
                          </div>
                          
                          {existingDoc.status === 'rejected' && existingDoc.review_comments && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Rejected:</strong> {existingDoc.review_comments}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {existingDoc.status === 'rejected' && (
                            <div className="space-y-2">
                              <Input
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileSelect(requirement.id, file);
                                }}
                                accept={requirement.file_format_restrictions?.map((f: any) => `.${f}`).join(',')}
                              />
                              {selectedFile && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleUpload(requirement)}
                                  disabled={isUploading}
                                  className="w-full"
                                >
                                  {isUploading ? (
                                    <>
                                      <LoadingSpinner size="sm" className="mr-2" />
                                      Re-uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 mr-2" />
                                      Re-upload Document
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(requirement.id, file);
                            }}
                            accept={requirement.file_format_restrictions?.map((f: any) => `.${f}`).join(',')}
                          />
                          {selectedFile && (
                            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                              <span className="text-sm">{selectedFile.name}</span>
                              <Button 
                                size="sm" 
                                onClick={() => handleUpload(requirement)}
                                disabled={isUploading}
                              >
                                {isUploading ? (
                                  <>
                                    <LoadingSpinner size="sm" className="mr-2" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload
                                  </>
                                )}
                              </Button>
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

          {/* Optional Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Optional Documents
              </CardTitle>
              <CardDescription>
                Additional documents that may be helpful
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requirements?.filter(req => !req.is_mandatory).map((requirement) => {
                  const existingDoc = getDocumentForRequirement(requirement.id);
                  const selectedFile = selectedFiles[requirement.id];
                  const isUploading = uploadingDocuments.has(requirement.id);
                  
                  return (
                    <div key={requirement.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{requirement.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {requirement.description}
                          </p>
                        </div>
                        {existingDoc && (
                          <Badge className={getStatusBadge(existingDoc.status)}>
                            {existingDoc.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>

                      {existingDoc ? (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{existingDoc.document_name}</span>
                          <span className="text-xs text-muted-foreground">
                            • {formatDateForDisplay(existingDoc.uploaded_at, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(requirement.id, file);
                            }}
                            accept={requirement.file_format_restrictions?.map((f: any) => `.${f}`).join(',')}
                          />
                          {selectedFile && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpload(requirement)}
                              disabled={isUploading}
                              className="w-full"
                            >
                              {isUploading ? (
                                <>
                                  <LoadingSpinner size="sm" className="mr-2" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Document
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Upload History</CardTitle>
              <CardDescription>
                All your uploaded documents and their review status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userDocuments && userDocuments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userDocuments.map((document: any) => (
                      <TableRow key={document.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{document.document_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {document.requirement?.name || 'Custom upload'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{document.document_type}</Badge>
                          {document.requirement?.is_mandatory && (
                            <Badge variant="outline" className="ml-1 text-red-600 border-red-200">
                              Required
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(document.status)}
                            <Badge className={getStatusBadge(document.status)}>
                              {document.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateForDisplay(document.uploaded_at, 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          {document.reviewed_by_user ? (
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span className="text-sm">{document.reviewed_by_user.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Pending review</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {document.file_url && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Documents Uploaded</h3>
                  <p className="text-muted-foreground">
                    Start by uploading your required documents in the Upload tab
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}