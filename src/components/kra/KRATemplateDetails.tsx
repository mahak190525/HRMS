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
import { CollapsibleGoalView } from './CollapsibleGoalView';

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

  // Sort goals by display_order for consistent rendering
  const sortedGoals = template.goals 
    ? [...template.goals].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
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
      {sortedGoals.length > 0 ? (
        <div className="space-y-4 w-full max-w-full">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            KRA Goals ({sortedGoals.length})
          </h3>
          
          {sortedGoals.map((goal, index) => (
            <CollapsibleGoalView
              key={goal.id}
              goal={goal}
              index={index}
              defaultOpen={false}
            />
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
