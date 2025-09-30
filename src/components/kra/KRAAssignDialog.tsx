import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users,
  Calendar,
  Send,
  User
} from 'lucide-react';
import { format } from 'date-fns';

import type { KRATemplate } from '@/hooks/useKRA';

interface KRAAssignDialogProps {
  template: KRATemplate;
  teamMembers: any[];
  existingAssignments?: any[];
  onAssign: (templateId: string, selectedEmployees: string[], dueDate: string, mode: 'assign' | 'reassign') => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function KRAAssignDialog({ template, teamMembers, existingAssignments = [], onAssign, onCancel, isLoading = false }: KRAAssignDialogProps) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'assign' | 'reassign'>('assign');

  const handleEmployeeToggle = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId]);
    } else {
      setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(teamMembers.map(member => member.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedEmployees.length === 0) {
      alert('Please select at least one team member');
      return;
    }
    
    if (!dueDate) {
      alert('Please set a due date');
      return;
    }

    onAssign(template.id, selectedEmployees, dueDate, assignmentMode);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{template.template_name}</CardTitle>
          <CardDescription>
            {template.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Evaluation Period:</span>
              <div className="font-medium">
                {format(new Date(template.evaluation_period_start), 'MMM dd')} - {format(new Date(template.evaluation_period_end), 'MMM dd, yyyy')}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Goals:</span>
              <div className="font-medium">{template.goals?.length || 0} KRA goals</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Due Date */}
      <div className="space-y-2">
        <Label htmlFor="due_date" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Due Date *
        </Label>
        <Input
          id="due_date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          required
        />
        <p className="text-xs text-muted-foreground">
          Employees will have until this date to complete their KRA submissions
        </p>
      </div>

      {/* Assignment Mode & Existing Assignments */}
      {existingAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Existing Assignments ({existingAssignments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {existingAssignments.slice(0, 3).map((assignment: any) => (
                <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                  <span>{assignment.employee?.full_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {assignment.status}
                  </Badge>
                </div>
              ))}
              {existingAssignments.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{existingAssignments.length - 3} more assignments
                </p>
              )}
            </div>
            
            <div className="space-y-3">
              <Label>Assignment Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="assign"
                    checked={assignmentMode === 'assign'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'assign' | 'reassign')}
                  />
                  <span className="text-sm">New Assignment</span>
                  <span className="text-xs text-muted-foreground">(Only unassigned employees)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="reassign"
                    checked={assignmentMode === 'reassign'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'assign' | 'reassign')}
                  />
                  <span className="text-sm">Reassign</span>
                  <span className="text-xs text-muted-foreground">(Reset existing assignments)</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select Team Members ({selectedEmployees.length}/{teamMembers.length})
          </Label>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectedEmployees.length === teamMembers.length && teamMembers.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm">
              Select All
            </Label>
          </div>
        </div>

        {teamMembers.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
            {teamMembers
              .filter((member) => {
                const hasExistingAssignment = existingAssignments.some(
                  (assignment: any) => assignment.employee_id === member.id
                );
                
                // For 'assign' mode, only show unassigned employees
                // For 'reassign' mode, show all employees
                return assignmentMode === 'reassign' || !hasExistingAssignment;
              })
              .map((member) => {
                const existingAssignment = existingAssignments.find(
                  (assignment: any) => assignment.employee_id === member.id
                );
                
                return (
                  <div key={member.id} className="flex items-center space-x-3 p-3 hover:bg-muted/50">
                    <Checkbox
                      id={`employee-${member.id}`}
                      checked={selectedEmployees.includes(member.id)}
                      onCheckedChange={(checked) => handleEmployeeToggle(member.id, checked as boolean)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url} alt={member.full_name} />
                      <AvatarFallback>
                        {member.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{member.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {member.employee_id && `ID: ${member.employee_id} • `}
                        {member.position || 'Employee'}
                      </div>
                    </div>
                    {existingAssignment && (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs">
                          {existingAssignment.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(existingAssignment.assigned_date), 'MMM dd')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Team Members</h3>
              <p className="text-muted-foreground text-center">
                No team members are currently reporting to you.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assignment Summary */}
      {selectedEmployees.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-800">
              <Send className="h-4 w-4" />
              <span className="font-medium">Assignment Summary</span>
            </div>
            <div className="mt-2 text-sm text-blue-700">
              This KRA template will be assigned to <strong>{selectedEmployees.length}</strong> team member{selectedEmployees.length !== 1 ? 's' : ''} 
              {dueDate && (
                <span> with a due date of <strong>{format(new Date(dueDate), 'MMMM dd, yyyy')}</strong></span>
              )}.
            </div>
            <div className="mt-2 text-xs text-blue-600">
              Selected employees will receive notifications and can access this KRA in their dashboard.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || selectedEmployees.length === 0 || !dueDate}
        >
          {isLoading ? (
            <>Publishing...</>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Publish to Team ({selectedEmployees.length})
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
