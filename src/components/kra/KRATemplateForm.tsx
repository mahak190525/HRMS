import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Save,
  Target,
  Weight
} from 'lucide-react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';
import type { KRATemplate, KRAGoal } from '@/hooks/useKRA';
import { useKRACategories, useCreateKRACategory } from '@/hooks/useKRA';
import { DraggableGoalItem } from './DraggableGoalItem';

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
  const dropTargetRef = useRef<HTMLDivElement>(null);

  const { data: categories } = useKRACategories();
  const createCategory = useCreateKRACategory();

  useEffect(() => {
    if (template?.goals) {
      setGoals(template.goals.map(goal => ({ ...goal, isNew: false })));
    }
  }, [template]);

  useEffect(() => {
    const element = dropTargetRef.current;
    if (!element) return;

    return dropTargetForElements({
      element,
      onDrop({ source, location }) {
        const { index: startIndex } = source.data as { index: number };
        
        // Find closest goal item to drop position
        const dropTargets = location.current.dropTargets;
        if (dropTargets.length === 0) return;
        
        // Get all draggable goal items
        const goalElements = Array.from(element.querySelectorAll('[data-goal-index]'));
        const targetElement = dropTargets.find(target => 
          goalElements.includes(target.element)
        )?.element;
        
        if (targetElement) {
          const targetIndex = parseInt(targetElement.getAttribute('data-goal-index') || '0');
          if (startIndex !== targetIndex) {
            handleReorder(startIndex, targetIndex);
          }
        }
      },
    });
  }, []);

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

  const handleReorder = (startIndex: number, finishIndex: number) => {
    const updatedItems = reorder({
      list: goals,
      startIndex,
      finishIndex,
    }).map((item, index) => ({
      ...item,
      display_order: index,
    }));

    setGoals(updatedItems);
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
    
    if (totalWeight !== 100) {
      alert('Total weight must equal 100%');
      return;
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
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <CardContent>
          {goals.length > 0 ? (
            <div ref={dropTargetRef} className="space-y-4">
              {goals.map((goal, index) => (
                <DraggableGoalItem
                  key={goal.id || goal.tempId || `goal-${index}`}
                  goal={goal}
                  index={index}
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
              ))}
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
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || totalWeight !== 100}>
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
    </form>
  );
}
