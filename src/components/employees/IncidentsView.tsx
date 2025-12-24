import { useState } from 'react';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Download,
  Trash2,
  Plus,
  Eye,
  Upload,
  X,
  FileText,
  Image,
  File
} from 'lucide-react';

interface IncidentsViewProps {
  employee: any;
  employeeIncidents: any[];
  createIncident: any;
  updateIncident: any;
  deleteIncident: any;
  uploadIncidentAttachment: any;
  uploadIncidentAttachments?: any;
  removeIncidentAttachment: any;
  permissions: any;
  mode: 'view' | 'edit';
}

export function IncidentsView({ 
  employee,
  employeeIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  uploadIncidentAttachment,
  uploadIncidentAttachments,
  removeIncidentAttachment,
  permissions,
  mode
}: IncidentsViewProps) {
  const { user } = useAuth();
  const [newIncident, setNewIncident] = useState({
    title: '',
    incident_date: '',
    comments: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, any>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});

  const handleAddIncident = async () => {
    if (!newIncident.title.trim() || !newIncident.incident_date) {
      toast.error('Title and incident date are required');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      await createIncident.mutateAsync({
        employee_id: employee.id,
        title: newIncident.title.trim(),
        incident_date: newIncident.incident_date,
        comments: newIncident.comments.trim() || undefined,
        created_by: user.id
      });
      setNewIncident({
        title: '',
        incident_date: '',
        comments: ''
      });
    } catch (error) {
      console.error('Failed to add incident:', error);
    }
  };

  const handleUpdateIncident = async (id: string) => {
    try {
      await updateIncident.mutateAsync({
        id,
        incidentData: editingData,
        employeeId: employee.id
      });
      setEditingId(null);
      setEditingData({});
    } catch (error) {
      console.error('Failed to update incident:', error);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!confirm('Are you sure you want to delete this incident record?')) {
      return;
    }

    try {
      await deleteIncident.mutateAsync({
        id,
        employeeId: employee.id
      });
    } catch (error) {
      console.error('Failed to delete incident:', error);
    }
  };

  const handleFileSelect = (incidentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const existingAttachments = employeeIncidents.find(inc => inc.id === incidentId)?.attachments?.length || 0;
    const currentSelected = selectedFiles[incidentId]?.length || 0;
    const totalFiles = existingAttachments + currentSelected + fileArray.length;

    if (totalFiles > 10) {
      toast.error(`Cannot select ${fileArray.length} files. Maximum 10 attachments per incident (${existingAttachments + currentSelected} already selected/uploaded)`);
      return;
    }

    // Validate file sizes (10MB limit per file)
    const maxSize = 10 * 1024 * 1024; // 10MB
    for (const file of fileArray) {
      if (file.size > maxSize) {
        toast.error(`File "${file.name}" is too large. Maximum size is 10MB`);
        return;
      }
    }

    setSelectedFiles(prev => ({
      ...prev,
      [incidentId]: [...(prev[incidentId] || []), ...fileArray]
    }));
  };

  const handleRemoveSelectedFile = (incidentId: string, fileIndex: number) => {
    setSelectedFiles(prev => ({
      ...prev,
      [incidentId]: prev[incidentId]?.filter((_, index) => index !== fileIndex) || []
    }));
  };

  const handleFileUpload = async (incidentId: string, incidentTitle: string) => {
    const files = selectedFiles[incidentId];
    if (!files || files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [incidentId]: true }));
    try {
      if (uploadIncidentAttachments) {
        await uploadIncidentAttachments.mutateAsync({
          incidentId,
          files,
          employeeId: employee.id,
          incidentTitle,
          uploadedBy: user.id
        });
      } else {
        // Fallback to single file upload for backward compatibility
        for (const file of files) {
          await uploadIncidentAttachment.mutateAsync({
            incidentId,
            file,
            employeeId: employee.id,
            incidentTitle,
            uploadedBy: user.id
          });
        }
      }
      // Clear selected files after successful upload
      setSelectedFiles(prev => ({ ...prev, [incidentId]: [] }));
    } catch (error) {
      console.error('Failed to upload attachments:', error);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [incidentId]: false }));
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to remove this attachment?')) {
      return;
    }

    try {
      await removeIncidentAttachment.mutateAsync({
        attachmentId,
        employeeId: employee.id
      });
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="pb-4">
      <h3 className="text-lg font-semibold mb-4">Employee Incidents</h3>
      
      {/* Add New Incident - Only in Edit Mode and with permissions */}
      {permissions.canManageAccess && mode === 'edit' && (
        <Card className="p-4 mb-4 bg-orange-50">
          <h4 className="font-medium mb-3">Report New Incident</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Incident Title"
                value={newIncident.title}
                onChange={(e) => setNewIncident(prev => ({ ...prev, title: e.target.value }))}
              />
              <Input
                type="date"
                value={newIncident.incident_date}
                onChange={(e) => setNewIncident(prev => ({ ...prev, incident_date: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Comments (optional)"
              value={newIncident.comments}
              onChange={(e) => setNewIncident(prev => ({ ...prev, comments: e.target.value }))}
              className="min-h-[80px]"
            />
            <Button 
              onClick={handleAddIncident}
              disabled={createIncident.isPending || !newIncident.title.trim() || !newIncident.incident_date}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {createIncident.isPending ? 'Adding...' : 'Add Incident'}
            </Button>
          </div>
        </Card>
      )}

      {/* Existing Incidents */}
      <div className="space-y-4">
        {employeeIncidents && employeeIncidents.length > 0 ? (
          employeeIncidents.map((incident: any) => (
            <Card key={incident.id} className="p-4">
              {editingId === incident.id && mode === 'edit' && permissions.canManageAccess ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={editingData.title || incident.title}
                      onChange={(e) => setEditingData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Incident Title"
                    />
                    <Input
                      type="date"
                      value={editingData.incident_date || incident.incident_date}
                      onChange={(e) => setEditingData(prev => ({ ...prev, incident_date: e.target.value }))}
                    />
                  </div>
                  <Textarea
                    value={editingData.comments || incident.comments || ''}
                    onChange={(e) => setEditingData(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Comments"
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleUpdateIncident(incident.id)}
                      disabled={updateIncident.isPending}
                      size="sm"
                    >
                      {updateIncident.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingId(null);
                        setEditingData({});
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-lg">{incident.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {formatDateForDisplay(incident.incident_date, 'MMM dd, yyyy')}
                      </Badge>
                      {permissions.canManageAccess && mode === 'edit' && (
                        <>
                          <Button
                            onClick={() => {
                              setEditingId(incident.id);
                              setEditingData({});
                            }}
                            variant="outline"
                            size="sm"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeleteIncident(incident.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {incident.comments && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Comments:</p>
                      <p className="text-sm text-gray-600">{incident.comments}</p>
                    </div>
                  )}

                  {/* File Upload/Management */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Attachments ({(incident.attachments?.length || 0) + (selectedFiles[incident.id]?.length || 0)}/10):
                    </p>
                    
                    {/* Existing Attachments */}
                    {incident.attachments && incident.attachments.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {incident.attachments.map((attachment: any) => (
                          <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getFileIcon(attachment.mime_type)}
                              <span className="text-sm font-medium truncate max-w-xs">
                                {attachment.file_name.replace(/^incident_\d+_\d+_/, '')}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({formatFileSize(attachment.file_size)})
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(attachment.file_url, '_blank')}
                                className="h-8 w-8 p-0"
                                title="View"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = attachment.file_url;
                                  link.download = attachment.file_name;
                                  link.click();
                                }}
                                className="h-8 w-8 p-0"
                                title="Download"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              {permissions.canManageAccess && mode === 'edit' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAttachment(attachment.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  title="Remove"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Files Preview */}
                    {selectedFiles[incident.id] && selectedFiles[incident.id].length > 0 && (
                      <div className="space-y-2 mb-3">
                        <p className="text-xs text-gray-600">Selected files:</p>
                        {selectedFiles[incident.id].map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getFileIcon(file.type)}
                              <span className="text-sm font-medium truncate max-w-xs">
                                {file.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSelectedFile(incident.id, index)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* File Upload Controls */}
                    {permissions.canManageAccess && mode === 'edit' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            multiple
                            onChange={(e) => handleFileSelect(incident.id, e.target.files)}
                            disabled={uploadingFiles[incident.id]}
                            className="max-w-xs"
                            title="Select multiple files (Max 10MB each, 10 files total)"
                          />
                          {selectedFiles[incident.id] && selectedFiles[incident.id].length > 0 && (
                            <Button
                              onClick={() => handleFileUpload(incident.id, incident.title)}
                              disabled={uploadingFiles[incident.id]}
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              {uploadingFiles[incident.id] ? (
                                <>
                                  <LoadingSpinner size="sm" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3 w-3" />
                                  Upload ({selectedFiles[incident.id].length})
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Select up to {10 - (incident.attachments?.length || 0)} more files (any type, max 10MB each)
                        </p>
                      </div>
                    )}

                    {/* Legacy single attachment support */}
                    {incident.attachment_file_url && !incident.attachments && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(incident.attachment_file_url, '_blank')}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = incident.attachment_file_url!;
                            link.download = incident.attachment_file_name || 'attachment';
                            link.click();
                          }}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                        {incident.attachment_file_size && (
                          <span className="text-xs text-gray-500">
                            ({(incident.attachment_file_size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500">
                    Created on {formatDateForDisplay(incident.created_at, 'MMM dd, yyyy')}
                    {incident.created_by_user && (
                      <span> by {incident.created_by_user.full_name}</span>
                    )}
                    {incident.updated_at !== incident.created_at && (
                      <span> • Updated on {formatDateForDisplay(incident.updated_at, 'MMM dd, yyyy')}</span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">No incident records found.</p>
            {!permissions.canManageAccess && (
              <p className="text-xs text-gray-500 mt-1">Only HR and managers can add incident reports.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
