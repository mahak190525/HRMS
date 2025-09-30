import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuestionBank, useCreateQuestion, useUpdateQuestion, useDeleteQuestion } from '@/hooks/useATS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Code,
  FileText,
  Clock,
  Target,
  Shuffle
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const questionSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  difficulty: z.string().min(1, 'Difficulty is required'),
  question_type: z.string().min(1, 'Question type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  sample_input: z.string().optional(),
  sample_output: z.string().optional(),
  solution: z.string().optional(),
  time_limit_minutes: z.number().min(1, 'Time limit must be at least 1 minute'),
  tags: z.string().optional(),
});

type QuestionFormData = z.infer<typeof questionSchema>;

const categories = [
  'Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming',
  'Sorting', 'Searching', 'Hash Tables', 'Stacks', 'Queues', 'Recursion',
  'System Design', 'Database', 'Algorithms', 'Data Structures'
];

const difficulties = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-800' },
];

const questionTypes = [
  { value: 'coding', label: 'Coding Problem' },
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'system_design', label: 'System Design' },
];

export function QuestionBank() {
  const { user } = useAuth();
  const { data: questions, isLoading: questionsLoading } = useQuestionBank();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      category: '',
      subcategory: '',
      difficulty: 'medium',
      question_type: 'coding',
      title: '',
      description: '',
      sample_input: '',
      sample_output: '',
      solution: '',
      time_limit_minutes: 30,
      tags: '',
    },
  });

  const filteredQuestions = questions?.filter(question => {
    const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || categoryFilter === 'all' || question.category === categoryFilter;
    const matchesDifficulty = !difficultyFilter || difficultyFilter === 'all' || question.difficulty === difficultyFilter;
    const matchesType = !typeFilter || typeFilter === 'all' || question.question_type === typeFilter;
    
    return matchesSearch && matchesCategory && matchesDifficulty && matchesType;
  });

  const onSubmit = async (data: QuestionFormData) => {
    if (!user) return;

    const questionData = {
      ...data,
      tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [],
      created_by: user.id,
    };

    if (editingQuestion) {
      updateQuestion.mutate({
        id: editingQuestion.id,
        updates: questionData
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditingQuestion(null);
          form.reset();
        }
      });
    } else {
      createQuestion.mutate(questionData, {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          form.reset();
        }
      });
    }
  };

  const handleEditQuestion = (question: any) => {
    setEditingQuestion(question);
    form.reset({
      category: question.category,
      subcategory: question.subcategory || '',
      difficulty: question.difficulty,
      question_type: question.question_type,
      title: question.title,
      description: question.description,
      sample_input: question.sample_input || '',
      sample_output: question.sample_output || '',
      solution: question.solution || '',
      time_limit_minutes: question.time_limit_minutes,
      tags: question.tags?.join(', ') || '',
    });
    setIsEditDialogOpen(true);
  };

  const getDifficultyBadge = (difficulty: string) => {
    const difficultyConfig = difficulties.find(d => d.value === difficulty);
    return difficultyConfig?.color || 'bg-gray-100 text-gray-800';
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      coding: 'bg-blue-100 text-blue-800',
      mcq: 'bg-green-100 text-green-800',
      descriptive: 'bg-purple-100 text-purple-800',
      system_design: 'bg-orange-100 text-orange-800',
    };
    return variants[type as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  if (questionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground">
            Manage interview questions and coding problems
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Shuffle className="h-4 w-4 mr-2" />
            Random Question
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create New Question</DialogTitle>
                <DialogDescription>
                  Add a new question to the interview question bank
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="difficulty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Difficulty *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select difficulty" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {difficulties.map((difficulty) => (
                                <SelectItem key={difficulty.value} value={difficulty.value}>
                                  {difficulty.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="question_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Question Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {questionTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="time_limit_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Limit (minutes) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="30" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Question Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter question title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Problem Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the problem in detail..."
                            {...field}
                            rows={6}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sample_input"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sample Input</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Example input..."
                              {...field}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sample_output"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sample Output</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Expected output..."
                              {...field}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="solution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Solution (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Reference solution..."
                            {...field}
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (comma-separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="array, sorting, binary-search" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setIsEditDialogOpen(false);
                        setEditingQuestion(null);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createQuestion.isPending || updateQuestion.isPending}>
                      {(createQuestion.isPending || updateQuestion.isPending) ? 'Saving...' : editingQuestion ? 'Update Question' : 'Create Question'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">In question bank</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Coding Problems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {questions?.filter(q => q.question_type === 'coding').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Programming challenges</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(questions?.map(q => q.category)).size || 0}
            </div>
            <p className="text-xs text-muted-foreground">Different topics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Time Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {questions?.length > 0 ? 
                Math.round(questions.reduce((sum, q) => sum + q.time_limit_minutes, 0) / questions.length) : 0
              }min
            </div>
            <p className="text-xs text-muted-foreground">Average duration</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  {difficulties.map((difficulty) => (
                    <SelectItem key={difficulty.value} value={difficulty.value}>
                      {difficulty.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {questionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('');
                  setDifficultyFilter('');
                  setTypeFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Question Bank ({filteredQuestions?.length || 0})</CardTitle>
          <CardDescription>
            Collection of interview questions and coding problems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Time Limit</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions?.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium line-clamp-1">{question.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.description}
                      </div>
                      {question.tags && question.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {question.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{question.category}</Badge>
                    {question.subcategory && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {question.subcategory}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getDifficultyBadge(question.difficulty)}>
                      {question.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeBadge(question.question_type)}>
                      {question.question_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {question.time_limit_minutes}min
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{question.created_by_user?.full_name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild
                            onClick={() => setSelectedQuestion(question)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Question Preview</DialogTitle>
                            <DialogDescription>
                              Preview how this question appears to candidates
                            </DialogDescription>
                          </DialogHeader>
                          {selectedQuestion && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-4">
                                <Badge className={getDifficultyBadge(selectedQuestion.difficulty)}>
                                  {selectedQuestion.difficulty}
                                </Badge>
                                <Badge className={getTypeBadge(selectedQuestion.question_type)}>
                                  {selectedQuestion.question_type.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline">{selectedQuestion.category}</Badge>
                              </div>

                              <div>
                                <h3 className="font-semibold text-lg mb-2">{selectedQuestion.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {selectedQuestion.description}
                                </p>
                              </div>

                              {selectedQuestion.sample_input && (
                                <div>
                                  <h4 className="font-medium mb-2">Example</h4>
                                  <div className="bg-gray-50 p-3 rounded-md">
                                    <p className="text-sm"><strong>Input:</strong> {selectedQuestion.sample_input}</p>
                                    <p className="text-sm"><strong>Output:</strong> {selectedQuestion.sample_output}</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {selectedQuestion.time_limit_minutes} minutes
                                </span>
                                <span>Created by: {selectedQuestion.created_by_user?.full_name}</span>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        asChild
                        onClick={() => handleEditQuestion(question)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            asChild
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Question</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this question? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteQuestion.mutate(question.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Question
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Question Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update question details and information
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter question title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Problem Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the problem in detail..."
                        {...field}
                        rows={6}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingQuestion(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateQuestion.isPending}>
                  {updateQuestion.isPending ? 'Updating...' : 'Update Question'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}