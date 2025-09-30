import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAssets, useAllEmployees, useCreateAssetAssignment, useUnassignAsset } from '@/hooks/useEmployees';
import { notificationApi } from '@/services/notificationApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, UserCheck, UserX, Package } from 'lucide-react';

export function AssetAssignmentNotificationTest() {
  const { user } = useAuth();
  const { data: assets } = useAssets();
  const { data: employees } = useAllEmployees();
  const createAssignment = useCreateAssetAssignment();
  const unassignAsset = useUnassignAsset();

  const [testAssignmentData, setTestAssignmentData] = useState({
    asset_id: '',
    user_id: '',
    assignment_type: 'permanent' as 'permanent' | 'temporary'
  });

  const [testUnassignmentData, setTestUnassignmentData] = useState({
    asset_id: '',
    return_condition: 'good' as 'excellent' | 'good' | 'fair' | 'poor' | 'damaged'
  });

  const [testingPhase, setTestingPhase] = useState<'assign' | 'unassign'>('assign');

  // Filter available assets (not assigned)
  const availableAssets = assets?.filter(asset => asset.status === 'available') || [];
  
  // Filter assigned assets (for unassignment testing)
  const assignedAssets = assets?.filter(asset => asset.status === 'assigned') || [];

  const handleAssignAsset = async () => {
    if (!testAssignmentData.asset_id || !testAssignmentData.user_id || !user) {
      toast.error('Please select both an asset and a user');
      return;
    }

    try {
      const assignmentPayload = {
        asset_id: testAssignmentData.asset_id,
        user_ids: [testAssignmentData.user_id],
        assigned_by: user.id,
        assignment_type: testAssignmentData.assignment_type,
        assignment_expiry_date: testAssignmentData.assignment_type === 'temporary' 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
          : undefined,
        notes: 'Test assignment via notification system test'
      };

      await createAssignment.mutateAsync(assignmentPayload);
      setTestingPhase('unassign');
      toast.success('Asset assigned! User should receive notification.');
    } catch (error) {
      console.error('Error assigning asset:', error);
      toast.error('Failed to assign asset');
    }
  };

  const handleUnassignAsset = async () => {
    if (!testUnassignmentData.asset_id) {
      toast.error('Please select an asset to unassign');
      return;
    }

    try {
      await unassignAsset.mutateAsync({
        assetId: testUnassignmentData.asset_id,
        returnCondition: testUnassignmentData.return_condition,
        returnNotes: 'Test unassignment via notification system test'
      });
      setTestingPhase('assign');
      toast.success('Asset unassigned! User should receive notification.');
    } catch (error) {
      console.error('Error unassigning asset:', error);
      toast.error('Failed to unassign asset');
    }
  };

  const handleDirectNotificationTest = async () => {
    if (!user) return;
    
    try {
      await notificationApi.createAssetAssignmentNotification({
        assignment_id: 'test-id',
        user_id: user.id,
        asset_name: 'Test Laptop',
        asset_tag: 'TEST-001',
        asset_category: 'Laptop',
        assigned_by_name: 'Test Administrator',
        assignment_type: 'permanent',
        is_vm: false
      });
      toast.success('Direct assignment notification sent!');
    } catch (error) {
      console.error('Error sending direct notification:', error);
      toast.error('Failed to send direct notification');
    }
  };

  const resetTest = () => {
    setTestAssignmentData({
      asset_id: '',
      user_id: '',
      assignment_type: 'permanent'
    });
    setTestUnassignmentData({
      asset_id: '',
      return_condition: 'good'
    });
    setTestingPhase('assign');
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'assign': return <UserCheck className="h-4 w-4" />;
      case 'unassign': return <UserX className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Asset Assignment Notification Test
          </CardTitle>
          <CardDescription>
            Test asset assignment and unassignment notifications. This covers both regular assets and VM assignments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current User Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Current User (Assigner)</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>Name:</Label>
                <p>{user?.full_name}</p>
              </div>
              <div>
                <Label>Role:</Label>
                <p>{user?.role?.name}</p>
              </div>
            </div>
          </div>

          {/* Notification Flow Visualization */}
          <div className="space-y-4">
            <h3 className="font-medium">Assignment Notification Flow</h3>
            <div className="grid grid-cols-2 gap-2">
              {['assign', 'unassign'].map((phase) => (
                <div
                  key={phase}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    testingPhase === phase
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getPhaseIcon(phase)}
                    <span className="text-sm font-medium capitalize">{phase} Asset</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {phase === 'assign' && 'Notifies: Assigned User'}
                    {phase === 'unassign' && 'Notifies: Previously Assigned User'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Test Phase 1: Assign Asset */}
          {testingPhase === 'assign' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Phase 1</Badge>
                <h3 className="font-medium">Assign Asset to User</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="asset-select">Available Asset</Label>
                  <Select 
                    value={testAssignmentData.asset_id} 
                    onValueChange={(value) => setTestAssignmentData(prev => ({ ...prev, asset_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select available asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssets.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name} ({asset.asset_tag}) - {asset.category?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableAssets.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No available assets found. Create some assets first.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="user-select">User to Assign To</Label>
                  <Select 
                    value={testAssignmentData.user_id} 
                    onValueChange={(value) => setTestAssignmentData(prev => ({ ...prev, user_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name} ({employee.employee_id}) - {employee.role?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="assignment-type">Assignment Type</Label>
                <Select 
                  value={testAssignmentData.assignment_type} 
                  onValueChange={(value: 'permanent' | 'temporary') => 
                    setTestAssignmentData(prev => ({ ...prev, assignment_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="temporary">Temporary (30 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleAssignAsset} 
                disabled={createAssignment.isPending || !testAssignmentData.asset_id || !testAssignmentData.user_id}
                className="w-full"
              >
                {createAssignment.isPending ? 'Assigning...' : 'Assign Asset & Send Notification'}
              </Button>
            </div>
          )}

          {/* Test Phase 2: Unassign Asset */}
          {testingPhase === 'unassign' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Phase 2</Badge>
                <h3 className="font-medium">Unassign Asset from User</h3>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This simulates returning an asset and notifying the user who had it assigned.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unassign-asset-select">Assigned Asset</Label>
                  <Select 
                    value={testUnassignmentData.asset_id} 
                    onValueChange={(value) => setTestUnassignmentData(prev => ({ ...prev, asset_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assigned asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedAssets.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name} ({asset.asset_tag}) - {asset.category?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignedAssets.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No assigned assets found. Assign an asset first.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="return-condition">Return Condition</Label>
                  <Select 
                    value={testUnassignmentData.return_condition} 
                    onValueChange={(value: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged') => 
                      setTestUnassignmentData(prev => ({ ...prev, return_condition: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleUnassignAsset} 
                disabled={unassignAsset.isPending || !testUnassignmentData.asset_id}
                variant="destructive"
                className="w-full"
              >
                {unassignAsset.isPending ? 'Unassigning...' : 'Unassign Asset & Send Notification'}
              </Button>
            </div>
          )}

          <Separator />

          {/* Additional Test Options */}
          <div className="space-y-4">
            <h3 className="font-medium">Additional Tests</h3>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={handleDirectNotificationTest}>
                Send Direct Test Notification
              </Button>
              <Button variant="outline" onClick={resetTest}>
                Reset Test Workflow
              </Button>
            </div>
          </div>

          {/* Notification Guidelines */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Asset Assignment Notification Flow</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>1. Asset Assigned:</strong> User receives notification with asset details and assignment type</p>
              <p><strong>2. Asset Unassigned:</strong> User receives notification about asset return with condition</p>
              <p><strong>3. VM Assignments:</strong> Special handling for virtual machine assignments with VM-specific details</p>
              <p><strong>4. Temporary Assignments:</strong> Include expiry date information in notifications</p>
            </div>
          </div>

          {/* System Information */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">System Information</h4>
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>Available Assets:</strong> {availableAssets.length}</p>
              <p><strong>Assigned Assets:</strong> {assignedAssets.length}</p>
              <p><strong>Total Employees:</strong> {employees?.length || 0}</p>
              <p><strong>Current Phase:</strong> {testingPhase}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
