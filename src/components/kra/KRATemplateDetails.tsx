import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  Target,
  Weight,
  FileText,
  X
} from 'lucide-react';
import { formatDateForDisplay } from '@/utils/dateUtils';

import type { KRATemplate } from '@/hooks/useKRA';

interface KRATemplateDetailsProps {
  template: KRATemplate;
  onClose: () => void;
}

export function KRATemplateDetails({ template, onClose }: KRATemplateDetailsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{template.template_name}</CardTitle>
              <CardDescription className="mt-1">
                {template.description || 'No description provided'}
              </CardDescription>
            </div>
            <Badge className={getStatusColor(template.status)}>
              {template.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Evaluation Period</div>
                <div className="text-muted-foreground">
                  {formatDateForDisplay(template.evaluation_period_start, 'MMM dd')} - {formatDateForDisplay(template.evaluation_period_end, 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Total Goals</div>
                <div className="text-muted-foreground">{template.goals?.length || 0} KRA goals</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Total Weight</div>
                <div className="text-muted-foreground">{template.total_weight}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals Details */}
      {template.goals && template.goals.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            KRA Goals ({template.goals.length})
          </h3>
          
          {template.goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge variant="outline">{goal.goal_id}</Badge>
                      {goal.strategic_goal_title}
                    </CardTitle>
                    {goal.category && (
                      <Badge variant="secondary" className="mt-2">
                        {goal.category.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{goal.weight}%</div>
                    <div className="text-xs text-muted-foreground">Weight</div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">SMART Goal</h4>
                  <p className="text-sm p-3 bg-muted rounded-lg whitespace-pre-line">{goal.smart_goal}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Target</h4>
                    <p className="text-sm p-3 bg-muted rounded-lg">{goal.target}</p>
                  </div>
                  {goal.dependencies && (
                    <div>
                      <h4 className="font-medium mb-2">Dependencies</h4>
                      <p className="text-sm p-3 bg-muted rounded-lg">{goal.dependencies}</p>
                    </div>
                  )}
                </div>

                {goal.manager_comments && (
                  <div>
                    <h4 className="font-medium mb-2">Manager Comments</h4>
                    <p className="text-sm p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      {goal.manager_comments}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Evaluation Levels */}
                <div>
                  <h4 className="font-medium mb-3">Evaluation Levels</h4>
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                    {[1, 2, 3, 4, 5].map(level => {
                      const marks = goal[`level_${level}_marks` as keyof typeof goal] as string || '';
                      const points = goal[`level_${level}_points` as keyof typeof goal] as number || 0;
                      const rating = goal[`level_${level}_rating` as keyof typeof goal] as string || '';

                      return (
                        <div key={level} className="p-3 border rounded-lg text-center">
                          <div className="font-medium ">Level {level}</div>
                          <div className="text-xs text-muted-foreground">{rating}</div>
                          <div className="text-sm">
                            <div className="whitespace-pre-line justify-start text-start">{marks}</div>
                            <div className="justify-end text-end">{points} points</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No goals defined in this template</p>
          </CardContent>
        </Card>
      )}

      {/* Close Action */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>
    </div>
  );
}
