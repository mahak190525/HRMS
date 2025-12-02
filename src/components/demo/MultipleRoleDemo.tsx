import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleDisplay, RoleList } from '@/components/ui/role-display';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Users, Shield, CheckCircle } from 'lucide-react';

/**
 * Demo component showing multiple role functionality
 */
export function MultipleRoleDemo() {
  const [selectedUser, setSelectedUser] = useState(0);

  // Sample users with different role configurations
  const demoUsers = [
    {
      id: '1',
      full_name: 'John Smith',
      email: 'john.smith@company.com',
      role: { name: 'finance_manager' },
      additional_roles: [
        { id: 'hr1', name: 'hr' },
        { id: 'admin1', name: 'admin' }
      ]
    },
    {
      id: '2', 
      full_name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      role: { name: 'sdm' },
      additional_roles: [
        { id: 'hr2', name: 'hr' }
      ]
    },
    {
      id: '3',
      full_name: 'Mike Wilson', 
      email: 'mike.wilson@company.com',
      role: { name: 'employee' },
      additional_roles: []
    },
    {
      id: '4',
      full_name: 'Lisa Chen',
      email: 'lisa.chen@company.com', 
      role: { name: 'hr' },
      additional_roles: [
        { id: 'finance1', name: 'finance' },
        { id: 'admin2', name: 'admin' },
        { id: 'manager1', name: 'manager' }
      ]
    }
  ];

  const currentUser = demoUsers[selectedUser];

  const getPermissionSummary = (user: any) => {
    const allRoles = [
      user.role?.name,
      ...(user.additional_roles?.map((r: any) => r.name) || [])
    ].filter(Boolean);

    const permissions = [];
    
    if (allRoles.includes('admin')) permissions.push('Full System Access');
    if (allRoles.includes('hr') || allRoles.includes('hrm')) permissions.push('All Employee Data');
    if (allRoles.includes('finance') || allRoles.includes('finance_manager')) permissions.push('Financial Data');
    if (allRoles.includes('sdm') || allRoles.includes('bdm') || allRoles.includes('qam') || allRoles.includes('manager')) permissions.push('Team Management');
    if (allRoles.length === 1 && allRoles.includes('employee')) permissions.push('Own Data Only');

    return permissions;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Multiple Role Assignment Demo
          </CardTitle>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This demo shows how users can be assigned multiple roles and how permissions are aggregated from all assigned roles.
            </AlertDescription>
          </Alert>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Demo User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoUsers.map((user, index) => (
              <Button
                key={user.id}
                variant={selectedUser === index ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setSelectedUser(index)}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{user.full_name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {1 + (user.additional_roles?.length || 0)} roles
                  </Badge>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* User Details */}
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{currentUser.full_name}</h4>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Role Assignment</h4>
              <RoleDisplay user={currentUser} variant="detailed" />
            </div>

            <div>
              <h4 className="font-medium mb-2">Effective Permissions</h4>
              <div className="space-y-2">
                {getPermissionSummary(currentUser).map((permission, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{permission}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Display Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Role Display Variants</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="default" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="default">Default</TabsTrigger>
              <TabsTrigger value="compact">Compact</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="default" className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Default Display</h4>
                <RoleDisplay user={currentUser} variant="default" />
              </div>
            </TabsContent>
            
            <TabsContent value="compact" className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Compact Display</h4>
                <RoleDisplay user={currentUser} variant="compact" />
              </div>
            </TabsContent>
            
            <TabsContent value="detailed" className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Detailed Display</h4>
                <RoleDisplay user={currentUser} variant="detailed" />
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Role List</h4>
                <RoleList user={currentUser} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Implementation Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Implementation Examples
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Employee Management Table</h4>
              <div className="text-sm text-muted-foreground mb-2">Shows roles in table format</div>
              <RoleDisplay user={currentUser} variant="default" showLabels={false} />
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Dashboard Header</h4>
              <div className="text-sm text-muted-foreground mb-2">User profile display</div>
              <RoleDisplay user={currentUser} variant="detailed" showLabels={false} />
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Employee Details Modal</h4>
              <div className="text-sm text-muted-foreground mb-2">Detailed view with labels</div>
              <RoleDisplay user={currentUser} variant="detailed" showLabels={true} />
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Quick Reference</h4>
              <div className="text-sm text-muted-foreground mb-2">Compact for lists</div>
              <RoleDisplay user={currentUser} variant="compact" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MultipleRoleDemo;
