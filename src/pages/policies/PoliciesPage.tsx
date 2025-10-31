import React, { useState } from 'react';
import { 
  FileText, 
  Settings, 
  Shield,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { toast } from 'sonner';
import { PolicySidebar } from '../../components/policies/PolicySidebar';
import { PolicyEditor } from '../../components/policies/PolicyEditor';
import { PolicyPermissionsManager } from '../../components/policies/PolicyPermissionsManager';
import type { Policy, PolicyFormData } from '../../types';
import { usePolicies } from '../../hooks/usePolicies';
import { usePolicyDashboardPermissions } from '../../hooks/usePolicyDashboardPermissions';

export const PoliciesPage: React.FC = () => {
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  const { 
    createPolicy, 
    updatePolicy, 
    deletePolicy, 
    duplicatePolicy
  } = usePolicies();

  const {
    canViewPolicies,
    canCreatePolicies,
    canEditPolicies,
    canDeletePolicies,
    canManagePermissions,
    isReadOnly,
    loading: permissionsLoading
  } = usePolicyDashboardPermissions();

  const handlePolicySelect = (policy: Policy) => {
    setSelectedPolicy(policy);
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleCreatePolicy = () => {
    if (!canCreatePolicies) {
      toast.error('You do not have permission to create policies');
      return;
    }
    setSelectedPolicy(null);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEditPolicy = (policy: Policy) => {
    if (!canEditPolicies) {
      toast.error('You do not have permission to edit policies');
      return;
    }
    setSelectedPolicy(policy);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSavePolicy = async (data: PolicyFormData) => {
    try {
      if (isCreating) {
        const newPolicy = await createPolicy(data);
        setSelectedPolicy(newPolicy);
        setIsCreating(false);
        toast.success('Policy created successfully');
      } else if (selectedPolicy) {
        const updatedPolicy = await updatePolicy(selectedPolicy.id, data);
        setSelectedPolicy(updatedPolicy);
        setIsEditing(false);
        toast.success('Policy updated successfully');
      }
    } catch (error) {
      console.error('Failed to save policy:', error);
      toast.error('Failed to save policy');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleDeletePolicy = async (policy: Policy) => {
    if (!canDeletePolicies) {
      toast.error('You do not have permission to delete policies');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${policy.name}"? This action cannot be undone.`)) {
      try {
        await deletePolicy(policy.id);
        if (selectedPolicy?.id === policy.id) {
          setSelectedPolicy(null);
        }
        toast.success('Policy deleted successfully');
      } catch (error) {
        console.error('Failed to delete policy:', error);
        toast.error('Failed to delete policy');
      }
    }
  };

  const handleDuplicatePolicy = async (policy: Policy) => {
    if (!canCreatePolicies) {
      toast.error('You do not have permission to duplicate policies');
      return;
    }
    const newName = prompt('Enter name for the duplicated policy:', `${policy.name} (Copy)`);
    if (newName && newName.trim()) {
      try {
        const duplicatedPolicy = await duplicatePolicy(policy.id, newName.trim());
        setSelectedPolicy(duplicatedPolicy);
        toast.success('Policy duplicated successfully');
      } catch (error) {
        console.error('Failed to duplicate policy:', error);
        toast.error('Failed to duplicate policy');
      }
    }
  };



  const renderMainContent = () => {
    if (isCreating || isEditing) {
      return (
        <div className="flex-1 flex flex-col">
          {/* <div className="border-b p-4 bg-white">
            <h2 className="text-lg font-semibold">
              {isCreating ? 'Create New Policy' : `Edit Policy: ${selectedPolicy?.name}`}
            </h2>
          </div> */}
          <div className="flex-1 overflow-hidden">
            <PolicyEditor
              policy={isEditing ? selectedPolicy : null}
              onSave={handleSavePolicy}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      );
    }

    if (selectedPolicy) {
      return (
        <div className="flex-1 flex flex-col bg-white">
          {/* Header */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {selectedPolicy.name}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant={selectedPolicy.is_active ? "default" : "secondary"}>
                    {selectedPolicy.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Version {selectedPolicy.version}
                  </span>
                  <span className="text-sm text-gray-500">
                    Last updated {new Date(selectedPolicy.updated_at).toLocaleDateString()}
                  </span>
                  {/* Removed category for simplified version */}
                </div>
                {/* Removed description for simplified version */}
              </div>
              
              <div className="flex items-center space-x-2">
                {canManagePermissions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPermissions(true)}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Permissions
                  </Button>
                )}
                
                {canEditPolicies && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPolicy(selectedPolicy)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-auto">
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedPolicy.content }}
            />
          </div>
        </div>
      );
    }

    // Welcome view when no policy is selected
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to Policies
          </h2>
          <p className="text-gray-600 mb-6">
            Select a policy from the sidebar to view its content{canCreatePolicies ? ', or create a new policy to get started' : ''}.
          </p>
          {canCreatePolicies && (
            <Button onClick={handleCreatePolicy} size="lg">
              <FileText className="h-4 w-4 mr-2" />
              Create a Policy
            </Button>
          )}
          {isReadOnly && (
            <Alert className="mt-4 max-w-md">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You have read-only access to policies. Contact your administrator to request write permissions.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  };

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show access denied if user cannot view policies
  if (!canViewPolicies) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <Lock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to access the policies dashboard. Contact your administrator for access.
          </p>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              If you believe this is an error, please contact your system administrator.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-white">
      <PolicySidebar
        selectedPolicyId={selectedPolicy?.id}
        onPolicySelect={handlePolicySelect}
        onCreatePolicy={canCreatePolicies ? handleCreatePolicy : undefined}
        onEditPolicy={canEditPolicies ? handleEditPolicy : undefined}
        onDeletePolicy={canDeletePolicies ? handleDeletePolicy : undefined}
        onDuplicatePolicy={canCreatePolicies ? handleDuplicatePolicy : undefined}
      />
      
      {renderMainContent()}
      
      {/* Permissions Manager Modal */}
      {showPermissions && selectedPolicy && canManagePermissions && (
        <PolicyPermissionsManager
          policy={selectedPolicy}
          onClose={() => setShowPermissions(false)}
        />
      )}
    </div>
  );
};

export default PoliciesPage;
