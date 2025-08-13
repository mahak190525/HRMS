import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

const leaveTypes = [
  { value: 'annual', label: 'Annual Leave', balance: 12, color: 'bg-blue-500' },
  { value: 'sick', label: 'Sick Leave', balance: 8, color: 'bg-red-500' },
  { value: 'casual', label: 'Casual Leave', balance: 5, color: 'bg-green-500' },
  { value: 'maternity', label: 'Maternity Leave', balance: 90, color: 'bg-purple-500' },
  { value: 'paternity', label: 'Paternity Leave', balance: 15, color: 'bg-orange-500' },
  { value: 'emergency', label: 'Emergency Leave', balance: 3, color: 'bg-yellow-500' },
];

const leaveHistory = [
  {
    id: 1,
    type: 'Annual Leave',
    startDate: '2024-12-20',
    endDate: '2024-12-22',
    days: 3,
    reason: 'Family vacation',
    status: 'approved',
    appliedAt: '2024-12-01',
    approvedBy: 'Sarah Johnson',
    approvedAt: '2024-12-02'
  },
  {
    id: 2,
    type: 'Sick Leave',
    startDate: '2024-11-15',
    endDate: '2024-11-16',
    days: 2,
    reason: 'Flu symptoms',
    status: 'approved',
    appliedAt: '2024-11-14',
    approvedBy: 'Sarah Johnson',
    approvedAt: '2024-11-14'
  },
  {
    id: 3,
    type: 'Casual Leave',
    startDate: '2024-10-28',
    endDate: '2024-10-28',
    days: 1,
    reason: 'Personal work',
    status: 'pending',
    appliedAt: '2024-10-25',
    approvedBy: null,
    approvedAt: null
  },
];

export function LeaveApplication() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateDays = () => {
    if (startDate && endDate) {
      return differenceInDays(endDate, startDate) + 1;
    }
    return 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset form
      setSelectedType('');
      setStartDate(undefined);
      setEndDate(undefined);
      setReason('');
      
      // Show success message (you can implement toast here)
      alert('Leave application submitted successfully!');
    } catch (error) {
      alert('Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalLeaveBalance = leaveTypes.reduce((sum, type) => sum + type.balance, 0);
  const usedLeave = leaveHistory
    .filter(leave => leave.status === 'approved')
    .reduce((sum, leave) => sum + leave.days, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Application</h1>
        <p className="text-muted-foreground">
          Manage your leave requests and view your leave balance
        </p>
      </div>

      <Tabs defaultValue="apply" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="apply">Apply for Leave</TabsTrigger>
          <TabsTrigger value="balance">Leave Balance</TabsTrigger>
          <TabsTrigger value="history">Leave History</TabsTrigger>
        </TabsList>

        <TabsContent value="apply" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    New Leave Application
                  </CardTitle>
                  <CardDescription>
                    Submit a new leave request for approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="leaveType">Leave Type</Label>
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${type.color}`} />
                                {type.label} ({type.balance} days available)
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal mt-1",
                                !startDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "PPP") : "Pick start date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={setStartDate}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label>End Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal mt-1",
                                !endDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {endDate ? format(endDate, "PPP") : "Pick end date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={endDate}
                              onSelect={setEndDate}
                              disabled={(date) => date < (startDate || new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {startDate && endDate && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Total days requested: <strong>{calculateDays()} days</strong>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <Label htmlFor="reason">Reason for Leave</Label>
                      <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Please provide a reason for your leave request..."
                        className="mt-1"
                        rows={4}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={!selectedType || !startDate || !endDate || !reason.trim() || isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Total Leave Balance</span>
                      <span>{totalLeaveBalance} days</span>
                    </div>
                    <Progress value={((totalLeaveBalance - usedLeave) / totalLeaveBalance) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Used This Year</span>
                      <span>{usedLeave} days</span>
                    </div>
                    <Progress value={(usedLeave / totalLeaveBalance) * 100} className="bg-red-100" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Remaining</span>
                      <span>{totalLeaveBalance - usedLeave} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Holidays</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Christmas Day</span>
                      <Badge variant="outline">Dec 25</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">New Year's Day</span>
                      <Badge variant="outline">Jan 1</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Republic Day</span>
                      <Badge variant="outline">Jan 26</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="balance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaveTypes.map((type) => (
              <Card key={type.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className={`w-4 h-4 rounded-full ${type.color}`} />
                    {type.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{type.balance}</div>
                  <p className="text-sm text-muted-foreground">days available</p>
                  <Progress value={85} className="mt-3" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round(type.balance * 0.15)} days used this year
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>
                View all your previous leave applications and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveHistory.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">{leave.type}</TableCell>
                      <TableCell>
                        {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{leave.days}</TableCell>
                      <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(leave.status)}
                          <Badge className={getStatusBadge(leave.status)}>
                            {leave.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(leave.appliedAt), 'MMM dd, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}