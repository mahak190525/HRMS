import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Eye, 
  Edit, 
  Copy, 
  Users, 
  Calendar,
  Target,
  FileText,
  Trash2
} from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { KRATemplate } from '@/hooks/useKRA'
import { useDeleteKRATemplate, useCopyKRATemplate } from '@/hooks/useKRA';
import type { KRAPermissions } from '@/hooks/useKRAPermissions';
import { toast } from 'sonner';

interface KRATemplateManagerProps {
  templates: KRATemplate[];
  isLoading: boolean;
  permissions: KRAPermissions;
}

export function KRATemplateManager({ templates, isLoading, permissions }: KRATemplateManagerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<KRATemplate | null>(null);
  
  const deleteTemplateMutation = useDeleteKRATemplate();
  const copyTemplateMutation = useCopyKRATemplate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateTemplate = () => {
    navigate('/performance/kra/template/new?mode=create');
  };

  const handleViewTemplate = (template: KRATemplate) => {
    navigate(`/performance/kra/template/${template.id}?mode=view`);
  };

  const handleEditTemplate = (template: KRATemplate) => {
    navigate(`/performance/kra/template/${template.id}?mode=edit`);
  };

  const handleCopyTemplate = async (template: KRATemplate) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      const newTemplate = await copyTemplateMutation.mutateAsync({ 
        templateId: template.id, 
        currentUserId: user.id 
      });
      toast.success(`Template "${template.template_name}" copied successfully as "${newTemplate.template_name}"`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to copy template');
      console.error('Copy failed:', error);
    }
  };

  const handleDeleteTemplate = (template: KRATemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      const result = await deleteTemplateMutation.mutateAsync(templateToDelete.id);
      if (result.archived) {
        toast.success('Template archived successfully (it had assignments and could not be deleted)');
      } else {
        toast.success('Template deleted successfully');
      }
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete template');
      console.error('Delete failed:', error);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">KRA Templates</h2>
          <p className="text-muted-foreground">
            Create and manage KRA templates with quarterly due dates for your team
          </p>
        </div>
        {permissions.canCreateTemplates && (
          <Button onClick={handleCreateTemplate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
              Create Template
            </Button>
          )}
      </div>

      {/* Templates Grid */}
      {templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg line-clamp-2">
                      {template.template_name}
                    </CardTitle>
                    <Badge className={getStatusColor(template.status)}>
                      {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                {template.description && (
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Template Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Goals:</span>
                    <span className="font-medium">{template.goals?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Period:</span>
                    <span className="font-medium text-xs">
                      {formatDateForDisplay(template.evaluation_period_start, 'MMM')} - {formatDateForDisplay(template.evaluation_period_end, 'MMM yyyy')}
                    </span>
                  </div>
                </div>

                {/* Template Details */}
                <div className="text-xs text-muted-foreground">
                  <div>Created: {formatDateForDisplay(template.created_at)}</div>
                  <div>By: {template.created_by_user?.full_name || 'Unknown'}</div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTemplate(template)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                    
                    {permissions.canCreateTemplates && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyTemplate(template)}
                          disabled={copyTemplateMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          {copyTemplateMutation.isPending ? 'Copying...' : 'Copy'}
                        </Button>
                        
                    <Button
                          variant="ghost"
                      size="sm"
                          onClick={() => handleDeleteTemplate(template)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                    </Button>
                      </>
                  )}
                  </div>

                  {template.status === 'active' && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/performance/kra/template/${template.id}?mode=view&action=publish`)}
                      className="flex items-center gap-1"
                    >
                      <Users className="h-3 w-3" />
                      Publish
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {permissions.canCreateTemplates
                ? 'Get started by creating your first KRA template with quarterly evaluation schedules.'
                : 'No KRA templates have been created yet. Contact your manager or HR to create templates.'
              }
            </p>
            {permissions.canCreateTemplates && (
              <Button onClick={handleCreateTemplate} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Template
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template "{templateToDelete?.template_name}"?
            </AlertDialogDescription>
            {templateToDelete && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <strong>Note:</strong> If this template has been assigned to employees, it will be archived instead of deleted to preserve data integrity.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTemplateMutation.isPending}
            >
              {deleteTemplateMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}