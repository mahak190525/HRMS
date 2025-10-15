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
  Eye
} from 'lucide-react';

interface IncidentsViewProps {
  employee: any;
  employeeIncidents: any[];
  createIncident: any;
  updateIncident: any;
  deleteIncident: any;
  uploadIncidentAttachment: any;
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

  const handleFileUpload = async (incidentId: string, file: File, incidentTitle: string) => {
    setUploadingFiles(prev => ({ ...prev, [incidentId]: true }));
    try {
      await uploadIncidentAttachment.mutateAsync({
        incidentId,
        file,
        employeeId: employee.id,
        incidentTitle
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [incidentId]: false }));
    }
  };

  const handleRemoveAttachment = async (incidentId: string) => {
    if (!confirm('Are you sure you want to remove this attachment?')) {
      return;
    }

    try {
      await removeIncidentAttachment.mutateAsync({
        incidentId,
        employeeId: employee.id
      });
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
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
                    <p className="text-sm font-medium text-gray-700 mb-2">Attachment:</p>
                    {incident.attachment_file_url ? (
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
                        {permissions.canManageAccess && mode === 'edit' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAttachment(incident.id)}
                            className="flex items-center gap-2 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </Button>
                        )}
                        {incident.attachment_file_size && (
                          <span className="text-xs text-gray-500">
                            ({(incident.attachment_file_size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        )}
                      </div>
                    ) : (
                      permissions.canManageAccess && mode === 'edit' && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(incident.id, file, incident.title);
                              }
                            }}
                            disabled={uploadingFiles[incident.id]}
                            className="max-w-xs"
                          />
                          {uploadingFiles[incident.id] && (
                            <LoadingSpinner />
                          )}
                        </div>
                      )
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
