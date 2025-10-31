import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Eye, 
  EyeOff, 
  Save, 
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, sanitizeDateFields } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';

interface QuarterlySettingsManagerProps {
  assignment: KRAAssignment;
  onUpdate: () => void;
  canManage?: boolean;
}

interface QuarterlySettings {
  q1_due_date: string;
  q2_due_date: string;
  q3_due_date: string;
  q4_due_date: string;
  q1_enabled: boolean;
  q2_enabled: boolean;
  q3_enabled: boolean;
  q4_enabled: boolean;
}

export function QuarterlySettingsManager({ assignment, onUpdate, canManage = false }: QuarterlySettingsManagerProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<QuarterlySettings>({
    q1_due_date: assignment.q1_due_date || '',
    q2_due_date: assignment.q2_due_date || '',
    q3_due_date: assignment.q3_due_date || '',
    q4_due_date: assignment.q4_due_date || '',
    q1_enabled: assignment.q1_enabled || false,
    q2_enabled: assignment.q2_enabled || false,
    q3_enabled: assignment.q3_enabled || false,
    q4_enabled: assignment.q4_enabled || false,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const quarters = [
    { key: 'q1', label: 'Q1', name: 'Quarter 1' },
    { key: 'q2', label: 'Q2', name: 'Quarter 2' },
    { key: 'q3', label: 'Q3', name: 'Quarter 3' },
    { key: 'q4', label: 'Q4', name: 'Quarter 4' },
  ] as const;

  const handleDueDateChange = (quarter: string, date: string) => {
    setSettings(prev => ({
      ...prev,
      [`${quarter}_due_date`]: date
    }));
  };

  const handleEnabledChange = (quarter: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      [`${quarter}_enabled`]: enabled
    }));
  };

  const handleSaveSettings = async () => {
    if (!canManage) return;

    setIsUpdating(true);
    try {
      let updateData: any = {
        ...settings,
        updated_at: new Date().toISOString()
      };

      // Convert empty strings to null for date fields
      const dateFields = ['q1_due_date', 'q2_due_date', 'q3_due_date', 'q4_due_date'];
      updateData = sanitizeDateFields(updateData, dateFields);

      // Add enabled_by and enabled_at for newly enabled quarters
      quarters.forEach(({ key }) => {
        const wasEnabled = assignment[`${key}_enabled` as keyof KRAAssignment] as boolean;
        const isNowEnabled = settings[`${key}_enabled` as keyof QuarterlySettings];
        
        if (!wasEnabled && isNowEnabled) {
          updateData[`${key}_enabled_by`] = user?.id;
          updateData[`${key}_enabled_at`] = new Date().toISOString();
        }
      });

      const { error } = await supabase
        .from('kra_assignments')
        .update(updateData)
        .eq('id', assignment.id);

      if (error) throw error;

      toast.success('Quarterly settings updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating quarterly settings:', error);
      toast.error('Failed to update quarterly settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const getQuarterStatus = (quarter: string) => {
    const status = assignment[`${quarter}_status` as keyof KRAAssignment] as string;
    const enabled = assignment[`${quarter}_enabled` as keyof KRAAssignment] as boolean;
    
    if (!enabled) return { label: 'Disabled', color: 'bg-gray-100 text-gray-600', icon: EyeOff };
    
    switch (status) {
      case 'evaluated':
        return { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'submitted':
        return { label: 'Submitted', color: 'bg-blue-100 text-blue-800', icon: Clock };
      case 'in_progress':
        return { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle };
      case 'not_started':
        return { label: 'Available', color: 'bg-purple-100 text-purple-800', icon: Eye };
      default:
        return { label: 'Not Started', color: 'bg-gray-100 text-gray-600', icon: Clock };
    }
  };

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Quarterly Settings
        </CardTitle>
        <CardDescription>
          {canManage 
            ? 'Manage due dates and enable/disable evidence submission for each quarter'
            : 'View quarterly due dates and availability status'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid gap-6">
          {quarters.map(({ key, label, name }) => {
            const status = getQuarterStatus(key);
            const dueDate = settings[`${key}_due_date` as keyof QuarterlySettings];
            const enabled = settings[`${key}_enabled` as keyof QuarterlySettings];
            const enabledAt = assignment[`${key}_enabled_at` as keyof KRAAssignment] as string;
            
            return (
              <div key={key} className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{name}</h3>
                    <Badge className={status.color}>
                      <status.icon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`${key}_enabled`}
                        checked={enabled}
                        onCheckedChange={(checked) => handleEnabledChange(key, checked as boolean)}
                      />
                      <Label htmlFor={`${key}_enabled`} className="text-sm">
                        Enable Evidence Submission
                      </Label>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${key}_due_date`} className="text-sm">
                      Due Date
                    </Label>
                    <Input
                      id={`${key}_due_date`}
                      type="date"
                      value={dueDate}
                      onChange={(e) => handleDueDateChange(key, e.target.value)}
                      disabled={!canManage}
                      min={getCurrentISTDate().toISOString().split('T')[0]}
                      className={dueDate && isOverdue(dueDate) ? 'border-red-300' : ''}
                    />
                    {dueDate && (
                      <p className={`text-xs ${isOverdue(dueDate) ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {isOverdue(dueDate) ? 'Overdue: ' : 'Due: '}
                        {formatDateForDisplay(dueDate)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Status Information</Label>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {enabledAt && (
                        <div>Enabled: {formatDateForDisplay(enabledAt)}</div>
                      )}
                      {assignment[`${key}_submitted_at` as keyof KRAAssignment] && (
                        <div>Submitted: {formatDateForDisplay(assignment[`${key}_submitted_at` as keyof KRAAssignment] as string)}</div>
                      )}
                      {assignment[`${key}_evaluated_at` as keyof KRAAssignment] && (
                        <div>Evaluated: {formatDateForDisplay(assignment[`${key}_evaluated_at` as keyof KRAAssignment] as string)}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quarter-specific metrics */}
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {assignment[`${key}_overall_percentage` as keyof KRAAssignment] || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {assignment[`${key}_total_score` as keyof KRAAssignment] || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {assignment[`${key}_overall_rating` as keyof KRAAssignment] || 'Not Rated'}
                    </div>
                    <div className="text-xs text-muted-foreground">Rating</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {canManage && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveSettings}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
