import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  Users,
  Calendar,
  Send,
  User,
  X,
  Search
} from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';

import type { KRATemplate } from '@/hooks/useKRA';


interface KRAAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: KRATemplate;
  teamMembers: any[];
  existingAssignments?: any[];
  onAssign: (templateId: string, selectedEmployees: string[], mode: 'assign' | 'reassign') => void;
  isLoading?: boolean;
}

export function KRAAssignDialog({ isOpen, onClose, template, teamMembers, existingAssignments = [], onAssign, isLoading = false }: KRAAssignDialogProps) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<'assign' | 'reassign'>('assign');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Check which employees already have assignments
  const employeesWithAssignments = existingAssignments.map(assignment => assignment.employee_id);
  const newEmployees = teamMembers.filter(member => !employeesWithAssignments.includes(member.id));
  const existingEmployees = teamMembers.filter(member => employeesWithAssignments.includes(member.id));

  // Filter team members based on search query
  const filteredTeamMembers = teamMembers.filter((member) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.employee_id?.toLowerCase().includes(query)
    );
  });

  const handleEmployeeToggle = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId]);
    } else {
      setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select filtered members
      const filteredIds = filteredTeamMembers.map(member => member.id);
      setSelectedEmployees([...new Set([...selectedEmployees, ...filteredIds])]);
    } else {
      // Only deselect filtered members
      const filteredIds = filteredTeamMembers.map(member => member.id);
      setSelectedEmployees(selectedEmployees.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedEmployees.length === 0) {
      alert('Please select at least one team member');
      return;
    }
    
    onAssign(template.id, selectedEmployees, assignmentMode);
  };

  // Reset search when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish to Team Members</DialogTitle>
          <DialogDescription>
            Select team members to assign this KRA template and set quarterly due dates.
          </DialogDescription>
        </DialogHeader>
        
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
                    {formatDateForDisplay(template.evaluation_period_start, 'MMM dd')} - {formatDateForDisplay(template.evaluation_period_end, 'MMM dd, yyyy')}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Goals:</span>
                  <div className="font-medium">{template.goals?.length || 0} KRA goals</div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Assignment Mode Selection */}
          {existingEmployees.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Assignment Mode</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="assign_new"
                    name="assignment_mode"
                    value="assign"
                    checked={assignmentMode === 'assign'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'assign' | 'reassign')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="assign_new" className="text-sm">
                    Assign to new employees only ({newEmployees.length} available)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="reassign_all"
                    name="assignment_mode"
                    value="reassign"
                    checked={assignmentMode === 'reassign'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'assign' | 'reassign')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="reassign_all" className="text-sm">
                    Reassign to all selected employees (will reset existing assignments)
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Team Member Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Team Members
              </Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select_all"
                  checked={filteredTeamMembers.length > 0 && filteredTeamMembers.every(member => selectedEmployees.includes(member.id))}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select_all" className="text-sm">
                  Select All ({filteredTeamMembers.length})
                </Label>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
              {filteredTeamMembers.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No team members found matching "{searchQuery}"
                </div>
              ) : (
                filteredTeamMembers.map((member) => {
                const hasExistingAssignment = employeesWithAssignments.includes(member.id);
                const isDisabled = assignmentMode === 'assign' && hasExistingAssignment;
                
                return (
                  <div 
                    key={member.id} 
                    className={`flex items-center space-x-3 p-2 rounded-lg border ${
                      isDisabled ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      id={`member_${member.id}`}
                      checked={selectedEmployees.includes(member.id)}
                      onCheckedChange={(checked) => handleEmployeeToggle(member.id, checked as boolean)}
                      disabled={isDisabled}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback>
                        {member.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{member.full_name}</p>
                        {hasExistingAssignment && (
                          <Badge variant="secondary" className="text-xs">
                            Already Assigned
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      {member.employee_id && (
                        <p className="text-xs text-muted-foreground">ID: {member.employee_id}</p>
                      )}
                    </div>
                  </div>
                );
                })
              )}
            </div>

            {selectedEmployees.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedEmployees.length} team member(s) selected
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || selectedEmployees.length === 0}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {assignmentMode === 'reassign' ? 'Reassign Template' : 'Assign Template'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}