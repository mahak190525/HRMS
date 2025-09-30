import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAssessments, useSubmitAssessment } from '@/hooks/useATS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Code,
  Play,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Terminal,
  Save,
  Send,
  Eye,
  Timer,
  Target
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, differenceInMinutes } from 'date-fns';

// Mock coding environment component
function CodingIDE({ question, onCodeChange, code }: { 
  question: any; 
  onCodeChange: (code: string) => void;
  code: string;
}) {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
  ];

  const handleRunCode = async () => {
    setIsRunning(true);
    // Simulate code execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    setOutput(`Test Case 1: Passed\nTest Case 2: Passed\nTest Case 3: Failed\n\nExpected: [1,2,3]\nActual: [1,2,4]`);
    setIsRunning(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Language Selector */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <select 
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="px-3 py-1 border rounded-md text-sm"
        >
          {languages.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRunCode} disabled={isRunning}>
            {isRunning ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Code
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 flex">
        <div className="flex-1 p-0">
          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm border-0 resize-none focus:outline-none bg-gray-900 text-green-400"
            placeholder={`// Write your ${selectedLanguage} solution here...\n\nfunction solution() {\n    // Your code here\n}`}
            style={{ minHeight: '400px' }}
          />
        </div>
      </div>

      {/* Output Panel */}
      {output && (
        <div className="border-t bg-gray-50 p-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Output
          </h4>
          <pre className="text-sm bg-gray-900 text-green-400 p-3 rounded-md overflow-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

export function RecruitmentAssessment() {
  const { user } = useAuth();
  const { data: assessments, isLoading: assessmentsLoading } = useMyAssessments();
  const submitAssessment = useSubmitAssessment();
  
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isAssessmentStarted, setIsAssessmentStarted] = useState(false);

  // Timer effect
  useEffect(() => {
    if (isAssessmentStarted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when time runs out
            handleSubmitAssessment();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isAssessmentStarted, timeRemaining]);

  const startAssessment = (assessment: any) => {
    setSelectedAssessment(assessment);
    setTimeRemaining(assessment.time_limit_minutes * 60); // Convert to seconds
    setIsAssessmentStarted(true);
    setCurrentQuestionIndex(0);
    setAnswers({});
  };

  const handleCodeChange = (code: string) => {
    if (!selectedAssessment) return;
    
    const questionId = selectedAssessment.questions?.[currentQuestionIndex]?.id || currentQuestionIndex;
    setAnswers(prev => ({
      ...prev,
      [questionId]: code
    }));
  };

  const handleSubmitAssessment = () => {
    if (!selectedAssessment) return;

    submitAssessment.mutate({
      id: selectedAssessment.id,
      answers: answers
    }, {
      onSuccess: () => {
        setSelectedAssessment(null);
        setIsAssessmentStarted(false);
        setAnswers({});
      }
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-purple-100 text-purple-800',
      graded: 'bg-green-100 text-green-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  if (assessmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If assessment is in progress, show the IDE interface
  if (selectedAssessment && isAssessmentStarted) {
    const currentQuestion = selectedAssessment.questions?.[currentQuestionIndex];
    const totalQuestions = selectedAssessment.questions?.length || 1;
    
    return (
      <div className="h-screen flex flex-col">
        {/* Assessment Header */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{selectedAssessment.title}</h1>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              <span className={cn(
                "font-mono text-lg",
                timeRemaining < 300 ? "text-red-600" : "text-gray-900"
              )}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Button onClick={handleSubmitAssessment} disabled={submitAssessment.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Submit Assessment
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Problem Statement */}
          <div className="w-1/2 border-r bg-white overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{currentQuestion?.title || 'Coding Problem'}</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Problem Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentQuestion?.description || 'Write a function that solves the given problem efficiently.'}
                  </p>
                </div>

                {currentQuestion?.sample_input && (
                  <div>
                    <h3 className="font-medium mb-2">Example</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm"><strong>Input:</strong> {currentQuestion.sample_input}</p>
                      <p className="text-sm"><strong>Output:</strong> {currentQuestion.sample_output}</p>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-2">Constraints</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Time Limit: {currentQuestion?.time_limit_minutes || 30} minutes</li>
                    <li>• Memory Limit: 256 MB</li>
                    <li>• Expected Time Complexity: O(n log n)</li>
                  </ul>
                </div>

                {currentQuestion?.test_cases && (
                  <div>
                    <h3 className="font-medium mb-2">Test Cases</h3>
                    <div className="space-y-2">
                      {currentQuestion.test_cases.slice(0, 2).map((testCase: any, index: number) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-md">
                          <p className="text-sm"><strong>Input:</strong> {testCase.input}</p>
                          <p className="text-sm"><strong>Expected Output:</strong> {testCase.output}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Code Editor */}
          <div className="w-1/2">
            <CodingIDE 
              question={currentQuestion}
              onCodeChange={handleCodeChange}
              code={answers[currentQuestion?.id || currentQuestionIndex] || ''}
            />
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="bg-white border-t p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} className="w-32" />
            <span className="text-sm text-muted-foreground">
              {currentQuestionIndex + 1} / {totalQuestions}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            <Button 
              variant="outline"
              onClick={() => setCurrentQuestionIndex(Math.min(totalQuestions - 1, currentQuestionIndex + 1))}
              disabled={currentQuestionIndex === totalQuestions - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recruitment Assessment</h1>
        <p className="text-muted-foreground">
          Complete your coding assessments and technical evaluations
        </p>
      </div>

      {/* Assessment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Assigned to you</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assessments?.filter(a => a.status === 'submitted' || a.status === 'graded').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Submitted assessments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assessments?.length > 0 ? 
                Math.round(assessments.filter(a => a.score).reduce((sum, a) => sum + (a.score || 0), 0) / assessments.filter(a => a.score).length) + '%' : 
                'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">Performance metric</p>
          </CardContent>
        </Card>
      </div>

      {/* Assessments List */}
      <Card>
        <CardHeader>
          <CardTitle>My Assessments</CardTitle>
          <CardDescription>
            Your coding assessments and technical evaluations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments && assessments.length > 0 ? (
            <div className="space-y-4">
              {assessments.map((assessment: any) => (
                <div key={assessment.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{assessment.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assessment.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {assessment.time_limit_minutes} minutes
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {assessment.assessment_type}
                        </span>
                        {assessment.score && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Score: {assessment.score}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusBadge(assessment.status)}>
                        {assessment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  {assessment.status === 'assigned' && (
                    <div className="space-y-3">
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Instructions:</strong> You have {assessment.time_limit_minutes} minutes to complete this assessment. 
                          Make sure you have a stable internet connection before starting.
                        </AlertDescription>
                      </Alert>
                      
                      <Button 
                        onClick={() => startAssessment(assessment)}
                        className="w-full"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Assessment
                      </Button>
                    </div>
                  )}

                  {assessment.status === 'in_progress' && (
                    <div className="space-y-3">
                      <Alert className="border-yellow-200 bg-yellow-50">
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          Assessment in progress. You can resume where you left off.
                        </AlertDescription>
                      </Alert>
                      
                      <Button 
                        onClick={() => startAssessment(assessment)}
                        className="w-full"
                        variant="outline"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume Assessment
                      </Button>
                    </div>
                  )}

                  {(assessment.status === 'submitted' || assessment.status === 'graded') && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold">{assessment.score || 'Pending'}%</div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">
                            {assessment.submitted_at ? 
                              format(new Date(assessment.submitted_at), 'MMM dd') : 
                              'N/A'
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">Submitted</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">
                            {assessment.started_at && assessment.submitted_at ?
                              differenceInMinutes(new Date(assessment.submitted_at), new Date(assessment.started_at)) + 'min' :
                              'N/A'
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">Duration</div>
                        </div>
                      </div>

                      {assessment.feedback && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium mb-2">Feedback:</h4>
                          <p className="text-sm text-muted-foreground">{assessment.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Code className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Assessments Available</h3>
              <p className="text-muted-foreground">
                Assessments will appear here once they are assigned by the HR team
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}