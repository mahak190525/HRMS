import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Eye,
  Archive
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  useEmployeeDocuments, 
  useDocumentTypes, 
  useUploadEmployeeDocument,
  useDownloadAllDocuments
} from '@/hooks/useEmployeeDocuments';
import type { EmployeeDocument, EmployeeDocumentType } from '@/services/employeeDocumentService';

export function Documents() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('download');

  // Fetch employee documents from database
  const { data: employeeDocuments, isLoading: documentsLoading, error: documentsError } = useEmployeeDocuments(user?.id || '');
  
  // Fetch document types from database
  const { data: documentTypes, isLoading: typesLoading } = useDocumentTypes(user?.id);
  
  // Upload mutation
  const uploadMutation = useUploadEmployeeDocument();
  
  // Download all mutation
  const downloadAllMutation = useDownloadAllDocuments();

  // Handle URL tab parameter (for notification redirects)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['download', 'upload', 'requests'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Separate uploaded documents and available document types for uploading
  const uploadedDocuments = employeeDocuments?.filter(doc => doc.status === 'uploaded') || [];
  const availableForUpload = documentTypes?.filter(docType => {
    // Show only document types that haven't been uploaded yet
    return !employeeDocuments?.some(doc => doc.document_type_id === docType.id && doc.status === 'uploaded');
  }) || [];
  const requestedDocuments = employeeDocuments?.filter(doc => doc.status === 'requested') || [];

  const handleDownload = (document: EmployeeDocument) => {
    if (document.file_url) {
      // Open file in new tab for download
      window.open(document.file_url, '_blank');
    }
  };

  const handleView = (document: EmployeeDocument) => {
    if (document.file_url) {
      // Open file in new tab for viewing
      window.open(document.file_url, '_blank');
    }
  };

  const handleDownloadAll = async () => {
    if (!user?.id) return;
    
    try {
      await downloadAllMutation.mutateAsync({ employeeId: user.id });
    } catch (error) {
      console.error('Download all error:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedDocumentTypeId || !user?.id) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        employeeId: user.id,
        documentTypeId: selectedDocumentTypeId,
        uploadedBy: user.id
      });
      
      // Reset form
      setSelectedFile(null);
      setSelectedDocumentTypeId('');
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      available: 'bg-green-100 text-green-800',
      processing: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      under_review: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Download your documents and upload requested files
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="download">Download Documents</TabsTrigger>
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="requests">Upload Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="download" className="space-y-6">
          {documentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : documentsError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-red-700">Error Loading Documents</h3>
              <p className="text-muted-foreground">
                Failed to load your documents. Please try refreshing the page.
              </p>
            </div>
          ) : uploadedDocuments && uploadedDocuments.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  {uploadedDocuments.length} document{uploadedDocuments.length !== 1 ? 's' : ''} available
                </p>
                <Button
                  onClick={handleDownloadAll}
                  disabled={downloadAllMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Archive className="h-4 w-4" />
                  {downloadAllMutation.isPending ? 'Preparing Download...' : 'Download All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {uploadedDocuments.map((doc: EmployeeDocument) => {
                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <Badge className={getStatusBadge(doc.status)}>
                          {doc.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2" title={doc.document_name}>
                        {doc.document_name}
                      </h3>
                      <div className="space-y-1 text-xs text-muted-foreground mb-4">
                        <p>Category: {doc.document_type?.category || 'Unknown'}</p>
                        <p>Uploaded: {format(new Date(doc.updated_at), 'MMM dd, yyyy')}</p>
                        {doc.file_size && (
                          <p>Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
                        )}
                        {doc.uploaded_by_user?.full_name && (
                          <p>By: {doc.uploaded_by_user.full_name}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleDownload(doc)}
                          disabled={!doc.file_url}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleView(doc)}
                          disabled={!doc.file_url}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Documents Uploaded</h3>
              <p className="text-muted-foreground">
                Your uploaded documents will appear here. Use the Upload Documents tab to upload required documents.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload documents as requested by HR or for your records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : availableForUpload.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-semibold">All Documents Uploaded</h4>
                    <p className="text-sm text-muted-foreground">
                      You have uploaded all required documents.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div>
                      <Label htmlFor="documentType">Document Type</Label>
                      <Select 
                        value={selectedDocumentTypeId} 
                        onValueChange={setSelectedDocumentTypeId}
                        required
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableForUpload.map((docType: EmployeeDocumentType) => (
                            <SelectItem key={docType.id} value={docType.id}>
                              {docType.name} {docType.is_mandatory ? '(Required)' : '(Optional)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Only documents that haven't been uploaded yet are shown
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="file">Select File</Label>
                      <Input
                        id="file"
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="mt-1"
                        accept=".pdf"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported format: PDF only (Max 10MB)
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={!selectedFile || !selectedDocumentTypeId || isUploading || uploadMutation.isPending}
                    >
                      {isUploading || uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Uploads</CardTitle>
                <CardDescription>Your recently uploaded documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadedDocuments.length === 0 ? (
                    <div className="text-center py-6">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No documents uploaded yet
                      </p>
                    </div>
                  ) : (
                    uploadedDocuments.slice(0, 5).map((upload) => (
                      <div key={upload.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium line-clamp-1" title={upload.document_name}>
                              {upload.document_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(upload.updated_at), 'MMM dd, yyyy')}
                              {upload.file_size && ` • ${(upload.file_size / 1024 / 1024).toFixed(1)} MB`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusBadge(upload.status)}>
                            {upload.status}
                          </Badge>
                          {upload.file_url && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleView(upload)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Upload Requests</CardTitle>
              <CardDescription>
                Documents requested by HR or management
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <LoadingSpinner size="sm" />
              ) : requestedDocuments && requestedDocuments.length > 0 ? (
                <div className="space-y-4">
                  {requestedDocuments.map((request: EmployeeDocument) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{request.document_name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Category: {request.document_type?.category}
                            {request.document_type?.is_mandatory && ' (Required)'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {request.document_type?.is_mandatory && (
                            <Badge className="bg-red-100 text-red-800">
                              Required
                            </Badge>
                          )}
                          <Badge className={getStatusBadge(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          Requested by: {request.requested_by_user?.full_name || 'System'}
                        </span>
                        <span>
                          Requested: {format(new Date(request.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            This document is pending upload. Please use the Upload Documents tab to upload this required document.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <h4 className="font-semibold">No Pending Requests</h4>
                  <p className="text-sm text-muted-foreground">
                    You have no pending document upload requests at this time.
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