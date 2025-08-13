import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Download,
  Upload,
  Calendar,
  DollarSign,
  Target,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

const availableDocuments = [
  {
    id: 1,
    name: 'Salary Slip - December 2024',
    type: 'salary_slip',
    category: 'Payroll',
    date: '2024-12-31',
    size: '245 KB',
    status: 'available',
    icon: DollarSign,
    color: 'text-green-600'
  },
  {
    id: 2,
    name: 'Attendance Report - Q4 2024',
    type: 'attendance_report',
    category: 'Attendance',
    date: '2024-12-31',
    size: '156 KB',
    status: 'available',
    icon: Clock,
    color: 'text-blue-600'
  },
  {
    id: 3,
    name: 'Performance Review - 2024',
    type: 'performance_report',
    category: 'Performance',
    date: '2024-12-15',
    size: '892 KB',
    status: 'available',
    icon: BarChart3,
    color: 'text-purple-600'
  },
  {
    id: 4,
    name: 'Goal Sheet - Q4 2024',
    type: 'goal_sheet',
    category: 'Performance',
    date: '2024-10-01',
    size: '324 KB',
    status: 'available',
    icon: Target,
    color: 'text-orange-600'
  },
  {
    id: 5,
    name: 'Annual Evaluation Report - 2024',
    type: 'evaluation_report',
    category: 'Performance',
    date: '2024-12-20',
    size: '1.2 MB',
    status: 'processing',
    icon: FileText,
    color: 'text-indigo-600'
  },
  {
    id: 6,
    name: 'Tax Declaration Form - 2024',
    type: 'tax_form',
    category: 'Tax',
    date: '2024-03-31',
    size: '445 KB',
    status: 'available',
    icon: FileText,
    color: 'text-red-600'
  }
];

const uploadRequests = [
  {
    id: 1,
    title: 'Updated Resume',
    description: 'Please upload your latest resume for the annual review process',
    requestedBy: 'HR Department',
    dueDate: '2025-01-15',
    status: 'pending',
    priority: 'medium'
  },
  {
    id: 2,
    title: 'Training Certificates',
    description: 'Upload certificates from completed training programs in Q4 2024',
    requestedBy: 'Learning & Development',
    dueDate: '2025-01-10',
    status: 'pending',
    priority: 'high'
  },
  {
    id: 3,
    title: 'Medical Insurance Documents',
    description: 'Submit updated medical insurance beneficiary information',
    requestedBy: 'Benefits Team',
    dueDate: '2025-01-20',
    status: 'completed',
    priority: 'low'
  }
];

const recentUploads = [
  {
    id: 1,
    name: 'Profile_Photo_2024.jpg',
    uploadedAt: '2024-12-28',
    size: '2.1 MB',
    status: 'approved'
  },
  {
    id: 2,
    name: 'Emergency_Contact_Form.pdf',
    uploadedAt: '2024-12-25',
    size: '156 KB',
    status: 'under_review'
  },
  {
    id: 3,
    name: 'Bank_Details_Update.pdf',
    uploadedAt: '2024-12-20',
    size: '89 KB',
    status: 'approved'
  }
];

export function Documents() {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleDownload = (document: any) => {
    // Simulate download
    console.log('Downloading:', document.name);
    // In real implementation, this would trigger actual file download
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles || !uploadCategory) return;

    setIsUploading(true);
    try {
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reset form
      setSelectedFiles(null);
      setUploadCategory('');
      
      alert('Files uploaded successfully!');
    } catch (error) {
      alert('Upload failed. Please try again.');
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

  const getPriorityBadge = (priority: string) => {
    const variants = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return variants[priority as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Download your documents and upload requested files
        </p>
      </div>

      <Tabs defaultValue="download" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="download">Download Documents</TabsTrigger>
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="requests">Upload Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="download" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableDocuments.map((doc) => {
              const IconComponent = doc.icon;
              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg bg-gray-50 ${doc.color}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <Badge className={getStatusBadge(doc.status)}>
                        {doc.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">{doc.name}</h3>
                    <div className="space-y-1 text-xs text-muted-foreground mb-4">
                      <p>Category: {doc.category}</p>
                      <p>Date: {format(new Date(doc.date), 'MMM dd, yyyy')}</p>
                      <p>Size: {doc.size}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleDownload(doc)}
                        disabled={doc.status !== 'available'}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="category">Document Category</Label>
                    <select
                      id="category"
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      <option value="personal">Personal Documents</option>
                      <option value="professional">Professional Documents</option>
                      <option value="certificates">Certificates</option>
                      <option value="medical">Medical Documents</option>
                      <option value="tax">Tax Documents</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="files">Select Files</Label>
                    <Input
                      id="files"
                      type="file"
                      multiple
                      onChange={(e) => setSelectedFiles(e.target.files)}
                      className="mt-1"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!selectedFiles || !uploadCategory || isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Documents'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Uploads</CardTitle>
                <CardDescription>Your recently uploaded documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentUploads.map((upload) => (
                    <div key={upload.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{upload.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(upload.uploadedAt), 'MMM dd, yyyy')} • {upload.size}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusBadge(upload.status)}>
                        {upload.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
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
                Documents requested by various departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {uploadRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{request.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {request.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityBadge(request.priority)}>
                          {request.priority}
                        </Badge>
                        <Badge className={getStatusBadge(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Requested by: {request.requestedBy}</span>
                      <span>Due: {format(new Date(request.dueDate), 'MMM dd, yyyy')}</span>
                    </div>

                    {request.status === 'pending' && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex gap-2">
                          <Input type="file" className="flex-1" />
                          <Button size="sm">
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                    )}

                    {request.status === 'completed' && (
                      <Alert className="mt-3">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Document uploaded successfully and approved.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}