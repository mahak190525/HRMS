import React, { useState, useEffect } from 'react';
import { 
  Save, 
  X, 
  Eye, 
  EyeOff
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { PolicySimpleEditor } from '../ui/policy-simple-editor';
import { cn } from '../../lib/utils';
import type { Policy, PolicyFormData } from '../../types';

interface PolicyEditorProps {
  policy?: Policy | null;
  onSave: (data: PolicyFormData) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

export const PolicyEditor: React.FC<PolicyEditorProps> = ({
  policy,
  onSave,
  onCancel,
  className
}) => {
  const [formData, setFormData] = useState<PolicyFormData>({
    name: '',
    content: '',
    is_active: true
  });
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Initialize form data
  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name,
        content: policy.content,
        is_active: true // Always active since policies are only active or deleted
      });
      setIsDirty(false);
    } else {
      setFormData({
        name: '',
        content: '',
        is_active: true
      });
      // Set isDirty to true for new policy creation to show the editor
      setIsDirty(true);
    }
    setErrors({});
  }, [policy]);

  const handleFieldChange = (field: keyof PolicyFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Policy name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Policy name must be at least 3 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Policy content is required';
    } else if (formData.content.length < 50) {
      newErrors.content = 'Policy content must be at least 50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave(formData);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save policy:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };


  if (!policy && !formData.name && !isDirty) {
    return (
      <div className={cn("flex-1 flex items-center justify-center bg-gray-50", className)}>
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a policy to view or edit
          </h3>
          <p className="text-gray-500">
            Choose a policy from the sidebar or create a new one to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col bg-white overflow-hidden", className)}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {policy ? 'Edit Policy' : 'New Policy'}
              </h2>
              {policy && (
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="default">
                    Active
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Version {policy.version}
                  </span>
                  <span className="text-sm text-gray-500">
                    Last updated {new Date(policy.updated_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
            >
              {isPreviewMode ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </>
              )}
            </Button>
            
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              size="sm"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* {isDirty && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have unsaved changes. Don't forget to save your work.
            </AlertDescription>
          </Alert>
        )} */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full flex flex-col px-6 py-4 max-h-full">
          {isPreviewMode ? (
            <div className="h-full flex flex-col">
              <div className="mb-4 p-4 bg-blue-50 rounded-lg flex-shrink-0">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">
                  {formData.name || 'Untitled Policy'}
                </h2>
              </div>
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        <PolicySimpleEditor
                          content={formData.content}
                          onChange={() => {}} // Read-only in preview
                          editable={false}
                        />
                      </div>
                    </ScrollArea>
                  </div>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-4 min-h-0 max-h-full">
              <div className="flex-shrink-0">
                <Label htmlFor="name" className='mb-2'>Policy Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Enter policy name..."
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>
              
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <Label className="flex-shrink-0 mb-2">Policy Content *</Label>
                <div className="flex-1 border rounded-lg overflow-hidden min-h-0 relative">
                  <PolicySimpleEditor
                    content={formData.content}
                    onChange={(content) => handleFieldChange('content', content)}
                    placeholder="Start writing your policy content..."
                    stickyToolbar={true}
                    className={cn(
                      "absolute inset-0 w-full h-full overflow-y-auto",
                      errors.content ? 'border-red-500' : ''
                    )}
                  />
                </div>
                {errors.content && (
                  <p className="text-red-500 text-xs mt-1 flex-shrink-0">{errors.content}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PolicyEditor;
