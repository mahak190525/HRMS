import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Collapsible } from '@/components/ui/collapsible';
import { Target, Trash2 } from 'lucide-react';
import type { KRAGoal } from '@/hooks/useKRA';

interface CollapsibleGoalViewProps {
  goal: KRAGoal;
  index?: number;
  showRemoveButton?: boolean;
  onRemoveGoal?: (index: number) => void;
  children?: React.ReactNode; // For additional content like evaluation forms
  defaultOpen?: boolean;
}

export function CollapsibleGoalView({
  goal,
  index = 0,
  showRemoveButton = false,
  onRemoveGoal,
  children,
  defaultOpen = false,
}: CollapsibleGoalViewProps) {
  const goalTitle = goal.strategic_goal_title || 'Untitled Goal';
  const goalId = goal.goal_id || `Goal ${index + 1}`;
  const goalWeight = goal.weight || 0;

  return (
    <div className="w-full max-w-full">
      <Collapsible
        defaultOpen={defaultOpen}
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
              {showRemoveButton && onRemoveGoal && (
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
              )}
            </div>
          </div>
        }
      >
        <Card className="w-full max-w-full overflow-hidden mt-2">
          <CardContent className="space-y-4 w-full max-w-full overflow-x-hidden pt-6">
            {/* Goal Details */}
            <div className="space-y-3">
              {goal.category && (
                <div>
                  <Badge variant="secondary">
                    {goal.category.name}
                  </Badge>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium">SMART Goal</Label>
                <div className="text-sm mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                  {goal.smart_goal}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Target</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{goal.target}</p>
                </div>
                {goal.dependencies && (
                  <div>
                    <Label className="text-sm font-medium">Dependencies</Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-lg break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{goal.dependencies}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Max Score</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{goal.max_score}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Weight</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{goal.weight}%</p>
                </div>
              </div>

              {goal.manager_comments && (
                <div>
                  <Label className="text-sm font-medium">Manager Comments</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{goal.manager_comments}</p>
                </div>
              )}
            </div>

            {/* Performance Levels */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Performance Levels
              </Label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(level => {
                  const marks = goal[`level_${level}_marks` as keyof typeof goal] as string || '';
                  const points = goal[`level_${level}_points` as keyof typeof goal] as number || 0;
                  const rating = goal[`level_${level}_rating` as keyof typeof goal] as string || '';

                  return (
                    <div
                      key={level}
                      className="p-3 border rounded-lg border-gray-200 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Level {level} - {rating}</div>
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{marks}</div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="font-medium text-blue-600">{points} points</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Additional content (like evaluation forms) */}
            {children}
          </CardContent>
        </Card>
      </Collapsible>
    </div>
  );
}
