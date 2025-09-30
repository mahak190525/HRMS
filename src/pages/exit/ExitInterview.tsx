import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useExitProcess } from '@/hooks/useExit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  Star,
  User,
  Video,
  Phone,
  MapPin,
  Send,
  Eye,
  Edit,
  Save
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Mock exit interview data
const mockExitInterview = {
  id: '1',
  exit_process_id: 'exit-1',
  interviewer_id: 'hr-1',
  interviewer_name: 'Sarah Wilson',
  interviewer_title: 'HR Manager',
  scheduled_at: null,
  completed_at: null,
  status: 'scheduled',
  meeting_type: 'video_call',
  meeting_link: null,
  location: null,
  duration_minutes: 60,
  // Feedback ratings
  overall_satisfaction_rating: null,
  work_environment_rating: null,
  management_rating: null,
  growth_opportunities_rating: null,
  compensation_rating: null,
  // Feedback text
  what_did_you_like_most: null,
  what_could_be_improved: null,
  reason_for_leaving_detailed: null,
  would_recommend_company: null,
  would_consider_returning: null,
  additional_feedback: null,
  testimonial: null,
};

const availableTimeSlots = [
  { date: '2025-01-25', time: '10:00', available: true },
  { date: '2025-01-25', time: '14:00', available: true },
  { date: '2025-01-25', time: '16:00', available: false },
  { date: '2025-01-26', time: '09:00', available: true },
  { date: '2025-01-26', time: '11:00', available: true },
  { date: '2025-01-26', time: '15:00', available: true },
  { date: '2025-01-27', time: '10:00', available: true },
  { date: '2025-01-27', time: '13:00', available: true },
];

export function ExitInterview() {
  const { user } = useAuth();
  const { data: exitProcess, isLoading: exitProcessLoading } = useExitProcess();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [meetingType, setMeetingType] = useState('video_call');
  const [isScheduling, setIsScheduling] = useState(false);
  const [interview] = useState(mockExitInterview);
  
  // Feedback form states
  const [overallSatisfaction, setOverallSatisfaction] = useState(0);
  const [workEnvironment, setWorkEnvironment] = useState(0);
  const [management, setManagement] = useState(0);
  const [growthOpportunities, setGrowthOpportunities] = useState(0);
  const [compensation, setCompensation] = useState(0);
  const [likedMost, setLikedMost] = useState('');
  const [improvements, setImprovements] = useState('');
  const [detailedReason, setDetailedReason] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState('');
  const [wouldReturn, setWouldReturn] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [testimonial, setTestimonial] = useState('');

  // Check if user is HR
  const isHR = user?.role?.name === 'hr' || user?.role_id === 'hr' || 
              ['super_admin', 'admin'].includes(user?.role?.name || user?.role_id || '');

  const handleScheduleInterview = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select a date and time');
      return;
    }

    setIsScheduling(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Exit interview scheduled successfully!');
      setSelectedDate(undefined);
      setSelectedTime('');
    } catch (error) {
      toast.error('Failed to schedule interview');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSubmitFeedback = async () => {
    // Validate required fields
    if (!overallSatisfaction || !likedMost.trim() || !improvements.trim()) {
      toast.error('Please complete all required fields');
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Exit interview feedback submitted successfully!');
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  const renderStars = (rating: number, onRatingChange?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-5 w-5 cursor-pointer transition-colors",
          i < rating 
            ? 'text-yellow-400 fill-current' 
            : 'text-gray-300 hover:text-yellow-300'
        )}
        onClick={() => onRatingChange?.(i + 1)}
      />
    ));
  };

  const getInterviewStatus = () => {
    if (interview.completed_at) return { text: 'Completed', color: 'bg-green-100 text-green-800' };
    if (interview.scheduled_at) return { text: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    return { text: 'Not Scheduled', color: 'bg-yellow-100 text-yellow-800' };
  };

  if (exitProcessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!exitProcess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exit Interview</h1>
          <p className="text-muted-foreground">
            Schedule and complete your exit interview
          </p>
        </div>

        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Exit Process</h3>
            <p className="text-muted-foreground">
              Exit interview scheduling will be available when you have an active exit process.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = getInterviewStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exit Interview</h1>
        <p className="text-muted-foreground">
          Share your feedback and experiences with the company
        </p>
      </div>

      {/* Interview Status Overview */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Exit Interview</h3>
              <p className="text-muted-foreground">
                With {interview.interviewer_name} ({interview.interviewer_title})
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={status.color}>
                  {status.text}
                </Badge>
                <Badge variant="outline">
                  {interview.duration_minutes} minutes
                </Badge>
              </div>
            </div>
            {interview.scheduled_at && (
              <div className="text-right">
                <div className="font-semibold">
                  {format(new Date(interview.scheduled_at), 'MMM dd, yyyy')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(interview.scheduled_at), 'HH:mm')}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedule">Schedule Interview</TabsTrigger>
          <TabsTrigger value="feedback">Feedback Form</TabsTrigger>
          <TabsTrigger value="testimonial">Testimonial</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Schedule Your Exit Interview
                </CardTitle>
                <CardDescription>
                  Choose a convenient time for your exit interview
                </CardDescription>
              </CardHeader>
              <CardContent>
                {interview.scheduled_at ? (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your exit interview is scheduled for {format(new Date(interview.scheduled_at), 'MMM dd, yyyy')} at {format(new Date(interview.scheduled_at), 'HH:mm')}.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Interviewer: {interview.interviewer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Duration: {interview.duration_minutes} minutes</span>
                      </div>
                      {interview.meeting_link && (
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={interview.meeting_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Join Video Call
                          </a>
                        </div>
                      )}
                    </div>

                    <Button variant="outline" className="w-full">
                      <Edit className="h-4 w-4 mr-2" />
                      Reschedule Interview
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>Meeting Type</Label>
                      <Select value={meetingType} onValueChange={setMeetingType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video_call">Video Call</SelectItem>
                          <SelectItem value="phone_call">Phone Call</SelectItem>
                          <SelectItem value="in_person">In Person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Select Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal mt-1",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Available Time Slots</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {availableTimeSlots
                          .filter(slot => selectedDate && slot.date === format(selectedDate, 'yyyy-MM-dd'))
                          .map((slot) => (
                            <Button
                              key={slot.time}
                              variant={selectedTime === slot.time ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedTime(slot.time)}
                              disabled={!slot.available}
                              className="text-xs"
                            >
                              {slot.time}
                            </Button>
                          ))}
                      </div>
                    </div>

                    <Button 
                      onClick={handleScheduleInterview}
                      disabled={!selectedDate || !selectedTime || isScheduling}
                      className="w-full"
                    >
                      {isScheduling ? 'Scheduling...' : 'Schedule Interview'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interview Guidelines</CardTitle>
                <CardDescription>What to expect during your exit interview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Purpose:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Gather feedback about your experience</li>
                      <li>• Understand reasons for leaving</li>
                      <li>• Identify areas for improvement</li>
                      <li>• Maintain positive relationships</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Topics Covered:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Job satisfaction and work environment</li>
                      <li>• Management and leadership feedback</li>
                      <li>• Career development opportunities</li>
                      <li>• Compensation and benefits</li>
                      <li>• Suggestions for improvement</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Confidentiality:</h4>
                    <p className="text-muted-foreground">
                      Your feedback will be kept confidential and used only for organizational improvement. 
                      Individual responses will not be shared with your direct manager.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Exit Interview Feedback
              </CardTitle>
              <CardDescription>
                Share your honest feedback about your experience with the company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Rating Questions */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Rate Your Experience</h3>
                  
                  <div>
                    <Label>Overall Satisfaction *</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(overallSatisfaction, setOverallSatisfaction)}
                      <span className="text-sm text-muted-foreground ml-2">
                        {overallSatisfaction > 0 ? `${overallSatisfaction}/5` : 'Not rated'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>Work Environment</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(workEnvironment, setWorkEnvironment)}
                      <span className="text-sm text-muted-foreground ml-2">
                        {workEnvironment > 0 ? `${workEnvironment}/5` : 'Not rated'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>Management & Leadership</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(management, setManagement)}
                      <span className="text-sm text-muted-foreground ml-2">
                        {management > 0 ? `${management}/5` : 'Not rated'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>Growth Opportunities</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(growthOpportunities, setGrowthOpportunities)}
                      <span className="text-sm text-muted-foreground ml-2">
                        {growthOpportunities > 0 ? `${growthOpportunities}/5` : 'Not rated'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>Compensation & Benefits</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(compensation, setCompensation)}
                      <span className="text-sm text-muted-foreground ml-2">
                        {compensation > 0 ? `${compensation}/5` : 'Not rated'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Text Questions */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Detailed Feedback</h3>
                  
                  <div>
                    <Label htmlFor="likedMost">What did you like most about working here? *</Label>
                    <Textarea
                      id="likedMost"
                      value={likedMost}
                      onChange={(e) => setLikedMost(e.target.value)}
                      placeholder="Share what you enjoyed most about your time here..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="improvements">What could be improved? *</Label>
                    <Textarea
                      id="improvements"
                      value={improvements}
                      onChange={(e) => setImprovements(e.target.value)}
                      placeholder="Suggest areas where the company could improve..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="detailedReason">Detailed reason for leaving</Label>
                    <Textarea
                      id="detailedReason"
                      value={detailedReason}
                      onChange={(e) => setDetailedReason(e.target.value)}
                      placeholder="Provide more details about your decision to leave..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Would you recommend this company to others?</Label>
                      <Select value={wouldRecommend} onValueChange={setWouldRecommend}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="definitely">Definitely</SelectItem>
                          <SelectItem value="probably">Probably</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                          <SelectItem value="probably_not">Probably Not</SelectItem>
                          <SelectItem value="definitely_not">Definitely Not</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Would you consider returning in the future?</Label>
                      <Select value={wouldReturn} onValueChange={setWouldReturn}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="additionalFeedback">Additional Feedback</Label>
                    <Textarea
                      id="additionalFeedback"
                      value={additionalFeedback}
                      onChange={(e) => setAdditionalFeedback(e.target.value)}
                      placeholder="Any other feedback or suggestions..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>

                <Button onClick={handleSubmitFeedback} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testimonial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Company Testimonial
              </CardTitle>
              <CardDescription>
                Write a testimonial about your experience (optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <MessageSquare className="h-4 w-4" />
                  <AlertDescription>
                    Your testimonial may be used on our website, LinkedIn, or other marketing materials 
                    (with your permission). This is completely optional.
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="testimonial">Your Testimonial</Label>
                  <Textarea
                    id="testimonial"
                    value={testimonial}
                    onChange={(e) => setTestimonial(e.target.value)}
                    placeholder="Share your positive experience working with the company..."
                    className="mt-1"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This testimonial is optional and will only be used with your explicit consent.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setTestimonial('')} variant="outline">
                    Clear
                  </Button>
                  <Button onClick={() => toast.success('Testimonial saved!')}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Testimonial
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Testimonials */}
          <Card>
            <CardHeader>
              <CardTitle>Sample Testimonials</CardTitle>
              <CardDescription>Examples to help you write your own</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-sm italic">
                    "Working at [Company] has been an incredible journey. The collaborative environment, 
                    supportive management, and opportunities for growth made every day meaningful. 
                    I'm grateful for the skills I've developed and the relationships I've built here."
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">- Former Software Engineer</p>
                </div>
                
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-sm italic">
                    "The company's commitment to innovation and employee development is truly remarkable. 
                    I've had the privilege of working on cutting-edge projects with amazing colleagues. 
                    This experience has significantly advanced my career."
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">- Former Product Manager</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}