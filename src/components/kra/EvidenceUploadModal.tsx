import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Download, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { uploadEvidenceFile, getEvidenceFileUrl, deleteEvidenceFile } from '@/services/evidenceService';

interface EvidenceFileUI {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadProgress?: number;
  uploaded?: boolean;
  error?: string;
  file?: File; // Store the actual File object
}

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  employeeName: string;
  templateName: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  existingFiles?: EvidenceFileUI[];
  onFilesUploaded?: () => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain'
];

export function EvidenceUploadModal({
  isOpen,
  onClose,
  assignmentId,
  employeeName,
  templateName,
  quarter,
  existingFiles = [],
  onFilesUploaded
}: EvidenceUploadModalProps) {
  const [files, setFiles] = useState<EvidenceFileUI[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Generate folder path: {employee_name}/{template_name}_{quarter}
  const getFolderPath = () => {
    const sanitizedEmployeeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedTemplateName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedEmployeeName}/${sanitizedTemplateName}_${quarter}`;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const totalFiles = files.length + existingFiles.length + acceptedFiles.length;
    
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed per quarter`);
      return;
    }

    const newFiles: EvidenceFileUI[] = acceptedFiles.map(file => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          type: file.type,
          error: 'File size exceeds 10MB limit',
          file
        };
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          type: file.type,
          error: 'File type not supported',
          file
        };
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadProgress: 0,
        uploaded: false,
        file
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length, existingFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'text/plain': ['.txt']
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFiles = async () => {
    const validFiles = files.filter(f => !f.error && f.file);
    if (validFiles.length === 0) {
      toast.error('No valid files to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let uploadedCount = 0;

      for (const fileUI of validFiles) {
        if (!fileUI.file) continue;

        try {
          // Update file progress
          setFiles(prev => prev.map(f => 
            f.id === fileUI.id ? { ...f, uploadProgress: 0 } : f
          ));

          // Upload using the service
          const result = await uploadEvidenceFile({
            assignmentId,
            quarter,
            file: fileUI.file,
            employeeName,
            templateName
          });

          if (result.success) {
            // Update file as uploaded
            setFiles(prev => prev.map(f => 
              f.id === fileUI.id ? { 
                ...f, 
                uploadProgress: 100, 
                uploaded: true, 
                url: result.filePath 
              } : f
            ));
            uploadedCount++;
          } else {
            // Update file with error
            setFiles(prev => prev.map(f => 
              f.id === fileUI.id ? { 
                ...f, 
                error: result.error || 'Upload failed' 
              } : f
            ));
          }

          setUploadProgress((uploadedCount / validFiles.length) * 100);

        } catch (error) {
          console.error(`Error uploading ${fileUI.name}:`, error);
          setFiles(prev => prev.map(f => 
            f.id === fileUI.id ? { 
              ...f, 
              error: error instanceof Error ? error.message : 'Upload failed' 
            } : f
          ));
        }
      }

      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} file(s) uploaded successfully`);
        onFilesUploaded?.();
      }

      if (uploadedCount === validFiles.length) {
        // All files uploaded successfully, close modal
        setTimeout(() => {
          onClose();
          setFiles([]);
        }, 1000);
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('image')) return '🖼️';
    return '📎';
  };

  const canUploadMore = files.length + existingFiles.length < MAX_FILES;
  const validFilesToUpload = files.filter(f => !f.error && !f.uploaded).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Evidence Documents - {quarter}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Upload up to {MAX_FILES} documents as evidence for {quarter}. 
            Files will be stored in: <code className="bg-muted px-1 rounded">{getFolderPath()}</code>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Files */}
          {existingFiles.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Existing Files ({existingFiles.length}/{MAX_FILES})</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {existingFiles.map((file) => (
                  <Card key={file.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getFileIcon(file.type)}</span>
                        <div>
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Uploaded</Badge>
                        {file.url && (
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upload Area */}
          {canUploadMore && (
            <div>
              <Label className="text-sm font-medium">
                Upload New Files ({files.length + existingFiles.length}/{MAX_FILES})
              </Label>
              <div
                {...getRootProps()}
                className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <div className="text-lg font-medium mb-2">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </div>
                <div className="text-sm text-muted-foreground mb-4">
                  or click to browse files
                </div>
                <div className="text-xs text-muted-foreground">
                  Supported: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT (max 10MB each)
                </div>
              </div>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Files to Upload</Label>
              <div className="space-y-2 mt-2">
                {files.map((file) => (
                  <Card key={file.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-lg">{getFileIcon(file.type)}</span>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </div>
                          {file.uploadProgress !== undefined && file.uploadProgress > 0 && (
                            <Progress value={file.uploadProgress} className="mt-1 h-1" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.error && (
                          <div className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">{file.error}</span>
                          </div>
                        )}
                        {file.uploaded && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Uploaded
                          </Badge>
                        )}
                        {!file.uploaded && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file.id)}
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload Progress</Label>
              <Progress value={uploadProgress} className="h-2" />
              <div className="text-xs text-muted-foreground text-center">
                Uploading files... {Math.round(uploadProgress)}%
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {validFilesToUpload > 0 && (
                <span>{validFilesToUpload} file(s) ready to upload</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Close'}
              </Button>
              {validFilesToUpload > 0 && (
                <Button onClick={uploadFiles} disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {validFilesToUpload} File(s)
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
