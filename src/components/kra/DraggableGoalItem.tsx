import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical,
  Trash2,
  X,
  Plus
} from 'lucide-react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

interface GoalFormData {
  id?: string;
  tempId?: string;
  isNew?: boolean;
  goal_id?: string;
  strategic_goal_title?: string;
  category_id?: string;
  smart_goal?: string;
  weight?: number;
  max_score?: number;
  target?: string;
  dependencies?: string;
  level_1_marks?: string;
  level_2_marks?: string;
  level_3_marks?: string;
  level_4_marks?: string;
  level_5_marks?: string;
  level_1_points?: number;
  level_2_points?: number;
  level_3_points?: number;
  level_4_points?: number;
  level_5_points?: number;
  level_1_rating?: string;
  level_2_rating?: string;
  level_3_rating?: string;
  level_4_rating?: string;
  level_5_rating?: string;
  manager_comments?: string;
  display_order?: number;
}

interface DraggableGoalItemProps {
  goal: GoalFormData;
  index: number;
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

export function DraggableGoalItem({
  goal,
  index,
  categories = [],
  newCategoryName,
  showNewCategoryInput,
  isCreatingCategory,
  onUpdateGoal,
  onRemoveGoal,
  onCreateCategory,
  onSetNewCategoryName,
  onToggleNewCategoryInput,
}: DraggableGoalItemProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = dragRef.current;
    const dragHandle = dragHandleRef.current;
    
    if (!element || !dragHandle) return;

    const cleanupDraggable = draggable({
      element,
      dragHandle,
      getInitialData: () => ({ index, goalId: goal.id || goal.tempId }),
    });

    const cleanupDropTarget = dropTargetForElements({
      element,
      getData: () => ({ index }),
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
  }, [index, goal.id, goal.tempId]);

  return (
    <div
      ref={dragRef}
      className="border rounded-lg p-4 bg-white"
      data-goal-index={index}
    >
      {/* Goal Header */}
      <div className="flex items-center gap-2 mb-4">
        <div ref={dragHandleRef} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Badge variant="outline">Goal {index + 1}</Badge>
        <Input
          value={goal.goal_id || ''}
          onChange={(e) => onUpdateGoal(index, 'goal_id', e.target.value)}
          placeholder="Goal ID (e.g., G001)"
          className="w-32"
        />
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemoveGoal(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Goal Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label>Strategic Goal Title *</Label>
          <Input
            value={goal.strategic_goal_title || ''}
            onChange={(e) => onUpdateGoal(index, 'strategic_goal_title', e.target.value)}
            placeholder="Enter goal title here..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="flex gap-2">
            <Select 
              value={goal.category_id || ''} 
              onValueChange={(value) => onUpdateGoal(index, 'category_id', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleNewCategoryInput(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {showNewCategoryInput && (
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => onSetNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={onCreateCategory}
                disabled={isCreatingCategory}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onToggleNewCategoryInput(false);
                  onSetNewCategoryName('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>SMART Goal *</Label>
          <Textarea
            value={goal.smart_goal || ''}
            onChange={(e) => onUpdateGoal(index, 'smart_goal', e.target.value)}
            placeholder="Enter Specific, Measurable, Achievable, Relevant, Time-bound goal description..."
            className='whitespace-pre-line'
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Weight (%) *</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={goal.weight || ''}
              onChange={(e) => onUpdateGoal(index, 'weight', parseFloat(e.target.value) || 0)}
              placeholder="Enter weight % here..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Max Score</Label>
            <Input
              type="number"
              min="0"
              value={goal.max_score || ''}
              onChange={(e) => onUpdateGoal(index, 'max_score', parseFloat(e.target.value) || 0)}
              placeholder="Enter max score here..."
            />
          </div>
          <div className="space-y-2">
            <Label>Target *</Label>
            <Input
              value={goal.target || ''}
              onChange={(e) => onUpdateGoal(index, 'target', e.target.value)}
              placeholder="Enter target here..."
              required
            />
          </div>
        </div>

        {/* Evaluation Levels */}
        <div className="space-y-2">
          <Label>Evaluation Levels (Criteria & Points)</Label>
          <p className="text-xs text-muted-foreground">
            Define performance criteria (text with line breaks supported) and corresponding points (numbers) for each level
          </p>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            {[1, 2, 3, 4, 5].map(level => (
              <div key={level} className="space-y-2 p-3 border rounded">
                <div className="text-sm font-medium text-center">
                  Level {level}
                </div>
                <div className="text-xs text-center text-muted-foreground">
                  {goal[`level_${level}_rating` as keyof GoalFormData] as string}
                </div>
                <Textarea
                  placeholder="Enter performance criteria here..."
                  value={goal[`level_${level}_marks` as keyof GoalFormData] as string || ''}
                  onChange={(e) => onUpdateGoal(index, `level_${level}_marks` as keyof GoalFormData, e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <Input
                  type="number"
                  placeholder="Points"
                  value={goal[`level_${level}_points` as keyof GoalFormData] as number ?? ''}
                  onChange={(e) => onUpdateGoal(index, `level_${level}_points` as keyof GoalFormData, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Dependencies</Label>
            <Textarea
              value={goal.dependencies || ''}
              onChange={(e) => onUpdateGoal(index, 'dependencies', e.target.value)}
              placeholder="Dependencies on other goals or external factors..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Manager Comments</Label>
            <Textarea
              value={goal.manager_comments || ''}
              onChange={(e) => onUpdateGoal(index, 'manager_comments', e.target.value)}
              placeholder="Additional guidance or expectations..."
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
