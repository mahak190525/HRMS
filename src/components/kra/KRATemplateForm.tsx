import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Save,
  Target,
  Weight,
  Trash2
} from 'lucide-react';
import type { KRATemplate, KRAGoal } from '@/hooks/useKRA';
import { useKRACategories, useCreateKRACategory } from '@/hooks/useKRA';
import { DraggableGoalItem } from './DraggableGoalItem';
import { Collapsible } from '@/components/ui/collapsible';

interface KRATemplateFormProps {
  template?: KRATemplate;
  onSubmit: (templateData: Partial<KRATemplate>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface GoalFormData extends Partial<KRAGoal> {
  isNew?: boolean;
  tempId?: string;
}

interface CollapsibleGoalProps {
  goal: GoalFormData;
  index: number;
  goalTitle: string;
  goalId: string;
  goalWeight: number;
  categories?: Array<{ id: string; name: string; }>;
  newCategoryName: string;
  showNewCategoryInput: boolean;
  isCreatingCategory: boolean;
  onUpdateGoal: (index: number, field: keyof GoalFormData, value: any) => void;
  onRemoveGoal: (index: number) => void;
  onCreateCategory: () => void;
  onSetNewCategoryName: (name: string) => void;
  onToggleNewCategoryInput: (show: boolean) => void;
}

function CollapsibleGoal({
  goal,
  index,
  goalTitle,
  goalId,
  goalWeight,
  categories,
  newCategoryName,
  showNewCategoryInput,
  isCreatingCategory,
  onUpdateGoal,
  onRemoveGoal,
  onCreateCategory,
  onSetNewCategoryName,
  onToggleNewCategoryInput,
}: CollapsibleGoalProps) {
  return (
    <div className="w-full max-w-full">
      <Collapsible
        defaultOpen={false}
        trigger={
          <div className="flex items-start gap-3 w-full min-w-0" style={{ flexWrap: 'nowrap' }}>
            <Badge variant="outline" className="flex-shrink-0">
              {goalId}
            </Badge>
            <span className="flex-1 font-medium min-w-0 block" style={{ wordBreak: 'normal', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: '1.5' }}>
              {goalTitle}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="flex-shrink-0">
                {goalWeight}%
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveGoal(index);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      >
        <DraggableGoalItem
          goal={goal}
          index={index}
          categories={categories}
          newCategoryName={newCategoryName}
          showNewCategoryInput={showNewCategoryInput}
          isCreatingCategory={isCreatingCategory}
          onUpdateGoal={onUpdateGoal}
          onRemoveGoal={onRemoveGoal}
          onCreateCategory={onCreateCategory}
          onSetNewCategoryName={onSetNewCategoryName}
          onToggleNewCategoryInput={onToggleNewCategoryInput}
        />
      </Collapsible>
    </div>
  );
}

export function KRATemplateForm({ template, onSubmit, onCancel, isLoading = false }: KRATemplateFormProps) {
  const [templateData, setTemplateData] = useState({
    template_name: template?.template_name || '',
    description: template?.description || '',
    evaluation_period_start: template?.evaluation_period_start || '',
    evaluation_period_end: template?.evaluation_period_end || '',
    status: template?.status || 'draft',
  });

  const [goals, setGoals] = useState<GoalFormData[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  const { data: categories } = useKRACategories();
  const createCategory = useCreateKRACategory();

  useEffect(() => {
    if (template?.goals) {
      // Sort goals by display_order when loading from template
      const sortedGoals = template.goals
        .map(goal => ({ ...goal, isNew: false }))
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setGoals(sortedGoals);
    }
  }, [template]);

  // Sort goals by display_order for consistent rendering
  const sortedGoals = [...goals].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const totalWeight = goals.reduce((sum, goal) => sum + (goal.weight || 0), 0);

  const addNewGoal = () => {
    const newGoal: GoalFormData = {
      tempId: `temp-${Date.now()}`,
      isNew: true,
      goal_id: `G${String(goals.length + 1).padStart(3, '0')}`,
      strategic_goal_title: '',
      smart_goal: '',
      weight: 0,
      max_score: 100,
      target: '',
      dependencies: '',
      level_1_marks: '',
      level_2_marks: '',
      level_3_marks: '',
      level_4_marks: '',
      level_5_marks: '',
      level_1_points: 0,
      level_2_points: 0,
      level_3_points: 0,
      level_4_points: 0,
      level_5_points: 0,
      level_1_rating: 'Poor Performance',
      level_2_rating: 'Below Expectations',
      level_3_rating: 'Meets Expectations',
      level_4_rating: 'Exceeds Expectations',
      level_5_rating: 'Far Exceeded Expectations',
      manager_comments: '',
      display_order: goals.length,
    };
    setGoals([...goals, newGoal]);
  };

  const updateGoalField = (index: number, field: keyof GoalFormData, value: any) => {
    const updatedGoals = [...goals];
    updatedGoals[index] = { ...updatedGoals[index], [field]: value };
    setGoals(updatedGoals);
  };

  const removeGoal = (index: number) => {
    const updatedGoals = goals.filter((_, i) => i !== index);
    setGoals(updatedGoals);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    await createCategory.mutateAsync({
      name: newCategoryName,
      description: `Category for ${newCategoryName}`,
    });
    
    setNewCategoryName('');
    setShowNewCategoryInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Warn user if total weight is not 100% and template is being set to active
    if (totalWeight !== 100 && templateData.status === 'active') {
      const confirmed = window.confirm(
        `The total weight is ${totalWeight}% instead of 100%. Active templates should have a total weight of 100%. Do you want to continue anyway?`
      );
      if (!confirmed) return;
    }

    // Submit template first
    await onSubmit({
      ...templateData,
      total_weight: totalWeight,
      goals: goals as any, // Pass goals to parent component (typed as any due to tempId/isNew fields)
    });

    // Note: Goal saving is now handled by the parent component
    // which has access to the template ID from the mutation result
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Template Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Template Information</CardTitle>
          <CardDescription>
            Basic details about the KRA template
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template_name">Template Name *</Label>
              <Input
                id="template_name"
                value={templateData.template_name}
                onChange={(e) => setTemplateData({ ...templateData, template_name: e.target.value })}
                placeholder="Q1 2024 KRA Template"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={templateData.status} onValueChange={(value) => setTemplateData({ ...templateData, status: value as 'draft' | 'active' | 'completed' | 'archived' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={templateData.description}
              onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
              placeholder="Quarterly performance evaluation template..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Evaluation Period Start *</Label>
              <Input
                id="start_date"
                type="date"
                value={templateData.evaluation_period_start}
                onChange={(e) => setTemplateData({ ...templateData, evaluation_period_start: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Evaluation Period End *</Label>
              <Input
                id="end_date"
                type="date"
                value={templateData.evaluation_period_end}
                onChange={(e) => setTemplateData({ ...templateData, evaluation_period_end: e.target.value })}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                KRA Goals ({goals.length})
              </CardTitle>
              <CardDescription>
                Define the key result areas and evaluation criteria
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                <Weight className="h-4 w-4 mr-1" />
                Total Weight: {totalWeight}%
              </Badge>
              <Button type="button" onClick={addNewGoal} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Goal
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          {sortedGoals.length > 0 ? (
            <div className="space-y-4 w-full max-w-full">
              {sortedGoals.map((goal, sortedIndex) => {
                // Find the original index in the goals array for proper updates
                const originalIndex = goals.findIndex(
                  g => (g.id && g.id === goal.id) || 
                       (g.tempId && g.tempId === goal.tempId) ||
                       (g.goal_id && g.goal_id === goal.goal_id && !g.id && !g.tempId)
                );
                const actualIndex = originalIndex !== -1 ? originalIndex : sortedIndex;
                
                const goalTitle = goal.strategic_goal_title || 'Untitled Goal';
                const goalId = goal.goal_id || `Goal ${sortedIndex + 1}`;
                const goalWeight = goal.weight || 0;
                
                return (
                  <CollapsibleGoal
                    key={goal.id || goal.tempId || `goal-${actualIndex}`}
                    goal={goal}
                    index={actualIndex}
                    goalTitle={goalTitle}
                    goalId={goalId}
                    goalWeight={goalWeight}
                    categories={categories}
                    newCategoryName={newCategoryName}
                    showNewCategoryInput={showNewCategoryInput}
                    isCreatingCategory={createCategory.isPending}
                    onUpdateGoal={updateGoalField}
                    onRemoveGoal={removeGoal}
                    onCreateCategory={handleCreateCategory}
                    onSetNewCategoryName={setNewCategoryName}
                    onToggleNewCategoryInput={setShowNewCategoryInput}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No goals added yet. Click "Add Goal" to create your first KRA goal.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 w-full max-w-full">
        {totalWeight !== 100 && (
          <p className="text-sm text-amber-600 sm:mr-auto">
            <strong>Note:</strong> Total weight is {totalWeight}%. For active templates, the total weight should be 100%.
          </p>
        )}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {template ? 'Update Template' : 'Create Template'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
