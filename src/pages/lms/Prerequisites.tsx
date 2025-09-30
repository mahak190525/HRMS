import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserModules, useUpdateModuleProgress, useModuleById } from '@/hooks/useLMS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  BookOpen,
  Play,
  CheckCircle,
  Clock,
  Lock,
  Star,
  FileText,
  Video,
  Link,
  Award,
  Target,
  Calendar,
  Timer,
  ExternalLink
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function Prerequisites() {
  const { user } = useAuth();
  const { data: modules, isLoading: modulesLoading } = useUserModules();
  const updateModuleProgress = useUpdateModuleProgress();
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const { data: moduleDetails, isLoading: detailsLoading } = useModuleById(selectedModuleId);

  const categories = [...new Set(modules?.map(m => m.category))];

  const filteredModules = modules?.filter(module => {
    if (categoryFilter === 'all') return true;
    return module.category === categoryFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'not_started':
        return <Play className="h-4 w-4 text-gray-600" />;
      default:
        return <Lock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      not_started: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyBadge = (difficulty: string) => {
    const variants = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return variants[difficulty as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'link':
        return <Link className="h-4 w-4" />;
      case 'quiz':
        return <Award className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const handleStartModule = (moduleId: string) => {
    updateModuleProgress.mutate({
      moduleId,
      progressData: {
        status: 'in_progress',
        progress_percentage: 5,
        started_at: new Date().toISOString()
      }
    });
  };

  const handleCompleteModule = (moduleId: string) => {
    updateModuleProgress.mutate({
      moduleId,
      progressData: {
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString()
      }
    });
  };

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Prerequisites</h1>
        <p className="text-muted-foreground">
          Complete these modules to prepare for your role and responsibilities
        </p>
      </div>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('all')}
            >
              All Categories
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={categoryFilter === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules?.map((module: any) => {
          const progress = module.user_progress?.[0];
          const isLocked = false; // TODO: Implement prerequisite checking
          
          return (
            <Card key={module.id} className={cn(
              "hover:shadow-lg transition-all duration-200",
              isLocked && "opacity-60"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getDifficultyBadge(module.difficulty_level)}>
                      {module.difficulty_level}
                    </Badge>
                    {module.is_mandatory && (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(progress?.status || 'not_started')}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{module.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {module.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {module.estimated_duration_hours}h
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {module.resources?.length || 0} resources
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {module.quizzes?.length || 0} quizzes
                  </span>
                </div>

                {progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{progress.progress_percentage}%</span>
                    </div>
                    <Progress value={progress.progress_percentage} />
                    {progress.total_time_spent_minutes > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Time spent: {Math.round(progress.total_time_spent_minutes / 60)}h {progress.total_time_spent_minutes % 60}m
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedModule(module);
                          setSelectedModuleId(module.id);
                        }}
                        disabled={isLocked}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>{selectedModule?.title}</DialogTitle>
                        <DialogDescription>
                          Module content and learning resources
                        </DialogDescription>
                      </DialogHeader>
                      {detailsLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : moduleDetails && (
                        <Tabs defaultValue="overview" className="space-y-4">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="resources">Resources</TabsTrigger>
                            <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium">Category:</p>
                                <p className="text-muted-foreground">{moduleDetails.category}</p>
                              </div>
                              <div>
                                <p className="font-medium">Difficulty:</p>
                                <Badge className={getDifficultyBadge(moduleDetails.difficulty_level)}>
                                  {moduleDetails.difficulty_level}
                                </Badge>
                              </div>
                              <div>
                                <p className="font-medium">Duration:</p>
                                <p className="text-muted-foreground">{moduleDetails.estimated_duration_hours} hours</p>
                              </div>
                              <div>
                                <p className="font-medium">Type:</p>
                                <p className="text-muted-foreground">{moduleDetails.is_mandatory ? 'Mandatory' : 'Optional'}</p>
                              </div>
                            </div>
                            
                            <div>
                              <p className="font-medium mb-2">Description:</p>
                              <p className="text-muted-foreground text-sm">{moduleDetails.description}</p>
                            </div>

                            {moduleDetails.prerequisites && moduleDetails.prerequisites.length > 0 && (
                              <div>
                                <p className="font-medium mb-2">Prerequisites:</p>
                                <div className="space-y-1">
                                  {moduleDetails.prerequisites.map((prereqId: string) => (
                                    <Badge key={prereqId} variant="outline" className="mr-2">
                                      Module {prereqId}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="resources" className="space-y-4">
                            <div className="space-y-3">
                              {moduleDetails.resources?.map((resource: any) => (
                                <div key={resource.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-gray-100">
                                      {getResourceIcon(resource.resource_type)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">{resource.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {resource.resource_type} • {resource.duration_minutes}min
                                        {resource.is_required && <span className="text-red-600"> • Required</span>}
                                      </p>
                                    </div>
                                  </div>
                                  {resource.resource_url && (
                                    <Button size="sm" variant="outline" asChild>
                                      <a href={resource.resource_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TabsContent>

                          <TabsContent value="quizzes" className="space-y-4">
                            <div className="space-y-3">
                              {moduleDetails.quizzes?.map((quiz: any) => (
                                <div key={quiz.id} className="p-4 border rounded-lg">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="font-medium">{quiz.title}</h4>
                                      <p className="text-sm text-muted-foreground">{quiz.description}</p>
                                    </div>
                                    <Badge variant="outline">
                                      {quiz.passing_score}% to pass
                                    </Badge>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                                    <span>{quiz.time_limit_minutes} minutes</span>
                                    <span>{quiz.max_attempts} attempts allowed</span>
                                    <span>{quiz.questions?.length || 0} questions</span>
                                  </div>

                                  <Button size="sm" className="w-full">
                                    <Award className="h-4 w-4 mr-2" />
                                    Take Quiz
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        </Tabs>
                      )}
                    </DialogContent>
                  </Dialog>

                  {!progress || progress.status === 'not_started' ? (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleStartModule(module.id)}
                      disabled={isLocked || updateModuleProgress.isPending}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  ) : progress.status === 'in_progress' ? (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleCompleteModule(module.id)}
                      disabled={updateModuleProgress.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      disabled
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Completed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredModules?.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Modules Available</h3>
            <p className="text-muted-foreground">
              {categoryFilter === 'all' 
                ? 'No learning modules have been assigned to your role yet.'
                : `No modules found in the ${categoryFilter} category.`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}